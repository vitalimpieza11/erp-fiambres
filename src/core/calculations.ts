import { parseNumber } from '../utils/format';

/**
 * Calculates raw product derived financial metrics.
 * Safe from NaN, Infinity, and Division by Zero.
 */
export function calculateProductMetrics(data: {
  costoHorma: number | string;
  pesoHorma: number | string;
  mermaEstimada: number | string;
  gramajeVenta: number | string;
  costoBolsa: number | string;
  costoEtiqueta: number | string;
  manoObra: number | string;
  margenDeseado: number | string;
  precioManual: number | string;
}) {
  const costoHorma = parseNumber(data.costoHorma);
  const pesoHorma = parseNumber(data.pesoHorma);
  const mermaEstimada = parseNumber(data.mermaEstimada);
  const gramajeVenta = parseNumber(data.gramajeVenta);
  
  const costoBolsa = parseNumber(data.costoBolsa);
  const costoEtiqueta = parseNumber(data.costoEtiqueta);
  const manoObra = parseNumber(data.manoObra);
  const margenDeseado = parseNumber(data.margenDeseado);
  const precioManual = parseNumber(data.precioManual);

  // 1. Costo por KG
  const costoKg = pesoHorma > 0 ? costoHorma / pesoHorma : 0;
  
  // 2. Kilogramos Netos (post merma)
  const kgNetos = pesoHorma * (1 - (mermaEstimada || 0) / 100);
  
  // 3. Cantidad de paquetes estimados
  const paquetesEstimados = gramajeVenta > 0 ? Math.floor((kgNetos * 1000) / gramajeVenta) : 0;
  
  // 4. Costo materia prima por paquete
  const costoMateriaPrimaPorPaq = paquetesEstimados > 0 ? costoHorma / paquetesEstimados : 0;
  
  // 5. Costo total de paquete feteado (materia prima + insumos + mano obra)
  const costoTotalPaquete = paquetesEstimados > 0 
    ? costoMateriaPrimaPorPaq + costoBolsa + costoEtiqueta + manoObra 
    : 0;
  
  // 6. Precio sugerido
  const precioSugerido = costoTotalPaquete > 0 ? costoTotalPaquete * (1 + margenDeseado / 100) : 0;
  
  // 7. Precio de venta real (manual si existe, sugerido si no)
  const precioVenta = precioManual > 0 ? precioManual : precioSugerido;
  
  // 8. Utilidad neta por paquete
  const utilidadNetaPaquete = precioVenta > 0 && costoTotalPaquete > 0 ? precioVenta - costoTotalPaquete : 0;
  
  // 9. Margen real (%)
  const margenReal = precioVenta > 0 ? (utilidadNetaPaquete / precioVenta) * 100 : 0;
  
  // 10. Utilidad por KG vendido
  const utilidadKg = gramajeVenta > 0 && precioVenta > 0 ? utilidadNetaPaquete * (1000 / gramajeVenta) : 0;

  return {
    costoKg,
    kgNetos,
    paquetesEstimados,
    costoMateriaPrimaPorPaq,
    costoTotalPaquete,
    precioSugerido,
    precioVenta,
    utilidadNetaPaquete,
    margenReal,
    utilidadKg,
    hasValidData: costoTotalPaquete > 0 && precioVenta > 0
  };
}

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
