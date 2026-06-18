import { useEffect, useCallback } from 'react';
import { useRecipesStore } from '../../store/recipesStore';
import { recipesRepository } from '../../repositories/stock/recipesRepository';
import { useProductsStore } from '../../store/productsStore';
import { useStockStore } from '../../store/stockStore';
import type { Recipe, Product, Equivalencia } from '../../types/domain';

export function useRecipes() {
  const recipes = useRecipesStore((state) => state.recipes);
  const loading = useRecipesStore((state) => state.loading);
  const fetchRecipes = useRecipesStore((state) => state.fetchRecipes);
  const saveRecipe = useRecipesStore((state) => state.saveRecipe);
  const deleteRecipe = useRecipesStore((state) => state.deleteRecipe);

  // We might need products and equivalences to calculate dynamic cost
  const productos = useProductsStore((state) => state.productos);
  const fetchProductos = useProductsStore((state) => state.fetchProductos);

  // Since stock store fetches equivalences, let's load it if not present, or use product catalog directly
  const equivalences = useStockStore((state) => state.equivalences);
  const fetchStockData = useStockStore((state) => state.fetchData);

  useEffect(() => {
    fetchRecipes();
    fetchProductos();
    fetchStockData();
  }, [fetchRecipes, fetchProductos, fetchStockData]);

  const getRecipeCost = useCallback((recipe: Recipe | undefined | null) => {
    return recipesRepository.getRecipeCost(recipe, productos, equivalences);
  }, [productos, equivalences]);

  const getProductRecipeCost = useCallback((productId: string) => {
    const recipe = recipes.find(r => r.productId === productId);
    return getRecipeCost(recipe);
  }, [recipes, getRecipeCost]);

  return {
    recipes,
    loading: loading,
    saveRecipe,
    deleteRecipe,
    getRecipeCost,
    getProductRecipeCost,
    productos,
    equivalences
  };
}
