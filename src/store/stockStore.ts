import { create } from 'zustand';
import { stockRepository } from '../repositories/stockRepository';
import type { Product, StockMovement, Equivalencia } from '../types/domain';

interface StockState {
  products: Product[];
  movements: StockMovement[];
  equivalences: Equivalencia[];
  loading: boolean;
  fetchData: () => Promise<void>;
  registerAdjustment: (data: {
    productId: string;
    qty: number;
    observaciones: string;
  }) => Promise<void>;
}

export const useStockStore = create<StockState>((set, get) => ({
  products: [],
  movements: [],
  equivalences: [],
  loading: true,
  fetchData: async () => {
    const hasData = get().products.length > 0;
    if (hasData) {
      stockRepository.fetchStockData().then((data) => {
        set({
          products: data.products,
          movements: data.movements,
          equivalences: data.equivalences
        });
      }).catch(err => console.error("Background fetch stock error:", err));
      return;
    }

    set({ loading: true });
    try {
      const data = await stockRepository.fetchStockData();
      set({
        products: data.products,
        movements: data.movements,
        equivalences: data.equivalences
      });
    } catch (error) {
      console.error("Error fetching stock data in store:", error);
    } finally {
      set({ loading: false });
    }
  },
  registerAdjustment: async (data) => {
    set({ loading: true });
    try {
      await stockRepository.registerAdjustment(data);
      const freshData = await stockRepository.fetchStockData();
      set({
        products: freshData.products,
        movements: freshData.movements,
        equivalences: freshData.equivalences
      });
    } catch (error) {
      console.error("Error registering stock adjustment in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  }
}));
