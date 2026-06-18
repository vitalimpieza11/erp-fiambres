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
