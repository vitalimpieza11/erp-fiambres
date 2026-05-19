import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { 
  Download, FileSpreadsheet, Calendar, TrendingUp, TrendingDown, 
  DollarSign, Package, Factory, Users, AlertTriangle, Activity,
  ChevronDown, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { Card, CardHeader } from '../components/ui/Card';

const salesData = [
  { name: 'Lun', ventas: 4000, ticket: 2400 },
  { name: 'Mar', ventas: 3000, ticket: 1398 },
  { name: 'Mié', ventas: 2000, ticket: 9800 },
  { name: 'Jue', ventas: 2780, ticket: 3908 },
  { name: 'Vie', ventas: 1890, ticket: 4800 },
  { name: 'Sáb', ventas: 2390, ticket: 3800 },
  { name: 'Dom', ventas: 3490, ticket: 4300 },
];

const productData = [
  { name: 'Jamón Cocido', rentabilidad: 45, margen: 25 },
  { name: 'Queso Tybo', rentabilidad: 30, margen: 15 },
  { name: 'Salame Milán', rentabilidad: 60, margen: 35 },
  { name: 'Mortadela', rentabilidad: 20, margen: 10 },
  { name: 'Panceta', rentabilidad: 55, margen: 30 },
];

const financeData = [
  { name: 'Ene', ingresos: 4000, egresos: 2400 },
  { name: 'Feb', ingresos: 3000, egresos: 1398 },
  { name: 'Mar', ingresos: 2000, egresos: 9800 },
  { name: 'Abr', ingresos: 2780, egresos: 3908 },
  { name: 'May', ingresos: 1890, egresos: 4800 },
  { name: 'Jun', ingresos: 2390, egresos: 3800 },
];

const productionEfficiency = [
  { name: 'Aprovechado', value: 85 },
  { name: 'Merma', value: 15 },
];

const COLORS = ['#be123c', '#f43f5e', '#fb7185', '#fda4af', '#fff1f2'];
const PIE_COLORS = ['#10b981', '#ef4444'];

export const Reportes = () => {
  const [activeTab, setActiveTab] = useState('ventas');
  const [period, setPeriod] = useState('Mes');

  const tabs = [
    { id: 'ventas', label: 'Ventas', icon: DollarSign },
    { id: 'productos', label: 'Productos', icon: Package },
    { id: 'produccion', label: 'Producción', icon: Factory },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'finanzas', label: 'Finanzas', icon: Activity },
  ];

  const StatCard = ({ title, value, subValue, trend, isUp, icon: Icon }: { title: string, value: string, subValue?: string, trend: string, isUp: boolean, icon: any }) => (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500, marginBottom: '8px' }}>{title}</p>
          <h3 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{value}</h3>
          {subValue && <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{subValue}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', color: isUp ? '#16a34a' : '#dc2626' }}>
            {isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            <span style={{ fontWeight: 500 }}>{trend}</span>
            <span style={{ color: 'var(--text-secondary)' }}>vs periodo ant.</span>
          </div>
        </div>
        <div style={{ padding: '12px', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', borderRadius: '12px' }}>
          <Icon size={24} />
        </div>
      </div>
    </Card>
  );

  const AlertCard = ({ title, message, type }: { title: string, message: string, type: 'warning' | 'error' }) => (
    <div style={{ 
      display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', 
      backgroundColor: type === 'warning' ? '#fefce8' : '#fef2f2',
      border: `1px solid ${type === 'warning' ? '#fef08a' : '#fecaca'}`,
      borderRadius: '12px', marginBottom: '16px'
    }}>
      <div style={{ color: type === 'warning' ? '#ca8a04' : '#dc2626' }}>
        <AlertTriangle size={24} />
      </div>
      <div>
        <h4 style={{ fontWeight: 600, color: type === 'warning' ? '#854d0e' : '#991b1b' }}>{title}</h4>
        <p style={{ fontSize: '0.875rem', color: type === 'warning' ? '#a16207' : '#b91c1c' }}>{message}</p>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Reportes y Analítica</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Métricas clave y rendimiento del negocio</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* Period Selector */}
          <div style={{ display: 'flex', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            {['Hoy', 'Semana', 'Mes', 'Personalizado'].map(p => (
              <button 
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: period === p ? 'var(--primary-light)' : 'transparent',
                  color: period === p ? 'var(--primary-color)' : 'var(--text-secondary)',
                  fontWeight: period === p ? 600 : 500,
                  cursor: 'pointer',
                  borderRight: '1px solid var(--border-color)'
                }}
              >
                {p}
              </button>
            ))}
          </div>
          
          <button className="btn btn-secondary">
            <FileSpreadsheet size={18} color="#10b981" /> Excel
          </button>
          <button className="btn btn-secondary">
            <Download size={18} color="#ef4444" /> PDF
          </button>
        </div>
      </div>

      {/* Smart Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        <AlertCard title="Margen bajo detectado" message="Mortadela y Salchichón con margen menor al 15%." type="warning" />
        <AlertCard title="Stock crítico" message="Queso Tybo por debajo del mínimo histórico." type="error" />
        <AlertCard title="Cliente con deuda vencida" message="Supermercado Los Andes debe $112.500 (+15 días)." type="warning" />
      </div>

      {/* Top Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
        <StatCard title="Ventas Totales" value="$ 4.250.000" trend="+12.5%" isUp={true} icon={DollarSign} />
        <StatCard title="Utilidad Neta Est." value="$ 1.150.000" subValue="27.05% margen prom." trend="+5.2%" isUp={true} icon={TrendingUp} />
        <StatCard title="Kg Vendidos" value="1.240 kg" trend="-2.1%" isUp={false} icon={Package} />
        <StatCard title="Producción Total" value="1.500 kg" trend="+8.4%" isUp={true} icon={Factory} />
        <StatCard title="Deuda por Cobrar" value="$ 850.000" trend="+15.0%" isUp={false} icon={AlertTriangle} />
        <StatCard title="Deuda por Pagar" value="$ 320.000" trend="-5.0%" isUp={true} icon={Activity} />
      </div>

      {/* Navigation Tabs */}
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

      {/* Tab Content */}
      <div style={{ minHeight: '400px' }}>
        {activeTab === 'ventas' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            <Card padding="none">
              <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
                <CardHeader title="Evolución de Ventas" subtitle="Ingresos vs Ticket Promedio" />
              </div>
              <div style={{ height: '350px', padding: '24px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }}
                    />
                    <Area type="monotone" dataKey="ventas" stroke="var(--primary-color)" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <Card>
                <CardHeader title="Ticket Promedio" subtitle="General del periodo" />
                <div style={{ marginTop: '16px' }}>
                  <h2 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>$ 3.850</h2>
                  <p style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, marginTop: '8px' }}>
                    <ArrowUpRight size={16} /> +12% vs anterior
                  </p>
                </div>
              </Card>
              <Card>
                <CardHeader title="Zonas Top" subtitle="Mayor volumen" />
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {['Centro', 'Barrio Norte', 'Sur'].map((zona, idx) => (
                    <div key={zona} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{zona}</span>
                      <span style={{ fontWeight: 600 }}>{85 - idx * 20}%</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'productos' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <Card padding="none">
              <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
                <CardHeader title="Rentabilidad vs Margen" subtitle="Top 5 productos" />
              </div>
              <div style={{ height: '350px', padding: '24px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                    <Bar dataKey="rentabilidad" fill="var(--primary-color)" radius={[0, 4, 4, 0]} barSize={20} />
                    <Bar dataKey="margen" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardHeader title="Ranking de Utilidad" subtitle="Mayor ganancia neta aportada" />
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {['Salame Milán - 25%', 'Panceta Ahumada - 20%', 'Jamón Cocido - 18%', 'Queso Tybo - 12%', 'Mortadela - 8%'].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, backgroundColor: 'var(--bg-primary)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: item.split('-')[1].trim(), height: '100%', backgroundColor: 'var(--primary-color)', borderRadius: '4px' }} />
                    </div>
                    <span style={{ minWidth: '150px', fontWeight: 500, fontSize: '0.875rem' }}>{item}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'produccion' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            <Card>
              <CardHeader title="Eficiencia de Producción" subtitle="Aprovechamiento vs Merma" />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={productionEfficiency} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                      {productionEfficiency.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
               <Card>
                <CardHeader title="Costo Promedio" subtitle="Por kg procesado" />
                <div style={{ marginTop: '16px' }}>
                  <h2 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>$ 2.150</h2>
                  <p style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, marginTop: '8px' }}>
                    <ArrowDownRight size={16} /> -3.5% vs anterior
                  </p>
                </div>
              </Card>
              <Card>
                <CardHeader title="Lotes Realizados" subtitle="Mes actual" />
                <div style={{ marginTop: '16px' }}>
                  <h2 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>45</h2>
                  <p style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500, marginTop: '8px' }}>
                    <ArrowUpRight size={16} /> +5 lotes vs anterior
                  </p>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'clientes' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
             <Card>
              <CardHeader title="Clientes Top" subtitle="Mayor volumen de compra" />
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { name: 'Supermercado Los Andes', val: '$ 450.000' },
                  { name: 'Despensa Mario', val: '$ 320.000' },
                  { name: 'Fiambrería El Sol', val: '$ 280.000' }
                ].map((item, idx) => (
                   <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                      <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{item.val}</span>
                   </div>
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader title="Clientes Morosos" subtitle="Mayor deuda acumulada" />
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[
                  { name: 'Distribuidora Sur', val: '$ 125.000', days: '45 días' },
                  { name: 'Almacén Don Juan', val: '$ 85.000', days: '30 días' },
                ].map((item, idx) => (
                   <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{item.name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#dc2626' }}>Atraso: {item.days}</span>
                      </div>
                      <span style={{ fontWeight: 600, color: '#dc2626' }}>{item.val}</span>
                   </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'finanzas' && (
          <Card padding="none">
             <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
                <CardHeader title="Flujo de Caja" subtitle="Ingresos vs Egresos (Últimos 6 meses)" />
              </div>
              <div style={{ height: '400px', padding: '24px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={financeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                    <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="egresos" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
          </Card>
        )}
      </div>
    </div>
  );
};
