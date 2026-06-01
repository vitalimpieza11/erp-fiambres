import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, writeBatch } from 'firebase/firestore';
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

    const newPurchase = {
      ...purchaseData,
      id: purchaseId,
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

      // NOTE: Product cost (costoHorma) is managed manually in the Products catalog.
      // Auto-updating it here could cause desync if item.cost is the total purchase
      // cost rather than the per-kg cost.
    }

    // Cash movement if status is completed
    if (purchaseData.status === 'completed') {
      const cashMovRef = doc(collection(db, 'cash_movements'));
      const cashMovement = {
        type: 'out',
        amount: Number(purchaseData.total),
        method: 'transfer',
        description: `Pago Compra Proveedor ${purchaseData.supplierName} (Ref: ${purchaseData.invoiceNumber || purchaseId})`,
        category: 'purchase',
        referenceId: purchaseId,
        date: Date.now(),
        createdAt: Date.now()
      };
      batch.set(cashMovRef, cashMovement);
    }

    await batch.commit();
    return purchaseId;
  };

  return { purchases, loading, error, createPurchase };
};
export default usePurchases;
