import type { Product } from '../types/domain';
import type { Customer } from '../types/domain';

export interface CustomerGroup {
  customer: Customer;
  products: Product[];
}

export interface GroupedPresentaciones {
  /** Presentaciones que tienen cliente asignado, agrupadas por cliente */
  byCustomer: CustomerGroup[];
  /** Presentaciones sin cliente asignado */
  loose: Product[];
}

/**
 * Agrupa una lista de presentaciones por su campo `clienteAsignado`.
 * Las presentaciones sin cliente asignado quedan en `loose`.
 *
 * @param presentaciones - Lista de productos filtrados (type === 'PRESENTACION')
 * @param customers      - Lista completa de clientes
 * @param priorityCustomerId - Si se pasa, ese cliente aparece primero en byCustomer
 */
export function groupPresentacionesByCustomer(
  presentaciones: Product[],
  customers: Customer[],
  priorityCustomerId?: string
): GroupedPresentaciones {
  const loose: Product[] = [];
  const grouped: Record<string, Product[]> = {};

  for (const p of presentaciones) {
    if (p.clienteAsignado) {
      if (!grouped[p.clienteAsignado]) grouped[p.clienteAsignado] = [];
      grouped[p.clienteAsignado].push(p);
    } else {
      loose.push(p);
    }
  }

  // Resolver objetos Customer para cada grupo
  let byCustomer: CustomerGroup[] = Object.entries(grouped).map(([cId, prods]) => {
    const customer = customers.find(c => c.id === cId) ?? {
      id: cId,
      nombre: 'Cliente Desconocido',
      razonSocial: '',
      cuit: '',
      telefono: '',
      email: '',
      direccion: '',
      observaciones: '',
      activo: true,
    };
    return { customer, products: prods };
  });

  // Ordenar: cliente prioritario primero, resto alfabético
  byCustomer.sort((a, b) => {
    if (priorityCustomerId) {
      if (a.customer.id === priorityCustomerId) return -1;
      if (b.customer.id === priorityCustomerId) return 1;
    }
    return a.customer.nombre.localeCompare(b.customer.nombre);
  });

  return { byCustomer, loose };
}
