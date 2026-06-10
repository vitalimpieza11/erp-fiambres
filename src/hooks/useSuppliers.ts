import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, updateDoc, deleteDoc, writeBatch, increment, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseMapper } from '../mappers/databaseMapper';
import type { Supplier } from '../types/database';

export const useSuppliers = () => {
  const { currentUser } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'suppliers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Supplier[] = [];
        snapshot.forEach((doc) => {
          list.push(DatabaseMapper.toDomainSupplier(doc.data(), doc.id));
        });
        setSuppliers(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setSuppliers([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const saveSupplier = async (supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => {
    if (id) {
      const ref = doc(db, 'suppliers', id);
      await updateDoc(ref, { ...supplier, updatedAt: Date.now() } as any);
    } else {
      const ref = doc(collection(db, 'suppliers'));
      await setDoc(ref, { ...supplier, createdAt: Date.now(), updatedAt: Date.now() } as any);
    }
  };

  const deleteSupplier = async (id: string) => {
    const ref = doc(db, 'suppliers', id);
    await deleteDoc(ref);
  };

  const registerPayment = async (supplierId: string, amount: number, method: string, date: number, reference: string, partnerId?: string) => {
    const batch = writeBatch(db);
    
    if (method === 'aporte_socio') {
      const partnerTxRef = doc(collection(db, 'partner_transactions'));
      batch.set(partnerTxRef, {
        partnerId: partnerId || '',
        date: date,
        amount: amount,
        type: 'APORTE',
        method: 'COMPENSACION',
        referenceId: supplierId,
        description: `Pago directo a Proveedor (Ref: ${reference})`,
        createdAt: Date.now()
      });
    } else {
      const cashMovRef = doc(collection(db, 'cash_movements'));
      batch.set(cashMovRef, {
        type: 'out',
        amount: amount,
        method: method,
        description: `Pago a Proveedor (Ref: ${reference})`,
        category: 'supplier_payment',
        referenceId: supplierId,
        supplierId: supplierId,
        date: date,
        createdAt: Date.now()
      });
    }

    const supplierRef = doc(db, 'suppliers', supplierId);
    batch.update(supplierRef, {
      currentBalance: increment(-amount)
    });

    const purchasesSnap = await getDocs(query(collection(db, 'purchases'), where('supplierId', '==', supplierId), where('pendingBalance', '>', 0), orderBy('date', 'asc')));
    let remainingToApply = amount;
    purchasesSnap.forEach(pDoc => {
      if (remainingToApply > 0) {
        const pData = pDoc.data();
        const pBalance = pData.pendingBalance || 0;
        const toApply = Math.min(pBalance, remainingToApply);
        const newBalance = pBalance - toApply;
        const newPaid = (pData.amountPaid || 0) + toApply;
        let newStatus = pData.paymentStatus || 'PENDIENTE';
        if (newBalance <= 0) {
          newStatus = 'PAGADA';
        } else if (toApply > 0) {
          newStatus = 'PARCIAL';
        }
        
        batch.update(pDoc.ref, {
          pendingBalance: newBalance,
          amountPaid: newPaid,
          status: newStatus
        });
        remainingToApply -= toApply;
      }
    });

    await batch.commit();
  };

  return { suppliers, loading, error, saveSupplier, deleteSupplier, registerPayment };
};
