import { useState, useEffect } from 'react';
import { getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Product, ProductType, UnitType } from '../../types/domain';

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

export function useProducts() {
  const [productos, setProductos] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProductos();
  }, []);

  const fetchProductos = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(COLLECTIONS.PRODUCTS);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      setProductos(data);
    } catch (error) {
      console.error("Error fetching productos:", error);
    }
    setLoading(false);
  };

  const saveProduct = async (currentProduct: Partial<Product>) => {
    // 1. Validar dominio (pura, sin efectos secundarios)
    validateProduct(currentProduct, productos);

    // 2. Persistencia (solo si validación es exitosa)
    const dataToSave = {
      ...currentProduct,
      precioSugerido: Number(currentProduct.precioSugerido || 0),
      precioComercial: Number(currentProduct.precioComercial || 0),
      costoActual: currentProduct.costoActual || 0,
      stockActual: currentProduct.stockActual || 0,
    };

    if (currentProduct.type !== 'PRESENTACION') {
      delete dataToSave.recipeItems;
    }

    if (currentProduct.id) {
      await updateDoc(doc(db, 'products', currentProduct.id), dataToSave);
    } else {
      await addDoc(COLLECTIONS.PRODUCTS, dataToSave);
    }
    
    await fetchProductos();
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    await updateDoc(doc(db, 'products', id), { activo: !currentStatus });
    await fetchProductos();
  };

  return {
    productos,
    loading,
    saveProduct,
    toggleStatus
  };
}
