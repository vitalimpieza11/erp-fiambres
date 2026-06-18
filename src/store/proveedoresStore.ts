import { create } from 'zustand';
import { proveedoresRepository } from '../repositories/proveedores/proveedoresRepository';
import type { Supplier, SupplierMovement } from '../types/domain';

interface ProveedoresState {
  suppliers: Supplier[];
  movements: SupplierMovement[];
  loading: boolean;
  isSubscribed: boolean;
  unsubscribeRef: (() => void) | null;
  subscribeAll: () => () => void;
  saveSupplier: (supplier: Partial<Supplier>) => Promise<void>;
  toggleSupplierStatus: (id: string, currentStatus: boolean) => Promise<void>;
  addMovement: (mov: Omit<SupplierMovement, 'id' | 'isDeleted' | 'deletedAt'>) => Promise<SupplierMovement>;
  registerCompra: (supplierId: string, amount: number, date: string, sourceId: string, observaciones: string) => Promise<void>;
  registerPago: (supplierId: string, amount: number, date: string, sourceId: string, observaciones: string, fromCaja: boolean, accountId?: string) => Promise<void>;
  registerAjuste: (supplierId: string, amount: number, date: string, observaciones: string) => Promise<void>;
  annulMovement: (movementId: string, reason: string) => Promise<void>;
}

export const useProveedoresStore = create<ProveedoresState>((set, get) => ({
  suppliers: [],
  movements: [],
  loading: true,
  isSubscribed: false,
  unsubscribeRef: null,
  subscribeAll: () => {
    if (get().isSubscribed) {
      return () => {};
    }

    set({ isSubscribed: true, loading: get().suppliers.length === 0 && get().movements.length === 0 });
    
    const unsubSuppliers = proveedoresRepository.subscribeSuppliers((suppliers) => {
      set({ suppliers });
    });

    const unsubMovements = proveedoresRepository.subscribeMovements((movements) => {
      set({ movements, loading: false });
    });

    const unsubAll = () => {
      unsubSuppliers();
      unsubMovements();
    };

    set({ unsubscribeRef: unsubAll });
    return () => {};
  },
  saveSupplier: async (supplier) => {
    await proveedoresRepository.saveSupplier(supplier);
  },
  toggleSupplierStatus: async (id, currentStatus) => {
    await proveedoresRepository.toggleSupplierStatus(id, currentStatus);
  },
  addMovement: async (mov) => {
    return await proveedoresRepository.addMovement(mov);
  },
  registerCompra: async (supplierId, amount, date, sourceId, observaciones) => {
    await proveedoresRepository.registerCompra(supplierId, amount, date, sourceId, observaciones);
  },
  registerPago: async (supplierId, amount, date, sourceId, observaciones, fromCaja, accountId) => {
    await proveedoresRepository.registerPago(supplierId, amount, date, sourceId, observaciones, fromCaja, accountId);
  },
  registerAjuste: async (supplierId, amount, date, observaciones) => {
    await proveedoresRepository.registerAjuste(supplierId, amount, date, observaciones);
  },
  annulMovement: async (movementId, reason) => {
    const original = get().movements.find(m => m.id === movementId);
    if (!original) throw new Error("Movimiento no encontrado");
    await proveedoresRepository.annulMovement(movementId, reason, original);
  }
}));
