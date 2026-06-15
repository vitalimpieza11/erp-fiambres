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

import { useEffect } from 'react';
import { useProductsStore } from '../../store/productsStore';

export function useProducts() {
  const productos = useProductsStore((state) => state.productos);
  const loading = useProductsStore((state) => state.loading);
  const fetchProductos = useProductsStore((state) => state.fetchProductos);
  const saveProduct = useProductsStore((state) => state.saveProduct);
  const toggleStatus = useProductsStore((state) => state.toggleStatus);

  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  return {
    productos,
    loading,
    saveProduct,
    toggleStatus
  };
}
