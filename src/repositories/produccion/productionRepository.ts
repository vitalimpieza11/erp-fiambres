import { getDocs, query, where, doc, runTransaction, collection } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Order, Product, Equivalencia, StockMovement, RecipeItem, Customer } from '../../types/domain';
import { mapRecipeUnitToUnitType, mapUnitTypeToRecipeUnit } from '../../types/domain';
import { convertUnit, convertQuantityToBaseUnit, calculateWeightInKg } from '../../lib/unitConverter';
import { truncateDecimals } from '../../lib/formatters';
import { normalizeOrder } from '../pedidos/ordersRepository';


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
      orders: ordersSnap.docs.map(d => normalizeOrder({ id: d.id, ...d.data() })),
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
      // 1. Get current product and settings (READ)
      const settingsRef = doc(db, 'settings', 'global');
      const settingsSnap = await transaction.get(settingsRef);
      const usePackages = settingsSnap.exists() ? (settingsSnap.data()?.usePackages ?? false) : false;

      const productRef = doc(db, 'products', data.productId);
      const productDoc = await transaction.get(productRef);
      if (!productDoc.exists()) throw new Error("Producto no encontrado");
      
      const productData = productDoc.data() as Product;
      const currentStock = productData.stockActual || 0;
      
      let recipeItems: any[] = [];

      if (data.recipeItemsOverride !== undefined) {
        recipeItems = data.recipeItemsOverride.map((ing: any) => ({
          productId: ing.ingredientProductId || ing.productId,
          quantity: ing.quantity,
          unit: ing.unit
        }));
      } else {
        const recipeRef = doc(db, 'recipes', data.productId);
        const recipeDoc = await transaction.get(recipeRef);
        if (recipeDoc.exists()) {
          const recipeData = recipeDoc.data();
          const items = recipeData.items || [];
          recipeItems = items.map((ing: any) => ({
            productId: ing.ingredientProductId,
            quantity: ing.quantity,
            unit: mapRecipeUnitToUnitType(ing.unit)
          }));
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
      let stepCost = 0;
      const recipeSnapshot: any[] = [];
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
            if (ingData.type !== 'INSUMO' && data.pesoReal && data.pesoReal > 0) {
              let theoreticalTotalWeightKg = 0;
              try {
                theoreticalTotalWeightKg = convertQuantityToBaseUnit(data.cantidad, productData.unitType || 'KG', { ...productData, unitType: 'KG' });
              } catch (err) {}
              if (theoreticalTotalWeightKg > 0) {
                const consumoTeoricoTotal = convertedQty * data.cantidad;
                const consumoTeoricoPorKg = consumoTeoricoTotal / theoreticalTotalWeightKg;
                stockToDeduct = consumoTeoricoPorKg * data.pesoReal;
              } else {
                stockToDeduct = convertedQty * data.cantidad;
              }
            } else {
              stockToDeduct = convertedQty * data.cantidad;
            }
          }
          
          stockToDeduct = truncateDecimals(stockToDeduct, 3);

          // Calculate default shrinkage (mermaPorDefecto) if ingredient type is MERCADERIA
          let mermaQty = 0;
          if (ingData.type === 'MERCADERIA' && ingData.mermaPorDefecto && ingData.mermaPorDefecto > 0) {
            mermaQty = truncateDecimals(ingData.mermaPorDefecto * data.cantidad, 3);
          }

          const totalDeduct = truncateDecimals(stockToDeduct + mermaQty, 3);
          const newIngStock = truncateDecimals(currentIngStock - totalDeduct, 3);

          transaction.update(ingEntry.ref, {
            stockActual: newIngStock
          });

          // Accumulate ingredient cost
          const ingCost = truncateDecimals(totalDeduct * (ingData.costoActual || 0), 2);
          stepCost += ingCost;

          recipeSnapshot.push({
            ingredientId: ing.productId,
            ingredientName: ingData.nombre || 'Ingrediente',
            quantity: truncateDecimals(totalDeduct, 3),
            unit: ingData.unitType || 'KG',
            unitCost: ingData.costoActual || 0,
            totalCost: ingCost
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

          // Movement for merma if mermaQty > 0
          if (mermaQty > 0) {
            const mermaMovRef = doc(collection(db, 'stock_movements'));
            transaction.set(mermaMovRef, {
              productId: ing.productId,
              qty: -mermaQty,
              type: 'MERMA_PRODUCCION',
              date: new Date().toISOString(),
              referenceId: data.orderId || '',
              observaciones: `Merma estándar en producción de ${productData.nombre}`,
              isDeleted: false
            });
          }
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
        type: data.orderId ? 'PRODUCCION_PEDIDO' : 'PRODUCCION_STOCK',
        date: new Date().toISOString(),
        referenceId: data.orderId || '',
        observaciones: data.observaciones + (data.merma ? ` | Merma: ${data.merma}` : '') + (data.pesoReal ? ` | Peso Real: ${data.pesoReal}` : ''),
        isDeleted: false
      });

      // 6. Generar Package físico enriquecido si usePackages = true
      if (usePackages) {
        const pkgWeight = data.pesoReal || (productData.unitType === 'KG' ? data.cantidad : (data.cantidad * (productData.pesoObjetivoGramos || 0) / 1000));
        const costPerKg = pkgWeight > 0 ? stepCost / pkgWeight : 0;
        const pkgRef = doc(collection(db, 'packages'));
        transaction.set(pkgRef, {
          productId: data.productId,
          productName: productData.nombre || 'Producto',
          weight: truncateDecimals(pkgWeight, 3),
          costPerKg: truncateDecimals(costPerKg, 2),
          totalCost: truncateDecimals(stepCost, 2),
          status: 'STOCK',
          orderId: data.orderId || '',
          producedAt: new Date().toISOString(),
          recipeSnapshot
        });
      }

      // 7. Update order status if applicable
      if (data.orderId && data.newOrderStatus) {
        const orderRef = doc(db, 'orders', data.orderId);
        transaction.update(orderRef, {
          status: data.newOrderStatus
        });
      }
    });
  },
  async updateOrderStatus(orderId: string, status: 'EN_PRODUCCION' | 'PRODUCIDO'): Promise<void> {
    console.log("[STATUS] updateOrderStatus ejecutado", orderId, status);
    const { doc, updateDoc, getDoc } = await import('firebase/firestore');
    const orderRef = doc(db, 'orders', orderId);
    try {
      const beforeSnap = await getDoc(orderRef);
      console.log(`[STATUS] ANTES status actual:`, beforeSnap.exists() ? beforeSnap.data()?.status : 'NOT_FOUND');
      
      await updateDoc(orderRef, { status });
      console.log(`[STATUS] updateDoc finalizado correctamente para`, orderId);
      
      const afterSnap = await getDoc(orderRef);
      console.log(`[STATUS] DESPUÉS status leído nuevamente desde Firestore:`, afterSnap.exists() ? afterSnap.data()?.status : 'NOT_FOUND');
    } catch (e) {
      console.error("[STATUS] Exception in updateDoc:", e);
      throw e;
    }
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
  ): Promise<void> {    await runTransaction(db, async (transaction) => {
      // --- READ PHASE: Fetch settings, order and main products ---
      const settingsRef = doc(db, 'settings', 'global');
      const settingsSnap = await transaction.get(settingsRef);
      const usePackages = settingsSnap.exists() ? (settingsSnap.data()?.usePackages ?? false) : false;

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

        let recipeItems: any[] = [];
        if (item.recipeItemsOverride !== undefined) {
          recipeItems = item.recipeItemsOverride.map((ing: any) => ({
            productId: ing.ingredientProductId || ing.productId,
            quantity: ing.quantity,
            unit: ing.unit
          }));
        } else {
          const recipeRef = doc(db, 'recipes', item.productId);
          const recipeDoc = await transaction.get(recipeRef);
          if (recipeDoc.exists()) {
            const recipeData = recipeDoc.data();
            const items = recipeData.items || [];
            recipeItems = items.map((ing: any) => ({
              productId: ing.ingredientProductId,
              quantity: ing.quantity,
              unit: mapRecipeUnitToUnitType(ing.unit)
            }));
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

        // 1. Increase finished stock (behavior for sales orders)
        const currentStock = stockUpdates[item.productId] !== undefined
          ? stockUpdates[item.productId]
          : (productData.stockActual || 0);
        stockUpdates[item.productId] = truncateDecimals(currentStock + baseQty, 3);

        // Queue finished product production movement (positive qty)
        const movRef = doc(collection(db, 'stock_movements'));
        queuedMovements.push({
          ref: movRef,
          data: {
            productId: item.productId,
            qty: baseQty,
            type: data.orderId ? 'PRODUCCION_PEDIDO' : 'PRODUCCION_STOCK',
            date: new Date().toISOString(),
            referenceId: data.orderId || '',
            observaciones: `Preparación de Pedido: ${item.observaciones}` + (item.merma ? ` | Merma: ${item.merma}` : '') + (item.pesoReal ? ` | Peso Real: ${item.pesoReal}` : ''),
            isDeleted: false
          }
        });

        // 1b. Calculate cost and create Package document
        let stepCost = 0;
        const recipeSnapshot: any[] = [];
        const recipeInfo = itemsRecipes.find(r => r.itemId === `${item.productId}_${idx}`);
        if (recipeInfo) {
          for (const ing of recipeInfo.recipeItems) {
            const ingEntry = ingredientDocs[ing.ingredientProductId];
            if (ingEntry) {
              const ingData = ingEntry.data;
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
                if (ingData.type !== 'INSUMO' && item.pesoReal && item.pesoReal > 0) {
                  let theoreticalTotalWeightKg = 0;
                  try {
                    theoreticalTotalWeightKg = convertQuantityToBaseUnit(item.cantidad, productData.unitType || 'KG', { ...productData, unitType: 'KG' });
                  } catch (err) {}
                  if (theoreticalTotalWeightKg > 0) {
                    const consumoTeoricoTotal = convertedQty * item.cantidad;
                    const consumoTeoricoPorKg = consumoTeoricoTotal / theoreticalTotalWeightKg;
                    stockToDeduct = consumoTeoricoPorKg * item.pesoReal;
                  } else {
                    stockToDeduct = convertedQty * item.cantidad;
                  }
                } else {
                  stockToDeduct = convertedQty * item.cantidad;
                }
              }
              stockToDeduct = truncateDecimals(stockToDeduct, 3);

              let mermaQty = 0;
              if (ingData.type === 'MERCADERIA' && ingData.mermaPorDefecto && ingData.mermaPorDefecto > 0) {
                mermaQty = truncateDecimals(ingData.mermaPorDefecto * item.cantidad, 3);
              }

              const totalDeduct = truncateDecimals(stockToDeduct + mermaQty, 3);
              const ingCost = truncateDecimals(totalDeduct * (ingData.costoActual || 0), 2);
              stepCost += ingCost;

              recipeSnapshot.push({
                ingredientId: ing.ingredientProductId,
                ingredientName: ingData.nombre || 'Ingrediente',
                quantity: truncateDecimals(totalDeduct, 3),
                unit: ingData.unitType || 'KG',
                unitCost: ingData.costoActual || 0,
                totalCost: ingCost
              });
            }
          }
        }
        const pkgWeight = item.pesoReal || (productData.unitType === 'KG' ? item.cantidad : (item.cantidad * (productData.pesoObjetivoGramos || 0) / 1000));
        const costPerKg = pkgWeight > 0 ? stepCost / pkgWeight : 0;
        
        if (usePackages) {
          const pkgRef = doc(collection(db, 'packages'));
          queuedMovements.push({
            ref: pkgRef,
            data: {
              productId: item.productId,
              productName: productData.nombre || 'Producto',
              weight: truncateDecimals(pkgWeight, 3),
              costPerKg: truncateDecimals(costPerKg, 2),
              totalCost: truncateDecimals(stepCost, 2),
              status: 'STOCK',
              orderId: data.orderId || '',
              producedAt: new Date().toISOString(),
              recipeSnapshot
            }
          });
        }

        // 2. Process recipe ingredients (CONSUMPTION)
        const recipeInfoForIng = itemsRecipes.find(r => r.itemId === `${item.productId}_${idx}`);
        if (recipeInfoForIng) {
          for (const ing of recipeInfoForIng.recipeItems) {
            const ingEntry = ingredientDocs[ing.ingredientProductId];
            if (ingEntry) {
              const ingData = ingEntry.data;
              const currentIngStock = stockUpdates[ing.ingredientProductId] !== undefined
                ? stockUpdates[ing.ingredientProductId]
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
                if (ingData.type !== 'INSUMO' && item.pesoReal && item.pesoReal > 0) {
                  let theoreticalTotalWeightKg = 0;
                  try {
                    theoreticalTotalWeightKg = convertQuantityToBaseUnit(item.cantidad, productData.unitType || 'KG', { ...productData, unitType: 'KG' });
                  } catch (err) {}
                  if (theoreticalTotalWeightKg > 0) {
                    const consumoTeoricoTotal = convertedQty * item.cantidad;
                    const consumoTeoricoPorKg = consumoTeoricoTotal / theoreticalTotalWeightKg;
                    stockToDeduct = consumoTeoricoPorKg * item.pesoReal;
                  } else {
                    stockToDeduct = convertedQty * item.cantidad;
                  }
                } else {
                  stockToDeduct = convertedQty * item.cantidad;
                }
              }

              stockToDeduct = truncateDecimals(stockToDeduct, 3);

              let mermaQty = 0;
              if (ingData.type === 'MERCADERIA' && ingData.mermaPorDefecto && ingData.mermaPorDefecto > 0) {
                mermaQty = truncateDecimals(ingData.mermaPorDefecto * item.cantidad, 3);
              }

              const totalDeduct = truncateDecimals(stockToDeduct + mermaQty, 3);
              stockUpdates[ing.ingredientProductId] = truncateDecimals(currentIngStock - totalDeduct, 3);

              // Queue ingredient consumption movement (negative qty, type PRODUCCION)
              const ingMovRef = doc(collection(db, 'stock_movements'));
              queuedMovements.push({
                ref: ingMovRef,
                data: {
                  productId: ing.ingredientProductId,
                  qty: -stockToDeduct,
                  type: 'PRODUCCION',
                  date: new Date().toISOString(),
                  referenceId: data.orderId || '',
                  observaciones: `Consumo para producción de ${productData.nombre} (Pedido)` + (ing.pesoNeto ? ` | Peso Neto: ${ing.pesoNeto} KG` : ''),
                  isDeleted: false
                }
              });

              // Queue merma movement if mermaQty > 0
              if (mermaQty > 0) {
                const mermaMovRef = doc(collection(db, 'stock_movements'));
                queuedMovements.push({
                  ref: mermaMovRef,
                  data: {
                    productId: ing.ingredientProductId,
                    qty: -mermaQty,
                    type: 'MERMA_PRODUCCION',
                    date: new Date().toISOString(),
                    referenceId: data.orderId || '',
                    observaciones: `Merma estándar en producción de ${productData.nombre} (Pedido)`,
                    isDeleted: false
                  }
                });
              }
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
            const addedPesoReal = prodItem.pesoReal !== undefined ? truncateDecimals(prodItem.pesoReal, 3) : 0;

            let currentPesosReales = item.pesosReales || [];
            if (currentPesosReales.length === 0 && item.pesoReal !== undefined && item.pesoReal > 0) {
              currentPesosReales = [item.pesoReal];
            }
            const newPesosReales = addedPesoReal > 0 ? [...currentPesosReales, addedPesoReal] : currentPesosReales;
            const newPesoReal = truncateDecimals(newPesosReales.reduce((acc, w) => acc + w, 0), 3);

            const mp = mainProductDocs.find(x => x.data.id === item.productId);
            const product = mp ? mp.data : undefined;
            let newSubtotal = item.subtotal;
            const price = item.precioEstimado;
            if (product) {
              const weightInKg = newPesoReal > 0 ? newPesoReal : calculateWeightInKg(newQty, prodItem.unidad, product);
              newSubtotal = weightInKg * price;
            }

            if (addedPesoReal > 0) {
              const prodItemRef = doc(collection(db, 'production_items'));
              transaction.set(prodItemRef, {
                id: prodItemRef.id,
                orderId: data.orderId || '',
                productId: item.productId,
                pesoReal: addedPesoReal,
                fecha: new Date().toISOString(),
                operario: 'Sistema'
              });
            }

            const cantidadPaquetes = Number(newPesosReales.length || 0);
            const pesoTotal = Number(newPesoReal || 0);
            const pesoPromedio = cantidadPaquetes > 0 ? Number(truncateDecimals(pesoTotal / cantidadPaquetes, 3) || 0) : 0;

            updatedItems.push({
              ...item,
              cantidad: Number(newQty || 0),
              unidad: prodItem.unidad as any,
              pesoReal: Number(newPesoReal || 0),
              pesosReales: newPesosReales.map(w => Number(w) || 0),
              cantidadPaquetes,
              pesoTotal,
              pesoPromedio,
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
      pesosReales?: number[];
      merma?: number;
      observaciones: string;
      recipeItemsOverride?: RecipeItem[];
      productionStepId?: string;
      isLastStep: boolean;
      newOrderStatus?: 'EN_PRODUCCION' | 'PRODUCIDO';
    },
    equivalences: Equivalencia[]
  ): Promise<void> {
    console.log('PRODUCCION_GUARDAR', { productId: data.productId, pesoReal: data.pesoReal, pesosReales: data.pesosReales, productionStepId: data.productionStepId });
    
    // 0. PRE-TRANSACTION READS for Reversion
    let prevMovs: any[] = [];
    let prevPkgs: any[] = [];
    let prevProdItems: any[] = [];

    if (data.productionStepId) {
      const movsQuery = query(collection(db, 'stock_movements'), where('productionStepId', '==', data.productionStepId), where('isReverted', '==', false));
      const movsSnap = await getDocs(movsQuery);
      prevMovs = movsSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));

      const pkgsQuery = query(collection(db, 'packages'), where('productionStepId', '==', data.productionStepId), where('isReverted', '==', false));
      const pkgsSnap = await getDocs(pkgsQuery);
      prevPkgs = pkgsSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));

      const prodItemsQuery = query(collection(db, 'production_items'), where('productionStepId', '==', data.productionStepId), where('isReverted', '==', false));
      const prodItemsSnap = await getDocs(prodItemsQuery);
      prevProdItems = prodItemsSnap.docs.map(d => ({ ref: d.ref, data: d.data() }));
    }

    await runTransaction(db, async (transaction) => {
      // 1. READ PHASE
      const settingsRef = doc(db, 'settings', 'global');
      const settingsSnap = await transaction.get(settingsRef);
      const usePackages = settingsSnap.exists() ? (settingsSnap.data()?.usePackages ?? false) : false;

      const orderRef = doc(db, 'orders', data.orderId);
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists()) throw new Error(`Pedido ${data.orderId} no encontrado`);
      const orderData = { id: orderDoc.id, ...(orderDoc.data() || {}) } as any as Order;

      const productRef = doc(db, 'products', data.productId);
      const productDoc = await transaction.get(productRef);
      if (!productDoc.exists()) throw new Error(`Producto ${data.productId} no encontrado`);
      const productData = { id: productDoc.id, ...(productDoc.data() || {}) } as any as Product;

      let recipeItems: any[] = [];
      if (data.recipeItemsOverride !== undefined) {
        recipeItems = data.recipeItemsOverride.map((ing: any) => ({
          productId: ing.ingredientProductId || ing.productId,
          quantity: ing.quantity,
          unit: ing.unit
        }));
      } else {
        const recipeRef = doc(db, 'recipes', data.productId);
        const recipeDoc = await transaction.get(recipeRef);
        if (recipeDoc.exists()) {
          const recipeData = recipeDoc.data();
          const items = recipeData.items || [];
          recipeItems = items.map((ing: any) => ({
            productId: ing.ingredientProductId,
            quantity: ing.quantity,
            unit: mapRecipeUnitToUnitType(ing.unit)
          }));
        }
      }

      // Collect all product IDs we need to read/write for stock updates
      const productRefsToUpdate = new Map<string, { ref: any; currentStock: number; isMain: boolean }>();
      productRefsToUpdate.set(data.productId, { ref: productRef, currentStock: productData.stockActual || 0, isMain: true });

      const ingredientDocs: Record<string, { ref: any, data: Product }> = {};
      for (const ing of recipeItems) {
        if (!ingredientDocs[ing.productId]) {
          const ingRef = doc(db, 'products', ing.productId);
          const ingDoc = await transaction.get(ingRef);
          if (ingDoc.exists()) {
            const ingData = { id: ingDoc.id, ...(ingDoc.data() || {}) } as any as Product;
            ingredientDocs[ing.productId] = { ref: ingRef, data: ingData };
            if (!productRefsToUpdate.has(ing.productId)) {
              productRefsToUpdate.set(ing.productId, { ref: ingRef, currentStock: ingData.stockActual || 0, isMain: false });
            }
          }
        }
      }

      // Ensure all products referenced by prevMovs are read
      for (const mov of prevMovs) {
        if (!productRefsToUpdate.has(mov.data.productId)) {
          const mRef = doc(db, 'products', mov.data.productId);
          const mDoc = await transaction.get(mRef);
          if (mDoc.exists()) {
            productRefsToUpdate.set(mov.data.productId, { ref: mRef, currentStock: mDoc.data().stockActual || 0, isMain: false });
          }
        }
      }

      // REVERT PREVIOUS MOVEMENTS
      const stockDeltas = new Map<string, number>();

      for (const mov of prevMovs) {
        const pId = mov.data.productId;
        const qty = mov.data.qty || 0;
        const currentDelta = stockDeltas.get(pId) || 0;
        // Compensating movement logic: subtract the original qty
        stockDeltas.set(pId, currentDelta - qty);

        // Mark old movement as reverted
        transaction.update(mov.ref, {
          isReverted: true,
          revertedAt: new Date().toISOString(),
          revertedBy: 'system',
          revertedReason: 'production_edit'
        });

        // Create compensatory movement
        const compRef = doc(collection(db, 'stock_movements'));
        transaction.set(compRef, {
          productId: pId,
          qty: -qty,
          type: mov.data.type, // Same type to cancel out correctly in analytics
          date: new Date().toISOString(),
          referenceId: mov.data.referenceId,
          productionStepId: mov.data.productionStepId,
          observaciones: `Reversión compensatoria por edición de producción`,
          isDeleted: false,
          isReverted: false
        });
      }

      for (const pkg of prevPkgs) {
        transaction.update(pkg.ref, {
          isReverted: true,
          revertedAt: new Date().toISOString(),
          revertedBy: 'system',
          revertedReason: 'production_edit'
        });
      }

      for (const pItem of prevProdItems) {
        transaction.update(pItem.ref, {
          isReverted: true,
          revertedAt: new Date().toISOString(),
          revertedBy: 'system',
          revertedReason: 'production_edit'
        });
      }

      // 2. CALCULATIONS & WRITE PHASE
      let baseQty = convertQuantityToBaseUnit(data.cantidad, data.unidad, productData);
      baseQty = truncateDecimals(baseQty, 3);

      const currentMainDelta = stockDeltas.get(data.productId) || 0;
      stockDeltas.set(data.productId, currentMainDelta + baseQty);

      const movRef = doc(collection(db, 'stock_movements'));
      transaction.set(movRef, {
        productId: data.productId,
        qty: baseQty,
        type: 'PRODUCCION_PEDIDO',
        date: new Date().toISOString(),
        referenceId: data.orderId,
        productionStepId: data.productionStepId || null,
        observaciones: `Preparación de Pedido: ${data.observaciones}` + (data.merma ? ` | Merma: ${data.merma}` : '') + (data.pesoReal ? ` | Peso Real: ${data.pesoReal}` : ''),
        isDeleted: false,
        isReverted: false
      });

      let stepCost = 0;
      const recipeSnapshot: any[] = [];
      for (const ing of recipeItems) {
        const ingEntry = ingredientDocs[ing.productId];
        if (ingEntry) {
          const ingData = ingEntry.data;
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
            if (ingData.type !== 'INSUMO' && data.pesoReal && data.pesoReal > 0) {
              let theoreticalTotalWeightKg = 0;
              try {
                theoreticalTotalWeightKg = convertQuantityToBaseUnit(data.cantidad, productData.unitType || 'KG', { ...productData, unitType: 'KG' });
              } catch (err) {}
              if (theoreticalTotalWeightKg > 0) {
                const consumoTeoricoTotal = convertedQty * data.cantidad;
                const consumoTeoricoPorKg = consumoTeoricoTotal / theoreticalTotalWeightKg;
                stockToDeduct = consumoTeoricoPorKg * data.pesoReal;
              } else {
                stockToDeduct = convertedQty * data.cantidad;
              }
            } else {
              stockToDeduct = convertedQty * data.cantidad;
            }
          }

          stockToDeduct = truncateDecimals(stockToDeduct, 3);

          let mermaQty = 0;
          if (ingData.type === 'MERCADERIA' && ingData.mermaPorDefecto && ingData.mermaPorDefecto > 0) {
            mermaQty = truncateDecimals(ingData.mermaPorDefecto * data.cantidad, 3);
          }

          const totalDeduct = truncateDecimals(stockToDeduct + mermaQty, 3);
          
          const currentIngDelta = stockDeltas.get(ing.productId) || 0;
          stockDeltas.set(ing.productId, currentIngDelta - totalDeduct);

          const ingCost = truncateDecimals(totalDeduct * (ingData.costoActual || 0), 2);
          stepCost += ingCost;

          recipeSnapshot.push({
            ingredientId: ing.productId,
            ingredientName: ingData.nombre || 'Ingrediente',
            quantity: truncateDecimals(totalDeduct, 3),
            unit: ingData.unitType || 'KG',
            unitCost: ingData.costoActual || 0,
            totalCost: ingCost
          });

          const ingMovRef = doc(collection(db, 'stock_movements'));
          transaction.set(ingMovRef, {
            productId: ing.productId,
            qty: -stockToDeduct,
            type: 'PRODUCCION',
            date: new Date().toISOString(),
            referenceId: data.orderId,
            productionStepId: data.productionStepId || null,
            observaciones: `Consumo para producción de ${productData.nombre} (Pedido)` + (ing.pesoNeto ? ` | Peso Neto: ${ing.pesoNeto} KG` : ''),
            isDeleted: false,
            isReverted: false
          });

          if (mermaQty > 0) {
            const mermaMovRef = doc(collection(db, 'stock_movements'));
            transaction.set(mermaMovRef, {
              productId: ing.productId,
              qty: -mermaQty,
              type: 'MERMA_PRODUCCION',
              date: new Date().toISOString(),
              referenceId: data.orderId,
              productionStepId: data.productionStepId || null,
              observaciones: `Merma estándar en producción de ${productData.nombre} (Pedido)`,
              isDeleted: false,
              isReverted: false
            });
          }
        }
      }

      // Apply net stock updates
      for (const [pId, delta] of stockDeltas.entries()) {
        const pInfo = productRefsToUpdate.get(pId);
        if (pInfo && delta !== 0) {
          const newStock = truncateDecimals(pInfo.currentStock + delta, 3);
          transaction.update(pInfo.ref, { stockActual: newStock });
        }
      }

      const addedPesosReales = data.pesosReales || (data.pesoReal ? [data.pesoReal] : []);

      if (usePackages) {
        if (addedPesosReales.length > 0) {
          const totalWeight = addedPesosReales.reduce((a, b) => a + b, 0);
          addedPesosReales.forEach(pkgWeight => {
            const propCost = totalWeight > 0 ? (pkgWeight / totalWeight) * stepCost : (stepCost / addedPesosReales.length);
            const costPerKg = pkgWeight > 0 ? propCost / pkgWeight : 0;
            const pkgRef = doc(collection(db, 'packages'));
            transaction.set(pkgRef, {
              productId: data.productId,
              productName: productData.nombre || 'Producto',
              weight: truncateDecimals(pkgWeight, 3),
              costPerKg: truncateDecimals(costPerKg, 2),
              totalCost: truncateDecimals(propCost, 2),
              status: 'STOCK',
              orderId: data.orderId || '',
              producedAt: new Date().toISOString(),
              productionStepId: data.productionStepId || null,
              recipeSnapshot,
              isDeleted: false,
              isReverted: false
            });
          });
        } else {
          const pkgWeight = data.pesoReal || (productData.unitType === 'KG' ? data.cantidad : (data.cantidad * (productData.pesoObjetivoGramos || 0) / 1000));
          const costPerKg = pkgWeight > 0 ? stepCost / pkgWeight : 0;
          const pkgRef = doc(collection(db, 'packages'));
          transaction.set(pkgRef, {
            productId: data.productId,
            productName: productData.nombre || 'Producto',
            weight: truncateDecimals(pkgWeight, 3),
            costPerKg: truncateDecimals(costPerKg, 2),
            totalCost: truncateDecimals(stepCost, 2),
            status: 'STOCK',
            orderId: data.orderId || '',
            producedAt: new Date().toISOString(),
            productionStepId: data.productionStepId || null,
            recipeSnapshot,
            isDeleted: false,
            isReverted: false
          });
        }
      }

      if (addedPesosReales.length > 0) {
        addedPesosReales.forEach(w => {
          const prodItemRef = doc(collection(db, 'production_items'));
          transaction.set(prodItemRef, {
            id: prodItemRef.id,
            orderId: data.orderId,
            productId: data.productId,
            pesoReal: w,
            fecha: new Date().toISOString(),
            operario: 'Sistema',
            productionStepId: data.productionStepId || null,
            isReverted: false
          });
        });
      } else {
        const prodItemRef = doc(collection(db, 'production_items'));
        transaction.set(prodItemRef, {
          id: prodItemRef.id,
          orderId: data.orderId,
          productId: data.productId,
          pesoReal: data.pesoReal || 0,
          fecha: new Date().toISOString(),
          operario: 'Sistema',
          productionStepId: data.productionStepId || null,
          isReverted: false
        });
      }

      const updatedItems = [];
      for (const item of orderData.items || []) {
        if (item.productId === data.productId && item.productionStepId === data.productionStepId) {
          // Replace weights fully because we reverted previous state completely
          const newPesosReales = [...addedPesosReales];
          const newPesoReal = truncateDecimals(newPesosReales.reduce((acc, w) => acc + w, 0), 3);

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

          const cantidadPaquetes = Number(newPesosReales.length || 0);
          const pesoTotal = Number(newPesoReal || 0);
          const pesoPromedio = cantidadPaquetes > 0 ? Number(truncateDecimals(pesoTotal / cantidadPaquetes, 3) || 0) : 0;

          const mappedRecipeItems = recipeSnapshot.map(r => ({
            ingredientProductId: r.ingredientId,
            ingredientName: r.ingredientName,
            quantity: r.quantity,
            unit: mapUnitTypeToRecipeUnit(r.unit)
          }));

          updatedItems.push({
            ...item,
            pesoReal: Number(newPesoReal || 0),
            pesosReales: newPesosReales.map(w => Number(w) || 0),
            cantidadPaquetes,
            pesoTotal,
            pesoPromedio,
            subtotal: Number(newSubtotal.toFixed(2)),
            observaciones: newObs,
            recipeItems: mappedRecipeItems
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
