import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { parseNumber } from '../utils/format';
import type { StockMovement } from '../types/database';

export const useStockMovements = () => {
  const { currentUser } = useAuth();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'stock_movements'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: StockMovement[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            productId: data.productId || '',
            productName: data.productName || '',
            quantity: parseNumber(data.quantity),
            type: data.type || 'in',
            referenceType: data.referenceType || 'manual',
            referenceId: data.referenceId || '',
            date: data.date || Date.now(),
            observations: data.observations || '',
            createdAt: data.createdAt || Date.now(),
          });
        });
        setMovements(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setMovements([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  // Compute stock levels per product dynamically
  const productStocks = movements.reduce((acc, mov) => {
    const current = acc[mov.productId] || 0;
    acc[mov.productId] = current + mov.quantity;
    return acc;
  }, {} as Record<string, number>);

  return { movements, loading, error, productStocks };
};
export default useStockMovements;
