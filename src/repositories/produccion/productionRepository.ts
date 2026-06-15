import { getDocs, query, where, doc, runTransaction, collection } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Order, Product, Equivalencia, StockMovement } from '../../types/domain';
import { convertUnit, convertQuantityToBaseUnit } from '../../lib/unitConverter';


export const productionRepository = {
  async fetchProductionData(): Promise<{
    orders: Order[];
    products: Product[];
    equivalences: Equivalencia[];
    movements: StockMovement[];
  }> {
    const [ordersSnap, productsSnap, equivSnap, moveSnap] = await Promise.all([
      getDocs(query(COLLECTIONS.ORDERS, where('isDeleted', '==', false))),
      getDocs(query(COLLECTIONS.PRODUCTS, where('activo', '==', true))),
      getDocs(COLLECTIONS.EQUIVALENCES),
      getDocs(query(COLLECTIONS.STOCK_MOVEMENTS, where('isDeleted', '==', false)))
    ]);

    return {
      orders: ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order)),
      products: productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)),
      equivalences: equivSnap.docs.map(d => ({ id: d.id, ...d.data() } as Equivalencia)),
      movements: moveSnap.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement))
    };
  },

  async produce(
    data: {
      productId: string;
      cantidad: number;
      pesoReal?: number;
      merma?: number;
      observaciones: string;
      orderId?: string;
      newOrderStatus?: 'EN_PRODUCCION' | 'PRODUCIDO';
    },
    equivalences: Equivalencia[]
  ): Promise<void> {
    await runTransaction(db, async (transaction) => {
      // 1. Get current product (READ)
      const productRef = doc(db, 'products', data.productId);
      const productDoc = await transaction.get(productRef);
      if (!productDoc.exists()) throw new Error("Producto no encontrado");
      
      const productData = productDoc.data() as Product;
      const currentStock = productData.stockActual || 0;
      const recipeItems = productData.recipeItems || [];

      // 2. Get all ingredient docs (READ PHASE)
      const ingredientDocs: Record<string, { ref: any, data: Product }> = {};
      for (const ing of recipeItems) {
        const ingRef = doc(db, 'products', ing.productId);
        const ingDoc = await transaction.get(ingRef);
        if (ingDoc.exists()) {
          ingredientDocs[ing.productId] = {
            ref: ingRef,
            data: { id: ingDoc.id, ...(ingDoc.data() || {}) } as Product
          };
        }
      }

      // 3. calculations & WRITE PHASE
      for (const ing of recipeItems) {
        const ingEntry = ingredientDocs[ing.productId];
        if (ingEntry) {
          const ingData = ingEntry.data;
          const currentIngStock = ingData.stockActual || 0;

          // Convert quantity from recipe unit to base unit of ingredient
          const convertedQty = convertUnit(
            ing.quantity,
            ing.unit,
            ingData.unitType,
            ingData.nombre || '',
            '',
            equivalences
          );

          const stockToDeduct = convertedQty * data.cantidad;
          transaction.update(ingEntry.ref, {
            stockActual: currentIngStock - stockToDeduct
          });

          // Movement for ingredient
          const ingMovRef = doc(collection(db, 'stock_movements'));
          transaction.set(ingMovRef, {
            productId: ing.productId,
            qty: -stockToDeduct,
            type: 'PRODUCCION',
            date: new Date().toISOString(),
            referenceId: data.orderId || '',
            observaciones: `Consumo para producción de ${productData.nombre}`,
            isDeleted: false
          });
        }
      }

      // 4. Aumentar stock terminado
      transaction.update(productRef, {
        stockActual: currentStock + data.cantidad
      });

      // 5. Generar stock_movements para producto terminado
      const movRef = doc(collection(db, 'stock_movements'));
      transaction.set(movRef, {
        productId: data.productId,
        qty: data.cantidad,
        type: 'PRODUCCION',
        date: new Date().toISOString(),
        referenceId: data.orderId || '',
        observaciones: data.observaciones + (data.merma ? ` | Merma: ${data.merma}` : '') + (data.pesoReal ? ` | Peso Real: ${data.pesoReal}` : ''),
        isDeleted: false
      });

      // 6. Update order status if applicable
      if (data.orderId && data.newOrderStatus) {
        const orderRef = doc(db, 'orders', data.orderId);
        transaction.update(orderRef, {
          status: data.newOrderStatus
        });
      }
    });
  },

  async produceMultiple(
    data: {
      orderId?: string;
      items: {
        productId: string;
        cantidad: number;
        unidad: string;
        pesoReal?: number;
        merma?: number;
        observaciones: string;
      }[];
      newOrderStatus?: 'EN_PRODUCCION' | 'PRODUCIDO';
    },
    equivalences: Equivalencia[]
  ): Promise<void> {
    await runTransaction(db, async (transaction) => {
      // --- READ PHASE: Fetch order and main products ---
      let orderData: Order | null = null;
      let orderRef: any = null;
      if (data.orderId) {
        orderRef = doc(db, 'orders', data.orderId);
        const orderDoc = await transaction.get(orderRef);
        if (orderDoc.exists()) {
          orderData = { id: orderDoc.id, ...(orderDoc.data() || {}) } as Order;
        }
      }

      // Fetch main products
      const mainProductDocs: { ref: any, doc: any, data: Product }[] = [];
      for (const item of data.items) {
        const productRef = doc(db, 'products', item.productId);
        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists()) throw new Error(`Producto ${item.productId} no encontrado`);
        mainProductDocs.push({
          ref: productRef,
          doc: productDoc,
          data: { id: productDoc.id, ...(productDoc.data() || {}) } as Product
        });
      }

      // --- CALCULATIONS & WRITE PHASE ---
      const stockUpdates: Record<string, number> = {}; // productId -> newStock
      const queuedMovements: { ref: any, data: any }[] = [];

      for (const item of data.items) {
        const mp = mainProductDocs.find(x => x.data.id === item.productId);
        if (!mp) continue;

        const productData = mp.data;
        const baseQty = convertQuantityToBaseUnit(item.cantidad, item.unidad, productData);

        // For orders, we DISCOUNT finished stock and do NOT consume ingredients
        const currentStock = stockUpdates[item.productId] !== undefined
          ? stockUpdates[item.productId]
          : (productData.stockActual || 0);
        stockUpdates[item.productId] = currentStock - baseQty;

        // Queue movement (negative quantity since we are discounting finished stock for the order)
        const movRef = doc(collection(db, 'stock_movements'));
        queuedMovements.push({
          ref: movRef,
          data: {
            productId: item.productId,
            qty: -baseQty,
            type: 'VENTA',
            date: new Date().toISOString(),
            referenceId: data.orderId || '',
            observaciones: `Preparación de Pedido: ${item.observaciones}` + (item.merma ? ` | Merma: ${item.merma}` : '') + (item.pesoReal ? ` | Peso Real: ${item.pesoReal}` : ''),
            isDeleted: false
          }
        });
      }

      // Perform Stock Updates
      Object.entries(stockUpdates).forEach(([prodId, newStock]) => {
        const prodRef = doc(db, 'products', prodId);
        transaction.update(prodRef, { stockActual: newStock });
      });

      // Create Movements
      queuedMovements.forEach(m => {
        transaction.set(m.ref, m.data);
      });

      // Update Order if applicable
      if (orderData && orderRef) {
        const updatedItems = [];
        for (const item of orderData.items || []) {
          const prodItem = data.items.find(it => it.productId === item.productId);
          if (prodItem) {
            const newQty = prodItem.cantidad;
            const newPesoReal = prodItem.pesoReal !== undefined ? prodItem.pesoReal : item.pesoReal;

            const mp = mainProductDocs.find(x => x.data.id === item.productId);
            const product = mp ? mp.data : undefined;

            let newSubtotal = item.subtotal;
            const price = item.precioEstimado;
            const isWeightBased = product && (product.unitType === 'KG' || product.unitType === 'UNIDADES');
            if (newPesoReal !== undefined && isWeightBased) {
              newSubtotal = newPesoReal * price;
            } else if (product) {
              const baseQty = convertQuantityToBaseUnit(newQty, prodItem.unidad, product);
              newSubtotal = baseQty * price;
            }

            updatedItems.push({
              ...item,
              cantidad: newQty,
              unidad: prodItem.unidad as any,
              pesoReal: newPesoReal,
              subtotal: newSubtotal,
              observaciones: prodItem.observaciones || item.observaciones || ''
            });
          } else {
            updatedItems.push(item);
          }
        }

        const newTotal = updatedItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
        transaction.update(orderRef, {
          items: updatedItems,
          totalEstimado: newTotal,
          status: data.newOrderStatus || orderData.status
        });
      }
    });
  },

  async revertMovement(movementId: string, movData: StockMovement): Promise<void> {
    await runTransaction(db, async (transaction) => {
      // 1. READ product stock first
      const prodRef = doc(db, 'products', movData.productId);
      const prodDoc = await transaction.get(prodRef);
      const currentStock = prodDoc.exists() ? (prodDoc.data().stockActual || 0) : 0;

      // 2. WRITE compensatory movement and stock update
      const compRef = doc(collection(db, 'stock_movements'));
      transaction.set(compRef, {
        productId: movData.productId,
        qty: -movData.qty,
        type: movData.type,
        date: new Date().toISOString(),
        referenceId: movData.referenceId || '',
        observaciones: `Reversión de movimiento ${movementId}`,
        isDeleted: false
      });

      if (prodDoc.exists()) {
        transaction.update(prodRef, {
          stockActual: currentStock - movData.qty
        });
      }
    });
  }
};
