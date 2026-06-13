import { useState, useMemo } from 'react';
import { useProduccion } from './useProduccion';
import type { Order } from '../../types/domain';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import { Package, Clock, Activity, CheckCircle, RotateCcw } from 'lucide-react';

export default function Produccion() {
  const { orders, products, movements, loading, getCapacity, produce, revertMovement } = useProduccion();

  const [activeTab, setActiveTab] = useState<'PENDING' | 'STOCK' | 'CAPACITY'>('PENDING');
  
  // Production RightPanel State
  const [showPanel, setShowPanel] = useState(false);
  const [prodMode, setProdMode] = useState<'FREE' | 'ORDER'>('FREE');
  const [selectedOrder, setSelectedOrder] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [prodQty, setProdQty] = useState<number>(0);
  const [prodWeight, setProdWeight] = useState<number>(0);
  const [prodMerma, setProdMerma] = useState<number>(0);
  const [prodObs, setProdObs] = useState<string>('');
  const [newStatus, setNewStatus] = useState<'EN_PRODUCCION' | 'PRODUCIDO'>('EN_PRODUCCION');

  const pendingOrders = useMemo(() => {
    return orders.filter(o => o.status === 'PENDIENTE' || o.status === 'EN_PRODUCCION');
  }, [orders]);

  const pendingByProduct = useMemo(() => {
    const grouped: Record<string, { total: number, unit: string, productName: string }> = {};
    pendingOrders.forEach(o => {
      o.items.forEach(item => {
        const p = products.find(prod => prod.id === item.productId);
        if (p) {
          if (!grouped[p.id]) {
            grouped[p.id] = { total: 0, unit: p.unitType, productName: p.nombre };
          }
          grouped[p.id].total += item.cantidad;
        }
      });
    });
    return grouped;
  }, [pendingOrders, products]);

  const finishedProducts = useMemo(() => {
    return products.filter(p => p.type === 'PRESENTACION');
  }, [products]);

  const handleProduce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || prodQty <= 0) {
      alert("Seleccione un producto y cantidad válida.");
      return;
    }
    
    try {
      await produce({
        productId: selectedProduct,
        cantidad: prodQty,
        pesoReal: prodWeight > 0 ? prodWeight : undefined,
        merma: prodMerma > 0 ? prodMerma : undefined,
        observaciones: prodObs,
        orderId: prodMode === 'ORDER' ? selectedOrder : undefined,
        newOrderStatus: prodMode === 'ORDER' ? newStatus : undefined
      });
      setShowPanel(false);
      resetPanel();
    } catch (error) {
      alert("Error en producción: " + error);
    }
  };

  const resetPanel = () => {
    setProdMode('FREE');
    setSelectedOrder('');
    setSelectedProduct('');
    setProdQty(0);
    setProdWeight(0);
    setProdMerma(0);
    setProdObs('');
    setNewStatus('EN_PRODUCCION');
  };

  const openProducePanel = (mode: 'FREE' | 'ORDER', orderId?: string, productId?: string) => {
    resetPanel();
    setProdMode(mode);
    if (orderId) setSelectedOrder(orderId);
    if (productId) setSelectedProduct(productId);
    setShowPanel(true);
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div><p>Cargando módulo de producción...</p></div>;

  return (
    <div>
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
            <h3 style={{ fontSize: '20px', marginBottom: '20px', color: 'var(--text-primary)' }}>Agrupado por Producto</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {Object.keys(pendingByProduct).length === 0 && (
                <p style={{ color: 'var(--text-secondary)' }}>No hay productos pendientes.</p>
              )}
              {Object.entries(pendingByProduct).map(([productId, data]) => (
                <ExpandableCard
                  key={productId}
                  title={data.productName}
                  collapsedContent={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Package size={20} color="var(--alvacio-red)" />
                      <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{data.total} {data.unit}</span>
                    </div>
                  }
                  expandedContent={<></>}
                  actions={
                    <button className="btn-secondary" onClick={() => openProducePanel('FREE', undefined, productId)}>
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
              {pendingOrders.map(order => (
                <ExpandableCard
                  key={order.id}
                  title={`Pedido ${order.id.slice(0, 6)}`}
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
                      {order.items.length} ítems
                    </div>
                  }
                  expandedContent={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {order.items.map((item, idx) => {
                        const p = products.find(prod => prod.id === item.productId);
                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <span>{p?.nombre}</span>
                            <strong>{item.cantidad} {item.unidad}</strong>
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
              ))}
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
            <h3 style={{ fontSize: '20px', marginBottom: '20px', color: 'var(--text-primary)' }}>Stock de Terminados</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {finishedProducts.map(p => (
                <ExpandableCard
                  key={p.id}
                  title={p.nombre}
                  collapsedContent={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                      <CheckCircle size={20} color="#16a34a" />
                      <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{p.stockActual || 0}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{p.unitType}</span>
                    </div>
                  }
                  expandedContent={<></>}
                />
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '20px', marginBottom: '20px', color: 'var(--text-primary)' }}>Últimos Movimientos</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {movements.filter(m => m.type === 'PRODUCCION').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0,10).map(m => {
                const p = products.find(prod => prod.id === m.productId);
                return (
                  <div key={m.id} className="apple-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <Activity size={24} color="var(--alvacio-red)" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '16px' }}>{p?.nombre}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{new Date(m.date).toLocaleString()} • {m.observaciones || 'Sin observaciones'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <strong style={{ fontSize: '18px', color: m.qty > 0 ? '#16a34a' : 'inherit' }}>
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
            {finishedProducts.map(p => {
              const max = getCapacity(p.id);
              return (
                <ExpandableCard
                  key={p.id}
                  title={p.nombre}
                  collapsedContent={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                      <Clock size={20} color={max > 0 ? "var(--alvacio-red)" : "var(--text-secondary)"} />
                      <span style={{ fontSize: '24px', fontWeight: 'bold', color: max > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {max}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{p.unitType}</span>
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

      <RightPanel 
        isOpen={showPanel} 
        onClose={() => setShowPanel(false)} 
        title={prodMode === 'ORDER' ? 'Producción desde Pedido' : 'Producción Libre'}
      >
        <form onSubmit={handleProduce} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {prodMode === 'ORDER' && (
            <div className="form-group">
              <label>Seleccionar Pedido</label>
              <select required value={selectedOrder} onChange={e => setSelectedOrder(e.target.value)}>
                <option value="">-- Seleccione --</option>
                {pendingOrders.map(o => (
                  <option key={o.id} value={o.id}>Pedido {o.id.slice(0,6)} - {o.status}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Producto a Producir</label>
            <select required value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
              <option value="">-- Seleccione --</option>
              {finishedProducts.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.stockActual || 0} {p.unitType})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Cant. Producida</label>
              <input type="number" step="0.01" required value={prodQty || ''} onChange={e => setProdQty(Number(e.target.value))} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Peso Real (Opc.)</label>
              <input type="number" step="0.01" value={prodWeight || ''} onChange={e => setProdWeight(Number(e.target.value))} />
            </div>
          </div>

          <div className="form-group">
            <label>Merma (Opcional)</label>
            <input type="number" step="0.01" value={prodMerma || ''} onChange={e => setProdMerma(Number(e.target.value))} />
          </div>

          <div className="form-group">
            <label>Observaciones</label>
            <textarea value={prodObs} onChange={e => setProdObs(e.target.value)} placeholder="Ej: Lote x, Detalles..." rows={3} />
          </div>

          {prodMode === 'ORDER' && (
            <div className="form-group">
              <label>Cambiar Estado del Pedido a:</label>
              <select value={newStatus} onChange={e => setNewStatus(e.target.value as any)}>
                <option value="EN_PRODUCCION">EN_PRODUCCION</option>
                <option value="PRODUCIDO">PRODUCIDO</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowPanel(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>Confirmar</button>
          </div>
        </form>
      </RightPanel>
    </div>
  );
}
