import { useMemo, useEffect } from 'react';
import { useStockStore } from '../../store/stockStore';
import { truncateDecimals } from '../../lib/formatters';
import type { StockMovement } from '../../types/domain';

export type DiagnosticResult = {
  productId: string;
  productName: string;
  stockActual: number;
  stockCalculado: number;
  diferencia: number;
  totalCompras: number;
  totalVentas: number;
  totalProduccion: number;
  totalAjustesPositivos: number;
  totalAjustesNegativos: number;
  movements: StockMovement[];
};

export function useStockDiagnostic() {
  const { products, movements, loading, fetchData } = useStockStore();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const diagnostics = useMemo(() => {
    if (!products.length || !movements.length) return [];

    const movsByProduct = movements.reduce((acc, mov) => {
      if (!acc[mov.productId]) acc[mov.productId] = [];
      acc[mov.productId].push(mov);
      return acc;
    }, {} as Record<string, StockMovement[]>);

    return products.map(product => {
      const prodMovs = movsByProduct[product.id] || [];
      
      let totalCompras = 0;
      let totalVentas = 0;
      let totalProduccion = 0;
      let totalAjustesPositivos = 0;
      let totalAjustesNegativos = 0;

      prodMovs.forEach(m => {
        const qty = Number(m.qty) || 0;
        
        if (m.type === 'COMPRA') {
          totalCompras += Math.abs(qty);
        } else if (m.type === 'VENTA') {
          totalVentas += Math.abs(qty);
        } else if (m.type === 'PRODUCCION' || m.type === 'PRODUCCION_STOCK' || m.type === 'PRODUCCION_PEDIDO') {
          totalProduccion += qty; // Puede ser positivo o negativo
        } else if (m.type === 'AJUSTE') {
          if (qty >= 0) {
            totalAjustesPositivos += qty;
          } else {
            totalAjustesNegativos += Math.abs(qty);
          }
        } else if (m.type === 'MERMA_PRODUCCION') {
          totalAjustesNegativos += Math.abs(qty);
        }
      });

      const stockCalculado = totalCompras - totalVentas + totalProduccion + totalAjustesPositivos - totalAjustesNegativos;
      const stockActual = Number(product.stockActual) || 0;
      const diferencia = stockCalculado - stockActual;

      const result: DiagnosticResult = {
        productId: product.id,
        productName: product.nombre,
        stockActual: truncateDecimals(stockActual, 3),
        stockCalculado: truncateDecimals(stockCalculado, 3),
        diferencia: truncateDecimals(diferencia, 3),
        totalCompras: truncateDecimals(totalCompras, 3),
        totalVentas: truncateDecimals(totalVentas, 3),
        totalProduccion: truncateDecimals(totalProduccion, 3),
        totalAjustesPositivos: truncateDecimals(totalAjustesPositivos, 3),
        totalAjustesNegativos: truncateDecimals(totalAjustesNegativos, 3),
        movements: prodMovs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      };

      return result;
    });
  }, [products, movements]);

  return {
    diagnostics,
    loading
  };
}
