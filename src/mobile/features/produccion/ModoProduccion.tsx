import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrdersStore } from '../../../store/ordersStore';
import { Play, ArrowLeft, CheckCircle2 } from 'lucide-react';

export default function ModoProduccion() {
  const navigate = useNavigate();
  const { pedidos, fetchData } = useOrdersStore();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const pendientes = useMemo(() => {
    return pedidos
      .filter(p => !p.isDeleted && p.status === 'PENDIENTE')
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [pedidos]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      backgroundColor: '#171717', // Negro profundo Al Vacío
      color: 'white',
      padding: '24px',
      position: 'relative'
    }}>
      
      <div style={{ position: 'absolute', top: '24px', left: '24px', zIndex: 10 }}>
        <button 
          onClick={() => navigate('/mobile')} 
          style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}
        >
          <ArrowLeft size={24} />
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        {pendientes.length > 0 ? (
          <>
            <div style={{ fontSize: '140px', fontWeight: 900, margin: 0, lineHeight: 1, color: '#DC2626', textShadow: '0 10px 30px rgba(220,38,38,0.4)' }}>
              {pendientes.length}
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: 600, margin: '16px 0 0 0', opacity: 0.9 }}>
              pedidos en cola
            </h2>
            <p style={{ color: '#a3a3a3', marginTop: '12px', fontSize: '16px', maxWidth: '250px' }}>
              La producción te está esperando. Es momento de pesar.
            </p>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ width: '120px', height: '120px', borderRadius: '60px', backgroundColor: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <CheckCircle2 size={64} color="#22c55e" />
            </div>
            <h2 style={{ fontSize: '32px', fontWeight: 800, margin: 0 }}>Todo al día</h2>
            <p style={{ color: '#a3a3a3', marginTop: '12px', fontSize: '18px' }}>
              No hay pedidos pendientes de producción.
            </p>
          </div>
        )}
      </div>

      <div style={{ width: '100%', paddingBottom: 'env(safe-area-inset-bottom, 24px)' }}>
        {pendientes.length > 0 && (
          <button
            onClick={() => {
              if (pendientes.length > 0) {
                navigate(`/mobile/produccion/flow/${pendientes[0].id}`);
              }
            }}
            className="mobile-no-select"
            style={{
              width: '100%',
              height: '80px',
              borderRadius: '40px',
              backgroundColor: '#DC2626', // Rojo Al Vacío
              color: 'white',
              fontSize: '24px',
              fontWeight: 800,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              boxShadow: '0 8px 30px rgba(220,38,38,0.4)',
              transition: 'transform 0.1s'
            }}
            onPointerDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
            onPointerUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            onPointerCancel={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <Play fill="currentColor" size={28} /> COMENZAR
          </button>
        )}
      </div>
    </div>
  );
}
