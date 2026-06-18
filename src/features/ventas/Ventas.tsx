import { useState, useMemo, useEffect } from 'react';
import { useVentas } from './useVentas';
import type { Sale, Order, SaleItem } from '../../types/domain';
import { useFinancialAccountsStore } from '../../store/financialAccountsStore';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import Modal from '../../components/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, DollarSign, XCircle, Edit3 } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { createAlvacioPDF } from '../../lib/pdfHelper';
import { calculateWeightInKg, convertQuantityToBaseUnit } from '../../lib/unitConverter';
import { truncateDecimals } from '../../lib/formatters';
import { groupPresentacionesByCustomer } from '../../lib/groupByCustomer';

const STATUS_COLORS: Record<string, string> = {
  FACTURADO: '#f59e0b',
  COBRADO: '#10b981',
  ANULADO: '#ef4444'
};

export default function Ventas() {
  const { sales, orders, customers, products, loading, createSaleFromOrder, createQuickSale, updateSale, cobrarSale, anularSale, deleteSale, markOrderAsDelivered } = useVentas();
  
  // RightPanel states
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [saleToCobrar, setSaleToCobrar] = useState<Sale | null>(null);
  
  // Quick Sale State
  const [quickSale, setQuickSale] = useState<{ customerId: string; items: SaleItem[]; totalAmount: number; observaciones: string }>({
    customerId: '', items: [], totalAmount: 0, observaciones: ''
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');

  const generateRemitoPDF = (sale: Sale) => {
    const doc = createAlvacioPDF('REMITO COMERCIAL');
    const customer = customers.find(c => c.id === sale.customerId);
    
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date(sale.date).toLocaleDateString()}`, 15, 42);
    doc.text(`Comprobante N°: ${sale.id.slice(-6).toUpperCase()}`, 15, 47);
    
    // Customer Info
    doc.rect(15, 52, 180, 30);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text('Datos del Cliente', 20, 59);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Nombre: ${customer?.nombre || 'Consumidor Final'}`, 20, 67);
    doc.text(`Dirección: ${customer?.direccion || '-'}`, 20, 73);
    doc.text(`Teléfono: ${customer?.telefono || '-'}`, 20, 79);
    
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
      startY: 87,
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
      observaciones: quickSale.observaciones,
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
        item.precioUnitario = prod.precioComercial || 0;
      }
    }
    
    const prod = products.find(p => p.id === item.productId);
    let weightInKg = calculateWeightInKg(item.cantidad, item.unidad, prod);
    weightInKg = truncateDecimals(weightInKg, 3);

    item.cantidad = truncateDecimals(Number(item.cantidad), 3);
    item.precioUnitario = Number(Number(item.precioUnitario).toFixed(2));
    item.subtotal = Number((weightInKg * item.precioUnitario).toFixed(2));
    newItems[idx] = item as SaleItem;
    
    setQuickSale(prev => ({
      ...prev,
      items: newItems,
      totalAmount: Number(newItems.reduce((acc, it) => acc + it.subtotal, 0).toFixed(2))
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



  const handleCobrar = (sale: Sale) => {
    setSaleToCobrar(sale);
  };

  const executeCobrar = async (method: 'EFECTIVO_TRANSFERENCIA' | 'CUENTA_CORRIENTE') => {
    if (!saleToCobrar) return;
    try {
      await cobrarSale(saleToCobrar, method);
      setSaleToCobrar(null);
    } catch (err: any) {
      alert(`Error al registrar cobro: ${err.message || err}`);
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



  if (loading) return <LoadingSpinner message="Cargando módulo de ventas..." />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Ventas</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
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
                          {sale.status === 'ANULADO' && (
                            <button className="btn-secondary" style={{ flex: 1, padding: '8px', color: '#ef4444', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }} onClick={(e) => { 
                              e.stopPropagation();
                              if(confirm('¿Eliminar esta venta del sistema (Baja Lógica)?')) deleteSale(sale);
                            }}>
                              <XCircle size={16} /> Eliminar
                            </button>
                          )}
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
      <RightPanel isOpen={showQuickSale} onClose={() => setShowQuickSale(false)} title="Nueva Venta Rápida (Pedido)">
        <form onSubmit={handleCreateQuickSale} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label>Cliente</label>
            <select required value={quickSale.customerId} onChange={e => setQuickSale({...quickSale, customerId: e.target.value})}>
              <option value="">Seleccione Cliente</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Observaciones (Opcional)</label>
            <textarea 
              value={quickSale.observaciones || ''} 
              onChange={e => setQuickSale({...quickSale, observaciones: e.target.value})} 
              placeholder="Ej: Entrega por la tarde, prioridad alta..."
              rows={2}
            />
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
                    {(() => {
                      const pres = products.filter(p => p.type === 'PRESENTACION');
                      const { byCustomer, loose } = groupPresentacionesByCustomer(pres, customers, quickSale.customerId);
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
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>Generar Pedido</button>
          </div>
        </form>
      </RightPanel>

      {/* Custom Premium Option Modal for Cobro */}
      <Modal 
        isOpen={saleToCobrar !== null} 
        onClose={() => setSaleToCobrar(null)} 
        title="Registrar Cobro de Venta"
      >
        {saleToCobrar && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Seleccione el método de cobro para la venta de{' '}
              <strong>
                {customers.find(c => c.id === saleToCobrar.customerId)?.nombre || 'Cliente Desconocido'}
              </strong>{' '}
              por un total de{' '}
              <strong style={{ color: 'var(--alvacio-red)' }}>
                ${saleToCobrar.totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </strong>:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => executeCobrar('EFECTIVO_TRANSFERENCIA')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                💵 Efectivo / Transferencia (Ingreso a Caja)
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => executeCobrar('CUENTA_CORRIENTE')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: '1px solid var(--border-color)'
                }}
              >
                📋 Cuenta Corriente (Registrar como Deuda)
              </button>
            </div>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => setSaleToCobrar(null)}
              style={{
                marginTop: '8px',
                padding: '10px',
                fontSize: '13px',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
