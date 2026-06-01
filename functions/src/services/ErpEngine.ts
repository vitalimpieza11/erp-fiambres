import * as admin from 'firebase-admin';
import { randomUUID } from 'crypto';
import { calculateSaleTotals } from '../core/calculations';

export interface TransactionParams {
  type: 'SALE' | 'PURCHASE' | 'PRODUCTION';
  payload: any;
  userId: string;
  extra?: any;
}

export class ErpEngine {
  /**
   * Executes a transaction atomically using Firestore runTransaction.
   * Features:
   * - Authoritative eventId generation
   * - Strict server-side validation (Stock, Clients, Suppliers status)
   * - Concurrency locking (Logical Soft Lock with TTL)
   * - Observability audit logs (durationMs, snapshots before/after, severity levels)
   * - Safe retry loops (native Firestore transactions retry automatically on collisions)
   */
  static async executeTransaction(params: TransactionParams, db: admin.firestore.Firestore): Promise<string> {
    const startTime = Date.now();
    const eventId = randomUUID();
    const { type, payload, userId, extra } = params;

    const eventLogRef = db.collection('erp_event_log').doc(eventId);
    const affectedCollections: string[] = [];



    try {
      let resultId = '';
      const snapshotsBefore: Record<string, any> = {};
      const snapshotsAfter: Record<string, any> = {};

      await db.runTransaction(async (transaction) => {
        if (type === 'SALE') {
          const salePayload = payload;
          const discountPercent = Number(extra?.discountPercent || 0);
          const shippingCost = Number(extra?.shippingCost || 0);

          // --- READS PHASE ---
          const customerRef = db.collection('customers').doc(salePayload.customerId);
          const customerSnap = await transaction.get(customerRef);

          const lockRefs = salePayload.items.map((item: any) => db.collection('locks').doc(item.productId));
          const lockSnaps = await Promise.all(lockRefs.map((ref: any) => transaction.get(ref)));

          const stockQueries = salePayload.items.map((item: any) => 
            db.collection('stock_movements').where('productId', '==', item.productId)
          );
          const stockSnaps = await Promise.all(stockQueries.map((q: any) => transaction.get(q)));

          // --- VALIDATIONS PHASE ---
          if (!customerSnap.exists) {
            throw new Error(`Validación fallida: El cliente no existe.`);
          }
          const customerData = customerSnap.data();
          if (customerData && !customerData.isActive) {
            throw new Error(`Validación fallida: El cliente ${customerData.name} se encuentra inactivo.`);
          }

          const availableStocks: Record<string, number> = {};
          for (let i = 0; i < salePayload.items.length; i++) {
            const item = salePayload.items[i];
            const lockSnap = lockSnaps[i];
            
            if (lockSnap.exists) {
              const lockData = lockSnap.data();
              if (lockData && Date.now() - Number(lockData.timestamp) < 15000) {
                throw new Error(`Producto bloqueado temporalmente por control de concurrencia. Reintente en unos segundos.`);
              }
            }

            let totalStock = 0;
            stockSnaps[i].forEach((doc: any) => {
              totalStock += Number(doc.data().quantity || 0);
            });
            const availableStock = Number(totalStock.toFixed(3));
            availableStocks[item.productId] = availableStock;

            const qty = Number(item.quantity);
            if (availableStock < qty) {
              throw new Error(`Validación de stock fallida: Stock insuficiente para ${item.productName}. Disponible: ${availableStock} kg/un, Requerido: ${qty} kg/un.`);
            }

            snapshotsBefore[item.productId] = { stock: availableStock };
            snapshotsAfter[item.productId] = { stock: Number((availableStock - qty).toFixed(3)) };
          }

          // --- WRITES PHASE ---
          for (let i = 0; i < salePayload.items.length; i++) {
            const item = salePayload.items[i];
            const lockRef = lockRefs[i];
            transaction.set(lockRef, {
              productId: item.productId,
              lockedBy: userId,
              timestamp: Date.now()
            });
            if (!affectedCollections.includes('locks')) affectedCollections.push('locks');
          }

          const normalizedItems = salePayload.items.map((item: any) => ({
            quantity: Number(item.quantity),
            price: Number(item.price),
            cost: Number(item.cost)
          }));
          const calc = calculateSaleTotals(normalizedItems, discountPercent, shippingCost);

          const saleRef = db.collection('sales').doc();
          resultId = saleRef.id;
          affectedCollections.push('sales');

          const newSale = {
            ...salePayload,
            subtotal: calc.subtotal,
            total: calc.total,
            eventId,
            userId,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          transaction.set(saleRef, newSale);

          for (const item of salePayload.items) {
            const stockMovRef = db.collection('stock_movements').doc();
            affectedCollections.push('stock_movements');

            const movement = {
              productId: item.productId,
              productName: item.productName,
              quantity: -Math.abs(Number(item.quantity)),
              type: 'out',
              referenceType: 'sale',
              referenceId: resultId,
              date: Date.now(),
              observations: `Venta Comprobante: ${salePayload.remitoNumber || 'Sin remito'} (Cloud Function API)`,
              createdAt: Date.now()
            };
            transaction.set(stockMovRef, movement);
          }

          if (salePayload.status === 'completed' || salePayload.paymentStatus === 'paid') {
            const cashMovRef = db.collection('cash_movements').doc();
            affectedCollections.push('cash_movements');

            const cashMovement = {
              type: 'in',
              amount: calc.total,
              method: salePayload.paymentMethod || 'cash',
              description: `Cobro Venta ${salePayload.customerName} (Ref: ${salePayload.remitoNumber || resultId})`,
              category: 'sale',
              referenceId: resultId,
              date: Date.now(),
              createdAt: Date.now()
            };
            transaction.set(cashMovRef, cashMovement);
          }

        } else if (type === 'PURCHASE') {
          const purchasePayload = payload;

          // --- READS PHASE ---
          const supplierRef = db.collection('suppliers').doc(purchasePayload.supplierId);
          const supplierSnap = await transaction.get(supplierRef);

          const stockQueries = purchasePayload.items.map((item: any) => 
            db.collection('stock_movements').where('productId', '==', item.productId)
          );
          const stockSnaps = await Promise.all(stockQueries.map((q: any) => transaction.get(q)));

          // --- VALIDATIONS PHASE ---
          if (!supplierSnap.exists) {
            throw new Error(`Validación fallida: El proveedor no existe.`);
          }
          const supplierData = supplierSnap.data();
          if (supplierData && !supplierData.isActive) {
            throw new Error(`Validación fallida: El proveedor ${supplierData.name} se encuentra inactivo.`);
          }

          const currentStocks: Record<string, number> = {};
          for (let i = 0; i < purchasePayload.items.length; i++) {
            const item = purchasePayload.items[i];
            let totalStock = 0;
            stockSnaps[i].forEach((doc: any) => {
              totalStock += Number(doc.data().quantity || 0);
            });
            const currentStock = Number(totalStock.toFixed(3));
            currentStocks[item.productId] = currentStock;

            snapshotsBefore[item.productId] = { stock: currentStock };
            snapshotsAfter[item.productId] = { stock: Number((currentStock + Number(item.quantity)).toFixed(3)) };
          }

          // --- WRITES PHASE ---
          const purchaseRef = db.collection('purchases').doc();
          resultId = purchaseRef.id;
          affectedCollections.push('purchases');

          const newPurchase = {
            ...purchasePayload,
            eventId,
            userId,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          transaction.set(purchaseRef, newPurchase);

          for (const item of purchasePayload.items) {
            const stockMovRef = db.collection('stock_movements').doc();
            affectedCollections.push('stock_movements');

            const movement = {
              productId: item.productId,
              productName: item.productName,
              quantity: Math.abs(Number(item.quantity)),
              type: 'in',
              referenceType: 'purchase',
              referenceId: resultId,
              date: Date.now(),
              observations: `Compra Factura: ${purchasePayload.invoiceNumber || 'Sin número'} (Cloud Function API)`,
              createdAt: Date.now()
            };
            transaction.set(stockMovRef, movement);
          }

          if (purchasePayload.status === 'completed') {
            const cashMovRef = db.collection('cash_movements').doc();
            affectedCollections.push('cash_movements');

            const cashMovement = {
              type: 'out',
              amount: Number(purchasePayload.total),
              method: 'transfer',
              description: `Pago Compra Proveedor ${purchasePayload.supplierName} (Ref: ${purchasePayload.invoiceNumber || resultId})`,
              category: 'purchase',
              referenceId: resultId,
              date: Date.now(),
              createdAt: Date.now()
            };
            transaction.set(cashMovRef, cashMovement);
          }

        } else if (type === 'PRODUCTION') {
          const batchPayload = payload;
          const sourceProductId = extra?.sourceProductId;
          const sourceProductName = extra?.sourceProductName;
          const sourceProductQtyKg = Number(extra?.sourceProductQtyKg || 0);

          // --- READS PHASE ---
          const rawLockRef = db.collection('locks').doc(sourceProductId);
          const rawLockSnap = await transaction.get(rawLockRef);

          const rawStockQuery = db.collection('stock_movements').where('productId', '==', sourceProductId);
          const rawStockSnap = await transaction.get(rawStockQuery);

          const destStockQuery = db.collection('stock_movements').where('productId', '==', batchPayload.productId);
          const destStockSnap = await transaction.get(destStockQuery);

          // --- VALIDATIONS PHASE ---
          if (rawLockSnap.exists) {
            const lockData = rawLockSnap.data();
            if (lockData && Date.now() - Number(lockData.timestamp) < 15000) {
              throw new Error(`Producto bloqueado temporalmente por control de concurrencia. Reintente en unos segundos.`);
            }
          }

          let totalRawStock = 0;
          rawStockSnap.forEach((doc: any) => {
            totalRawStock += Number(doc.data().quantity || 0);
          });
          const rawStock = Number(totalRawStock.toFixed(3));
          snapshotsBefore[sourceProductId] = { stock: rawStock };

          if (rawStock < sourceProductQtyKg) {
            throw new Error(`Validación de materia prima fallida: Stock insuficiente para ${sourceProductName}. Disponible: ${rawStock} kg, Requerido: ${sourceProductQtyKg} kg.`);
          }
          snapshotsAfter[sourceProductId] = { stock: Number((rawStock - sourceProductQtyKg).toFixed(3)) };

          let totalDestStock = 0;
          destStockSnap.forEach((doc: any) => {
            totalDestStock += Number(doc.data().quantity || 0);
          });
          const destStock = Number(totalDestStock.toFixed(3));
          snapshotsBefore[batchPayload.productId] = { stock: destStock };
          snapshotsAfter[batchPayload.productId] = { stock: Number((destStock + Number(batchPayload.quantityProduced)).toFixed(3)) };

          // --- WRITES PHASE ---
          transaction.set(rawLockRef, {
            productId: sourceProductId,
            lockedBy: userId,
            timestamp: Date.now()
          });
          if (!affectedCollections.includes('locks')) affectedCollections.push('locks');

          const prodBatchRef = db.collection('production_batches').doc();
          resultId = prodBatchRef.id;
          affectedCollections.push('production_batches');

          const newBatch = {
            ...batchPayload,
            eventId,
            userId,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          transaction.set(prodBatchRef, newBatch);

          const sourceMovRef = db.collection('stock_movements').doc();
          affectedCollections.push('stock_movements');

          const sourceMovement = {
            productId: sourceProductId,
            productName: sourceProductName,
            quantity: -Math.abs(sourceProductQtyKg),
            type: 'out',
            referenceType: 'production',
            referenceId: resultId,
            date: Date.now(),
            observations: `Producción Lote Feteado: ${resultId} (Descuento Horma) (Cloud Function API)`,
            createdAt: Date.now()
          };
          transaction.set(sourceMovRef, sourceMovement);

          const targetMovRef = db.collection('stock_movements').doc();
          affectedCollections.push('stock_movements');

          const targetMovement = {
            productId: batchPayload.productId,
            productName: batchPayload.productName,
            quantity: Math.abs(Number(batchPayload.quantityProduced)),
            type: 'in',
            referenceType: 'production',
            referenceId: resultId,
            date: Date.now(),
            observations: `Producción Lote Feteado: ${resultId} (Ingreso Paquetes) (Cloud Function API)`,
            createdAt: Date.now()
          };
          transaction.set(targetMovRef, targetMovement);
        }

        // 7. WRITE SUCCESS EVENT LOG
        affectedCollections.push('erp_event_log');
        const durationMs = Date.now() - startTime;
        
        const logData = {
          eventId,
          userId,
          type,
          timestamp: Date.now(),
          status: 'success',
          affectedCollections,
          durationMs,
          snapshotsBefore,
          snapshotsAfter,
          severity: 'info'
        };
        transaction.set(eventLogRef, logData);
      });

      return resultId;
    } catch (err: any) {
      console.error('Transaction Failed in Backend:', err);
      const durationMs = Date.now() - startTime;

      // Persist failure trace in event log for observability
      try {
        const errorLog = {
          eventId,
          userId,
          type,
          timestamp: Date.now(),
          status: 'failed',
          affectedCollections,
          durationMs,
          snapshotsBefore: {},
          snapshotsAfter: {},
          severity: 'error',
          error: err.message || 'Error desconocido'
        };
        await eventLogRef.set(errorLog);
      } catch (logErr) {
        console.error('Failed to write failure observability log:', logErr);
      }

      throw err;
    }
  }
}
export default ErpEngine;
