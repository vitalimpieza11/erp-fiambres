import { collection, onSnapshot, query, where, doc, setDoc, orderBy, limit } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Purchase, StockMovement, CajaMovement, SupplierMovement } from '../../types/domain';

export const purchasesRepository = {
  subscribePurchases(onData: (purchases: Purchase[]) => void): () => void {
    const qPurchases = query(
      COLLECTIONS.PURCHASES,
      where('isDeleted', '==', false),
      orderBy('date', 'desc'),
      limit(50)
    );
    const unsubPurchases = onSnapshot(qPurchases, (snap) => {
      const data: Purchase[] = [];
      snap.forEach((d) => {
        data.push(d.data() as Purchase);
      });
      onData(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });
    return unsubPurchases;
  },

  async addPurchase(purchaseData: Omit<Purchase, 'id' | 'isDeleted'>): Promise<void> {
    const purchaseRef = doc(COLLECTIONS.PURCHASES);
    const newPurchase: Purchase = {
      ...purchaseData,
      id: purchaseRef.id,
      type: 'PURCHASE',
      status: 'ACTIVE',
      isDeleted: false
    };

    // 1. Guardar compra (Append-only)
    await setDoc(purchaseRef, newPurchase);

    // 2. Impactar STOCK V2 (Append-only, no modificar producto directamente)
    for (const item of newPurchase.items) {
      const stockMovRef = doc(COLLECTIONS.STOCK_MOVEMENTS);
      const stockMov: StockMovement = {
        id: stockMovRef.id,
        productId: item.productId,
        qty: item.quantity,
        type: 'COMPRA',
        date: newPurchase.date,
        referenceId: newPurchase.id,
        observaciones: 'Compra a proveedor',
        isDeleted: false
      };
      await setDoc(stockMovRef, stockMov);
    }

    // 3. Impactar CAJA V2 si hubo pago
    if (newPurchase.montoPagado > 0) {
      const cajaMovRef = doc(COLLECTIONS.CAJA_MOVEMENTS);
      const cajaMov: CajaMovement = {
        id: cajaMovRef.id,
        type: 'EXPENSE',
        amount: newPurchase.montoPagado,
        date: newPurchase.date,
        category: 'COMPRA_PROVEEDOR',
        description: `Pago por compra (Ref: ${newPurchase.id})`,
        sourceId: newPurchase.id,
        sourceType: 'COMPRA',
        reasonType: 'COMPRA_PROVEEDOR',
        operation: 'MOVEMENT',
        reversalOf: null,
        isDeleted: false
      };
      await setDoc(cajaMovRef, cajaMov);
    }

    // 4. Impactar PROVEEDORES V2 si hay cuenta corriente
    if (newPurchase.montoCuentaCorriente > 0) {
      const suppMovRef = doc(COLLECTIONS.SUPPLIER_MOVEMENTS);
      const suppMov: SupplierMovement = {
        id: suppMovRef.id,
        supplierId: newPurchase.supplierId,
        date: newPurchase.date,
        type: 'COMPRA',
        amount: newPurchase.montoCuentaCorriente, // incrementa deuda
        observaciones: `Deuda por compra (Ref: ${newPurchase.id})`,
        sourceType: 'COMPRA',
        sourceId: newPurchase.id,
        reversalOf: null,
        isDeleted: false
      };
      await setDoc(suppMovRef, suppMov);
    }
  },

  async annulPurchase(purchaseId: string, reason: string, original: Purchase): Promise<void> {
    // REGLA V2 OBLIGATORIA: Nunca borrar compras ni editar el evento original.
    // La anulación es un NUEVO EVENTO COMPENSATORIO. El evento original permanece intacto.
    const compPurchaseRef = doc(COLLECTIONS.PURCHASES);
    const compensatoryPurchase: Purchase = {
      ...original,
      id: compPurchaseRef.id,
      date: new Date().toISOString(),
      type: 'PURCHASE_REVERSAL',
      status: 'ACTIVE',
      reversalOf: original.id,
      isDeleted: false
    };
    await setDoc(compPurchaseRef, compensatoryPurchase);

    // 1. Revertir STOCK
    for (const item of original.items) {
      const stockMovRef = doc(COLLECTIONS.STOCK_MOVEMENTS);
      const stockMov: StockMovement = {
        id: stockMovRef.id,
        productId: item.productId,
        qty: -item.quantity, // egreso
        type: 'AJUSTE', // o REVERSAL
        date: new Date().toISOString(),
        referenceId: original.id,
        observaciones: `Anulación de compra: ${reason}`,
        isDeleted: false
      };
      await setDoc(stockMovRef, stockMov);
    }

    // 2. Revertir CAJA V2 si hubo pago
    if (original.montoPagado > 0) {
      const cajaMovRef = doc(COLLECTIONS.CAJA_MOVEMENTS);
      const cajaMov: CajaMovement = {
        id: cajaMovRef.id,
        type: 'INCOME', // reverso de EXPENSE
        amount: original.montoPagado,
        date: new Date().toISOString(),
        category: 'ANULACION_COMPRA',
        description: `Reverso por anulación de compra (Ref: ${original.id}). Motivo: ${reason}`,
        sourceId: original.id,
        sourceType: 'REVERSAL_COMPRA',
        reasonType: 'REVERSAL_COMPRA_PROVEEDOR',
        operation: 'REVERSAL',
        reversalOf: original.id,
        isDeleted: false
      };
      await setDoc(cajaMovRef, cajaMov);
    }

    // 3. Revertir PROVEEDORES V2
    if (original.montoCuentaCorriente > 0) {
      const suppMovRef = doc(COLLECTIONS.SUPPLIER_MOVEMENTS);
      const suppMov: SupplierMovement = {
        id: suppMovRef.id,
        supplierId: original.supplierId,
        date: new Date().toISOString(),
        type: 'ANULACION',
        amount: -original.montoCuentaCorriente, // anula la deuda
        observaciones: `Anulación de compra (Ref: ${original.id}). Motivo: ${reason}`,
        sourceType: 'REVERSAL_COMPRA',
        sourceId: original.id,
        reversalOf: original.id,
        isDeleted: false
      };
      await setDoc(suppMovRef, suppMov);
    }
  }
};
