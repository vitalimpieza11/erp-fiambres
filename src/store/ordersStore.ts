import { create } from 'zustand';
import { ordersRepository } from '../repositories/ordersRepository';
import type { Order, Customer, Product, PriceList } from '../types/domain';

interface OrdersState {
  pedidos: Order[];
  clientes: Customer[];
  productos: Product[];
  listasPrecios: PriceList[];
  loading: boolean;
  fetchData: () => Promise<void>;
  savePedido: (pedido: Partial<Order>) => Promise<void>;
  deletePedido: (id: string) => Promise<void>;
  changeStatus: (id: string, status: Order['status']) => Promise<void>;
}

export const useOrdersStore = create<OrdersState>((set, get) => ({
  pedidos: [],
  clientes: [],
  productos: [],
  listasPrecios: [],
  loading: true,
  fetchData: async () => {
    const hasData = get().pedidos.length > 0;
    if (hasData) {
      ordersRepository.fetchOrdersData().then((data) => {
        set({
          pedidos: data.orders,
          clientes: data.customers,
          productos: data.products,
          listasPrecios: data.priceLists,
        });
      }).catch(err => console.error("Background fetch orders error:", err));
      return;
    }

    set({ loading: true });
    try {
      const data = await ordersRepository.fetchOrdersData();
      set({
        pedidos: data.orders,
        clientes: data.customers,
        productos: data.products,
        listasPrecios: data.priceLists,
      });
    } catch (error) {
      console.error("Error fetching orders data in store:", error);
    } finally {
      set({ loading: false });
    }
  },
  savePedido: async (pedido) => {
    set({ loading: true });
    try {
      await ordersRepository.savePedido(pedido);
      // Force reload to reflect updates immediately
      const data = await ordersRepository.fetchOrdersData();
      set({
        pedidos: data.orders,
        clientes: data.customers,
        productos: data.products,
        listasPrecios: data.priceLists,
      });
    } catch (error) {
      console.error("Error saving order in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  deletePedido: async (id) => {
    set({ loading: true });
    try {
      await ordersRepository.deletePedido(id);
      const data = await ordersRepository.fetchOrdersData();
      set({
        pedidos: data.orders,
        clientes: data.customers,
        productos: data.products,
        listasPrecios: data.priceLists,
      });
    } catch (error) {
      console.error("Error deleting order in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  changeStatus: async (id, status) => {
    set({ loading: true });
    try {
      await ordersRepository.changeStatus(id, status);
      const data = await ordersRepository.fetchOrdersData();
      set({
        pedidos: data.orders,
        clientes: data.customers,
        productos: data.products,
        listasPrecios: data.priceLists,
      });
    } catch (error) {
      console.error("Error changing order status in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  }
}));
