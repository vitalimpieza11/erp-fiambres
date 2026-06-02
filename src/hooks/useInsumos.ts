import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseMapper } from '../mappers/databaseMapper';
import type { Insumo } from '../types/database';

export const useInsumos = () => {
  const { currentUser } = useAuth();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'insumos'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const list: Insumo[] = [];
        snapshot.forEach((doc) => {
          list.push(DatabaseMapper.toDomainInsumo(doc.data(), doc.id));
        });



        setInsumos(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setInsumos([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const saveInsumo = async (ins: Omit<Insumo, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    const payload = {
      ...ins,
      updatedAt: Date.now()
    };
    if (id) {
      const ref = doc(db, 'insumos', id);
      await updateDoc(ref, payload as any);
    } else {
      const ref = doc(collection(db, 'insumos'));
      await setDoc(ref, { ...payload, createdAt: Date.now() } as any);
    }
  };

  const deleteInsumo = async (id: string) => {
    const ref = doc(db, 'insumos', id);
    await deleteDoc(ref);
  };

  return { insumos, loading, error, saveInsumo, deleteInsumo };
};

export default useInsumos;
