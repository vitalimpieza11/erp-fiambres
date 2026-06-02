import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Recipe } from '../types/database';

export const useRecipes = () => {
  const { currentUser } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'recipes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Recipe[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            productId: data.productId || '',
            productName: data.productName || '',
            customerId: data.customerId || undefined,
            customerName: data.customerName || undefined,
            ingredients: data.ingredients || [],
            costoManoObra: Number(data.costoManoObra) || 0,
            costoAdicional: Number(data.costoAdicional) || 0,
            method: data.method || 'weight',
            createdAt: data.createdAt || Date.now(),
            updatedAt: data.updatedAt || Date.now(),
          });
        });
        setRecipes(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setRecipes([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const saveRecipe = async (recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    if (id) {
      const ref = doc(db, 'recipes', id);
      await updateDoc(ref, { ...recipe, updatedAt: Date.now() } as any);
    } else {
      const ref = doc(collection(db, 'recipes'));
      await setDoc(ref, { ...recipe, createdAt: Date.now(), updatedAt: Date.now() } as any);
    }
  };

  const deleteRecipe = async (id: string) => {
    const ref = doc(db, 'recipes', id);
    await deleteDoc(ref);
  };

  return { recipes, loading, error, saveRecipe, deleteRecipe };
};

export default useRecipes;
