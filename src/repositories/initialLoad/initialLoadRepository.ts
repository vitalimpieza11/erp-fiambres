import { doc, collection, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { 
  StockMovement, 
  Purchase, 
  Sale, 
  ShareholderMovement, 
  CajaMovement, 
  ShareholderLoan 
} from '../../types/domain';

export type InitialLoadStatus = {
  executed: boolean;
  executedAt?: string;
  version: number;
};

export type InitialLoadData = {
  fechaCorte: string; // e.g. "2026-06-17"
  stocks: {
    productId: string;
    stockFisico: number;
    currentStock: number;
  }[];
  insumos: {
    productId: string;
    nombre: string;
    compraCosto: number;
    cantidadComprada: number;
    cantidadActual: number;
  }[];
  comprasHistoricas: {
    date: string;
    amount: number;
  }[];
  ventasHistoricas: {
    date: string;
    amount: number;
    cost: number;
  }[];
  aportes: {
    shareholderId: string;
    description: string;
    amount: number;
  }[];
  prestamos: {
    shareholderId: string;
    shareholderName: string;
    description: string;
    amount: number;
  }[];
  cajaInicial: {
    accountId: string;
    amount: number;
  }[];
};

export const initialLoadRepository = {
  async getInitialLoadStatus(): Promise<InitialLoadStatus> {
    const docRef = doc(db, 'settings', 'initialLoadStatus');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as InitialLoadStatus;
    }
    return { executed: false, version: 1 };
  },

  async executeInitialLoad(data: InitialLoadData): Promise<void> {
    const dateIso = new Date(data.fechaCorte + 'T12:00:00.000Z').toISOString();

    await runTransaction(db, async (transaction) => {
      // 1. Verificar idempotencia en la misma transacción (Lectura al inicio)
      const statusRef = doc(db, 'settings', 'initialLoadStatus');
      const statusSnap = await transaction.get(statusRef);
      if (statusSnap.exists() && statusSnap.data()?.executed) {
        throw new Error("La migración inicial ya fue ejecutada.");
      }

      // 2. Procesar Stocks
      for (const st of data.stocks) {
        if (st.stockFisico <= 0) continue;

        const prodRef = doc(db, 'products', st.productId);
        const movRef = doc(collection(db, 'stock_movements'));

        const stockMov: StockMovement = {
          id: movRef.id,
          productId: st.productId,
          qty: st.stockFisico,
          type: 'AJUSTE',
          date: dateIso,
          referenceId: 'MIGRACION_INICIAL',
          observaciones: `Stock Inicial al ${data.fechaCorte.split('-').reverse().slice(0,2).join('/')}`,
          isDeleted: false
        };

        transaction.set(movRef, stockMov);
        transaction.update(prodRef, {
          stockActual: st.stockFisico
        });
      }

      // 3. Procesar Insumos
      for (const ins of data.insumos) {
        if (ins.cantidadActual < 0) continue;
        const unitCost = ins.cantidadComprada > 0 ? ins.compraCosto / ins.cantidadComprada : 0;

        const prodRef = doc(db, 'products', ins.productId);
        const movRef = doc(collection(db, 'stock_movements'));

        const stockMov: StockMovement = {
          id: movRef.id,
          productId: ins.productId,
          qty: ins.cantidadActual,
          type: 'AJUSTE',
          date: dateIso,
          referenceId: 'MIGRACION_INICIAL',
          observaciones: `Stock Inicial Insumos al ${data.fechaCorte.split('-').reverse().slice(0,2).join('/')}`,
          isDeleted: false
        };

        transaction.set(movRef, stockMov);
        transaction.update(prodRef, {
          stockActual: ins.cantidadActual,
          costoActual: unitCost,
          costoUltimaCompra: unitCost,
          fechaUltimaCompra: dateIso
        });
      }

      // 4. Procesar Compras Históricas (isHistorical: true)
      for (const cp of data.comprasHistoricas) {
        if (cp.amount <= 0) continue;
        const purchaseRef = doc(collection(db, 'purchases'));
        const newPurchase: Purchase = {
          id: purchaseRef.id,
          type: 'PURCHASE',
          supplierId: 'HISTORICO',
          date: new Date(cp.date + 'T12:00:00.000Z').toISOString(),
          items: [
            {
              productId: 'HISTORICO_COMPRA',
              type: 'MERCADERIA',
              quantity: 1,
              unit: 'UNIDADES',
              unitCost: cp.amount,
              totalCost: cp.amount
            }
          ],
          subtotal: cp.amount,
          impuestos: 0,
          total: cp.amount,
          paymentMethod: 'CONTADO',
          montoPagado: cp.amount,
          montoCuentaCorriente: 0,
          status: 'ACTIVE',
          isDeleted: false,
          isHistorical: true
        };
        transaction.set(purchaseRef, newPurchase);
      }

      // 5. Procesar Ventas Históricas (isHistorical: true)
      for (const vt of data.ventasHistoricas) {
        if (vt.amount <= 0) continue;
        const saleRef = doc(collection(db, 'sales'));
        const newSale: Sale = {
          id: saleRef.id,
          customerId: 'HISTORICO',
          date: new Date(vt.date + 'T12:00:00.000Z').toISOString(),
          items: [
            {
              productId: 'HISTORICO_VENTA',
              cantidad: 1,
              unidad: 'UNIDADES',
              precioUnitario: vt.amount,
              subtotal: vt.amount,
              costoUnitario: vt.cost,
              costoTotal: vt.cost,
              rentabilidadBruta: vt.amount - vt.cost,
              pesoReal: 1,
              precioRealKg: vt.amount,
              importeReal: vt.amount,
              costoUnitarioHistorico: vt.cost,
              costoTotalHistorico: vt.cost
            }
          ],
          totalAmount: vt.amount,
          status: 'COBRADO',
          paymentMethod: 'EFECTIVO_TRANSFERENCIA',
          isDeleted: false,
          isHistorical: true
        };
        transaction.set(saleRef, newSale);
      }

      // 6. Aportes de Socios (impactCaja: false)
      for (const ap of data.aportes) {
        if (ap.amount <= 0) continue;
        const movId = doc(collection(db, 'shareholder_movements')).id;
        const newMov: ShareholderMovement = {
          id: movId,
          shareholderId: ap.shareholderId,
          date: dateIso,
          sourceType: 'APORTE',
          sourceId: movId,
          reversalOf: null,
          amount: ap.amount,
          description: ap.description,
          isDeleted: false
        };
        transaction.set(doc(db, 'shareholder_movements', movId), newMov);
      }

      // 7. Préstamos de Socios
      for (const pr of data.prestamos) {
        if (pr.amount <= 0) continue;
        const loanRef = doc(collection(db, 'shareholder_loans'));
        const newLoan: ShareholderLoan = {
          id: loanRef.id,
          shareholderId: pr.shareholderId,
          shareholderName: pr.shareholderName,
          amount: pr.amount,
          date: dateIso,
          description: pr.description,
          remainingAmount: pr.amount,
          status: 'PENDIENTE',
          payments: [],
          isDeleted: false
        };
        transaction.set(loanRef, newLoan);
      }

      // 8. Caja Inicial
      for (const cj of data.cajaInicial) {
        if (cj.amount <= 0) continue;
        const cajaMovRef = doc(collection(db, 'caja_movements'));
        const cajaMov: CajaMovement = {
          id: cajaMovRef.id,
          type: 'INCOME',
          amount: cj.amount,
          date: dateIso,
          category: 'SALDO_INICIAL',
          description: `Saldo Inicial al ${data.fechaCorte.split('-').reverse().slice(0,2).join('/')}`,
          operation: 'MOVEMENT',
          accountId: cj.accountId,
          isDeleted: false
        };
        transaction.set(cajaMovRef, cajaMov);
      }

      // 9. Registrar finalización de carga inicial
      transaction.set(statusRef, {
        executed: true,
        executedAt: new Date().toISOString(),
        version: 1
      });
    });
  }
};
