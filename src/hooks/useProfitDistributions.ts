import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { parseNumber } from '../utils/format';
import type { ProfitDistribution } from '../types/database';

export const useProfitDistributions = () => {
  const { currentUser } = useAuth();
  const [distributions, setDistributions] = useState<ProfitDistribution[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'profit_distributions'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ProfitDistribution[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            date: data.date || Date.now(),
            amount: parseNumber(data.amount),
            type: data.type || 'reinvestment',
            observations: data.observations || '',
            createdAt: data.createdAt || Date.now(),
          });
        });
        setDistributions(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setDistributions([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const createDistribution = async (distribution: Omit<ProfitDistribution, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'profit_distributions'), {
      ...distribution,
      createdAt: Date.now()
    });
  };

  return {
    distributions,
    loading,
    error,
    createDistribution
  };
};

export default useProfitDistributions;
