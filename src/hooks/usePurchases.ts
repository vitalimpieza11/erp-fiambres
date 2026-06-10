import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, writeBatch, deleteDoc, updateDoc, where, getDocs, limit, increment } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseMapper } from '../mappers/databaseMapper';
import type { Purchase } from '../types/database';

export const usePurchases = () => {
  const { currentUser } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Purchase[] = [];
        snapshot.forEach((doc) => {
          list.push(DatabaseMapper.toDomainPurchase(doc.data(), doc.id));
        });
        setPurchases(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setPurchases([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const createPurchase = async (
    purchaseData: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    const currentUserId = currentUser?.uid || 'anonymous';
    const batch = writeBatch(db);
    const purchaseRef = doc(collection(db, 'purchases'));
    const purchaseId = purchaseRef.id;

    const payments = purchaseData.payments || [];
    const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
    const total = purchaseData.total || 0;
    const pendingBalance = total - totalPaid;
    let status = 'PENDIENTE';
    if (pendingBalance <= 0) {
      status = 'PAGADA';
    } else if (totalPaid > 0) {
      status = 'PARCIAL';
    }

    const newPurchase = {
      ...purchaseData,
      id: purchaseId,
      status,
      amountPaid: totalPaid,
      pendingBalance,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId: currentUserId
    };
    batch.set(purchaseRef, newPurchase);

    // Stock Movements
    for (const item of purchaseData.items) {
      const stockMovRef = doc(collection(db, 'stock_movements'));
      const movement = {
        productId: item.productId,
        productName: item.productName,
        quantity: Math.abs(Number(item.quantity)),
        type: 'in',
        referenceType: 'purchase',
        referenceId: purchaseId,
        date: Date.now(),
        observations: `Compra Factura: ${purchaseData.invoiceNumber || 'Sin número'} (Client Local API)`,
        createdAt: Date.now()
      };
      batch.set(stockMovRef, movement);

      // Update correct collection based on item type
      if (item.itemType === 'raw_material') {
        const prodRef = doc(db, 'mercaderias', item.productId);
        batch.update(prodRef, { costoKg: Number(item.cost), updatedAt: Date.now() });
      } else if (item.itemType === 'insumo') {
        const prodRef = doc(db, 'insumos', item.productId);
        batch.update(prodRef, { costoUnitario: Number(item.cost), updatedAt: Date.now() });
      }
    }

    // Cash movements for each payment
    for (const payment of payments) {
      if (payment.amount > 0) {
        if (payment.method === 'aporte_socio') {
          // Aporte DIRECTO para compra. No impacta en caja real de la empresa.
          // Solo creamos un PartnerTransaction de tipo APORTE, método COMPENSACION
          const partnerTxRef = doc(collection(db, 'partner_transactions'));
          batch.set(partnerTxRef, {
            partnerId: payment.partnerId || '',
            date: purchaseData.date || Date.now(),
            amount: Number(payment.amount),
            type: 'APORTE',
            method: 'COMPENSACION',
            referenceId: purchaseId,
            description: `Pago directo de Compra a Proveedor ${purchaseData.supplierName}`,
            createdAt: Date.now()
          });
          // NO se genera cash_movement de ingreso ni de egreso porque no tocó la caja de la empresa.
        } else {
          // Normal Payment (OUT)
          const isCash = payment.method === 'caja' || payment.method === 'cash';
          const methodString = isCash ? 'cash' : 'transfer';
          const accountId = isCash ? 'cash_default' : 'bank_default';

          const cashMovRef = doc(collection(db, 'cash_movements'));
          batch.set(cashMovRef, {
            type: 'out',
            amount: Number(payment.amount),
            method: methodString,
            accountId: accountId,
            description: `Pago Compra Proveedor ${purchaseData.supplierName} (Ref: ${purchaseData.invoiceNumber || purchaseId})`,
            category: 'purchase',
            referenceId: purchaseId,
            supplierId: purchaseData.supplierId,
            date: purchaseData.date || Date.now(),
            createdAt: Date.now()
          });
        }
      }
    }

    // Update Supplier Balance ONLY for the pending part
    if (pendingBalance > 0) {
      const supplierRef = doc(db, 'suppliers', purchaseData.supplierId);
      batch.update(supplierRef, {
        currentBalance: increment(pendingBalance)
      });
    }

    await batch.commit();
    return purchaseId;
  };

  const updatePurchase = async (id: string, data: Partial<Purchase>) => {
    const oldPurchase = purchases.find(p => p.id === id);
    if (!oldPurchase) throw new Error('Compra no encontrada');

    const batch = writeBatch(db);
    const ref = doc(db, 'purchases', id);
    batch.update(ref, { ...data, updatedAt: Date.now() });

    // Revert old stock movements
    const stockSnap = await getDocs(query(collection(db, 'stock_movements'), where('referenceId', '==', id)));
    stockSnap.forEach(d => batch.delete(d.ref));

    // Revert old cash movements
    const cashSnap = await getDocs(query(collection(db, 'cash_movements'), where('referenceId', '==', id)));
    cashSnap.forEach(d => batch.delete(d.ref));

    const partnerTxSnap = await getDocs(query(collection(db, 'partner_transactions'), where('referenceId', '==', id)));
    partnerTxSnap.forEach(d => batch.delete(d.ref));

    // Revert old supplier balance (we only generated debt for pendingBalance)
    if (oldPurchase.pendingBalance && oldPurchase.pendingBalance > 0) {
      const supplierRef = doc(db, 'suppliers', oldPurchase.supplierId);
      batch.update(supplierRef, {
        currentBalance: increment(-oldPurchase.pendingBalance)
      });
    }

    // Generate NEW stock movements and update costs if items changed
    const itemsToProcess = data.items || oldPurchase.items;
    const statusToProcess = data.status !== undefined ? data.status : oldPurchase.status;
    const totalToProcess = data.total !== undefined ? data.total : oldPurchase.total;
    const invoiceToProcess = data.invoiceNumber !== undefined ? data.invoiceNumber : oldPurchase.invoiceNumber;
    const supplierToProcess = data.supplierName !== undefined ? data.supplierName : oldPurchase.supplierName;

    for (const item of itemsToProcess) {
      const stockMovRef = doc(collection(db, 'stock_movements'));
      const movement = {
        productId: item.productId,
        productName: item.productName,
        quantity: Math.abs(Number(item.quantity)),
        type: 'in',
        referenceType: 'purchase',
        referenceId: id,
        date: Date.now(),
        observations: `Compra Factura: ${invoiceToProcess || 'Sin número'} (Editada)`,
        createdAt: Date.now()
      };
      batch.set(stockMovRef, movement);

      if (data.items) { // only update costs if items were modified
        if (item.itemType === 'raw_material') {
          const prodRef = doc(db, 'mercaderias', item.productId);
          batch.update(prodRef, { costoKg: Number(item.cost), updatedAt: Date.now() });
        } else if (item.itemType === 'insumo') {
          const prodRef = doc(db, 'insumos', item.productId);
          batch.update(prodRef, { costoUnitario: Number(item.cost), updatedAt: Date.now() });
        }
      }
    }

    // Generate NEW cash movements
    const payments = data.payments !== undefined ? data.payments : (oldPurchase.payments || []);
    const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
    const pendingBalance = totalToProcess - totalPaid;
    let newStatus = 'PENDIENTE';
    if (pendingBalance <= 0) {
      newStatus = 'PAGADA';
    } else if (totalPaid > 0) {
      newStatus = 'PARCIAL';
    }
    
    // Update purchase document with computed fields
    batch.update(ref, {
      status: newStatus,
      amountPaid: totalPaid,
      pendingBalance: pendingBalance
    });

    for (const payment of payments) {
      if (payment.amount > 0) {
        if (payment.method === 'aporte_socio') {
          const partnerTxRef = doc(collection(db, 'partner_transactions'));
          batch.set(partnerTxRef, {
            partnerId: payment.partnerId || '',
            date: data.date || oldPurchase.date,
            amount: Number(payment.amount),
            type: 'APORTE',
            method: 'COMPENSACION',
            referenceId: id,
            description: `Pago directo de Compra a Proveedor ${supplierToProcess} (Editada)`,
            createdAt: Date.now()
          });
        } else {
          const isCash = payment.method === 'caja' || payment.method === 'cash';
          const methodString = isCash ? 'cash' : 'transfer';
          const accountId = isCash ? 'cash_default' : 'bank_default';

          const cashMovRef = doc(collection(db, 'cash_movements'));
          batch.set(cashMovRef, {
            type: 'out',
            amount: Number(payment.amount),
            method: methodString,
            accountId: accountId,
            description: `Pago Compra Proveedor ${supplierToProcess} (Ref: ${invoiceToProcess || id}) (Editada)`,
            category: 'purchase',
            referenceId: id,
            supplierId: data.supplierId || oldPurchase.supplierId,
            date: data.date || oldPurchase.date,
            createdAt: Date.now()
          });
        }
      }
    }

    // Update NEW supplier balance
    const targetSupplierId = data.supplierId || oldPurchase.supplierId;
    if (pendingBalance > 0) {
      const supplierRef = doc(db, 'suppliers', targetSupplierId);
      batch.update(supplierRef, {
        currentBalance: increment(pendingBalance)
      });
    }

    await batch.commit();
  };

  const deletePurchase = async (id: string) => {
    const target = purchases.find(p => p.id === id);
    if (!target) throw new Error('Compra no encontrada');

    const batch = writeBatch(db);
    const ref = doc(db, 'purchases', id);
    batch.delete(ref);

    // Delete associated movements
    const stockSnap = await getDocs(query(collection(db, 'stock_movements'), where('referenceId', '==', id)));
    stockSnap.forEach(d => batch.delete(d.ref));

    const cashSnap = await getDocs(query(collection(db, 'cash_movements'), where('referenceId', '==', id)));
    cashSnap.forEach(d => batch.delete(d.ref));

    const partnerTxSnap = await getDocs(query(collection(db, 'partner_transactions'), where('referenceId', '==', id)));
    partnerTxSnap.forEach(d => batch.delete(d.ref));

    // Revert supplier balance
    if (target.pendingBalance && target.pendingBalance > 0) {
      const supplierRef = doc(db, 'suppliers', target.supplierId);
      batch.update(supplierRef, {
        currentBalance: increment(-target.pendingBalance)
      });
    }

    // Revert costs to last known purchase (best effort)
    for (const item of target.items) {
      const prevPurchases = await getDocs(query(
        collection(db, 'purchases'),
        orderBy('createdAt', 'desc'),
        limit(5)
      ));
      
      let lastCost = 0;
      prevPurchases.forEach(d => {
        if (d.id !== id && lastCost === 0) {
          const pData = d.data();
          const foundItem = pData.items?.find((i: any) => i.productId === item.productId);
          if (foundItem) {
            lastCost = Number(foundItem.cost);
          }
        }
      });

      if (item.itemType === 'raw_material') {
        const prodRef = doc(db, 'mercaderias', item.productId);
        batch.update(prodRef, { costoKg: lastCost, updatedAt: Date.now() });
      } else if (item.itemType === 'insumo') {
        const prodRef = doc(db, 'insumos', item.productId);
        batch.update(prodRef, { costoUnitario: lastCost, updatedAt: Date.now() });
      }
    }

    await batch.commit();
  };

  return { purchases, loading, error, createPurchase, updatePurchase, deletePurchase };
};
export default usePurchases;
