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
  LogOut
} from 'lucide-react';
import TopLogo from './TopLogo';
import { useAuthStore } from '../store/authStore';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={22} /> },
    { path: '/pedidos', label: 'Pedidos', icon: <ShoppingCart size={22} /> },
    { path: '/produccion', label: 'Producción', icon: <Wrench size={22} /> },
    { path: '/stock', label: 'Stock', icon: <Package size={22} /> },
    { path: '/ventas', label: 'Ventas', icon: <TrendingUp size={22} /> },
    { path: '/clientes', label: 'Clientes', icon: <Users size={22} /> },
    { path: '/proveedores', label: 'Proveedores', icon: <Truck size={22} /> },
    { path: '/compras', label: 'Compras', icon: <CreditCard size={22} /> },
    { path: '/caja', label: 'Caja', icon: <Wallet size={22} /> },
    { path: '/socios', label: 'Socios', icon: <Briefcase size={22} /> },
    { path: '/configuracion', label: 'Configuración', icon: <Settings size={22} /> },
  ];

  return (
    <div className="layout-container">
      {/* Top Logo Independiente */}
      <TopLogo />

      {/* Sidebar Flotante */}
      <aside className="sidebar">
        <nav className="nav-menu">
          {navItems.map((item) => (
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
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
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
