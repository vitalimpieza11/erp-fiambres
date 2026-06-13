import { useState, useMemo } from 'react';
import { usePurchases } from './usePurchases';
import { useProveedores } from '../proveedores/useProveedores';
import { useStock } from '../stock/useStock';
import type { Purchase, PurchaseItem } from '../../types/domain';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import { ShoppingCart, RotateCcw } from 'lucide-react';

export default function Compras() {
  const { purchases, loading: purchasesLoading, addPurchase, annulPurchase } = usePurchases();
  const { suppliers, loading: suppliersLoading } = useProveedores();
  const { products, loading: stockLoading } = useStock();
  
  const loading = purchasesLoading || suppliersLoading || stockLoading;

  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CONTADO' | 'CUENTA_CORRIENTE' | 'MIXTA'>('CONTADO');
  const [montoPagado, setMontoPagado] = useState(0);
  const [impuestos, setImpuestos] = useState(0);

  const handleNewPurchase = () => {
    setSupplierId('');
    setDate(new Date().toISOString().split('T')[0]);
    setItems([]);
    setPaymentMethod('CONTADO');
    setMontoPagado(0);
    setImpuestos(0);
    setIsEditing(true);
  };

  const addItem = () => {
    setItems([
      ...items,
      { productId: '', type: 'MERCADERIA', quantity: 1, unit: 'KG', unitCost: 0, totalCost: 0 }
    ]);
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Automatic calculations
    if (field === 'productId') {
      const prod = products.find(p => p.id === value);
      if (prod) {
        newItems[index].type = prod.type === 'INSUMO' ? 'INSUMO' : 'MERCADERIA';
        newItems[index].unit = prod.unitType;
      }
    }

    if (field === 'quantity' || field === 'unitCost') {
      const q = field === 'quantity' ? Number(value) : newItems[index].quantity;
      const c = field === 'unitCost' ? Number(value) : newItems[index].unitCost;
      newItems[index].totalCost = q * c;
    }

    setItems(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const subtotal = items.reduce((acc, it) => acc + (it.totalCost || 0), 0);
  const total = subtotal + impuestos;

  // Auto-calculate montos based on payment method
  const calcMontoPagado = paymentMethod === 'CONTADO' ? total : (paymentMethod === 'CUENTA_CORRIENTE' ? 0 : montoPagado);
  const calcMontoCuentaCorriente = total - calcMontoPagado;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) return alert("Seleccione un proveedor");
    if (items.length === 0) return alert("Agregue al menos un ítem");
    if (items.some(i => !i.productId || i.quantity <= 0 || i.unitCost <= 0)) {
      return alert("Complete correctamente todos los ítems.");
    }
    if (calcMontoCuentaCorriente < 0) return alert("El monto pagado no puede superar el total.");

    await addPurchase({
      supplierId,
      date,
      items,
      subtotal,
      impuestos,
      total,
      paymentMethod,
      montoPagado: calcMontoPagado,
      montoCuentaCorriente: calcMontoCuentaCorriente,
      type: 'PURCHASE',
      status: 'ACTIVE'
    });
    setIsEditing(false);
  };

  const groupedPurchases = useMemo(() => {
    const groups: Record<string, Purchase[]> = {};
    purchases.forEach(p => {
      if (!groups[p.supplierId]) groups[p.supplierId] = [];
      groups[p.supplierId].push(p);
    });
    return groups;
  }, [purchases]);

  if (loading) return <div className="loading-container"><div className="spinner"></div><p>Cargando módulo de compras...</p></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Compras</h1>
        <button className="btn-primary" onClick={handleNewPurchase}>+ Registrar Compra</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {Object.entries(groupedPurchases).map(([suppId, suppPurchases]) => {
          const supplier = suppliers.find(s => s.id === suppId);
          return (
            <div key={suppId}>
              <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>{supplier?.nombre || 'Proveedor Desconocido'}</span>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 'normal' }}>{suppPurchases.length} compras</span>
              </h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {suppPurchases.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(p => (
                  <ExpandableCard
                    key={p.id}
                    title={p.date}
                    statusBadge={
                      <span style={{ 
                        backgroundColor: p.type === 'PURCHASE_REVERSAL' ? '#fee2e2' : '#dcfce7',
                        color: p.type === 'PURCHASE_REVERSAL' ? '#dc2626' : '#16a34a'
                      }}>
                        {p.type === 'PURCHASE_REVERSAL' ? 'ANULADA' : p.paymentMethod}
                      </span>
                    }
                    collapsedContent={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{p.items.length} ítems</span>
                        <strong style={{ fontSize: '20px', color: 'var(--text-primary)', textDecoration: p.type === 'PURCHASE_REVERSAL' ? 'line-through' : 'none' }}>
                          ${p.total.toFixed(2)}
                        </strong>
                      </div>
                    }
                    expandedContent={
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Detalle:</h4>
                        {p.items.map((it, idx) => {
                          const prod = products.find(pr => pr.id === it.productId);
                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                              <span>{prod?.nombre} x {it.quantity} {it.unit}</span>
                              <strong>${it.totalCost.toFixed(2)}</strong>
                            </div>
                          );
                        })}
                        {(p.impuestos || 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            <span>Impuestos Extra</span>
                            <span>${(p.impuestos || 0).toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    }
                    actions={
                      p.type !== 'PURCHASE_REVERSAL' ? (
                        <button 
                          className="btn-secondary" 
                          style={{ width: '100%', color: '#ef4444', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const reason = prompt('Motivo de anulación:');
                            if (reason) annulPurchase(p.id, reason);
                          }}
                        >
                          <RotateCcw size={16} /> Anular
                        </button>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
        {purchases.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>No hay compras registradas.</p>
        )}
      </div>

      <RightPanel isOpen={isEditing} onClose={() => setIsEditing(false)} title="Registrar Compra">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label>Proveedor</label>
            <select required value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">Seleccione Proveedor</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Fecha</label>
            <input type="date" required value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>Ítems Comprados</h3>
              <button type="button" className="btn-secondary" style={{ padding: '6px 12px' }} onClick={addItem}>+ Agregar</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {items.map((item, idx) => (
                <div key={idx} style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <select required value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)}>
                    <option value="">Seleccione Producto</option>
                    {products.filter(p => p.type === 'MERCADERIA' || p.type === 'INSUMO').map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Cant.</label>
                      <input type="number" required min="0.1" step="0.1" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Costo U.</label>
                      <input type="number" required min="0" step="0.01" value={item.unitCost || ''} onChange={e => updateItem(idx, 'unitCost', e.target.value)} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Total: ${item.totalCost.toFixed(2)}</span>
                    <button type="button" onClick={() => removeItem(idx)} style={{ color: '#ef4444', background: 'transparent', textDecoration: 'underline', fontSize: '13px' }}>Eliminar</button>
                  </div>
                </div>
              ))}
              {items.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>Sin ítems</p>}
            </div>
          </div>

          <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Impuestos Extra ($)</label>
              <input type="number" min="0" step="0.01" value={impuestos || ''} onChange={e => setImpuestos(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Forma de Pago</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)}>
                <option value="CONTADO">Contado (Afecta Caja)</option>
                <option value="CUENTA_CORRIENTE">Cuenta Corriente (Afecta Deuda)</option>
                <option value="MIXTA">Mixta</option>
              </select>
            </div>
            {paymentMethod === 'MIXTA' && (
              <div className="form-group">
                <label>Monto Pagado en Caja ($)</label>
                <input type="number" min="0" max={total} step="0.01" value={montoPagado || ''} onChange={e => setMontoPagado(Number(e.target.value))} />
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '14px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <p style={{ margin: '4px 0' }}>Subtotal: ${subtotal.toFixed(2)}</p>
            <p style={{ margin: '4px 0' }}>Impuestos: ${impuestos.toFixed(2)}</p>
            <h2 style={{ margin: '8px 0', color: 'var(--alvacio-red)', fontSize: '24px' }}>Total: ${total.toFixed(2)}</h2>
            <p style={{ margin: '2px 0', fontSize: '12px' }}>A Caja: ${calcMontoPagado.toFixed(2)}</p>
            <p style={{ margin: '2px 0', fontSize: '12px' }}>A Cuenta Cte: ${calcMontoCuentaCorriente.toFixed(2)}</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsEditing(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>Confirmar Compra</button>
          </div>
        </form>
      </RightPanel>
    </div>
  );
}
