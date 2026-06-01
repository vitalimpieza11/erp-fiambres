import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { ErpEngine } from '../services/ErpEngine';
import { StockService } from '../services/StockService';

export class ErpController {
  static async createSale(req: Request, res: Response) {
    try {
      const db = admin.firestore();
      const { payload, userId, extra } = req.body;
      
      if (!payload) {
        res.status(400).json({ success: false, error: 'Falta parámetro obligatorio payload.' });
        return;
      }
      
      const saleId = await ErpEngine.executeTransaction({
        type: 'SALE',
        payload,
        userId: userId || 'anonymous',
        extra
      }, db);
      
      res.status(200).json({ success: true, id: saleId });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message || 'Error en servidor' });
    }
  }

  static async createPurchase(req: Request, res: Response) {
    try {
      const db = admin.firestore();
      const { payload, userId } = req.body;
      
      if (!payload) {
        res.status(400).json({ success: false, error: 'Falta parámetro obligatorio payload.' });
        return;
      }
      
      const purchaseId = await ErpEngine.executeTransaction({
        type: 'PURCHASE',
        payload,
        userId: userId || 'anonymous'
      }, db);
      
      res.status(200).json({ success: true, id: purchaseId });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message || 'Error en servidor' });
    }
  }

  static async createProduction(req: Request, res: Response) {
    try {
      const db = admin.firestore();
      const { payload, userId, extra } = req.body;
      
      if (!payload) {
        res.status(400).json({ success: false, error: 'Falta parámetro obligatorio payload.' });
        return;
      }
      
      const batchId = await ErpEngine.executeTransaction({
        type: 'PRODUCTION',
        payload,
        userId: userId || 'anonymous',
        extra
      }, db);
      
      res.status(200).json({ success: true, id: batchId });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message || 'Error en servidor' });
    }
  }

  static async getStock(req: Request, res: Response) {
    try {
      const db = admin.firestore();
      const { productId } = req.body;
      if (!productId) {
        res.status(400).json({ success: false, error: 'Falta productId' });
        return;
      }
      const stock = await StockService.getStock(productId, db);
      res.status(200).json({ success: true, data: { stock } });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message || 'Error al obtener stock' });
    }
  }

  static async getDashboard(req: Request, res: Response) {
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
        if (d.type === 'in') currentCashBalance += amt;
        else if (d.type === 'out') currentCashBalance -= amt;
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
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message || 'Error al compilar dashboard' });
    }
  }

  static async getDebugToken(req: Request, res: Response) {
    try {
      const { secret } = req.body;
      if (secret !== 'al-vacio-temp-secret-2026') {
        res.status(403).json({ success: false, error: 'Acceso denegado.' });
        return;
      }
      const token = await admin.auth().createCustomToken('debug-admin', { admin: true });
      res.status(200).json({ success: true, token });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message || 'Error al generar token de depuración' });
    }
  }
}
export default ErpController;
