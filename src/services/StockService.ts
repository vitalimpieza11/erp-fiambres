import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import type { StockMovement } from '../types/database';

export class StockService {
  /**
   * Increases the stock of a product by registering a stock movement event.
   */
  static async increaseStock(
    productId: string, 
    productName: string, 
    qty: number, 
    referenceType: 'sale' | 'purchase' | 'production' | 'manual',
    referenceId?: string,
    observations?: string
  ): Promise<void> {
    if (qty <= 0) return;
    const movement: StockMovement = {
      productId,
      productName,
      quantity: Math.abs(qty), // Positive
      type: 'in',
      referenceType,
      referenceId,
      date: Date.now(),
      observations,
      createdAt: Date.now()
    };
    await addDoc(collection(db, 'stock_movements'), movement);
  }

  /**
   * Decreases the stock of a product by registering a stock movement event.
   * Can prevent negative stock if checkAvailable is enabled.
   */
  static async decreaseStock(
    productId: string, 
    productName: string, 
    qty: number, 
    referenceType: 'sale' | 'purchase' | 'production' | 'manual',
    referenceId?: string,
    observations?: string,
    allowNegative: boolean = false
  ): Promise<void> {
    if (qty <= 0) return;
    
    if (!allowNegative) {
      const current = await this.getStock(productId);
      if (current < qty) {
        throw new Error(`Stock insuficiente para ${productName}. Disponible: ${current}, Solicitado: ${qty}`);
      }
    }

    const movement: StockMovement = {
      productId,
      productName,
      quantity: -Math.abs(qty), // Negative
      type: 'out',
      referenceType,
      referenceId,
      date: Date.now(),
      observations,
      createdAt: Date.now()
    };
    await addDoc(collection(db, 'stock_movements'), movement);
  }

  /**
   * Moves stock from one product definition to another (e.g. from Horma raw material to feteado Packages)
   */
  static async moveStock(
    productIdFrom: string,
    productNameFrom: string,
    qtyFrom: number, // Quantity to subtract from raw material
    productIdTo: string,
    productNameTo: string,
    qtyTo: number, // Quantity to add to final feteado packages
    referenceType: 'production' | 'manual',
    referenceId?: string,
    observations?: string
  ): Promise<void> {
    // 1. Decrease the source raw material
    await this.decreaseStock(
      productIdFrom, 
      productNameFrom, 
      qtyFrom, 
      referenceType, 
      referenceId, 
      `Movimiento Salida: ${observations || 'Fraccionamiento/Feteado'}`,
      true // We allow negative raw material stock temporarily if config allows or for production
    );

    // 2. Increase the target final packages product
    await this.increaseStock(
      productIdTo, 
      productNameTo, 
      qtyTo, 
      referenceType, 
      referenceId, 
      `Movimiento Entrada: ${observations || 'Fraccionamiento/Feteado'}`
    );
  }

  /**
   * Calculates the current stock of a product by summing all of its stock movements.
   * Absolute source of truth.
   */
  static async getStock(productId: string): Promise<number> {
    try {
      const q = query(
        collection(db, 'stock_movements'), 
        where('productId', '==', productId)
      );
      const querySnapshot = await getDocs(q);
      let totalStock = 0;
      querySnapshot.forEach((doc) => {
        const movement = doc.data() as StockMovement;
        totalStock += movement.quantity;
      });
      return Number(totalStock.toFixed(3)); // Handle float rounding
    } catch (e) {
      console.error(`Error calculating stock for product ${productId}:`, e);
      return 0;
    }
  }
}
export default StockService;
