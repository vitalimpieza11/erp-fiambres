import { useEffect, useCallback } from 'react';
import { useProductionStore } from '../../store/productionStore';
import { convertUnit } from '../../lib/unitConverter';
import { mapRecipeUnitToUnitType } from '../../types/domain';
import { calculateCapacityDetails } from '../../utils/costHelpers';

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
  const updateOrderStatus = useProductionStore((state) => state.updateOrderStatus);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCapacity = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.type !== 'PRESENTACION') return 0;

    const recipe = recipes.find(r => r.productId === productId);
    if (!recipe || !recipe.items || recipe.items.length === 0) return 0;

    let maxProducible = Infinity;

    for (const ing of recipe.items) {
      const ingredientProduct = products.find(p => p.id === ing.ingredientProductId);
      if (!ingredientProduct) {
        return 0; // If ingredient doesn't exist, we can't produce
      }
      
      const convertedQty = convertUnit(
        ing.quantity,
        mapRecipeUnitToUnitType(ing.unit),
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

  const getCapacityDetails = useCallback((productId: string) => {
    const recipe = recipes.find(r => r.productId === productId);
    return calculateCapacityDetails(recipe, products, equivalences);
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
    getCapacityDetails,
    produce,
    produceMultiple,
    produceStep,
    revertMovement,
    updateOrderStatus
  };
}
