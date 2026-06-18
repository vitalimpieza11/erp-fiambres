import { create } from 'zustand';
import { purchasesRepository } from '../repositories/compras/purchasesRepository';
import type { Purchase } from '../types/domain';

interface PurchasesState {
  purchases: Purchase[];
  loading: boolean;
  isSubscribed: boolean;
  unsubscribeRef: (() => void) | null;
  subscribePurchases: () => () => void;
  addPurchase: (purchaseData: Omit<Purchase, 'id' | 'isDeleted'> & { accountId?: string }) => Promise<void>;
  annulPurchase: (purchaseId: string, reason: string) => Promise<void>;
}

export const usePurchasesStore = create<PurchasesState>((set, get) => ({
  purchases: [],
  loading: true,
  isSubscribed: false,
  unsubscribeRef: null,
  subscribePurchases: () => {
    if (get().isSubscribed) {
      return () => {};
    }

    set({ isSubscribed: true, loading: get().purchases.length === 0 });
    
    const unsub = purchasesRepository.subscribePurchases((purchases) => {
      set({ purchases, loading: false });
    });

    set({ unsubscribeRef: unsub });
    return () => {};
  },
  addPurchase: async (purchaseData) => {
    await purchasesRepository.addPurchase(purchaseData);
  },
  annulPurchase: async (purchaseId, reason) => {
    const original = get().purchases.find(p => p.id === purchaseId);
    if (!original) throw new Error("Compra no encontrada");
    await purchasesRepository.annulPurchase(purchaseId, reason, original);
  }
}));
