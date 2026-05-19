import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { DatabaseMapper } from '../mappers/databaseMapper';
import { ErpEngine } from '../services/ErpEngine';
import type { ProductionBatch } from '../types/database';

export const useProductions = () => {
  const [productions, setProductions] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'production_batches'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ProductionBatch[] = [];
        snapshot.forEach((doc) => {
          list.push(DatabaseMapper.toDomainProductionBatch(doc.data(), doc.id));
        });
        setProductions(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err);
        setProductions([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const createProductionBatch = async (
    batchData: Omit<ProductionBatch, 'id' | 'createdAt' | 'updatedAt'>,
    sourceProductId: string,
    sourceProductName: string,
    sourceProductQtyKg: number
  ): Promise<string> => {
    try {
      return await ErpEngine.registerProduction(batchData, sourceProductId, sourceProductName, sourceProductQtyKg);
    } catch (err: any) {
      console.error(err);
      throw err;
    }
  };

  return { productions, loading, error, createProductionBatch };
};
