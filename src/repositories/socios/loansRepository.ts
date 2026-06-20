import { collection, onSnapshot, query, where, doc, setDoc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { ShareholderLoan, ShareholderLoanPayment, CajaMovement } from '../../types/domain';

export const loansRepository = {
  subscribeLoans(onData: (loans: ShareholderLoan[]) => void): () => void {
    const qLoans = query(collection(db, 'shareholder_loans'), where('isDeleted', '==', false));
    return onSnapshot(qLoans, (snap) => {
      const data: ShareholderLoan[] = [];
      snap.forEach((doc) => {
        data.push(doc.data() as ShareholderLoan);
      });
      onData(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });
  },

  async registerPayment(
    loanId: string,
    amount: number,
    description: string,
    accountId: string
  ): Promise<void> {
    if (amount <= 0) throw new Error("El monto del pago debe ser mayor a cero");

    await runTransaction(db, async (transaction) => {
      const loanRef = doc(db, 'shareholder_loans', loanId);
      const loanSnap = await transaction.get(loanRef);
      if (!loanSnap.exists()) throw new Error("Préstamo no encontrado");

      const loan = loanSnap.data() as ShareholderLoan;
      if (amount > loan.remainingAmount) {
        throw new Error(`El pago ($${amount}) supera el saldo restante ($${loan.remainingAmount})`);
      }

      const paymentId = doc(collection(db, 'dummy')).id;
      const cajaMovId = doc(collection(db, 'caja_movements')).id;
      const date = new Date().toISOString();

      const newPayment: ShareholderLoanPayment = {
        id: paymentId,
        amount,
        date,
        description,
        linkedCajaMovementId: cajaMovId
      };

      const newRemaining = Number((loan.remainingAmount - amount).toFixed(2));
      const newStatus = newRemaining === 0 ? 'PAGADO' : 'PENDIENTE';

      // Update Loan
      transaction.update(loanRef, {
        remainingAmount: newRemaining,
        status: newStatus,
        payments: [...(loan.payments || []), newPayment]
      });

      // Register Caja Movement (EXPENSE)
      const cajaMov: CajaMovement = {
        id: cajaMovId,
        type: 'EXPENSE',
        amount,
        date,
        category: 'DEVOLUCION_PRESTAMO',
        description: `Pago Préstamo Socio: ${loan.shareholderName}. Ref: ${description}`,
        operation: 'MOVEMENT',
        reasonType: 'DEVOLUCION_PRESTAMO',
        sourceId: loanId,
        accountId,
        isDeleted: false
      };

      transaction.set(doc(db, 'caja_movements', cajaMovId), cajaMov);
    });
  },

  async annulPayment(
    loanId: string,
    paymentId: string,
    reason: string
  ): Promise<void> {
    await runTransaction(db, async (transaction) => {
      const loanRef = doc(db, 'shareholder_loans', loanId);
      const loanSnap = await transaction.get(loanRef);
      if (!loanSnap.exists()) throw new Error("Préstamo no encontrado");

      const loan = loanSnap.data() as ShareholderLoan;
      const payments = loan.payments || [];
      const paymentIndex = payments.findIndex(p => p.id === paymentId);
      if (paymentIndex === -1) throw new Error("Pago no encontrado");

      const payment = payments[paymentIndex];

      // Revert in loan
      const newRemaining = Number((loan.remainingAmount + payment.amount).toFixed(2));
      const updatedPayments = payments.filter(p => p.id !== paymentId);

      transaction.update(loanRef, {
        remainingAmount: newRemaining,
        status: 'PENDIENTE',
        payments: updatedPayments
      });

      // Revert in Caja if linked
      if (payment.linkedCajaMovementId) {
        const originalCajaRef = doc(db, 'caja_movements', payment.linkedCajaMovementId);
        const originalCajaSnap = await transaction.get(originalCajaRef);
        let accountId: string | undefined = undefined;
        if (originalCajaSnap.exists()) {
          accountId = originalCajaSnap.data().accountId;
        }

        const cajaMovId = doc(collection(db, 'caja_movements')).id;
        const cajaCompensatory: CajaMovement = {
          id: cajaMovId,
          type: 'INCOME', // Compensates EXPENSE
          amount: payment.amount,
          date: new Date().toISOString(),
          category: 'ANULACION',
          description: `Anulación pago préstamo (Ref: ${paymentId}). Motivo: ${reason}`,
          operation: 'REVERSAL',
          reasonType: 'ANULACION_DEVOLUCION_PRESTAMO',
          sourceId: loanId,
          reversalOf: payment.linkedCajaMovementId,
          accountId,
          isDeleted: false
        };

        transaction.set(doc(db, 'caja_movements', cajaMovId), cajaCompensatory);
      }
    });
  },

  async registerCapitalization(
    loanId: string,
    amount: number,
    description: string
  ): Promise<void> {
    if (amount <= 0) throw new Error("El monto a capitalizar debe ser mayor a cero");

    await runTransaction(db, async (transaction) => {
      const loanRef = doc(db, 'shareholder_loans', loanId);
      const loanSnap = await transaction.get(loanRef);
      if (!loanSnap.exists()) throw new Error("Préstamo no encontrado");

      const loan = loanSnap.data() as ShareholderLoan;
      if (amount > loan.remainingAmount) {
        throw new Error(`La capitalización ($${amount}) supera el saldo restante ($${loan.remainingAmount})`);
      }

      const paymentId = doc(collection(db, 'dummy')).id;
      const date = new Date().toISOString();

      // We do NOT create a caja movement, because it's an accounting capitalization
      const newPayment: ShareholderLoanPayment = {
        id: paymentId,
        amount,
        date,
        description,
        type: 'CAPITALIZATION'
      };

      const newRemaining = Number((loan.remainingAmount - amount).toFixed(2));
      const newStatus = newRemaining === 0 ? 'PAGADO' : 'PENDIENTE';

      // Update Loan
      transaction.update(loanRef, {
        remainingAmount: newRemaining,
        status: newStatus,
        payments: [...(loan.payments || []), newPayment]
      });

      // Register Shareholder Movement (APORTE)
      const shareholderMovId = doc(collection(db, 'shareholder_movements')).id;
      const mov: import('../../types/domain').ShareholderMovement = {
        id: shareholderMovId,
        shareholderId: loan.shareholderId,
        date,
        sourceType: 'APORTE_CAPITALIZACION',
        sourceId: loanId,
        reversalOf: null,
        amount,
        description: `Capitalización de Préstamo: ${description}`,
        isDeleted: false,
        estado: 'ACTIVO',
        tipoAporte: 'DINERO'
      };
      
      transaction.set(doc(db, 'shareholder_movements', shareholderMovId), mov);
    });
  }
};
