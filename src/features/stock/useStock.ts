import { useEffect, useCallback } from 'react';
import { useStockStore } from '../../store/stockStore';
import { convertUnit } from '../../lib/unitConverter';
import { mapRecipeUnitToUnitType } from '../../types/domain';

export function useStock() {
  const products = useStockStore((state) => state.products);
  const movements = useStockStore((state) => state.movements);
  const equivalences = useStockStore((state) => state.equivalences);
  const recipes = useStockStore((state) => state.recipes);
  const loading = useStockStore((state) => state.loading);
  const fetchData = useStockStore((state) => state.fetchData);
  const registerAdjustment = useStockStore((state) => state.registerAdjustment);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCapacityData = useCallback((productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || product.type !== 'PRESENTACION') return { max: 0, limitante: 'No aplica' };

    const recipe = recipes.find(r => r.productId === productId);
    if (!recipe || !recipe.items || recipe.items.length === 0) return { max: 0, limitante: 'Sin receta' };

    let maxProducible = Infinity;
    let limitante = '';

    for (const ing of recipe.items) {
      const ingredientProduct = products.find(p => p.id === ing.ingredientProductId);
      if (!ingredientProduct) {
        return { max: 0, limitante: 'Insumo faltante' };
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
          limitante = ingredientProduct.nombre;
        }
      }
    }

    if (maxProducible === Infinity) return { max: 0, limitante: 'Error en receta' };

    return { 
      max: Math.floor(maxProducible), 
      limitante 
    };
  }, [products, recipes, equivalences]);

  return {
    products,
    movements,
    equivalences,
    loading,
    getCapacityData,
    registerAdjustment
  };
}
