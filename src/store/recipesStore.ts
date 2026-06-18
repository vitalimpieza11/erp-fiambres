import { create } from 'zustand';
import { recipesRepository } from '../repositories/stock/recipesRepository';
import type { Recipe } from '../types/domain';

interface RecipesState {
  recipes: Recipe[];
  loading: boolean;
  fetchRecipes: () => Promise<void>;
  saveRecipe: (recipe: Partial<Recipe>) => Promise<void>;
  deleteRecipe: (productId: string) => Promise<void>;
}

export const useRecipesStore = create<RecipesState>((set, get) => ({
  recipes: [],
  loading: false,
  fetchRecipes: async () => {
    const hasData = get().recipes.length > 0;
    if (hasData) {
      recipesRepository.fetchRecipes().then((data) => {
        set({ recipes: data });
      }).catch(err => console.error("Error al cargar recetas en segundo plano:", err));
      return;
    }

    set({ loading: true });
    try {
      const data = await recipesRepository.fetchRecipes();
      set({ recipes: data });
    } catch (error) {
      console.error("Error al obtener recetas en store:", error);
    } finally {
      set({ loading: false });
    }
  },
  saveRecipe: async (recipe) => {
    set({ loading: true });
    try {
      await recipesRepository.saveRecipe(recipe);
      const data = await recipesRepository.fetchRecipes();
      set({ recipes: data });
    } catch (error) {
      console.error("Error al guardar receta en store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  deleteRecipe: async (productId) => {
    set({ loading: true });
    try {
      await recipesRepository.deleteRecipe(productId);
      const data = await recipesRepository.fetchRecipes();
      set({ recipes: data });
    } catch (error) {
      console.error("Error al eliminar receta en store:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  }
}));
