import { useEffect, useMemo } from 'react';
import { useSalesStore } from '../../store/salesStore';

export function useFacturacion() {
  const sales = useSalesStore((state) => state.sales);
  const orders = useSalesStore((state) => state.orders);
  const customers = useSalesStore((state) => state.customers);
  const products = useSalesStore((state) => state.products);
  const recipes = useSalesStore((state) => state.recipes);
  const equivalences = useSalesStore((state) => state.equivalences);
  const packages = useSalesStore((state) => state.packages);
  const loading = useSalesStore((state) => state.loading);
  const fetchData = useSalesStore((state) => state.fetchData);
  const createSaleFromOrder = useSalesStore((state) => state.createSaleFromOrder);
  const cobrarSale = useSalesStore((state) => state.cobrarSale);
  const anularSale = useSalesStore((state) => state.anularSale);
  const deleteSale = useSalesStore((state) => state.deleteSale);
  const markOrderAsDelivered = useSalesStore((state) => state.markOrderAsDelivered);
  const deliverHistoricalSale = useSalesStore((state) => state.deliverHistoricalSale);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Memoize orders that are ready to be invoiced (status PRODUCIDO or ENTREGADO)
  const pendingOrders = useMemo(() => {
    return orders.filter(
      (order) => !order.isDeleted && (order.status === 'PRODUCIDO' || order.status === 'ENTREGADO')
    );
  }, [orders]);

  return {
    sales: sales.filter((s) => !s.isDeleted),
    orders,
    customers,
    products,
    recipes,
    equivalences,
    packages,
    loading,
    pendingOrders,
    createSaleFromOrder,
    cobrarSale,
    anularSale,
    deleteSale,
    markOrderAsDelivered,
    deliverHistoricalSale,
    fetchData,
  };
}
