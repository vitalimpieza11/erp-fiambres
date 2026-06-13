import { useMemo } from 'react';
import { useDashboardCache } from './useDashboardCache';
import { 
  Wallet, 
  TrendingUp, 
  ShoppingCart, 
  Truck, 
  Users, 
  ClipboardList,
  PiggyBank,
  Percent
} from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  const {
    cacheCaja,
    cacheStock,
    cacheVentas,
    cacheCompras,
    cacheProveedores,
    cacheClientes,
    loading
  } = useDashboardCache();

  // FORMATTER
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

  // DATES
  const today = new Date();
  const startOfMonthStr = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  // 1. Caja actual (Efectivo - excluding bank movements)
  const cajaActual = useMemo(() => {
    return cacheCaja.movements
      .filter(m => {
        const desc = (m.description || '').toLowerCase();
        const cat = (m.category || '').toLowerCase();
        const isBanco = desc.includes('banco') || 
                        desc.includes('transferencia') || 
                        desc.includes('transf') || 
                        desc.includes('deposito') || 
                        desc.includes('depósito') ||
                        desc.includes('cheque') ||
                        cat.includes('banco') || 
                        cat.includes('transferencia');
        return !isBanco;
      })
      .reduce((acc, mov) => acc + (mov.type === 'INCOME' ? mov.amount : -mov.amount), 0);
  }, [cacheCaja.movements]);

  // 2. Saldo bancos (Bank transactions)
  const saldoBancos = useMemo(() => {
    return cacheCaja.movements
      .filter(m => {
        const desc = (m.description || '').toLowerCase();
        const cat = (m.category || '').toLowerCase();
        return desc.includes('banco') || 
               desc.includes('transferencia') || 
               desc.includes('transf') || 
               desc.includes('deposito') || 
               desc.includes('depósito') ||
               desc.includes('cheque') ||
               cat.includes('banco') || 
               cat.includes('transferencia');
      })
      .reduce((acc, mov) => acc + (mov.type === 'INCOME' ? mov.amount : -mov.amount), 0);
  }, [cacheCaja.movements]);

  // 3. Por cobrar (Total customers debt)
  const porCobrar = useMemo(() => {
    return cacheClientes.movements.reduce((acc, m) => {
      if (m.type === 'DEUDA') return acc + m.amount;
      if (m.type === 'PAGO') return acc - m.amount;
      if (m.type === 'AJUSTE') return acc + m.amount;
      return acc;
    }, 0);
  }, [cacheClientes.movements]);

  // 4. Por pagar (Total suppliers debt)
  const porPagar = useMemo(() => {
    return cacheProveedores.movements.reduce((acc, m) => {
      if (m.type === 'COMPRA') return acc + m.amount;
      if (m.type === 'PAGO') return acc - m.amount;
      if (m.type === 'AJUSTE' || m.type === 'ANULACION') return acc + m.amount;
      return acc;
    }, 0);
  }, [cacheProveedores.movements]);

  // 5. Pedidos pendientes (Orders in active states)
  const pedidosPendientes = useMemo(() => {
    return cacheVentas.orders.filter(o => 
      !o.isDeleted && 
      (o.status === 'PENDIENTE' || o.status === 'EN_PRODUCCION' || o.status === 'PRODUCIDO')
    ).length;
  }, [cacheVentas.orders]);

  // 6. Ventas del mes
  const ventasDelMes = useMemo(() => {
    return cacheVentas.sales
      .filter(s => s.date >= startOfMonthStr && s.status !== 'ANULADO')
      .reduce((acc, s) => acc + s.totalAmount, 0);
  }, [cacheVentas.sales, startOfMonthStr]);

  // 7. Costos del mes (Total purchases)
  const costosDelMes = useMemo(() => {
    return cacheCompras.purchases
      .filter(p => p.date >= startOfMonthStr && p.status !== 'VOIDED' && p.type === 'PURCHASE')
      .reduce((acc, p) => acc + p.total, 0);
  }, [cacheCompras.purchases, startOfMonthStr]);

  // 8. Ganancia del mes
  const gananciaDelMes = useMemo(() => {
    return ventasDelMes - costosDelMes;
  }, [ventasDelMes, costosDelMes]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Sincronizando capa operativa del ERP...</p>
      </div>
    );
  }

  const cardsData = [
    {
      title: 'Caja Actual',
      value: formatCurrency(cajaActual),
      icon: <Wallet size={20} />,
      bg: '#f3f4f6',
      color: '#1f2937',
      isCurrency: true
    },
    {
      title: 'Saldo Bancos',
      value: formatCurrency(saldoBancos),
      icon: <PiggyBank size={20} />,
      bg: '#e0f2fe',
      color: '#0284c7',
      isCurrency: true
    },
    {
      title: 'Por Cobrar',
      value: formatCurrency(porCobrar),
      icon: <Users size={20} />,
      bg: '#dcfce7',
      color: '#16a34a',
      isCurrency: true
    },
    {
      title: 'Por Pagar',
      value: formatCurrency(porPagar),
      icon: <Truck size={20} />,
      bg: '#fee2e2',
      color: '#dc2626',
      isCurrency: true
    },
    {
      title: 'Pedidos Pendientes',
      value: `${pedidosPendientes} pedidos`,
      icon: <ClipboardList size={20} />,
      bg: '#fef3c7',
      color: '#d97706',
      isCurrency: false
    },
    {
      title: 'Ventas del Mes',
      value: formatCurrency(ventasDelMes),
      icon: <TrendingUp size={20} />,
      bg: '#e0e7ff',
      color: '#4f46e5',
      isCurrency: true
    },
    {
      title: 'Costos del Mes',
      value: formatCurrency(costosDelMes),
      icon: <ShoppingCart size={20} />,
      bg: '#f3e8ff',
      color: '#9333ea',
      isCurrency: true
    },
    {
      title: 'Ganancia del Mes',
      value: formatCurrency(gananciaDelMes),
      icon: <Percent size={20} />,
      bg: gananciaDelMes >= 0 ? '#dcfce7' : '#fee2e2',
      color: gananciaDelMes >= 0 ? '#15803d' : '#b91c1c',
      isCurrency: true
    }
  ];

  return (
    <div className="dashboard-v2-container">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="dashboard-subtitle">Métricas operacionales resumidas del negocio</p>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {cardsData.map((card, idx) => (
          <div 
            key={idx} 
            className="apple-card" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'space-between', 
              minHeight: '160px',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>{card.title}</span>
              <div style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: '10px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: card.bg,
                color: card.color
              }}>
                {card.icon}
              </div>
            </div>
            
            <div className="dash-metric">
              <span style={{ 
                fontSize: '24px', 
                fontWeight: 700, 
                color: 'var(--text-primary)', 
                letterSpacing: '-0.02em',
                wordBreak: 'break-all'
              }}>
                {card.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
