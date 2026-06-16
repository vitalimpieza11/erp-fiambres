import { useEffect, useCallback } from 'react';
import { useProductionStore } from '../../store/productionStore';
import { convertUnit } from '../../lib/unitConverter';

export function useProduccion() {
  const orders = useProductionStore((state) => state.orders);
  const products = useProductionStore((state) => state.products);
  const recipes = useProductionStore((state) => state.recipes);
  const equivalences = useProductionStore((state) => state.equivalences);
  const movements = useProductionStore((state) => state.movements);
  const customers = useProductionStore((state) => state.customers);
  const loading = useProductionStore((state) => state.loading);
  const fetchData = useProductionStore((state) => state.fetchData);
  const produce = useProductionStore((state) => state.produce);
  const produceMultiple = useProductionStore((state) => state.produceMultiple);
  const produceStep = useProductionStore((state) => state.produceStep);
  const revertMovement = useProductionStore((state) => state.revertMovement);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCapacity = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.type !== 'PRESENTACION') return 0;

    let recipeItems = product.recipeItems || [];
    if (recipeItems.length === 0) {
      const recipeId = product.recipeId || (product as any).recetaId;
      if (recipeId) {
        const recipe = recipes.find(r => r.id === recipeId);
        if (recipe) {
          const ingredients = recipe.ingredients || [];
          recipeItems = ingredients.map((ing: any) => ({
            productId: ing.productId,
            quantity: ing.quantity,
            unit: ing.unit || 'GRAMOS'
          }));
        }
      }
    }

    if (recipeItems.length === 0) return 0;

    let maxProducible = Infinity;

    for (const ing of recipeItems) {
      const ingredientProduct = products.find(p => p.id === ing.productId);
      if (!ingredientProduct) {
        return 0; // If ingredient doesn't exist, we can't produce
      }
      
      const convertedQty = convertUnit(
        ing.quantity,
        ing.unit,
        ingredientProduct.unitType,
        ingredientProduct.nombre || '',
        '',
        equivalences
      );

      if (convertedQty > 0) {
        const capacityForThisIng = (ingredientProduct.stockActual || 0) / convertedQty;
        if (capacityForThisIng < maxProducible) {
          maxProducible = capacityForThisIng;
        }
      }
    }

    return maxProducible === Infinity ? 0 : Math.floor(maxProducible);
  }, [products, recipes, equivalences]);

  return {
    orders,
    products,
    recipes,
    equivalences,
    movements,
    customers,
    loading,
    getCapacity,
    produce,
    produceMultiple,
    produceStep,
    revertMovement
  };
}
