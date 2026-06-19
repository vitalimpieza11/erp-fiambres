import { doc, collection, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { 
  StockMovement, 
  Purchase, 
  Sale, 
  ShareholderMovement, 
  CajaMovement, 
  ShareholderLoan,
  UnitType
} from '../../types/domain';

export type InitialLoadStatus = {
  executed: boolean;
  executedAt?: string;
  version: number;
};

export type InitialLoadData = {
  fechaCorte: string; // e.g. "2026-06-17"
  isAdjustOnly?: boolean;
  stocks: {
    productId: string;
    stockFisico: number;
    costoUnitario: number;
  }[];
  presentaciones: {
    productId: string;
    cantidad: number;
    pesoPromedio: number;
    unidadMedida: string;
    costoUnitario: number;
    precioVenta: number;
  }[];
  comprasHistoricas: {
    date: string;
    supplierId: string;
    supplierName?: string;
    isNewSupplier?: boolean;
    estado: 'PAGADA' | 'PENDIENTE' | 'PARCIALMENTE PAGADA';
    paymentType?: 'CUENTA' | 'APORTE_SOCIO';
    socioId?: string;
    cuentaId?: string;
    total: number;
    pagado: number;
    observaciones: string;
    items: {
      productId: string;
      cantidad: number;
      unidad: string;
      costoUnitario: number;
      subtotal: number;
    }[];
  }[];
  ventasHistoricas: {
    date: string;
    customerId: string;
    customerName?: string;
    isNewCustomer?: boolean;
    estado: 'COBRADA' | 'PENDIENTE' | 'PARCIALMENTE COBRADA';
    deliveryStatus?: 'ENTREGADO' | 'PENDIENTE';
    total: number;
    cobrado: number;
    observaciones: string;
    items: {
      productId: string;
      cantidad: number;
      precioUnitario: number;
      costoUnitario: number;
      subtotal: number;
      observacion?: string;
    }[];
  }[];
  aportes: {
    shareholderId: string;
    shareholderName?: string;
    isNewShareholder?: boolean;
    movements: {
      date: string;
      tipo: 'APORTE' | 'PRESTAMO';
      tipoAporte?: 'DINERO' | 'BIEN';
      descripcionBien?: string;
      concepto: string;
      amount: number;
    }[];
  }[];
  cajaInicial: {
    accountId: string;
    accountName?: string;
    accountType?: 'EFECTIVO' | 'BANCO' | 'BILLETERA_VIRTUAL';
    isNewAccount?: boolean;
    amount: number;
  }[];
  clientesIniciales: {
    customerId: string;
    customerName?: string;
    isNewCustomer?: boolean;
    saldo: number;
    observaciones: string;
  }[];
  proveedoresIniciales: {
    supplierId: string;
    supplierName?: string;
    isNewSupplier?: boolean;
    saldo: number;
    observaciones: string;
  }[];
  ajusteDiferenciaBalance?: number;
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

      // 2. Crear nuevas cuentas financieras inline si existen
      const accountIdMap: Record<string, string> = {};
      for (const cj of data.cajaInicial) {
        if (cj.isNewAccount && cj.accountName) {
          const accRef = doc(collection(db, 'products')); // Usamos collection ref para IDs autogenerados
          const newAccId = accRef.id;
          transaction.set(doc(db, 'financial_accounts', newAccId), {
            id: newAccId,
            nombre: cj.accountName,
            tipo: cj.accountType || 'EFECTIVO',
            activa: true,
            createdAt: Date.now()
          });
          accountIdMap[cj.accountId] = newAccId;
        } else {
          accountIdMap[cj.accountId] = cj.accountId;
        }
      }

      // 3. Crear nuevos socios inline si existen
      const shareholderIdMap: Record<string, string> = {};
      const shareholderNameMap: Record<string, string> = {};
      for (const ap of data.aportes) {
        if (ap.isNewShareholder && ap.shareholderName) {
          const shRef = doc(collection(db, 'shareholders'));
          const newShId = shRef.id;
          transaction.set(doc(db, 'shareholders', newShId), {
            id: newShId,
            nombre: ap.shareholderName,
            type: 'ACTIVO',
            participacionPorcentaje: 0,
            activo: true
          });
          shareholderIdMap[ap.shareholderId] = newShId;
          shareholderNameMap[newShId] = ap.shareholderName;
        } else {
          shareholderIdMap[ap.shareholderId] = ap.shareholderId;
          shareholderNameMap[ap.shareholderId] = ap.shareholderName || '';
        }
      }

      // 4. Crear nuevos clientes inline si existen
      const customerIdMap: Record<string, string> = {};
      const customerNameMap: Record<string, string> = {};
      for (const cl of data.clientesIniciales) {
        if (cl.isNewCustomer && cl.customerName) {
          const custRef = doc(collection(db, 'customers'));
          const newCustId = custRef.id;
          transaction.set(doc(db, 'customers', newCustId), {
            id: newCustId,
            nombre: cl.customerName,
            razonSocial: cl.customerName,
            cuit: '',
            telefono: '',
            email: '',
            direccion: '',
            observaciones: 'Creado desde el Asistente de Carga',
            activo: true,
            createdAt: Date.now()
          });
          customerIdMap[cl.customerId] = newCustId;
          customerNameMap[newCustId] = cl.customerName;
        } else {
          customerIdMap[cl.customerId] = cl.customerId;
          customerNameMap[cl.customerId] = cl.customerName || '';
        }
      }

      // 5. Crear nuevos proveedores inline si existen
      const supplierIdMap: Record<string, string> = {};
      const supplierNameMap: Record<string, string> = {};
      for (const pr of data.proveedoresIniciales) {
        if (pr.isNewSupplier && pr.supplierName) {
          const suppRef = doc(collection(db, 'suppliers'));
          const newSuppId = suppRef.id;
          transaction.set(doc(db, 'suppliers', newSuppId), {
            id: newSuppId,
            nombre: pr.supplierName,
            razonSocial: pr.supplierName,
            cuit: '',
            telefono: '',
            email: '',
            direccion: '',
            observaciones: 'Creado desde el Asistente de Carga',
            activo: true,
            createdAt: Date.now()
          });
          supplierIdMap[pr.supplierId] = newSuppId;
          supplierNameMap[newSuppId] = pr.supplierName;
        } else {
          supplierIdMap[pr.supplierId] = pr.supplierId;
          supplierNameMap[pr.supplierId] = pr.supplierName || '';
        }
      }

      // Resolver mapeo para ventas/compras históricas que puedan usar nuevos clientes/proveedores
      for (const cp of data.comprasHistoricas) {
        if (cp.isNewSupplier && cp.supplierName) {
          const foundKey = Object.keys(supplierIdMap).find(k => k === cp.supplierId);
          if (!foundKey) {
            const suppRef = doc(collection(db, 'suppliers'));
            const newSuppId = suppRef.id;
            transaction.set(doc(db, 'suppliers', newSuppId), {
              id: newSuppId,
              nombre: cp.supplierName,
              razonSocial: cp.supplierName,
              cuit: '',
              telefono: '',
              email: '',
              direccion: '',
              observaciones: 'Creado desde el Asistente de Carga (Compra Histórica)',
              activo: true,
              createdAt: Date.now()
            });
            supplierIdMap[cp.supplierId] = newSuppId;
            supplierNameMap[newSuppId] = cp.supplierName;
          }
        }
      }
      for (const vt of data.ventasHistoricas) {
        if (vt.isNewCustomer && vt.customerName) {
          const foundKey = Object.keys(customerIdMap).find(k => k === vt.customerId);
          if (!foundKey) {
            const custRef = doc(collection(db, 'customers'));
            const newCustId = custRef.id;
            transaction.set(doc(db, 'customers', newCustId), {
              id: newCustId,
              nombre: vt.customerName,
              razonSocial: vt.customerName,
              cuit: '',
              telefono: '',
              email: '',
              direccion: '',
              observaciones: 'Creado desde el Asistente de Carga (Venta Histórica)',
              activo: true,
              createdAt: Date.now()
            });
            customerIdMap[vt.customerId] = newCustId;
            customerNameMap[newCustId] = vt.customerName;
          }
        }
      }

      // ==========================================
      // FILOSOFÍA DE MIGRACIÓN:
      // 1. El stock operativo inicial surge EXCLUSIVAMENTE de los Pasos 6 y 7.
      // 2. Las compras históricas (Paso 8) NO modifican el stock ni recalculan el costoActual.
      //    Se registran únicamente para estadísticas, historial comercial y cuentas corrientes.
      // 3. Las ventas históricas (Paso 9) NO descuentan stock ni generan producción ni stock_movements.
      //    Se registran únicamente para estadísticas, historial de márgenes y cuentas corrientes.
      // ==========================================

      // 6. Procesar Stocks de Materias Primas e Insumos (Paso 6)
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
          observaciones: `Stock Inicial MP al ${data.fechaCorte.split('-').reverse().slice(0,2).join('/')}`,
          isDeleted: false
        };

        transaction.set(movRef, stockMov);
        transaction.update(prodRef, {
          stockActual: st.stockFisico,
          costoActual: st.costoUnitario || 0,
          costoUltimaCompra: st.costoUnitario || 0,
          fechaUltimaCompra: dateIso
        });
      }

      // 7. Procesar Stock de Presentaciones Terminadas (Paso 7)
      for (const pres of data.presentaciones) {
        if (pres.cantidad <= 0) continue;

        const prodRef = doc(db, 'products', pres.productId);
        const movRef = doc(collection(db, 'stock_movements'));
        const stockFisicoKg = pres.unidadMedida === 'KG' ? pres.cantidad * pres.pesoPromedio : pres.cantidad;

        const stockMov: StockMovement = {
          id: movRef.id,
          productId: pres.productId,
          qty: stockFisicoKg,
          type: 'AJUSTE',
          date: dateIso,
          referenceId: 'MIGRACION_INICIAL',
          observaciones: `Stock Inicial Presentación (Cant: ${pres.cantidad} u, Peso Promedio: ${pres.pesoPromedio} ${pres.unidadMedida}) al ${data.fechaCorte.split('-').reverse().slice(0,2).join('/')}`,
          isDeleted: false
        };

        transaction.set(movRef, stockMov);
        transaction.update(prodRef, {
          stockActual: stockFisicoKg,
          precioComercial: pres.precioVenta || 0
        });
      }

      // 8. Procesar Compras Históricas detalladas (Paso 8 - SIN impactar stock ni costos de productos)
      for (const cp of data.comprasHistoricas) {
        if (cp.total <= 0) continue;
        const purchaseId = doc(collection(db, 'purchases')).id;
        const mappedItems = cp.items.map(it => ({
          productId: it.productId,
          type: 'MERCADERIA' as const,
          quantity: it.cantidad,
          unit: (it.unidad || 'UNIDADES') as UnitType,
          unitCost: it.costoUnitario,
          totalCost: it.subtotal
        }));

        const newPurchase: Purchase = {
          id: purchaseId,
          type: 'PURCHASE',
          supplierId: supplierIdMap[cp.supplierId] || cp.supplierId,
          date: new Date(cp.date + 'T12:00:00.000Z').toISOString(),
          items: mappedItems,
          subtotal: cp.total,
          impuestos: 0,
          total: cp.total,
          paymentMethod: cp.estado === 'PAGADA' ? 'CONTADO' : cp.estado === 'PENDIENTE' ? 'CUENTA_CORRIENTE' : 'MIXTA',
          montoPagado: cp.pagado,
          montoCuentaCorriente: cp.total - cp.pagado,
          status: 'ACTIVE',
          isDeleted: false,
          isHistorical: true
        };
        transaction.set(doc(db, 'purchases', purchaseId), newPurchase);

        // Movimiento de Pago si corresponde
        if (cp.pagado > 0) {
          if (cp.paymentType === 'APORTE_SOCIO' && cp.socioId) {
            // Generar aporte de socio en lugar de egreso en caja
            const mappedShId = shareholderIdMap[cp.socioId] || cp.socioId;
            const movId = doc(collection(db, 'shareholder_movements')).id;
            const newMov: ShareholderMovement = {
              id: movId,
              shareholderId: mappedShId,
              date: new Date(cp.date + 'T12:00:00.000Z').toISOString(),
              sourceType: 'APORTE',
              sourceId: movId,
              reversalOf: null,
              amount: cp.pagado,
              description: `Aporte por pago de compra: ${cp.observaciones || ''}`.trim() || 'Aporte por Pago de Compra',
              isDeleted: false
            };
            transaction.set(doc(db, 'shareholder_movements', movId), newMov);
          } else if (cp.cuentaId) {
            // Pago normal con Cuenta Financiera (egreso de caja)
            const cajaMovRef = doc(collection(db, 'caja_movements'));
            const realCuentaId = accountIdMap[cp.cuentaId] || cp.cuentaId;
            transaction.set(cajaMovRef, {
              id: cajaMovRef.id,
              type: 'EXPENSE',
              amount: cp.pagado,
              date: new Date(cp.date + 'T12:00:00.000Z').toISOString(),
              category: 'PAGO_PROVEEDOR',
              description: `Pago compra histórica detallada. Ref: ${purchaseId}`,
              referenceId: purchaseId,
              accountId: realCuentaId,
              isDeleted: false
            });
          }
        }

        // Deuda con proveedor si hay saldo pendiente
        const saldoPendiente = cp.total - cp.pagado;
        if (saldoPendiente > 0) {
          const supMovRef = doc(collection(db, 'supplier_movements'));
          transaction.set(supMovRef, {
            id: supMovRef.id,
            supplierId: supplierIdMap[cp.supplierId] || cp.supplierId,
            date: new Date(cp.date + 'T12:00:00.000Z').toISOString(),
            type: 'COMPRA',
            amount: saldoPendiente,
            observaciones: `Compra histórica detallada a cuenta corriente. Ref: ${purchaseId}`,
            sourceType: 'COMPRA',
            sourceId: purchaseId,
            reversalOf: null,
            isDeleted: false
          });
        }
      }

      // 9. Procesar Ventas Históricas detalladas (Paso 9 - SIN impactar stock)
      for (const vt of data.ventasHistoricas) {
        if (vt.total <= 0) continue;
        const saleId = doc(collection(db, 'sales')).id;
        const mappedItems = vt.items.map(it => ({
          productId: it.productId,
          cantidad: it.cantidad,
          unidad: 'UNIDADES' as const,
          precioUnitario: it.precioUnitario,
          subtotal: it.subtotal,
          costoUnitario: it.costoUnitario,
          costoTotal: it.costoUnitario * it.cantidad,
          rentabilidadBruta: it.subtotal - (it.costoUnitario * it.cantidad),
          pesoReal: it.cantidad,
          precioRealKg: it.precioUnitario,
          importeReal: it.subtotal,
          costoUnitarioHistorico: it.costoUnitario,
          costoTotalHistorico: it.costoUnitario * it.cantidad
        }));

        const newSale: Sale = {
          id: saleId,
          customerId: customerIdMap[vt.customerId] || vt.customerId,
          date: new Date(vt.date + 'T12:00:00.000Z').toISOString(),
          items: mappedItems,
          totalAmount: vt.total,
          status: vt.estado === 'COBRADA' ? 'COBRADO' : 'PENDIENTE',
          paymentMethod: vt.estado === 'COBRADA' ? 'EFECTIVO_TRANSFERENCIA' : vt.estado === 'PENDIENTE' ? 'CUENTA_CORRIENTE' : 'PENDIENTE',
          isDeleted: false,
          isHistorical: true,
          deliveryStatus: vt.deliveryStatus || 'ENTREGADO'
        };
        transaction.set(doc(db, 'sales', saleId), newSale);

        // Cuenta corriente cliente si hay saldo pendiente
        const saldoPendiente = vt.total - vt.cobrado;
        if (saldoPendiente > 0) {
          const ccMovRef = doc(collection(db, 'customer_movements'));
          transaction.set(ccMovRef, {
            id: ccMovRef.id,
            customerId: customerIdMap[vt.customerId] || vt.customerId,
            date: new Date(vt.date + 'T12:00:00.000Z').toISOString(),
            type: 'DEUDA',
            amount: saldoPendiente,
            referenceId: saleId,
            observaciones: `Venta histórica detallada a cuenta corriente. Ref: ${saleId}`,
            isDeleted: false
          });
        }
      }

      // 10. Aportes de Socios (Paso 2)
      for (const ap of data.aportes) {
        const mappedShId = shareholderIdMap[ap.shareholderId] || ap.shareholderId;
        const realName = shareholderNameMap[mappedShId] || 'Socio';

        if (ap.movements) {
          for (const m of ap.movements) {
            if (m.amount <= 0) continue;
            const movDateIso = new Date(m.date + 'T12:00:00.000Z').toISOString();

            if (m.tipo === 'APORTE') {
              const movId = doc(collection(db, 'shareholder_movements')).id;
              const newMov: ShareholderMovement = {
                id: movId,
                shareholderId: mappedShId,
                date: movDateIso,
                sourceType: 'APORTE',
                sourceId: movId,
                reversalOf: null,
                amount: m.amount,
                description: m.tipoAporte === 'BIEN'
                  ? `Aporte de Bien: ${m.descripcionBien || m.concepto}`
                  : (m.concepto || 'Aporte de Capital Inicial'),
                isDeleted: false,
                tipoAporte: m.tipoAporte || 'DINERO',
                descripcionBien: m.descripcionBien || ''
              };
              transaction.set(doc(db, 'shareholder_movements', movId), newMov);
            } else if (m.tipo === 'PRESTAMO') {
              const loanRef = doc(collection(db, 'shareholder_loans'));
              const newLoan: ShareholderLoan = {
                id: loanRef.id,
                shareholderId: mappedShId,
                shareholderName: realName,
                amount: m.amount,
                date: movDateIso,
                description: m.concepto || 'Préstamo de Socio Inicial',
                remainingAmount: m.amount,
                status: 'PENDIENTE',
                payments: [],
                isDeleted: false
              };
              transaction.set(loanRef, newLoan);
            }
          }
        }
      }

      // 11. Cajas / Cuentas Financieras saldos iniciales (Paso 3)
      for (const cj of data.cajaInicial) {
        const mappedAccId = accountIdMap[cj.accountId] || cj.accountId;
        if (cj.amount <= 0) continue;
        const cajaMovRef = doc(collection(db, 'caja_movements'));
        const cajaMov: CajaMovement = {
          id: cajaMovRef.id,
          type: 'INCOME',
          amount: cj.amount,
          date: dateIso,
          category: 'SALDO_INICIAL',
          description: `Saldo de Apertura al ${data.fechaCorte.split('-').reverse().slice(0,2).join('/')}`,
          operation: 'MOVEMENT',
          accountId: mappedAccId,
          isDeleted: false
        };
        transaction.set(cajaMovRef, cajaMov);
      }

      // 12. Clientes con saldo pendiente inicial (Paso 4)
      for (const cl of data.clientesIniciales) {
        const mappedCustId = customerIdMap[cl.customerId] || cl.customerId;
        if (cl.saldo <= 0) continue;
        const ccMovRef = doc(collection(db, 'customer_movements'));
        transaction.set(ccMovRef, {
          id: ccMovRef.id,
          customerId: mappedCustId,
          date: dateIso,
          type: 'DEUDA',
          amount: cl.saldo,
          observaciones: cl.observaciones || `Saldo inicial de migración`,
          isDeleted: false
        });
      }

      // 13. Proveedores con saldo pendiente inicial (Paso 5)
      for (const pr of data.proveedoresIniciales) {
        const mappedSuppId = supplierIdMap[pr.supplierId] || pr.supplierId;
        if (pr.saldo <= 0) continue;
        const supMovRef = doc(collection(db, 'supplier_movements'));
        transaction.set(supMovRef, {
          id: supMovRef.id,
          supplierId: mappedSuppId,
          date: dateIso,
          type: 'AJUSTE', // Usamos AJUSTE para deudas iniciales directas de proveedores
          amount: pr.saldo, // Positivo incrementa deuda
          observaciones: pr.observaciones || `Deuda inicial de migración`,
          sourceType: 'AJUSTE',
          sourceId: supMovRef.id,
          reversalOf: null,
          isDeleted: false
        });
      }

      // 14. Crear cuenta financiera de "AJUSTE DE MIGRACIÓN" si hay diferencia de balance y registrar el descuadre
      if (data.ajusteDiferenciaBalance && Math.abs(data.ajusteDiferenciaBalance) > 0.01) {
        const adjustAccRef = doc(collection(db, 'financial_accounts'));
        const adjustAccId = adjustAccRef.id;
        
        // Crear cuenta
        transaction.set(doc(db, 'financial_accounts', adjustAccId), {
          id: adjustAccId,
          nombre: "Ajuste de Migración",
          tipo: "EFECTIVO",
          activa: true,
          createdAt: Date.now()
        });

        // Registrar movimiento de diferencia en caja para cuadrar balance general
        const diffMovRef = doc(collection(db, 'caja_movements'));
        transaction.set(diffMovRef, {
          id: diffMovRef.id,
          type: data.ajusteDiferenciaBalance > 0 ? 'EXPENSE' : 'INCOME', // Compensatorio para el balance general
          amount: Math.abs(data.ajusteDiferenciaBalance),
          date: dateIso,
          category: 'SALDO_INICIAL',
          description: `Compensación de balance general descuadrado en migración`,
          operation: 'MOVEMENT',
          accountId: adjustAccId,
          isDeleted: false
        });
      }

      // 15. Guardar fecha de corte en settings global
      const globalSettingsRef = doc(db, 'settings', 'global');
      transaction.set(globalSettingsRef, {
        fechaCorteMigration: data.fechaCorte
      }, { merge: true });

      // 16. Registrar finalización de carga inicial
      transaction.set(statusRef, {
        executed: true,
        executedAt: new Date().toISOString(),
        version: 1
      });
    });
  },

  async executeSaldosAdjustment(data: InitialLoadData, currentBalances: {
    accounts: Record<string, number>;
    customers: Record<string, number>;
    suppliers: Record<string, number>;
    products: Record<string, number>;
  }): Promise<void> {
    const dateIso = new Date(data.fechaCorte + 'T12:00:00.000Z').toISOString();

    await runTransaction(db, async (transaction) => {
      // 1. Crear nuevas cuentas/clientes/proveedores/socios inline si aplica (igual que Modo A)
      const accountIdMap: Record<string, string> = {};
      for (const cj of data.cajaInicial) {
        if (cj.isNewAccount && cj.accountName) {
          const accRef = doc(collection(db, 'financial_accounts'));
          const newAccId = accRef.id;
          transaction.set(accRef, {
            id: newAccId,
            nombre: cj.accountName,
            tipo: cj.accountType || 'EFECTIVO',
            activa: true,
            createdAt: Date.now()
          });
          accountIdMap[cj.accountId] = newAccId;
        } else {
          accountIdMap[cj.accountId] = cj.accountId;
        }
      }

      const customerIdMap: Record<string, string> = {};
      for (const cl of data.clientesIniciales) {
        if (cl.isNewCustomer && cl.customerName) {
          const custRef = doc(collection(db, 'customers'));
          const newCustId = custRef.id;
          transaction.set(custRef, {
            id: newCustId,
            nombre: cl.customerName,
            razonSocial: cl.customerName,
            cuit: '', telefono: '', email: '', direccion: '', observaciones: 'Creado desde Ajuste de Saldos', activo: true, createdAt: Date.now()
          });
          customerIdMap[cl.customerId] = newCustId;
        } else {
          customerIdMap[cl.customerId] = cl.customerId;
        }
      }

      const supplierIdMap: Record<string, string> = {};
      for (const pr of data.proveedoresIniciales) {
        if (pr.isNewSupplier && pr.supplierName) {
          const suppRef = doc(collection(db, 'suppliers'));
          const newSuppId = suppRef.id;
          transaction.set(suppRef, {
            id: newSuppId,
            nombre: pr.supplierName,
            razonSocial: pr.supplierName,
            cuit: '', telefono: '', email: '', direccion: '', observaciones: 'Creado desde Ajuste de Saldos', activo: true, createdAt: Date.now()
          });
          supplierIdMap[pr.supplierId] = newSuppId;
        } else {
          supplierIdMap[pr.supplierId] = pr.supplierId;
        }
      }

      // 2. Ajuste de Caja y Cuentas Financieras
      for (const cj of data.cajaInicial) {
        const realAccountId = accountIdMap[cj.accountId] || cj.accountId;
        const currentAmount = currentBalances.accounts[realAccountId] || 0;
        const targetAmount = cj.amount;
        const diff = targetAmount - currentAmount;

        if (Math.abs(diff) > 0.01) {
          const cajaMovRef = doc(collection(db, 'caja_movements'));
          transaction.set(cajaMovRef, {
            id: cajaMovRef.id,
            type: diff > 0 ? 'INCOME' : 'EXPENSE',
            amount: Math.abs(diff),
            date: dateIso,
            category: 'SALDO_INICIAL_MIGRACION',
            description: `Ajuste compensatorio de saldo de cuenta. Deseado: $${targetAmount}, Actual: $${currentAmount}`,
            operation: 'MOVEMENT',
            accountId: realAccountId,
            isDeleted: false
          });
        }
      }

      // 3. Ajuste de Cuentas Corrientes Clientes
      for (const cl of data.clientesIniciales) {
        const realCustomerId = customerIdMap[cl.customerId] || cl.customerId;
        const currentCc = currentBalances.customers[realCustomerId] || 0;
        const targetCc = cl.saldo;
        const diff = targetCc - currentCc;

        if (Math.abs(diff) > 0.01) {
          const ccMovRef = doc(collection(db, 'customer_movements'));
          transaction.set(ccMovRef, {
            id: ccMovRef.id,
            customerId: realCustomerId,
            date: dateIso,
            type: 'AJUSTE',
            amount: diff, // Positivo suma deuda, negativo resta deuda
            observaciones: cl.observaciones || `SALDO_INICIAL_MIGRACION: Ajuste de cuenta corriente por diferencia. Deseado: $${targetCc}, Actual: $${currentCc}`,
            isDeleted: false
          });
        }
      }

      // 4. Ajuste de Cuentas Corrientes Proveedores
      for (const pr of data.proveedoresIniciales) {
        const realSupplierId = supplierIdMap[pr.supplierId] || pr.supplierId;
        const currentCc = currentBalances.suppliers[realSupplierId] || 0;
        const targetCc = pr.saldo;
        const diff = targetCc - currentCc;

        if (Math.abs(diff) > 0.01) {
          const supMovRef = doc(collection(db, 'supplier_movements'));
          transaction.set(supMovRef, {
            id: supMovRef.id,
            supplierId: realSupplierId,
            date: dateIso,
            type: 'AJUSTE',
            amount: diff, // Positivo incrementa deuda, negativo la reduce
            observaciones: pr.observaciones || `SALDO_INICIAL_MIGRACION: Ajuste de deuda por diferencia. Deseado: $${targetCc}, Actual: $${currentCc}`,
            sourceType: 'AJUSTE',
            sourceId: supMovRef.id,
            reversalOf: null,
            isDeleted: false
          });
        }
      }

      // 5. Ajuste de Stock Materias Primas e Insumos
      for (const st of data.stocks) {
        const currentStock = currentBalances.products[st.productId] || 0;
        const targetStock = st.stockFisico;
        const diff = targetStock - currentStock;

        if (Math.abs(diff) > 0.001) {
          const prodRef = doc(db, 'products', st.productId);
          const movRef = doc(collection(db, 'stock_movements'));

          transaction.set(movRef, {
            id: movRef.id,
            productId: st.productId,
            qty: diff,
            type: 'AJUSTE',
            date: dateIso,
            referenceId: 'SALDO_INICIAL_MIGRACION',
            observaciones: `Ajuste de stock físico. Deseado: ${targetStock}, Actual: ${currentStock}`,
            isDeleted: false
          });

          transaction.update(prodRef, {
            stockActual: targetStock,
            costoActual: st.costoUnitario || 0
          });
        }
      }

      // 6. Ajuste de Stock de Presentaciones Terminadas
      for (const pres of data.presentaciones) {
        const currentStock = currentBalances.products[pres.productId] || 0;
        const targetStock = pres.unidadMedida === 'KG' ? pres.cantidad * pres.pesoPromedio : pres.cantidad;
        const diff = targetStock - currentStock;

        if (Math.abs(diff) > 0.001) {
          const prodRef = doc(db, 'products', pres.productId);
          const movRef = doc(collection(db, 'stock_movements'));

          transaction.set(movRef, {
            id: movRef.id,
            productId: pres.productId,
            qty: diff,
            type: 'AJUSTE',
            date: dateIso,
            referenceId: 'SALDO_INICIAL_MIGRACION',
            observaciones: `Ajuste de presentaciones terminadas. Deseada: ${pres.cantidad} u (${targetStock} kg), Actual: ${currentStock} kg`,
            isDeleted: false
          });

          transaction.update(prodRef, {
            stockActual: targetStock,
            precioComercial: pres.precioVenta || 0
          });
        }
      }

      // 7. Crear o actualizar la cuenta financiera de "AJUSTE DE MIGRACIÓN" si aplica
      if (data.ajusteDiferenciaBalance && Math.abs(data.ajusteDiferenciaBalance) > 0.01) {
        const diffMovRef = doc(collection(db, 'caja_movements'));
        // Buscamos si ya existe la cuenta
        const adjustAccRef = doc(collection(db, 'financial_accounts'));
        const adjustAccId = adjustAccRef.id;

        transaction.set(doc(db, 'financial_accounts', adjustAccId), {
          id: adjustAccId,
          nombre: "Ajuste de Migración",
          tipo: "EFECTIVO",
          activa: true,
          createdAt: Date.now()
        });

        transaction.set(diffMovRef, {
          id: diffMovRef.id,
          type: data.ajusteDiferenciaBalance > 0 ? 'EXPENSE' : 'INCOME',
          amount: Math.abs(data.ajusteDiferenciaBalance),
          date: dateIso,
          category: 'AJUSTE_MIGRACION',
          description: `Compensación de balance general descuadrado en re-ejecución de ajuste`,
          operation: 'MOVEMENT',
          accountId: adjustAccId,
          isDeleted: false
        });
      }

      // 8. Actualizar fecha de corte en settings global
      const globalSettingsRef = doc(db, 'settings', 'global');
      transaction.set(globalSettingsRef, {
        fechaCorteMigration: data.fechaCorte
      }, { merge: true });
    });
  }
};
