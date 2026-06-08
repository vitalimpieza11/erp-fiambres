import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, writeBatch, runTransaction, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { PaymentReceipt, Sale } from '../types/database';

export const useReceipts = () => {
  const { currentUser } = useAuth();
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'payment_receipts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: PaymentReceipt[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: doc.id,
            customerId: data.customerId,
            customerName: data.customerName,
            date: data.date,
            amount: Number(data.amount),
            method: data.method,
            appliedInvoices: data.appliedInvoices || [],
            unallocatedAmount: Number(data.unallocatedAmount) || 0,
            observations: data.observations || '',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          });
        });
        setReceipts(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setReceipts([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const createReceipt = async (
    receiptData: Omit<PaymentReceipt, 'id' | 'createdAt' | 'updatedAt' | 'appliedInvoices' | 'unallocatedAmount'>,
    selectedInvoices: { saleId: string; invoiceNumber: string; amountToApply: number }[]
  ): Promise<string> => {
    const batch = writeBatch(db);
    const ref = doc(collection(db, 'payment_receipts'));
    const receiptId = ref.id;

    let totalApplied = 0;
    const appliedInvoices = [];

    // 1. Process each selected invoice
    for (const inv of selectedInvoices) {
      if (inv.amountToApply <= 0) continue;
      
      const saleRef = doc(db, 'sales', inv.saleId);
      // We need to fetch the current sale to know the exact pending amount safely,
      // but we can also use a transaction. To keep it simpler, we will just use batch update, 
      // but in reality a transaction is safer.
      
      // We will do this inside a transaction to ensure no race conditions on saldoPendiente
    }

    // Since we need to read and write multiple sales, we use runTransaction
    await runTransaction(db, async (transaction) => {
      let currentTotalApplied = 0;
      const currentAppliedInvoices = [];
      const customerRef = doc(db, 'customers', receiptData.customerId);
      const custSnap = await transaction.get(customerRef);
      
      for (const inv of selectedInvoices) {
        if (inv.amountToApply <= 0) continue;
        const saleRef = doc(db, 'sales', inv.saleId);
        const saleSnap = await transaction.get(saleRef);
        
        if (!saleSnap.exists()) continue;
        const saleData = saleSnap.data() as any;
        const currentSaldo = saleData.saldoPendiente !== undefined ? Number(saleData.saldoPendiente) : Number(saleData.total);
        
        const applied = Math.min(currentSaldo, inv.amountToApply);
        const newSaldo = currentSaldo - applied;
        
        let newStatus = saleData.status;
        if (newSaldo <= 0) {
          newStatus = 'PAGADA';
        } else if (applied > 0) {
          newStatus = 'PARCIAL';
        }

        transaction.update(saleRef, {
          saldoPendiente: newSaldo,
          status: newStatus,
          updatedAt: Date.now()
        });

        currentTotalApplied += applied;
        currentAppliedInvoices.push({
          saleId: inv.saleId,
          invoiceNumber: inv.invoiceNumber,
          amountApplied: applied
        });
      }

      const unallocatedAmount = receiptData.amount - currentTotalApplied;

      const newReceipt = {
        ...receiptData,
        appliedInvoices: currentAppliedInvoices,
        unallocatedAmount,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      transaction.set(ref, newReceipt);

      // Create a cash movement
      const cashMovRef = doc(collection(db, 'cash_movements'));
      transaction.set(cashMovRef, {
        type: 'in',
        amount: receiptData.amount,
        method: receiptData.method,
        description: `Cobro Recibo ${receiptId} a ${receiptData.customerName}`,
        category: 'sale',
        referenceId: receiptId,
        date: receiptData.date,
        createdAt: Date.now()
      });

      // Update customer balance (deduct debt)
      if (custSnap.exists()) {
        const currentBalance = custSnap.data().currentBalance || 0;
        transaction.update(customerRef, {
          currentBalance: currentBalance - receiptData.amount, // receipt amount reduces debt
          updatedAt: Date.now()
        });
      }
    });

    return receiptId;
  };

  return { receipts, loading, error, createReceipt };
};
export default useReceipts;
