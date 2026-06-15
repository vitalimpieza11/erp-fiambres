import { useEffect, useMemo } from 'react';
import { useCajaStore } from '../../store/cajaStore';

export function useCaja() {
  const movements = useCajaStore((state) => state.movements);
  const loading = useCajaStore((state) => state.loading);
  const subscribeMovements = useCajaStore((state) => state.subscribeMovements);
  const addMovement = useCajaStore((state) => state.addMovement);
  const annulMovement = useCajaStore((state) => state.annulMovement);

  useEffect(() => {
    const unsubscribe = subscribeMovements();
    return () => unsubscribe();
  }, [subscribeMovements]);

  const currentBalance = useMemo(() => 
    movements.reduce((acc, mov) => acc + (mov.type === 'INCOME' ? mov.amount : -mov.amount), 0),
    [movements]
  );
  
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
