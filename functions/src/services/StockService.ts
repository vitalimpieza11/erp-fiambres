import * as admin from 'firebase-admin';

export class StockService {
  /**
   * Calculates the current stock of a product by summing all of its stock movements.
   * Absolute source of truth on the server side.
   */
  static async getStock(productId: string, db: admin.firestore.Firestore): Promise<number> {
    try {
      const snapshot = await db.collection('stock_movements')
        .where('productId', '==', productId)
        .get();
        
      let totalStock = 0;
      snapshot.forEach((doc) => {
        const movement = doc.data();
        totalStock += Number(movement.quantity || 0);
      });
      return Number(totalStock.toFixed(3)); // Handle float rounding
    } catch (e) {
      console.error(`Error calculating stock in backend for product ${productId}:`, e);
      return 0;
    }
  }
}
export default StockService;
