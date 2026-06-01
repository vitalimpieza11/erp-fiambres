import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseMapper } from '../mappers/databaseMapper';
import type { Product } from '../types/database';

export type { Product };

export const useProducts = () => {
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const prods: Product[] = [];
        snapshot.forEach((doc) => {
          prods.push(DatabaseMapper.toDomainProduct(doc.data(), doc.id));
        });
        setProducts(prods);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setProducts([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const saveProduct = async (product: Omit<Product, 'id'>, id?: string) => {
    if (id) {
      const ref = doc(db, 'products', id);
      await updateDoc(ref, { ...product, updatedAt: Date.now() });
    } else {
      const ref = doc(collection(db, 'products'));
      await setDoc(ref, { ...product, createdAt: Date.now(), updatedAt: Date.now() });
    }
  };

  const seedDemoProducts = async () => {
    // No-op
  };

  return { products, loading, error, saveProduct, seedDemoProducts };
};
