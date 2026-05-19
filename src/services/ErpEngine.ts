import { auth } from '../firebase/firebase';
import type { Sale, Purchase, ProductionBatch } from '../types/database';

export interface TransactionParams {
  type: 'SALE' | 'PURCHASE' | 'PRODUCTION';
  payload: any;
  extra?: any;
}

const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'al-vacio';
const BASE_URL = window.location.hostname === 'localhost'
  ? `http://localhost:5001/${PROJECT_ID}/us-central1/api`
  : `https://us-central1-${PROJECT_ID}.cloudfunctions.net/api`;

export class ErpEngine {
  /**
   * Dispatches the transaction execution to the Firebase Cloud Functions backend.
   * Leverages server-side authoritative eventId and validation.
   */
  static async executeTransaction(params: TransactionParams): Promise<string> {
    const { type } = params;
    const endpoint = type === 'SALE' ? '/createSale' : type === 'PURCHASE' ? '/createPurchase' : '/createProduction';
    const url = `${BASE_URL}${endpoint}`;

    const currentUserId = auth.currentUser?.uid || 'anonymous';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        payload: params.payload,
        userId: currentUserId,
        extra: params.extra
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = errText;
      try {
        const parsed = JSON.parse(errText);
        errMsg = parsed.error || errText;
      } catch (_) {}
      throw new Error(errMsg);
    }

    const resData = await response.json();
    if (!resData.success) {
      throw new Error(resData.error || 'Error de procesamiento en el backend.');
    }

    return resData.id;
  }

  // Wrappers to keep previous API intact (avoid breaking UI/hooks)
  static async registerSale(sale: Omit<Sale, 'id' | 'subtotal' | 'total' | 'createdAt' | 'updatedAt' | 'discount'>, discountPercent: number, shippingCost: number): Promise<string> {
    return await this.executeTransaction({
      type: 'SALE',
      payload: {
        ...sale,
        discount: discountPercent
      },
      extra: { discountPercent, shippingCost }
    });
  }

  static async registerPurchase(purchase: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return await this.executeTransaction({
      type: 'PURCHASE',
      payload: purchase
    });
  }

  static async registerProduction(
    batch: Omit<ProductionBatch, 'id' | 'createdAt' | 'updatedAt'>,
    sourceProductId: string,
    sourceProductName: string,
    sourceProductQtyKg: number
  ): Promise<string> {
    return await this.executeTransaction({
      type: 'PRODUCTION',
      payload: batch,
      extra: { sourceProductId, sourceProductName, sourceProductQtyKg }
    });
  }
}
export default ErpEngine;
