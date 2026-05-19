import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Bell, Menu, Search } from 'lucide-react';

export const Layout = () => {
  return (
    <div className="app-container">
      <Sidebar />
      
      <main className="main-content">
        <header className="top-header" style={{ position: 'relative' }}>
          <div className="header-actions">
            <button className="icon-btn mobile-toggle">
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
          <div style={{
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
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Admin User</span>
            </div>
          </div>
        </header>
        
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
