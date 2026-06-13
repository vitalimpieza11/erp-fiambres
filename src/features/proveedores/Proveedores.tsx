import { useState } from 'react';
import { useProveedores } from './useProveedores';
import type { SupplierMovement } from '../../types/domain';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import { Truck, DollarSign, Activity, FileText } from 'lucide-react';

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

export default function Proveedores() {
  const {
    suppliers,
    movements,
    loading,
    registerCompra,
    registerPago,
    registerAjuste,
    annulMovement,
    getCalculatedBalance
  } = useProveedores();

  const [searchTerm, setSearchTerm] = useState('');
  
  const [showPanel, setShowPanel] = useState<false | 'COMPRA' | 'PAGO' | 'AJUSTE'>(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  
  // RightPanel states
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sourceId, setSourceId] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [fromCaja, setFromCaja] = useState<boolean>(true);
  
  const activeSuppliers = suppliers.filter(s => s.activo);

  const filteredSuppliers = activeSuppliers.filter(s => 
    s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.cuit?.includes(searchTerm)
  );

  const handleOpenPanel = (supplierId: string, type: 'COMPRA' | 'PAGO' | 'AJUSTE') => {
    setSelectedSupplierId(supplierId);
    setShowPanel(type);
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setSourceId('');
    setObservaciones('');
    setFromCaja(true);
  };

  const handleClosePanel = () => {
    setShowPanel(false);
    setSelectedSupplierId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleAnnul = async (movId: string) => {
    const reason = prompt("Ingrese el motivo de anulación:");
    if (!reason) return;
    
    try {
      await annulMovement(movId, reason);
    } catch (error) {
      console.error("Error al anular:", error);
      alert("No se pudo anular el movimiento.");
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div><p>Cargando proveedores...</p></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Proveedores</h1>
      </div>

      <div className="search-bar" style={{ marginBottom: '24px' }}>
        <input 
          type="text" 
          placeholder="Buscar proveedor por nombre o CUIT..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', maxWidth: '400px' }}
        />
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
        {filteredSuppliers.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No se encontraron proveedores activos.</p>
        ) : (
          filteredSuppliers.map(supplier => {
            const saldo = getCalculatedBalance(supplier.id);
            const suppMovs = movements.filter(m => m.supplierId === supplier.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            return (
              <ExpandableCard
                key={supplier.id}
                title={supplier.nombre}
                subtitle={`CUIT: ${supplier.cuit || 'S/N'}`}
                collapsedContent={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Deuda actual:</span>
                    <strong style={{ fontSize: '20px', color: saldo > 0 ? '#dc2626' : (saldo < 0 ? '#16a34a' : 'inherit') }}>
                      {formatCurrency(saldo)}
                    </strong>
                  </div>
                }
                expandedContent={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', margin: 0 }}>Historial de Movimientos</h4>
                    {suppMovs.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No hay movimientos registrados.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {suppMovs.map(mov => (
                          <div key={mov.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                            <div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ 
                                  fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px',
                                  backgroundColor: mov.type === 'COMPRA' ? '#fef2f2' : (mov.type === 'PAGO' ? '#dcfce7' : '#f3f4f6'),
                                  color: mov.type === 'COMPRA' ? '#dc2626' : (mov.type === 'PAGO' ? '#16a34a' : '#4b5563')
                                }}>
                                  {mov.type}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(mov.date).toLocaleDateString()}</span>
                              </div>
                              {(mov.observaciones || mov.sourceId) && (
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                  {mov.sourceId && `Ref: ${mov.sourceId} `}
                                  {mov.observaciones && `Obs: ${mov.observaciones}`}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 600, fontSize: '14px' }}>{formatCurrency(mov.amount)}</div>
                              {mov.type !== 'ANULACION' && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleAnnul(mov.id); }} style={{ color: '#ef4444', background: 'transparent', textDecoration: 'underline', fontSize: '11px', padding: 0, marginTop: '4px' }}>Anular</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                }
                actions={
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', width: '100%' }}>
                    <button className="btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '13px' }} onClick={(e) => { e.stopPropagation(); handleOpenPanel(supplier.id, 'COMPRA'); }}>
                      + Compra
                    </button>
                    <button className="btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '13px', color: '#16a34a' }} onClick={(e) => { e.stopPropagation(); handleOpenPanel(supplier.id, 'PAGO'); }}>
                      + Pago
                    </button>
                    <button className="btn-secondary" style={{ flex: 1, padding: '8px', fontSize: '13px' }} onClick={(e) => { e.stopPropagation(); handleOpenPanel(supplier.id, 'AJUSTE'); }}>
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
          showPanel === 'COMPRA' ? 'Registrar Compra' : 
          showPanel === 'PAGO' ? 'Registrar Pago' : 
          'Ajuste de Cuenta'
        }
      >
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
                Extraer dinero desde Caja
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
      </RightPanel>
    </div>
  );
}
