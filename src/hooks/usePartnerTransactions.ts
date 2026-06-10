import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { PartnerTransaction, CashMovement } from '../types/database';

export const usePartnerTransactions = () => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'partner_transactions'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: PartnerTransaction[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as PartnerTransaction);
      });
      setTransactions(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching partner transactions:', err);
      setError('Error al cargar movimientos societarios');
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser]);

  const addTransaction = async (data: Omit<PartnerTransaction, 'id' | 'createdAt'>, accountId?: string) => {
    try {
      const batch = writeBatch(db);
      
      const txRef = doc(collection(db, 'partner_transactions'));
      const txId = txRef.id;

      const now = Date.now();
      
      let cashMovementId = undefined;

      const cType = data.contributionType || 'DINERO';

      // 1. Generate cash_movement for APORTE or RETIRO / DEVOLUCION
      if (data.type === 'APORTE') {
        const cashRef = doc(collection(db, 'cash_movements'));
        cashMovementId = cashRef.id;

        let dest: 'caja' | 'banco' | 'activo' = 'caja';
        if (data.method === 'BANCO' || data.method === 'TRANSFERENCIA') dest = 'banco';
        else if (data.method === 'COMPENSACION' || cType !== 'DINERO') dest = 'activo';

        let aType: 'dinero' | 'bien_capital' | 'vehiculo' | 'mercaderia' | 'equipamiento' | 'tecnologia' | 'otro' = 'dinero';
        if (cType === 'MERCADERIA') aType = 'mercaderia';
        else if (cType === 'MAQUINARIA') aType = 'bien_capital';
        else if (cType === 'INSUMOS') aType = 'equipamiento';
        else if (cType === 'SERVICIOS') aType = 'otro';

        const cashData: CashMovement = {
          type: 'in',
          tipoMovimiento: 'APORTE_SOCIO',
          amount: data.amount,
          currency: 'ARS',
          method: dest === 'banco' ? 'transfer' : 'cash',
          origin: 'socio',
          destino: dest,
          description: data.description || `Aporte de Socio (${cType})`,
          category: 'aporte_socio',
          referenceId: txId,
          date: data.date,
          createdAt: now,
          partnerId: data.partnerId,
          aporteType: aType,
          status: 'completado'
        };

        batch.set(cashRef, cashData);
      } else if (data.method !== 'COMPENSACION') {
        const cashRef = doc(collection(db, 'cash_movements'));
        cashMovementId = cashRef.id;

        const cashData: CashMovement = {
          type: 'out',
          amount: data.amount,
          currency: 'ARS',
          method: data.method === 'BANCO' ? 'transfer' : 'cash',
          origin: data.method === 'BANCO' ? 'bank' : 'cash',
          description: data.description || `${data.type} Societario`,
          category: data.type === 'RETIRO' ? 'retiro_capital' : 'aporte_socio',
          referenceId: txId,
          date: data.date,
          createdAt: now,
          partnerId: data.partnerId,
          status: 'completado'
        };

        batch.set(cashRef, cashData);
      }

      // 2. Create the PartnerTransaction
      const txData: PartnerTransaction = {
        ...data,
        createdAt: now,
        referenceId: cashMovementId // Link back to the cash movement
      };

      batch.set(txRef, txData);

      // 3. Generate Stock Movement for MERCADERIA or INSUMOS
      if (data.type === 'APORTE' && (cType === 'MERCADERIA' || cType === 'INSUMOS') && data.productId && data.quantity) {
        const stockMovRef = doc(collection(db, 'stock_movements'));
        batch.set(stockMovRef, {
          productId: data.productId,
          productName: data.productName || 'Producto Aportado',
          quantity: data.quantity,
          type: 'in',
          referenceType: 'manual',
          referenceId: txId,
          date: data.date,
          observations: `Aporte de Socio (${cType}): ${data.description}`,
          createdAt: now
        });
      }

      await batch.commit();
      return true;
    } catch (err: any) {
      console.error('Error adding transaction:', err);
      throw err;
    }
  };

  return { transactions, loading, error, addTransaction };
};
