import { convertUnit, convertQuantityToBaseUnit } from '../lib/unitConverter';
import { mapRecipeUnitToUnitType } from '../types/domain';
import type { RecipeItem, Product, Equivalencia, Recipe } from '../types/domain';
import { truncateDecimals } from '../lib/formatters';

export interface IngredientCostDetail {
  ingredientProductId: string;
  ingredientName: string;
  quantityUsed: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  type: string;
}

export interface ProductionCostDetails {
  rawMaterialCost: number; // MERCADERIA
  packagingCost: number;   // INSUMO
  totalCost: number;       // rawMaterialCost + packagingCost
  costPerUnit: number;
  costPerKg: number;
  ingredients: IngredientCostDetail[];
}

export interface CapacityDetails {
  maxCapacity: number;
  limitingIngredientName: string;
  costPerUnit: number;
  totalMaxCapacityCost: number;
}

/**
 * Calculates the dynamic breakdown of costs for a production batch.
 *
 * CORRECCIÓN (2026-06-19):
 * - Fórmula ANTERIOR: totalNeeded = convertedQtyPerUnit * prodQty
 *   → usaba peso TEÓRICO de receta × nº de paquetes (ej: 2 KG × 2 = 4 KG)
 * - Fórmula NUEVA: para ingredientes MERCADERIA (KG), se usa el peso real total
 *   producido (realWeightKg) directamente como cantidad consumida.
 *   Para ingredientes INSUMO (bolsas, etiquetas, etc.), se sigue usando prodQty.
 *
 * Ejemplo:
 *   Paquete 1 = 1.475 kg, Paquete 2 = 1.340 kg → realWeightKg = 2.815 kg
 *   Jamón cocido TRECER $5.800/kg → 2.815 × 5.800 = $16.327  ✓
 */
export function calculateProductionCostDetails(
  recipeItems: RecipeItem[],
  prodQty: number,
  prodWeightKg: number | undefined,
  targetProduct: Product | undefined,
  products: Product[],
  equivalences: Equivalencia[]
): ProductionCostDetails {
  const defaultRes: ProductionCostDetails = {
    rawMaterialCost: 0,
    packagingCost: 0,
    totalCost: 0,
    costPerUnit: 0,
    costPerKg: 0,
    ingredients: []
  };

  if (!recipeItems || recipeItems.length === 0 || !targetProduct || prodQty <= 0) {
    return defaultRes;
  }

  // Determinar peso real total producido en KG
  let realWeightKg = prodWeightKg || 0;
  if (realWeightKg <= 0) {
    try {
      realWeightKg = convertQuantityToBaseUnit(prodQty, targetProduct.unitType, { ...targetProduct, unitType: 'KG' });
    } catch (err) {
      realWeightKg = 0;
    }
  }

  let rawMaterialCost = 0;
  let packagingCost = 0;
  const ingredientsDetails: IngredientCostDetail[] = [];

  for (const item of recipeItems) {
    const ingredient = products.find(p => p.id === item.ingredientProductId);
    if (ingredient) {
      let convertedQtyPerUnit = 0;
      try {
        convertedQtyPerUnit = convertUnit(
          item.quantity,
          mapRecipeUnitToUnitType(item.unit),
          ingredient.unitType,
          ingredient.nombre || '',
          '',
          equivalences
        );
      } catch (err) {
        console.error(`Error al convertir unidad para el insumo ${item.ingredientName}:`, err);
      }

      const unitCost = ingredient.costoActual || 0;
      let totalNeeded: number;
      let ingredientCost: number;

      if (ingredient.type === 'INSUMO') {
        // Insumos (bolsas, etiquetas, etc.) → calcular por cantidad de paquetes
        totalNeeded = convertedQtyPerUnit * prodQty;
        ingredientCost = totalNeeded * unitCost;
        packagingCost += ingredientCost;
      } else {
        // MERCADERIA (KG) → usar peso real total producido
        // Si hay peso real disponible, lo usamos directamente.
        // Si no hay peso real (ej: primer ingreso), usamos el teórico.
        if (realWeightKg > 0) {
          totalNeeded = realWeightKg;
        } else {
          totalNeeded = convertedQtyPerUnit * prodQty;
        }
        ingredientCost = totalNeeded * unitCost;
        rawMaterialCost += ingredientCost;
      }

      ingredientsDetails.push({
        ingredientProductId: item.ingredientProductId,
        ingredientName: item.ingredientName || ingredient.nombre || 'Desconocido',
        quantityUsed: truncateDecimals(totalNeeded, 3),
        unit: ingredient.unitType,
        unitCost,
        totalCost: truncateDecimals(ingredientCost, 2),
        type: ingredient.type
      });
    }
  }

  const totalCost = rawMaterialCost + packagingCost;

  // Calcular peso total en KG para costo por KG
  const totalWeightKg = realWeightKg > 0 ? realWeightKg : (prodQty > 0 ? prodQty : 0);

  const costPerUnit = prodQty > 0 ? totalCost / prodQty : 0;
  const costPerKg = totalWeightKg > 0 ? totalCost / totalWeightKg : 0;

  return {
    rawMaterialCost: truncateDecimals(rawMaterialCost, 2),
    packagingCost: truncateDecimals(packagingCost, 2),
    totalCost: truncateDecimals(totalCost, 2),
    costPerUnit: truncateDecimals(costPerUnit, 2),
    costPerKg: truncateDecimals(costPerKg, 2),
    ingredients: ingredientsDetails
  };
}

