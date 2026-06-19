import { useState, useMemo } from 'react';
import { usePedidos } from './usePedidos';
import type { Order, OrderItem, OrderStatus } from '../../types/domain';
import RightPanel from '../../components/RightPanel';
import ExpandableCard from '../../components/ExpandableCard';
import { calculateWeightInKg, convertQuantityToBaseUnit } from '../../lib/unitConverter';
import { groupPresentacionesByCustomer } from '../../lib/groupByCustomer';

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDIENTE: '#f59e0b',
  EN_PRODUCCION: '#3b82f6',
  PRODUCIDO: '#8b5cf6',
  ENTREGADO: '#10b981',
  FACTURADO: '#14b8a6',
  ANULADO: '#ef4444'
};

import LoadingSpinner from '../../components/LoadingSpinner';

export default function Pedidos() {
  const { pedidos, clientes, productos, loading, savePedido, deletePedido, changeStatus, getProductPrice } = usePedidos();

  const [isEditing, setIsEditing] = useState(false);
  const [currentPedido, setCurrentPedido] = useState<Partial<Order>>({});
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterFecha, setFilterFecha] = useState('');

  const handleNuevoPedido = () => {
    setCurrentPedido({
      fecha: new Date().toISOString().split('T')[0],
      status: 'PENDIENTE',
      items: [],
      totalEstimado: 0,
      observaciones: ''
    });
    setIsEditing(true);
  };

  const handleEdit = (pedido: Order) => {
    setCurrentPedido(pedido);
    setIsEditing(true);
  };

  const handleDuplicate = (pedido: Order) => {
    setCurrentPedido({
      ...pedido,
      id: undefined, // nuevo id
      status: 'PENDIENTE',
      fecha: new Date().toISOString().split('T')[0]
    });
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPedido.customerId) return alert("Seleccione un cliente");
    if (!currentPedido.items || currentPedido.items.length === 0) return alert("Agregue al menos un ítem");
    
    await savePedido(currentPedido);
    setIsEditing(false);
  };

  // Manejo de items en el formulario
  const addItem = () => {
    const items = currentPedido.items || [];
    setCurrentPedido({
      ...currentPedido,
      items: [...items, { productId: '', cantidad: 1, unidad: 'KG', precioEstimado: 0, subtotal: 0 }]
    });
  };

  const updateItem = (index: number, field: keyof OrderItem, value: any) => {
    const items = [...(currentPedido.items || [])];
    let val = value;
    const pIdForChecks = field === 'productId' ? value : items[index].productId;
    const prodForChecks = productos.find(p => p.id === pIdForChecks);

    if (field === 'cantidad' && prodForChecks && prodForChecks.type === 'PRESENTACION') {
      val = Math.round(Number(value));
      if (isNaN(val) || val < 1) val = 1;
    }
    items[index] = { ...items[index], [field]: val };
    
    // Si cambia el producto o cantidad, recalcular precio
    if (field === 'productId' || field === 'cantidad' || field === 'unidad') {
      const pId = field === 'productId' ? value : items[index].productId;
      const cant = field === 'cantidad' ? Number(val) : items[index].cantidad;
      
      const prod = productos.find(p => p.id === pId);
      if (prod) {
        if (field === 'productId') {
          items[index].unidad = prod.type === 'PRESENTACION' ? 'UNIDADES' : prod.unitType;
        }
        
        const price = getProductPrice(pId, currentPedido.customerId || '');
        items[index].precioEstimado = price;
        const baseQty = convertQuantityToBaseUnit(cant, items[index].unidad, prod);
        items[index].subtotal = price * baseQty;
      }
    }
    
    // Recalcular total
    const total = items.reduce((acc, it) => acc + (it.subtotal || 0), 0);
    
    setCurrentPedido({
      ...currentPedido,
      items,
      totalEstimado: total
    });
  };

  const removeItem = (index: number) => {
    const items = [...(currentPedido.items || [])];
    items.splice(index, 1);
    const total = items.reduce((acc, it) => acc + (it.subtotal || 0), 0);
    setCurrentPedido({ ...currentPedido, items, totalEstimado: total });
  };

  // Refrescar precios si cambia el cliente
  const handleClientChange = (customerId: string) => {
    const items = [...(currentPedido.items || [])];
    let total = 0;
    
    items.forEach(item => {
      if (item.productId) {
        const prod = productos.find(p => p.id === item.productId);
        const price = getProductPrice(item.productId, customerId);
        item.precioEstimado = price;
        const baseQty = convertQuantityToBaseUnit(item.cantidad, item.unidad, prod);
        item.subtotal = price * baseQty;
        total += item.subtotal;
      }
    });

    setCurrentPedido({
      ...currentPedido,
      customerId,
      items,
      totalEstimado: total
    });
  };

  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});

  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      const c = clientes.find(c => c.id === p.customerId);
      const matchSearch = c?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c?.cuit?.includes(searchTerm);
      const matchCliente = filterCliente ? p.customerId === filterCliente : true;
      const matchEstado = filterEstado ? p.status === filterEstado : true;
      const matchFecha = filterFecha ? p.fecha === filterFecha : true;
      
      return matchSearch && matchCliente && matchEstado && matchFecha;
    }).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [pedidos, clientes, searchTerm, filterCliente, filterEstado, filterFecha]);

  const groupedByCustomer = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    filteredPedidos.forEach(pedido => {
      if (!groups[pedido.customerId]) {
        groups[pedido.customerId] = [];
      }
      groups[pedido.customerId].push(pedido);
    });

    return Object.entries(groups).map(([customerId, customerOrders]) => {
      const customer = clientes.find(c => c.id === customerId);
      const customerName = customer?.nombre || 'Cliente Desconocido';
      
      const sortedOrders = [...customerOrders].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      let totalPendiente = 0;
      let totalProducido = 0;
      let totalFacturado = 0;

      sortedOrders.forEach(o => {
        if (o.status === 'PENDIENTE' || o.status === 'EN_PRODUCCION') {
          totalPendiente += o.totalEstimado || 0;
        } else if (o.status === 'PRODUCIDO') {
          totalProducido += o.totalEstimado || 0;
        } else if (o.status === 'FACTURADO' || o.status === 'ENTREGADO') {
          totalFacturado += o.totalEstimado || 0;
        }
      });

      return {
        customerId,
        customerName,
        orders: sortedOrders,
        summary: {
          qty: sortedOrders.length,
          totalPendiente,
          totalProducido,
          totalFacturado
        }
      };
    }).sort((a, b) => a.customerName.localeCompare(b.customerName, 'es', { sensitivity: 'base' }));
  }, [filteredPedidos, clientes]);

  const toggleCustomer = (customerId: string) => {
    setExpandedCustomers(prev => ({
      ...prev,
      [customerId]: !prev[customerId]
    }));
  };

  if (loading) return <LoadingSpinner message="Cargando módulo de pedidos..." />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Pedidos</h1>
        <button className="btn-primary" onClick={handleNuevoPedido}>+ Crear Pedido</button>
      </div>

      <div className="search-bar" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <input 
          type="text" 
          placeholder="Buscar cliente..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select value={filterCliente} onChange={e => setFilterCliente(e.target.value)}>
          <option value="">Todos los clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input 
          type="date" 
          value={filterFecha}
          onChange={e => setFilterFecha(e.target.value)}
        />
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">PENDIENTE</option>
          <option value="EN_PRODUCCION">EN PRODUCCIÓN</option>
          <option value="PRODUCIDO">PRODUCIDO</option>
          <option value="ENTREGADO">ENTREGADO</option>
          <option value="FACTURADO">FACTURADO</option>
          <option value="ANULADO">ANULADO</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {groupedByCustomer.map(grp => {
          const isExpanded = !!expandedCustomers[grp.customerId];
          return (
            <div key={grp.customerId} className="apple-card" style={{ padding: '0', overflow: 'hidden' }}>
              <div 
                onClick={() => toggleCustomer(grp.customerId)}
                style={{ 
                  padding: '20px 24px', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  background: 'var(--surface-color)', 
                  borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
                  userSelect: 'none'
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>{grp.customerName}</h3>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '13px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span>📦 Pedidos: <strong>{grp.summary.qty}</strong></span>
                    <span>⏳ Pendiente: <strong style={{ color: 'var(--alvacio-red-dark)' }}>${grp.summary.totalPendiente.toFixed(2)}</strong></span>
                    <span>⚙️ Producido: <strong style={{ color: '#8b5cf6' }}>${grp.summary.totalProducido.toFixed(2)}</strong></span>
                    <span>💵 Facturado: <strong style={{ color: '#10b981' }}>${grp.summary.totalFacturado.toFixed(2)}</strong></span>
                  </div>
                </div>
                <div style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  ▶
                </div>
              </div>
              
              {isExpanded && (
                <div style={{ padding: '24px', background: '#fcfcfc', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                  {grp.orders.map(pedido => (
                    <ExpandableCard
                      key={pedido.id}
                      title={`Pedido N° ${pedido.id.slice(-6).toUpperCase()}`}
                      subtitle={`Fecha: ${pedido.fecha}`}
                      statusBadge={
                        <span style={{ 
                          backgroundColor: STATUS_COLORS[pedido.status] + '20',
                          color: STATUS_COLORS[pedido.status],
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 600
                        }}>
                          {pedido.status}
                        </span>
                      }
                      collapsedContent={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                          <span>Ítems: {pedido.items?.length || 0}</span>
                          <strong style={{ fontSize: '18px' }}>${pedido.totalEstimado?.toFixed(2)}</strong>
                        </div>
                      }
                      expandedContent={
                        <div>
                          <h4 style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>Detalle de ítems:</h4>
                          {pedido.items?.map((it, idx) => {
                            const prod = productos.find(p => p.id === it.productId);
                            const weightObj = calculateWeightInKg(it.cantidad, it.unidad, prod);
                            const currentPesosReales = it.pesosReales || [];
                            const hasRealWeights = currentPesosReales.length > 0 || (it.pesoReal !== undefined && it.pesoReal > 0);
                            
                            return (
                              <div key={idx} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)', fontSize: '14px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
                                  <span>{prod?.nombre}</span>
                                  <strong>${it.subtotal?.toFixed(2)}</strong>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span>Cantidad: {it.cantidad} {it.unidad}</span>
                                  <span>Peso Objetivo: {weightObj.toFixed(3)} kg</span>
                                  {hasRealWeights && (
                                    <div style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid var(--alvacio-red)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      {currentPesosReales.length > 0 ? (
                                        <>
                                          {currentPesosReales.map((w, pkgIdx) => (
                                            <span key={pkgIdx}>Paquete {pkgIdx + 1}: <strong>{w.toFixed(3)} kg</strong></span>
                                          ))}
                                          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Total Peso Real: {(it.pesoReal || 0).toFixed(3)} kg</span>
                                        </>
                                      ) : (
                                        <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Total Peso Real: {(it.pesoReal || 0).toFixed(3)} kg</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {pedido.observaciones && (
                            <div style={{ marginTop: '12px', fontSize: '13px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                              Obs: {pedido.observaciones}
                            </div>
                          )}
                        </div>
                      }
                      actions={
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                          <button className="btn-secondary" style={{ flex: 1, padding: '8px' }} onClick={(e) => { e.stopPropagation(); handleEdit(pedido); }}>Editar</button>
                          <button className="btn-secondary" style={{ flex: 1, padding: '8px' }} onClick={(e) => { e.stopPropagation(); handleDuplicate(pedido); }}>Duplicar</button>
                          {pedido.status !== 'ANULADO' && (
                            <button className="btn-secondary" style={{ flex: 1, padding: '8px', color: '#ef4444' }} onClick={(e) => { e.stopPropagation(); changeStatus(pedido.id, 'ANULADO'); }}>Anular</button>
                          )}
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {groupedByCustomer.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No se encontraron pedidos.</p>
        )}
      </div>

      <RightPanel 
        isOpen={isEditing} 
        onClose={() => setIsEditing(false)} 
        title={currentPedido.id ? 'Editar Pedido' : 'Nuevo Pedido'}
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label>Cliente</label>
            <select 
              required 
              value={currentPedido.customerId || ''} 
              onChange={e => handleClientChange(e.target.value)}
            >
              <option value="">Seleccione Cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Fecha</label>
            <input 
              type="date" 
              required 
              value={currentPedido.fecha || ''} 
              onChange={e => setCurrentPedido({...currentPedido, fecha: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label>Estado</label>
            <select 
              required 
              value={currentPedido.status || 'PENDIENTE'} 
              onChange={e => setCurrentPedido({...currentPedido, status: e.target.value as OrderStatus})}
            >
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="EN_PRODUCCION">EN PRODUCCIÓN</option>
              <option value="PRODUCIDO">PRODUCIDO</option>
              <option value="ENTREGADO">ENTREGADO</option>
              <option value="FACTURADO">FACTURADO</option>
              <option value="ANULADO">ANULADO</option>
            </select>
          </div>

          <div className="form-group">
            <label>Observaciones</label>
            <textarea 
              value={currentPedido.observaciones || ''} 
              onChange={e => setCurrentPedido({...currentPedido, observaciones: e.target.value})}
              placeholder="Opcional..."
              rows={3}
            />
          </div>

          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--alvacio-red-dark)' }}>Ítems</h3>
              <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={addItem}>+ Agregar Ítem</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(currentPedido.items || []).map((item, idx) => {
                const prod = productos.find(p => p.id === item.productId);
                return (
                  <div key={idx} style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <select 
                      required 
                      value={item.productId} 
                      onChange={e => updateItem(idx, 'productId', e.target.value)}
                    >
                      <option value="">Seleccione Producto</option>
                      {(() => {
                        const pres = productos.filter(p => p.type === 'PRESENTACION');
                        const { byCustomer, loose } = groupPresentacionesByCustomer(pres, clientes, currentPedido.customerId);
                        return (
                          <>
                            {byCustomer.map(grp => (
                              <optgroup key={grp.customer.id} label={`👤 ${grp.customer.nombre}`}>
                                {grp.products.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                              </optgroup>
                            ))}
                            {loose.length > 0 && (
                              <optgroup label="📦 Sin cliente asignado">
                                {loose.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                              </optgroup>
                            )}
                          </>
                        );
                      })()}
                    </select>
                    
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input 
                        type="number" 
                        required 
                        min={prod?.type === 'PRESENTACION' ? "1" : "0.1"} 
                        step={prod?.type === 'PRESENTACION' ? "1" : "0.1"}
                        value={item.cantidad || ''} 
                        onChange={e => {
                          const val = e.target.value;
                          const parsedVal = prod?.type === 'PRESENTACION' ? Math.round(Number(val)) : Number(val);
                          updateItem(idx, 'cantidad', isNaN(parsedVal) ? '' : parsedVal);
                        }} 
                        placeholder="Cant."
                      />
                      <select 
                        value={item.unidad} 
                        disabled={prod?.type === 'PRESENTACION'}
                        onChange={e => updateItem(idx, 'unidad', e.target.value)}
                      >
                        <option value="KG">KG</option>
                        <option value="GRAMOS">GRAMOS</option>
                        <option value="UNIDADES">UNIDADES</option>
                        <option value="FETAS">FETAS</option>
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {item.precioEstimado !== undefined && item.precioEstimado > 0 && (
                          <span>
                            Precio: ${item.precioEstimado.toFixed(2)} / {prod?.unitType}
                            {prod?.unitType === 'KG' && item.unidad === 'UNIDADES' && prod.pesoObjetivoGramos && (
                              <span> (~{calculateWeightInKg(item.cantidad, item.unidad, prod).toFixed(3)} kg total)</span>
                            )}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Subtotal:</span>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '15px' }}>${item.subtotal?.toFixed(2)}</strong>
                      </div>
                      <button type="button" onClick={() => removeItem(idx)} style={{ color: '#ef4444', background: 'transparent', fontSize: '13px', textDecoration: 'underline' }}>Eliminar</button>
                    </div>
                  </div>
                );
              })}
              {(!currentPedido.items || currentPedido.items.length === 0) && (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>No hay ítems agregados.</p>
              )}
            </div>

            <div style={{ textAlign: 'right', marginTop: '24px', fontSize: '18px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <strong>Total Estimado: <span style={{ color: 'var(--alvacio-red)' }}>${currentPedido.totalEstimado?.toFixed(2) || '0.00'}</span></strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsEditing(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>Guardar</button>
          </div>
        </form>
      </RightPanel>
    </div>
  );
}
