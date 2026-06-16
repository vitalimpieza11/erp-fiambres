import { create } from 'zustand';
import { productionRepository } from '../repositories/produccion/productionRepository';
import type { Order, Product, Equivalencia, StockMovement, RecipeItem, Customer } from '../types/domain';

interface ProductionState {
  orders: Order[];
  products: Product[];
  recipes: any[];
  equivalences: Equivalencia[];
  movements: StockMovement[];
  customers: Customer[];
  loading: boolean;
  fetchData: () => Promise<void>;
  produce: (data: {
    productId: string;
    cantidad: number;
    pesoReal?: number;
    merma?: number;
    observaciones: string;
    orderId?: string;
    newOrderStatus?: 'EN_PRODUCCION' | 'PRODUCIDO';
    recipeItemsOverride?: RecipeItem[];
  }) => Promise<void>;
  produceMultiple: (data: {
    orderId?: string;
    items: {
      productId: string;
      cantidad: number;
      unidad: string;
      pesoReal?: number;
      merma?: number;
      observaciones: string;
    }[];
    newOrderStatus?: 'EN_PRODUCCION' | 'PRODUCIDO';
  }) => Promise<void>;
  revertMovement: (movementId: string) => Promise<void>;
  produceStep: (data: {
    orderId: string;
    productId: string;
    cantidad: number;
    unidad: string;
    pesoReal?: number;
    merma?: number;
    observaciones: string;
    recipeItemsOverride?: RecipeItem[];
    isLastStep: boolean;
    newOrderStatus?: 'EN_PRODUCCION' | 'PRODUCIDO';
  }) => Promise<void>;
}

export const useProductionStore = create<ProductionState>((set, get) => ({
  orders: [],
  products: [],
  recipes: [],
  equivalences: [],
  movements: [],
  customers: [],
  loading: true,
  fetchData: async () => {
    const hasData = get().orders.length > 0;
    if (hasData) {
      productionRepository.fetchProductionData().then((data) => {
        set({
          orders: data.orders,
          products: data.products,
          recipes: data.recipes,
          equivalences: data.equivalences,
          movements: data.movements,
          customers: data.customers
        });
      }).catch(err => console.error("Background fetch production error:", err));
      return;
    }

    set({ loading: true });
    try {
      const data = await productionRepository.fetchProductionData();
      set({
        orders: data.orders,
        products: data.products,
        recipes: data.recipes,
        equivalences: data.equivalences,
        movements: data.movements,
        customers: data.customers
      });
    } catch (error) {
      console.error("Error fetching production data in store:", error);
    } finally {
      set({ loading: false });
    }
  },
  produce: async (data) => {
    set({ loading: true });
    try {
      await productionRepository.produce(data, get().equivalences);
      // Force reload to reflect updates immediately
      const freshData = await productionRepository.fetchProductionData();
      set({
        orders: freshData.orders,
        products: freshData.products,
        recipes: freshData.recipes,
        equivalences: freshData.equivalences,
        movements: freshData.movements,
        customers: freshData.customers
      });
    } catch (error) {
      console.error("Error performing production in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  produceMultiple: async (data) => {
    set({ loading: true });
    try {
      await productionRepository.produceMultiple(data, get().equivalences);
      const freshData = await productionRepository.fetchProductionData();
      set({
        orders: freshData.orders,
        products: freshData.products,
        recipes: freshData.recipes,
        equivalences: freshData.equivalences,
        movements: freshData.movements,
        customers: freshData.customers
      });
    } catch (error) {
      console.error("Error performing produceMultiple in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  produceStep: async (data) => {
    set({ loading: true });
    try {
      await productionRepository.produceStep(data, get().equivalences);
      const freshData = await productionRepository.fetchProductionData();
      set({
        orders: freshData.orders,
        products: freshData.products,
        recipes: freshData.recipes,
        equivalences: freshData.equivalences,
        movements: freshData.movements,
        customers: freshData.customers
      });
    } catch (error) {
      console.error("Error performing produceStep in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  revertMovement: async (movementId) => {
    const movData = get().movements.find(m => m.id === movementId);
    if (!movData) throw new Error("Movimiento no encontrado");
    set({ loading: true });
    try {
      await productionRepository.revertMovement(movementId, movData);
      const freshData = await productionRepository.fetchProductionData();
      set({
        orders: freshData.orders,
        products: freshData.products,
        recipes: freshData.recipes,
        equivalences: freshData.equivalences,
        movements: freshData.movements,
        customers: freshData.customers
      });
    } catch (error) {
      console.error("Error reverting production movement in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  }
}));
