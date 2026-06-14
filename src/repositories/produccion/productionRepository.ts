import { getDocs, query, where, doc, runTransaction, collection } from 'firebase/firestore';
import { db, COLLECTIONS } from '../lib/firebase';
import type { Order, Product, Equivalencia, StockMovement } from '../types/domain';
import { convertUnit } from '../lib/unitConverter';


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
      // 1. Get current product
      const productRef = doc(db, 'products', data.productId);
      const productDoc = await transaction.get(productRef);
      if (!productDoc.exists()) throw new Error("Producto no encontrado");
      
      const productData = productDoc.data();
      const currentStock = productData.stockActual || 0;
      const recipeItems = productData.recipeItems || [];

      // 2. Descontar insumos
      for (const ing of recipeItems) {
        const ingRef = doc(db, 'products', ing.productId);
        const ingDoc = await transaction.get(ingRef);
        if (ingDoc.exists()) {
          const ingData = ingDoc.data();
          const currentIngStock = ingData.stockActual || 0;

          // Convert quantity from recipe unit to base unit of ingredient
          const convertedQty = convertUnit(
            ing.quantity,
            ing.unit,
            ingData.unitType,
            ingData.nombre || ingData.name || '',
            ingData.category || '',
            equivalences
          );

          const stockToDeduct = convertedQty * data.cantidad;
          transaction.update(ingRef, {
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

      // 3. Aumentar stock terminado
      transaction.update(productRef, {
        stockActual: currentStock + data.cantidad
      });

      // 4. Generar stock_movements para producto terminado
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

      // 5. Update order status if applicable
      if (data.orderId && data.newOrderStatus) {
        const orderRef = doc(db, 'orders', data.orderId);
        transaction.update(orderRef, {
          status: data.newOrderStatus
        });
      }
    });
  },

  async revertMovement(movementId: string, movData: StockMovement): Promise<void> {
    await runTransaction(db, async (transaction) => {
      // Create compensatory movement
      const compRef = doc(collection(db, 'stock_movements'));
      transaction.set(compRef, {
        productId: movData.productId,
        qty: -movData.qty,
        type: 'PRODUCCION',
        date: new Date().toISOString(),
        referenceId: movData.referenceId || '',
        observaciones: `Reversión de movimiento ${movementId}`,
        isDeleted: false
      });

      // Update product stock
      const prodRef = doc(db, 'products', movData.productId);
      const prodDoc = await transaction.get(prodRef);
      if (prodDoc.exists()) {
        transaction.update(prodRef, {
          stockActual: (prodDoc.data().stockActual || 0) - movData.qty
        });
      }
    });
  }
};
