import { useEffect, useCallback } from 'react';
import { useProductionStore } from '../../store/productionStore';
import { convertUnit } from '../../lib/unitConverter';

export function useProduccion() {
  const orders = useProductionStore((state) => state.orders);
  const products = useProductionStore((state) => state.products);
  const equivalences = useProductionStore((state) => state.equivalences);
  const movements = useProductionStore((state) => state.movements);
  const loading = useProductionStore((state) => state.loading);
  const fetchData = useProductionStore((state) => state.fetchData);
  const produce = useProductionStore((state) => state.produce);
  const revertMovement = useProductionStore((state) => state.revertMovement);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCapacity = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.type !== 'PRESENTACION') return 0;

    const recipeItems = product.recipeItems || [];
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
  }, [products, equivalences]);

  return {
    orders,
    products,
    equivalences,
    movements,
    loading,
    getCapacity,
    produce,
    revertMovement
  };
}
