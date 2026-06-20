import { useState, useMemo, useEffect } from 'react';
import { usePurchases } from './usePurchases';
import { useProveedores } from '../proveedores/useProveedores';
import { useStock } from '../stock/useStock';
import { useFinancialAccountsStore } from '../../store/financialAccountsStore';
import { usePeriodFilterStore } from '../../store/periodFilterStore';
import type { Purchase, PurchaseItem } from '../../types/domain';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import { ShoppingCart, RotateCcw } from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';

import LoadingSpinner from '../../components/LoadingSpinner';

export default function Compras() {
  const { purchases, loading: purchasesLoading, addPurchase, annulPurchase } = usePurchases();
  const { suppliers, loading: suppliersLoading } = useProveedores();
  const { products, loading: stockLoading } = useStock();
  const { accounts, fetchAccounts } = useFinancialAccountsStore();
  const { getRanges } = usePeriodFilterStore();
  const { current: currentRange } = getRanges();
  
  const loading = purchasesLoading || suppliersLoading || stockLoading;

  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'CONTADO' | 'CUENTA_CORRIENTE' | 'MIXTA' | 'MULTIPLES'>('CONTADO');
  const [distribuidores, setDistribuidores] = useState<Record<string, number>>({});
  const [montoPagado, setMontoPagado] = useState(0);
  const [impuestos, setImpuestos] = useState(0);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Filtered Purchases by Period
  const periodPurchases = useMemo(() => {
    return purchases.filter(p => {
      const d = new Date(p.date);
      return d >= currentRange.startDate && d <= currentRange.endDate;
    });
  }, [purchases, currentRange]);

  // Period Summary Metrics
  const summaryMetrics = useMemo(() => {
    const activePurchases = periodPurchases.filter(p => p.status === 'ACTIVE' && p.type === 'PURCHASE');
    const totalComprado = activePurchases.reduce((acc, p) => acc + p.total, 0);
    const cantidadCompras = activePurchases.length;
    const proveedoresUtilizados = new Set(activePurchases.map(p => p.supplierId)).size;
    const compraPromedio = cantidadCompras > 0 ? totalComprado / cantidadCompras : 0;
    return {
      totalComprado,
      cantidadCompras,
      proveedoresUtilizados,
      compraPromedio
    };
  }, [periodPurchases]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (accounts.length > 0) {
      const activeCash = accounts.find(a => a.activa && a.tipo === 'EFECTIVO');
      const activeAny = accounts.find(a => a.activa);
      setSelectedAccountId(activeCash?.id || activeAny?.id || '');
    }
  }, [accounts, isEditing]);

  const handleNewPurchase = () => {
    setSupplierId('');
    setDate(new Date().toISOString().split('T')[0]);
    setItems([]);
    setPaymentMethod('CONTADO');
    setMontoPagado(0);
    setImpuestos(0);
    setDistribuidores({});
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

  const sumOfMultiplesCaja = useMemo(() => {
    if (paymentMethod !== 'MULTIPLES') return 0;
    return Object.entries(distribuidores).reduce((acc, [key, val]) => {
      if (key === 'CUENTA_CORRIENTE') return acc;
      return acc + (val || 0);
    }, 0);
  }, [distribuidores, paymentMethod]);

  const sumOfMultiplesTotal = useMemo(() => {
    if (paymentMethod !== 'MULTIPLES') return 0;
    return Object.values(distribuidores).reduce((acc, val) => acc + (val || 0), 0);
  }, [distribuidores, paymentMethod]);

  const isMultiplesValid = paymentMethod !== 'MULTIPLES' || Math.abs(sumOfMultiplesTotal - total) < 0.01;

  // Auto-calculate montos based on payment method
  const calcMontoPagado = paymentMethod === 'CONTADO' ? total : (paymentMethod === 'CUENTA_CORRIENTE' ? 0 : (paymentMethod === 'MIXTA' ? montoPagado : sumOfMultiplesCaja));
  const calcMontoCuentaCorriente = paymentMethod === 'MULTIPLES' ? (distribuidores['CUENTA_CORRIENTE'] || 0) : (total - calcMontoPagado);

  const [showHistorical, setShowHistorical] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) return alert("Seleccione un proveedor");
    if (items.length === 0) return alert("Agregue al menos un ítem");
    if (items.some(i => !i.productId || i.quantity <= 0 || i.unitCost <= 0)) {
      return alert("Complete correctamente todos los ítems.");
    }
    if (paymentMethod === 'MULTIPLES') {
      if (!isMultiplesValid) {
        return alert(`La suma de los pagos ($${sumOfMultiplesTotal.toFixed(2)}) no coincide exactamente con el total de la compra ($${total.toFixed(2)}).`);
      }
    } else {
      if (calcMontoCuentaCorriente < 0) return alert("El monto pagado no puede superar el total.");
      if ((paymentMethod === 'CONTADO' || paymentMethod === 'MIXTA') && !selectedAccountId) {
        return alert("Seleccione una cuenta financiera para registrar el pago.");
      }
    }

    const paymentsList = paymentMethod === 'MULTIPLES'
      ? Object.entries(distribuidores)
          .filter(([key, val]) => key !== 'CUENTA_CORRIENTE' && val > 0)
          .map(([key, val]) => ({ accountId: key, amount: val }))
      : undefined;

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
      payments: paymentsList,
      type: 'PURCHASE',
      status: 'ACTIVE',
      accountId: (paymentMethod === 'CONTADO' || paymentMethod === 'MIXTA') ? selectedAccountId : undefined
    });
    setIsEditing(false);
  };

  const groupedPurchases = useMemo(() => {
    const groups: Record<string, Purchase[]> = {};
    periodPurchases.forEach(p => {
      if (!showHistorical && p.isHistorical) return;
      if (!groups[p.supplierId]) groups[p.supplierId] = [];
      groups[p.supplierId].push(p);
    });
    return groups;
  }, [periodPurchases, showHistorical]);

  if (loading) return <LoadingSpinner message="Cargando módulo de compras..." />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Compras</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
            <input 
              type="checkbox" 
              id="togglePurchasesHistorical" 
              checked={showHistorical} 
              onChange={e => setShowHistorical(e.target.checked)} 
              style={{ width: 'auto' }}
            />
            <label htmlFor="togglePurchasesHistorical" style={{ fontSize: '13.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Mostrar compras históricas de carga inicial
            </label>
          </div>
        </div>
        <button className="btn-primary" onClick={handleNewPurchase}>+ Registrar Compra</button>
      </div>

      {/* Resumen del Período */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        <div className="apple-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Comprado</span>
          <strong style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: '8px' }}>{formatCurrency(summaryMetrics.totalComprado)}</strong>
        </div>
        <div className="apple-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Cantidad de Compras</span>
          <strong style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: '8px' }}>{summaryMetrics.cantidadCompras}</strong>
        </div>
        <div className="apple-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Proveedores Utilizados</span>
          <strong style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: '8px' }}>{summaryMetrics.proveedoresUtilizados}</strong>
        </div>
        <div className="apple-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Compra Promedio</span>
          <strong style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: '8px' }}>{formatCurrency(summaryMetrics.compraPromedio)}</strong>
        </div>
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
              {items.map((item, idx) => {
                const isMercaderia = item.type === 'MERCADERIA';
                const unitLabel = isMercaderia ? 'Kg' : 'Unidades';
                const costLabel = isMercaderia ? 'Costo por Kg ($)' : 'Costo Unitario ($)';
                const qtyLabel = isMercaderia ? 'Cantidad (Kg)' : 'Cantidad (Unidades)';

                return (
                  <div key={idx} style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <select required value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)}>
                      <option value="">Seleccione Producto</option>
                      {products.filter(p => p.type === 'MERCADERIA' || p.type === 'INSUMO').map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} ({p.type})</option>
                      ))}
                    </select>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                          {qtyLabel}
                        </label>
                        <input
                          type="number"
                          required
                          min="0.001"
                          step="0.001"
                          placeholder="0.000"
                          value={item.quantity !== undefined ? item.quantity : ''}
                          onChange={e => updateItem(idx, 'quantity', e.target.value as any)}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                          {costLabel}
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={item.unitCost !== undefined ? item.unitCost : ''}
                          onChange={e => updateItem(idx, 'unitCost', e.target.value as any)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', padding: '8px 12px', background: 'var(--bg-color)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {item.quantity > 0 && item.unitCost > 0
                          ? `${item.quantity} ${unitLabel} × $${item.unitCost.toFixed(2)}`
                          : 'Complete cantidad y costo'}
                      </span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: item.totalCost > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        ${item.totalCost.toFixed(2)}
                      </span>
                    </div>

                    <button type="button" onClick={() => removeItem(idx)} style={{ color: '#ef4444', background: 'transparent', textDecoration: 'underline', fontSize: '13px', alignSelf: 'flex-end' }}>
                      Eliminar
                    </button>
                  </div>
                );
              })}
              {items.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>Sin ítems</p>}
            </div>
          </div>

          <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Impuestos Extra ($)</label>
              <input type="number" min="0" step="0.01" value={impuestos !== undefined ? impuestos : ''} onChange={e => setImpuestos(e.target.value as any)} />
            </div>
            <div className="form-group">
              <label>Forma de Pago</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)}>
                <option value="CONTADO">Contado (Afecta Caja)</option>
                <option value="CUENTA_CORRIENTE">Cuenta Corriente (Afecta Deuda)</option>
                <option value="MIXTA">Mixta</option>
                <option value="MULTIPLES">Distribución Libre / Múltiples Cuentas</option>
              </select>
            </div>
            {(paymentMethod === 'CONTADO' || paymentMethod === 'MIXTA') && (
              <div className="form-group">
                <label>Cuenta de Egreso *</label>
                <select
                  required
                  value={selectedAccountId}
                  onChange={e => setSelectedAccountId(e.target.value)}
                >
                  <option value="">Seleccione cuenta de egreso...</option>
                  {accounts.filter(a => a.activa).map(a => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} ({a.tipo})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {paymentMethod === 'MIXTA' && (
              <div className="form-group">
                <label>Monto Pagado en Caja ($)</label>
                <input type="number" min="0" max={total} step="0.01" value={montoPagado !== undefined ? montoPagado : ''} onChange={e => setMontoPagado(e.target.value as any)} />
              </div>
            )}
            {paymentMethod === 'MULTIPLES' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Distribución de Pagos</h4>
                
                {accounts.filter(a => a.activa).map(a => (
                  <div key={a.id} className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '12px', margin: 0 }}>
                    <label style={{ margin: 0, fontSize: '13px', flex: 1 }}>{a.nombre} ({a.tipo})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      style={{ width: '120px', textAlign: 'right' }}
                      value={distribuidores[a.id] !== undefined ? distribuidores[a.id] : ''}
                      onChange={e => setDistribuidores({ ...distribuidores, [a.id]: e.target.value as any })}
                    />
                  </div>
                ))}
                
                <div className="form-group" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '12px', margin: 0, borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                  <label style={{ margin: 0, fontSize: '13px', fontWeight: 600, flex: 1 }}>Cuenta Corriente (Proveedor)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    style={{ width: '120px', textAlign: 'right' }}
                    value={distribuidores['CUENTA_CORRIENTE'] !== undefined ? distribuidores['CUENTA_CORRIENTE'] : ''}
                    onChange={e => setDistribuidores({ ...distribuidores, 'CUENTA_CORRIENTE': e.target.value as any })}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px', fontSize: '13px', fontWeight: 600, color: isMultiplesValid ? '#16a34a' : '#ef4444' }}>
                  <span>Suma de Pagos:</span>
                  <span>${sumOfMultiplesTotal.toFixed(2)} / ${total.toFixed(2)}</span>
                </div>
                {!isMultiplesValid && (
                  <span style={{ fontSize: '11px', color: '#ef4444', textAlign: 'right', display: 'block' }}>
                    {sumOfMultiplesTotal > total ? `Sobra $${(sumOfMultiplesTotal - total).toFixed(2)}` : `Falta $${(total - sumOfMultiplesTotal).toFixed(2)}`}
                  </span>
                )}
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
