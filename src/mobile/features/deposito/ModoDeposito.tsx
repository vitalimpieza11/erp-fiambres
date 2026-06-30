import React from 'react';
import { useNavigate } from 'react-router-dom';
import MobileTopBar from '../../layout/MobileTopBar';
import MobileCard from '../../components/MobileCard';
import { Package, Search, Truck, ArrowRightLeft } from 'lucide-react';

export default function ModoDeposito() {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--mobile-bg)' }}>
      <MobileTopBar 
        title="Modo Depósito" 
        leftElement={
          <div onClick={() => navigate('/mobile')} style={{ padding: '8px', color: 'var(--mobile-text-secondary)', fontWeight: 600, fontSize: '14px' }}>
            Salir
          </div>
        }
      />

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--mobile-text-primary)', margin: 0, lineHeight: 1.2 }}>
          Gestión Operativa
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <MobileCard 
            onClick={() => navigate('/mobile/deposito/productos')}
            style={{ display: 'flex', alignItems: 'center', padding: '24px', gap: '20px', backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}
          >
            <div style={{ backgroundColor: '#3b82f6', color: 'white', padding: '16px', borderRadius: '20px' }}>
              <Search size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px 0', color: '#1e3a8a' }}>Productos</h3>
              <p style={{ margin: 0, color: '#3b82f6', fontSize: '14px' }}>Buscador, precios y costos</p>
            </div>
          </MobileCard>

          <MobileCard 
            onClick={() => navigate('/mobile/deposito/stock')}
            style={{ display: 'flex', alignItems: 'center', padding: '24px', gap: '20px', backgroundColor: '#fef2f2', borderColor: '#fecaca' }}
          >
            <div style={{ backgroundColor: '#ef4444', color: 'white', padding: '16px', borderRadius: '20px' }}>
              <Package size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px 0', color: '#7f1d1d' }}>Centro Stock</h3>
              <p style={{ margin: 0, color: '#ef4444', fontSize: '14px' }}>Disponibilidad y movimientos</p>
            </div>
          </MobileCard>

          <MobileCard 
            onClick={() => navigate('/mobile/deposito/compras')}
            style={{ display: 'flex', alignItems: 'center', padding: '24px', gap: '20px', backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}
          >
            <div style={{ backgroundColor: '#22c55e', color: 'white', padding: '16px', borderRadius: '20px' }}>
              <Truck size={32} />
            </div>
            <div>
              <h3 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px 0', color: '#14532d' }}>Ingreso Compras</h3>
              <p style={{ margin: 0, color: '#22c55e', fontSize: '14px' }}>Carga rápida de mercadería</p>
            </div>
          </MobileCard>

        </div>
      </div>
    </div>
  );
}
