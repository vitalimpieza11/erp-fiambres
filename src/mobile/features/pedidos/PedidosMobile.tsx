import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileTopBar from '../../layout/MobileTopBar';
import MobileCard from '../../components/MobileCard';
import MobileBadge from '../../components/MobileBadge';
import MobileFAB from '../../components/MobileFAB';
import { Plus, ChevronRight, Filter } from 'lucide-react';
import { useOrdersStore } from '../../../store/ordersStore';
import { useClientesStore } from '../../../store/clientesStore';

export default function PedidosMobile() {
  const navigate = useNavigate();
  const { pedidos, fetchData: fetchOrders } = useOrdersStore();
  const { customers: clientes, fetchClientesData: fetchClientes } = useClientesStore();
  const [filter, setFilter] = useState<'ACTIVOS' | 'TODOS'>('ACTIVOS');

  useEffect(() => {
    fetchOrders();
    fetchClientes();
  }, [fetchOrders, fetchClientes]);

  // Lógica optimizada: Filtramos y ordenamos.
  // 80% del tiempo el usuario en móvil solo quiere ver los pedidos pendientes o en producción.
  const pedidosFiltrados = useMemo(() => {
    let filtrados = pedidos.filter(p => !p.isDeleted);
    
    if (filter === 'ACTIVOS') {
      filtrados = filtrados.filter(p => 
        p.status === 'PENDIENTE' || 
        p.status === 'EN_PRODUCCION' || 
        p.status === 'PRODUCIDO'
      );
    }
    
    // Ordenar los más recientes arriba
    return filtrados.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [pedidos, filter]);

  const handleOpenDetail = (id: string) => {
    navigate(`/mobile/pedidos/${id}`);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'PENDIENTE': return <MobileBadge variant="warning">Pendiente</MobileBadge>;
      case 'EN_PRODUCCION': return <MobileBadge variant="info">En Prod.</MobileBadge>;
      case 'PRODUCIDO': return <MobileBadge variant="success">Producido</MobileBadge>;
      case 'ENTREGADO': return <MobileBadge variant="default">Entregado</MobileBadge>;
      case 'FACTURADO': return <MobileBadge variant="default">Facturado</MobileBadge>;
      case 'ANULADO': return <MobileBadge variant="error">Anulado</MobileBadge>;
      default: return <MobileBadge>{status}</MobileBadge>;
    }
  };

  return (
    <div style={{ paddingBottom: '20px', minHeight: '100vh', backgroundColor: 'var(--mobile-bg)' }}>
      <MobileTopBar 
        title="Pedidos" 
        rightElement={
          <div 
            onClick={() => setFilter(f => f === 'ACTIVOS' ? 'TODOS' : 'ACTIVOS')}
            style={{ padding: '8px', color: filter === 'ACTIVOS' ? 'var(--mobile-primary)' : 'var(--mobile-text-secondary)', display: 'flex', alignItems: 'center' }}
          >
            <Filter size={22} />
          </div>
        }
      />

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {pedidosFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--mobile-text-secondary)' }}>
            No hay pedidos para mostrar.
          </div>
        ) : (
          pedidosFiltrados.map((pedido) => {
            const cliente = clientes.find(c => c.id === pedido.customerId);
            const qtyItems = pedido.items?.length || 0;
            
            return (
              <MobileCard 
                key={pedido.id} 
                onClick={() => handleOpenDetail(pedido.id)}
                noPadding
                style={{ overflow: 'hidden' }}
              >
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, paddingRight: '12px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--mobile-text-secondary)' }}>
                        {new Date(pedido.fecha).toLocaleDateString('es-AR')}
                      </span>
                      <strong style={{ fontSize: '18px', color: 'var(--mobile-text-primary)', lineHeight: '1.2' }}>
                        {cliente?.nombre || 'Cliente Desconocido'}
                      </strong>
                    </div>
                    {getStatusBadge(pedido.status)}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--mobile-text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '3px', backgroundColor: '#d1d5db' }} />
                      {qtyItems} {qtyItems === 1 ? 'ítem' : 'ítems'}
                    </span>
                    <strong style={{ fontSize: '18px', color: 'var(--mobile-text-primary)' }}>
                      ${pedido.totalEstimado?.toLocaleString('es-AR')}
                    </strong>
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--mobile-bg)', padding: '12px 20px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderTop: '1px solid var(--mobile-border)' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mobile-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Ver Detalle <ChevronRight size={18} />
                  </span>
                </div>
              </MobileCard>
            );
          })
        )}
      </div>

      <MobileFAB 
        icon={<Plus size={28} strokeWidth={2.5} />} 
        onClick={() => navigate('/mobile/pedidos/nuevo')} 
      />
    </div>
  );
}
