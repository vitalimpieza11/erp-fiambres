import { useState, useMemo } from 'react';
import { useProduccion } from './useProduccion';
import ExpandableCard from '../../components/ExpandableCard';
import FreeProductionPanel from './FreeProductionPanel';
import OrderProductionModal from './OrderProductionModal';
import { Package, Clock, Activity, CheckCircle, RotateCcw } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { formatCurrency, truncateDecimals } from '../../lib/formatters';

export default function Produccion() {
  const { 
    orders, 
    products, 
    recipes, 
    equivalences, 
    movements, 
    customers, 
    loading, 
    getCapacity, 
    getCapacityDetails,
    produce, 
    produceStep, 
    revertMovement 
  } = useProduccion();

  const [activeTab, setActiveTab] = useState<'PENDING' | 'STOCK' | 'CAPACITY'>('PENDING');
  
  // Production UI States
  const [showPanel, setShowPanel] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [targetProductId, setTargetProductId] = useState<string>('');

  const pendingOrders = useMemo(() => {
    return (orders || []).filter(o => o && (o.status === 'PENDIENTE' || o.status === 'EN_PRODUCCION'));
  }, [orders]);

  const producedOrders = useMemo(() => {
    return (orders || []).filter(o => o && o.status === 'PRODUCIDO');
  }, [orders]);

  const presentationSummary = useMemo(() => {
    const summary: Record<string, {
      productId: string;
      productName: string;
      unitType: string;
      cantidadSolicitada: number;
      cantidadProducida: number;
      cantidadPendiente: number;
      pesoProducidoAcumulado: number;
    }> = {};

    pendingOrders.forEach(o => {
      (o.items || []).forEach(item => {
        if (!item || !item.productId) return;
        const p = products.find(prod => prod.id === item.productId);
        if (p && p.type === 'PRESENTACION') {
          if (!summary[p.id]) {
            summary[p.id] = {
              productId: p.id,
              productName: p.nombre,
              unitType: item.unidad || p.unitType || 'KG',
              cantidadSolicitada: 0,
              cantidadProducida: 0,
              cantidadPendiente: 0,
              pesoProducidoAcumulado: 0
            };
          }
          const s = summary[p.id];
          s.cantidadSolicitada += item.cantidad;
          
          const pesosReales = item.pesosReales || [];
          if (s.unitType === 'UNIDADES') {
            s.cantidadProducida += pesosReales.length;
          } else {
            const sumWeights = pesosReales.reduce((sum, w) => sum + w, 0) || item.pesoReal || 0;
            s.cantidadProducida += sumWeights;
          }
          
          const totalWeightReal = pesosReales.reduce((sum, w) => sum + w, 0) || item.pesoReal || 0;
          s.pesoProducidoAcumulado += totalWeightReal;
        }
      });
    });

    Object.values(summary).forEach(s => {
      s.cantidadPendiente = Math.max(0, s.cantidadSolicitada - s.cantidadProducida);
    });

    return Object.values(summary);
  }, [pendingOrders, products]);

  const finishedProducts = useMemo(() => {
    return (products || []).filter(p => p && p.type === 'PRESENTACION');
  }, [products]);

  const openProducePanel = (mode: 'FREE' | 'ORDER', orderId?: string, productId?: string) => {
    setTargetProductId(productId || '');
    setSelectedOrderId(orderId || '');
    if (mode === 'ORDER') {
      setShowOrderModal(true);
    } else {
      setShowPanel(true);
    }
  };

  const activePendingTotals = useMemo(() => {
    if (!targetProductId) return undefined;
    const summary = presentationSummary.find(s => s.productId === targetProductId);
    if (!summary) return undefined;
    return { [summary.unitType]: summary.cantidadPendiente };
  }, [targetProductId, presentationSummary]);

  const hasData = products && products.length > 0;
  if (loading && !hasData) return <LoadingSpinner message="Cargando módulo de producción..." />;

  return (
    <div style={{ position: 'relative' }}>
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <LoadingSpinner message="Procesando..." />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Producción</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={() => openProducePanel('FREE')}>+ Prod. Libre</button>
          <button className="btn-primary" onClick={() => openProducePanel('ORDER')}>+ Prod. desde Pedido</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <button 
          onClick={() => setActiveTab('PENDING')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', borderRadius: '24px', 
            fontWeight: 600, fontSize: '15px',
            backgroundColor: activeTab === 'PENDING' ? 'var(--alvacio-red)' : 'transparent',
            color: activeTab === 'PENDING' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Pendiente
        </button>
        <button 
          onClick={() => setActiveTab('STOCK')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', borderRadius: '24px', 
            fontWeight: 600, fontSize: '15px',
            backgroundColor: activeTab === 'STOCK' ? 'var(--alvacio-red)' : 'transparent',
            color: activeTab === 'STOCK' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Stock Terminado
        </button>
        <button 
          onClick={() => setActiveTab('CAPACITY')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', borderRadius: '24px', 
            fontWeight: 600, fontSize: '15px',
            backgroundColor: activeTab === 'CAPACITY' ? 'var(--alvacio-red)' : 'transparent',
            color: activeTab === 'CAPACITY' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Capacidad
        </button>
      </div>

      {activeTab === 'PENDING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          <div>
            <h3 style={{ fontSize: '20px', marginBottom: '20px', color: 'var(--text-primary)' }}>Agrupado por Presentación</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {presentationSummary.length === 0 && (
                <p style={{ color: 'var(--text-secondary)' }}>No hay productos pendientes.</p>
              )}
              {presentationSummary.map((s) => (
                <ExpandableCard
                  key={s.productId}
                  title={s.productName}
                  collapsedContent={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', fontSize: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Solicitado:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{s.cantidadSolicitada.toFixed(3)} {s.unitType}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Producido:</span>
                        <strong style={{ color: '#10b981' }}>{s.cantidadProducida.toFixed(3)} {s.unitType}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Pendiente:</span>
                        <strong style={{ color: 'var(--alvacio-red-dark)' }}>{s.cantidadPendiente.toFixed(3)} {s.unitType}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '6px', marginTop: '4px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Peso Acumulado:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{s.pesoProducidoAcumulado.toFixed(3)} kg</strong>
                      </div>
                    </div>
                  }
                  expandedContent={<></>}
                  actions={
                    <button className="btn-secondary" onClick={() => openProducePanel('ORDER', undefined, s.productId)}>
                      Producir esto
                    </button>
                  }
                />
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '20px', marginBottom: '20px', color: 'var(--text-primary)' }}>Pedidos Pendientes</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
              {pendingOrders.map(order => {
                const client = (customers || []).find(c => c.id === order.customerId);
                const clientName = client ? (client.name || client.nombre) : 'Cliente Desconocido';
                return (
                  <ExpandableCard
                    key={order.id}
                    title={`${clientName} - Pedido ${(order.id || '').slice(0, 6)}`}
                    statusBadge={
                      <span style={{ 
                        backgroundColor: order.status === 'PENDIENTE' ? '#fef3c7' : '#dbeafe',
                        color: order.status === 'PENDIENTE' ? '#d97706' : '#2563eb'
                      }}>
                        {order.status}
                      </span>
                    }
                  collapsedContent={
                    <div style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                      {(order.items || []).length} ítems
                    </div>
                  }
                  expandedContent={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(order.items || []).map((item, idx) => {
                        if (!item) return null;
                        const p = products.find(prod => prod.id === item.productId);
                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <span>{p?.nombre}</span>
                            <strong>{item.cantidad || 0} {item.unidad || ''}</strong>
                          </div>
                        );
                      })}
                    </div>
                  }
                  actions={
                    <button className="btn-secondary" style={{ width: '100%' }} onClick={() => openProducePanel('ORDER', order.id)}>
                      Producir este Pedido
                    </button>
                  }
                />
              );
            })}
              {pendingOrders.length === 0 && (
                <p style={{ color: 'var(--text-secondary)' }}>No hay pedidos pendientes de producción.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'STOCK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          <div>
            <h3 style={{ fontSize: '20px', marginBottom: '20px', color: 'var(--text-primary)' }}>Pedidos Producidos (Listos en Stock)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', marginBottom: '12px' }}>
              {producedOrders.map(order => {
                const client = (customers || []).find(c => c.id === order.customerId);
                const clientName = client ? (client.name || client.nombre) : 'Cliente Desconocido';
                const orderShortId = (order.id || '').slice(0, 6).toUpperCase();
                return (
                  <ExpandableCard
                    key={order.id}
                    title={`Pedido #${orderShortId} - ${clientName}`}
                    statusBadge={
                      <span style={{ 
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 600
                      }}>
                        PRODUCIDO
                      </span>
                    }
                    collapsedContent={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                          {(order.items || []).length} ítems preparados
                        </span>
                        <strong style={{ fontSize: '16px', color: 'var(--alvacio-red-dark)' }}>
                          {formatCurrency(order.totalEstimado || 0)}
                        </strong>
                      </div>
                    }
                    expandedContent={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(order.items || []).map((item, idx) => {
                          const p = products.find(prod => prod.id === item.productId);
                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-color)', fontSize: '13px' }}>
                              <span>{p?.nombre || 'Producto'}</span>
                              <strong>
                                {item.cantidad} {item.unidad}
                                {item.pesoReal !== undefined && ` (${item.pesoReal} KG)`}
                              </strong>
                            </div>
                          );
                        })}
                        {order.observaciones && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', fontStyle: 'italic' }}>
                            Nota: {order.observaciones}
                          </div>
                        )}
                      </div>
                    }
                  />
                );
              })}
              {producedOrders.length === 0 && (
                <p style={{ color: 'var(--text-secondary)' }}>No hay pedidos listos en stock terminado.</p>
              )}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '20px', marginBottom: '20px', color: 'var(--text-primary)' }}>Stock de Terminados</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {(finishedProducts || []).map(p => {
                if (!p) return null;
                return (
                  <ExpandableCard
                    key={p.id}
                    title={p.nombre || 'Producto Desconocido'}
                    collapsedContent={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                        <CheckCircle size={20} color="#16a34a" />
                        <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{truncateDecimals(p.stockActual || 0, 3)}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{p.unitType || ''}</span>
                      </div>
                    }
                    expandedContent={<></>}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '20px', marginBottom: '20px', color: 'var(--text-primary)' }}>Últimos Movimientos</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(movements || []).filter(m => {
                if (!m) return false;
                return m.type === 'PRODUCCION_STOCK' || m.type === 'PRODUCCION_PEDIDO';
              }).sort((a,b) => {
                const timeA = a && a.date ? new Date(a.date).getTime() : 0;
                const timeB = b && b.date ? new Date(b.date).getTime() : 0;
                return timeB - timeA;
              }).slice(0,10).map(m => {
                if (!m) return null;
                const p = products.find(prod => prod.id === m.productId);
                const isOrder = m.type === 'PRODUCCION_PEDIDO';
                return (
                  <div key={m.id} className="apple-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <Activity size={24} color={isOrder ? '#f59e0b' : 'var(--alvacio-red)'} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>{p?.nombre || 'Producto Desconocido'}</span>
                          <span style={{ 
                            fontSize: '11px', 
                            padding: '2px 8px', 
                            borderRadius: '12px',
                            fontWeight: 'normal',
                            backgroundColor: isOrder ? '#fef3c7' : '#dcfce7',
                            color: isOrder ? '#b45309' : '#15803d'
                          }}>
                            {isOrder ? 'Por Pedido (Ingresa Stock)' : 'Para Stock / Libre (Ingresa Stock)'}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{m.date ? new Date(m.date).toLocaleString() : ''} • {m.observaciones || 'Sin observaciones'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <strong style={{ fontSize: '18px', color: m.qty > 0 ? '#16a34a' : '#ef4444' }}>
                        {m.qty > 0 ? `+${m.qty}` : m.qty}
                      </strong>
                      <button className="btn-secondary" style={{ padding: '8px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={async () => {
                        if (confirm('¿Generar movimiento compensatorio?')) await revertMovement(m.id);
                      }}>
                        <RotateCcw size={16} /> Revertir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'CAPACITY' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: 0 }}>Capacidad Máxima</h3>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Basado en stock de insumos</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {(finishedProducts || []).map(p => {
              if (!p) return null;
              const details = getCapacityDetails(p.id);
              const max = details.maxCapacity;
              return (
                <ExpandableCard
                  key={p.id}
                  title={p.nombre || 'Producto Desconocido'}
                  collapsedContent={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Clock size={20} color={max > 0 ? "var(--alvacio-red)" : "var(--text-secondary)"} />
                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: max > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {max}
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>{p.unitType || ''}</span>
                      </div>
                      
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Insumo Limitante:</span>
                          <strong style={{ color: max > 0 ? 'var(--text-primary)' : '#ef4444' }}>{details.limitingIngredientName}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Costo por Lote/Unidad:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>${details.costPerUnit.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Costo Prod. Máxima:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>${details.totalMaxCapacityCost.toFixed(2)}</strong>
                        </div>
                      </div>
                    </div>
                  }
                  expandedContent={<></>}
                  actions={
                    <button className="btn-primary" onClick={() => openProducePanel('FREE', undefined, p.id)} disabled={max === 0}>
                      Producir
                    </button>
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      <FreeProductionPanel 
        isOpen={showPanel}
        onClose={() => {
          setShowPanel(false);
          setTargetProductId('');
        }}
        products={products}
        recipes={recipes}
        equivalences={equivalences}
        produce={produce}
        initialProductId={targetProductId}
        pendingTotals={activePendingTotals}
      />

      <OrderProductionModal 
        isOpen={showOrderModal}
        onClose={() => {
          setShowOrderModal(false);
          setSelectedOrderId('');
          setTargetProductId('');
        }}
        selectedOrderId={selectedOrderId}
        targetProductId={targetProductId}
        orders={orders}
        products={products}
        recipes={recipes}
        equivalences={equivalences}
        customers={customers}
        produceStep={produceStep}
      />
    </div>
  );
}
