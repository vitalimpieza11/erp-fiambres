import { useState, useMemo } from 'react';
import { useVentas } from './useVentas';
import type { Sale, Order, SaleItem } from '../../types/domain';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, DollarSign, XCircle, Edit3 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  FACTURADO: '#f59e0b',
  COBRADO: '#10b981',
  ANULADO: '#ef4444'
};

export default function Ventas() {
  const { sales, orders, customers, products, loading, createSaleFromOrder, createQuickSale, updateSale, cobrarSale, anularSale, deleteSale, markOrderAsDelivered } = useVentas();
  
  // RightPanel states
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [showFacturarPedido, setShowFacturarPedido] = useState(false);
  const [orderToFacturar, setOrderToFacturar] = useState<Order | null>(null);
  const [partialSaleItems, setPartialSaleItems] = useState<Omit<SaleItem, 'subtotal'>[]>([]);
  
  // Quick Sale State
  const [quickSale, setQuickSale] = useState<{ customerId: string; items: SaleItem[]; totalAmount: number; observaciones: string }>({
    customerId: '', items: [], totalAmount: 0, observaciones: ''
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');

  const generateRemitoPDF = (sale: Sale) => {
    const doc = new jsPDF();
    const customer = customers.find(c => c.id === sale.customerId);
    
    // Header
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.text('ALVACÍO', 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text('REMITO COMERCIAL', 105, 28, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date(sale.date).toLocaleDateString()}`, 15, 38);
    doc.text(`Comprobante N°: ${sale.id.slice(-6).toUpperCase()}`, 15, 43);
    
    // Customer Info
    doc.rect(15, 48, 180, 30);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text('Datos del Cliente', 20, 55);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Nombre: ${customer?.nombre || 'Consumidor Final'}`, 20, 63);
    doc.text(`Dirección: ${customer?.direccion || '-'}`, 20, 69);
    doc.text(`Teléfono: ${customer?.telefono || '-'}`, 20, 75);

    // Items table
    const tableData = sale.items.map(item => {
      const prod = products.find(p => p.id === item.productId);
      return [
        prod?.nombre || 'Producto Desconocido',
        `${item.cantidad} ${item.unidad}`,
        `$${item.precioUnitario.toFixed(2)}`,
        `$${item.subtotal.toFixed(2)}`
      ];
    });

    autoTable(doc, {
      startY: 85,
      head: [['Producto', 'Cantidad', 'Precio Unit.', 'Subtotal']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3, textColor: [50, 50, 50] },
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] }, // Apple-inspired dark header
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });

    // Total
    const finalY = (doc as any).lastAutoTable.finalY || 85;
    doc.setFontSize(14);
    doc.text(`TOTAL: $${sale.totalAmount.toFixed(2)}`, 195, finalY + 15, { align: 'right' });

    doc.save(`Remito_${sale.id.slice(-6).toUpperCase()}.pdf`);
  };

  const handleCreateQuickSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSale.customerId) return alert("Seleccione cliente");
    if (quickSale.items.length === 0) return alert("Agregue al menos un ítem");
    
    await createQuickSale({
      customerId: quickSale.customerId,
      date: new Date().toISOString(),
      items: quickSale.items,
      totalAmount: quickSale.totalAmount,
    });
    
    setShowQuickSale(false);
    setQuickSale({ customerId: '', items: [], totalAmount: 0, observaciones: '' });
  };

  const addQuickSaleItem = () => {
    setQuickSale(prev => ({
      ...prev,
      items: [...prev.items, { productId: '', cantidad: 1, unidad: 'KG', precioUnitario: 0, subtotal: 0 }]
    }));
  };

  const updateQuickSaleItem = (idx: number, field: string, val: string | number) => {
    const newItems = [...quickSale.items];
    const item = { ...newItems[idx], [field]: val };
    
    if (field === 'productId') {
      const prod = products.find(p => p.id === val);
      if (prod) {
        item.unidad = prod.unitType;
        item.precioUnitario = prod.precioSugerido || 0;
      }
    }
    
    item.subtotal = item.cantidad * item.precioUnitario;
    newItems[idx] = item as SaleItem;
    
    setQuickSale(prev => ({
      ...prev,
      items: newItems,
      totalAmount: newItems.reduce((acc, it) => acc + it.subtotal, 0)
    }));
  };

  const removeQuickSaleItem = (idx: number) => {
    const newItems = [...quickSale.items];
    newItems.splice(idx, 1);
    setQuickSale(prev => ({
      ...prev,
      items: newItems,
      totalAmount: newItems.reduce((acc, it) => acc + it.subtotal, 0)
    }));
  };

  const handleSelectOrderForFacturar = (order: Order) => {
    setOrderToFacturar(order);
    setPartialSaleItems(order.items.map(it => ({
      productId: it.productId,
      cantidad: it.cantidad,
      unidad: it.unidad,
      precioUnitario: it.precioEstimado,
    })));
  };

  const handleUpdatePartialItem = (idx: number, field: string, val: number) => {
    const newItems = [...partialSaleItems];
    newItems[idx] = { ...newItems[idx], [field]: val };
    setPartialSaleItems(newItems);
  };

  const handleSubmitPartialSale = async () => {
    if (!orderToFacturar) return;
    const finalTotal = partialSaleItems.reduce((acc, it) => acc + (it.cantidad * it.precioUnitario), 0);
    if (confirm(`¿Facturar pedido por $${finalTotal.toFixed(2)}?`)) {
      await createSaleFromOrder(orderToFacturar, partialSaleItems, finalTotal);
      setOrderToFacturar(null);
      setShowFacturarPedido(false);
    }
  };

  const handleCobrar = async (sale: Sale) => {
    const option = prompt("MÉTODO DE COBRO:\n\nEscriba '1' para Efectivo/Transferencia\nEscriba '2' para Cuenta Corriente");
    if (option === '1') {
      await cobrarSale(sale, 'EFECTIVO_TRANSFERENCIA');
    } else if (option === '2') {
      await cobrarSale(sale, 'CUENTA_CORRIENTE');
    } else if (option) {
      alert("Opción no válida");
    }
  };

  // Grouped Sales View
  const groupedSales = useMemo(() => {
    const filtered = sales.filter(s => {
      const c = customers.find(x => x.id === s.customerId);
      return c?.nombre?.toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    const groups: Record<string, Sale[]> = {};
    filtered.forEach(s => {
      const cId = s.customerId || 'UNKNOWN';
      if (!groups[cId]) groups[cId] = [];
      groups[cId].push(s);
    });
    
    return groups;
  }, [sales, customers, searchTerm]);

  const pedidosListos = useMemo(() => {
    return orders.filter(o => o.status === 'ENTREGADO' || o.status === 'PRODUCIDO');
  }, [orders]);

  if (loading) return <div className="loading-container"><div className="spinner"></div><p>Cargando módulo de ventas...</p></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Ventas</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={() => setShowFacturarPedido(true)}>Facturar Pedido</button>
          <button className="btn-primary" onClick={() => setShowQuickSale(true)}>+ Venta Rápida</button>
        </div>
      </div>

      <div className="search-bar" style={{ marginBottom: '24px' }}>
        <input 
          type="text" 
          placeholder="Buscar ventas por cliente..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', maxWidth: '400px' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
        {Object.keys(groupedSales).length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No se encontraron ventas.</p>
        ) : (
          Object.entries(groupedSales).map(([cId, clientSales]) => {
            const c = customers.find(x => x.id === cId);
            return (
              <div key={cId}>
                <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  {c?.nombre || 'Cliente Desconocido'}
                </h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                  {clientSales.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(sale => (
                    <ExpandableCard
                      key={sale.id}
                      title={new Date(sale.date).toLocaleDateString()}
                      statusBadge={
                        <span style={{ 
                          backgroundColor: STATUS_COLORS[sale.status] + '20',
                          color: STATUS_COLORS[sale.status]
                        }}>
                          {sale.status} {sale.status === 'COBRADO' && `(${sale.paymentMethod})`}
                        </span>
                      }
                      collapsedContent={
                        <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '12px', color: 'var(--text-primary)' }}>
                          ${sale.totalAmount.toFixed(2)}
                        </div>
                      }
                      expandedContent={
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Ítems:</h4>
                          {sale.items.map((it, idx) => {
                            const prod = products.find(p => p.id === it.productId);
                            return (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                                <span>{prod?.nombre} x {it.cantidad} {it.unidad}</span>
                                <strong>${it.subtotal.toFixed(2)}</strong>
                              </div>
                            );
                          })}
                        </div>
                      }
                      actions={
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', width: '100%' }}>
                          <button className="btn-secondary" style={{ flex: 1, padding: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }} onClick={(e) => { e.stopPropagation(); generateRemitoPDF(sale); }}>
                            <FileText size={16} /> Remito
                          </button>
                          {sale.status === 'FACTURADO' && (
                            <button className="btn-primary" style={{ flex: 1, padding: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }} onClick={(e) => { e.stopPropagation(); handleCobrar(sale); }}>
                              <DollarSign size={16} /> Cobrar
                            </button>
                          )}
                          {sale.status === 'FACTURADO' && (
                            <button className="btn-secondary" style={{ flex: 1, padding: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }} onClick={(e) => { 
                              e.stopPropagation();
                              const newTotal = prompt("Editar Total de Venta:", sale.totalAmount.toString());
                              if (newTotal && !isNaN(Number(newTotal))) {
                                updateSale(sale.id, { totalAmount: Number(newTotal) });
                              }
                            }}>
                              <Edit3 size={16} /> Editar
                            </button>
                          )}
                          {sale.status !== 'ANULADO' && (
                            <button className="btn-secondary" style={{ flex: 1, padding: '8px', color: '#ef4444', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }} onClick={(e) => { 
                              e.stopPropagation();
                              if(confirm('¿Anular esta venta? Se generarán los movimientos compensatorios necesarios.')) anularSale(sale);
                            }}>
                              <XCircle size={16} /> Anular
                            </button>
                          )}
                          <button className="btn-secondary" style={{ flex: 1, padding: '8px', color: '#ef4444', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }} onClick={(e) => { 
                            e.stopPropagation();
                            if(confirm('¿Eliminar esta venta del sistema (Baja Lógica)?')) deleteSale(sale);
                          }}>
                            <XCircle size={16} /> Eliminar
                          </button>
                        </div>
                      }
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Right Panels */}
      <RightPanel isOpen={showQuickSale} onClose={() => setShowQuickSale(false)} title="Nueva Venta Rápida">
        <form onSubmit={handleCreateQuickSale} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label>Cliente</label>
            <select required value={quickSale.customerId} onChange={e => setQuickSale({...quickSale, customerId: e.target.value})}>
              <option value="">Seleccione Cliente</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Ítems</h3>
              <button type="button" className="btn-secondary" style={{ padding: '6px 12px' }} onClick={addQuickSaleItem}>+ Agregar</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {quickSale.items.map((item, idx) => (
                <div key={idx} style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <select required value={item.productId} onChange={e => updateQuickSaleItem(idx, 'productId', e.target.value)}>
                    <option value="">Seleccione Producto</option>
                    {products.filter(p => p.type === 'PRESENTACION').map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Cant.</label>
                      <input type="number" required min="0.1" step="0.1" value={item.cantidad || ''} onChange={e => updateQuickSaleItem(idx, 'cantidad', parseFloat(e.target.value))} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Precio U.</label>
                      <input type="number" required step="0.01" value={item.precioUnitario || ''} onChange={e => updateQuickSaleItem(idx, 'precioUnitario', parseFloat(e.target.value))} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Subtotal: ${item.subtotal.toFixed(2)}</span>
                    <button type="button" onClick={() => removeQuickSaleItem(idx)} style={{ color: '#ef4444', background: 'transparent', textDecoration: 'underline', fontSize: '13px' }}>Eliminar</button>
                  </div>
                </div>
              ))}
              {quickSale.items.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>Sin ítems</p>
              )}
            </div>
            
            <div style={{ textAlign: 'right', marginTop: '24px', fontSize: '18px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <strong>Total Venta: <span style={{ color: 'var(--alvacio-red)' }}>${quickSale.totalAmount.toFixed(2)}</span></strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowQuickSale(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>Generar Venta</button>
          </div>
        </form>
      </RightPanel>

      <RightPanel isOpen={showFacturarPedido} onClose={() => setShowFacturarPedido(false)} title="Facturar Pedido">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!orderToFacturar ? (
            <>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Pedidos listos para ser facturados (Producidos o Entregados):</p>
              {pedidosListos.map(order => {
                const c = customers.find(x => x.id === order.customerId);
                return (
                  <ExpandableCard
                    key={order.id}
                    title={c?.nombre}
                    subtitle={`Pedido ${order.id.slice(0,6)} • ${order.fecha} • Estado: ${order.status}`}
                    collapsedContent={
                      <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '8px' }}>
                        ${order.totalEstimado.toFixed(2)}
                      </div>
                    }
                    expandedContent={
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Ítems: {order.items.length}
                      </div>
                    }
                    actions={
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        {order.status === 'PRODUCIDO' && (
                          <button className="btn-secondary" style={{ flex: 1 }} onClick={() => markOrderAsDelivered(order.id)}>
                            Marcar Entregado
                          </button>
                        )}
                        <button 
                          className="btn-primary" 
                          style={{ flex: 1 }} 
                          onClick={() => handleSelectOrderForFacturar(order)}
                          disabled={order.status === 'PRODUCIDO'}
                        >
                          Generar Venta
                        </button>
                      </div>
                    }
                  />
                );
              })}
              {pedidosListos.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '20px' }}>No hay pedidos listos.</p>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Entrega Parcial / Total</h3>
                <button className="btn-secondary" onClick={() => setOrderToFacturar(null)} style={{ padding: '4px 8px', fontSize: '12px' }}>Volver</button>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Ajuste las cantidades o precios antes de generar la venta.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {partialSaleItems.map((item, idx) => {
                  const prod = products.find(p => p.id === item.productId);
                  return (
                    <div key={idx} style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>{prod?.nombre || 'Producto'} ({item.unidad})</div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Cantidad</label>
                          <input type="number" step="0.1" value={item.cantidad} onChange={e => handleUpdatePartialItem(idx, 'cantidad', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Precio U.</label>
                          <input type="number" step="0.01" value={item.precioUnitario} onChange={e => handleUpdatePartialItem(idx, 'precioUnitario', parseFloat(e.target.value) || 0)} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', marginTop: '8px', fontSize: '14px', fontWeight: 600 }}>
                        Subtotal: ${(item.cantidad * item.precioUnitario).toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div style={{ textAlign: 'right', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <strong style={{ fontSize: '18px' }}>Total a Facturar: <span style={{ color: 'var(--alvacio-red)' }}>${partialSaleItems.reduce((acc, it) => acc + (it.cantidad * it.precioUnitario), 0).toFixed(2)}</span></strong>
              </div>
              
              <button className="btn-primary" onClick={handleSubmitPartialSale} style={{ marginTop: '16px', width: '100%' }}>
                Confirmar Venta
              </button>
            </div>
          )}
        </div>
      </RightPanel>
    </div>
  );
}
