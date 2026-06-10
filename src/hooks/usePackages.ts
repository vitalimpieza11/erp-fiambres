import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import type { ProductPackage } from '../types/database';

export const usePackages = () => {
  const [packages, setPackages] = useState<ProductPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'packages'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ProductPackage[];
        setPackages(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching packages:', err);
        setError('Error al cargar paquetes. ' + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const savePackage = async (pkgData: Omit<ProductPackage, 'createdAt' | 'updatedAt'>, id?: string) => {
    try {
      if (id) {
        const docRef = doc(db, 'packages', id);
        await updateDoc(docRef, {
          ...pkgData,
          updatedAt: Date.now(),
        });
      } else {
        await addDoc(collection(db, 'packages'), {
          ...pkgData,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    } catch (err: any) {
      console.error('Error saving package:', err);
      throw err;
    }
  };

  const deletePackage = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'packages', id));
    } catch (err: any) {
      console.error('Error deleting package:', err);
      throw err;
    }
  };

  return { packages, loading, error, savePackage, deletePackage };
};
