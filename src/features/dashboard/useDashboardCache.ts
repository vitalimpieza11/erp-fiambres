import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCaja } from '../caja/useCaja';
import { useStock } from '../stock/useStock';
import { useVentas } from '../ventas/useVentas';
import { usePurchases } from '../compras/usePurchases';
import { useProveedores } from '../proveedores/useProveedores';
import type { CustomerMovement } from '../../types/domain';

export function useDashboardCache() {
  const cacheCaja = useCaja();
  const cacheStock = useStock();
  const cacheVentas = useVentas();
  const cacheCompras = usePurchases();
  const cacheProveedores = useProveedores();

  const [customerMovements, setCustomerMovements] = useState<CustomerMovement[]>([]);

  useEffect(() => {
    const qMovs = query(
      collection(db, 'customer_movements'), 
      where('isDeleted', '==', false)
    );
    const unsub = onSnapshot(qMovs, (snap) => {
      const data: CustomerMovement[] = [];
      snap.forEach(doc => data.push(doc.data() as CustomerMovement));
      setCustomerMovements(data);
    });
    return () => unsub();
  }, []);

  const cacheClientes = {
    customers: cacheVentas.customers,
    movements: customerMovements
  };

  return {
    cacheCaja,
    cacheStock,
    cacheVentas,
    cacheCompras,
    cacheProveedores,
    cacheClientes,
    loading: cacheCaja.loading || cacheStock.loading || cacheVentas.loading || cacheCompras.loading || cacheProveedores.loading
  };
}
