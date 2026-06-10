import React, { useState } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { LoadingSpinner, ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Input, Select, Toggle } from '../components/ui/Forms';
import { Search, Plus, Filter, ArrowLeft, Save, Calendar, Truck, Layers, FileText, CheckCircle, AlertCircle, Trash2, Loader2, Edit2 } from 'lucide-react';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { usePurchases } from '../hooks/usePurchases';
import { useMercaderias } from '../hooks/useMercaderias';
import { useInsumos } from '../hooks/useInsumos';
import { useSuppliers } from '../hooks/useSuppliers';
import { useSocietaria } from '../hooks/useSocietaria';
import { useDateFilter } from '../contexts/DateFilterContext';


interface PurchaseFormItem {
  id: number;
  productId: string;
  productName: string;
  quantityStr: string;
  costStr: string;
  itemType?: string;
}

export const Compras = () => {
  const { purchases, loading: loadingPurchases, error: errorPurchases, createPurchase, updatePurchase, deletePurchase } = usePurchases();
  const { mercaderias, loading: loadingMerc, error: errorMerc } = useMercaderias();
  const { insumos, loading: loadingIns, error: errorIns } = useInsumos();
  const buyableItems = [
    ...mercaderias.filter(m => m.isActive).map(m => ({ id: m.id, name: m.name, type: 'mercaderia' })),
    ...insumos.filter(i => i.isActive).map(i => ({ id: i.id, name: i.name, type: 'insumo' }))
  ];
  const { suppliers, loading: loadingSuppliers, error: errorSuppliers } = useSuppliers();
  const { filterDate } = useDateFilter();
  const { partners } = useSocietaria();

  const globalError = errorPurchases || errorMerc || errorIns || errorSuppliers;
  const filteredPurchases = purchases.filter((p: any) => filterDate(p.date));

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [impactStock, setImpactStock] = useState(true);

  // Form States
  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [payments, setPayments] = useState<{ id: number, method: string, amountStr: string, partnerId: string }[]>([]);
  const [observaciones, setObservaciones] = useState('');
  
  const [items, setItems] = useState<PurchaseFormItem[]>([
    { id: 1, productId: '', productName: '', quantityStr: '', costStr: '', itemType: '' }
  ]);

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (globalError) {
    return <ErrorState message={globalError} />;
  }

  const updateItem = (id: number, field: keyof PurchaseFormItem, value: string) => {
    if (field === 'productId') {
      const prod = buyableItems.find(p => p.id === value);
      setItems(items.map(item => item.id === id ? {
        ...item,
        productId: value,
        productName: prod?.name || '',
        itemType: prod?.type || ''
      } : item));
    } else {
      setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    }
  };

  const addItem = () => {
    setItems([...items, { id: Date.now(), productId: '', productName: '', quantityStr: '', costStr: '', itemType: '' }]);
  };

  const removeItem = (id: number) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const totals = items.reduce((acc, item) => {
    const kilos = parseNumber(item.quantityStr);
    const costo = parseNumber(item.costStr);
    return {
      kilos: acc.kilos + kilos,
      costo: acc.costo + costo
    };
  }, { kilos: 0, costo: 0 });

  const totalPagado = payments.reduce((acc, p) => acc + parseNumber(p.amountStr), 0);
  const saldoPendiente = totals.costo - totalPagado;

  const addPayment = () => setPayments([...payments, { id: Date.now(), method: 'caja', amountStr: '', partnerId: '' }]);
  const removePayment = (id: number) => setPayments(payments.filter(p => p.id !== id));
  const updatePayment = (id: number, field: string, value: string) => setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p));

  const handleRegisterPurchase = async () => {
    if (!supplierId) {
      setErrorMessage("Debe seleccionar un proveedor.");
      return;
    }
    if (items.length === 0 || items.some(item => !item.productId)) {
      setErrorMessage("Debe agregar al menos un producto válido.");
      return;
    }
    
    setErrorMessage(null);
    setIsSaving(true);

    try {
      const selectedSupplier = suppliers.find((s: any) => s.id === supplierId);
      
      const purchaseData = {
        supplierId,
        supplierName: selectedSupplier?.name || 'Proveedor Genérico',
        items: items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: parseNumber(item.quantityStr),
          cost: parseNumber(item.costStr) / (parseNumber(item.quantityStr) || 1), // Cost per Unit/Kg
          itemType: item.itemType
        })),
        total: totals.costo,
        payments: payments.map(p => ({
          method: p.method,
          amount: parseNumber(p.amountStr),
          partnerId: p.partnerId
        })),
        invoiceNumber,
        date: new Date(fecha).getTime(),
        status: saldoPendiente <= 0 ? 'PAGADA' : (totalPagado > 0 ? 'PARCIAL' : 'PENDIENTE')
      } as const;

      if (editingId) {
        await updatePurchase(editingId, purchaseData);
      } else {
        await createPurchase(purchaseData);
      }
      
      setIsCreating(false);
      setEditingId(null);
      setItems([{ id: Date.now(), productId: '', productName: '', quantityStr: '', costStr: '', itemType: '' }]);
      setPayments([]);
      setSupplierId('');
      setInvoiceNumber('');
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "Error al registrar la compra.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditPurchase = (item: any) => {
    setEditingId(item.id);
    setSupplierId(item.supplierId);
    setInvoiceNumber(item.invoiceNumber || '');
    setFecha(new Date(item.date).toISOString().split('T')[0]);
    setPayments(item.payments ? item.payments.map((p: any, idx: number) => ({
      id: Date.now() + idx,
      method: p.method || 'caja',
      amountStr: p.amount ? p.amount.toString() : '',
      partnerId: p.partnerId || ''
    })) : []);
    
    const loadedItems = item.items.map((i: any, idx: number) => ({
      id: Date.now() + idx,
      productId: i.productId,
      productName: i.productName,
      quantityStr: i.quantity.toString(),
      costStr: (i.cost * i.quantity).toString(),
      itemType: i.itemType || ''
    }));
    setItems(loadedItems);
    setErrorMessage(null);
    setIsCreating(true);
  };

  const handleDeletePurchase = async (item: any) => {
    if (window.confirm('¿Estás seguro de eliminar esta compra?')) {
      try {
        await deletePurchase(item.id);
      } catch (e: any) {
        alert(e.message || "Error al eliminar la compra.");
      }
    }
  };

  if (isCreating) {
    return (
      <div style={{ paddingBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={() => setIsCreating(false)}
              className="btn btn-icon"
            >
              <ArrowLeft size={20} color="var(--text-secondary)" />
            </button>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{editingId ? 'Editar Compra' : 'Nueva Compra'}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Ingreso de hormas e insumos en tiempo real</p>
            </div>
          </div>
          <button onClick={handleRegisterPurchase} disabled={isSaving} className="btn btn-primary">
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {editingId ? 'Guardar Cambios' : 'Registrar Compra'}
          </button>
        </div>

        {errorMessage && (
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', padding: '16px', borderRadius: '12px', color: '#dc2626', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
            <AlertCircle size={20} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* SECCIÓN 1 — DATOS DE COMPRA */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <FileText size={20} color="var(--primary-color)" />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>1. Datos del Comprobante</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} icon={<Calendar size={16} />} />
              <Select 
                label="Proveedor" 
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                options={[
                  { value: '', label: 'Seleccionar Proveedor...' },
                  ...suppliers.map((s: any) => ({ value: s.id!, label: s.name }))
                ]} 
              />
              <Input label="Factura / Remito N°" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ej: FC-0001-00001234" />
              <Input label="Observaciones" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Opcional..." />
            </div>
          </Card>

          {/* SECCIÓN 2 — PRODUCTOS COMPRADOS */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>2. Detalle de Productos</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-primary)', padding: '8px 16px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Impactar en Stock al guardar</span>
                <Toggle label="" checked={impactStock} onChange={setImpactStock} />
              </div>
            </div>

            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Producto</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Kilos / Unidades</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Costo Total ($)</th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Costo/Kg o Costo/Un</th>
                    <th style={{ padding: '12px', textAlign: 'center', width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const kilos = parseNumber(item.quantityStr);
                    const costo = parseNumber(item.costStr);
                    const costoKg = kilos > 0 ? costo / kilos : 0;
                    
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px' }}>
                          <Select 
                            label="" 
                            value={item.productId}
                            onChange={e => updateItem(item.id, 'productId', e.target.value)}
                            options={[
                              { value: '', label: 'Seleccionar Producto...' },
                              ...buyableItems.map(p => ({ value: p.id!, label: `${p.name} (${p.type === 'mercaderia' ? 'MP' : 'Ins'})` }))
                            ]} 
                          />
                        </td>
                        <td style={{ padding: '8px' }}><Input label="" type="number" placeholder="0" style={{ textAlign: 'right' }} value={item.quantityStr} onChange={e => updateItem(item.id, 'quantityStr', e.target.value)} /></td>
                        <td style={{ padding: '8px' }}><Input label="" type="number" placeholder="0" style={{ textAlign: 'right' }} value={item.costStr} onChange={e => updateItem(item.id, 'costStr', e.target.value)} /></td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>{costoKg > 0 ? formatCurrency(costoKg) : '--'}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button onClick={() => removeItem(item.id)} className="btn-danger-text"><Trash2 size={18} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <button onClick={addItem} className="btn btn-primary-light">
              <Plus size={16} /> Agregar Línea
            </button>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* SECCIÓN 4 — ESTADO FINANCIERO */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Truck size={20} color="var(--primary-color)" />
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>4. Estado de Pago</h3>
                </div>
                <button onClick={addPayment} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.875rem' }}>
                  <Plus size={16} /> Agregar Pago
                </button>
              </div>

              {payments.length === 0 ? (
                 <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#991b1b', fontWeight: 600, fontSize: '0.875rem' }}>Compra PENDIENTE (Generará deuda por el total)</span>
                    <span style={{ color: '#991b1b', fontWeight: 700, fontSize: '1.25rem' }}>{totals.costo > 0 ? formatCurrency(totals.costo) : '--'}</span>
                  </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {payments.map(payment => (
                    <div key={payment.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <Select label="Medio de Pago" value={payment.method} onChange={e => updatePayment(payment.id, 'method', e.target.value)} options={[
                        { value: 'caja', label: 'Caja' },
                        { value: 'banco', label: 'Banco' },
                        { value: 'mercadopago', label: 'Mercado Pago' },
                        { value: 'aporte_socio', label: 'Aporte de Socio' },
                        { value: 'otras', label: 'Otras Cuentas' }
                      ]} />
                      {payment.method === 'aporte_socio' && (
                        <Select label="Socio" value={payment.partnerId} onChange={e => updatePayment(payment.id, 'partnerId', e.target.value)} options={[
                          { value: '', label: 'Seleccionar...' },
                          ...partners.map(p => ({ value: p.id!, label: p.name }))
                        ]} />
                      )}
                      <Input label="Monto" type="number" value={payment.amountStr} onChange={e => updatePayment(payment.id, 'amountStr', e.target.value)} />
                      <button onClick={() => removePayment(payment.id)} className="btn-icon" style={{ marginBottom: '8px', color: '#dc2626' }}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}

                  <div style={{ backgroundColor: saldoPendiente <= 0 ? '#dcfce7' : '#fef2f2', border: `1px solid ${saldoPendiente <= 0 ? '#bbf7d0' : '#fecaca'}`, padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: saldoPendiente <= 0 ? '#166534' : '#991b1b', fontWeight: 600, fontSize: '0.875rem' }}>
                      {saldoPendiente <= 0 ? 'Compra PAGADA (Deuda $ 0)' : `Compra ${totalPagado > 0 ? 'PARCIALMENTE PAGADA' : 'PENDIENTE'} (Generará deuda)`}
                    </span>
                    <span style={{ color: saldoPendiente <= 0 ? '#166534' : '#991b1b', fontWeight: 700, fontSize: '1.25rem' }}>
                      {saldoPendiente > 0 ? formatCurrency(saldoPendiente) : '$ 0.00'}
                    </span>
                  </div>
                </div>
              )}
            </Card>

            {/* SECCIÓN 3 — RESUMEN */}
            <Card style={{ backgroundColor: 'var(--bg-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <CheckCircle size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>3. Resumen de Compra</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Cantidad de Productos</span>
                  <span style={{ fontWeight: 600 }}>{items.length} Ítem(s)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Total Kg/Unidades</span>
                  <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{totals.kilos > 0 ? formatNumber(totals.kilos) : '--'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px' }}>
                  <span style={{ fontSize: '1.125rem', fontWeight: 700 }}>Total Compra</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>{totals.costo > 0 ? formatCurrency(totals.costo) : '--'}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <PageHeader title="Compras" description="Gestión de órdenes de compra y facturas de proveedores en tiempo real" />
        <button 
          onClick={() => {
            setIsCreating(true);
            setEditingId(null);
            setItems([{ id: Date.now(), productId: '', productName: '', quantityStr: '', costStr: '', itemType: '' }]);
            setPayments([]);
            setSupplierId('');
            setInvoiceNumber('');
            setFecha(new Date().toISOString().split('T')[0]);
            setErrorMessage(null);
          }}
          className="btn btn-primary"
        >
          <Plus size={18} />
          Nueva Compra
        </button>
      </div>

      <Card padding="none">
        <div style={{ padding: '20px', display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input 
              type="text" 
              placeholder="Buscar por comprobante o proveedor..." 
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
            />
          </div>
        </div>

        {loadingPurchases ? (
          <SkeletonLoader rows={4} height="52px" />
        ) : filteredPurchases.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState 
              icon={FileText} 
              title="No hay compras registradas" 
              description="Registra una nueva compra para actualizar el stock e ingresar productos al sistema." 
            />
          </div>
        ) : (
          <Table 
            data={filteredPurchases}
            keyExtractor={(item) => item.id!}
            columns={[
              { header: 'Fecha', accessor: (item) => new Date(item.date).toLocaleDateString() },
              { header: 'Comprobante', accessor: (item) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.invoiceNumber || 'S/N'}</span>, width: '150px' },
              { 
                header: 'Proveedor', 
                accessor: (item) => <span style={{ fontWeight: 600 }}>{item.supplierName}</span> 
              },
              { header: 'Items', accessor: (item) => `${item.items.length} productos` },
              { header: 'Total ($)', accessor: (item) => <span style={{ fontWeight: 700 }}>{formatCurrency(item.total)}</span> },
              { 
                header: 'Estado', 
                accessor: (item) => (
                  <span style={{ 
                    padding: '4px 12px', 
                    borderRadius: '9999px', 
                    fontSize: '0.75rem', 
                    fontWeight: 600,
                    backgroundColor: item.status === 'PAGADA' ? '#dcfce7' : (item.status === 'PARCIAL' ? '#fef9c3' : '#fee2e2'),
                    color: item.status === 'PAGADA' ? '#166534' : (item.status === 'PARCIAL' ? '#854d0e' : '#991b1b')
                  }}>
                    {item.status}
                  </span>
                ),
                align: 'center'
              },
              {
                header: 'Acciones',
                accessor: (item) => (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleEditPurchase(item); }} className="btn btn-icon" title="Editar">
                      <Edit2 size={16} color="#2563eb" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeletePurchase(item); }} className="btn btn-icon" title="Eliminar">
                      <Trash2 size={16} color="#dc2626" />
                    </button>
                  </div>
                ),
                align: 'center'
              }
            ]}
          />
        )}
      </Card>
    </>
  );
};
export default Compras;
