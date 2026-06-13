import { create } from 'zustand';
import { clientesRepository } from '../repositories/clientesRepository';
import type { Customer, CustomerMovement, PriceList, Order, Sale } from '../types/domain';

interface ClientesState {
  customers: Customer[];
  movements: CustomerMovement[];
  priceLists: PriceList[];
  orders: Order[];
  sales: Sale[];
  loading: boolean;
  
  fetchClientesData: () => Promise<void>;
  saveCustomer: (customer: Partial<Customer>) => Promise<void>;
  toggleCustomerStatus: (id: string, currentStatus: boolean) => Promise<void>;
  registerPago: (
    customerId: string,
    amount: number,
    date: string,
    sourceId: string,
    observaciones: string,
    fromCaja: boolean
  ) => Promise<void>;
  registerAjuste: (
    customerId: string,
    amount: number,
    date: string,
    observaciones: string
  ) => Promise<void>;
  annulMovement: (movementId: string, reason: string) => Promise<void>;
}

export const useClientesStore = create<ClientesState>((set, get) => ({
  customers: [],
  movements: [],
  priceLists: [],
  orders: [],
  sales: [],
  loading: false,

  fetchClientesData: async () => {
    const hasData = get().customers.length > 0;
    if (hasData) {
      clientesRepository.fetchClientesData().then((data) => {
        set({
          customers: data.customers,
          movements: data.movements,
          priceLists: data.priceLists,
          orders: data.orders,
          sales: data.sales,
        });
      }).catch(err => console.error("Background fetch clientes error:", err));
      return;
    }

    set({ loading: true });
    try {
      const data = await clientesRepository.fetchClientesData();
      set({
        customers: data.customers,
        movements: data.movements,
        priceLists: data.priceLists,
        orders: data.orders,
        sales: data.sales,
      });
    } catch (error) {
      console.error("Error fetching clientes data in store:", error);
    } finally {
      set({ loading: false });
    }
  },

  saveCustomer: async (customer) => {
    set({ loading: true });
    try {
      await clientesRepository.saveCustomer(customer);
      const data = await clientesRepository.fetchClientesData();
      set({
        customers: data.customers,
        movements: data.movements,
        priceLists: data.priceLists,
        orders: data.orders,
        sales: data.sales,
      });
    } catch (error) {
      console.error("Error saving customer in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  toggleCustomerStatus: async (id, currentStatus) => {
    set({ loading: true });
    try {
      await clientesRepository.toggleCustomerStatus(id, currentStatus);
      const data = await clientesRepository.fetchClientesData();
      set({
        customers: data.customers,
        movements: data.movements,
        priceLists: data.priceLists,
        orders: data.orders,
        sales: data.sales,
      });
    } catch (error) {
      console.error("Error toggling customer status in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  registerPago: async (customerId, amount, date, sourceId, observaciones, fromCaja) => {
    set({ loading: true });
    try {
      await clientesRepository.registerPago(customerId, amount, date, sourceId, observaciones, fromCaja);
      const data = await clientesRepository.fetchClientesData();
      set({
        customers: data.customers,
        movements: data.movements,
        priceLists: data.priceLists,
        orders: data.orders,
        sales: data.sales,
      });
    } catch (error) {
      console.error("Error registering customer payment in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  registerAjuste: async (customerId, amount, date, observaciones) => {
    set({ loading: true });
    try {
      await clientesRepository.registerAjuste(customerId, amount, date, observaciones);
      const data = await clientesRepository.fetchClientesData();
      set({
        customers: data.customers,
        movements: data.movements,
        priceLists: data.priceLists,
        orders: data.orders,
        sales: data.sales,
      });
    } catch (error) {
      console.error("Error registering customer adjustment in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  annulMovement: async (movementId, reason) => {
    set({ loading: true });
    try {
      const original = get().movements.find(m => m.id === movementId);
      if (!original) throw new Error("Movimiento no encontrado");
      await clientesRepository.annulMovement(movementId, reason, original);
      const data = await clientesRepository.fetchClientesData();
      set({
        customers: data.customers,
        movements: data.movements,
        priceLists: data.priceLists,
        orders: data.orders,
        sales: data.sales,
      });
    } catch (error) {
      console.error("Error annulling movement in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  }
}));
