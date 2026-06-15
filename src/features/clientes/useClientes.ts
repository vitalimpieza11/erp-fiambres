import { useEffect, useCallback } from 'react';
import { useClientesStore } from '../../store/clientesStore';
import type { Customer, CustomerMovement, PriceList, Order, Sale } from '../../types/domain';

export function useClientes() {
  const customers = useClientesStore((state) => state.customers);
  const movements = useClientesStore((state) => state.movements);
  const priceLists = useClientesStore((state) => state.priceLists);
  const orders = useClientesStore((state) => state.orders);
  const sales = useClientesStore((state) => state.sales);
  const loading = useClientesStore((state) => state.loading);

  const fetchClientesData = useClientesStore((state) => state.fetchClientesData);
  const saveCustomer = useClientesStore((state) => state.saveCustomer);
  const toggleCustomerStatus = useClientesStore((state) => state.toggleCustomerStatus);
  const registerPago = useClientesStore((state) => state.registerPago);
  const registerAjuste = useClientesStore((state) => state.registerAjuste);
  const annulMovement = useClientesStore((state) => state.annulMovement);

  useEffect(() => {
    fetchClientesData();
  }, [fetchClientesData]);

  // Calcular saldo (deuda) de un cliente específico
  const getCustomerBalance = useCallback((customerId: string) => {
    const clientMovements = movements.filter(m => m.customerId === customerId && !m.isDeleted);
    let balance = 0;
    for (const m of clientMovements) {
      if (m.type === 'DEUDA') {
        balance += m.amount;
      } else if (m.type === 'PAGO') {
        balance -= m.amount;
      } else if (m.type === 'AJUSTE') {
        balance += m.amount;
      }
    }
    return balance;
  }, [movements]);

  // Obtener precio para un cliente y producto específico
  const getProductPriceForCustomer = useCallback((customerId: string, productId: string, fallbackPrice = 0) => {
    const specificList = priceLists.find(pl => pl.customerId === customerId && pl.activo);
    if (specificList) {
      const item = specificList.items.find(i => i.productId === productId);
      if (item) return item.price;
    }
    const generalList = priceLists.find(pl => !pl.customerId && pl.activo);
    if (generalList) {
      const item = generalList.items.find(i => i.productId === productId);
      if (item) return item.price;
    }
    return fallbackPrice;
  }, [priceLists]);

  // Obtener historial de movimientos de un cliente
  const getCustomerMovements = useCallback((customerId: string) => {
    return movements
      .filter(m => m.customerId === customerId && !m.isDeleted)
      .sort((a, b) => {
        const tA = a.date ? new Date(a.date).getTime() : 0;
        const tB = b.date ? new Date(b.date).getTime() : 0;
        return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
      });
  }, [movements]);

  // Obtener pedidos de un cliente
  const getCustomerOrders = useCallback((customerId: string) => {
    return orders
      .filter(o => o.customerId === customerId && !o.isDeleted)
      .sort((a, b) => {
        const tA = a.fecha ? new Date(a.fecha).getTime() : 0;
        const tB = b.fecha ? new Date(b.fecha).getTime() : 0;
        return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
      });
  }, [orders]);

  // Obtener ventas/facturaciones de un cliente
  const getCustomerSales = useCallback((customerId: string) => {
    return sales
      .filter(s => s.customerId === customerId && !s.isDeleted)
      .sort((a, b) => {
        const tA = a.date ? new Date(a.date).getTime() : 0;
        const tB = b.date ? new Date(b.date).getTime() : 0;
        return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
      });
  }, [sales]);

  return {
    customers,
    movements,
    priceLists,
    orders,
    sales,
    loading,
    getCustomerBalance,
    getProductPriceForCustomer,
    getCustomerMovements,
    getCustomerOrders,
    getCustomerSales,
    saveCustomer,
    toggleCustomerStatus,
    registerPago,
    registerAjuste,
    annulMovement,
    refetch: fetchClientesData
  };
}
