import { getDocs, query, where, doc, runTransaction, collection, orderBy, limit } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Product, StockMovement, Equivalencia } from '../../types/domain';

export const stockRepository = {
  async fetchStockData(): Promise<{
    products: Product[];
    movements: StockMovement[];
    equivalences: Equivalencia[];
  }> {
    const [productsSnap, movesSnap, equivSnap] = await Promise.all([
      getDocs(query(COLLECTIONS.PRODUCTS, where('activo', '==', true))),
      getDocs(query(COLLECTIONS.STOCK_MOVEMENTS, where('isDeleted', '==', false), orderBy('date', 'desc'), limit(50))),
      getDocs(COLLECTIONS.EQUIVALENCES)
    ]);

    return {
      products: productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)),
      movements: movesSnap.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement)),
      equivalences: equivSnap.docs.map(d => ({ id: d.id, ...d.data() } as Equivalencia))
    };
  },

  async registerAdjustment(data: {
    productId: string;
    qty: number;
    observaciones: string;
  }): Promise<void> {
    if (!data.observaciones.trim()) throw new Error("Las observaciones son obligatorias");
    if (data.qty === 0) throw new Error("La cantidad a ajustar no puede ser cero");

    await runTransaction(db, async (transaction) => {
      const prodRef = doc(db, 'products', data.productId);
      const prodDoc = await transaction.get(prodRef);
      if (!prodDoc.exists()) throw new Error("Producto no encontrado");

      const currentStock = prodDoc.data().stockActual || 0;

      // Create movement
      const movRef = doc(collection(db, 'stock_movements'));
      transaction.set(movRef, {
        productId: data.productId,
        qty: data.qty,
        type: 'AJUSTE',
        date: new Date().toISOString(),
        observaciones: data.observaciones,
        isDeleted: false
      });

      // Update stock
      transaction.update(prodRef, {
        stockActual: currentStock + data.qty
      });
    });
  }
};
