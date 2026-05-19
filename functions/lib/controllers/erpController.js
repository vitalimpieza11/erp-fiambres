"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErpController = void 0;
const admin = require("firebase-admin");
const ErpEngine_1 = require("../services/ErpEngine");
const StockService_1 = require("../services/StockService");
class ErpController {
    static async createSale(req, res) {
        try {
            const db = admin.firestore();
            const { payload, userId, extra } = req.body;
            if (!payload) {
                res.status(400).json({ success: false, error: 'Falta parámetro obligatorio payload.' });
                return;
            }
            const saleId = await ErpEngine_1.ErpEngine.executeTransaction({
                type: 'SALE',
                payload,
                userId: userId || 'anonymous',
                extra
            }, db);
            res.status(200).json({ success: true, id: saleId });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message || 'Error en servidor' });
        }
    }
    static async createPurchase(req, res) {
        try {
            const db = admin.firestore();
            const { payload, userId } = req.body;
            if (!payload) {
                res.status(400).json({ success: false, error: 'Falta parámetro obligatorio payload.' });
                return;
            }
            const purchaseId = await ErpEngine_1.ErpEngine.executeTransaction({
                type: 'PURCHASE',
                payload,
                userId: userId || 'anonymous'
            }, db);
            res.status(200).json({ success: true, id: purchaseId });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message || 'Error en servidor' });
        }
    }
    static async createProduction(req, res) {
        try {
            const db = admin.firestore();
            const { payload, userId, extra } = req.body;
            if (!payload) {
                res.status(400).json({ success: false, error: 'Falta parámetro obligatorio payload.' });
                return;
            }
            const batchId = await ErpEngine_1.ErpEngine.executeTransaction({
                type: 'PRODUCTION',
                payload,
                userId: userId || 'anonymous',
                extra
            }, db);
            res.status(200).json({ success: true, id: batchId });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message || 'Error en servidor' });
        }
    }
    static async getStock(req, res) {
        try {
            const db = admin.firestore();
            const { productId } = req.body;
            if (!productId) {
                res.status(400).json({ success: false, error: 'Falta productId' });
                return;
            }
            const stock = await StockService_1.StockService.getStock(productId, db);
            res.status(200).json({ success: true, data: { stock } });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message || 'Error al obtener stock' });
        }
    }
    static async getDashboard(req, res) {
        try {
            const db = admin.firestore();
            // Fetch collections to assemble clean aggregate statistics
            const salesSnap = await db.collection('sales').limit(50).get();
            const purchaseSnap = await db.collection('purchases').limit(50).get();
            const cashSnap = await db.collection('cash_movements').get();
            let totalSalesRevenue = 0;
            salesSnap.forEach((doc) => {
                const d = doc.data();
                totalSalesRevenue += Number(d.total || 0);
            });
            let totalPurchasesCost = 0;
            purchaseSnap.forEach((doc) => {
                const d = doc.data();
                totalPurchasesCost += Number(d.total || 0);
            });
            let currentCashBalance = 0;
            cashSnap.forEach((doc) => {
                const d = doc.data();
                const amt = Number(d.amount || 0);
                if (d.type === 'in')
                    currentCashBalance += amt;
                else if (d.type === 'out')
                    currentCashBalance -= amt;
            });
            res.status(200).json({
                success: true,
                data: {
                    totalSales: totalSalesRevenue,
                    totalPurchases: totalPurchasesCost,
                    cashBalance: currentCashBalance,
                    updatedAt: Date.now()
                }
            });
        }
        catch (e) {
            res.status(500).json({ success: false, error: e.message || 'Error al compilar dashboard' });
        }
    }
}
exports.ErpController = ErpController;
exports.default = ErpController;
//# sourceMappingURL=erpController.js.map