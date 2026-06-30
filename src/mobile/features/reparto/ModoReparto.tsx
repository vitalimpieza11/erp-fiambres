import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, MapPin, Truck, Play } from 'lucide-react';
import MobileTopBar from '../../layout/MobileTopBar';
import MobileCard from '../../components/MobileCard';
import MobileButton from '../../components/MobileButton';
import { useSalesStore } from '../../../store/salesStore';
import { useClientesStore } from '../../../store/clientesStore';

export default function ModoReparto() {
  const navigate = useNavigate();
  const { sales, fetchData: fetchVentasData } = useSalesStore();
  const { customers, fetchClientesData } = useClientesStore();

  useEffect(() => {
    fetchVentasData();
    fetchClientesData();
  }, [fetchVentasData, fetchClientesData]);

  const repartosPendientes = useMemo(() => {
    return sales.filter(s => !s.isDeleted && s.deliveryStatus !== 'ENTREGADO');
  }, [sales]);

  const progress = sales.length === 0 ? 0 : Math.round(((sales.length - repartosPendientes.length) / sales.length) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--mobile-bg)' }}>
      <MobileTopBar 
        title="Modo Reparto" 
        leftElement={<div onClick={() => navigate('/mobile')} style={{ padding: '8px', color: 'var(--mobile-text-secondary)' }}>Salir</div>}
      />

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto' }}>
        
        <div style={{ backgroundColor: 'var(--mobile-surface)', borderRadius: '24px', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', backgroundColor: '#eff6ff', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
            <Map size={40} color="#3b82f6" />
          </div>
          <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 8px 0', lineHeight: 1 }}>{repartosPendientes.length}</h2>
          <p style={{ color: 'var(--mobile-text-secondary)', margin: 0, fontSize: '15px' }}>Entregas pendientes para hoy</p>
          
          {/* Progress Bar */}
          <div style={{ height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', marginTop: '24px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, backgroundColor: '#3b82f6', transition: 'width 0.5s ease' }} />
          </div>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px', textAlign: 'right' }}>{progress}% Completado</p>
        </div>

        <MobileButton 
          size="lg" 
          onClick={() => navigate('/mobile/reparto/flow')}
          disabled={repartosPendientes.length === 0}
          style={{ height: '70px', fontSize: '20px', borderRadius: '24px', backgroundColor: '#3b82f6' }}
        >
          <Play size={24} style={{ marginRight: '12px', fill: 'currentColor' }} /> 
          {repartosPendientes.length > 0 ? 'Iniciar Recorrido' : 'No hay repartos'}
        </MobileButton>

        {repartosPendientes.length > 0 && (
          <div>
            <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--mobile-text-secondary)', letterSpacing: '1px', marginBottom: '16px' }}>Siguiente Parada</h3>
            <MobileCard style={{ padding: '20px', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ backgroundColor: '#eff6ff', padding: '12px', borderRadius: '16px' }}>
                  <MapPin size={24} color="#3b82f6" />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700 }}>
                    {customers.find((c: any) => c.id === repartosPendientes[0].customerId)?.nombre || 'Cliente'}
                  </h4>
                  <span style={{ fontSize: '14px', color: 'var(--mobile-text-secondary)' }}>
                    Total: ${repartosPendientes[0].totalAmount}
                  </span>
                </div>
              </div>
            </MobileCard>
          </div>
        )}

      </div>
    </div>
  );
}
