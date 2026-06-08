import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { parseNumber } from '../utils/format';
import type { CashMovement } from '../types/database';

export const useCashMovements = () => {
  const { currentUser } = useAuth();
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'cash_movements'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CashMovement[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            type: data.type || 'in',
            amount: parseNumber(data.amount),
            currency: data.currency || 'ARS',
            method: data.method || 'cash',
            origin: data.origin || (data.method === 'cash' ? 'cash' : 'bank'),
            description: data.description || '',
            category: data.category || '',
            referenceId: data.referenceId || '',
            date: data.date || Date.now(),
            createdAt: data.createdAt || Date.now(),
            bankId: data.bankId || '',
            accountId: data.accountId || data.bankId || (data.method === 'cash' ? 'cash_default' : 'bank_default'),
            toAccountId: data.toAccountId || '',
            isManualOverride: data.isManualOverride || false,
            auditLog: data.auditLog || [],
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

  const createMovement = async (movement: Omit<CashMovement, 'id' | 'createdAt'>) => {
    await addDoc(collection(db, 'cash_movements'), {
      ...movement,
      createdAt: Date.now()
    });
  };

  const updateMovement = async (id: string, data: Partial<CashMovement>) => {
    const ref = doc(db, 'cash_movements', id);
    await updateDoc(ref, { ...data });
  };

  const deleteMovement = async (id: string) => {
    const ref = doc(db, 'cash_movements', id);
    await deleteDoc(ref);
  };

  // Aggregates
  const stats = movements.reduce((acc, mov) => {
    const amount = Math.abs(mov.amount);
    
    // Check if movement was today
    const movDate = new Date(mov.date);
    const today = new Date();
    const isToday = movDate.getDate() === today.getDate() &&
                    movDate.getMonth() === today.getMonth() &&
                    movDate.getFullYear() === today.getFullYear();

    // Determine primary account
    const mainAccount = mov.accountId || mov.bankId || (mov.method === 'cash' ? 'cash_default' : 'bank_default');
    if (!acc.accountBalances[mainAccount]) acc.accountBalances[mainAccount] = 0;

    if (mov.type === 'in') {
      acc.netTotal += amount;
      acc.accountBalances[mainAccount] += amount;
      
      if (mov.method === 'cash' || mainAccount === 'cash_default') {
        acc.balanceCaja += amount;
      } else {
        acc.balanceBancos += amount;
      }
      if (isToday) {
        acc.ingresosDia += amount;
      }
    } else if (mov.type === 'out') {
      acc.netTotal -= amount;
      acc.accountBalances[mainAccount] -= amount;

      if (mov.method === 'cash' || mainAccount === 'cash_default') {
        acc.balanceCaja -= amount;
      } else {
        acc.balanceBancos -= amount;
      }
      if (isToday) {
        acc.egresosDia += amount;
      }
    } else if (mov.type === 'transfer') {
      // Transfer: deduct from mainAccount, add to toAccountId
      acc.accountBalances[mainAccount] -= amount;
      const toAccount = mov.toAccountId || 'unknown';
      if (!acc.accountBalances[toAccount]) acc.accountBalances[toAccount] = 0;
      acc.accountBalances[toAccount] += amount;
      
      // Keep legacy balances mostly untouched or adjusted if known
      if (mainAccount === 'cash_default') acc.balanceCaja -= amount;
      else acc.balanceBancos -= amount;
      
      if (toAccount === 'cash_default') acc.balanceCaja += amount;
      else acc.balanceBancos += amount;
    }

    return acc;
  }, {
    balanceCaja: 0,
    balanceBancos: 0,
    ingresosDia: 0,
    egresosDia: 0,
    netTotal: 0,
    accountBalances: {} as Record<string, number>
  });

  return { 
    movements, 
    loading, 
    error, 
    createMovement,
    updateMovement,
    deleteMovement,
    stats: {
      balanceCaja: stats.balanceCaja,
      balanceBancos: stats.balanceBancos,
      ingresosDia: stats.ingresosDia,
      egresosDia: stats.egresosDia,
      resultadoNeto: stats.ingresosDia - stats.egresosDia,
      netTotal: stats.netTotal,
      accountBalances: stats.accountBalances
    }
  };
};
export default useCashMovements;
