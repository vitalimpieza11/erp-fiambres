import { useState, useEffect } from 'react';
import { useClientes } from './useClientes';
import { useProductsStore } from '../../store/productsStore';
import type { Customer, CustomerMovement } from '../../types/domain';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import { User, Phone, MapPin, Mail, DollarSign, Plus, Eye, FileText, Check, X, Ban, PlusCircle, AlertCircle, Edit } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { formatCurrency, formatDate } from '../../lib/formatters';
import LoadingSpinner from '../../components/LoadingSpinner';
import FilterBar from '../../components/FilterBar';
import { createAlvacioPDF } from '../../lib/pdfHelper';


export default function Clientes() {
  const {
    customers,
    movements,
    loading: loadingClientes,
    getCustomerBalance,
    getProductPriceForCustomer,
    getCustomerMovements,
    getCustomerOrders,
    getCustomerSales,
    saveCustomer,
    toggleCustomerStatus,
    registerPago,
    registerAjuste,
    annulMovement
  } = useClientes();

  const { productos, fetchProductos, loading: loadingProducts } = useProductsStore();

  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [activeTabs, setActiveTabs] = useState<Record<string, 'cc' | 'precios' | 'pedidos'>>({});

  // RightPanel states
  const [panelMode, setPanelMode] = useState<'NEW_CUSTOMER' | 'EDIT_CUSTOMER' | 'PAGO' | 'AJUSTE' | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Customer Form states
  const [customerName, setCustomerName] = useState('');
  const [customerRazonSocial, setCustomerRazonSocial] = useState('');
  const [customerCuit, setCustomerCuit] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerTelefono, setCustomerTelefono] = useState('');
  const [customerDireccion, setCustomerDireccion] = useState('');
  const [customerObservaciones, setCustomerObservaciones] = useState('');
  const [customerActivo, setCustomerActivo] = useState(true);

  // Payment/Adjustment states
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sourceId, setSourceId] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [fromCaja, setFromCaja] = useState<boolean>(true);

  const handleOpenNewCustomer = () => {
    setPanelMode('NEW_CUSTOMER');
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerRazonSocial('');
    setCustomerCuit('');
    setCustomerEmail('');
    setCustomerTelefono('');
    setCustomerDireccion('');
    setCustomerObservaciones('');
    setCustomerActivo(true);
  };

  const handleOpenEditCustomer = (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    setPanelMode('EDIT_CUSTOMER');
    setSelectedCustomerId(customer.id);
    setCustomerName(customer.nombre);
    setCustomerRazonSocial(customer.razonSocial || '');
    setCustomerCuit(customer.cuit || '');
    setCustomerEmail(customer.email || '');
    setCustomerTelefono(customer.telefono || '');
    setCustomerDireccion(customer.direccion || '');
    setCustomerObservaciones(customer.observaciones || '');
    setCustomerActivo(customer.activo);
  };

  const handleOpenPago = (customerId: string) => {
    setPanelMode('PAGO');
    setSelectedCustomerId(customerId);
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setSourceId('');
    setObservaciones('');
    setFromCaja(true);
  };

  const handleOpenAjuste = (customerId: string) => {
    setPanelMode('AJUSTE');
    setSelectedCustomerId(customerId);
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setObservaciones('');
  };

  const handleClosePanel = () => {
    setPanelMode(null);
    setSelectedCustomerId('');
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert("El nombre es requerido.");
      return;
    }

    try {
      const customerData: Partial<Customer> = {
        nombre: customerName,
        razonSocial: customerRazonSocial,
        cuit: customerCuit,
        email: customerEmail,
        telefono: customerTelefono,
        direccion: customerDireccion,
        observaciones: customerObservaciones,
        activo: customerActivo,
      };

      if (selectedCustomerId) {
        customerData.id = selectedCustomerId;
      }

      await saveCustomer(customerData);
      handleClosePanel();
    } catch (error) {
      console.error("Error al guardar cliente:", error);
      alert("Ocurrió un error al guardar el cliente.");
    }
  };

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || typeof amount !== 'number' || amount === 0) {
      alert("Ingrese un monto válido.");
      return;
    }

    try {
      if (panelMode === 'PAGO') {
        await registerPago(selectedCustomerId, amount, date, sourceId, observaciones, fromCaja);
      } else if (panelMode === 'AJUSTE') {
        await registerAjuste(selectedCustomerId, amount, date, observaciones);
      }
      handleClosePanel();
    } catch (error) {
      console.error("Error registrando transacción:", error);
      alert("Error: " + (error instanceof Error ? error.message : "No se pudo completar la operación."));
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    try {
      await toggleCustomerStatus(customer.id, customer.activo);
    } catch (error) {
      console.error("Error al cambiar estado:", error);
    }
  };

  const handleAnnul = async (mov: CustomerMovement) => {
    const reason = prompt("Ingrese el motivo de anulación del movimiento:");
    if (!reason || !reason.trim()) return;

    try {
      await annulMovement(mov.id, reason);
    } catch (error) {
      console.error("Error al anular movimiento:", error);
      alert("No se pudo anular el movimiento. " + (error instanceof Error ? error.message : ''));
    }
  };

  const generatePDFList = (customer: Customer) => {
    const doc = createAlvacioPDF('LISTA DE PRECIOS EXCLUSIVA');

    doc.setFontSize(9);
    doc.text(`Emisión: ${new Date().toLocaleDateString()}`, 15, 42);

    // Client section card
    doc.rect(15, 46, 180, 24);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text('INFORMACIÓN DEL CLIENTE:', 20, 52);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Cliente: ${customer.nombre}`, 20, 59);
    doc.text(`CUIT: ${customer.cuit || 'Sin CUIT'}`, 20, 64);
    doc.text(`Razón Social: ${customer.razonSocial || 'Sin Razón Social'}`, 110, 59);
    doc.text(`Dirección: ${customer.direccion || 'Sin dirección registrada'}`, 110, 64);

    // Resolve prices
    // Filter out only finished products or active items that customers buy
    const listProducts = productos.filter(p => p.activo && (p.type === 'PRESENTACION' || p.type === 'MERCADERIA'));
    const tableRows = listProducts.map(p => {
      const price = getProductPriceForCustomer(customer.id, p.id, p.precioComercial || p.precioSugerido || 0);
      return [
        p.nombre,
        p.type === 'PRESENTACION' ? 'Terminado' : 'Mercadería',
        p.unitType,
        formatCurrency(price)
      ];
    });

    autoTable(doc, {
      startY: 75,
      head: [['Producto', 'Tipo', 'Unidad de Venta', 'Precio Comercial']],
      body: tableRows,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3, textColor: [50, 50, 50] },
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [252, 252, 252] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 75;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Documento comercial no válido como factura. Los precios están sujetos a modificaciones.', 15, finalY + 12);

    doc.save(`Precios_${customer.nombre.replace(/\s+/g, '_')}.pdf`);
  };

  // Filter clients
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = 
      c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.cuit && c.cuit.includes(searchTerm)) ||
      (c.razonSocial && c.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (statusFilter === 'active') return matchesSearch && c.activo;
    if (statusFilter === 'inactive') return matchesSearch && !c.activo;
    return matchesSearch;
  });

  const getActiveTab = (customerId: string) => activeTabs[customerId] || 'cc';
  
  const setActiveTab = (customerId: string, tab: 'cc' | 'precios' | 'pedidos') => {
    setActiveTabs(prev => ({ ...prev, [customerId]: tab }));
  };

  const isGlobalLoading = loadingClientes || loadingProducts;

  if (isGlobalLoading && customers.length === 0) {
    return <LoadingSpinner message="Cargando información de clientes..." />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Clientes</h1>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleOpenNewCustomer}>
          <Plus size={18} /> Nuevo Cliente
        </button>
      </div>

      <FilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar por nombre, razón social o CUIT..."
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* Grid containing customers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
        {filteredCustomers.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>No se encontraron clientes.</p>
        ) : (
          filteredCustomers.map(customer => {
            const saldo = getCustomerBalance(customer.id);
            const clientMovs = getCustomerMovements(customer.id);
            const clientOrders = getCustomerOrders(customer.id);
            const clientSales = getCustomerSales(customer.id);
            const currentTab = getActiveTab(customer.id);

            return (
              <ExpandableCard
                key={customer.id}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span>{customer.nombre}</span>
                    <button 
                      type="button" 
                      onClick={(e) => handleOpenEditCustomer(e, customer)}
                      style={{ background: 'transparent', padding: '4px', color: 'var(--text-secondary)', borderRadius: '50%' }}
                      title="Editar Cliente"
                    >
                      <Edit size={14} />
                    </button>
                  </div>
                }
                subtitle={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                    {customer.razonSocial && <span>Razón Social: {customer.razonSocial}</span>}
                    <span>CUIT: {customer.cuit || 'S/D'}</span>
                  </div>
                }
                statusBadge={
                  <span 
                    onClick={(e) => handleToggleStatus(e, customer)}
                    style={{ 
                      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', cursor: 'pointer',
                      backgroundColor: customer.activo ? '#dcfce7' : '#fee2e2',
                      color: customer.activo ? '#16a34a' : '#ef4444'
                    }}
                    title="Haga clic para cambiar estado"
                  >
                    {customer.activo ? 'Activo' : 'Inactivo'}
                  </span>
                }
                collapsedContent={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Saldo Cuenta Corriente:</span>
                    <strong style={{ fontSize: '18px', color: saldo > 0 ? '#dc2626' : (saldo < 0 ? '#16a34a' : 'inherit') }}>
                      {formatCurrency(saldo)}
                    </strong>
                  </div>
                }
                expandedContent={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Customer contact info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', backgroundColor: '#f9fafb', padding: '12px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={14} /> {customer.telefono || '-'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={14} /> {customer.email || '-'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', gridColumn: 'span 2' }}><MapPin size={14} /> {customer.direccion || '-'}</div>
                      {customer.observaciones && <div style={{ gridColumn: 'span 2', fontStyle: 'italic', marginTop: '4px' }}>Obs: {customer.observaciones}</div>}
                    </div>

                    {/* Sub-tabs inside expanded card */}
                    <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
                      <button 
                        type="button"
                        onClick={() => setActiveTab(customer.id, 'cc')}
                        style={{
                          flex: 1, padding: '8px 0', fontSize: '12px', backgroundColor: 'transparent',
                          color: currentTab === 'cc' ? 'var(--alvacio-red)' : 'var(--text-secondary)',
                          borderBottom: currentTab === 'cc' ? '2px solid var(--alvacio-red)' : 'none',
                          borderRadius: 0
                        }}
                      >
                        Cuenta Corriente
                      </button>
                      <button 
                        type="button"
                        onClick={() => setActiveTab(customer.id, 'precios')}
                        style={{
                          flex: 1, padding: '8px 0', fontSize: '12px', backgroundColor: 'transparent',
                          color: currentTab === 'precios' ? 'var(--alvacio-red)' : 'var(--text-secondary)',
                          borderBottom: currentTab === 'precios' ? '2px solid var(--alvacio-red)' : 'none',
                          borderRadius: 0
                        }}
                      >
                        Lista Precios
                      </button>
                      <button 
                        type="button"
                        onClick={() => setActiveTab(customer.id, 'pedidos')}
                        style={{
                          flex: 1, padding: '8px 0', fontSize: '12px', backgroundColor: 'transparent',
                          color: currentTab === 'pedidos' ? 'var(--alvacio-red)' : 'var(--text-secondary)',
                          borderBottom: currentTab === 'pedidos' ? '2px solid var(--alvacio-red)' : 'none',
                          borderRadius: 0
                        }}
                      >
                        Historial Pedidos/Ventas
                      </button>
                    </div>

                    {/* Tab CC */}
                    {currentTab === 'cc' && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>Movimientos Recientes</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '6px 12px', fontSize: '12px', color: '#16a34a' }}
                              onClick={() => handleOpenPago(customer.id)}
                            >
                              + Pago
                            </button>
                            <button 
                              className="btn-secondary" 
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                              onClick={() => handleOpenAjuste(customer.id)}
                            >
                              + Ajuste
                            </button>
                          </div>
                        </div>

                        {clientMovs.length === 0 ? (
                          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>No se registran movimientos en la cuenta corriente.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                            {clientMovs.map(mov => {
                              const isCompensated = mov.observaciones?.includes('ANULADO') || mov.observaciones?.includes('Compensación por anulación');
                              return (
                                <div key={mov.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid #f3f4f6', opacity: isCompensated ? 0.6 : 1 }}>
                                  <div>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                      <span style={{
                                        fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px',
                                        backgroundColor: mov.type === 'DEUDA' ? '#fee2e2' : (mov.type === 'PAGO' ? '#dcfce7' : '#f3f4f6'),
                                        color: mov.type === 'DEUDA' ? '#dc2626' : (mov.type === 'PAGO' ? '#16a34a' : '#4b5563')
                                      }}>
                                        {mov.type}
                                      </span>
                                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatDate(mov.date)}</span>
                                    </div>
                                    {mov.observaciones && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{mov.observaciones}</div>}
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{formatCurrency(mov.amount)}</div>
                                    {!isCompensated && (
                                      <button 
                                        type="button" 
                                        onClick={() => handleAnnul(mov)}
                                        style={{ background: 'transparent', padding: 0, fontSize: '10px', color: '#ef4444', textDecoration: 'underline' }}
                                      >
                                        Anular
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab Precios */}
                    {currentTab === 'precios' && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>Precios Vigentes</span>
                          <button 
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => generatePDFList(customer)}
                          >
                            <FileText size={14} /> Exportar Lista PDF
                          </button>
                        </div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #f3f4f6', borderRadius: '12px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                                <th style={{ padding: '8px' }}>Producto</th>
                                <th style={{ padding: '8px' }}>Unidad</th>
                                <th style={{ padding: '8px', textAlign: 'right' }}>Precio</th>
                              </tr>
                            </thead>
                            <tbody>
                              {productos.filter(p => p.activo && (p.type === 'PRESENTACION' || p.type === 'MERCADERIA')).map(p => {
                                const price = getProductPriceForCustomer(customer.id, p.id, p.precioComercial || p.precioSugerido || 0);
                                return (
                                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '8px' }}>{p.nombre}</td>
                                    <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{p.unitType}</td>
                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(price)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Tab Pedidos */}
                    {currentTab === 'pedidos' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                          <h5 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Pedidos de Venta</h5>
                          {clientOrders.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>No hay pedidos registrados para este cliente.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                              {clientOrders.map(o => (
                                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', borderBottom: '1px solid #f3f4f6', fontSize: '11px' }}>
                                  <div>
                                    <span style={{ fontWeight: 600 }}>{formatDate(o.fecha)}</span>
                                    <span style={{ marginLeft: '8px', padding: '1px 6px', borderRadius: '8px', fontSize: '9px', backgroundColor: '#e5e7eb', fontWeight: 600 }}>{o.status}</span>
                                  </div>
                                  <div style={{ fontWeight: 600 }}>{formatCurrency(o.totalEstimado)}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div>
                          <h5 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Facturaciones / Ventas</h5>
                          {clientSales.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>No hay facturaciones registradas para este cliente.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '120px', overflowY: 'auto' }}>
                              {clientSales.map(s => (
                                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px', borderBottom: '1px solid #f3f4f6', fontSize: '11px' }}>
                                  <div>
                                    <span style={{ fontWeight: 600 }}>{formatDate(s.date)}</span>
                                    <span style={{ marginLeft: '8px', padding: '1px 6px', borderRadius: '8px', fontSize: '9px', backgroundColor: '#dcfce7', color: '#16a34a', fontWeight: 600 }}>{s.status}</span>
                                  </div>
                                  <div style={{ fontWeight: 600 }}>{formatCurrency(s.totalAmount)}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                }
              />
            );
          })
        )}
      </div>

      {/* RightPanel drawer for adding/editing customers and payments */}
      <RightPanel 
        isOpen={panelMode !== null} 
        onClose={handleClosePanel} 
        title={
          panelMode === 'NEW_CUSTOMER' ? 'Nuevo Cliente' : 
          panelMode === 'EDIT_CUSTOMER' ? 'Editar Cliente' :
          panelMode === 'PAGO' ? 'Registrar Pago' :
          'Registrar Ajuste de Saldo'
        }
      >
        {(panelMode === 'NEW_CUSTOMER' || panelMode === 'EDIT_CUSTOMER') ? (
          <form onSubmit={handleCustomerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Nombre Comercial / Cliente *</label>
              <input 
                type="text" 
                required 
                placeholder="Ej. Fiambrería El Sol"
                value={customerName} 
                onChange={e => setCustomerName(e.target.value)} 
              />
            </div>
            
            <div className="form-group">
              <label>Razón Social</label>
              <input 
                type="text" 
                placeholder="Ej. El Sol S.H."
                value={customerRazonSocial} 
                onChange={e => setCustomerRazonSocial(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>CUIT</label>
              <input 
                type="text" 
                placeholder="20-12345678-9"
                value={customerCuit} 
                onChange={e => setCustomerCuit(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>Teléfono</label>
              <input 
                type="text" 
                placeholder="Ej. +54 9 11 1234-5678"
                value={customerTelefono} 
                onChange={e => setCustomerTelefono(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>Correo Electrónico</label>
              <input 
                type="email" 
                placeholder="cliente@correo.com"
                value={customerEmail} 
                onChange={e => setCustomerEmail(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>Dirección</label>
              <input 
                type="text" 
                placeholder="Av. Cabildo 1500, CABA"
                value={customerDireccion} 
                onChange={e => setCustomerDireccion(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>Observaciones</label>
              <textarea 
                placeholder="Detalles adicionales, horarios de entrega..."
                value={customerObservaciones} 
                onChange={e => setCustomerObservaciones(e.target.value)} 
                rows={3}
              />
            </div>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
              <input 
                type="checkbox" 
                checked={customerActivo} 
                onChange={e => setCustomerActivo(e.target.checked)} 
                id="customerActivoCheckbox"
                style={{ width: 'auto' }}
              />
              <label htmlFor="customerActivoCheckbox" style={{ margin: 0 }}>
                Cliente Activo
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={handleClosePanel}>Cancelar</button>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Guardar</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleTransactionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Fecha</label>
              <input 
                type="date" 
                required 
                value={date} 
                onChange={e => setDate(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>Monto</label>
              <input 
                type="number" 
                step="0.01" 
                required 
                placeholder="0.00"
                value={amount} 
                onChange={e => setAmount(Number(e.target.value))} 
              />
              {panelMode === 'AJUSTE' && (
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Positivo aumenta deuda, Negativo reduce deuda.</span>
              )}
            </div>

            {panelMode === 'PAGO' && (
              <>
                <div className="form-group">
                  <label>Referencia / N° Recibo</label>
                  <input 
                    type="text" 
                    placeholder="Ej. Recibo 0001-000453"
                    value={sourceId} 
                    onChange={e => setSourceId(e.target.value)} 
                  />
                </div>

                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="checkbox" 
                    checked={fromCaja} 
                    onChange={e => setFromCaja(e.target.checked)} 
                    id="fromCajaPaymentCheckbox"
                    style={{ width: 'auto' }}
                  />
                  <label htmlFor="fromCajaPaymentCheckbox" style={{ margin: 0 }}>
                    Registrar ingreso en Caja Diaria
                  </label>
                </div>
              </>
            )}

            <div className="form-group">
              <label>Observaciones</label>
              <textarea 
                required={panelMode === 'AJUSTE'}
                placeholder="Ingrese detalles de la operación..."
                value={observaciones} 
                onChange={e => setObservaciones(e.target.value)} 
                rows={3}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={handleClosePanel}>Cancelar</button>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Confirmar</button>
            </div>
          </form>
        )}
      </RightPanel>
    </div>
  );
}
