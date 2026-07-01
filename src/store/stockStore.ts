import { create } from 'zustand';
import { stockRepository } from '../repositories/stock/stockRepository';
import { recipesRepository } from '../repositories/stock/recipesRepository';
import type { Product, StockMovement, Equivalencia, Recipe } from '../types/domain';

interface StockState {
  products: Product[];
  movements: StockMovement[];
  equivalences: Equivalencia[];
  recipes: Recipe[];
  loading: boolean;
  fetchData: () => Promise<void>;
  fetchMovements: (filters?: { productId?: string; dateFrom?: string; dateTo?: string; type?: string; }) => Promise<void>;
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
  recipes: [],
  loading: true,
  fetchData: async () => {
    const hasData = get().products.length > 0;
    if (hasData) {
      Promise.all([
        stockRepository.fetchStockData(),
        recipesRepository.fetchRecipes()
      ]).then(([stockData, recipesData]) => {
        set({
          products: stockData.products,
          movements: stockData.movements,
          equivalences: stockData.equivalences,
          recipes: recipesData
        });
      }).catch(err => console.error("Background fetch stock/recipes error:", err));
      return;
    }

    set({ loading: true });
    try {
      const [stockData, recipesData] = await Promise.all([
        stockRepository.fetchStockData(),
        recipesRepository.fetchRecipes()
      ]);
      set({
        products: stockData.products,
        movements: stockData.movements,
        equivalences: stockData.equivalences,
        recipes: recipesData
      });
    } catch (error) {
      console.error("Error fetching stock/recipes data in store:", error);
    } finally {
      set({ loading: false });
    }
  },
  fetchMovements: async (filters) => {
    set({ loading: true });
    try {
      const movements = await stockRepository.fetchStockMovements(filters);
      set({ movements });
    } catch (error) {
      console.error("Error fetching filtered stock movements in store:", error);
    } finally {
      set({ loading: false });
    }
  },
  registerAdjustment: async (data) => {
    set({ loading: true });
    try {
      await stockRepository.registerAdjustment(data);
      const [freshStockData, freshRecipesData] = await Promise.all([
        stockRepository.fetchStockData(),
        recipesRepository.fetchRecipes()
      ]);
      set({
        products: freshStockData.products,
        movements: freshStockData.movements,
        equivalences: freshStockData.equivalences,
        recipes: freshRecipesData
      });
    } catch (error) {
      console.error("Error registering stock adjustment in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  }
}));
