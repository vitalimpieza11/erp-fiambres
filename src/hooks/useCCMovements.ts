import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/AuthContext';
import { parseNumber } from '../utils/format';

export interface CCMovementLine {
  id: string;
  date: number;
  type: 'venta' | 'cobro';
  comprobante: string;
  concepto: string;
  debe: number;   // Venta a cobrar (positivo)
  haber: number;  // Cobro/pago recibido (positivo)
  saldo: number;  // Saldo acumulado después de este movimiento
}

/**
 * Lee el historial real de cuenta corriente de un cliente desde Firestore.
 * Fuentes:
 *   - 'sales'       donde paymentMethod === 'cc'  → DÉBITO (debe)
 *   - 'cc_payments' donde customerId === id        → CRÉDITO (haber)
 *
 * Ordena cronológicamente (ASC) para calcular el saldo corrido,
 * luego invierte para mostrar el más reciente primero.
 */
export const useCCMovements = (customerId: string | null) => {
  const { currentUser } = useAuth();
  const [movements, setMovements] = useState<CCMovementLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId || !currentUser) {
      setMovements([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Estado compartido dentro del closure del effect
    let salesLoaded = false;
    let cobrosLoaded = false;
    let ordersLoaded = false;
    let rawSales: any[] = [];
    let rawCobros: any[] = [];
    let rawOrders: any[] = [];

    const merge = () => {
      // Esperar a que todas las suscripciones hayan respondido al menos una vez
      if (!salesLoaded || !cobrosLoaded || !ordersLoaded) return;

      const lines: CCMovementLine[] = [];

      // Pedidos CC → INFO ONLY (debe: 0, haber: 0, type: 'pedido')
      for (const o of rawOrders) {
        let labelStatus = 'Pendiente';
        if (o.status === 'in_production') labelStatus = 'En Producción';
        if (o.status === 'delivered') labelStatus = 'Entregado';
        if (o.status === 'invoiced') labelStatus = 'Facturado';

        lines.push({
          id: `order-${o.id}`,
          date: o.date ?? o.createdAt ?? 0,
          type: 'pedido' as any,
          comprobante: `PED-${String(o.id).slice(-6).toUpperCase()}`,
          concepto: `Pedido Registrado — Estado: ${labelStatus}`,
          debe: 0,
          haber: 0,
          saldo: 0
        });
      }

      // Ventas CC → DÉBITO
      for (const s of rawSales) {
        lines.push({
          id: `sale-${s.id}`,
          date: s.date ?? s.createdAt ?? 0,
          type: 'venta',
          comprobante: s.remitoNumber || `#${String(s.id).slice(-6).toUpperCase()}`,
          concepto: `Venta — ${s.customerName || 'Cliente'}`,
          debe: parseNumber(s.total),
          haber: 0,
          saldo: 0
        });
      }

      // Cobros CC → CRÉDITO
      for (const c of rawCobros) {
        lines.push({
          id: `cobro-${c.id}`,
          date: c.date ?? c.createdAt ?? 0,
          type: 'cobro',
          comprobante: c.referenceNumber || `#${String(c.id).slice(-6).toUpperCase()}`,
          concepto: c.concept || 'Cobro en cuenta corriente',
          debe: 0,
          haber: parseNumber(c.amount),
          saldo: 0
        });
      }

      // Ordenar ASC por fecha para calcular saldo corrido
      lines.sort((a, b) => a.date - b.date);

      let saldoCorrido = 0;
      const withBalance = lines.map(line => {
        saldoCorrido += line.debe - line.haber;
        return { ...line, saldo: saldoCorrido };
      });

      // Mostrar más reciente primero
      setMovements(withBalance.reverse());
      setLoading(false);
    };

    // Suscripción 1: ventas de este cliente (filtramos paymentMethod en JS
    // para evitar índice compuesto en Firestore)
    const salesQ = query(
      collection(db, 'sales'),
      where('customerId', '==', customerId)
    );
    const unsubSales = onSnapshot(
      salesQ,
      (snap) => {
        rawSales = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((s: any) => s.paymentMethod === 'cc');
        salesLoaded = true;
        merge();
      },
      (err) => {
        console.error('useCCMovements sales error:', err);
        setError(err.message);
        salesLoaded = true;
        merge();
      }
    );

    // Suscripción 2: cobros registrados para este cliente
    const cobrosQ = query(
      collection(db, 'cc_payments'),
      where('customerId', '==', customerId)
    );
    const unsubCobros = onSnapshot(
      cobrosQ,
      (snap) => {
        rawCobros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cobrosLoaded = true;
        merge();
      },
      (err) => {
        console.warn('useCCMovements cc_payments:', err.message);
        cobrosLoaded = true;
        merge();
      }
    );

    // Suscripción 3: pedidos registrados para este cliente
    const ordersQ = query(
      collection(db, 'orders'),
      where('customerId', '==', customerId)
    );
    const unsubOrders = onSnapshot(
      ordersQ,
      (snap) => {
        rawOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        ordersLoaded = true;
        merge();
      },
      (err) => {
        console.warn('useCCMovements orders:', err.message);
        ordersLoaded = true;
        merge();
      }
    );

    return () => {
      unsubSales();
      unsubCobros();
      unsubOrders();
    };
  }, [customerId, currentUser]);

  return { movements, loading, error };
};

export default useCCMovements;
