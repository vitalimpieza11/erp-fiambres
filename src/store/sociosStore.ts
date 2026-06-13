import { create } from 'zustand';
import { sociosRepository } from '../repositories/sociosRepository';
import type { Shareholder, ShareholderMovement } from '../types/domain';

interface SociosState {
  shareholders: Shareholder[];
  movements: ShareholderMovement[];
  loading: boolean;
  isSubscribed: boolean;
  unsubscribeRef: (() => void) | null;
  subscribeAll: () => () => void;
  addMovement: (data: {
    shareholderId: string;
    sourceType: 'APORTE' | 'RETIRO' | 'AJUSTE';
    amount: number;
    description: string;
    impactCaja: boolean;
    cajaCategory?: string;
  }) => Promise<void>;
  annulMovement: (originalId: string, reason: string) => Promise<void>;
  saveShareholder: (shareholder: Partial<Shareholder>) => Promise<void>;
  toggleShareholderStatus: (id: string, currentStatus: boolean) => Promise<void>;
}

export const useSociosStore = create<SociosState>((set, get) => ({
  shareholders: [],
  movements: [],
  loading: true,
  isSubscribed: false,
  unsubscribeRef: null,
  subscribeAll: () => {
    if (get().isSubscribed) {
      return () => {};
    }

    set({ isSubscribed: true, loading: get().shareholders.length === 0 && get().movements.length === 0 });
    
    const unsubShareholders = sociosRepository.subscribeShareholders((shareholders) => {
      set({ shareholders });
    });

    const unsubMovements = sociosRepository.subscribeMovements((movements) => {
      set({ movements, loading: false });
    });

    const unsubAll = () => {
      unsubShareholders();
      unsubMovements();
    };

    set({ unsubscribeRef: unsubAll });
    return () => {};
  },
  addMovement: async (data) => {
    await sociosRepository.addMovement(data);
  },
  annulMovement: async (originalId, reason) => {
    const original = get().movements.find(m => m.id === originalId);
    if (!original) throw new Error("Movimiento no encontrado");
    await sociosRepository.annulMovement(originalId, reason, original);
  },
  saveShareholder: async (shareholder) => {
    await sociosRepository.saveShareholder(shareholder);
  },
  toggleShareholderStatus: async (id, currentStatus) => {
    await sociosRepository.toggleShareholderStatus(id, currentStatus);
  }
}));
