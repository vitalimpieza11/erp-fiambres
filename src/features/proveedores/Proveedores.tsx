import { useState } from 'react';
import { useProveedores } from './useProveedores';
import type { Supplier, SupplierMovement } from '../../types/domain';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import { Truck, DollarSign, Activity, FileText, Plus, Edit, Phone, Mail, MapPin, Check, X } from 'lucide-react';

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

const formatDate = (dateStr: any) => {
  if (!dateStr) return 'S/D';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 'S/D' : d.toLocaleDateString();
};

export default function Proveedores() {
  const {
    suppliers,
    movements,
    loading,
    registerCompra,
    registerPago,
    registerAjuste,
    annulMovement,
    getCalculatedBalance,
    saveSupplier,
    toggleSupplierStatus
  } = useProveedores();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  
  const [showPanel, setShowPanel] = useState<false | 'COMPRA' | 'PAGO' | 'AJUSTE' | 'NEW_SUPPLIER' | 'EDIT_SUPPLIER'>(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  
  // Supplier Form states
  const [supplierName, setSupplierName] = useState('');
  const [supplierRazonSocial, setSupplierRazonSocial] = useState('');
  const [supplierCuit, setSupplierCuit] = useState('');
  const [supplierTelefono, setSupplierTelefono] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierDireccion, setSupplierDireccion] = useState('');
  const [supplierObservaciones, setSupplierObservaciones] = useState('');
  const [supplierActivo, setSupplierActivo] = useState(true);

  // CC Movement Form states
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sourceId, setSourceId] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [fromCaja, setFromCaja] = useState<boolean>(true);

  const handleOpenTransactionPanel = (supplierId: string, type: 'COMPRA' | 'PAGO' | 'AJUSTE') => {
    setSelectedSupplierId(supplierId);
    setShowPanel(type);
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setSourceId('');
    setObservaciones('');
    setFromCaja(true);
  };

  const handleOpenNewSupplier = () => {
    setShowPanel('NEW_SUPPLIER');
    setSelectedSupplierId('');
    setSupplierName('');
    setSupplierRazonSocial('');
    setSupplierCuit('');
    setSupplierTelefono('');
    setSupplierEmail('');
    setSupplierDireccion('');
    setSupplierObservaciones('');
    setSupplierActivo(true);
  };

  const handleOpenEditSupplier = (e: React.MouseEvent, supplier: Supplier) => {
    e.stopPropagation();
    setShowPanel('EDIT_SUPPLIER');
    setSelectedSupplierId(supplier.id);
    setSupplierName(supplier.nombre);
    setSupplierRazonSocial(supplier.razonSocial || '');
    setSupplierCuit(supplier.cuit || '');
    setSupplierTelefono(supplier.telefono || '');
    setSupplierEmail(supplier.email || '');
    setSupplierDireccion(supplier.direccion || '');
    setSupplierObservaciones(supplier.observaciones || '');
    setSupplierActivo(supplier.activo);
  };

  const handleClosePanel = () => {
    setShowPanel(false);
    setSelectedSupplierId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (showPanel === 'NEW_SUPPLIER' || showPanel === 'EDIT_SUPPLIER') {
      if (!supplierName.trim()) {
        alert("El nombre comercial es obligatorio.");
        return;
      }
      try {
        const supplierData: Partial<Supplier> = {
          nombre: supplierName,
          razonSocial: supplierRazonSocial,
          cuit: supplierCuit,
          telefono: supplierTelefono,
          email: supplierEmail,
          direccion: supplierDireccion,
          observaciones: supplierObservaciones,
          activo: supplierActivo
        };
        if (selectedSupplierId) {
          supplierData.id = selectedSupplierId;
        }
        await saveSupplier(supplierData);
        handleClosePanel();
      } catch (error) {
        console.error("Error al guardar proveedor:", error);
        alert("No se pudo guardar el proveedor.");
      }
      return;
    }

    if (!amount || typeof amount !== 'number') return;

    try {
      if (showPanel === 'COMPRA') {
        await registerCompra(selectedSupplierId, amount, date, sourceId, observaciones);
      } else if (showPanel === 'PAGO') {
        await registerPago(selectedSupplierId, amount, date, sourceId, observaciones, fromCaja);
      } else if (showPanel === 'AJUSTE') {
        await registerAjuste(selectedSupplierId, amount, date, observaciones);
      }
      handleClosePanel();
    } catch (error) {
      console.error("Error registrando movimiento:", error);
      alert("Error al registrar movimiento.");
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent, supplier: Supplier) => {
    e.stopPropagation();
    try {
      await toggleSupplierStatus(supplier.id, supplier.activo);
    } catch (error) {
      console.error("Error al cambiar estado de proveedor:", error);
    }
  };

  const handleAnnul = async (movId: string) => {
    const reason = prompt("Ingrese el motivo de anulación:");
    if (!reason || !reason.trim()) return;
    
    try {
      await annulMovement(movId, reason);
    } catch (error) {
      console.error("Error al anular:", error);
      alert("No se pudo anular el movimiento.");
    }
  };

  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = 
      s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.cuit && s.cuit.includes(searchTerm)) ||
      (s.razonSocial && s.razonSocial.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (statusFilter === 'active') return matchesSearch && s.activo;
    if (statusFilter === 'inactive') return matchesSearch && !s.activo;
    return matchesSearch;
  });

  if (loading && suppliers.length === 0) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando proveedores...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Proveedores</h1>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleOpenNewSupplier}>
          <Plus size={18} /> Nuevo Proveedor
        </button>
      </div>

      {/* Top filters */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <input 
          type="text" 
          placeholder="Buscar proveedor por nombre, razón social o CUIT..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: '280px', maxWidth: '400px' }}
        />

        <div style={{ display: 'flex', gap: '4px', background: '#e5e7eb', padding: '4px', borderRadius: '12px' }}>
          <button 
            type="button" 
            onClick={() => setStatusFilter('active')}
            style={{
              padding: '8px 16px', fontSize: '13px', borderRadius: '10px',
              backgroundColor: statusFilter === 'active' ? '#fff' : 'transparent',
              color: statusFilter === 'active' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: statusFilter === 'active' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Activos
          </button>
          <button 
            type="button" 
            onClick={() => setStatusFilter('inactive')}
            style={{
              padding: '8px 16px', fontSize: '13px', borderRadius: '10px',
              backgroundColor: statusFilter === 'inactive' ? '#fff' : 'transparent',
              color: statusFilter === 'inactive' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: statusFilter === 'inactive' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Inactivos
          </button>
          <button 
            type="button" 
            onClick={() => setStatusFilter('all')}
            style={{
              padding: '8px 16px', fontSize: '13px', borderRadius: '10px',
              backgroundColor: statusFilter === 'all' ? '#fff' : 'transparent',
              color: statusFilter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: statusFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Todos
          </button>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
        {filteredSuppliers.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>No se encontraron proveedores.</p>
        ) : (
          filteredSuppliers.map(supplier => {
            const saldo = getCalculatedBalance(supplier.id);
            const suppMovs = movements
              .filter(m => m.supplierId === supplier.id)
              .sort((a, b) => {
                const tA = a.date ? new Date(a.date).getTime() : 0;
                const tB = b.date ? new Date(b.date).getTime() : 0;
                return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
              });
            
            return (
              <ExpandableCard
                key={supplier.id}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>{supplier.nombre}</span>
                    <button 
                      type="button" 
                      onClick={(e) => handleOpenEditSupplier(e, supplier)}
                      style={{ background: 'transparent', padding: '4px', color: 'var(--text-secondary)', borderRadius: '50%' }}
                      title="Editar Proveedor"
                    >
                      <Edit size={14} />
                    </button>
                  </div>
                }
                subtitle={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                    {supplier.razonSocial && <span>Razón Social: {supplier.razonSocial}</span>}
                    <span>CUIT: {supplier.cuit || 'S/N'}</span>
                  </div>
                }
                statusBadge={
                  <span 
                    onClick={(e) => handleToggleStatus(e, supplier)}
                    style={{ 
                      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', cursor: 'pointer',
                      backgroundColor: supplier.activo ? '#dcfce7' : '#fee2e2',
                      color: supplier.activo ? '#16a34a' : '#ef4444'
                    }}
                    title="Haga clic para cambiar estado"
                  >
                    {supplier.activo ? 'Activo' : 'Inactivo'}
                  </span>
                }
                collapsedContent={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Deuda actual:</span>
                    <strong style={{ fontSize: '18px', color: saldo > 0 ? '#dc2626' : (saldo < 0 ? '#16a34a' : 'inherit') }}>
                      {formatCurrency(saldo)}
                    </strong>
                  </div>
                }
                expandedContent={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Contact Info */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', backgroundColor: '#f9fafb', padding: '12px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={14} /> {supplier.telefono || '-'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={14} /> {supplier.email || '-'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', gridColumn: 'span 2' }}><MapPin size={14} /> {supplier.direccion || '-'}</div>
                      {supplier.observaciones && <div style={{ gridColumn: 'span 2', fontStyle: 'italic', marginTop: '4px' }}>Obs: {supplier.observaciones}</div>}
                    </div>

                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Historial de Movimientos</h4>
                    {suppMovs.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>No hay movimientos registrados.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                        {suppMovs.map(mov => {
                          const isCompensated = mov.observaciones?.includes('Anulación de') || mov.observaciones?.includes('compensatorio por anulación') || mov.type === 'ANULACION';
                          return (
                            <div key={mov.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', opacity: isCompensated ? 0.6 : 1 }}>
                              <div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span style={{ 
                                    fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '10px',
                                    backgroundColor: mov.type === 'COMPRA' ? '#fef2f2' : (mov.type === 'PAGO' ? '#dcfce7' : '#f3f4f6'),
                                    color: mov.type === 'COMPRA' ? '#dc2626' : (mov.type === 'PAGO' ? '#16a34a' : '#4b5563')
                                  }}>
                                    {mov.type}
                                  </span>
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatDate(mov.date)}</span>
                                </div>
                                {(mov.observaciones || mov.sourceId) && (
                                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    {mov.sourceId && `Ref: ${mov.sourceId} `}
                                    {mov.observaciones && `Obs: ${mov.observaciones}`}
                                  </div>
                                )}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{formatCurrency(mov.amount)}</div>
                                {!isCompensated && (
                                  <button type="button" onClick={() => handleAnnul(mov.id)} style={{ color: '#ef4444', background: 'transparent', textDecoration: 'underline', fontSize: '10px', padding: 0, marginTop: '2px' }}>Anular</button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                }
                actions={
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', width: '100%' }}>
                    <button className="btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '12px' }} onClick={(e) => { e.stopPropagation(); handleOpenTransactionPanel(supplier.id, 'COMPRA'); }}>
                      + Compra
                    </button>
                    <button className="btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '12px', color: '#16a34a' }} onClick={(e) => { e.stopPropagation(); handleOpenTransactionPanel(supplier.id, 'PAGO'); }}>
                      + Pago
                    </button>
                    <button className="btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '12px' }} onClick={(e) => { e.stopPropagation(); handleOpenTransactionPanel(supplier.id, 'AJUSTE'); }}>
                      + Ajuste
                    </button>
                  </div>
                }
              />
            );
          })
        )}
      </div>

      <RightPanel 
        isOpen={showPanel !== false} 
        onClose={handleClosePanel} 
        title={
          showPanel === 'NEW_SUPPLIER' ? 'Nuevo Proveedor' :
          showPanel === 'EDIT_SUPPLIER' ? 'Editar Proveedor' :
          showPanel === 'COMPRA' ? 'Registrar Compra' : 
          showPanel === 'PAGO' ? 'Registrar Pago' : 
          'Ajuste de Cuenta'
        }
      >
        {(showPanel === 'NEW_SUPPLIER' || showPanel === 'EDIT_SUPPLIER') ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Nombre Comercial / Proveedor *</label>
              <input 
                type="text" 
                required 
                placeholder="Ej. Distribuidora Lacteos S.A."
                value={supplierName} 
                onChange={e => setSupplierName(e.target.value)} 
              />
            </div>
            
            <div className="form-group">
              <label>Razón Social</label>
              <input 
                type="text" 
                placeholder="Ej. Distribuidora Lacteos S.A."
                value={supplierRazonSocial} 
                onChange={e => setSupplierRazonSocial(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>CUIT</label>
              <input 
                type="text" 
                placeholder="30-12345678-9"
                value={supplierCuit} 
                onChange={e => setSupplierCuit(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>Teléfono</label>
              <input 
                type="text" 
                placeholder="Ej. +54 9 11 9876-5432"
                value={supplierTelefono} 
                onChange={e => setSupplierTelefono(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>Correo Electrónico</label>
              <input 
                type="email" 
                placeholder="proveedor@correo.com"
                value={supplierEmail} 
                onChange={e => setSupplierEmail(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>Dirección</label>
              <input 
                type="text" 
                placeholder="Av. General Paz 8000, CABA"
                value={supplierDireccion} 
                onChange={e => setSupplierDireccion(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label>Observaciones</label>
              <textarea 
                placeholder="Detalles adicionales, plazos de entrega, días de visita..."
                value={supplierObservaciones} 
                onChange={e => setSupplierObservaciones(e.target.value)} 
                rows={3}
              />
            </div>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
              <input 
                type="checkbox" 
                checked={supplierActivo} 
                onChange={e => setSupplierActivo(e.target.checked)} 
                id="supplierActivoCheckbox"
                style={{ width: 'auto' }}
              />
              <label htmlFor="supplierActivoCheckbox" style={{ margin: 0 }}>
                Proveedor Activo
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={handleClosePanel}>Cancelar</button>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Guardar</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                value={amount} 
                onChange={e => setAmount(Number(e.target.value))} 
              />
              {showPanel === 'AJUSTE' && (
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Positivo para AUMENTAR deuda, negativo para REDUCIR deuda.</span>
              )}
            </div>
            
            {showPanel !== 'AJUSTE' && (
              <div className="form-group">
                <label>N° Factura / Referencia</label>
                <input 
                  type="text" 
                  value={sourceId} 
                  onChange={e => setSourceId(e.target.value)} 
                />
              </div>
            )}

            {showPanel === 'PAGO' && (
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <input 
                  type="checkbox" 
                  checked={fromCaja} 
                  onChange={e => setFromCaja(e.target.checked)} 
                  id="fromCajaCheckbox"
                  style={{ width: 'auto' }}
                />
                <label htmlFor="fromCajaCheckbox" style={{ margin: 0 }}>
                  Extraer dinero desde Caja Diaria
                </label>
              </div>
            )}

            <div className="form-group">
              <label>Observaciones</label>
              <textarea 
                value={observaciones} 
                onChange={e => setObservaciones(e.target.value)} 
                rows={3}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={handleClosePanel}>Cancelar</button>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Confirmar</button>
            </div>
          </form>
        )}
      </RightPanel>
    </div>
  );
}
