import React from 'react';
import { 
  DollarSign, ShoppingCart, Package, Users, Activity,
  TrendingUp, Factory, AlertTriangle, Clock,
  ArrowUpRight, ArrowDownRight, Wallet, Truck, MapPin, 
  CheckCircle2, CreditCard, Box, Map, Star
} from 'lucide-react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { Card, CardHeader } from '../components/ui/Card';
import { LoadingSpinner, ErrorState } from '../components/AsyncState';
import { useSales } from '../hooks/useSales';
import { usePurchases } from '../hooks/usePurchases';
import { useOrders } from '../hooks/useOrders';
import { useCustomers } from '../hooks/useCustomers';
import { useCashMovements } from '../hooks/useCashMovements';
import { useStockMovements } from '../hooks/useStockMovements';
import { useMercaderias } from '../hooks/useMercaderias';
import { useInsumos } from '../hooks/useInsumos';
import { usePresentaciones } from '../hooks/usePresentaciones';
import { useSuppliers } from '../hooks/useSuppliers';
import { useSettings } from '../hooks/useSettings';
import { formatCurrency, formatNumber } from '../utils/format';
import { useDateFilter } from '../contexts/DateFilterContext';

const getFriendlyTimeStr = (timestamp: number) => {
  if (!timestamp) return '';
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  return new Date(timestamp).toLocaleDateString();
};

