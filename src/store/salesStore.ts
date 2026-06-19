import { create } from 'zustand';
import { salesRepository } from '../repositories/ventas/salesRepository';
import type { Sale, Order, Customer, Product, SaleItem } from '../types/domain';
import { useSettingsStore } from './settingsStore';

interface SalesState {
  sales: Sale[];
  orders: Order[];
  customers: Customer[];
  products: Product[];
  recipes: any[];
  equivalences: any[];
  packages: any[];
  loading: boolean;
  fetchData: () => Promise<void>;
  markOrderAsDelivered: (orderId: string) => Promise<void>;
  createSaleFromOrder: (
    order: Order, 
    itemsToSell: SaleItem[], 
    finalTotal: number, 
    tipoComprobante?: 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' | 'PRESUPUESTO' | 'REMITO'
  ) => Promise<void>;
  createQuickSale: (data: { customerId: string; date: string; items: SaleItem[]; totalAmount: number; observaciones?: string }) => Promise<void>;
  createHistoricalSale: (data: {
    customerId: string;
    date: string;
    observaciones: string;
    totalAmount: number;
    costoTotal: number;
    deliveryStatus: 'PENDIENTE' | 'ENTREGADO';
    items: { productId: string; cantidad: number }[];
  }) => Promise<void>;
  cobrarSale: (sale: Sale, method: 'EFECTIVO_TRANSFERENCIA' | 'CUENTA_CORRIENTE', accountId?: string) => Promise<void>;
  anularSale: (sale: Sale) => Promise<void>;
  updateSale: (saleId: string, updatedData: Partial<Sale>) => Promise<void>;
  deleteSale: (sale: Sale) => Promise<void>;
  deliverHistoricalSale: (saleId: string, itemsWithWeights?: { productId: string; pesoReal: number }[]) => Promise<void>;
}

export const useSalesStore = create<SalesState>((set, get) => ({
  sales: [],
  orders: [],
  customers: [],
  products: [],
  recipes: [],
  equivalences: [],
  packages: [],
  loading: true,
  fetchData: async () => {
    // Load system settings in background
    useSettingsStore.getState().fetchSettings().catch(e => console.error("Error fetching settings:", e));

    const hasData = get().sales.length > 0;
    if (hasData) {
      salesRepository.fetchSalesData().then((data) => {
        set({
          sales: data.sales,
          orders: data.orders,
          customers: data.customers,
          products: data.products,
          recipes: data.recipes,
          equivalences: data.equivalences,
          packages: data.packages
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
        products: data.products,
        recipes: data.recipes,
        equivalences: data.equivalences,
        packages: data.packages
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
        products: data.products,
        recipes: data.recipes,
        equivalences: data.equivalences,
        packages: data.packages
      });
    } catch (error) {
      console.error("Error marking order as delivered in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  createSaleFromOrder: async (order, itemsToSell, finalTotal, tipoComprobante) => {
    set({ loading: true });
    try {
      await salesRepository.createSaleFromOrder(order, itemsToSell, finalTotal, tipoComprobante);
      const data = await salesRepository.fetchSalesData();
      set({
        sales: data.sales,
        orders: data.orders,
        customers: data.customers,
        products: data.products,
        recipes: data.recipes,
        equivalences: data.equivalences,
        packages: data.packages
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
        products: freshData.products,
        recipes: freshData.recipes,
        equivalences: freshData.equivalences,
        packages: freshData.packages
      });
    } catch (error) {
      console.error("Error creating quick sale in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  createHistoricalSale: async (data) => {
    set({ loading: true });
    try {
      await salesRepository.createHistoricalSale(data);
      const freshData = await salesRepository.fetchSalesData();
      set({
        sales: freshData.sales,
        orders: freshData.orders,
        customers: freshData.customers,
        products: freshData.products,
        recipes: freshData.recipes,
        equivalences: freshData.equivalences,
        packages: freshData.packages
      });
    } catch (error) {
      console.error("Error creating historical sale in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  cobrarSale: async (sale, method, accountId) => {
    set({ loading: true });
    try {
      await salesRepository.cobrarSale(sale, method, accountId);
      const data = await salesRepository.fetchSalesData();
      set({
        sales: data.sales,
        orders: data.orders,
        customers: data.customers,
        products: data.products,
        recipes: data.recipes,
        equivalences: data.equivalences,
        packages: data.packages
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
        products: data.products,
        recipes: data.recipes,
        equivalences: data.equivalences,
        packages: data.packages
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
        products: data.products,
        recipes: data.recipes,
        equivalences: data.equivalences,
        packages: data.packages
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
        products: data.products,
        recipes: data.recipes,
        equivalences: data.equivalences,
        packages: data.packages
      });
    } catch (error) {
      console.error("Error deleting sale in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  deliverHistoricalSale: async (saleId, itemsWithWeights) => {
    set({ loading: true });
    try {
      await salesRepository.deliverHistoricalSale(saleId, itemsWithWeights);
      const data = await salesRepository.fetchSalesData();
      set({
        sales: data.sales,
        orders: data.orders,
        customers: data.customers,
        products: data.products,
        recipes: data.recipes,
        equivalences: data.equivalences,
        packages: data.packages
      });
    } catch (error) {
      console.error("Error delivering historical sale in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  }
}));
