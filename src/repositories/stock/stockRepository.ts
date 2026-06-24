import { getDocs, query, where, doc, runTransaction, collection, orderBy, limit } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Product, StockMovement, Equivalencia } from '../../types/domain';
import { truncateDecimals } from '../../lib/formatters';


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
      products: productsSnap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            nombre: data.nombre || (data as any).name || '',
            costoActual: data.costoActual !== undefined ? Number(data.costoActual) || 0 : undefined,
            costoUltimaCompra: data.costoUltimaCompra !== undefined ? Number(data.costoUltimaCompra) || 0 : undefined,
            stockActual: data.stockActual !== undefined ? Number(data.stockActual) || 0 : undefined,
            precio1kg: data.precio1kg !== undefined && data.precio1kg !== null ? Number(data.precio1kg) : null,
            precio150g: data.precio150g !== undefined && data.precio150g !== null ? Number(data.precio150g) : null,
            precio250g: data.precio250g !== undefined && data.precio250g !== null ? Number(data.precio250g) : null,
            precio500g: data.precio500g !== undefined && data.precio500g !== null ? Number(data.precio500g) : null,
            precioComercial: data.precioComercial !== undefined ? Number(data.precioComercial) || 0 : undefined,
            pesoFeta: data.pesoFeta !== undefined ? Number(data.pesoFeta) || 0 : undefined,
            pesoObjetivoGramos: data.pesoObjetivoGramos !== undefined ? Number(data.pesoObjetivoGramos) || 0 : undefined,
            pesoObjetivoKg: data.pesoObjetivoKg !== undefined ? Number(data.pesoObjetivoKg) || 0 : undefined,
            margenDeseado: data.margenDeseado !== undefined ? Number(data.margenDeseado) || 0 : undefined,
            utilidadObjetivo: data.utilidadObjetivo !== undefined ? Number(data.utilidadObjetivo) || 0 : undefined,
            mermaObjetivo: data.mermaObjetivo !== undefined ? Number(data.mermaObjetivo) || 0 : undefined,
          } as Product;
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
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

      const currentStock = Number(prodDoc.data().stockActual) || 0;
      const truncatedQty = truncateDecimals(Number(data.qty) || 0, 3);
      const newStock = truncateDecimals(currentStock + truncatedQty, 3);

      // Create movement
      const movRef = doc(collection(db, 'stock_movements'));
      transaction.set(movRef, {
        productId: data.productId,
        qty: truncatedQty,
        type: 'AJUSTE',
        date: new Date().toISOString(),
        observaciones: data.observaciones,
        isDeleted: false
      });

      // Update stock
      transaction.update(prodRef, {
        stockActual: newStock
      });
    });
  }
};
