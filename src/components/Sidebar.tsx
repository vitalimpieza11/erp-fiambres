import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Factory, 
  Package, 
  Store, 
  Users, 
  Tags, 
  LineChart,
  Landmark,
  Wallet,
  Truck,
  TrendingUp,
  Award,
  Settings,
  Beef,
  PieChart,
  LogOut
} from 'lucide-react';

import { X } from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { logout } = useAuth();
  const [logoutHover, setLogoutHover] = useState(false);
  
  const menuSections = [
    {
      title: 'Principal',
      items: [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' }
      ]
    },
    {
      title: 'Operaciones',
      items: [
        { path: '/productos', icon: Beef, label: 'Productos' },
        { path: '/compras', icon: ShoppingCart, label: 'Compras' },
        { path: '/produccion', icon: Factory, label: 'Producción' },
        { path: '/stock', icon: Package, label: 'Stock' },
        { path: '/ventas', icon: Store, label: 'Ventas' }
      ]
    },
    {
      title: 'Comercial',
      items: [
        { path: '/clientes', icon: Users, label: 'Clientes' },
        { path: '/precios', icon: Tags, label: 'Lista de Precios' },
        { path: '/competencia', icon: LineChart, label: 'Competencia' }
      ]
    },
    {
      title: 'Finanzas',
      items: [
        { path: '/caja-bancos', icon: Landmark, label: 'Caja y Bancos' },
        { path: '/cuenta-corriente', icon: Wallet, label: 'Cuenta Corriente' },
        { path: '/proveedores', icon: Truck, label: 'Proveedores' }
      ]
    },
    {
      title: 'Reportes',
      items: [
        { path: '/reportes', icon: PieChart, label: 'Panel de Analítica' },
        { path: '/rentabilidad', icon: TrendingUp, label: 'Rentabilidad' },
        { path: '/top-productos', icon: Award, label: 'Productos más vendidos' }
      ]
    },
    {
      title: 'Sistema',
      items: [
        { path: '/configuracion', icon: Settings, label: 'Configuración' }
      ]
    }
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 10px', backgroundColor: '#FFFFFF', borderRadius: '12px', margin: '20px 16px 16px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <img src="/logo_principal.png" alt="Al Vacío Logo" style={{ width: '180px', height: 'auto', objectFit: 'contain' }} />
        {onClose && (
          <button className="icon-btn mobile-close-sidebar" onClick={onClose} style={{ color: '#000', marginLeft: '8px' }}>
            <X size={20} />
          </button>
        )}
      </div>
      
      <nav className="sidebar-nav">
        {menuSections.map((section, idx) => (
          <div key={idx} className="nav-section">
            {section.title !== 'Principal' && (
              <div className="nav-section-title">{section.title}</div>
            )}
            {section.items.map((item, itemIdx) => {
              const Icon = item.icon;
              return (
                <NavLink 
                  key={itemIdx} 
                  to={item.path} 
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon className="nav-icon" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: '16px', marginTop: 'auto', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <button 
          onClick={logout}
          onMouseEnter={() => setLogoutHover(true)}
          onMouseLeave={() => setLogoutHover(false)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 16px',
            fontSize: '0.875rem',
            fontWeight: 500,
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: logoutHover ? 'var(--primary-color)' : 'rgba(255, 255, 255, 0.02)',
            color: logoutHover ? '#FFFFFF' : '#ADB5BD',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'var(--font-title)'
          }}
        >
          <LogOut size={16} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
};
