import { useState, useEffect } from 'react';
import { getDocs, query, where, doc, updateDoc, addDoc, runTransaction, collection } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Order, Product, Recipe, StockMovement } from '../../types/domain';

export function useProduccion() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordersSnap, productsSnap, recipesSnap, moveSnap] = await Promise.all([
        getDocs(query(COLLECTIONS.ORDERS, where('isDeleted', '==', false))),
        getDocs(query(COLLECTIONS.PRODUCTS, where('activo', '==', true))),
        getDocs(COLLECTIONS.RECIPES),
        getDocs(query(COLLECTIONS.STOCK_MOVEMENTS, where('isDeleted', '==', false)))
      ]);

      setOrders(ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setRecipes(recipesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Recipe)));
      setMovements(moveSnap.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement)));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getCapacity = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return 0;

    const recipe = recipes.find(r => r.finishedProductId === productId);
    if (!recipe || recipe.ingredientes.length === 0) return 0;

    let maxProducible = Infinity;

    for (const ing of recipe.ingredientes) {
      const ingredientProduct = products.find(p => p.id === ing.productId);
      if (!ingredientProduct) {
        return 0; // If ingredient doesn't exist, we can't produce
      }
      
      // We assume simple 1:1 units for now, or you'd need equivalences. 
      // The requirement doesn't mandate full equivalence engine for capacity, but simple ratio
      // If ingredient uses KG and recipe needs 0.5 KG, capacity is stock / 0.5
      if (ing.cantidad > 0) {
        const capacityForThisIng = (ingredientProduct.stockActual || 0) / ing.cantidad;
        if (capacityForThisIng < maxProducible) {
          maxProducible = capacityForThisIng;
        }
      }
    }

    return maxProducible === Infinity ? 0 : Math.floor(maxProducible);
  };

  const produce = async (data: {
    productId: string;
    cantidad: number;
    pesoReal?: number;
    merma?: number;
    observaciones: string;
    orderId?: string;
    newOrderStatus?: 'EN_PRODUCCION' | 'PRODUCIDO';
  }) => {
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Get current product and recipe
        const productRef = doc(db, 'products', data.productId);
        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists()) throw new Error("Producto no encontrado");
        
        const currentStock = productDoc.data().stockActual || 0;

        const recipe = recipes.find(r => r.finishedProductId === data.productId);

        // 2. Descontar insumos
        if (recipe) {
          for (const ing of recipe.ingredientes) {
            const ingRef = doc(db, 'products', ing.productId);
            const ingDoc = await transaction.get(ingRef);
            if (ingDoc.exists()) {
              const currentIngStock = ingDoc.data().stockActual || 0;
              const stockToDeduct = ing.cantidad * data.cantidad;
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
                observaciones: `Consumo para producción de ${productDoc.data().nombre}`,
                isDeleted: false
              });
            }
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

      await fetchData();
    } catch (error) {
      console.error("Error in production:", error);
      throw error;
    }
  };

  const revertMovement = async (movementId: string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const movRef = doc(db, 'stock_movements', movementId);
        const movDoc = await transaction.get(movRef);
        if (!movDoc.exists()) throw new Error("Movimiento no encontrado");
        
        const movData = movDoc.data() as StockMovement;
        if (movData.type !== 'PRODUCCION') throw new Error("Solo se pueden revertir movimientos de producción");

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
      await fetchData();
    } catch (error) {
      console.error("Error reverting movement:", error);
      throw error;
    }
  };

  return {
    orders,
    products,
    recipes,
    movements,
    loading,
    getCapacity,
    produce,
    revertMovement
  };
}
