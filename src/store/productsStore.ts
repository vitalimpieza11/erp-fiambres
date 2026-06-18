import { create } from 'zustand';
import { productsRepository } from '../repositories/stock/productsRepository';
import type { Product } from '../types/domain';

interface ProductsState {
  productos: Product[];
  loading: boolean;
  fetchProductos: () => Promise<void>;
  saveProduct: (product: Partial<Product>) => Promise<string>;
  toggleStatus: (id: string, currentStatus: boolean) => Promise<void>;
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  productos: [],
  loading: false,
  fetchProductos: async () => {
    const hasData = get().productos.length > 0;
    if (hasData) {
      // Stale-While-Revalidate: fetch in background, don't set loading to true
      productsRepository.fetchProducts().then((data) => {
        const normalized = data.map(p => ({
          ...p,
          nombre: p.nombre || (p as any).name || ''
        }));
        const sorted = normalized.sort((a, b) => a.nombre.localeCompare(b.nombre));
        set({ productos: sorted });
      }).catch(err => console.error("Background fetch products error:", err));
      return;
    }

    set({ loading: true });
    try {
      const data = await productsRepository.fetchProducts();
      const normalized = data.map(p => ({
        ...p,
        nombre: p.nombre || (p as any).name || ''
      }));
      const sorted = normalized.sort((a, b) => a.nombre.localeCompare(b.nombre));
      set({ productos: sorted });
    } catch (error) {
      console.error("Error fetching products in store:", error);
    } finally {
      set({ loading: false });
    }
  },
  saveProduct: async (product) => {
    set({ loading: true });
    try {
      const id = await productsRepository.saveProduct(product, get().productos);
      const data = await productsRepository.fetchProducts();
      const normalized = data.map(p => ({
        ...p,
        nombre: p.nombre || (p as any).name || ''
      }));
      const sorted = normalized.sort((a, b) => a.nombre.localeCompare(b.nombre));
      set({ productos: sorted });
      return id;
    } catch (error) {
      console.error("Error saving product in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  toggleStatus: async (id, currentStatus) => {
    set({ loading: true });
    try {
      await productsRepository.toggleProductStatus(id, currentStatus);
      const data = await productsRepository.fetchProducts();
      const normalized = data.map(p => ({
        ...p,
        nombre: p.nombre || (p as any).name || ''
      }));
      const sorted = normalized.sort((a, b) => a.nombre.localeCompare(b.nombre));
      set({ productos: sorted });
    } catch (error) {
      console.error("Error toggling product status in store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  }
}));
