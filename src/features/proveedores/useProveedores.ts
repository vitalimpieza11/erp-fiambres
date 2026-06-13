import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc, getDoc, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Supplier, SupplierMovement, CajaMovement } from '../../types/domain';

export function useProveedores() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<SupplierMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchar proveedores
    const qSuppliers = query(COLLECTIONS.SUPPLIERS);
    const unsubSuppliers = onSnapshot(qSuppliers, (snap) => {
      const suppData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier));
      setSuppliers(suppData);
    });

    // Escuchar movimientos
    const qMovements = query(
      COLLECTIONS.SUPPLIER_MOVEMENTS,
      where('isDeleted', '==', false),
      orderBy('date', 'desc'),
      limit(100)
    );
    const unsubMovements = onSnapshot(qMovements, (snap) => {
      const movData = snap.docs.map(d => d.data() as SupplierMovement);
      // Ordenar descendente
      setMovements(movData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoading(false);
    });

    return () => {
      unsubSuppliers();
      unsubMovements();
    };
  }, []);

  const addMovement = async (mov: Omit<SupplierMovement, 'id' | 'isDeleted' | 'deletedAt'>) => {
    const docRef = doc(COLLECTIONS.SUPPLIER_MOVEMENTS);
    const newMovement: SupplierMovement = {
      ...mov,
      id: docRef.id,
      isDeleted: false
    };
    await setDoc(docRef, newMovement);
    return newMovement;
  };

  const registerCompra = async (supplierId: string, amount: number, date: string, sourceId: string, observaciones: string) => {
    // COMPRA genera deuda, así que lo guardamos como positivo (o indicando el tipo)
    await addMovement({
      supplierId,
      date,
      type: 'COMPRA',
      amount,
      observaciones,
      sourceType: 'COMPRA',
      sourceId: sourceId || `compra_${Date.now()}`,
      reversalOf: null
    });
  };

  const registerPago = async (supplierId: string, amount: number, date: string, sourceId: string, observaciones: string, fromCaja: boolean) => {
    // PAGO cancela deuda
    const paymentMov = await addMovement({
      supplierId,
      date,
      type: 'PAGO',
      amount,
      observaciones,
      sourceType: 'PAGO',
      sourceId: sourceId || `pago_${Date.now()}`,
      reversalOf: null
    });

    if (fromCaja) {
      // Generar egreso en caja
      const cajaDocRef = doc(COLLECTIONS.CAJA_MOVEMENTS);
      const cajaMov: CajaMovement = {
        id: cajaDocRef.id,
        type: 'EXPENSE',
        amount,
        date,
        category: 'PAGO_PROVEEDOR',
        description: `Pago a proveedor (Ref: ${paymentMov.id}). Obs: ${observaciones}`,
        sourceId: paymentMov.id,
        sourceType: 'PAGO',
        reversalOf: null,
        isDeleted: false
      };
      await setDoc(cajaDocRef, cajaMov);
    }
  };

  const getImpact = (mov: SupplierMovement): number => {
    if (mov.type === 'COMPRA') return mov.amount; // suma deuda
    if (mov.type === 'PAGO') return -mov.amount; // resta deuda
    if (mov.type === 'AJUSTE') return mov.amount; // +/- según ajuste
    if (mov.type === 'ANULACION') return mov.amount; // en la anulación guardaremos el impacto directo
    return 0;
  };

  const registerAjuste = async (supplierId: string, amount: number, date: string, observaciones: string) => {
    await addMovement({
      supplierId,
      date,
      type: 'AJUSTE',
      amount,
      observaciones,
      sourceType: 'AJUSTE',
      sourceId: `ajuste_${Date.now()}`,
      reversalOf: null
    });
  };

  const annulMovement = async (movementId: string, reason: string) => {
    const original = movements.find(m => m.id === movementId);
    if (!original) throw new Error("Movimiento no encontrado");

    // REGLA V2: No se borran registros, siempre compensamos con un nuevo movimiento.
    // Calculamos el impacto del original
    const originalImpact = getImpact(original);
    // El impacto compensatorio es el inverso
    const compAmount = -originalImpact;

    // Generamos anulación en la cuenta corriente del proveedor
    await addMovement({
      supplierId: original.supplierId,
      date: new Date().toISOString(),
      type: 'ANULACION',
      amount: compAmount,
      observaciones: `Anulación de ${original.type} (${movementId}). Motivo: ${reason}`,
      sourceType: `REVERSAL_${original.type}`,
      sourceId: original.id,
      reversalOf: original.id
    });

    // Si el movimiento impactó caja, debemos generar compensatorio en caja_movements
    if (original.type === 'PAGO') {
      const qCaja = query(COLLECTIONS.CAJA_MOVEMENTS, where('sourceId', '==', original.id), where('isDeleted', '==', false));
      const cajaSnaps = await getDocs(qCaja);
      if (!cajaSnaps.empty) {
        cajaSnaps.forEach(async (cajaDocSnap) => {
          const cajaMov = cajaDocSnap.data() as CajaMovement;
          
          let reasonTypeStr = 'REVERSAL_OTRO';
          if (original.type === 'COMPRA') reasonTypeStr = 'REVERSAL_COMPRA';
          if (original.type === 'PAGO') reasonTypeStr = 'REVERSAL_PAGO_PROVEEDOR';

          // REGLA V2: La caja es inmutable (append-only). Generamos NUEVO movimiento compensatorio.
          const compCajaDocRef = doc(COLLECTIONS.CAJA_MOVEMENTS);
          const compCajaMov: CajaMovement = {
            id: compCajaDocRef.id,
            type: cajaMov.type === 'EXPENSE' ? 'INCOME' : 'EXPENSE',
            amount: cajaMov.amount,
            date: new Date().toISOString(),
            category: 'ANULACION_PAGO_PROVEEDOR',
            description: `Reverso compensatorio por anulación de pago a proveedor (Ref: ${original.id}). Motivo: ${reason}`,
            reasonType: reasonTypeStr,
            sourceId: cajaMov.id,
            sourceType: `REVERSAL_${original.type}`,
            reversalOf: cajaMov.id,
            isDeleted: false
          };
          await setDoc(compCajaDocRef, compCajaMov);
        });
      }
    }
  };

  // REGLA V2: Proveedores NO tienen saldo almacenado. Todo saldo se deriva en runtime.
  const getCalculatedBalance = (supplierId: string) => {
    const suppMovs = movements.filter(m => m.supplierId === supplierId);
    return suppMovs.reduce((acc, mov) => acc + getImpact(mov), 0);
  };

  return {
    suppliers,
    movements,
    loading,
    registerCompra,
    registerPago,
    registerAjuste,
    annulMovement,
    getCalculatedBalance
  };
}
