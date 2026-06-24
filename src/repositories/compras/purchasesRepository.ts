import { collection, onSnapshot, query, where, doc, setDoc, updateDoc, getDocs, orderBy, limit, runTransaction } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Purchase, StockMovement, CajaMovement, SupplierMovement } from '../../types/domain';
import { truncateDecimals } from '../../lib/formatters';

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

  async addPurchase(purchaseData: Omit<Purchase, 'id' | 'isDeleted'> & { accountId?: string }): Promise<void> {
    const purchaseRef = doc(COLLECTIONS.PURCHASES);
    const sanitizedItems = purchaseData.items.map(item => ({
      ...item,
      quantity: Number(item.quantity) || 0,
      unitCost: Number(item.unitCost) || 0,
      totalCost: Number(item.totalCost) || 0,
    }));

    const newPurchase: Purchase & { accountId?: string } = {
      ...purchaseData,
      id: purchaseRef.id,
      type: 'PURCHASE',
      status: 'ACTIVE',
      isDeleted: false,
      items: sanitizedItems,
      subtotal: Number(purchaseData.subtotal) || 0,
      impuestos: purchaseData.impuestos !== null && purchaseData.impuestos !== undefined ? Number(purchaseData.impuestos) || 0 : null,
      total: Number(purchaseData.total) || 0,
      montoPagado: Number(purchaseData.montoPagado) || 0,
      montoCuentaCorriente: Number(purchaseData.montoCuentaCorriente) || 0,
    };

    await runTransaction(db, async (transaction) => {
      // 1. LEER TODOS LOS PRODUCTOS PRIMERO (Requisito de runTransaction)
      const productRefs = newPurchase.items.map(item => doc(db, 'products', item.productId));
      const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));
      
      const currentStocks: Record<string, number> = {};
      productDocs.forEach((pDoc) => {
        if (pDoc.exists()) {
          currentStocks[pDoc.id] = Number(pDoc.data().stockActual) || 0;
        } else {
          currentStocks[pDoc.id] = 0;
        }
      });

      // 2. GUARDAR COMPRA
      transaction.set(purchaseRef, newPurchase);

      // 3. IMPACTAR STOCK V2 y ACTUALIZAR PRODUCTOS V1
      for (const item of newPurchase.items) {
        const stockMovRef = doc(COLLECTIONS.STOCK_MOVEMENTS);
        const qty = truncateDecimals(item.quantity, 3);
        const stockMov: StockMovement = {
          id: stockMovRef.id,
          productId: item.productId,
          qty: qty,
          type: 'COMPRA',
          date: newPurchase.date,
          referenceId: newPurchase.id,
          observaciones: 'Compra a proveedor',
          isDeleted: false
        };
        transaction.set(stockMovRef, stockMov);

        // Actualizar stockActual y costos del producto (Fijar consistencia)
        const prodRef = doc(db, 'products', item.productId);
        const newStock = truncateDecimals(currentStocks[item.productId] + qty, 3);
        
        transaction.update(prodRef, {
          stockActual: newStock,
          costoActual: Number(item.unitCost) || 0,
          costoUltimaCompra: Number(item.unitCost) || 0,
          fechaUltimaCompra: newPurchase.date
        });
      }

      // 4. IMPACTAR CAJA V2 SI HUBO PAGOS
      if (newPurchase.paymentMethod === 'MULTIPLES' && newPurchase.payments && newPurchase.payments.length > 0) {
        for (const pay of newPurchase.payments) {
          if (pay.amount > 0) {
            const cajaMovRef = doc(COLLECTIONS.CAJA_MOVEMENTS);
            const cajaMov: CajaMovement = {
              id: cajaMovRef.id,
              type: 'EXPENSE',
              amount: pay.amount,
              date: newPurchase.date,
              category: 'COMPRA_PROVEEDOR',
              description: `Pago por compra (Ref: ${newPurchase.id})`,
              sourceId: newPurchase.id,
              sourceType: 'COMPRA',
              reasonType: 'COMPRA_PROVEEDOR',
              operation: 'MOVEMENT',
              reversalOf: null,
              accountId: pay.accountId,
              isDeleted: false
            };
            transaction.set(cajaMovRef, cajaMov);
          }
        }
      } else if (newPurchase.montoPagado > 0) {
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
          accountId: purchaseData.accountId,
          isDeleted: false
        };
        transaction.set(cajaMovRef, cajaMov);
      }

      // 5. IMPACTAR PROVEEDORES V2
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
        transaction.set(suppMovRef, suppMov);
      }
    });
  },

  async annulPurchase(purchaseId: string, reason: string, original: Purchase): Promise<void> {
    // REGLA: Consultas (queries) no pueden estar dentro de runTransaction. Las hacemos antes.
    const cajaSnap = await getDocs(query(
      COLLECTIONS.CAJA_MOVEMENTS,
      where('sourceId', '==', original.id),
      where('sourceType', '==', 'COMPRA'),
      where('type', '==', 'EXPENSE'),
      where('isDeleted', '==', false)
    ));

    await runTransaction(db, async (transaction) => {
      // 1. LEER TODOS LOS PRODUCTOS PRIMERO
      const productRefs = original.items.map(item => doc(db, 'products', item.productId));
      const productDocs = await Promise.all(productRefs.map(ref => transaction.get(ref)));
      
      const currentStocks: Record<string, number> = {};
      productDocs.forEach((pDoc) => {
        if (pDoc.exists()) {
          currentStocks[pDoc.id] = Number(pDoc.data().stockActual) || 0;
        } else {
          currentStocks[pDoc.id] = 0;
        }
      });

      // 2. CREAR COMPRA COMPENSATORIA
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
      transaction.set(compPurchaseRef, compensatoryPurchase);

      // 3. REVERTIR STOCK V2 Y ACTUALIZAR PRODUCTOS V1
      for (const item of original.items) {
        const stockMovRef = doc(COLLECTIONS.STOCK_MOVEMENTS);
        const qty = truncateDecimals(item.quantity, 3);
        const stockMov: StockMovement = {
          id: stockMovRef.id,
          productId: item.productId,
          qty: -qty, // egreso
          type: 'AJUSTE', // o REVERSAL
          date: new Date().toISOString(),
          referenceId: original.id,
          observaciones: `Anulación de compra: ${reason}`,
          isDeleted: false
        };
        transaction.set(stockMovRef, stockMov);

        // Revertir stockActual
        const prodRef = doc(db, 'products', item.productId);
        const newStock = truncateDecimals(currentStocks[item.productId] - qty, 3);
        
        transaction.update(prodRef, {
          stockActual: newStock
        });
      }

      // 4. REVERTIR CAJA V2
      for (const docSnap of cajaSnap.docs) {
        const origMov = docSnap.data() as CajaMovement;
        const cajaMovRef = doc(COLLECTIONS.CAJA_MOVEMENTS);
        const cajaMov: CajaMovement = {
          id: cajaMovRef.id,
          type: 'INCOME', // reverso de EXPENSE
          amount: origMov.amount,
          date: new Date().toISOString(),
          category: 'ANULACION_COMPRA',
          description: `Reverso por anulación de compra (Ref: ${original.id}). Motivo: ${reason}`,
          sourceId: original.id,
          sourceType: 'REVERSAL_COMPRA',
          reasonType: 'REVERSAL_COMPRA_PROVEEDOR',
          operation: 'REVERSAL',
          reversalOf: origMov.id,
          accountId: origMov.accountId,
          isDeleted: false
        };
        transaction.set(cajaMovRef, cajaMov);
      }

      // 5. REVERTIR PROVEEDORES V2
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
        transaction.set(suppMovRef, suppMov);
      }
    });
  }
};
