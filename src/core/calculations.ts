import { parseNumber } from '../utils/format';
import type { Presentacion, Mercaderia, Insumo, Recipe } from '../types/database';

/**
 * Calculates sales aggregates and totals safely.
 */
export function calculateSaleTotals(items: { quantity: number; price: number; cost: number }[], discountPercent: number, shippingCost: number) {
  const totals = items.reduce((acc, item) => {
    return {
      quantity: acc.quantity + item.quantity,
      subtotal: acc.subtotal + (item.quantity * item.price),
      cost: acc.cost + (item.quantity * item.cost)
    };
  }, { quantity: 0, subtotal: 0, cost: 0 });

  const discountAmount = totals.subtotal * (discountPercent / 100);
  const total = Math.max(0, totals.subtotal - discountAmount + shippingCost);
  const netProfit = Math.max(0, total - totals.cost);
  const marginPercent = total > 0 ? (netProfit / total) * 100 : 0;

  return {
    subtotal: totals.subtotal,
    quantity: totals.quantity,
    totalCost: totals.cost,
    discountAmount,
    total,
    netProfit,
    marginPercent
  };
}

/**
 * Safely converts any recipe ingredient quantity to grams, handling both legacy and new unit-suffixed formats.
 */
export function getIngredientGrams(
  ing: { productName: string; quantity: number; productId: string },
  recipeMethod: string | undefined,
  pres: Presentacion | undefined,
  merc: Mercaderia | undefined
): number {
  const parts = (ing.productName || '').split(' @');
  const unit = parts[1];

  const recipeFetaWeight = (pres && pres.pesoObjetivoGramos && pres.cantidadFetasEstimada)
    ? (pres.pesoObjetivoGramos / pres.cantidadFetasEstimada)
    : (merc?.pesoFeta || 15);

  if (unit) {
    // New normalized format: quantity is stored in grams in the database
    return ing.quantity;
  } else {
    // Legacy format
    if (recipeMethod === 'weight') {
      return ing.quantity * 1000; // Kg -> grams
    } else if (recipeMethod === 'percentage') {
      const totalWeightGrams = pres?.pesoObjetivoGramos || 0;
      return totalWeightGrams * (ing.quantity / 100); // % -> grams
    } else if (recipeMethod === 'fetas') {
      return ing.quantity * recipeFetaWeight; // fetas -> grams
    } else {
      return ing.quantity; // fallback as-is
    }
  }
}

/**
 * Calculates the total cost of a presentation.
 */
export function calculatePresentationCost(
  pres: Presentacion,
  mercaderias: Mercaderia[],
  insumos: Insumo[],
  recipes: Recipe[]
): number {
  let costMercaderia = 0;

  if (pres.productoBaseId) {
    const base = mercaderias.find(m => m.id === pres.productoBaseId);
    if (base) {
      const merma = base.mermaEstimada || 0;
      const weightKg = (pres.pesoObjetivoGramos || 0) / 1000;
      costMercaderia = (weightKg * base.costoKg) / (1 - merma / 100);
    }
  } else {
    // Check if there is an associated recipe
    const recipe = recipes.find(r => r.productId === pres.id || r.id === pres.recipeId || r.id === pres.recetaId || (r.productId === pres.productoBaseId && r.customerId === pres.customerId));
    if (recipe) {
      let ingredientsCost = 0;
      recipe.ingredients.forEach((ing) => {
        const merc = mercaderias.find(m => m.id === ing.productId);
        if (merc) {
          const qtyGrams = getIngredientGrams(ing, recipe.method, pres, merc);
          const qtyKg = qtyGrams / 1000;
          ingredientsCost += qtyKg * merc.costoKg;
        }
      });
      costMercaderia = ingredientsCost + (recipe.costoManoObra || 0) + (recipe.costoAdicional || 0);
    }
  }

  const bag = insumos.find(i => i.id === pres.bolsaId);
  const label = insumos.find(i => i.id === pres.etiquetaId);
  
  let totalCost = costMercaderia;

  const costBolsa = bag?.costoUnitario;
  if (typeof costBolsa === "number" && !isNaN(costBolsa)) {
    totalCost += costBolsa;
  }

  const costEtiqueta = label?.costoUnitario;
  if (typeof costEtiqueta === "number" && !isNaN(costEtiqueta)) {
    totalCost += costEtiqueta;
  }

  const costManoObra = pres.manoObra;
  if (typeof costManoObra === "number" && !isNaN(costManoObra)) {
    totalCost += costManoObra;
  }

  return totalCost;
}

