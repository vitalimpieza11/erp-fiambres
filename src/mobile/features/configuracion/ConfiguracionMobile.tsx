import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Bluetooth, Printer, Moon, Power, Building2, User } from 'lucide-react';
import MobileTopBar from '../../layout/MobileTopBar';
import MobileListItem from '../../components/MobileListItem';

export default function ConfiguracionMobile() {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);
  const [bluetooth, setBluetooth] = useState(false);

  // Switch Toggle Simple para mock
  const renderToggle = (val: boolean, setVal: (v: boolean) => void) => (
    <div 
      onClick={() => setVal(!val)}
      style={{
        width: '50px', height: '30px', borderRadius: '15px',
        backgroundColor: val ? '#10b981' : '#e5e7eb',
        position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s'
      }}
    >
      <div style={{
        width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'white',
        position: 'absolute', top: '2px', left: val ? '22px' : '2px',
        transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f9fafb' }}>
      <MobileTopBar 
        title="Ajustes" 
        leftElement={<div onClick={() => navigate('/mobile')} style={{ padding: '8px' }}><ArrowLeft size={24} color="var(--mobile-text-secondary)" /></div>}
      />

      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        
        <h3 style={{ fontSize: '13px', color: '#6b7280', textTransform: 'uppercase', margin: '8px 0 8px 16px', fontWeight: 600 }}>Cuenta</h3>
        <div style={{ backgroundColor: 'white', borderRadius: '20px', overflow: 'hidden', marginBottom: '24px' }}>
          <MobileListItem 
            title="Mi Perfil" subtitle="Admin" 
            leftIcon={<div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '12px' }}><User size={20} color="#3b82f6"/></div>}
          />
          <MobileListItem 
            title="Datos de la Empresa" subtitle="Razón social, logo..." 
            leftIcon={<div style={{ backgroundColor: '#f3f4f6', padding: '10px', borderRadius: '12px' }}><Building2 size={20} color="#4b5563"/></div>}
          />
        </div>

        <h3 style={{ fontSize: '13px', color: '#6b7280', textTransform: 'uppercase', margin: '8px 0 8px 16px', fontWeight: 600 }}>Hardware (Próximamente)</h3>
        <div style={{ backgroundColor: 'white', borderRadius: '20px', overflow: 'hidden', marginBottom: '24px' }}>
          <MobileListItem 
            title="Bluetooth" subtitle={bluetooth ? 'Conectado' : 'Desconectado'} 
            leftIcon={<div style={{ backgroundColor: '#eff6ff', padding: '10px', borderRadius: '12px' }}><Bluetooth size={20} color="#3b82f6"/></div>}
            rightElement={renderToggle(bluetooth, setBluetooth)}
            onClick={() => {}}
          />
          <MobileListItem 
            title="Impresora Térmica" subtitle="Sin configurar" 
            leftIcon={<div style={{ backgroundColor: '#f5f3ff', padding: '10px', borderRadius: '12px' }}><Printer size={20} color="#8b5cf6"/></div>}
          />
        </div>

        <h3 style={{ fontSize: '13px', color: '#6b7280', textTransform: 'uppercase', margin: '8px 0 8px 16px', fontWeight: 600 }}>Apariencia</h3>
        <div style={{ backgroundColor: 'white', borderRadius: '20px', overflow: 'hidden', marginBottom: '24px' }}>
          <MobileListItem 
            title="Modo Oscuro" subtitle="Forzar fondo oscuro" 
            leftIcon={<div style={{ backgroundColor: '#1f2937', padding: '10px', borderRadius: '12px' }}><Moon size={20} color="white"/></div>}
            rightElement={renderToggle(darkMode, setDarkMode)}
            onClick={() => {}}
          />
        </div>

        <button style={{ width: '100%', padding: '20px', backgroundColor: 'white', border: 'none', borderRadius: '20px', color: '#ef4444', fontWeight: 700, fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Power size={20} /> CERRAR SESIÓN
        </button>

      </div>
    </div>
  );
}
