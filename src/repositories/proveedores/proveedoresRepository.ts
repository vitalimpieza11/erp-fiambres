import { collection, onSnapshot, query, where, doc, setDoc, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Supplier, SupplierMovement, CajaMovement } from '../../types/domain';

export const proveedoresRepository = {
  subscribeSuppliers(onData: (suppliers: Supplier[]) => void): () => void {
    const qSuppliers = query(COLLECTIONS.SUPPLIERS);
    return onSnapshot(qSuppliers, (snap) => {
      const suppData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier));
      onData(suppData);
    });
  },

  subscribeMovements(onData: (movements: SupplierMovement[]) => void): () => void {
    const qMovements = query(
      COLLECTIONS.SUPPLIER_MOVEMENTS,
      where('isDeleted', '==', false),
      orderBy('date', 'desc'),
      limit(100)
    );
    return onSnapshot(qMovements, (snap) => {
      const movData = snap.docs.map(d => d.data() as SupplierMovement);
      onData(movData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });
  },

  async addMovement(mov: Omit<SupplierMovement, 'id' | 'isDeleted' | 'deletedAt'>): Promise<SupplierMovement> {
    const docRef = doc(COLLECTIONS.SUPPLIER_MOVEMENTS);
    const newMovement: SupplierMovement = {
      ...mov,
      id: docRef.id,
      isDeleted: false
    };
    await setDoc(docRef, newMovement);
    return newMovement;
  },

  async registerCompra(supplierId: string, amount: number, date: string, sourceId: string, observaciones: string): Promise<void> {
    await this.addMovement({
      supplierId,
      date,
      type: 'COMPRA',
      amount,
      observaciones,
      sourceType: 'COMPRA',
      sourceId: sourceId || `compra_${Date.now()}`,
      reversalOf: null
    });
  },

  async registerPago(supplierId: string, amount: number, date: string, sourceId: string, observaciones: string, fromCaja: boolean, accountId?: string): Promise<void> {
    const paymentMov = await this.addMovement({
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
        accountId,
        isDeleted: false
      };
      await setDoc(cajaDocRef, cajaMov);
    }
  },

  async registerAjuste(supplierId: string, amount: number, date: string, observaciones: string): Promise<void> {
    await this.addMovement({
      supplierId,
      date,
      type: 'AJUSTE',
      amount,
      observaciones,
      sourceType: 'AJUSTE',
      sourceId: `ajuste_${Date.now()}`,
      reversalOf: null
    });
  },

  async annulMovement(movementId: string, reason: string, original: SupplierMovement): Promise<void> {
    // REGLA V2: No se borran registros, siempre compensamos con un nuevo movimiento.
    // Calculamos el impacto del original
    const getImpact = (mov: SupplierMovement): number => {
      if (mov.type === 'COMPRA') return mov.amount; // suma deuda
      if (mov.type === 'PAGO') return -mov.amount; // resta deuda
      if (mov.type === 'AJUSTE') return mov.amount; // +/- según ajuste
      if (mov.type === 'ANULACION') return mov.amount;
      return 0;
    };
    const originalImpact = getImpact(original);
    const compAmount = -originalImpact;

    // Generamos anulación en la cuenta corriente del proveedor
    await this.addMovement({
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
            accountId: cajaMov.accountId,
            isDeleted: false
          };
          await setDoc(compCajaDocRef, compCajaMov);
        });
      }
    }
  },

  async saveSupplier(supplier: Partial<Supplier>): Promise<void> {
    const dataToSave = {
      ...supplier,
      activo: supplier.activo !== false,
      updatedAt: Date.now()
    };

    if (supplier.id) {
      const docRef = doc(db, 'suppliers', supplier.id);
      await setDoc(docRef, dataToSave, { merge: true });
    } else {
      const docRef = doc(collection(db, 'suppliers'));
      await setDoc(docRef, { ...dataToSave, id: docRef.id, createdAt: Date.now() });
    }
  },

  async toggleSupplierStatus(id: string, currentStatus: boolean): Promise<void> {
    const docRef = doc(db, 'suppliers', id);
    await setDoc(docRef, { activo: !currentStatus, updatedAt: Date.now() }, { merge: true });
  }
};
