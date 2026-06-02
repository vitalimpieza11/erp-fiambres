import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseMapper } from '../mappers/databaseMapper';
import type { Presentacion } from '../types/database';

export const usePresentaciones = () => {
  const { currentUser } = useAuth();
  const [presentaciones, setPresentaciones] = useState<Presentacion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'presentaciones'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const list: Presentacion[] = [];
        snapshot.forEach((doc) => {
          list.push(DatabaseMapper.toDomainPresentacion(doc.data(), doc.id));
        });



        setPresentaciones(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setPresentaciones([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const savePresentacion = async (pres: Omit<Presentacion, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    const payload = {
      ...pres,
      updatedAt: Date.now()
    };
    if (id) {
      const ref = doc(db, 'presentaciones', id);
      await updateDoc(ref, payload as any);
    } else {
      const ref = doc(collection(db, 'presentaciones'));
      await setDoc(ref, { ...payload, createdAt: Date.now() } as any);
    }
  };

  const deletePresentacion = async (id: string) => {
    const ref = doc(db, 'presentaciones', id);
    await deleteDoc(ref);
  };

  return { presentaciones, loading, error, savePresentacion, deletePresentacion };
};

export default usePresentaciones;
