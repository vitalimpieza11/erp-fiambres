import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Package, Truck, AlertTriangle, ArrowLeft } from 'lucide-react';
import MobileTopBar from '../../layout/MobileTopBar';
import { useSalesStore } from '../../../store/salesStore';
import { useOrdersStore } from '../../../store/ordersStore';
import { useStockStore } from '../../../store/stockStore';

export default function ModoGerente() {
  const navigate = useNavigate();
  const { sales, fetchData: fetchVentasData } = useSalesStore();
  const { pedidos, fetchData: fetchPedidos } = useOrdersStore();
  const { products, fetchData: fetchStock } = useStockStore();

  useEffect(() => {
    fetchVentasData();
    fetchPedidos();
    fetchStock();
  }, [fetchVentasData, fetchPedidos, fetchStock]);

  const todayStr = new Date().toISOString().split('T')[0];

  const ventasHoy = useMemo(() => {
    return sales.filter(s => s.date.startsWith(todayStr) && !s.isDeleted && s.status !== 'ANULADO')
                .reduce((acc, s) => acc + s.totalAmount, 0);
  }, [sales, todayStr]);

  const pedidosPendientes = useMemo(() => pedidos.filter(p => p.status === 'PENDIENTE' && !p.isDeleted).length, [pedidos]);
  
  const stockCritico = useMemo(() => products.filter(p => {
    const fisico = (p as any).stockFisico || 0;
    return fisico <= 0;
  }).length, [products]);

  const repartosPendientes = useMemo(() => sales.filter(s => !s.isDeleted && s.deliveryStatus !== 'ENTREGADO').length, [sales]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#f3f4f6' }}>
      <MobileTopBar 
        title="Dashboard Ejecutivo" 
        leftElement={<div onClick={() => navigate('/mobile')} style={{ padding: '8px' }}><ArrowLeft size={24} color="var(--mobile-text-secondary)" /></div>}
      />

      <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
        
        {/* Hero Card */}
        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 600, marginBottom: '12px' }}>
            <TrendingUp size={20} /> Ventas del Día
          </div>
          <div style={{ fontSize: '48px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>
            ${ventasHoy.toLocaleString('es-AR')}
          </div>
          <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '14px' }}>Actualizado ahora</p>
        </div>

        {/* Bento Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          
          <div onClick={() => navigate('/mobile/produccion')} style={{ backgroundColor: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ backgroundColor: '#eff6ff', width: '48px', height: '48px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <Package size={24} color="#3b82f6" />
            </div>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{pedidosPendientes}</span>
            <span style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px', fontWeight: 500 }}>Pedidos Pendientes</span>
          </div>

          <div onClick={() => navigate('/mobile/reparto')} style={{ backgroundColor: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ backgroundColor: '#f0fdf4', width: '48px', height: '48px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <Truck size={24} color="#10b981" />
            </div>
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{repartosPendientes}</span>
            <span style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px', fontWeight: 500 }}>Repartos Activos</span>
          </div>

          <div onClick={() => navigate('/mobile/deposito/stock')} style={{ backgroundColor: 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column', gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div style={{ backgroundColor: stockCritico > 0 ? '#fef2f2' : '#f9fafb', width: '48px', height: '48px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <AlertTriangle size={24} color={stockCritico > 0 ? '#ef4444' : '#9ca3af'} />
              </div>
              {stockCritico > 0 && <span style={{ backgroundColor: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>Requiere Acción</span>}
            </div>
            
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#111827', lineHeight: 1 }}>{stockCritico}</span>
            <span style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px', fontWeight: 500 }}>Productos en Stock Crítico</span>
          </div>

        </div>

      </div>
    </div>
  );
}
