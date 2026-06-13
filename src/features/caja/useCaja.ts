import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { CajaMovement } from '../../types/domain';

export function useCaja() {
  const [movements, setMovements] = useState<CajaMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'caja_movements'),
      where('isDeleted', '==', false),
      orderBy('date', 'desc'),
      limit(100)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: CajaMovement[] = [];
      snapshot.forEach((d) => {
        data.push(d.data() as CajaMovement);
      });
      setMovements(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const addMovement = async (mov: Omit<CajaMovement, 'id' | 'isDeleted' | 'date'> & { date?: string }) => {
    const docRef = doc(collection(db, 'caja_movements'));
    const newMovement: CajaMovement = {
      ...mov,
      id: docRef.id,
      date: mov.date || new Date().toISOString(),
      isDeleted: false
    };
    await setDoc(docRef, newMovement);
  };

  const annulMovement = async (originalId: string, reason: string) => {
    const original = movements.find(m => m.id === originalId);
    if (!original) throw new Error("Movimiento no encontrado");

    const docRef = doc(collection(db, 'caja_movements'));
    const compensatoryMovement: CajaMovement = {
      id: docRef.id,
      type: original.type === 'INCOME' ? 'EXPENSE' : 'INCOME',
      amount: original.amount,
      date: new Date().toISOString(),
      category: 'ANULACION',
      description: `Anulación de ${original.category} (Ref: ${originalId}). Motivo: ${reason}`,
      referenceId: original.id,
      isDeleted: false
    };
    await setDoc(docRef, compensatoryMovement);
  };

  const currentBalance = useMemo(() => movements.reduce((acc, mov) => acc + (mov.type === 'INCOME' ? mov.amount : -mov.amount), 0), [movements]);
  
  const { ingresosHoy, egresosHoy, ingresosMes, egresosMes } = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    const movementsToday = movements.filter(m => m.date >= startOfDay);
    const movementsThisMonth = movements.filter(m => m.date >= startOfMonth);

    return {
      ingresosHoy: movementsToday.filter(m => m.type === 'INCOME').reduce((acc, m) => acc + m.amount, 0),
      egresosHoy: movementsToday.filter(m => m.type === 'EXPENSE').reduce((acc, m) => acc + m.amount, 0),
      ingresosMes: movementsThisMonth.filter(m => m.type === 'INCOME').reduce((acc, m) => acc + m.amount, 0),
      egresosMes: movementsThisMonth.filter(m => m.type === 'EXPENSE').reduce((acc, m) => acc + m.amount, 0)
    };
  }, [movements]);

  return {
    movements,
    loading,
    addMovement,
    annulMovement,
    currentBalance,
    ingresosHoy,
    egresosHoy,
    ingresosMes,
    egresosMes
  };
}
