import type { Product, Recipe, RecipeItem, SystemSettings, Equivalencia } from '../types/domain';
import { convertUnit } from '../lib/unitConverter';
import { mapRecipeUnitToUnitType } from '../types/domain';

export interface CalculatedPrices {
  costoMercaderia: number;
  folexQuantity: number;
  costoFolexTotal: number;
  costoBolsaTotal: number;
  costoEtiquetaTotal: number;
  costoEmbalaje: number;
  precioMercaderia: number;
  precio150g: number;
  precio250g: number;
  precio500g: number;
  precio1kg: number;
  margenReal150g?: number;
  margenReal250g?: number;
  margenReal500g?: number;
  margenReal1kg?: number;
}

export function calculatePresentationPrices(
  product: Partial<Product>,
  recipeItems: RecipeItem[],
  settings: SystemSettings,
  equivalences: Equivalencia[],
  allProducts: Product[]
): CalculatedPrices {
  let costoMercaderia = 0;
  let folexQuantity = 0;

  const { bolsaProductId, etiquetaProductId, folexProductId } = settings.packagingSettings || {};

  for (const item of recipeItems) {
    const ing = allProducts.find(p => p.id === item.ingredientProductId);
    if (!ing) continue;

    // Check if ingredient is Folex
    if (ing.id === folexProductId) {
      // Assuming folex unit is handled as units/fetas directly
      folexQuantity += item.quantity;
      continue;
    }

    // Check if it's packaging (we skip other packaging for the mercaderia cost)
    const isPack = ing.id === bolsaProductId || 
                   ing.id === etiquetaProductId || 
                   ing.id === folexProductId;
                   
    if (!isPack) {
      // It's a comestible ingredient, calculate its cost
      const cost = Number(ing.costoActual || 0);
      let convertedQty = 0;
      try {
        convertedQty = convertUnit(
          item.quantity,
          mapRecipeUnitToUnitType(item.unit),
          ing.unitType || 'KG',
          ing.nombre || '',
          '',
          equivalences
        );
      } catch (err) {
        console.error("Error al convertir unidad en pricingHelpers", err);
      }
      costoMercaderia += convertedQty * cost;
    }
  }

  const bolsaProd = allProducts.find(p => p.id === bolsaProductId);
  const etiquetaProd = allProducts.find(p => p.id === etiquetaProductId);
  const folexProd = allProducts.find(p => p.id === folexProductId);

  const costoBolsa = Number(bolsaProd?.costoActual || 0);
  const costoEtiqueta = Number(etiquetaProd?.costoActual || 0);
  const costoGlobalFolex = Number(folexProd?.costoActual || 0);

  const costoFolexTotal = folexQuantity * costoGlobalFolex;
  const costoEmbalajePorPaquete = costoBolsa + costoEtiqueta + costoFolexTotal;

  // AUTO mode: Calculate Prices based on desired margin
  if (!product.pricingMode || product.pricingMode === 'AUTO') {
    const margenDeseado = Number(product.margenDeseado || 0);
    const margenDecimal = margenDeseado / 100;
    const denominador = 1 - margenDecimal <= 0 ? 0.01 : 1 - margenDecimal;
    const precioMercaderia = costoMercaderia / denominador;

    const precio150g = precioMercaderia + (costoEmbalajePorPaquete * (1000 / 150));
    const precio250g = precioMercaderia + (costoEmbalajePorPaquete * (1000 / 250));
    const precio500g = precioMercaderia + (costoEmbalajePorPaquete * (1000 / 500));
    const precio1kg = precioMercaderia + (costoEmbalajePorPaquete * (1000 / 1000));

    return {
      costoMercaderia,
      folexQuantity,
      costoFolexTotal,
      costoBolsaTotal: costoBolsa,
      costoEtiquetaTotal: costoEtiqueta,
      costoEmbalaje: costoEmbalajePorPaquete,
      precioMercaderia,
      precio150g,
      precio250g,
      precio500g,
      precio1kg,
      margenReal150g: margenDeseado,
      margenReal250g: margenDeseado,
      margenReal500g: margenDeseado,
      margenReal1kg: margenDeseado
    };
  } 
  
  // MANUAL mode: Calculate Margin based on provided prices
  else {
    const p150 = Number(product.precio150g || 0);
    const p250 = Number(product.precio250g || 0);
    const p500 = Number(product.precio500g || 0);
    const p1kg = Number(product.precio1kg || 0);

    const calcMargin = (price: number, sizeGrams: number) => {
      const e = costoEmbalajePorPaquete * (1000 / sizeGrams);
      if (price - e <= 0) return 0;
      return (1 - (costoMercaderia / (price - e))) * 100;
    };

    return {
      costoMercaderia,
      folexQuantity,
      costoFolexTotal,
      costoBolsaTotal: costoBolsa,
      costoEtiquetaTotal: costoEtiqueta,
      costoEmbalaje: costoEmbalajePorPaquete,
      precioMercaderia: costoMercaderia, // En manual no hay precio base con margen general
      precio150g: p150,
      precio250g: p250,
      precio500g: p500,
      precio1kg: p1kg,
      margenReal150g: calcMargin(p150, 150),
      margenReal250g: calcMargin(p250, 250),
      margenReal500g: calcMargin(p500, 500),
      margenReal1kg: calcMargin(p1kg, 1000)
    };
  }
}

