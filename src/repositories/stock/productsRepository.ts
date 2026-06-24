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

  // FASE 3: Validar código de balanza único
  if (product.codigoBalanza !== undefined && product.codigoBalanza !== null && product.codigoBalanza !== 0) {
    const duplicado = catalog.find(p =>
      p.codigoBalanza === product.codigoBalanza &&
      p.id !== product.id
    );
    if (duplicado) {
      throw {
        code: 'CODIGO_BALANZA_DUPLICADO',
        message: `El código de balanza ${product.codigoBalanza} ya está asignado al producto "${duplicado.nombre}". Cada código debe ser único.`,
        field: 'codigoBalanza'
      } as DomainError;
    }
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
    });
  },

  async saveProduct(product: Partial<Product>, catalog: Product[]): Promise<string> {
    validateProduct(product, catalog);

    const dataToSave = {
      ...product,
      precioComercial: Number(product.precioComercial || 0),
      stockActual: truncateDecimals(Number(product.stockActual || 0), 3),
      precio150g: product.precio150g !== undefined && product.precio150g !== null ? Number(product.precio150g) : null,
      precio250g: product.precio250g !== undefined && product.precio250g !== null ? Number(product.precio250g) : null,
      precio500g: product.precio500g !== undefined && product.precio500g !== null ? Number(product.precio500g) : null,
      precio1kg: product.precio1kg !== undefined && product.precio1kg !== null ? Number(product.precio1kg) : null,
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

    // FASE 3: Persistir campos de balanza
    if (product.codigoBalanza !== undefined && product.codigoBalanza !== null && String(product.codigoBalanza).trim() !== '' && Number(product.codigoBalanza) !== 0) {
      dataToSave.codigoBalanza = Number(product.codigoBalanza);
    } else {
      dataToSave.codigoBalanza = null;
    }
    dataToSave.nombreCortoBalanza = product.nombreCortoBalanza ? String(product.nombreCortoBalanza).trim() : '';

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
