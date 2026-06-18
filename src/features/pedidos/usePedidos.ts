import { useEffect, useCallback } from 'react';
import { useOrdersStore } from '../../store/ordersStore';
import type { Order } from '../../types/domain';

export function usePedidos() {
  const pedidos = useOrdersStore((state) => state.pedidos);
  const clientes = useOrdersStore((state) => state.clientes);
  const productos = useOrdersStore((state) => state.productos);
  const listasPrecios = useOrdersStore((state) => state.listasPrecios);
  const loading = useOrdersStore((state) => state.loading);
  const fetchData = useOrdersStore((state) => state.fetchData);
  const savePedido = useOrdersStore((state) => state.savePedido);
  const deletePedido = useOrdersStore((state) => state.deletePedido);
  const changeStatus = useOrdersStore((state) => state.changeStatus);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Busca el precio de un producto para un cliente específico
  const getProductPrice = useCallback((productId: string, customerId: string): number => {
    // 1. Buscar lista asignada al cliente
    const clientList = listasPrecios.find(l => l.customerId === customerId);
    if (clientList) {
      const item = clientList.items.find(i => i.productId === productId);
      if (item && item.price > 0) return item.price;
    }

    // 2. Buscar en lista general (sin customerId)
    const generalList = listasPrecios.find(l => !l.customerId);
    if (generalList) {
      const item = generalList.items.find(i => i.productId === productId);
      if (item && item.price > 0) return item.price;
    }

    // 3. Fallback al precio comercial o sugerido del producto base
    const product = productos.find(p => p.id === productId);
    if (product) {
      return product.precioComercial || 0;
    }

    return 0; // Sin precio
  }, [listasPrecios, productos]);

  return {
    pedidos,
    clientes,
    productos,
    loading,
    savePedido,
    deletePedido,
    changeStatus,
    getProductPrice
  };
}
