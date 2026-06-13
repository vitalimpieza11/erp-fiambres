import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Shareholder, ShareholderMovement, CajaMovement } from '../../types/domain';

export function useSocios() {
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [movements, setMovements] = useState<ShareholderMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchar socios
    const qSocios = query(collection(db, 'shareholders'), where('activo', '==', true));
    const unsubSocios = onSnapshot(qSocios, (snap) => {
      const data: Shareholder[] = [];
      snap.forEach(doc => data.push(doc.data() as Shareholder));
      setShareholders(data.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    });

    // Escuchar movimientos
    const qMovs = query(collection(db, 'shareholder_movements'), where('isDeleted', '==', false));
    const unsubMovs = onSnapshot(qMovs, (snap) => {
      const data: ShareholderMovement[] = [];
      snap.forEach(doc => data.push(doc.data() as ShareholderMovement));
      setMovements(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoading(false);
    });

    return () => {
      unsubSocios();
      unsubMovs();
    };
  }, []);

  const addMovement = async (data: {
    shareholderId: string;
    sourceType: 'APORTE' | 'RETIRO' | 'AJUSTE';
    amount: number;
    description: string;
    impactCaja: boolean;
    cajaCategory?: string; // e.g. "Aporte Inicial de Socio"
  }) => {
    const movId = doc(collection(db, 'shareholder_movements')).id;
    const date = new Date().toISOString();

    const newMov: ShareholderMovement = {
      id: movId,
      shareholderId: data.shareholderId,
      date,
      sourceType: data.sourceType,
      sourceId: movId, // El origen es él mismo
      reversalOf: null,
      amount: data.amount,
      description: data.description,
      isDeleted: false
    };

    // Si impacta caja
    if (data.impactCaja) {
      const cajaMovId = doc(collection(db, 'caja_movements')).id;
      newMov.linkedCajaMovementId = cajaMovId; // Guardamos enlace inmutable
      
      const type = data.sourceType === 'RETIRO' ? 'EXPENSE' : 'INCOME';
      const cajaMov: CajaMovement = {
        id: cajaMovId,
        type,
        amount: data.amount,
        date,
        category: data.cajaCategory || 'SOCIOS',
        description: `Ref: ${movId} - ${data.description}`,
        operation: 'MOVEMENT',
        reasonType: `SOCIOS_${data.sourceType}`,
        sourceId: movId,
        isDeleted: false
      };
      await setDoc(doc(db, 'caja_movements', cajaMovId), cajaMov);
    }

    await setDoc(doc(db, 'shareholder_movements', movId), newMov);
  };

  const annulMovement = async (originalId: string, reason: string) => {
    const original = movements.find(m => m.id === originalId);
    if (!original) throw new Error("Movimiento no encontrado");

    const movId = doc(collection(db, 'shareholder_movements')).id;
    const date = new Date().toISOString();

    const compensatory: ShareholderMovement = {
      id: movId,
      shareholderId: original.shareholderId,
      date,
      sourceType: 'ANULACION',
      sourceId: original.id,
      reversalOf: original.id,
      amount: original.sourceType === 'RETIRO' ? original.amount : -original.amount, // Invierte el efecto
      description: `Anulación: ${reason}`,
      isDeleted: false
    };

    // Si hubo impacto original en caja, emitimos el evento inverso sin consultar a la caja
    if (original.linkedCajaMovementId) {
      const cajaMovId = doc(collection(db, 'caja_movements')).id;
      const originalCajaType = original.sourceType === 'RETIRO' ? 'EXPENSE' : 'INCOME';
      
      const cajaCompensatory: CajaMovement = {
        id: cajaMovId,
        type: originalCajaType === 'INCOME' ? 'EXPENSE' : 'INCOME',
        amount: original.amount,
        date,
        category: 'ANULACION',
        description: `Anulación de SOCIOS (Ref: ${original.id}). Motivo: ${reason}`,
        operation: 'REVERSAL',
        reasonType: `SOCIOS_ANULACION_${original.sourceType}`,
        sourceId: movId,
        reversalOf: original.linkedCajaMovementId, // Apuntamos directo al ID vinculado original
        isDeleted: false
      };
      await setDoc(doc(db, 'caja_movements', cajaMovId), cajaCompensatory);
      compensatory.linkedCajaMovementId = cajaMovId; // Enlazamos la anulación con el reverso en caja
    }
    
    await setDoc(doc(db, 'shareholder_movements', movId), compensatory);
  };

  const getBalance = (shareholderId: string) => {
    const movs = movements.filter(m => m.shareholderId === shareholderId);
    return movs.reduce((acc, mov) => {
      if (mov.sourceType === 'APORTE') return acc + mov.amount;
      if (mov.sourceType === 'RETIRO') return acc - mov.amount;
      if (mov.sourceType === 'AJUSTE') return acc + mov.amount; // Ajustes pueden ser pos o neg
      if (mov.sourceType === 'ANULACION') return acc + mov.amount; 
      return acc;
    }, 0);
  };

  return {
    shareholders,
    movements,
    loading,
    addMovement,
    annulMovement,
    getBalance
  };
}
