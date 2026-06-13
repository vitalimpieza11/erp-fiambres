import { useEffect } from 'react';
import { usePurchasesStore } from '../../store/purchasesStore';

export function usePurchases() {
  const purchases = usePurchasesStore((state) => state.purchases);
  const loading = usePurchasesStore((state) => state.loading);
  const subscribePurchases = usePurchasesStore((state) => state.subscribePurchases);
  const addPurchase = usePurchasesStore((state) => state.addPurchase);
  const annulPurchase = usePurchasesStore((state) => state.annulPurchase);

  useEffect(() => {
    const unsubscribe = subscribePurchases();
    return () => unsubscribe();
  }, [subscribePurchases]);

  return {
    purchases,
    loading,
    addPurchase,
    annulPurchase
  };
}
