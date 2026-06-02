import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseMapper } from '../mappers/databaseMapper';
import type { Customer } from '../types/database';

export const useCustomers = () => {
  const { currentUser } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Customer[] = [];
        snapshot.forEach((doc) => {
          list.push(DatabaseMapper.toDomainCustomer(doc.data(), doc.id));
        });
        setCustomers(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setCustomers([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const saveCustomer = async (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    if (id) {
      const ref = doc(db, 'customers', id);
      await updateDoc(ref, { ...customer, updatedAt: Date.now() } as any);
    } else {
      const ref = doc(collection(db, 'customers'));
      await setDoc(ref, { ...customer, createdAt: Date.now(), updatedAt: Date.now() } as any);
    }
  };

  const deleteCustomer = async (id: string) => {
    const ref = doc(db, 'customers', id);
    await deleteDoc(ref);
  };

  return { customers, loading, error, saveCustomer, deleteCustomer };
};
