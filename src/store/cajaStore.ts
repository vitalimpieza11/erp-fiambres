import { create } from 'zustand';
import { cajaRepository } from '../repositories/caja/cajaRepository';
import type { CajaMovement } from '../types/domain';

interface CajaState {
  movements: CajaMovement[];
  loading: boolean;
  isSubscribed: boolean;
  unsubscribeRef: (() => void) | null;
  subscribeMovements: () => () => void;
  addMovement: (mov: Omit<CajaMovement, 'id' | 'isDeleted' | 'date'> & { date?: string }) => Promise<void>;
  annulMovement: (originalId: string, reason: string) => Promise<void>;
}

export const useCajaStore = create<CajaState>((set, get) => ({
  movements: [],
  loading: true,
  isSubscribed: false,
  unsubscribeRef: null,
  subscribeMovements: () => {
    if (get().isSubscribed) {
      // Already subscribed, return dummy unsub
      return () => {};
    }

    // Only set loading to true if we don't have cached data yet
    set({ isSubscribed: true, loading: get().movements.length === 0 });
    
    const unsub = cajaRepository.subscribeMovements((movements) => {
      set({ movements, loading: false });
    });

    set({ unsubscribeRef: unsub });
    return () => {}; // Keep subscription alive globally
  },
  addMovement: async (mov) => {
    await cajaRepository.addMovement(mov);
  },
  annulMovement: async (originalId, reason) => {
    const original = get().movements.find(m => m.id === originalId);
    if (!original) throw new Error("Movimiento no encontrado");
    await cajaRepository.annulMovement(originalId, reason, original);
  }
}));
