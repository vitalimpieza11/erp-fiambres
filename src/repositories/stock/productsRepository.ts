import { getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Product, UnitType } from '../../types/domain';

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

  if (product.type === 'PRESENTACION') {
    if (!product.recipeItems || product.recipeItems.length === 0) {
      throw {
        code: 'RECETA_VACIA',
        message: 'Las presentaciones deben tener al menos un ingrediente en su receta.',
        field: 'recipeItems'
      } as DomainError;
    }
    
    for (const item of product.recipeItems) {
      if (!item.productId) {
        throw {
          code: 'PRODUCTO_NO_REFERENCIADO',
          message: 'Debe seleccionar un producto para cada ingrediente de la receta.',
          field: 'recipeItems.productId'
        } as DomainError;
      }
      
      const productExists = catalog.some(p => p.id === item.productId);
      if (!productExists) {
        throw {
          code: 'INTEGRIDAD_REFERENCIAL',
          message: 'El producto seleccionado como ingrediente no existe en el catálogo.',
          field: 'recipeItems.productId'
        } as DomainError;
      }

      if (!item.quantity || item.quantity <= 0) {
        throw {
          code: 'CANTIDAD_INVALIDA',
          message: 'La cantidad del ingrediente debe ser mayor a cero.',
          field: 'recipeItems.quantity'
        } as DomainError;
      }
      
      const validUnits: UnitType[] = ['KG', 'GRAMOS', 'UNIDADES', 'FETAS'];
      if (!item.unit || !validUnits.includes(item.unit as UnitType)) {
        throw {
          code: 'UNIDAD_INVALIDA',
          message: 'La unidad de medida del ingrediente no es válida.',
          field: 'recipeItems.unit'
        } as DomainError;
      }
    }
  }
}

export const productsRepository = {
  async fetchProducts(): Promise<Product[]> {
    const snapshot = await getDocs(COLLECTIONS.PRODUCTS);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product));
  },

  async saveProduct(product: Partial<Product>, catalog: Product[]): Promise<void> {
    validateProduct(product, catalog);

    const dataToSave = {
      ...product,
      precioSugerido: Number(product.precioSugerido || 0),
      precioComercial: Number(product.precioComercial || 0),
      costoActual: Number(product.costoActual || 0),
      stockActual: Number(product.stockActual || 0),
    };

    if (product.type !== 'PRESENTACION') {
      delete dataToSave.recipeItems;
    }

    if (product.id) {
      await updateDoc(doc(db, 'products', product.id), dataToSave);
    } else {
      await addDoc(COLLECTIONS.PRODUCTS, dataToSave);
    }
  },

  async toggleProductStatus(id: string, currentStatus: boolean): Promise<void> {
    await updateDoc(doc(db, 'products', id), { activo: !currentStatus });
  }
};
