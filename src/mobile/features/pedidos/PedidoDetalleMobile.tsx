import React, { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MobileTopBar from '../../layout/MobileTopBar';
import MobileCard from '../../components/MobileCard';
import MobileButton from '../../components/MobileButton';
import MobileBadge from '../../components/MobileBadge';
import { ArrowLeft, Package, User, FileText } from 'lucide-react';
import { useOrdersStore } from '../../../store/ordersStore';
import { useClientesStore } from '../../../store/clientesStore';
import { useProductsStore } from '../../../store/productsStore';

export default function PedidoDetalleMobile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { pedidos, changeStatus } = useOrdersStore();
  const { customers: clientes } = useClientesStore();
  const { productos, fetchProductos } = useProductsStore();

  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  const pedido = useMemo(() => pedidos.find(p => p.id === id), [pedidos, id]);
  const cliente = useMemo(() => clientes.find(c => c.id === pedido?.customerId), [clientes, pedido]);

  if (!pedido) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Pedido no encontrado</h2>
        <MobileButton onClick={() => navigate(-1)}>Volver</MobileButton>
      </div>
    );
  }

  const isPending = pedido.status === 'PENDIENTE';
  const isInProduction = pedido.status === 'EN_PRODUCCION';

  const handleNextStatus = () => {
    if (isPending) changeStatus(pedido.id, 'EN_PRODUCCION');
    else if (isInProduction) changeStatus(pedido.id, 'PRODUCIDO');
    // Para facturar o entregar, será otro flujo.
  };

  return (
    <div style={{ paddingBottom: '100px', minHeight: '100vh', backgroundColor: 'var(--mobile-bg)' }}>
      <MobileTopBar 
        title={`Ped. #${pedido.id.slice(-5).toUpperCase()}`}
        leftElement={
          <div onClick={() => navigate(-1)} style={{ padding: '8px', display: 'flex', alignItems: 'center', color: 'var(--mobile-text-secondary)' }}>
            <ArrowLeft size={24} />
          </div>
        }
      />

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Cabecera del Cliente */}
        <MobileCard style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '24px', backgroundColor: 'var(--mobile-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mobile-primary)' }}>
              <User size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '20px', margin: 0, lineHeight: '1.2' }}>{cliente?.nombre}</h2>
              <span style={{ fontSize: '14px', color: 'var(--mobile-text-secondary)' }}>{new Date(pedido.fecha).toLocaleDateString('es-AR')}</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--mobile-border)', paddingTop: '16px' }}>
            <span style={{ fontSize: '15px', color: 'var(--mobile-text-secondary)' }}>Estado Actual</span>
            <MobileBadge variant={isPending ? 'warning' : isInProduction ? 'info' : 'default'}>
              {pedido.status.replace('_', ' ')}
            </MobileBadge>
          </div>
        </MobileCard>

        {/* Ítems del pedido (Lista muy limpia) */}
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--mobile-text-secondary)', marginBottom: '12px' }}>
            Productos ({pedido.items?.length || 0})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pedido.items?.map((item, idx) => {
              const prod = productos.find(p => p.id === item.productId);
              return (
                <MobileCard key={idx} noPadding style={{ overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', padding: '16px', gap: '16px' }}>
                    <div style={{ backgroundColor: '#f3f4f6', borderRadius: '12px', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                      <Package size={24} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <strong style={{ fontSize: '16px', color: 'var(--mobile-text-primary)' }}>
                        {prod?.nombre || 'Producto Desconocido'}
                      </strong>
                      <span style={{ fontSize: '14px', color: 'var(--mobile-text-secondary)' }}>
                        {item.cantidad} {item.unidad}
                      </span>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>
                      ${item.subtotal?.toLocaleString('es-AR')}
                    </div>
                  </div>
                </MobileCard>
              );
            })}
          </div>
        </div>

        {/* Observaciones */}
        {pedido.observaciones && (
          <MobileCard style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <FileText size={20} color="var(--mobile-text-secondary)" style={{ marginTop: '2px' }} />
            <div style={{ fontSize: '14px', color: 'var(--mobile-text-primary)', fontStyle: 'italic' }}>
              "{pedido.observaciones}"
            </div>
          </MobileCard>
        )}

      </div>

      {/* Floating Bottom Action (Action Principal Fija) */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        backgroundColor: 'var(--mobile-surface)',
        padding: '16px',
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        borderTop: '1px solid var(--mobile-border)',
        boxShadow: '0 -4px 12px rgba(0,0,0,0.05)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '13px', color: 'var(--mobile-text-secondary)' }}>Total Estimado</span>
          <strong style={{ fontSize: '24px', color: 'var(--mobile-primary)', lineHeight: '1.2' }}>
            ${pedido.totalEstimado?.toLocaleString('es-AR')}
          </strong>
        </div>
        
        {(isPending || isInProduction) && (
          <MobileButton 
            onClick={handleNextStatus} 
            size="lg" 
            style={{ width: '160px' }}
          >
            {isPending ? 'Producir' : 'Finalizar'}
          </MobileButton>
        )}
      </div>

    </div>
  );
}