/**
 * Calculates max production capacity, limiting ingredient and estimated costs.
 */
export function calculateCapacityDetails(
  recipe: Recipe | undefined | null,
  products: Product[],
  equivalences: Equivalencia[]
): CapacityDetails {
  const defaultRes: CapacityDetails = {
    maxCapacity: 0,
    limitingIngredientName: 'Ninguno',
    costPerUnit: 0,
    totalMaxCapacityCost: 0
  };

  if (!recipe || !recipe.items || recipe.items.length === 0) {
    return { ...defaultRes, limitingIngredientName: 'Sin receta' };
  }

  let maxCapacity = Infinity;
  let limitingIngredientName = 'Ninguno (Stock ilimitado)';
  let costPerUnit = 0;

  for (const ing of recipe.items) {
    const ingredientProduct = products.find(p => p.id === ing.ingredientProductId);
    if (!ingredientProduct) {
      return {
        maxCapacity: 0,
        limitingIngredientName: `Falta insumo en catálogo: ${ing.ingredientName}`,
        costPerUnit: 0,
        totalMaxCapacityCost: 0
      };
    }

    let convertedQty = 0;
    try {
      convertedQty = convertUnit(
        ing.quantity,
        mapRecipeUnitToUnitType(ing.unit),
        ingredientProduct.unitType,
        ingredientProduct.nombre || '',
        '',
        equivalences
      );
    } catch (err) {
      console.error("Error al convertir unidad para capacidad:", err);
    }

    if (convertedQty > 0) {
      const stock = ingredientProduct.stockActual || 0;
      const capacityForThisIng = stock / convertedQty;

      if (capacityForThisIng < maxCapacity) {
        maxCapacity = capacityForThisIng;
        limitingIngredientName = ingredientProduct.nombre;
      }

      costPerUnit += convertedQty * (ingredientProduct.costoActual || 0);
    }
  }

  const finalMaxCapacity = maxCapacity === Infinity ? 0 : Math.floor(maxCapacity);
  const totalMaxCapacityCost = costPerUnit * finalMaxCapacity;

  return {
    maxCapacity: finalMaxCapacity,
    limitingIngredientName,
    costPerUnit: truncateDecimals(costPerUnit, 2),
    totalMaxCapacityCost: truncateDecimals(totalMaxCapacityCost, 2)
  };
}
