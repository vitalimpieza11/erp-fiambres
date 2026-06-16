import { useState, useMemo } from 'react';
import { useFacturacion } from './useFacturacion';
import type { Sale, Order, SaleItem } from '../../types/domain';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { generateInvoicePDF } from './invoicePdfHelper';
import { createAlvacioPDF } from '../../lib/pdfHelper';
import autoTable from 'jspdf-autotable';
import { calculateWeightInKg } from '../../lib/unitConverter';
import { truncateDecimals } from '../../lib/formatters';
import { FileText, DollarSign, XCircle, Search, Printer, Check } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  FACTURADO: '#f59e0b',
  COBRADO: '#10b981',
  ANULADO: '#ef4444'
};

export default function Facturacion() {
  const {
    sales,
    customers,
    products,
    loading,
    pendingOrders,
    createSaleFromOrder,
    cobrarSale,
    anularSale,
    deleteSale,
    markOrderAsDelivered
  } = useFacturacion();

  // Navigation tabs: 'pending' or 'issued'
  const [activeTab, setActiveTab] = useState<'pending' | 'issued'>('pending');

  // Right Panel states
  const [showFacturarPanel, setShowFacturarPanel] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [saleToCobrar, setSaleToCobrar] = useState<Sale | null>(null);

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');

  // Filter & Search Sales (Remitos)
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const customer = customers.find(c => c.id === s.customerId);
      const customerName = customer?.nombre?.toLowerCase() || '';
      const customerRazon = customer?.razonSocial?.toLowerCase() || '';
      const saleId = s.id.toLowerCase();
      
      return customerName.includes(searchTerm.toLowerCase()) || 
             customerRazon.includes(searchTerm.toLowerCase()) ||
             saleId.includes(searchTerm.toLowerCase());
    });
  }, [sales, customers, searchTerm]);

  // Open billing panel for a specific order
  const handleOpenFacturar = (order: Order) => {
    setSelectedOrder(order);

    setSaleItems(
      order.items.map(it => {
        const prod = products.find(p => p.id === it.productId);
        const hasRealWeight = it.pesoReal !== undefined && it.pesoReal > 0;
        
        const saleQty = hasRealWeight ? (it.pesoReal ?? it.cantidad) : it.cantidad;
        const saleUnit = hasRealWeight ? 'KG' : it.unidad;
        let weightInKg = hasRealWeight ? (it.pesoReal ?? 0) : calculateWeightInKg(saleQty, saleUnit, prod);
        weightInKg = truncateDecimals(weightInKg, 3);
        
        return {
          productId: it.productId,
          cantidad: truncateDecimals(saleQty, 3),
          unidad: saleUnit as any,
          precioUnitario: Number(it.precioEstimado.toFixed(2)),
          subtotal: Number((weightInKg * it.precioEstimado).toFixed(2))
        };
      })
    );
    setShowFacturarPanel(true);
  };

  const handleUpdateItem = (idx: number, field: keyof SaleItem, val: any) => {
    const newItems = [...saleItems];
    const item = { ...newItems[idx], [field]: val };
    const prod = products.find(p => p.id === item.productId);
    let weightInKg = calculateWeightInKg(item.cantidad, item.unidad, prod);
    weightInKg = truncateDecimals(weightInKg, 3);
    
    item.cantidad = truncateDecimals(Number(item.cantidad), 3);
    item.precioUnitario = Number(Number(item.precioUnitario).toFixed(2));
    item.subtotal = Number((weightInKg * item.precioUnitario).toFixed(2));
    newItems[idx] = item as SaleItem;
    setSaleItems(newItems);
  };

  const totalFacturar = useMemo(() => {
    return Number(saleItems.reduce((acc, it) => acc + it.subtotal, 0).toFixed(2));
  }, [saleItems]);

  const handleSubmitSale = async () => {
    if (!selectedOrder) return;
    
    const confirmMsg = `¿Emitir Remito Comercial por un total de $${totalFacturar.toLocaleString('es-AR', { minimumFractionDigits: 2 })}?`;
    if (window.confirm(confirmMsg)) {
      try {
        // We pass 'REMITO' as the invoice type to indicate it is a delivery note
        await createSaleFromOrder(selectedOrder, saleItems, totalFacturar, 'REMITO');
        setShowFacturarPanel(false);
        setSelectedOrder(null);
        setActiveTab('issued');
      } catch (error: any) {
        alert(`Error al emitir el remito: ${error.message || error}`);
      }
    }
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

  if (loading) return <LoadingSpinner message="Cargando módulo de facturación..." />;

  return (
    <div className="facturacion-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Facturación</h1>
        
        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.05)',
          padding: '4px',
          borderRadius: '10px'
        }}>
          <button 
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13.5px',
              backgroundColor: activeTab === 'pending' ? '#ffffff' : 'transparent',
              color: activeTab === 'pending' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'pending' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            Pendientes de Remitir ({pendingOrders.length})
          </button>
          <button 
            onClick={() => setActiveTab('issued')}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '13.5px',
              backgroundColor: activeTab === 'issued' ? '#ffffff' : 'transparent',
              color: activeTab === 'issued' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'issued' ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            Remitos Emitidos
          </button>
        </div>
      </div>

      {/* Tabs Content */}
      {activeTab === 'pending' ? (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
            Listado de pedidos terminados. Los pedidos deben ser marcados como <strong>Entregados</strong> para poder confeccionar y emitir su Remito Comercial.
          </p>

          {pendingOrders.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px',
              background: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              color: 'var(--text-secondary)'
            }}>
              No hay pedidos pendientes de remisión en este momento.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {pendingOrders.map(order => {
                const customer = customers.find(c => c.id === order.customerId);
                return (
                  <ExpandableCard
                    key={order.id}
                    title={customer?.nombre || 'Cliente Desconocido'}
                    subtitle={`Pedido ${order.id.slice(-6).toUpperCase()} • ${new Date(order.fecha).toLocaleDateString()}`}
                    statusBadge={
                      <span style={{ 
                        backgroundColor: order.status === 'ENTREGADO' ? '#10b98120' : '#3b82f620',
                        color: order.status === 'ENTREGADO' ? '#10b981' : '#3b82f6',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px'
                      }}>
                        {order.status}
                      </span>
                    }
                    collapsedContent={
                      <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '8px', color: 'var(--text-primary)' }}>
                        ${order.totalEstimado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </div>
                    }
                    expandedContent={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        <h4 style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>Detalle de Ítems:</h4>
                        {order.items.map((it, idx) => {
                          const prod = products.find(p => p.id === it.productId);
                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                              <span>{prod?.nombre} x {it.cantidad} {it.unidad}</span>
                              <strong>${it.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                            </div>
                          );
                        })}
                        {order.observaciones && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', fontStyle: 'italic' }}>
                            Observaciones: {order.observaciones}
                          </div>
                        )}
                      </div>
                    }
                    actions={
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        {order.status === 'PRODUCIDO' && (
                          <button 
                            className="btn-secondary" 
                            style={{ flex: 1, padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                            onClick={(e) => { e.stopPropagation(); markOrderAsDelivered(order.id); }}
                          >
                            <Check size={16} /> Entregado
                          </button>
                        )}
                        <button 
                          className="btn-primary" 
                          style={{ flex: 1, padding: '10px' }} 
                          disabled={order.status === 'PRODUCIDO'}
                          title={order.status === 'PRODUCIDO' ? 'Debe marcar el pedido como Entregado antes de generar el remito' : 'Generar Remito'}
                          onClick={(e) => { e.stopPropagation(); handleOpenFacturar(order); }}
                        >
                          Generar Remito
                        </button>
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Filters Bar */}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginBottom: '24px',
            alignItems: 'center'
          }}>
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '280px', maxWidth: '400px' }}>
              <Search size={18} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)'
              }} />
              <input 
                type="text" 
                placeholder="Buscar por cliente o ID de remito..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  outline: 'none',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          {/* List of Issued Remitos */}
          {filteredSales.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '48px',
              background: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              color: 'var(--text-secondary)'
            }}>
              No se encontraron remitos emitidos.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredSales.map(sale => {
                const customer = customers.find(c => c.id === sale.customerId);
                return (
                  <ExpandableCard
                    key={sale.id}
                    title={customer?.nombre || 'Cliente Desconocido'}
                    subtitle={`Remito Comercial N° ${sale.id.slice(-8).toUpperCase()} • ${new Date(sale.date).toLocaleDateString()}`}
                    statusBadge={
                      <span style={{ 
                        backgroundColor: STATUS_COLORS[sale.status] + '20',
                        color: STATUS_COLORS[sale.status],
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '12px'
                      }}>
                        {sale.status} {sale.status === 'COBRADO' && `(${sale.paymentMethod})`}
                      </span>
                    }
                    collapsedContent={
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Monto Total</span>
                        <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          ${sale.totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    }
                    expandedContent={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                        {customer?.razonSocial && (
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            Razón Social: <strong>{customer.razonSocial}</strong> • CUIT: <strong>{customer.cuit}</strong>
                          </div>
                        )}
                        <h4 style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '8px 0 4px 0' }}>Detalle de ítems trasladados:</h4>
                        {sale.items.map((it, idx) => {
                          const prod = products.find(p => p.id === it.productId);
                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                              <span>{prod?.nombre} x {it.cantidad} {it.unidad}</span>
                              <strong>${it.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                            </div>
                          );
                        })}
                      </div>
                    }
                    actions={
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <button 
                          className="btn-primary" 
                          style={{ flex: 1, padding: '8px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }} 
                          onClick={(e) => { e.stopPropagation(); generateInvoicePDF(sale, customer, products); }}
                        >
                          <Printer size={16} /> Descargar Remito (PDF)
                        </button>
                        {sale.status === 'FACTURADO' && (
                          <button 
                            className="btn-secondary" 
                            style={{ flex: 1, padding: '8px 12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }} 
                            onClick={(e) => { e.stopPropagation(); handleCobrar(sale); }}
                          >
                            <DollarSign size={16} /> Registrar Cobro
                          </button>
                        )}
                        {sale.status !== 'ANULADO' && (
                          <button 
                            className="btn-secondary" 
                            style={{ flex: 1, padding: '8px 12px', color: 'var(--alvacio-red)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }} 
                            onClick={(e) => { 
                              e.stopPropagation();
                              if (confirm('¿Anular este remito de entrega? Se generarán los movimientos compensatorios correspondientes en stock y finanzas.')) {
                                anularSale(sale);
                              }
                            }}
                          >
                            <XCircle size={16} /> Anular
                          </button>
                        )}
                        {sale.status === 'ANULADO' && (
                          <button 
                            className="btn-secondary" 
                            style={{ flex: 1, padding: '8px 12px', color: 'var(--alvacio-red)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }} 
                            onClick={(e) => { 
                              e.stopPropagation();
                              if (confirm('¿Eliminar definitivamente este remito del registro?')) {
                                deleteSale(sale);
                              }
                            }}
                          >
                            <XCircle size={16} /> Eliminar
                          </button>
                        )}
                      </div>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Slide-out Right Panel for Billing details */}
      <RightPanel 
        isOpen={showFacturarPanel} 
        onClose={() => { setShowFacturarPanel(false); setSelectedOrder(null); }} 
        title="Generar Remito Comercial"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', color: 'var(--text-primary)' }}>Cliente</h3>
            <div style={{
              background: 'rgba(0, 0, 0, 0.02)',
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <strong>{customers.find(c => c.id === selectedOrder?.customerId)?.nombre || 'Desconocido'}</strong>
              {customers.find(c => c.id === selectedOrder?.customerId)?.razonSocial && (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Razon Social: {customers.find(c => c.id === selectedOrder?.customerId)?.razonSocial}
                  <br />CUIT: {customers.find(c => c.id === selectedOrder?.customerId)?.cuit}
                </div>
              )}
            </div>
          </div>

          <div style={{
            backgroundColor: 'rgba(196, 49, 38, 0.04)',
            border: '1px solid rgba(196, 49, 38, 0.2)',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '13px',
            color: 'var(--text-primary)'
          }}>
            Se generará un <strong>Remito de Entrega (R)</strong> formal que detalla el traslado de la mercadería y el total acordado para la firma del cliente al recibir.
          </div>

          {/* Edit quantities & prices */}
          <div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', color: 'var(--text-primary)' }}>Detalle de Mercadería a Remitir</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {saleItems.map((item, idx) => {
                const prod = products.find(p => p.id === item.productId);
                return (
                  <div 
                    key={idx} 
                    style={{
                      background: '#ffffff',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13.5px', marginBottom: '8px' }}>
                      {prod?.nombre || 'Producto desconocido'} ({item.unidad})
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Cantidad</label>
                        <input 
                          type="number" 
                          step="0.1" 
                          value={item.cantidad} 
                          onChange={e => handleUpdateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)} 
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', outline: 'none' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Precio Unit. ($)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={item.precioUnitario} 
                          onChange={e => handleUpdateItem(idx, 'precioUnitario', parseFloat(e.target.value) || 0)} 
                          style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', outline: 'none' }}
                        />
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'right', marginTop: '8px', fontSize: '13px', fontWeight: 600 }}>
                      Subtotal: ${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals & Submit */}
          <div style={{
            marginTop: '16px',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Monto Total del Remito:</span>
              <strong style={{ fontSize: '20px', color: 'var(--alvacio-red)' }}>
                ${totalFacturar.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </strong>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ flex: 1, padding: '10px' }} 
                onClick={() => { setShowFacturarPanel(false); setSelectedOrder(null); }}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ flex: 1, padding: '10px' }} 
                onClick={handleSubmitSale}
              >
                Generar Remito
              </button>
            </div>
          </div>
        </div>
      </RightPanel>

      {/* Custom Premium Option Modal for Cobro */}
      <Modal 
        isOpen={saleToCobrar !== null} 
        onClose={() => setSaleToCobrar(null)} 
        title="Registrar Cobro de Remito"
      >
        {saleToCobrar && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Seleccione el método de cobro para el remito de{' '}
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