/**
 * Calculates the stock consumption (mercaderias and insumos) for a given presentation quantity.
 */
export function getPresentationConsumption(
  pres: Presentacion,
  quantity: number,
  mercaderias: Mercaderia[],
  insumos: Insumo[],
  recipes: Recipe[]
): { id: string; name: string; quantity: number; isInsumo: boolean }[] {
  const consumption: { id: string; name: string; quantity: number; isInsumo: boolean }[] = [];

  // 1. Bolsa
  if (pres.bolsaId) {
    const bag = insumos.find(i => i.id === pres.bolsaId);
    consumption.push({
      id: pres.bolsaId,
      name: bag?.name || 'Bolsa',
      quantity: quantity,
      isInsumo: true
    });
  }

  // 2. Etiqueta
  if (pres.etiquetaId) {
    const label = insumos.find(i => i.id === pres.etiquetaId);
    consumption.push({
      id: pres.etiquetaId,
      name: label?.name || 'Etiqueta',
      quantity: quantity,
      isInsumo: true
    });
  }

  // 3. Mercaderia
  if (pres.productoBaseId) {
    const base = mercaderias.find(m => m.id === pres.productoBaseId);
    if (base) {
      const merma = base.mermaEstimada || 0;
      const weightKgPerPkg = (pres.pesoObjetivoGramos || 0) / 1000;
      const totalWeightKg = (weightKgPerPkg / (1 - merma / 100)) * quantity;
      
      consumption.push({
        id: pres.productoBaseId,
        name: base.name,
        quantity: totalWeightKg,
        isInsumo: false
      });
    }
  } else {
    const recipe = recipes.find(r => r.productId === pres.id || r.id === pres.recipeId || r.id === pres.recetaId || (r.productId === pres.productoBaseId && r.customerId === pres.customerId));
    if (recipe) {
      recipe.ingredients.forEach((ing) => {
        const merc = mercaderias.find(m => m.id === ing.productId);
        if (merc) {
          const qtyGrams = getIngredientGrams(ing, recipe.method, pres, merc);
          const qtyKgPerPkg = qtyGrams / 1000;

          const merma = merc.mermaEstimada || 0;
          const totalWeightKg = (qtyKgPerPkg / (1 - merma / 100)) * quantity;

          consumption.push({
            id: ing.productId,
            name: merc.name,
            quantity: totalWeightKg,
            isInsumo: false
          });
        }
      });
    }
  }

  return consumption;
}

/**
 * Calculates the gross total and commercial discount based on the official price and price lists.
 */
export function calculateCommercialBonification(
  items: { productId: string, quantity: number, weightKg: number, basePriceKg: number, cost: number, pesoObjetivoGramos: number }[],
  customerId: string,
  priceListId: string,
  customers: any[],
  priceLists: any[]
): { grossTotal: number, commercialDiscount: number, netTotal: number } {
  let grossTotal = 0;
  let netTotal = 0;

  const customer = customers.find(c => c.id === customerId);
  const pList = priceLists.find(l => l.id === priceListId);

  items.forEach(item => {
    // Gross is strictly the real weight * official price per kg
    const itemGross = item.weightKg * item.basePriceKg;
    grossTotal += itemGross;

    // Determine the commercial target price per package
    let packageNetPrice = item.basePriceKg * (item.pesoObjetivoGramos / 1000);

    const specialPrice = customer?.specialPrices?.[item.productId];
    if (specialPrice) {
      if (specialPrice.mode === 'price') {
        packageNetPrice = specialPrice.value;
      } else {
        packageNetPrice = item.cost / (1 - specialPrice.value / 100);
      }
    } else if (pList) {
      const override = pList.productOverrides?.[item.productId];
      if (override) {
        if (override.mode === 'manual') {
          packageNetPrice = override.manualPrice || 0;
        } else {
          const margin = override.margin || pList.margin;
          packageNetPrice = margin >= 100 ? item.cost * 2 : (item.cost / (1 - margin / 100));
        }
      } else {
        packageNetPrice = pList.margin >= 100 ? item.cost * 2 : (item.cost / (1 - pList.margin / 100));
      }
    }

    const itemNet = packageNetPrice * item.quantity;
    netTotal += itemNet;
  });

  const commercialDiscount = grossTotal - netTotal;
  
  return {
    grossTotal,
    commercialDiscount,
    netTotal
  };
}

