import { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, query, where, runTransaction, orderBy, limit } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Product, StockMovement, Recipe } from '../../types/domain';

export function useStock() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsSnap, movesSnap, recipesSnap] = await Promise.all([
        getDocs(query(COLLECTIONS.PRODUCTS, where('activo', '==', true))),
        getDocs(query(COLLECTIONS.STOCK_MOVEMENTS, where('isDeleted', '==', false), orderBy('date', 'desc'), limit(50))),
        getDocs(COLLECTIONS.RECIPES)
      ]);

      setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setMovements(movesSnap.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement)));
      setRecipes(recipesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Recipe)));
    } catch (error) {
      console.error("Error fetching stock data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getCapacityData = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.type !== 'PRESENTACION') return { max: 0, limitante: 'No aplica' };

    const recipe = recipes.find(r => r.finishedProductId === productId);
    if (!recipe || recipe.ingredientes.length === 0) return { max: 0, limitante: 'Sin receta' };

    let maxProducible = Infinity;
    let limitante = '';

    for (const ing of recipe.ingredientes) {
      const ingredientProduct = products.find(p => p.id === ing.productId);
      if (!ingredientProduct) {
        return { max: 0, limitante: 'Insumo faltante' };
      }
      
      if (ing.cantidad > 0) {
        const capacityForThisIng = (ingredientProduct.stockActual || 0) / ing.cantidad;
        if (capacityForThisIng < maxProducible) {
          maxProducible = capacityForThisIng;
          limitante = ingredientProduct.nombre;
        }
      }
    }

    if (maxProducible === Infinity) return { max: 0, limitante: 'Error en receta' };

    return { 
      max: Math.floor(maxProducible), 
      limitante 
    };
  };

  const registerAdjustment = async (data: {
    productId: string;
    qty: number;
    observaciones: string;
  }) => {
    if (!data.observaciones.trim()) throw new Error("Las observaciones son obligatorias");
    if (data.qty === 0) throw new Error("La cantidad a ajustar no puede ser cero");

    try {
      await runTransaction(db, async (transaction) => {
        const prodRef = doc(db, 'products', data.productId);
        const prodDoc = await transaction.get(prodRef);
        if (!prodDoc.exists()) throw new Error("Producto no encontrado");

        const currentStock = prodDoc.data().stockActual || 0;

        // Create movement
        const movRef = doc(collection(db, 'stock_movements'));
        transaction.set(movRef, {
          productId: data.productId,
          qty: data.qty,
          type: 'AJUSTE',
          date: new Date().toISOString(),
          observaciones: data.observaciones,
          isDeleted: false
        });

        // Update stock
        transaction.update(prodRef, {
          stockActual: currentStock + data.qty
        });
      });

      await fetchData();
    } catch (error) {
      console.error("Error registering adjustment:", error);
      throw error;
    }
  };

  return {
    products,
    movements,
    loading,
    getCapacityData,
    registerAdjustment
  };
}
