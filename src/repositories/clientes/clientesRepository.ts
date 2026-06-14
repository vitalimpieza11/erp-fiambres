import { getDocs, addDoc, updateDoc, doc, query, where, collection, runTransaction } from 'firebase/firestore';
import { db, COLLECTIONS } from '../lib/firebase';
import type { Customer, CustomerMovement, PriceList, Order, Sale } from '../types/domain';

export const clientesRepository = {
  async fetchClientesData(): Promise<{
    customers: Customer[];
    movements: CustomerMovement[];
    priceLists: PriceList[];
    orders: Order[];
    sales: Sale[];
  }> {
    const [custSnap, moveSnap, priceSnap, ordersSnap, salesSnap] = await Promise.all([
      getDocs(COLLECTIONS.CUSTOMERS),
      getDocs(query(COLLECTIONS.CUSTOMER_MOVEMENTS, where('isDeleted', '==', false))),
      getDocs(query(COLLECTIONS.PRICE_LISTS, where('activo', '==', true))),
      getDocs(query(COLLECTIONS.ORDERS, where('isDeleted', '==', false))),
      getDocs(query(COLLECTIONS.SALES, where('isDeleted', '==', false)))
    ]);

    return {
      customers: custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)),
      movements: moveSnap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerMovement)),
      priceLists: priceSnap.docs.map(d => ({ id: d.id, ...d.data() } as PriceList)),
      orders: ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order)),
      sales: salesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sale))
    };
  },

  async saveCustomer(customer: Partial<Customer>): Promise<void> {
    const dataToSave = {
      ...customer,
      activo: customer.activo !== false,
      updatedAt: Date.now()
    };

    if (customer.id) {
      await updateDoc(doc(db, 'customers', customer.id), dataToSave);
    } else {
      await addDoc(COLLECTIONS.CUSTOMERS, { ...dataToSave, createdAt: Date.now() });
    }
  },

  async toggleCustomerStatus(id: string, currentStatus: boolean): Promise<void> {
    await updateDoc(doc(db, 'customers', id), { activo: !currentStatus, updatedAt: Date.now() });
  },

  async registerPago(
    customerId: string,
    amount: number,
    date: string,
    sourceId: string,
    observaciones: string,
    fromCaja: boolean
  ): Promise<void> {
    if (amount <= 0) throw new Error("El monto del pago debe ser mayor a cero.");

    await runTransaction(db, async (transaction) => {
      // 1. Crear el movimiento de pago del cliente (resta deuda)
      const moveRef = doc(collection(db, 'customer_movements'));
      const customerNameDoc = await transaction.get(doc(db, 'customers', customerId));
      const clientName = customerNameDoc.exists() ? customerNameDoc.data().nombre : 'Cliente';

      transaction.set(moveRef, {
        customerId,
        date: date || new Date().toISOString(),
        type: 'PAGO',
        amount, // Se almacena positivo, la fórmula resta
        referenceId: sourceId || '',
        observaciones: observaciones || 'Pago registrado',
        isDeleted: false
      });

      // 2. Si impacta en caja, registrar el ingreso
      if (fromCaja) {
        const cajaRef = doc(collection(db, 'caja_movements'));
        transaction.set(cajaRef, {
          type: 'INCOME',
          amount,
          date: date || new Date().toISOString(),
          category: 'COBRO_CLIENTE',
          description: `Cobro en cuenta corriente del cliente: ${clientName}. ${observaciones}`,
          referenceId: moveRef.id,
          isDeleted: false
        });
      }
    });
  },

  async registerAjuste(
    customerId: string,
    amount: number,
    date: string,
    observaciones: string
  ): Promise<void> {
    if (amount === 0) throw new Error("El monto del ajuste no puede ser cero.");

    const moveRef = doc(collection(db, 'customer_movements'));
    await addDoc(COLLECTIONS.CUSTOMER_MOVEMENTS, {
      customerId,
      date: date || new Date().toISOString(),
      type: 'AJUSTE',
      amount, // positivo para aumentar deuda, negativo para reducirla
      observaciones: observaciones || 'Ajuste manual de saldo',
      isDeleted: false
    });
  },

  async annulMovement(movId: string, reason: string, original: CustomerMovement): Promise<void> {
    await runTransaction(db, async (transaction) => {
      // 1. Marcar el movimiento original como anulado (anulación inmutable mediante movimiento compensatorio)
      const originalRef = doc(db, 'customer_movements', movId);
      transaction.update(originalRef, {
        observaciones: (original.observaciones || '') + ` | ANULADO: ${reason}`
      });

      // 2. Crear movimiento compensatorio en cuenta corriente
      const compRef = doc(collection(db, 'customer_movements'));
      
      let compType: 'DEUDA' | 'PAGO' | 'AJUSTE' = 'AJUSTE';
      let compAmount = 0;
      
      if (original.type === 'PAGO') {
        // Un pago resta deuda, la compensación debe sumar deuda
        compType = 'AJUSTE';
        compAmount = original.amount; // suma deuda de vuelta
      } else if (original.type === 'DEUDA') {
        // Una deuda suma deuda, la compensación debe restar deuda
        compType = 'AJUSTE';
        compAmount = -original.amount;
      } else if (original.type === 'AJUSTE') {
        // Un ajuste suma o resta deuda, la compensación lo invierte
        compType = 'AJUSTE';
        compAmount = -original.amount;
      }

      transaction.set(compRef, {
        customerId: original.customerId,
        date: new Date().toISOString(),
        type: compType,
        amount: compAmount,
        referenceId: movId,
        observaciones: `Compensación por anulación de ${original.type} (ID: ${movId}). Motivo: ${reason}`,
        isDeleted: false
      });

      // 3. Si el movimiento original era un PAGO e impactó en caja, registrar un egreso compensatorio en caja
      if (original.type === 'PAGO') {
        // Buscamos si existe un movimiento de caja relacionado con la referencia de este movimiento
        const cajaRef = doc(collection(db, 'caja_movements'));
        transaction.set(cajaRef, {
          type: 'EXPENSE',
          amount: original.amount,
          date: new Date().toISOString(),
          category: 'ANULACION_COBRO',
          description: `Anulación de cobro en cuenta corriente (Ref: ${movId}). Motivo: ${reason}`,
          referenceId: movId,
          isDeleted: false
        });
      }
    });
  }
};
