import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { 
  Download, FileSpreadsheet, TrendingUp, TrendingDown, 
  DollarSign, Package, Factory, Users, AlertTriangle, Activity,
  ArrowUpRight, ArrowDownRight, SearchX
} from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { LoadingSpinner, ErrorState } from '../components/AsyncState';

import { useSales } from '../hooks/useSales';
import { useOrders } from '../hooks/useOrders';
import { useCustomers } from '../hooks/useCustomers';
import { useCashMovements } from '../hooks/useCashMovements';
import { useSuppliers } from '../hooks/useSuppliers';
import { usePresentaciones } from '../hooks/usePresentaciones';
import { formatCurrency, formatNumber } from '../utils/format';

const COLORS = ['#be123c', '#f43f5e', '#fb7185', '#fda4af', '#fff1f2'];
const PIE_COLORS = ['#10b981', '#ef4444'];

export const Reportes = () => {
  const [activeTab, setActiveTab] = useState('ventas');
  const [period, setPeriod] = useState('Mes');

  const { sales, loading: loadingSales, error: errorSales } = useSales();
  const { orders, loading: loadingOrders, error: errorOrders } = useOrders();
  const { customers, loading: loadingCustomers, error: errorCustomers } = useCustomers();
  const { movements, loading: loadingMovs, error: errorMovs } = useCashMovements();
  const { suppliers, loading: loadingSuppliers, error: errorSuppliers } = useSuppliers();
  const { presentaciones, loading: loadingPres, error: errorPres } = usePresentaciones();

  const loading = loadingSales || loadingOrders || loadingCustomers || loadingMovs || loadingSuppliers || loadingPres;
  const error = errorSales || errorOrders || errorCustomers || errorMovs || errorSuppliers || errorPres;

  if (error) {
    return <ErrorState message={typeof error === 'string' ? error : (error as any).message || 'Error al cargar reportes.'} />;
  }

  if (loading) {
    return <LoadingSpinner message="Calculando métricas y generando gráficos reales..." />;
  }

  if (sales.length === 0 && orders.length === 0 && movements.length === 0 && customers.length === 0) {
    return (
      <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <PageHeader title="Reportes y Analítica" description="Métricas clave y rendimiento del negocio" />
        <div style={{ marginTop: '48px' }}>
          <EmptyState 
            icon={Activity} 
            title="No existen datos suficientes para generar reportes" 
            description="Comience a registrar ventas, producciones o movimientos financieros para visualizar las métricas y gráficos reales." 
          />
        </div>
      </div>
    );
  }

  // General Stats
  const totalSalesAmount = sales.reduce((acc: number, s: any) => acc + (s.total || 0), 0);
  const totalCostAmount = sales.reduce((acc: number, s: any) => {
    return acc + (s.items || []).reduce((itemAcc: number, item: any) => itemAcc + (item.quantity * (item.cost || 0)), 0);
  }, 0);
  const netUtility = totalSalesAmount - totalCostAmount;

  const totalKgSold = sales.reduce((acc: number, s: any) => {
    return acc + (s.items || []).reduce((itemAcc: number, item: any) => {
      const pres = presentaciones.find((p: any) => p.id === item.productId);
      const gramaje = pres?.pesoObjetivoGramos || 200;
      return itemAcc + (item.quantity * (gramaje / 1000));
    }, 0);
  }, 0);

  const deliveredOrders = orders.filter((o: any) => o.status === 'delivered' || o.status === 'invoiced');
  const totalKgProduced = deliveredOrders.reduce((acc: number, o: any) => {
    return acc + (o.items || []).reduce((itemAcc: number, item: any) => {
      const pres = presentaciones.find((p: any) => p.id === item.productId);
      const gramaje = pres?.pesoObjetivoGramos || 200;
      const qty = (o.actualProduced && o.actualProduced[item.productId]) || item.quantity;
      return itemAcc + (qty * (gramaje / 1000));
    }, 0);
  }, 0);

  const totalDebtToReceive = customers.reduce((acc: number, c: any) => acc + (c.currentBalance || 0), 0);
  const totalDebtToPay = suppliers.reduce((acc: number, s: any) => acc + (s.currentBalance || 0), 0);

  // Tabs structure
  const tabs = [
    { id: 'ventas', label: 'Ventas', icon: DollarSign },
    { id: 'productos', label: 'Productos', icon: Package },
    { id: 'produccion', label: 'Producción', icon: Factory },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'finanzas', label: 'Finanzas', icon: Activity },
  ];

  const StatCard = ({ title, value, icon: Icon, isPositive, trendText }: any) => (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500, marginBottom: '8px' }}>{title}</p>
          <h3 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{value}</h3>
          {trendText && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', color: isPositive ? '#16a34a' : '#dc2626' }}>
              {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              <span style={{ fontWeight: 500 }}>{trendText}</span>
            </div>
          )}
        </div>
        <div style={{ padding: '12px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', borderRadius: '12px' }}>
          <Icon size={24} />
        </div>
      </div>
    </Card>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Reportes y Analítica</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Métricas reales basadas en datos consolidados</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            {['Historico'].map(p => (
              <button 
                key={p}
                style={{
                  padding: '8px 16px', border: 'none', background: 'var(--primary-light)', color: 'var(--primary-color)',
                  fontWeight: 600, cursor: 'default'
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
        <StatCard title="Ventas Totales" value={formatCurrency(totalSalesAmount)} icon={DollarSign} isPositive={true} trendText="Real" />
        <StatCard title="Utilidad Neta Est." value={formatCurrency(netUtility)} icon={TrendingUp} isPositive={netUtility >= 0} trendText="Real" />
        <StatCard title="Kg Vendidos" value={`${totalKgSold.toFixed(1)} kg`} icon={Package} isPositive={true} trendText="Real" />
        <StatCard title="Producción Total" value={`${totalKgProduced.toFixed(1)} kg`} icon={Factory} isPositive={true} trendText="Real" />
        <StatCard title="Deuda a Cobrar" value={formatCurrency(totalDebtToReceive)} icon={AlertTriangle} isPositive={totalDebtToReceive === 0} trendText="Cuentas Corrientes" />
        <StatCard title="Deuda a Pagar" value={formatCurrency(totalDebtToPay)} icon={Activity} isPositive={totalDebtToPay === 0} trendText="A Proveedores" />
      </div>

      <div style={{ borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '32px', overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 0', border: 'none', background: 'transparent',
              color: activeTab === tab.id ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: `2px solid ${activeTab === tab.id ? 'var(--primary-color)' : 'transparent'}`,
              fontWeight: activeTab === tab.id ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ minHeight: '400px' }}>
        {/* VENTAS */}
        {activeTab === 'ventas' && (
          sales.length === 0 ? (
            <EmptyState icon={DollarSign} title="No existen ventas registradas" description="El reporte se generará cuando ingreses la primera venta." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              <Card padding="none">
                <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
                  <CardHeader title="Evolución de Ventas" subtitle="Total histórico" />
                </div>
                <div style={{ height: '350px', padding: '24px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sales.sort((a: any, b: any) => a.date - b.date).map((s: any) => ({ name: new Date(s.date).toLocaleDateString(), ventas: s.total }))} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                      <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                      <Area type="monotone" dataKey="ventas" stroke="var(--primary-color)" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <Card>
                  <CardHeader title="Ticket Promedio" subtitle="General histórico" />
                  <div style={{ marginTop: '16px' }}>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {formatCurrency(totalSalesAmount / sales.length)}
                    </h2>
                  </div>
                </Card>
              </div>
            </div>
          )
        )}

        {/* PRODUCTOS */}
        {activeTab === 'productos' && (
          sales.length === 0 ? (
            <EmptyState icon={Package} title="No hay datos de productos vendidos" description="Registra ventas para ver el ranking real de productos." />
          ) : (
            <Card>
              <CardHeader title="Ranking de Utilidad por Producto" subtitle="Mayor ganancia neta aportada" />
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(() => {
                  const profits: Record<string, number> = {};
                  sales.forEach((s: any) => {
                    (s.items || []).forEach((item: any) => {
                      profits[item.productName] = (profits[item.productName] || 0) + (item.quantity * item.price - item.quantity * (item.cost || 0));
                    });
                  });
                  const topProducts = Object.entries(profits).sort((a, b) => b[1] - a[1]).slice(0, 5);
                  const maxProfit = topProducts[0]?.[1] || 1;

                  return topProducts.map(([name, profit], idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1, backgroundColor: 'var(--bg-primary)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${(profit / maxProfit) * 100}%`, height: '100%', backgroundColor: 'var(--primary-color)', borderRadius: '4px' }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: '150px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{name}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{formatCurrency(profit)}</span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </Card>
          )
        )}

        {/* PRODUCCION */}
        {activeTab === 'produccion' && (
          deliveredOrders.length === 0 ? (
            <EmptyState icon={Factory} title="No hay producciones entregadas" description="Completa pedidos en producción para ver el análisis." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
              <Card>
                <CardHeader title="Lotes / Pedidos Realizados" subtitle="Total histórico entregado" />
                <div style={{ marginTop: '16px' }}>
                  <h2 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{deliveredOrders.length}</h2>
                </div>
              </Card>
            </div>
          )
        )}

        {/* CLIENTES */}
        {activeTab === 'clientes' && (
          customers.length === 0 ? (
            <EmptyState icon={Users} title="No existen clientes con actividad" description="Registra clientes para ver el análisis de mora." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
              <Card>
                <CardHeader title="Clientes con Deuda" subtitle="Cuentas Corrientes activas" />
                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {customers.filter((c: any) => (c.currentBalance || 0) > 0).length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)' }}>Ningún cliente registra deudas.</div>
                  ) : (
                    customers.filter((c: any) => (c.currentBalance || 0) > 0).sort((a: any, b: any) => (b.currentBalance || 0) - (a.currentBalance || 0)).slice(0, 10).map((c: any, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ fontWeight: 500 }}>{c.name}</span>
                        <span style={{ fontWeight: 600, color: '#dc2626' }}>{formatCurrency(c.currentBalance)}</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          )
        )}

        {/* FINANZAS */}
        {activeTab === 'finanzas' && (
          movements.length === 0 ? (
            <EmptyState icon={Activity} title="No existen movimientos financieros" description="Registra cobros y pagos para ver el flujo de caja." />
          ) : (
            <Card padding="none">
              <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
                <CardHeader title="Flujo de Caja Histórico" subtitle="Ingresos vs Egresos por fecha" />
              </div>
              <div style={{ height: '400px', padding: '24px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  {(() => {
                    const grouped: Record<string, any> = {};
                    movements.forEach((m: any) => {
                      const d = new Date(m.createdAt || m.date).toLocaleDateString();
                      if (!grouped[d]) grouped[d] = { name: d, ingresos: 0, egresos: 0 };
                      if (m.type === 'in') grouped[d].ingresos += m.amount;
                      if (m.type === 'out') grouped[d].egresos += m.amount;
                    });
                    const data = Object.values(grouped);
                    return (
                      <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                        <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="egresos" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                      </LineChart>
                    );
                  })()}
                </ResponsiveContainer>
              </div>
            </Card>
          )
        )}
      </div>
    </div>
  );
};

export default Reportes;
