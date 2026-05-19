"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErpEngine = void 0;
const crypto_1 = require("crypto");
const calculations_1 = require("../core/calculations");
class ErpEngine {
    /**
     * Executes a transaction atomically using Firestore runTransaction.
     * Features:
     * - Authoritative eventId generation
     * - Strict server-side validation (Stock, Clients, Suppliers status)
     * - Concurrency locking (Logical Soft Lock with TTL)
     * - Observability audit logs (durationMs, snapshots before/after, severity levels)
     * - Safe retry loops (native Firestore transactions retry automatically on collisions)
     */
    static async executeTransaction(params, db) {
        const startTime = Date.now();
        const eventId = (0, crypto_1.randomUUID)();
        const { type, payload, userId, extra } = params;
        const eventLogRef = db.collection('erp_event_log').doc(eventId);
        const affectedCollections = [];
        // Helper to fetch stock within a transaction to guarantee consistency
        const getStockTx = async (productId, transaction) => {
            const q = db.collection('stock_movements').where('productId', '==', productId);
            const snap = await transaction.get(q);
            let totalStock = 0;
            snap.forEach((doc) => {
                totalStock += Number(doc.data().quantity || 0);
            });
            return Number(totalStock.toFixed(3));
        };
        // Helper to evaluate and apply logical soft lock inside a transaction
        const evaluateSoftLockTx = async (productId, transaction) => {
            const lockRef = db.collection('locks').doc(productId);
            const lockSnap = await transaction.get(lockRef);
            if (lockSnap.exists) {
                const lockData = lockSnap.data();
                if (lockData && Date.now() - Number(lockData.timestamp) < 15000) {
                    // Locked within 15 seconds by another transaction
                    throw new Error(`Producto bloqueado temporalmente por control de concurrencia. Reintente en unos segundos.`);
                }
            }
            // Apply the lock
            transaction.set(lockRef, {
                productId,
                lockedBy: userId,
                timestamp: Date.now()
            });
            if (!affectedCollections.includes('locks'))
                affectedCollections.push('locks');
        };
        try {
            let resultId = '';
            const snapshotsBefore = {};
            const snapshotsAfter = {};
            await db.runTransaction(async (transaction) => {
                if (type === 'SALE') {
                    const salePayload = payload;
                    const discountPercent = Number(extra?.discountPercent || 0);
                    const shippingCost = Number(extra?.shippingCost || 0);
                    // 1. READ & VALIDATE CUSTOMER STATUS
                    const customerRef = db.collection('customers').doc(salePayload.customerId);
                    const customerSnap = await transaction.get(customerRef);
                    if (!customerSnap.exists) {
                        throw new Error(`Validación fallida: El cliente no existe.`);
                    }
                    const customerData = customerSnap.data();
                    if (customerData && !customerData.isActive) {
                        throw new Error(`Validación fallida: El cliente ${customerData.name} se encuentra inactivo.`);
                    }
                    // 2. READ & VALIDATE STOCK levels + Concurrency Lock
                    for (const item of salePayload.items) {
                        // Apply soft lock to prevent race conditions
                        await evaluateSoftLockTx(item.productId, transaction);
                        // Fetch and check stock
                        const availableStock = await getStockTx(item.productId, transaction);
                        snapshotsBefore[item.productId] = { stock: availableStock };
                        const qty = Number(item.quantity);
                        if (availableStock < qty) {
                            throw new Error(`Validación de stock fallida: Stock insuficiente para ${item.productName}. Disponible: ${availableStock} kg/un, Requerido: ${qty} kg/un.`);
                        }
                        snapshotsAfter[item.productId] = { stock: Number((availableStock - qty).toFixed(3)) };
                    }
                    // 3. CALCULATE Totals
                    const normalizedItems = salePayload.items.map((item) => ({
                        quantity: Number(item.quantity),
                        price: Number(item.price),
                        cost: Number(item.cost)
                    }));
                    const calc = (0, calculations_1.calculateSaleTotals)(normalizedItems, discountPercent, shippingCost);
                    // 4. WRITE Sale Document
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
                    // 5. WRITE Stock Movements (outputs)
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
                    // 6. WRITE Cash Movement if paid/completed
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
                }
                else if (type === 'PURCHASE') {
                    const purchasePayload = payload;
                    // 1. READ & VALIDATE SUPPLIER STATUS
                    const supplierRef = db.collection('suppliers').doc(purchasePayload.supplierId);
                    const supplierSnap = await transaction.get(supplierRef);
                    if (!supplierSnap.exists) {
                        throw new Error(`Validación fallida: El proveedor no existe.`);
                    }
                    const supplierData = supplierSnap.data();
                    if (supplierData && !supplierData.isActive) {
                        throw new Error(`Validación fallida: El proveedor ${supplierData.name} se encuentra inactivo.`);
                    }
                    // 2. WRITE Purchase Document
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
                    // 3. WRITE Stock Movements (inputs)
                    for (const item of purchasePayload.items) {
                        const stockMovRef = db.collection('stock_movements').doc();
                        affectedCollections.push('stock_movements');
                        const currentStock = await getStockTx(item.productId, transaction);
                        snapshotsBefore[item.productId] = { stock: currentStock };
                        snapshotsAfter[item.productId] = { stock: Number((currentStock + Number(item.quantity)).toFixed(3)) };
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
                    // 4. WRITE Cash Movement (egreso) if completed
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
                }
                else if (type === 'PRODUCTION') {
                    const batchPayload = payload;
                    const sourceProductId = extra?.sourceProductId;
                    const sourceProductName = extra?.sourceProductName;
                    const sourceProductQtyKg = Number(extra?.sourceProductQtyKg || 0);
                    // 1. READ & VALIDATE RAW MATERIALS STOCK + Concurrency Lock
                    await evaluateSoftLockTx(sourceProductId, transaction);
                    const rawStock = await getStockTx(sourceProductId, transaction);
                    snapshotsBefore[sourceProductId] = { stock: rawStock };
                    if (rawStock < sourceProductQtyKg) {
                        throw new Error(`Validación de materia prima fallida: Stock insuficiente para ${sourceProductName}. Disponible: ${rawStock} kg, Requerido: ${sourceProductQtyKg} kg.`);
                    }
                    snapshotsAfter[sourceProductId] = { stock: Number((rawStock - sourceProductQtyKg).toFixed(3)) };
                    // Get destination product stock before production
                    const destStock = await getStockTx(batchPayload.productId, transaction);
                    snapshotsBefore[batchPayload.productId] = { stock: destStock };
                    snapshotsAfter[batchPayload.productId] = { stock: Number((destStock + Number(batchPayload.quantityProduced)).toFixed(3)) };
                    // 2. WRITE ProductionBatch Document
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
                    // 3. WRITE Stock Movement for raw material (decrement)
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
                    // 4. WRITE Stock Movement for packages (increment)
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
        }
        catch (err) {
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
            }
            catch (logErr) {
                console.error('Failed to write failure observability log:', logErr);
            }
            throw err;
        }
    }
}
exports.ErpEngine = ErpEngine;
exports.default = ErpEngine;
//# sourceMappingURL=ErpEngine.js.map