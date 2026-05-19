import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { DatabaseMapper } from '../mappers/databaseMapper';
import { ErpEngine } from '../services/ErpEngine';
import type { Sale } from '../types/database';

export const useSales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Sale[] = [];
        snapshot.forEach((doc) => {
          list.push(DatabaseMapper.toDomainSale(doc.data(), doc.id));
        });
        setSales(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err);
        setSales([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const createSale = async (
    saleData: Omit<Sale, 'id' | 'subtotal' | 'total' | 'createdAt' | 'updatedAt'>,
    discountPercent: number,
    shippingCost: number
  ): Promise<string> => {
    try {
      return await ErpEngine.registerSale(saleData, discountPercent, shippingCost);
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  return { sales, loading, error, createSale };
};
