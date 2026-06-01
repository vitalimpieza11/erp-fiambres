import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { DatabaseMapper } from '../mappers/databaseMapper';
import type { ProductionBatch } from '../types/database';

export const useProductions = () => {
  const { currentUser } = useAuth();
  const [productions, setProductions] = useState<ProductionBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'production_batches'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ProductionBatch[] = [];
        snapshot.forEach((doc) => {
          list.push(DatabaseMapper.toDomainProductionBatch(doc.data(), doc.id));
        });
        setProductions(list);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err.message);
        setProductions([]);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [currentUser]);

  const createProductionBatch = async (
    batchData: Omit<ProductionBatch, 'id' | 'createdAt' | 'updatedAt'>,
    sourceProductId: string,
    sourceProductName: string,
    sourceProductQtyKg: number
  ): Promise<string> => {
    const currentUserId = currentUser?.uid || 'anonymous';
    const batch = writeBatch(db);
    const prodBatchRef = doc(collection(db, 'production_batches'));
    const batchId = prodBatchRef.id;

    const newBatch = {
      ...batchData,
      id: batchId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId: currentUserId
    };
    batch.set(prodBatchRef, newBatch);

    // Source product stock reduction movement
    const sourceMovRef = doc(collection(db, 'stock_movements'));
    const sourceMovement = {
      productId: sourceProductId,
      productName: sourceProductName,
      quantity: -Math.abs(sourceProductQtyKg),
      type: 'out',
      referenceType: 'production',
      referenceId: batchId,
      date: Date.now(),
      observations: `Producción Lote Feteado: ${batchId} (Descuento Horma)`,
      createdAt: Date.now()
    };
    batch.set(sourceMovRef, sourceMovement);

    // Target product stock increase movement
    const targetMovRef = doc(collection(db, 'stock_movements'));
    const targetMovement = {
      productId: batchData.productId,
      productName: batchData.productName,
      quantity: Math.abs(Number(batchData.quantityProduced)),
      type: 'in',
      referenceType: 'production',
      referenceId: batchId,
      date: Date.now(),
      observations: `Producción Lote Feteado: ${batchId} (Ingreso Paquetes)`,
      createdAt: Date.now()
    };
    batch.set(targetMovRef, targetMovement);

    await batch.commit();
    return batchId;
  };

  return { productions, loading, error, createProductionBatch };
};
export default useProductions;
