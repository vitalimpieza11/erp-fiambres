import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, writeBatch, runTransaction, deleteDoc, updateDoc, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseMapper } from '../mappers/databaseMapper';
import { calculateSaleTotals } from '../core/calculations';
import type { Sale } from '../types/database';

export const useSales = () => {
  const { currentUser } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Sale[] = [];
        snapshot.forEach((doc) => {
          list.push(DatabaseMapper.toDomainSale(doc.data(), doc.id));
        });
        setSales(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setSales([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const createSale = async (
    saleData: Omit<Sale, 'id' | 'subtotal' | 'total' | 'createdAt' | 'updatedAt'>,
    discountPercent: number,
    shippingCost: number
  ): Promise<string> => {
    const currentUserId = currentUser?.uid || 'anonymous';
    const batch = writeBatch(db);

    const saleRef = doc(collection(db, 'sales'));
    const saleId = saleRef.id;

    // Calculate totals
    const normalizedItems = saleData.items.map((item: any) => ({
      quantity: Number(item.quantity),
      price: Number(item.price),
      cost: Number(item.cost)
    }));
    const calc = calculateSaleTotals(normalizedItems, discountPercent, shippingCost);

    const newSale = {
      ...saleData,
      status: 'PENDIENTE',
      subtotal: calc.subtotal,
      total: calc.total,
      saldoPendiente: calc.total,
      discount: discountPercent,
      id: saleId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId: currentUserId
    };
    batch.set(saleRef, newSale);

    // ── REGLA DE STOCK: Ventas afectan PAQUETES (producto físico) ──
    for (const item of saleData.items as any[]) {
      if (item.packages && Array.isArray(item.packages)) {
        for (const pkgId of item.packages) {
          const pkgRef = doc(db, 'packages', pkgId);
          batch.update(pkgRef, {
            status: 'Vendido',
            saleId: saleId,
            saleDate: Date.now(),
            updatedAt: Date.now()
          });
        }
      }
    }

    // Cash movement if completed or paid
    if (saleData.status === 'PAGADA') {
      const cashMovRef = doc(collection(db, 'cash_movements'));
      const cashMovement = {
        type: 'in',
        amount: calc.total,
        method: saleData.paymentMethod || 'cash',
        description: `Cobro Venta ${saleData.customerName} (Ref: ${saleData.remitoNumber || saleId})`,
        category: 'sale',
        referenceId: saleId,
        date: Date.now(),
        createdAt: Date.now()
      };
      batch.set(cashMovRef, cashMovement);
    }

    await batch.commit();

    // Update customer balance if Cuenta Corriente
    if (saleData.paymentMethod === 'cc') {
      const customerRef = doc(db, 'customers', saleData.customerId);
      await runTransaction(db, async (transaction) => {
        const custSnap = await transaction.get(customerRef);
        if (custSnap.exists()) {
          const currentBalance = custSnap.data().currentBalance || 0;
          transaction.update(customerRef, {
            currentBalance: currentBalance + calc.total,
            updatedAt: Date.now()
          });
        }
      }).catch(e => console.error("Error updating customer balance:", e));
    }

    return saleId;
  };

  const updateSale = async (id: string, data: Partial<Sale>) => {
    const oldSale = sales.find(s => s.id === id);
    if (!oldSale) throw new Error('Venta no encontrada');

    const batch = writeBatch(db);
    const ref = doc(db, 'sales', id);
    batch.update(ref, { ...data, updatedAt: Date.now() });

    // 1. Revert packages and delete old cash movements
    const packagesSnap = await getDocs(query(collection(db, 'packages'), where('saleId', '==', id)));
    packagesSnap.forEach(d => {
      batch.update(d.ref, {
        status: 'Disponible',
        saleId: null,
        saleDate: null,
        updatedAt: Date.now()
      });
    });

    const cashSnap = await getDocs(query(collection(db, 'cash_movements'), where('referenceId', '==', id)));
    cashSnap.forEach(d => batch.delete(d.ref));

    // 2. Process NEW stock movements
    const itemsToProcess = data.items || oldSale.items;
    const statusToProcess = data.status !== undefined ? data.status : oldSale.status;
    const paymentMethodToProcess = data.paymentMethod !== undefined ? data.paymentMethod : oldSale.paymentMethod;
    const totalToProcess = data.total !== undefined ? data.total : oldSale.total;
    const remitoToProcess = data.remitoNumber !== undefined ? data.remitoNumber : oldSale.remitoNumber;
    const customerNameToProcess = data.customerName !== undefined ? data.customerName : oldSale.customerName;
    const customerIdToProcess = data.customerId !== undefined ? data.customerId : oldSale.customerId;

    for (const item of itemsToProcess) {
      if (item.packages && Array.isArray(item.packages)) {
        for (const pkgId of item.packages) {
          const pkgRef = doc(db, 'packages', pkgId);
          batch.update(pkgRef, {
            status: 'Vendido',
            saleId: id,
            saleDate: Date.now(),
            updatedAt: Date.now()
          });
        }
      }
    }

    // 3. Process NEW cash movements
    if (statusToProcess === 'PAGADA' || statusToProcess === 'PARCIAL') {
      const cashMovRef = doc(collection(db, 'cash_movements'));
      const cashMovement = {
        type: 'in',
        amount: Number(totalToProcess),
        method: paymentMethodToProcess || 'cash',
        description: `Cobro Venta ${customerNameToProcess} (Ref: ${remitoToProcess || id}) (Editada)`,
        category: 'sale',
        referenceId: id,
        date: Date.now(),
        createdAt: Date.now()
      };
      batch.set(cashMovRef, cashMovement);
    }

    await batch.commit();

    // 4. Update customer balances
    // We must revert the old sale balance and apply the new one.
    if (oldSale.paymentMethod === 'cc' || paymentMethodToProcess === 'cc') {
      await runTransaction(db, async (transaction) => {
        const oldCustomerRef = doc(db, 'customers', oldSale.customerId);
        const oldCustSnap = await transaction.get(oldCustomerRef);
        
        let oldCustBalance = oldCustSnap.exists() ? (oldCustSnap.data().currentBalance || 0) : 0;
        
        if (oldSale.paymentMethod === 'cc') {
           oldCustBalance -= oldSale.total; // revert old
           transaction.update(oldCustomerRef, { currentBalance: oldCustBalance, updatedAt: Date.now() });
        }

        if (paymentMethodToProcess === 'cc') {
           if (oldSale.customerId === customerIdToProcess && oldSale.paymentMethod === 'cc') {
             // same customer
             oldCustBalance += Number(totalToProcess);
             transaction.update(oldCustomerRef, { currentBalance: oldCustBalance, updatedAt: Date.now() });
           } else {
             const newCustomerRef = doc(db, 'customers', customerIdToProcess);
             const newCustSnap = await transaction.get(newCustomerRef);
             const newCustBalance = newCustSnap.exists() ? (newCustSnap.data().currentBalance || 0) : 0;
             transaction.update(newCustomerRef, { currentBalance: newCustBalance + Number(totalToProcess), updatedAt: Date.now() });
           }
        }
      }).catch(e => console.error("Error updating customer balances on edit:", e));
    }
  };

  const deleteSale = async (id: string) => {
    const target = sales.find(s => s.id === id);
    if (!target) throw new Error('Venta no encontrada');

    const batch = writeBatch(db);
    const ref = doc(db, 'sales', id);
    batch.delete(ref);

    const packagesSnap = await getDocs(query(collection(db, 'packages'), where('saleId', '==', id)));
    packagesSnap.forEach(d => {
      batch.update(d.ref, {
        status: 'Disponible',
        saleId: null,
        saleDate: null,
        updatedAt: Date.now()
      });
    });

    const cashSnap = await getDocs(query(collection(db, 'cash_movements'), where('referenceId', '==', id)));
    cashSnap.forEach(d => batch.delete(d.ref));

    await batch.commit();

    if (target.paymentMethod === 'cc') {
      const customerRef = doc(db, 'customers', target.customerId);
      await runTransaction(db, async (transaction) => {
        const custSnap = await transaction.get(customerRef);
        if (custSnap.exists()) {
          const currentBalance = custSnap.data().currentBalance || 0;
          transaction.update(customerRef, {
            currentBalance: currentBalance - target.total,
            updatedAt: Date.now()
          });
        }
      }).catch(e => console.error("Error reverting customer balance:", e));
    }
  };

  return { sales, loading, error, createSale, updateSale, deleteSale };
};
export default useSales;
