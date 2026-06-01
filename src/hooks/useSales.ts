import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, writeBatch, runTransaction } from 'firebase/firestore';
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
      subtotal: calc.subtotal,
      total: calc.total,
      discount: discountPercent,
      id: saleId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId: currentUserId
    };
    batch.set(saleRef, newSale);

    // Stock movements
    for (const item of saleData.items) {
      const stockMovRef = doc(collection(db, 'stock_movements'));
      const movement = {
        productId: item.productId,
        productName: item.productName,
        quantity: -Math.abs(Number(item.quantity)),
        type: 'out',
        referenceType: 'sale',
        referenceId: saleId,
        date: Date.now(),
        observations: `Venta Comprobante: ${saleData.remitoNumber || 'Sin remito'}`,
        createdAt: Date.now()
      };
      batch.set(stockMovRef, movement);
    }

    // Cash movement if completed or paid
    if (saleData.status === 'completed' || saleData.paymentStatus === 'paid') {
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

  return { sales, loading, error, createSale };
};
export default useSales;
