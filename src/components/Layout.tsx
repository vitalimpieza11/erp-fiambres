import { Outlet, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Wrench, 
  Package, 
  TrendingUp, 
  Users, 
  Truck, 
  CreditCard, 
  Wallet, 
  Briefcase, 
  Settings,
  LogOut,
  Receipt,
  Sparkles,
  Calendar,
  ShieldCheck,
  Scale,
  Database
} from 'lucide-react';
import TopLogo from './TopLogo';
import { useAuthStore } from '../store/authStore';
import { usePeriodFilterStore } from '../store/periodFilterStore';
import type { PeriodType } from '../utils/dateRangeUtils';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const { selectedPeriod, customRange, setPeriod, setCustomRange } = usePeriodFilterStore();

  const navGroups = [
    {
      title: 'OPERACIÓN',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={22} /> },
        { path: '/ventas', label: 'Ventas', icon: <TrendingUp size={22} /> },
        { path: '/pedidos', label: 'Pedidos', icon: <ShoppingCart size={22} /> },
        { path: '/produccion', label: 'Producción', icon: <Wrench size={22} /> },
        { path: '/compras', label: 'Compras', icon: <CreditCard size={22} /> },
        { path: '/facturacion', label: 'Facturación', icon: <Receipt size={22} /> },
      ]
    },
    {
      title: 'INVENTARIO',
      items: [
        { path: '/stock', label: 'Stock', icon: <Package size={22} /> },
        { path: '/balanza', label: 'Códigos de Balanza', icon: <Scale size={22} /> },
        { path: '/diagnostico-stock', label: 'Diagnóstico Stock', icon: <Database size={22} /> },
      ]
    },
    {
      title: 'FINANZAS',
      items: [
        { path: '/caja', label: 'Caja', icon: <Wallet size={22} /> },
        { path: '/socios', label: 'Socios', icon: <Briefcase size={22} /> },
      ]
    },
    {
      title: 'CRM',
      items: [
        { path: '/clientes', label: 'Clientes', icon: <Users size={22} /> },
        { path: '/proveedores', label: 'Proveedores', icon: <Truck size={22} /> },
      ]
    },
    {
      title: 'SISTEMA',
      items: [
        { path: '/configuracion', label: 'Configuración', icon: <Settings size={22} /> },
        { path: '/auditoria', label: 'Auditoría', icon: <ShieldCheck size={22} /> },
        { path: '/asistente-inicio', label: 'Asistente de Inicio', icon: <Sparkles size={22} /> },
      ]
    }
  ];

  return (
    <div className="layout-container">
      {/* Top Logo Independiente */}
      <TopLogo />

      {/* Sidebar Flotante */}
      <aside className="sidebar">
        <nav className="nav-menu">
          {navGroups.map((group, groupIdx) => (
            <div key={group.title} className="nav-group">
              <div className="nav-group-title">{group.title}</div>
              {group.items.map((item) => (
                <NavLink 
                  key={item.path} 
                  to={item.path} 
                  className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
                  title={item.label}
                >
                  <div className="nav-icon">{item.icon}</div>
                  <span className="nav-text">{item.label}</span>
                </NavLink>
              ))}
              {groupIdx < navGroups.length - 1 && <div className="nav-group-divider" />}
            </div>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 40px' }}>
          {/* Selector de Período Global */}
          <div className="period-selector-container" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '6px 12px', boxShadow: 'var(--shadow-sm)' }}>
              <Calendar size={16} style={{ color: 'var(--alvacio-red)' }} />
              <select
                value={selectedPeriod}
                onChange={(e) => setPeriod(e.target.value as PeriodType)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  padding: '4px 8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  width: 'auto',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  cursor: 'pointer',
                  boxShadow: 'none'
                }}
              >
                <option value="HOY">Hoy</option>
                <option value="ESTA_SEMANA">Esta Semana</option>
                <option value="ESTE_MES">Este Mes</option>
                <option value="MES_ANTERIOR">Mes Anterior</option>
                <option value="ULTIMOS_3_MESES">Últimos 3 Meses</option>
                <option value="ULTIMOS_6_MESES">Últimos 6 Meses</option>
                <option value="ESTE_ANO">Este Año</option>
                <option value="PERSONALIZADO">Personalizado</option>
              </select>
            </div>

            {selectedPeriod === 'PERSONALIZADO' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '6px 12px', boxShadow: 'var(--shadow-sm)' }}>
                <input
                  type="date"
                  value={customRange.startDate}
                  onChange={(e) => setCustomRange({ ...customRange, startDate: e.target.value })}
                  style={{
                    border: 'none',
                    padding: '2px 4px',
                    fontSize: '13px',
                    width: '120px',
                    backgroundColor: 'transparent',
                    outline: 'none',
                    boxShadow: 'none'
                  }}
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>al</span>
                <input
                  type="date"
                  value={customRange.endDate}
                  onChange={(e) => setCustomRange({ ...customRange, endDate: e.target.value })}
                  style={{
                    border: 'none',
                    padding: '2px 4px',
                    fontSize: '13px',
                    width: '120px',
                    backgroundColor: 'transparent',
                    outline: 'none',
                    boxShadow: 'none'
                  }}
                />
              </div>
            )}
          </div>

          <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{user?.email || 'Administrador'}</span>
            <div className="user-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--alvacio-red)', color: '#ffffff', fontWeight: 'bold', fontSize: '14px' }}>
              {(user?.email || 'A').charAt(0).toUpperCase()}
            </div>
            <button 
              onClick={() => {
                if (window.confirm('¿Desea cerrar la sesión actual?')) {
                  logout();
                }
              }}
              style={{
                background: 'rgba(196, 49, 38, 0.08)',
                border: 'none',
                color: 'var(--alvacio-red)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                borderRadius: '8px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--alvacio-red)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(196, 49, 38, 0.08)';
                e.currentTarget.style.color = 'var(--alvacio-red)';
              }}
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
