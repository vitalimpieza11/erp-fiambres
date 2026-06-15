import { collection, onSnapshot, query, where, doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Shareholder, ShareholderMovement, CajaMovement } from '../../types/domain';

export const sociosRepository = {
  subscribeShareholders(onData: (shareholders: Shareholder[]) => void): () => void {
    const qSocios = query(collection(db, 'shareholders'));
    return onSnapshot(qSocios, (snap) => {
      const data: Shareholder[] = [];
      snap.forEach(doc => data.push(doc.data() as Shareholder));
      onData(data.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    });
  },

  subscribeMovements(onData: (movements: ShareholderMovement[]) => void): () => void {
    const qMovs = query(collection(db, 'shareholder_movements'), where('isDeleted', '==', false));
    return onSnapshot(qMovs, (snap) => {
      const data: ShareholderMovement[] = [];
      snap.forEach(doc => data.push(doc.data() as ShareholderMovement));
      onData(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });
  },

  async addMovement(data: {
    shareholderId: string;
    sourceType: 'APORTE' | 'RETIRO' | 'AJUSTE';
    amount: number;
    description: string;
    impactCaja: boolean;
    cajaCategory?: string;
  }): Promise<void> {
    const movId = doc(collection(db, 'shareholder_movements')).id;
    const date = new Date().toISOString();

    const newMov: ShareholderMovement = {
      id: movId,
      shareholderId: data.shareholderId,
      date,
      sourceType: data.sourceType,
      sourceId: movId,
      reversalOf: null,
      amount: data.amount,
      description: data.description,
      isDeleted: false
    };

    // Si impacta caja
    if (data.impactCaja) {
      const cajaMovId = doc(collection(db, 'caja_movements')).id;
      newMov.linkedCajaMovementId = cajaMovId;
      
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
  },

  async annulMovement(originalId: string, reason: string, original: ShareholderMovement): Promise<void> {
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
        reversalOf: original.linkedCajaMovementId,
        isDeleted: false
      };
      await setDoc(doc(db, 'caja_movements', cajaMovId), cajaCompensatory);
      compensatory.linkedCajaMovementId = cajaMovId;
    }
    
    await setDoc(doc(db, 'shareholder_movements', movId), compensatory);
  },

  async saveShareholder(shareholder: Partial<Shareholder>): Promise<void> {
    const dataToSave = {
      ...shareholder,
      activo: shareholder.activo !== false,
      participacionPorcentaje: Number(shareholder.participacionPorcentaje || 0),
      updatedAt: Date.now()
    };

    if (shareholder.id) {
      const docRef = doc(db, 'shareholders', shareholder.id);
      await setDoc(docRef, dataToSave, { merge: true });
    } else {
      const docRef = doc(collection(db, 'shareholders'));
      await setDoc(docRef, { ...dataToSave, id: docRef.id, createdAt: Date.now() });
    }
  },

  async toggleShareholderStatus(id: string, currentStatus: boolean): Promise<void> {
    const docRef = doc(db, 'shareholders', id);
    await setDoc(docRef, { activo: !currentStatus, updatedAt: Date.now() }, { merge: true });
  }
};
