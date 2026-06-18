import { collection, onSnapshot, query, where, doc, setDoc, orderBy, limit } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { CajaMovement } from '../../types/domain';

export const cajaRepository = {
  subscribeMovements(onData: (movements: CajaMovement[]) => void): () => void {
    const q = query(
      collection(db, 'caja_movements'),
      where('isDeleted', '==', false),
      orderBy('date', 'desc'),
      limit(100)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: CajaMovement[] = [];
      snapshot.forEach((d) => {
        data.push(d.data() as CajaMovement);
      });
      onData(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });
    return unsubscribe;
  },

  async addMovement(mov: Omit<CajaMovement, 'id' | 'isDeleted' | 'date'> & { date?: string }): Promise<void> {
    const docRef = doc(collection(db, 'caja_movements'));
    const newMovement: CajaMovement = {
      ...mov,
      id: docRef.id,
      date: mov.date || new Date().toISOString(),
      isDeleted: false
    };
    await setDoc(docRef, newMovement);
  },

  async annulMovement(originalId: string, reason: string, original: CajaMovement): Promise<void> {
    const docRef = doc(collection(db, 'caja_movements'));
    const compensatoryMovement: CajaMovement = {
      id: docRef.id,
      type: original.type === 'INCOME' ? 'EXPENSE' : 'INCOME',
      amount: original.amount,
      date: new Date().toISOString(),
      category: 'ANULACION',
      description: `Anulación de ${original.category} (Ref: ${originalId}). Motivo: ${reason}`,
      referenceId: original.id,
      accountId: original.accountId,
      isDeleted: false
    };
    await setDoc(docRef, compensatoryMovement);
  }
};
