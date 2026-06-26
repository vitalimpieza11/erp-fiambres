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

export interface CostBreakdownItem {
  nombre: string;
  cantidad: number;
  unidad: string;
  costoUnitario: number;
  subtotal: number;
  origen: 'materia_prima' | 'insumo' | 'embalaje';
}

export interface OperationalCost {
  costoMateriaPrima: number;
  costoInsumosReceta: number;
  costoMercaderia: number; // Suma de materia prima e insumos de receta
  costoBolsa: number;
  costoEtiqueta: number;
  costoFolexAutomatico: number;
  costoEmbalajeTotal: number;
  costoOperativoTotal: number;
  folexQuantity: number;
  desgloseMateriaPrima: CostBreakdownItem[];
  desgloseInsumos: CostBreakdownItem[];
  desgloseEmbalaje: CostBreakdownItem[];
}

export interface GetOperationalCostParams {
  recipeItems: RecipeItem[];
  settings: SystemSettings;
  equivalences: Equivalencia[];
  allProducts: Product[];
  targetProduct?: Partial<Product>;
  unitsProduced?: number; // Default 1
  realWeightKg?: number;  // Optional real weight produced
}

export function getOperationalCost(params: GetOperationalCostParams): OperationalCost {
  const {
    recipeItems,
    settings,
    equivalences,
    allProducts,
    targetProduct,
    unitsProduced = 1,
    realWeightKg
  } = params;

  let costoMateriaPrima = 0;
  let costoInsumosReceta = 0;
  let folexQuantity = 0;

  const desgloseMateriaPrima: CostBreakdownItem[] = [];
  const desgloseInsumos: CostBreakdownItem[] = [];
  const desgloseEmbalaje: CostBreakdownItem[] = [];

  const { bolsaProductId, etiquetaProductId, folexProductId } = settings.packagingSettings || {};

  if (!bolsaProductId) console.warn("getOperationalCost: Falta configuración de bolsaProductId en los ajustes de embalaje.");
  if (!etiquetaProductId) console.warn("getOperationalCost: Falta configuración de etiquetaProductId en los ajustes de embalaje.");
  if (!folexProductId) console.warn("getOperationalCost: Falta configuración de folexProductId en los ajustes de embalaje.");

  // Calculate nominal weight for proportional scaling of KGs
  let nominalWeightKg = 0;
  if (realWeightKg && realWeightKg > 0) {
    if (targetProduct && targetProduct.pesoObjetivoGramos) {
      nominalWeightKg = (targetProduct.pesoObjetivoGramos / 1000) * unitsProduced;
    } else if (targetProduct && targetProduct.unitType === 'KG') {
      nominalWeightKg = unitsProduced; // Assuming 1 unit produced = 1 kg nominal if it's sold by KG without pesoObjetivo
    }
  }

  const proportionFactorKg = (nominalWeightKg > 0 && realWeightKg && realWeightKg > 0) 
    ? (realWeightKg / nominalWeightKg) 
    : 1;

  for (const item of recipeItems) {
    const ing = allProducts.find(p => p.id === item.ingredientProductId);
    if (!ing) continue;

    // Folex is a special case handled below if it's automatic.
    if (ing.id === folexProductId) {
      folexQuantity += (item.quantity * unitsProduced);
      continue;
    }

    const isPack = ing.id === bolsaProductId || 
                   ing.id === etiquetaProductId || 
                   ing.id === folexProductId;
                   
    if (!isPack) {
      const cost = Number(ing.costoActual || 0);
      if (cost < 0) console.warn(`getOperationalCost: El costo actual del ingrediente ${ing.nombre} es negativo (${cost}).`);

      let baseConvertedQty = 0; 
      try {
        baseConvertedQty = convertUnit(
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
      
      let finalQty = baseConvertedQty * unitsProduced;
      
      // Override if the ingredient is used in KG and realWeightKg is provided
      if (ing.unitType === 'KG') {
         finalQty = finalQty * proportionFactorKg;
      }

      const ingredientCost = finalQty * cost;

      if (ing.type === 'INSUMO') {
        costoInsumosReceta += ingredientCost;
        desgloseInsumos.push({
          nombre: ing.nombre || 'Insumo desconocido',
          cantidad: finalQty,
          unidad: ing.unitType || 'U',
          costoUnitario: cost,
          subtotal: ingredientCost,
          origen: 'insumo'
        });
      } else {
        costoMateriaPrima += ingredientCost;
        desgloseMateriaPrima.push({
          nombre: ing.nombre || 'Materia prima desconocida',
          cantidad: finalQty,
          unidad: ing.unitType || 'KG',
          costoUnitario: cost,
          subtotal: ingredientCost,
          origen: 'materia_prima'
        });
      }
    }
  }

  const costoMercaderia = costoMateriaPrima + costoInsumosReceta;

  const bolsaProd = bolsaProductId ? allProducts.find(p => p.id === bolsaProductId) : null;
  const etiquetaProd = etiquetaProductId ? allProducts.find(p => p.id === etiquetaProductId) : null;
  const folexProd = folexProductId ? allProducts.find(p => p.id === folexProductId) : null;

  const costoBolsaBase = Number(bolsaProd?.costoActual || 0);
  const costoEtiquetaBase = Number(etiquetaProd?.costoActual || 0);
  const costoFolexUnidadBase = Number(folexProd?.costoActual || 0);

  if (costoBolsaBase < 0) console.warn(`getOperationalCost: El costo de la bolsa es negativo (${costoBolsaBase}).`);
  if (costoEtiquetaBase < 0) console.warn(`getOperationalCost: El costo de la etiqueta es negativo (${costoEtiquetaBase}).`);
  if (costoFolexUnidadBase < 0) console.warn(`getOperationalCost: El costo unitario del folex es negativo (${costoFolexUnidadBase}).`);
  if (costoMercaderia < 0) console.warn(`getOperationalCost: El costo de mercadería calculado es negativo (${costoMercaderia}).`);

  const totalBolsasQty = unitsProduced; 
  const totalEtiquetasQty = unitsProduced; 
  
  const costoFolexAutomatico = folexQuantity * costoFolexUnidadBase;
  const costoBolsa = totalBolsasQty * costoBolsaBase;
  const costoEtiqueta = totalEtiquetasQty * costoEtiquetaBase;

  const costoEmbalajeTotal = costoBolsa + costoEtiqueta + costoFolexAutomatico;
  
  if (bolsaProd) {
    desgloseEmbalaje.push({
      nombre: bolsaProd.nombre || 'Bolsa',
      cantidad: totalBolsasQty,
      unidad: bolsaProd.unitType || 'U',
      costoUnitario: costoBolsaBase,
      subtotal: costoBolsa,
      origen: 'embalaje'
    });
  }
  
  if (etiquetaProd) {
    desgloseEmbalaje.push({
      nombre: etiquetaProd.nombre || 'Etiqueta',
      cantidad: totalEtiquetasQty,
      unidad: etiquetaProd.unitType || 'U',
      costoUnitario: costoEtiquetaBase,
      subtotal: costoEtiqueta,
      origen: 'embalaje'
    });
  }

  if (folexQuantity > 0 && folexProd) {
    desgloseEmbalaje.push({
      nombre: folexProd.nombre || 'Folex',
      cantidad: folexQuantity,
      unidad: folexProd.unitType || 'U',
      costoUnitario: costoFolexUnidadBase,
      subtotal: costoFolexAutomatico,
      origen: 'embalaje'
    });
  }

  const costoOperativoTotal = costoMercaderia + costoEmbalajeTotal;

  // VERIFICACIÓN IMPORTANTE
  const sumaDesgloses = 
    desgloseMateriaPrima.reduce((acc, curr) => acc + curr.subtotal, 0) +
    desgloseInsumos.reduce((acc, curr) => acc + curr.subtotal, 0) +
    desgloseEmbalaje.reduce((acc, curr) => acc + curr.subtotal, 0);

  if (Math.abs(sumaDesgloses - costoOperativoTotal) > 0.01) {
    console.warn(`getOperationalCost: Inconsistencia detectada. Suma desgloses: ${sumaDesgloses}, Costo Operativo Total: ${costoOperativoTotal}`);
  }

  return {
    costoMateriaPrima,
    costoInsumosReceta,
    costoMercaderia,
    costoBolsa,
    costoEtiqueta,
    costoFolexAutomatico,
    costoEmbalajeTotal,
    costoOperativoTotal,
    folexQuantity,
    desgloseMateriaPrima,
    desgloseInsumos,
    desgloseEmbalaje
  };
}

export function calculatePresentationPrices(
  product: Partial<Product>,
  recipeItems: RecipeItem[],
  settings: SystemSettings,
  equivalences: Equivalencia[],
  allProducts: Product[]
): CalculatedPrices {
  const {
    costoMercaderia,
    costoBolsa: costoBolsaTotal,
    costoEtiqueta: costoEtiquetaTotal,
    costoFolexAutomatico: costoFolexTotal,
    costoEmbalajeTotal: costoEmbalajePorPaquete,
    folexQuantity
  } = getOperationalCost({
    recipeItems,
    settings,
    equivalences,
    allProducts,
    targetProduct: product,
    unitsProduced: 1 // For presentation pricing, we calculate for 1 unit
  });

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
      costoBolsaTotal,
      costoEtiquetaTotal,
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
      costoBolsaTotal,
      costoEtiquetaTotal,
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
