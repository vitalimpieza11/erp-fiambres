import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseMapper } from '../mappers/databaseMapper';
import type { Mercaderia } from '../types/database';

export const useMercaderias = () => {
  const { currentUser } = useAuth();
  const [mercaderias, setMercaderias] = useState<Mercaderia[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'mercaderias'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const list: Mercaderia[] = [];
        snapshot.forEach((doc) => {
          list.push(DatabaseMapper.toDomainMercaderia(doc.data(), doc.id));
        });



        setMercaderias(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setMercaderias([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const saveMercaderia = async (merc: Omit<Mercaderia, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    const payload = {
      ...merc,
      updatedAt: Date.now()
    };
    if (id) {
      const ref = doc(db, 'mercaderias', id);
      await updateDoc(ref, payload as any);
    } else {
      const ref = doc(collection(db, 'mercaderias'));
      await setDoc(ref, { ...payload, createdAt: Date.now() } as any);
    }
  };

  const deleteMercaderia = async (id: string) => {
    const ref = doc(db, 'mercaderias', id);
    await deleteDoc(ref);
  };

  return { mercaderias, loading, error, saveMercaderia, deleteMercaderia };
};

export default useMercaderias;
