import { getDocs, query, where, doc, runTransaction, collection } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Order, Product, Equivalencia, StockMovement, RecipeItem, Customer } from '../../types/domain';
import { convertUnit, convertQuantityToBaseUnit, calculateWeightInKg } from '../../lib/unitConverter';
import { truncateDecimals } from '../../lib/formatters';


export const productionRepository = {
  async fetchProductionData(): Promise<{
    orders: Order[];
    products: Product[];
    recipes: any[];
    equivalences: Equivalencia[];
    movements: StockMovement[];
    customers: Customer[];
  }> {
    const [ordersSnap, productsSnap, recipesSnap, equivSnap, moveSnap, customersSnap] = await Promise.all([
      getDocs(query(COLLECTIONS.ORDERS, where('isDeleted', '==', false))),
      getDocs(query(COLLECTIONS.PRODUCTS, where('activo', '==', true))),
      getDocs(COLLECTIONS.RECIPES),
      getDocs(COLLECTIONS.EQUIVALENCES),
      getDocs(query(COLLECTIONS.STOCK_MOVEMENTS, where('isDeleted', '==', false))),
      getDocs(COLLECTIONS.CUSTOMERS)
    ]);

    return {
      orders: ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any as Order)),
      products: productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any as Product)),
      recipes: recipesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      equivalences: equivSnap.docs.map(d => ({ id: d.id, ...d.data() } as any as Equivalencia)),
      movements: moveSnap.docs.map(d => ({ id: d.id, ...d.data() } as any as StockMovement)),
      customers: customersSnap.docs.map(d => ({ id: d.id, ...d.data() } as any as Customer))
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
      recipeItemsOverride?: RecipeItem[];
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
      
      let recipeItems: RecipeItem[] = [];

      if (data.recipeItemsOverride !== undefined) {
        recipeItems = data.recipeItemsOverride;
      } else {
        recipeItems = productData.recipeItems || [];
        const recipeId = productData.recipeId || (productData as any).recetaId;

        if (recipeItems.length === 0 && recipeId) {
          const recipeRef = doc(db, 'recipes', recipeId);
          const recipeDoc = await transaction.get(recipeRef);
          if (recipeDoc.exists()) {
            const recipeData = recipeDoc.data();
            const ingredients = recipeData.ingredients || [];
            recipeItems = ingredients.map((ing: any) => ({
              productId: ing.productId,
              quantity: ing.quantity,
              unit: ing.unit || 'GRAMOS'
            }));
          }
        }
      }

      // 2. Get all ingredient docs (READ PHASE)
      const ingredientDocs: Record<string, { ref: any, data: Product }> = {};
      for (const ing of recipeItems) {
        const ingRef = doc(db, 'products', ing.productId);
        const ingDoc = await transaction.get(ingRef);
        if (ingDoc.exists()) {
          ingredientDocs[ing.productId] = {
            ref: ingRef,
            data: { id: ingDoc.id, ...(ingDoc.data() || {}) } as any as Product
          };
        }
      }

      // 3. calculations & WRITE PHASE
      for (const ing of recipeItems) {
        const ingEntry = ingredientDocs[ing.productId];
        if (ingEntry) {
          const ingData = ingEntry.data;
          const currentIngStock = ingData.stockActual || 0;

          let stockToDeduct = 0;
          if (ing.pesoNeto !== undefined && ing.pesoNeto > 0) {
            stockToDeduct = convertQuantityToBaseUnit(ing.pesoNeto, 'KG', ingData);
          } else {
            // Convert quantity from recipe unit to base unit of ingredient
            const convertedQty = convertUnit(
              ing.quantity,
              ing.unit,
              ingData.unitType,
              ingData.nombre || '',
              '',
              equivalences
            );
            stockToDeduct = convertedQty * data.cantidad;
          }
          
          stockToDeduct = truncateDecimals(stockToDeduct, 3);
          const newIngStock = truncateDecimals(currentIngStock - stockToDeduct, 3);

          transaction.update(ingEntry.ref, {
            stockActual: newIngStock
          });

          // Movement for ingredient
          const ingMovRef = doc(collection(db, 'stock_movements'));
          transaction.set(ingMovRef, {
            productId: ing.productId,
            qty: -stockToDeduct,
            type: 'PRODUCCION',
            date: new Date().toISOString(),
            referenceId: data.orderId || '',
            observaciones: `Consumo para producción de ${productData.nombre}` + (ing.pesoNeto ? ` | Peso Neto: ${ing.pesoNeto} KG` : ''),
            isDeleted: false
          });
        }
      }

      // 4. Aumentar stock terminado
      const truncatedProdQty = truncateDecimals(data.cantidad, 3);
      const newFinishedStock = truncateDecimals(currentStock + truncatedProdQty, 3);
      transaction.update(productRef, {
        stockActual: newFinishedStock
      });

      // 5. Generar stock_movements para producto terminado
      const movRef = doc(collection(db, 'stock_movements'));
      transaction.set(movRef, {
        productId: data.productId,
        qty: truncatedProdQty,
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
        recipeItemsOverride?: RecipeItem[];
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
          orderData = { id: orderDoc.id, ...(orderDoc.data() || {}) } as any as Order;
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
          data: { id: productDoc.id, ...(productDoc.data() || {}) } as any as Product
        });
      }

      // Resolve recipes for each item and load ingredient documents in read phase
      const itemsRecipes: { itemId: string; recipeItems: RecipeItem[] }[] = [];
      const ingredientDocs: Record<string, { ref: any, data: Product }> = {};

      for (let idx = 0; idx < data.items.length; idx++) {
        const item = data.items[idx];
        const mp = mainProductDocs.find(x => x.data.id === item.productId);
        if (!mp) continue;

        let recipeItems: RecipeItem[] = [];
        if (item.recipeItemsOverride !== undefined) {
          recipeItems = item.recipeItemsOverride;
        } else {
          const productData = mp.data;
          recipeItems = productData.recipeItems || [];
          const recipeId = productData.recipeId || (productData as any).recetaId;

          if (recipeItems.length === 0 && recipeId) {
            const recipeRef = doc(db, 'recipes', recipeId);
            const recipeDoc = await transaction.get(recipeRef);
            if (recipeDoc.exists()) {
              const recipeData = recipeDoc.data();
              const ingredients = recipeData.ingredients || [];
              recipeItems = ingredients.map((ing: any) => ({
                productId: ing.productId,
                quantity: ing.quantity,
                unit: ing.unit || 'GRAMOS'
              }));
            }
          }
        }

        itemsRecipes.push({ itemId: `${item.productId}_${idx}`, recipeItems });

        // Queue reading of these ingredients if they haven't been loaded yet
        for (const ing of recipeItems) {
          if (!ingredientDocs[ing.productId]) {
            const ingRef = doc(db, 'products', ing.productId);
            const ingDoc = await transaction.get(ingRef);
            if (ingDoc.exists()) {
              ingredientDocs[ing.productId] = {
                ref: ingRef,
                data: { id: ingDoc.id, ...(ingDoc.data() || {}) } as any as Product
              };
            }
          }
        }
      }

      // --- CALCULATIONS & WRITE PHASE ---
      const stockUpdates: Record<string, number> = {}; // productId -> newStock
      const queuedMovements: { ref: any, data: any }[] = [];

      // Process each item to calculate stock changes and queue movements
      for (let idx = 0; idx < data.items.length; idx++) {
        const item = data.items[idx];
        const mp = mainProductDocs.find(x => x.data.id === item.productId);
        if (!mp) continue;

        const productData = mp.data;
        let baseQty = convertQuantityToBaseUnit(item.cantidad, item.unidad, productData);
        baseQty = truncateDecimals(baseQty, 3);

        // 1. Discount finished stock (standard behavior for sales orders)
        const currentStock = stockUpdates[item.productId] !== undefined
          ? stockUpdates[item.productId]
          : (productData.stockActual || 0);
        stockUpdates[item.productId] = truncateDecimals(currentStock - baseQty, 3);

        // Queue finished product sale movement (negative qty)
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

        // 2. Process recipe ingredients (CONSUMPTION)
        const recipeInfo = itemsRecipes.find(r => r.itemId === `${item.productId}_${idx}`);
        if (recipeInfo) {
          for (const ing of recipeInfo.recipeItems) {
            const ingEntry = ingredientDocs[ing.productId];
            if (ingEntry) {
              const ingData = ingEntry.data;
              const currentIngStock = stockUpdates[ing.productId] !== undefined
                ? stockUpdates[ing.productId]
                : (ingData.stockActual || 0);

              let stockToDeduct = 0;
              if (ing.pesoNeto !== undefined && ing.pesoNeto > 0) {
                stockToDeduct = convertQuantityToBaseUnit(ing.pesoNeto, 'KG', ingData);
              } else {
                // Convert quantity from recipe unit to base unit of ingredient
                const convertedQty = convertUnit(
                  ing.quantity,
                  ing.unit,
                  ingData.unitType,
                  ingData.nombre || '',
                  '',
                  equivalences
                );
                // Deduct ingredients proportional to the item quantity (step quantity)
                stockToDeduct = convertedQty * item.cantidad;
              }

              stockToDeduct = truncateDecimals(stockToDeduct, 3);
              stockUpdates[ing.productId] = truncateDecimals(currentIngStock - stockToDeduct, 3);

              // Queue ingredient consumption movement (negative qty, type PRODUCCION)
              const ingMovRef = doc(collection(db, 'stock_movements'));
              queuedMovements.push({
                ref: ingMovRef,
                data: {
                  productId: ing.productId,
                  qty: -stockToDeduct,
                  type: 'PRODUCCION',
                  date: new Date().toISOString(),
                  referenceId: data.orderId || '',
                  observaciones: `Consumo para producción de ${productData.nombre} (Pedido)` + (ing.pesoNeto ? ` | Peso Neto: ${ing.pesoNeto} KG` : ''),
                  isDeleted: false
                }
              });
            }
          }
        }
      }

      // Perform all Stock Updates in transaction
      Object.entries(stockUpdates).forEach(([prodId, newStock]) => {
        const prodRef = doc(db, 'products', prodId);
        transaction.update(prodRef, { stockActual: truncateDecimals(newStock, 3) });
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
            const newQty = truncateDecimals(prodItem.cantidad, 3);
            const newPesoReal = prodItem.pesoReal !== undefined ? truncateDecimals(prodItem.pesoReal, 3) : item.pesoReal;

            const mp = mainProductDocs.find(x => x.data.id === item.productId);
            const product = mp ? mp.data : undefined;
            let newSubtotal = item.subtotal;
            const price = item.precioEstimado;
            if (product) {
              const weightInKg = newPesoReal !== undefined && newPesoReal > 0 ? newPesoReal : calculateWeightInKg(newQty, prodItem.unidad, product);
              newSubtotal = weightInKg * price;
            }

            updatedItems.push({
              ...item,
              cantidad: newQty,
              unidad: prodItem.unidad as any,
              pesoReal: newPesoReal,
              subtotal: Number(newSubtotal.toFixed(2)),
              observaciones: prodItem.observaciones || item.observaciones || ''
            });
          } else {
            updatedItems.push(item);
          }
        }

        const newTotal = updatedItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
        transaction.update(orderRef, {
          items: updatedItems,
          totalEstimado: Number(newTotal.toFixed(2)),
          status: data.newOrderStatus || orderData.status
        });
      }
    });
  },

  async produceStep(
    data: {
      orderId: string;
      productId: string;
      cantidad: number;
      unidad: string;
      pesoReal?: number;
      merma?: number;
      observaciones: string;
      recipeItemsOverride?: RecipeItem[];
      isLastStep: boolean;
      newOrderStatus?: 'EN_PRODUCCION' | 'PRODUCIDO';
    },
    equivalences: Equivalencia[]
  ): Promise<void> {
    await runTransaction(db, async (transaction) => {
      // 1. READ PHASE
      const orderRef = doc(db, 'orders', data.orderId);
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists()) throw new Error(`Pedido ${data.orderId} no encontrado`);
      const orderData = { id: orderDoc.id, ...(orderDoc.data() || {}) } as any as Order;

      const productRef = doc(db, 'products', data.productId);
      const productDoc = await transaction.get(productRef);
      if (!productDoc.exists()) throw new Error(`Producto ${data.productId} no encontrado`);
      const productData = { id: productDoc.id, ...(productDoc.data() || {}) } as any as Product;

      let recipeItems: RecipeItem[] = [];
      if (data.recipeItemsOverride !== undefined) {
        recipeItems = data.recipeItemsOverride;
      } else {
        recipeItems = productData.recipeItems || [];
        const recipeId = productData.recipeId || (productData as any).recetaId;

        if (recipeItems.length === 0 && recipeId) {
          const recipeRef = doc(db, 'recipes', recipeId);
          const recipeDoc = await transaction.get(recipeRef);
          if (recipeDoc.exists()) {
            const recipeData = recipeDoc.data();
            const ingredients = recipeData.ingredients || [];
            recipeItems = ingredients.map((ing: any) => ({
              productId: ing.productId,
              quantity: ing.quantity,
              unit: ing.unit || 'GRAMOS'
            }));
          }
        }
      }

      const ingredientDocs: Record<string, { ref: any, data: Product }> = {};
      for (const ing of recipeItems) {
        if (!ingredientDocs[ing.productId]) {
          const ingRef = doc(db, 'products', ing.productId);
          const ingDoc = await transaction.get(ingRef);
          if (ingDoc.exists()) {
            ingredientDocs[ing.productId] = {
              ref: ingRef,
              data: { id: ingDoc.id, ...(ingDoc.data() || {}) } as any as Product
            };
          }
        }
      }

      // 2. CALCULATIONS & WRITE PHASE
      let baseQty = convertQuantityToBaseUnit(data.cantidad, data.unidad, productData);
      baseQty = truncateDecimals(baseQty, 3);

      const currentStock = productData.stockActual || 0;
      transaction.update(productRef, { stockActual: truncateDecimals(currentStock - baseQty, 3) });

      const movRef = doc(collection(db, 'stock_movements'));
      transaction.set(movRef, {
        productId: data.productId,
        qty: -baseQty,
        type: 'VENTA',
        date: new Date().toISOString(),
        referenceId: data.orderId,
        observaciones: `Preparación de Pedido: ${data.observaciones}` + (data.merma ? ` | Merma: ${data.merma}` : '') + (data.pesoReal ? ` | Peso Real: ${data.pesoReal}` : ''),
        isDeleted: false
      });

      for (const ing of recipeItems) {
        const ingEntry = ingredientDocs[ing.productId];
        if (ingEntry) {
          const ingData = ingEntry.data;
          const currentIngStock = ingData.stockActual || 0;

          let stockToDeduct = 0;
          if (ing.pesoNeto !== undefined && ing.pesoNeto > 0) {
            stockToDeduct = convertQuantityToBaseUnit(ing.pesoNeto, 'KG', ingData);
          } else {
            const convertedQty = convertUnit(
              ing.quantity,
              ing.unit,
              ingData.unitType,
              ingData.nombre || '',
              '',
              equivalences
            );
            stockToDeduct = convertedQty * data.cantidad;
          }

          stockToDeduct = truncateDecimals(stockToDeduct, 3);
          const newIngStock = truncateDecimals(currentIngStock - stockToDeduct, 3);
          transaction.update(ingEntry.ref, { stockActual: newIngStock });

          const ingMovRef = doc(collection(db, 'stock_movements'));
          transaction.set(ingMovRef, {
            productId: ing.productId,
            qty: -stockToDeduct,
            type: 'PRODUCCION',
            date: new Date().toISOString(),
            referenceId: data.orderId,
            observaciones: `Consumo para producción de ${productData.nombre} (Pedido)` + (ing.pesoNeto ? ` | Peso Neto: ${ing.pesoNeto} KG` : ''),
            isDeleted: false
          });
        }
      }

      const updatedItems = [];
      for (const item of orderData.items || []) {
        if (item.productId === data.productId) {
          const addedPesoReal = data.pesoReal || 0;
          const currentPesoReal = item.pesoReal || 0;
          const newPesoReal = truncateDecimals(currentPesoReal + addedPesoReal, 3);

          let newObs = item.observaciones || '';
          const cleanStepObs = data.observaciones.replace(/^Preparación de Pedido [a-zA-Z0-9]+ - /, '');
          if (newObs) {
            newObs += ` | ${cleanStepObs}`;
          } else {
            newObs = cleanStepObs;
          }

          let newSubtotal = item.subtotal;
          const price = item.precioEstimado;
          if (productData) {
            const weightInKg = newPesoReal > 0 ? newPesoReal : calculateWeightInKg(item.cantidad, item.unidad, productData);
            newSubtotal = weightInKg * price;
          }

          updatedItems.push({
            ...item,
            pesoReal: newPesoReal,
            subtotal: Number(newSubtotal.toFixed(2)),
            observaciones: newObs
          });
        } else {
          updatedItems.push(item);
        }
      }

      const newTotal = updatedItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
      transaction.update(orderRef, {
        items: updatedItems,
        totalEstimado: Number(newTotal.toFixed(2)),
        status: data.newOrderStatus || orderData.status
      });
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
        qty: truncateDecimals(-movData.qty, 3),
        type: movData.type,
        date: new Date().toISOString(),
        referenceId: movData.referenceId || '',
        observaciones: `Reversión de movimiento ${movementId}`,
        isDeleted: false
      });

      if (prodDoc.exists()) {
        transaction.update(prodRef, {
          stockActual: truncateDecimals(currentStock - movData.qty, 3)
        });
      }
    });
  }
};
