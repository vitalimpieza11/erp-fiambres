import { useEffect, useCallback } from 'react';
import { useProveedoresStore } from '../../store/proveedoresStore';
import type { SupplierMovement } from '../../types/domain';

export function useProveedores() {
  const suppliers = useProveedoresStore((state) => state.suppliers);
  const movements = useProveedoresStore((state) => state.movements);
  const loading = useProveedoresStore((state) => state.loading);
  const subscribeAll = useProveedoresStore((state) => state.subscribeAll);
  const registerCompra = useProveedoresStore((state) => state.registerCompra);
  const registerPago = useProveedoresStore((state) => state.registerPago);
  const registerAjuste = useProveedoresStore((state) => state.registerAjuste);
  const annulMovement = useProveedoresStore((state) => state.annulMovement);
  const saveSupplier = useProveedoresStore((state) => state.saveSupplier);
  const toggleSupplierStatus = useProveedoresStore((state) => state.toggleSupplierStatus);

  useEffect(() => {
    const unsubscribe = subscribeAll();
    return () => unsubscribe();
  }, [subscribeAll]);

  const getImpact = useCallback((mov: SupplierMovement): number => {
    if (mov.type === 'COMPRA') return mov.amount; // suma deuda
    if (mov.type === 'PAGO') return -mov.amount; // resta deuda
    if (mov.type === 'AJUSTE') return mov.amount; // +/- según ajuste
    if (mov.type === 'ANULACION') return mov.amount;
    return 0;
  }, []);

  // REGLA V2: Proveedores NO tienen saldo almacenado. Todo saldo se deriva en runtime.
  const getCalculatedBalance = useCallback((supplierId: string) => {
    const suppMovs = movements.filter(m => m.supplierId === supplierId);
    return suppMovs.reduce((acc, mov) => acc + getImpact(mov), 0);
  }, [movements, getImpact]);

  return {
    suppliers,
    movements,
    loading,
    registerCompra,
    registerPago,
    registerAjuste,
    annulMovement,
    getCalculatedBalance,
    saveSupplier,
    toggleSupplierStatus
  };
}
