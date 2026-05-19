import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { DatabaseMapper } from '../mappers/databaseMapper';
import { ErpEngine } from '../services/ErpEngine';
import type { Purchase } from '../types/database';

export const usePurchases = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Purchase[] = [];
        snapshot.forEach((doc) => {
          list.push(DatabaseMapper.toDomainPurchase(doc.data(), doc.id));
        });
        setPurchases(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err);
        setPurchases([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const createPurchase = async (
    purchaseData: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    try {
      return await ErpEngine.registerPurchase(purchaseData);
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  return { purchases, loading, error, createPurchase };
};
