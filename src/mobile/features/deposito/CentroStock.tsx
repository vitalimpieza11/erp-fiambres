import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, AlertTriangle } from 'lucide-react';
import MobileTopBar from '../../layout/MobileTopBar';
import MobileCard from '../../components/MobileCard';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import { useStockStore } from '../../../store/stockStore';

export default function CentroStock() {
  const navigate = useNavigate();
  const { products, fetchData } = useStockStore();
  const [selectedProd, setSelectedProd] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Ordenar por stock crítico primero
  const sortedStock = useMemo(() => {
    return [...products].sort((a: any, b: any) => {
      const aFisico = a.stockFisico || 0;
      const bFisico = b.stockFisico || 0;
      return aFisico - bFisico; // Menor a mayor
    });
  }, [products]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--mobile-bg)' }}>
      <MobileTopBar 
        title="Centro de Stock" 
        leftElement={<div onClick={() => navigate(-1)} style={{ padding: '8px' }}><ArrowLeft size={24} color="var(--mobile-text-secondary)" /></div>}
      />

      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        <h3 style={{ fontSize: '14px', color: 'var(--mobile-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Estado General</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          {sortedStock.map(p => {
            const fisico = (p as any).stockFisico || 0;
            const isCritico = fisico <= 0;

            return (
              <MobileCard 
                key={p.id} 
                onClick={() => setSelectedProd(p)}
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px',
                  borderLeft: `4px solid ${isCritico ? '#ef4444' : '#10b981'}`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ backgroundColor: isCritico ? '#fef2f2' : '#f0fdf4', padding: '12px', borderRadius: '16px', color: isCritico ? '#ef4444' : '#10b981' }}>
                    {isCritico ? <AlertTriangle size={24} /> : <Package size={24} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--mobile-text-primary)' }}>{p.nombre}</span>
                    <span style={{ fontSize: '13px', color: 'var(--mobile-text-secondary)' }}>Físico: {fisico} {p.unitType}</span>
                  </div>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: isCritico ? '#ef4444' : '#10b981' }}>
                  {fisico}
                </div>
              </MobileCard>
            );
          })}
        </div>
      </div>

      <MobileBottomSheet isOpen={!!selectedProd} onClose={() => setSelectedProd(null)} height="50vh" title="Detalle Físico/Comprometido">
        {selectedProd && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '20px', margin: 0, fontWeight: 700 }}>{selectedProd.nombre}</h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: '#f9fafb', borderRadius: '16px' }}>
              <span style={{ color: 'var(--mobile-text-secondary)' }}>Stock Físico (Depósito)</span>
              <strong style={{ fontSize: '18px' }}>{(selectedProd as any).stockFisico || 0} {selectedProd.unitType}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: '#fff7ed', borderRadius: '16px' }}>
              <span style={{ color: '#c2410c' }}>Stock Comprometido (Pedidos)</span>
              <strong style={{ fontSize: '18px', color: '#c2410c' }}>{(selectedProd as any).stockComprometido || 0} {selectedProd.unitType}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '16px' }}>
              <span style={{ color: '#15803d', fontWeight: 600 }}>Stock Disponible Real</span>
              <strong style={{ fontSize: '18px', color: '#15803d' }}>
                {((selectedProd as any).stockFisico || 0) - ((selectedProd as any).stockComprometido || 0)} {selectedProd.unitType}
              </strong>
            </div>
          </div>
        )}
      </MobileBottomSheet>
    </div>
  );
}
