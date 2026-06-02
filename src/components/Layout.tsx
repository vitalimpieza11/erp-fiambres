import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Bell, Menu, Search, Factory, Beef, Package, Tags, Store, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useDateFilter } from '../contexts/DateFilterContext';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { 
    selectedYear, selectedMonth, selectedDay, viewType, 
    setSelectedYear, setSelectedMonth, setSelectedDay, setViewType, 
    handlePrev, handleNext 
  } = useDateFilter();

  const currentYear = new Date().getFullYear();

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

        {/* Date Filter Sub-Header Bar */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          padding: '10px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          zIndex: 30,
          position: 'sticky',
          top: 0
        }}>
          {/* View Type Toggle Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginRight: '8px' }}>
              Filtro Temporal:
            </span>
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-primary)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {(['day', 'month', 'year', 'all'] as const).map((type) => {
                const label = { day: 'Día', month: 'Mes', year: 'Año', all: 'Todo' }[type];
                const isActive = viewType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setViewType(type)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: isActive ? 'var(--primary-color)' : 'transparent',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      fontWeight: isActive ? 600 : 500,
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation Controls */}
          {viewType !== 'all' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button 
                onClick={handlePrev}
                className="btn btn-secondary" 
                style={{ padding: '6px 10px', height: '36px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ChevronLeft size={16} />
              </button>

              {/* Day Selector (only for day view) */}
              {viewType === 'day' && (
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(parseInt(e.target.value))}
                  className="form-select"
                  style={{ width: '70px', padding: '4px 8px', height: '36px' }}
                >
                  {Array.from({ length: new Date(selectedYear, selectedMonth + 1, 0).getDate() }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              )}

              {/* Month Selector (for day and month views) */}
              {(viewType === 'day' || viewType === 'month') && (
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="form-select"
                  style={{ width: '120px', padding: '4px 8px', height: '36px' }}
                >
                  {MONTHS.map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
              )}

              {/* Year Selector */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="form-select"
                style={{ width: '90px', padding: '4px 8px', height: '36px' }}
              >
                {Array.from({ length: 7 }, (_, i) => currentYear - 3 + i).map((yr) => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>

              <button 
                onClick={handleNext}
                className="btn btn-secondary" 
                style={{ padding: '6px 10px', height: '36px', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Current Period Display Text */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}>
            <Calendar size={16} color="var(--primary-color)" />
            <span>
              Período Activo: 
              <strong style={{ color: 'var(--text-primary)', marginLeft: '4px' }}>
                {viewType === 'day' && `${selectedDay} de ${MONTHS[selectedMonth]} ${selectedYear}`}
                {viewType === 'month' && `${MONTHS[selectedMonth]} ${selectedYear}`}
                {viewType === 'year' && `${selectedYear}`}
                {viewType === 'all' && 'Todos los datos'}
              </strong>
            </span>
          </div>
        </div>
        
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
