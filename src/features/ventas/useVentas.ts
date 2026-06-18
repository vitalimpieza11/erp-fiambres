import { useEffect } from 'react';
import { useSalesStore } from '../../store/salesStore';

export function useVentas() {
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
  const createQuickSale = useSalesStore((state) => state.createQuickSale);
  const updateSale = useSalesStore((state) => state.updateSale);
  const cobrarSale = useSalesStore((state) => state.cobrarSale);
  const anularSale = useSalesStore((state) => state.anularSale);
  const deleteSale = useSalesStore((state) => state.deleteSale);
  const markOrderAsDelivered = useSalesStore((state) => state.markOrderAsDelivered);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    sales,
    orders,
    customers,
    products,
    recipes,
    equivalences,
    packages,
    loading,
    createSaleFromOrder,
    createQuickSale,
    updateSale,
    cobrarSale,
    anularSale,
    deleteSale,
    markOrderAsDelivered
  };
}