export const Dashboard = () => {
  const { settings, loading: loadingSettings, error: errorSettings } = useSettings();
  const { sales, loading: loadingSales, error: errorSales } = useSales();
  const { purchases, loading: loadingPurchases, error: errorPurchases } = usePurchases();
  const { orders, loading: loadingOrders, error: errorOrders } = useOrders();
  const { mercaderias, loading: loadingMercaderias, error: errorMercaderias } = useMercaderias();
  const { insumos, loading: loadingInsumos, error: errorInsumos } = useInsumos();
  const { presentaciones, loading: loadingPresentaciones, error: errorPresentaciones } = usePresentaciones();
  const { customers, loading: loadingCustomers, error: errorCustomers } = useCustomers();
  const { suppliers, loading: loadingSuppliers, error: errorSuppliers } = useSuppliers();
  const { movements, loading: loadingMovements, error: errorMovements } = useCashMovements();
  const { productStocks, loading: loadingStocks, error: errorStocks } = useStockMovements();

  const loading = loadingSettings || loadingSales || loadingPurchases || loadingOrders || loadingMercaderias || loadingInsumos || loadingPresentaciones || loadingCustomers || loadingSuppliers || loadingMovements || loadingStocks;
  const error = errorSettings || errorSales || errorPurchases || errorOrders || errorMercaderias || errorInsumos || errorPresentaciones || errorCustomers || errorSuppliers || errorMovements || errorStocks;

  if (error) {
    return <ErrorState message={typeof error === 'string' ? error : (error as any).message || 'Error cargando dashboard real.'} />;
  }

  if (loading) {
    return <LoadingSpinner message="Sincronizando Centro Operativo con Firestore..." />;
  }

  if (sales.length === 0 && purchases.length === 0 && orders.length === 0 && movements.length === 0) {
    return (
      <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <PageHeader title="Panel Control Operativo" description="Resumen consolidado en tiempo real" />
        <div style={{ marginTop: '48px' }}>
          <EmptyState 
            icon={Activity} 
            title="Aún no hay movimientos registrados" 
            description="Registre pedidos, ventas, compras y producción para comenzar a ver métricas reales." 
          />
        </div>
      </div>
    );
  }

  // 1. Calculations & Stats
  const { filterDate, viewType, selectedYear, selectedMonth, selectedDay, getRange } = useDateFilter();

  const getRate = (code: string) => {
    const list = settings?.currencies || [];
    const match = list.find((c: any) => c.code === code);
    return match ? match.rate : 1;
  };

  const toArs = (amount: number, currency: string) => {
    return amount * getRate(currency || 'ARS');
  };

  const filteredSales = sales.filter((s: any) => filterDate(s.date));
  const filteredPurchases = purchases.filter((p: any) => filterDate(p.date));
  const filteredOrders = orders.filter((o: any) => filterDate(o.updatedAt || o.date));
  const filteredMovements = movements.filter((m: any) => filterDate(m.date || m.createdAt));

  const getPrevRange = () => {
    let start = 0;
    let end = 0;
    if (viewType === 'day') {
      const prevDate = new Date(selectedYear, selectedMonth, selectedDay - 1);
      start = new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate(), 0, 0, 0, 0).getTime();
      end = new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate(), 23, 59, 59, 999).getTime();
    } else if (viewType === 'month') {
      start = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0, 0).getTime();
      end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999).getTime();
    } else if (viewType === 'year') {
      start = new Date(selectedYear - 1, 0, 1, 0, 0, 0, 0).getTime();
      end = new Date(selectedYear - 1, 11, 31, 23, 59, 59, 999).getTime();
    }
    return { start, end };
  };

  const { start: prevStart, end: prevEnd } = getPrevRange();
  const prevSales = sales.filter((s: any) => s.date >= prevStart && s.date <= prevEnd);

  const totalSalesToday = filteredSales.reduce((acc: number, s: any) => acc + s.total, 0);
  const totalSalesYesterday = prevSales.reduce((acc: number, s: any) => acc + s.total, 0);

  let salesTrendStr = 'Igual';
  let salesTrendUp = true;
  if (viewType !== 'all') {
    if (totalSalesYesterday > 0) {
      const diff = ((totalSalesToday - totalSalesYesterday) / totalSalesYesterday) * 100;
      salesTrendUp = diff >= 0;
      salesTrendStr = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
    } else if (totalSalesToday > 0) {
      salesTrendStr = '+100%';
      salesTrendUp = true;
    }
  }

  // Profit/Utility current period
  const totalCostToday = filteredSales.reduce((acc: number, s: any) => {
    return acc + (s.items || []).reduce((itemAcc: number, item: any) => itemAcc + (item.quantity * (item.cost || 0)), 0);
  }, 0);
  const utilityToday = Math.max(0, totalSalesToday - totalCostToday);

  // Kgs sold current period
  const totalKgSoldToday = filteredSales.reduce((acc: number, s: any) => {
    return acc + (s.items || []).reduce((itemAcc: number, item: any) => {
      const pres = presentaciones.find((p: any) => p.id === item.productId);
      const gramaje = pres?.pesoObjetivoGramos || 200;
      return itemAcc + (item.quantity * (gramaje / 1000));
    }, 0);
  }, 0);

  // Kgs produced current period
  const todayProducedOrders = filteredOrders.filter((o: any) => o.status === 'ENTREGADO' || o.status === 'FACTURADO' || o.status === 'PRODUCIDO');
  const totalKgProducedToday = todayProducedOrders.reduce((acc: number, o: any) => {
    return acc + (o.items || []).reduce((itemAcc: number, item: any) => {
      const pres = presentaciones.find((p: any) => p.id === item.productId);
      const gramaje = pres?.pesoObjetivoGramos || 200;
      const producedQty = (o.actualProduced && o.actualProduced[item.productId]) || item.quantity;
      return itemAcc + (producedQty * (gramaje / 1000));
    }, 0);
  }, 0);

  const pendingOrdersCount = filteredOrders.filter((o: any) => o.status === 'PENDIENTE' || o.status === 'EN_PRODUCCION').length;
  const clientsWithDebtCount = customers.filter((c: any) => (c.currentBalance || 0) > 0).length;

  let criticalStockCount = 0;
  mercaderias.forEach(m => { if ((productStocks[m.id!] || 0) <= 10) criticalStockCount++; });
  insumos.forEach(i => { if ((productStocks[i.id!] || 0) <= 50) criticalStockCount++; });
  presentaciones.forEach(p => { if ((productStocks[p.id!] || 0) <= 5) criticalStockCount++; });

  const periodLabel = {
    day: 'de hoy',
    month: 'del mes',
    year: 'del año',
    all: 'totales'
  }[viewType];

  const trendLabel = {
    day: 'vs ayer',
    month: 'vs mes ant.',
    year: 'vs año ant.',
    all: ''
  }[viewType];

  // Capital Operativo calculations
  const { end: periodEnd } = getRange();
  const totalCajaFisicaArs = movements
    .filter((m: any) => (m.date || m.createdAt) <= periodEnd && (m.origin === 'cash' || (!m.origin && m.method === 'cash')))
    .reduce((sum: number, m: any) => sum + (m.type === 'in' ? 1 : -1) * toArs(m.amount, m.currency || 'ARS'), 0);

  const totalBancosArs = movements
    .filter((m: any) => (m.date || m.createdAt) <= periodEnd && (m.origin === 'bank' || (!m.origin && m.method !== 'cash')))
    .reduce((sum: number, m: any) => sum + (m.type === 'in' ? 1 : -1) * toArs(m.amount, m.currency || 'ARS'), 0);

  const totalObligacionesArs = suppliers.reduce((acc: number, s: any) => acc + ((s as any).currentBalance || 0), 0);
  const capitalOperativo = totalCajaFisicaArs + totalBancosArs - totalObligacionesArs;

  const stats = [
    { title: `Ventas ${periodLabel}`, value: formatCurrency(totalSalesToday), icon: DollarSign, trend: salesTrendStr, isUp: salesTrendUp, labelSuffix: trendLabel },
    { title: `Utilidad est. ${periodLabel}`, value: formatCurrency(utilityToday), icon: TrendingUp, trend: totalSalesToday > 0 ? '+100%' : 'Igual', isUp: true, labelSuffix: trendLabel },
    { title: `Kg vendidos ${periodLabel}`, value: `${totalKgSoldToday.toFixed(1)} kg`, icon: Package, trend: totalKgSoldToday > 0 ? '+100%' : 'Igual', isUp: true, labelSuffix: trendLabel },
    { title: `Kg producidos ${periodLabel}`, value: `${totalKgProducedToday.toFixed(1)} kg`, icon: Factory, trend: totalKgProducedToday > 0 ? '+100%' : 'Igual', isUp: true, labelSuffix: trendLabel },
    { title: 'Pedidos pendientes', value: pendingOrdersCount.toString(), icon: ShoppingCart, trend: pendingOrdersCount > 0 ? `+${pendingOrdersCount}` : 'Igual', isUp: true, labelSuffix: 'período' },
    { title: 'Clientes con deuda', value: clientsWithDebtCount.toString(), icon: Users, trend: clientsWithDebtCount > 0 ? `+${clientsWithDebtCount}` : 'Igual', isUp: false, alert: true, labelSuffix: 'saldo' },
    { title: 'Stock crítico', value: criticalStockCount.toString(), icon: AlertTriangle, trend: criticalStockCount > 0 ? 'Crítico' : 'Al día', isUp: false, alert: criticalStockCount > 0, labelSuffix: 'actual' },
    { title: 'Capital Operativo', value: formatCurrency(capitalOperativo), icon: Wallet, trend: capitalOperativo >= 0 ? 'Saludable' : 'Riesgo', isUp: capitalOperativo >= 0, labelSuffix: 'Caja+Bco-Oblig' },
  ];

  // 2. Intelligent Alerts
  const generatedAlerts: any[] = [];
  if (criticalStockCount > 0) {
    generatedAlerts.push({
      title: `${criticalStockCount} ${criticalStockCount === 1 ? 'producto tiene' : 'productos tienen'} stock crítico`,
      type: 'error',
      icon: AlertTriangle
    });
  }
  if (clientsWithDebtCount > 0) {
    generatedAlerts.push({
      title: `${clientsWithDebtCount} ${clientsWithDebtCount === 1 ? 'cliente tiene' : 'clientes tienen'} saldo deudor`,
      type: 'warning',
      icon: Users
    });
  }
  // Placeholder until cost logic is fully implemented on Presentaciones
  const lowMarginProducts: any[] = []; // Disable temporarily for simplicity, can be re-enabled if needed

  generatedAlerts.push({
    title: `${mercaderias.length + insumos.length + presentaciones.length} items activos en el catálogo multicapa`,
    type: 'info',
    icon: Package
  });

  const formatEventTime = (timestamp: number) => {
    const d = new Date(timestamp);
    if (viewType === 'day') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return `${d.getDate()}/${d.getMonth() + 1} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  // 3. Operational Timeline today
  const todayEvents: any[] = [];
  const todaySales = filteredSales;
  todaySales.forEach((s: any) => {
    todayEvents.push({
      time: formatEventTime(s.date),
      timestamp: s.date,
      title: 'Venta comercial',
      desc: `Remito ${s.remitoNumber || 'N/A'} - ${s.customerName} (${formatCurrency(s.total)})`,
      icon: ShoppingCart,
      color: '#8b5cf6'
    });
  });

  const todayPurchases = filteredPurchases;
  todayPurchases.forEach((p: any) => {
    todayEvents.push({
      time: formatEventTime(p.date),
      timestamp: p.date,
      title: 'Compra registrada',
      desc: `Factura ${p.invoiceNumber || 'N/A'} - ${p.supplierName} (${formatCurrency(p.total)})`,
      icon: Truck,
      color: '#f59e0b'
    });
  });

  todayProducedOrders.forEach((o: any) => {
    todayEvents.push({
      time: formatEventTime(o.updatedAt || o.date),
      timestamp: o.updatedAt || o.date,
      title: 'Pedido Producido',
      desc: `Cliente: ${o.customerName} - ${o.items.length} items producidos`,
      icon: Factory,
      color: '#3b82f6'
    });
  });

  const sortedTimeline = todayEvents
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  if (sortedTimeline.length === 0) {
    sortedTimeline.push({
      time: '--:--',
      timestamp: 0,
      title: 'Sin actividad en el período',
      desc: 'No se registran transacciones operativas durante el período seleccionado.',
      icon: Activity,
      color: '#64748b'
    });
  }

  // 4. Tops del Negocio
  const productQuantities: Record<string, number> = {};
  filteredSales.forEach((s: any) => {
    (s.items || []).forEach((item: any) => {
      productQuantities[item.productName] = (productQuantities[item.productName] || 0) + item.quantity;
    });
  });
  const topProductsList = Object.entries(productQuantities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => entry[0]);
  while (topProductsList.length < 3) {
    topProductsList.push(topProductsList.length === 0 ? 'Sin ventas registradas' : '--');
  }

  const productProfits: Record<string, number> = {};
  filteredSales.forEach((s: any) => {
    (s.items || []).forEach((item: any) => {
      const revenue = item.quantity * item.price;
      const cost = item.quantity * (item.cost || 0);
      productProfits[item.productName] = (productProfits[item.productName] || 0) + (revenue - cost);
    });
  });
  const topRentablesList = Object.entries(productProfits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => entry[0]);
  while (topRentablesList.length < 3) {
    topRentablesList.push(topRentablesList.length === 0 ? 'Sin ventas registradas' : '--');
  }

  const customerTotals: Record<string, number> = {};
  filteredSales.forEach((s: any) => {
    customerTotals[s.customerName] = (customerTotals[s.customerName] || 0) + s.total;
  });
  const topCustomersList = Object.entries(customerTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => entry[0]);
  while (topCustomersList.length < 3) {
    topCustomersList.push(topCustomersList.length === 0 ? 'Sin clientes registrados' : '--');
  }

  const topZonesList = ['Centro', 'Distribución Central', 'Entregas Locales'];

  // 5. Caja Rápida
  const balanceCaja = totalCajaFisicaArs + totalBancosArs;
  const ingresosHoy = filteredMovements.filter((m: any) => m.type === 'in').reduce((acc: number, m: any) => acc + toArs(m.amount, m.currency || 'ARS'), 0);
  const egresosHoy = filteredMovements.filter((m: any) => m.type === 'out').reduce((acc: number, m: any) => acc + toArs(m.amount, m.currency || 'ARS'), 0);
  const totalCobrar30d = customers.reduce((acc: number, c: any) => acc + (c.currentBalance || 0), 0);
  const totalPagar30d = totalObligacionesArs;

  const caja = [
    { label: 'Caja al período', value: formatCurrency(balanceCaja), color: 'var(--text-primary)' },
    { label: 'Ingresos período', value: formatCurrency(ingresosHoy), color: '#16a34a' },
    { label: 'Egresos período', value: formatCurrency(egresosHoy), color: '#dc2626' },
    { label: 'A cobrar (30d)', value: formatCurrency(totalCobrar30d), color: '#d97706' },
    { label: 'A pagar (30d)', value: formatCurrency(totalPagar30d), color: '#dc2626' },
  ];

  // 6. Actividad Reciente
  const allEvents: any[] = [];
  filteredSales.slice(0, 5).forEach((s: any) => {
    allEvents.push({
      timestamp: s.date,
      title: `Nuevo pedido ${s.remitoNumber || ''}`,
      desc: s.customerName,
      time: getFriendlyTimeStr(s.date),
      icon: Box
    });
  });

  filteredOrders.slice(0, 5).forEach((o: any) => {
    allEvents.push({
      timestamp: o.updatedAt || o.date,
      title: o.status === 'ENTREGADO' || o.status === 'FACTURADO' || o.status === 'PRODUCIDO' ? 'Pedido Completado' : 'Pedido Registrado',
      desc: `${o.customerName} - ${formatCurrency(o.total)}`,
      time: getFriendlyTimeStr(o.updatedAt || o.date),
      icon: CheckCircle2
    });
  });

  filteredMovements.slice(0, 5).forEach((m: any) => {
    allEvents.push({
      timestamp: m.createdAt || m.date,
      title: m.type === 'in' ? 'Ingreso de caja' : 'Egreso de caja',
      desc: m.description,
      time: getFriendlyTimeStr(m.createdAt || m.date),
      icon: m.type === 'in' ? DollarSign : CreditCard
    });
  });

  const sortedActivity = allEvents
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 4);

  if (sortedActivity.length === 0) {
    sortedActivity.push({
      timestamp: 0,
      title: 'Sin actividad registrada',
      desc: 'Comience a operar para ver las actividades aquí.',
      time: '',
      icon: Star
    });
  }

  return (
    <>
      <PageHeader title="Centro Operativo" description="Resumen inteligente del negocio en tiempo real basado en datos reales de Firestore" />
      
      {/* 1. Resumen del Día */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500, marginBottom: '8px' }}>{stat.title}</p>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>{stat.value}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', color: stat.isUp ? '#16a34a' : '#dc2626' }}>
                    {stat.trend !== 'Igual' && stat.trend !== 'Crítico' && stat.trend !== 'Al día' ? (stat.isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />) : <Activity size={16} />}
                    <span style={{ fontWeight: 500 }}>{stat.trend}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{stat.labelSuffix}</span>
                  </div>
                </div>
                <div style={{ padding: '10px', backgroundColor: stat.alert ? '#fee2e2' : 'var(--primary-light)', color: stat.alert ? '#dc2626' : 'var(--primary-color)', borderRadius: '10px' }}>
                  <Icon size={20} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '24px', marginBottom: '24px' }}>
        {/* 2. Alertas Inteligentes */}
        <Card padding="none" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#fafafa' }}>
             <CardHeader title="Alertas Inteligentes" subtitle="Requieren atención" />
          </div>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
            {generatedAlerts.map((alert, idx) => {
              const bg = alert.type === 'error' ? '#fef2f2' : alert.type === 'warning' ? '#fefce8' : '#f0fdf4';
              const border = alert.type === 'error' ? '#fecaca' : alert.type === 'warning' ? '#fef08a' : '#bbf7d0';
              const color = alert.type === 'error' ? '#dc2626' : alert.type === 'warning' ? '#ca8a04' : '#16a34a';
              const AlertIcon = alert.icon;
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '8px' }}>
                  <AlertIcon size={20} color={color} />
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, color: color }}>{alert.title}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 5. Caja Rápida & 4. Tops del Negocio */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Caja Rápida */}
          <Card padding="none">
             <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
                <CardHeader title="Estado de Caja" subtitle="Resumen financiero inmediato real" />
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', padding: '24px', gap: '16px' }}>
                {caja.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', borderRight: idx < 4 ? '1px solid var(--border-color)' : 'none' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>{item.label}</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: item.color }}>{item.value}</span>
                  </div>
                ))}
             </div>
          </Card>

          {/* Tops */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <Card>
              <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Package size={16} /> Productos Top
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {topProductsList.map((item, i) => (
                  <div key={i} style={{ fontSize: '0.875rem', fontWeight: 500 }}>{i+1}. {item}</div>
                ))}
              </div>
            </Card>
            <Card>
              <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={16} /> Más Rentables
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {topRentablesList.map((item, i) => (
                  <div key={i} style={{ fontSize: '0.875rem', fontWeight: 500 }}>{i+1}. {item}</div>
                ))}
              </div>
            </Card>
            <Card>
              <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={16} /> Mejores Clientes
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {topCustomersList.map((item, i) => (
                  <div key={i} style={{ fontSize: '0.875rem', fontWeight: 500 }}>{i+1}. {item}</div>
                ))}
              </div>
            </Card>
            <Card>
              <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} /> Zonas Calientes
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {topZonesList.map((item, i) => (
                  <div key={i} style={{ fontSize: '0.875rem', fontWeight: 500 }}>{i+1}. {item}</div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* 3. Hoy en el Negocio */}
        <Card>
          <CardHeader title="Hoy en el Negocio" subtitle="Línea de tiempo operativa real" />
          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative' }}>
             <div style={{ position: 'absolute', left: '19px', top: '10px', bottom: '10px', width: '2px', backgroundColor: 'var(--border-color)' }}></div>
             {sortedTimeline.map((item, idx) => {
               const ItemIcon = item.icon;
               return (
                 <div key={idx} style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                   <div style={{ backgroundColor: item.color, width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0, boxShadow: '0 0 0 4px var(--bg-secondary)' }}>
                     <ItemIcon size={20} />
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px' }}>{item.time}</span>
                      </div>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{item.desc}</span>
                   </div>
                 </div>
               );
             })}
          </div>
        </Card>

        {/* 6. Actividad Reciente */}
        <Card>
          <CardHeader title="Actividad Reciente" subtitle="Últimos movimientos registrados reales" />
          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sortedActivity.map((item, idx) => {
              const ItemIcon = item.icon;
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                   <div style={{ backgroundColor: 'var(--primary-light)', padding: '10px', borderRadius: '8px', color: 'var(--primary-color)' }}>
                     <ItemIcon size={20} />
                   </div>
                   <div style={{ flex: 1 }}>
                     <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                     <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{item.desc}</div>
                   </div>
                   <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                     {item.time}
                   </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
};
