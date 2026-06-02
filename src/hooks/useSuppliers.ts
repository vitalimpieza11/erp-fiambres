import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseMapper } from '../mappers/databaseMapper';
import type { Supplier } from '../types/database';

export const useSuppliers = () => {
  const { currentUser } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'suppliers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Supplier[] = [];
        snapshot.forEach((doc) => {
          list.push(DatabaseMapper.toDomainSupplier(doc.data(), doc.id));
        });
        setSuppliers(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setSuppliers([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const saveSupplier = async (supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    if (id) {
      const ref = doc(db, 'suppliers', id);
      await updateDoc(ref, { ...supplier, updatedAt: Date.now() } as any);
    } else {
      const ref = doc(collection(db, 'suppliers'));
      await setDoc(ref, { ...supplier, createdAt: Date.now(), updatedAt: Date.now() } as any);
    }
  };

  const deleteSupplier = async (id: string) => {
    const ref = doc(db, 'suppliers', id);
    await deleteDoc(ref);
  };

  return { suppliers, loading, error, saveSupplier, deleteSupplier };
};
