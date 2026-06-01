import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Bell, Menu, Search, Factory, Beef, Package, Tags, Store } from 'lucide-react';

export const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Mobile Sidebar Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 45,
            transition: 'opacity 0.3s ease'
          }}
        />
      )}
      
      <main className="main-content">
        <header className="top-header" style={{ position: 'relative' }}>
          <div className="header-actions">
            <button className="icon-btn mobile-toggle" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="search-bar" style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '8px 16px', borderRadius: '8px', width: '260px' }}>
              <Search size={18} color="#64748b" style={{ marginRight: '8px' }} />
              <input 
                type="text" 
                placeholder="Buscar..." 
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.9rem' }} 
              />
            </div>
          </div>
          
          {/* Centered Large Logo Seal */}
          <div className="header-logo-center" style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            pointerEvents: 'none'
          }}>
            <img src="/logo_principal.png" alt="Al Vacío Logo" style={{ height: '56px', width: 'auto', objectFit: 'contain' }} />
          </div>
          
          <div className="header-actions">
            <button className="icon-btn">
              <Bell size={20} />
            </button>
            <div className="user-profile">
              <div className="avatar">A</div>
              <span className="desktop-user-name" style={{ fontSize: '0.9rem', fontWeight: 500 }}>Admin User</span>
            </div>
          </div>
        </header>
        
        <div className="page-container">
          <Outlet />
        </div>
        
        {/* Bottom Navigation for Mobile */}
        <nav className="mobile-bottom-nav">
          <NavLink to="/produccion" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
            <Factory size={20} />
            <span>Producción</span>
          </NavLink>
          <NavLink to="/productos" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
            <Beef size={20} />
            <span>Productos</span>
          </NavLink>
          <NavLink to="/stock" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
            <Package size={20} />
            <span>Stock</span>
          </NavLink>
          <NavLink to="/precios" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
            <Tags size={20} />
            <span>Precios</span>
          </NavLink>
          <NavLink to="/ventas" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
            <Store size={20} />
            <span>Ventas</span>
          </NavLink>
        </nav>
      </main>
    </div>
  );
};
