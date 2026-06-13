import { useEffect, useCallback } from 'react';
import { useSociosStore } from '../../store/sociosStore';

export function useSocios() {
  const shareholders = useSociosStore((state) => state.shareholders);
  const movements = useSociosStore((state) => state.movements);
  const loading = useSociosStore((state) => state.loading);
  const subscribeAll = useSociosStore((state) => state.subscribeAll);
  const addMovement = useSociosStore((state) => state.addMovement);
  const annulMovement = useSociosStore((state) => state.annulMovement);
  const saveShareholder = useSociosStore((state) => state.saveShareholder);
  const toggleShareholderStatus = useSociosStore((state) => state.toggleShareholderStatus);

  useEffect(() => {
    const unsubscribe = subscribeAll();
    return () => unsubscribe();
  }, [subscribeAll]);

  const getBalance = useCallback((shareholderId: string) => {
    const movs = movements.filter(m => m.shareholderId === shareholderId);
    return movs.reduce((acc, mov) => {
      if (mov.sourceType === 'APORTE') return acc + mov.amount;
      if (mov.sourceType === 'RETIRO') return acc - mov.amount;
      if (mov.sourceType === 'AJUSTE') return acc + mov.amount; // Ajustes pueden ser pos o neg
      if (mov.sourceType === 'ANULACION') return acc + mov.amount; 
      return acc;
    }, 0);
  }, [movements]);

  return {
    shareholders,
    movements,
    loading,
    addMovement,
    annulMovement,
    getBalance,
    saveShareholder,
    toggleShareholderStatus
  };
}
