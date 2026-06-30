import { NavLink } from 'react-router-dom';
import { Home, ClipboardList, DollarSign, Package, Menu } from 'lucide-react';

export default function MobileBottomNav() {
  const navItems = [
    { to: '/mobile', icon: Home, label: 'Inicio', exact: true },
    { to: '/mobile/pedidos', icon: ClipboardList, label: 'Pedidos' },
    { to: '/mobile/ventas', icon: DollarSign, label: 'Ventas' },
    { to: '/mobile/productos', icon: Package, label: 'Productos' },
    { to: '/mobile/mas', icon: Menu, label: 'Más' },
  ];

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '70px',
      backgroundColor: 'var(--mobile-surface)',
      borderTop: '1px solid var(--mobile-border)',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingBottom: 'env(safe-area-inset-bottom, 16px)', // Safe area iOS
      zIndex: 50,
      boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
    }}>
      {navItems.map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          end={item.exact}
          className="mobile-no-select"
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            color: isActive ? 'var(--mobile-primary)' : 'var(--mobile-text-secondary)',
            WebkitTapHighlightColor: 'transparent',
            width: '100%',
            height: '100%',
            transition: 'color 0.2s ease'
          })}
        >
          {({ isActive }) => {
            const Icon = item.icon;
            return (
              <>
                <div style={{ 
                  padding: '4px 16px', 
                  borderRadius: '16px',
                  backgroundColor: isActive ? 'var(--mobile-primary-light)' : 'transparent',
                  marginBottom: '4px',
                  transition: 'background-color 0.2s ease'
                }}>
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: isActive ? 600 : 500,
                }}>
                  {item.label}
                </span>
              </>
            );
          }}
        </NavLink>
      ))}
    </nav>
  );
}
