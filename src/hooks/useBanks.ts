import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';

export interface BankAccount {
  id?: string;
  name: string; // Nombre del banco (e.g. Galicia)
  accountType: string; // Tipo de cuenta (e.g. Cuenta Corriente, Caja de Ahorro)
  currency: string; // Moneda (e.g. ARS, USD)
  isActive: boolean;
  createdAt: number;
}

export const useBanks = () => {
  const { currentUser } = useAuth();
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'banks'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: BankAccount[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            name: data.name || '',
            accountType: data.accountType || '',
            currency: data.currency || 'ARS',
            isActive: data.isActive ?? true,
            createdAt: data.createdAt || Date.now(),
          });
        });
        setBanks(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching banks:', err);
        setError(err.message);
        setBanks([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const saveBank = async (bank: Omit<BankAccount, 'id' | 'createdAt'>, id?: string) => {
    if (id) {
      const ref = doc(db, 'banks', id);
      await updateDoc(ref, { ...bank } as any);
    } else {
      const ref = doc(collection(db, 'banks'));
      await setDoc(ref, { ...bank, createdAt: Date.now() } as any);
    }
  };

  const deleteBank = async (id: string) => {
    const ref = doc(db, 'banks', id);
    await deleteDoc(ref);
  };

  return { banks, loading, error, saveBank, deleteBank };
};

export default useBanks;
