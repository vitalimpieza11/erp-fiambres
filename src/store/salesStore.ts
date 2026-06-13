import { create } from 'zustand';
import { salesRepository } from '../repositories/salesRepository';
import type { Sale, Order, Customer, Product, SaleItem } from '../types/domain';

interface SalesState {
  sales: Sale[];
  orders: Order[];
  customers: Customer[];
  products: Product[];
  loading: boolean;
  fetchData: () => Promise<void>;
  markOrderAsDelivered: (orderId: string) => Promise<void>;
  createSaleFromOrder: (order: Order, itemsToSell: Omit<SaleItem, 'subtotal'>[], finalTotal: number) => Promise<void>;
  createQuickSale: (data: Omit<Sale, 'id' | 'status' | 'paymentMethod' | 'isDeleted' | 'orderId'>) => Promise<void>;
  cobrarSale: (sale: Sale, method: 'EFECTIVO_TRANSFERENCIA' | 'CUENTA_CORRIENTE') => Promise<void>;
  anularSale: (sale: Sale) => Promise<void>;
  updateSale: (saleId: string, updatedData: Partial<Sale>) => Promise<void>;
  deleteSale: (sale: Sale) => Promise<void>;
}

export const useSalesStore = create<SalesState>((set, get) => ({
  sales: [],
  orders: [],
  customers: [],
  products: [],
  loading: true,
  fetchData: async () => {
    const hasData = get().sales.length > 0;
    if (hasData) {
      salesRepository.fetchSalesData().then((data) => {
        set({
          sales: data.sales,
          orders: data.orders,
          customers: data.customers,
          products: data.products
        });
      }).catch(err => console.error("Background fetch sales error:", err));
      return;
    }

    set({ loading: true });
    try {
      const data = await salesRepository.fetchSalesData();
      set({
        sales: data.sales,
        orders: data.orders,
        customers: data.customers,
        products: data.products
      });
    } catch (error) {
      console.error("Error fetching sales data in store:", error);
    } finally {
      set({ loading: false });
    }
  },
  markOrderAsDelivered: async (orderId) => {
    set({ loading: true });
    try {
      await salesRepository.markOrderAsDelivered(orderId);
      const data = await salesRepository.fetchSalesData();
      set({
        sales: data.sales,
        orders: data.orders,
        customers: data.customers,
        products: data.products
      });
    } catch (error) {
      console.error("Error marking order as delivered in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  createSaleFromOrder: async (order, itemsToSell, finalTotal) => {
    set({ loading: true });
    try {
      await salesRepository.createSaleFromOrder(order, itemsToSell, finalTotal);
      const data = await salesRepository.fetchSalesData();
      set({
        sales: data.sales,
        orders: data.orders,
        customers: data.customers,
        products: data.products
      });
    } catch (error) {
      console.error("Error creating sale from order in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  createQuickSale: async (data) => {
    set({ loading: true });
    try {
      await salesRepository.createQuickSale(data);
      const freshData = await salesRepository.fetchSalesData();
      set({
        sales: freshData.sales,
        orders: freshData.orders,
        customers: freshData.customers,
        products: freshData.products
      });
    } catch (error) {
      console.error("Error creating quick sale in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  cobrarSale: async (sale, method) => {
    set({ loading: true });
    try {
      await salesRepository.cobrarSale(sale, method);
      const data = await salesRepository.fetchSalesData();
      set({
        sales: data.sales,
        orders: data.orders,
        customers: data.customers,
        products: data.products
      });
    } catch (error) {
      console.error("Error in cobranza in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  anularSale: async (sale) => {
    set({ loading: true });
    try {
      await salesRepository.anularSale(sale);
      const data = await salesRepository.fetchSalesData();
      set({
        sales: data.sales,
        orders: data.orders,
        customers: data.customers,
        products: data.products
      });
    } catch (error) {
      console.error("Error anulating sale in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  updateSale: async (saleId, updatedData) => {
    set({ loading: true });
    try {
      await salesRepository.updateSale(saleId, updatedData);
      const data = await salesRepository.fetchSalesData();
      set({
        sales: data.sales,
        orders: data.orders,
        customers: data.customers,
        products: data.products
      });
    } catch (error) {
      console.error("Error updating sale in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  deleteSale: async (sale) => {
    set({ loading: true });
    try {
      await salesRepository.deleteSale(sale);
      const data = await salesRepository.fetchSalesData();
      set({
        sales: data.sales,
        orders: data.orders,
        customers: data.customers,
        products: data.products
      });
    } catch (error) {
      console.error("Error deleting sale in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  }
}));
