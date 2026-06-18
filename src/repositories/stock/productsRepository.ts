import { getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Product, UnitType } from '../../types/domain';
import { truncateDecimals } from '../../lib/formatters';


export interface DomainError {
  code: string;
  message: string;
  field?: string;
}

export function validateProduct(product: Partial<Product>, catalog: Product[]): void {
  if (!product.nombre || product.nombre.trim() === '') {
    throw {
      code: 'NOMBRE_FALTANTE',
      message: 'El nombre del producto es obligatorio.',
      field: 'nombre'
    } as DomainError;
  }
}

export const productsRepository = {
  async fetchProducts(): Promise<Product[]> {
    const snapshot = await getDocs(COLLECTIONS.PRODUCTS);
    return snapshot.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        nombre: data.nombre || (data as any).name || ''
      } as Product;
    });
  },

  async saveProduct(product: Partial<Product>, catalog: Product[]): Promise<string> {
    validateProduct(product, catalog);

    const dataToSave = {
      ...product,
      precioComercial: Number(product.precioComercial || 0),
      stockActual: truncateDecimals(Number(product.stockActual || 0), 3),
    } as any;

    if (product.type === 'PRESENTACION') {
      // Cost of presentations is dynamic, do not store in DB
      delete dataToSave.costoActual;
      if (product.utilidadObjetivo !== undefined) {
        dataToSave.utilidadObjetivo = Number(product.utilidadObjetivo);
      }
      if (product.mermaObjetivo !== undefined) {
        dataToSave.mermaObjetivo = Number(product.mermaObjetivo);
      }
    } else {
      dataToSave.costoActual = Number(product.costoActual || 0);
    }

    // Do not modify legacy recipe fields in DB during migration to support rollback
    delete dataToSave.recipeItems;
    delete dataToSave.recipeId;
    delete dataToSave.recetaId;

    if (product.id) {
      await updateDoc(doc(db, 'products', product.id), dataToSave);
      return product.id;
    } else {
      const docRef = await addDoc(COLLECTIONS.PRODUCTS, dataToSave);
      return docRef.id;
    }
  },

  async toggleProductStatus(id: string, currentStatus: boolean): Promise<void> {
    await updateDoc(doc(db, 'products', id), { activo: !currentStatus });
  }
};
