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
  Settings 
} from 'lucide-react';
import TopLogo from './TopLogo';
import './Layout.css';

export default function Layout() {
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
          <div className="user-profile">
            <span>Administrador</span>
            <div className="user-avatar"></div>
          </div>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
