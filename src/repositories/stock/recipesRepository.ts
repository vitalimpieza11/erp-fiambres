import { getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Recipe, RecipeItem, Product, Equivalencia } from '../../types/domain';
import { mapRecipeUnitToUnitType } from '../../types/domain';
import { convertUnit } from '../../lib/unitConverter';
import { truncateDecimals } from '../../lib/formatters';

export function calculateRecipeCost(
  recipe: Recipe | undefined | null,
  products: Product[],
  equivalences: Equivalencia[]
): number {
  if (!recipe || !recipe.items || recipe.items.length === 0) return 0;
  
  let totalCost = 0;

  for (const item of recipe.items) {
    const ingredient = products.find(p => p.id === item.ingredientProductId);
    if (ingredient) {
      try {
        const convertedQty = convertUnit(
          item.quantity,
          mapRecipeUnitToUnitType(item.unit),
          ingredient.unitType,
          ingredient.nombre || '',
          '',
          equivalences
        );
        totalCost += convertedQty * (ingredient.costoActual || 0);
      } catch (err) {
        console.error(`Error al convertir unidad en cálculo de costo para ${item.ingredientName}:`, err);
      }
    }
  }

  return truncateDecimals(totalCost, 2);
}

export const recipesRepository = {
  async fetchRecipes(): Promise<Recipe[]> {
    const snapshot = await getDocs(COLLECTIONS.RECIPES);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Recipe));
  },

  async saveRecipe(recipe: Partial<Recipe>): Promise<void> {
    if (!recipe.productId) {
      throw new Error("El ID del producto terminado es obligatorio para guardar una receta.");
    }

    if (!recipe.items || recipe.items.length === 0) {
      throw new Error("La receta debe contener al menos un ingrediente.");
    }

    // Validar integridad referencial y cantidades
    const seenIngredients = new Set<string>();
    for (const item of recipe.items) {
      if (!item.ingredientProductId) {
        throw new Error("Cada ingrediente de la receta debe hacer referencia a un producto válido.");
      }
      if (seenIngredients.has(item.ingredientProductId)) {
        throw new Error(`El ingrediente "${item.ingredientName || item.ingredientProductId}" está duplicado en la receta.`);
      }
      seenIngredients.add(item.ingredientProductId);

      if (item.quantity <= 0) {
        throw new Error(`La cantidad para el ingrediente "${item.ingredientName || item.ingredientProductId}" debe ser mayor que cero.`);
      }
    }

    const now = new Date().toISOString();
    const dataToSave = {
      productId: recipe.productId,
      productName: recipe.productName || "Producto Desconocido",
      createdAt: recipe.createdAt || now,
      updatedAt: now,
      items: recipe.items
    };

    // Usar productId como el ID del documento
    const docRef = doc(db, 'recipes', recipe.productId);
    await setDoc(docRef, dataToSave);
  },

  async deleteRecipe(productId: string): Promise<void> {
    const docRef = doc(db, 'recipes', productId);
    await deleteDoc(docRef);
  },

  getRecipeCost: calculateRecipeCost
};
