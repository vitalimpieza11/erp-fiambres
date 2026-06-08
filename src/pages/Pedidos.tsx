import React, { useState } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Input, Select } from '../components/ui/Forms';
import { 
  Search, Plus, ArrowLeft, Save, Info, DollarSign, Package, Tag, 
  TrendingUp, Layers, Loader2, Edit2, Trash2, ClipboardList, 
  Truck, CheckCircle, Play, Eye, FileText, ShoppingCart
} from 'lucide-react';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { useOrders } from '../hooks/useOrders';
import { usePresentaciones } from '../hooks/usePresentaciones';
import { useMercaderias } from '../hooks/useMercaderias';
import { useInsumos } from '../hooks/useInsumos';
import { useRecipes } from '../hooks/useRecipes';
import { useCustomers } from '../hooks/useCustomers';
import { usePriceLists } from '../hooks/usePriceLists';
import { calculatePresentationCost, getPresentationConsumption } from '../core/calculations';
import { useDateFilter } from '../contexts/DateFilterContext';

export const Pedidos = () => {
  const { filterDate } = useDateFilter();

  // Hooks
  const { orders, loading: loadingOrders, error: errorOrders, saveOrder, deleteOrder, updateOrderStatus } = useOrders();
  // Presentaciones: única entidad de venta de pedidos
  const { presentaciones, loading: loadingPres } = usePresentaciones();
  const { mercaderias } = useMercaderias();
  const { insumos } = useInsumos();
  const { recipes, loading: loadingRecipes } = useRecipes();
  const { customers, loading: loadingCustomers } = useCustomers();
  const { priceLists } = usePriceLists();

  // Navigation / Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedOrderForView, setSelectedOrderForView] = useState<any>(null);
  
  // Facturar Modal State
  const [billingOrderId, setBillingOrderId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cc');

  // Form States - Order Header
  const [customerId, setCustomerId] = useState('');
  const [discountStr, setDiscountStr] = useState('0');
  const [observaciones, setObservaciones] = useState('');
  const [status, setStatus] = useState<any>('PENDIENTE');
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number; price: number; priceOrigin?: string }[]>([]);

  const globalError = errorOrders;

  // Filtered orders by Date context
  const filteredOrders = orders.filter(o => filterDate(o.date));

  // Open Form for creating or editing order
  const openForm = (order?: any) => {
    if (order) {
      setEditingId(order.id);
      setCustomerId(order.customerId);
      setDiscountStr((order.discount || 0).toString());
      setObservaciones(order.observaciones || '');
      setStatus(order.status || 'PENDIENTE');
      setOrderItems(order.items.map((i: any) => ({
        productId: i.productId,
        quantity: i.quantity,
        price: i.price,
        priceOrigin: i.priceOrigin || 'Precio Base'
      })));
    } else {
      setEditingId(null);
      setCustomerId('');
      setDiscountStr('0');
      setObservaciones('');
      setStatus('PENDIENTE');
      setOrderItems([{ productId: '', quantity: 1, price: 0, priceOrigin: '' }]);
    }
    setIsFormOpen(true);
  };

  const resetFormStates = () => {
    setEditingId(null);
    setCustomerId('');
    setDiscountStr('0');
    setObservaciones('');
    setStatus('PENDIENTE');
    setOrderItems([]);
  };

  // Prepopulate item price when presentación is selected
  const handleProductSelect = (index: number, presId: string) => {
    const pres = presentaciones.find(p => p.id === presId);
    if (!pres) return;

    const customer = customers.find(c => c.id === customerId);
    let finalPrice = 0;
    let priceOrigin = 'Precio Base';
    const costo = calculatePresentationCost(pres, mercaderias, insumos, recipes);

    // 1° Precio especial del cliente
    const specialPrice = customer?.specialPrices?.[presId];
    if (specialPrice) {
      if (specialPrice.mode === 'price') {
        finalPrice = specialPrice.value;
      } else {
        finalPrice = costo / (1 - specialPrice.value / 100);
      }
      priceOrigin = 'Precio especial cliente';
    } 
    // 2° Lista de precios asignada al cliente
    else if (customer?.priceListId) {
      const pList = priceLists.find(l => l.id === customer.priceListId);
      if (pList) {
        const override = pList.productOverrides?.[presId];
        if (override) {
          if (override.mode === 'manual') {
            finalPrice = override.manualPrice || 0;
          } else {
            const margin = override.margin || pList.margin;
            finalPrice = margin >= 100 ? costo * 2 : (costo / (1 - margin / 100));
          }
        } else {
          finalPrice = pList.margin >= 100 ? costo * 2 : (costo / (1 - pList.margin / 100));
        }
        priceOrigin = `Lista: ${pList.name}`;
      }
    }

    // 3° Precio base del producto (fallback)
    if (finalPrice <= 0) {
      finalPrice = pres.precioVentaKg > 0
        ? pres.precioVentaKg * (pres.pesoObjetivoGramos / 1000)
        : costo * 1.4;
    }

    const updated = [...orderItems];
    updated[index].productId = presId;
    updated[index].price = finalPrice;
    updated[index].priceOrigin = priceOrigin;
    setOrderItems(updated);
  };

  const handleSave = async () => {
    if (!customerId) return alert('Seleccione un cliente.');
    const validItems = orderItems.filter(i => i.productId && i.quantity > 0);
    if (validItems.length === 0) return alert('Debe agregar al menos un ítem al pedido.');

    const customer = customers.find(c => c.id === customerId);
    
    // Totals calculations
    const subtotal = validItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const discVal = parseNumber(discountStr);
    const total = subtotal * (1 - discVal / 100);

    const payload = {
      customerId,
      customerName: customer?.name || '',
      items: validItems.map(item => {
        const pres = presentaciones.find(p => p.id === item.productId);
        return {
          productId: item.productId,
          productName: pres?.name || '',
          quantity: item.quantity,
          price: item.price,
          priceOrigin: item.priceOrigin || 'Precio Base'
        };
      }),
      subtotal,
      discount: discVal,
      total,
      status,
      observations: observaciones,
      date: Date.now()
    };

    setIsSaving(true);
    try {
      // Pass presentaciones context to saveOrder for metric calculation
      await saveOrder(payload, recipes, editingId || undefined);
      resetFormStates();
      setIsFormOpen(false);
    } catch (e: any) {
      alert(e.message || 'Error al guardar el pedido.');
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Desea cancelar y eliminar este pedido?')) {
      try {
        await deleteOrder(id);
      } catch (e) {
        alert('Error al eliminar.');
      }
    }
  };

  const handleTransitionStatus = async (orderId: string, status: any) => {
    try {
      await updateOrderStatus(orderId, status);
    } catch (e: any) {
      alert('Error en transición: ' + e.message);
    }
  };

  const handleInvoiceSubmit = async () => {
    if (!billingOrderId) return;
    setIsSaving(true);
    try {
      await updateOrderStatus(billingOrderId, 'FACTURADO', { paymentMethod });
      setBillingOrderId(null);
    } catch (e: any) {
      alert('Error al facturar pedido: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // KPIs
  const totalCount = filteredOrders.length;
  const pendingProdCount = filteredOrders.filter(o => o.status === 'PENDIENTE' || o.status === 'EN_PRODUCCION').length;
  const deliveredCount = filteredOrders.filter(o => o.status === 'ENTREGADO' || o.status === 'PRODUCIDO').length;
  const avgMargin = filteredOrders.length > 0 
    ? filteredOrders.reduce((sum, o) => sum + (o.marginPercent || 0), 0) / filteredOrders.length 
    : 0;

  const stats = [
    { title: 'Pedidos Registrados', value: totalCount.toString(), icon: ShoppingCart, color: 'var(--primary-color)', bg: 'var(--primary-light)' },
    { title: 'En Cola de Producción', value: pendingProdCount.toString(), icon: Play, color: '#d97706', bg: '#fef3c7' },
    { title: 'Entregados s/Facturar', value: deliveredCount.toString(), icon: Truck, color: '#059669', bg: '#d1fae5' },
    { title: 'Margen Promedio', value: formatNumber(avgMargin, '%'), icon: TrendingUp, color: '#4f46e5', bg: '#e0e7ff' },
  ];

  if (loadingOrders) {
    return <SkeletonLoader rows={4} height="52px" />;
  }

  if (globalError) {
    return <ErrorState message={globalError} />;
  }

  // FORM RENDER
  if (isFormOpen) {
    // Solo presentaciones activas son ofrecibles en pedidos
    const activePresentaciones = presentaciones.filter(p => p.isActive);
    
    // Real time metrics calculations using presentaciones
    let subtotal = 0;
    const needsMap: Record<string, { productName: string; quantity: number }> = {};
    let totalProdCost = 0;

    orderItems.forEach((item) => {
      if (!item.productId) return;
      subtotal += item.quantity * item.price;

      const pres = presentaciones.find(p => p.id === item.productId);
      if (!pres) return;

      // Real cost from presentation
      const unitCost = calculatePresentationCost(pres, mercaderias, insumos, recipes);
      totalProdCost += unitCost * item.quantity;

      // Raw material needs from consumption calculation
      const consumption = getPresentationConsumption(pres, item.quantity, mercaderias, insumos, recipes);
      consumption.forEach(c => {
        if (!c.isInsumo) {
          if (needsMap[c.id]) {
            needsMap[c.id].quantity += c.quantity;
          } else {
            needsMap[c.id] = {
              productName: c.name,
              quantity: c.quantity
            };
          }
        }
      });
    });

    const discVal = parseNumber(discountStr);
    const totalOrderValue = subtotal * (1 - discVal / 100);
    const estimatedMarginVal = totalOrderValue - totalProdCost;
    const estimatedMarginPercent = totalOrderValue > 0 ? (estimatedMarginVal / totalOrderValue) * 100 : 0;

    return (
      <div style={{ paddingBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => { resetFormStates(); setIsFormOpen(false); }} className="btn btn-icon">
              <ArrowLeft size={20} color="var(--text-secondary)" />
            </button>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingId ? 'Editar Pedido' : 'Nuevo Pedido'}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Genera automáticamente stock necesario y costos de elaboración
              </p>
            </div>
          </div>
          <button onClick={handleSave} disabled={isSaving} className="btn btn-primary">
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Guardar Pedido
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Info size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>1. Cliente & Fecha</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <Select 
                  label="Cliente" 
                  value={customerId} 
                  onChange={e => setCustomerId(e.target.value)} 
                  options={[
                    { value: '', label: 'Seleccionar Cliente...' },
                    ...customers.map(c => ({ value: c.id!, label: c.name }))
                  ]} 
                />
                <Input
                  label="Observaciones"
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Instrucciones, fecha solicitada..."
                />
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Package size={20} color="var(--primary-color)" />
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>2. Ítems del Pedido</h3>
                </div>
                <button 
                  type="button" 
                  onClick={() => setOrderItems([...orderItems, { productId: '', quantity: 1, price: 0, priceOrigin: '' }])}
                  className="btn btn-secondary-light btn-sm"
                >
                  + Agregar Producto
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {orderItems.map((item, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                    <Select 
                      label="Producto Terminado"
                      value={item.productId}
                      onChange={e => handleProductSelect(index, e.target.value)}
                      options={[
                        { value: '', label: 'Seleccione presentación...' },
                        ...activePresentaciones.map(p => ({ value: p.id!, label: `${p.name} (${p.pesoObjetivoGramos}g)` }))
                      ]}
                    />
                    <Input 
                      label="Cantidad (unidades)"
                      type="number"
                      value={item.quantity.toString()}
                      onChange={e => {
                        const updated = [...orderItems];
                        updated[index].quantity = parseNumber(e.target.value);
                        setOrderItems(updated);
                      }}
                    />
                    <div>
                      <Input 
                        label="Precio Unitario ($)"
                        type="number"
                        value={item.price.toString()}
                        onChange={e => {
                          const updated = [...orderItems];
                          updated[index].price = parseNumber(e.target.value);
                          updated[index].priceOrigin = 'Editado manualmente';
                          setOrderItems(updated);
                        }}
                      />
                      {item.priceOrigin && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--primary-color)', marginTop: '4px', fontWeight: 600 }}>
                          {item.priceOrigin}
                        </div>
                      )}
                    </div>
                    <button 
                      type="button"
                      onClick={() => setOrderItems(orderItems.filter((_, i) => i !== index))}
                      className="btn btn-icon" 
                      style={{ color: '#dc2626', marginBottom: '8px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card className="card-highlight" style={{ borderTop: '4px solid var(--primary-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <TrendingUp size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Resumen del Margen</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
                </div>
                <Input label="Descuento (%)" type="number" value={discountStr} onChange={e => setDiscountStr(e.target.value)} />
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>Total Pedido</span>
                  <span style={{ fontWeight: 700, color: 'var(--primary-color)' }}>{formatCurrency(totalOrderValue)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Costo de Producción</span>
                  <span style={{ fontWeight: 600, color: '#ef4444' }}>{formatCurrency(totalProdCost)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', marginTop: '8px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Margen Neto Est.</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: estimatedMarginVal >= 0 ? '#10b981' : '#ef4444' }}>
                      {formatCurrency(estimatedMarginVal)}
                    </span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>% Margen</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: estimatedMarginPercent >= 30 ? '#10b981' : '#ef4444' }}>
                      {formatNumber(estimatedMarginPercent, '%')}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Layers size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Necesidad de Stock Materias Primas</h3>
              </div>
              {Object.keys(needsMap).length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No hay ingredientes requeridos.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.values(needsMap).map((need, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', fontSize: '0.875rem' }}>
                      <span>{need.productName}</span>
                      <span style={{ fontWeight: 600 }}>{need.quantity.toFixed(3)} Kg/un</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <PageHeader title="Módulo de Pedidos" description="Gestión del flujo Cliente → Pedido → Producción" />
        <button onClick={() => openForm()} className="btn btn-primary">
          <Plus size={18} /> Nuevo Pedido
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} padding="sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', backgroundColor: stat.bg, color: stat.color, borderRadius: '10px' }}>
                  <Icon size={20} />
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>{stat.title}</p>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</h3>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card padding="none">
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Listado de Pedidos Activos</h3>
        </div>

        {filteredOrders.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState 
              icon={ClipboardList} 
              title="No hay pedidos registrados" 
              description="Registra un pedido para iniciar la cadena de producción, rinde y facturación." 
            />
          </div>
        ) : (
          <Table 
            data={filteredOrders}
            keyExtractor={(item) => item.id!}
            columns={[
              { header: 'Fecha', accessor: (item) => new Date(item.date).toLocaleDateString() },
              { header: 'Cliente', accessor: (item) => <span style={{ fontWeight: 600 }}>{item.customerName}</span> },
              {
                header: 'Artículos',
                accessor: (item) => (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {item.items.map((i: any, idx: number) => (
                      <div key={idx}>• {i.quantity}x {i.productName}</div>
                    ))}
                  </div>
                )
              },
              { header: 'Costo Prod.', accessor: (item) => formatCurrency(item.productionCost || 0) },
              {
                header: 'Margen Est.',
                accessor: (item) => {
                  const percent = item.marginPercent || 0;
                  return (
                    <span style={{ fontWeight: 600, color: percent >= 30 ? '#10b981' : '#ef4444' }}>
                      {formatNumber(percent, '%')}
                    </span>
                  );
                }
              },
              { header: 'Total Venta', accessor: (item) => <span style={{ fontWeight: 700 }}>{formatCurrency(item.total)}</span> },
              {
                header: 'Estado',
                accessor: (item) => {
                  const colors: any = {
                    PENDIENTE: { bg: '#e2e8f0', text: '#475569', label: 'Pendiente' },
                    EN_PRODUCCION: { bg: '#fef3c7', text: '#d97706', label: 'En Producción' },
                    PRODUCIDO: { bg: '#dcfce7', text: '#15803d', label: 'Producido' },
                    ENTREGADO: { bg: '#cffafe', text: '#0891b2', label: 'Entregado' },
                    FACTURADO: { bg: '#e0e7ff', text: '#4f46e5', label: 'Facturado' },
                    CERRADO: { bg: '#f3f4f6', text: '#9ca3af', label: 'Cerrado' }
                  };
                  const color = colors[item.status] || colors['PENDIENTE'];
                  return (
                    <span style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: color.bg, color: color.text }}>
                      {color.label}
                    </span>
                  );
                },
                align: 'center'
              },
              {
                header: 'Acciones',
                accessor: (item) => (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button 
                      onClick={() => setSelectedOrderForView(item)} 
                      className="btn btn-icon" 
                      title="Ver Detalles"
                      style={{ color: 'var(--primary-color)' }}
                    >
                      <Eye size={16} />
                    </button>
                    {item.status === 'PENDIENTE' && (
                      <button 
                        onClick={() => handleTransitionStatus(item.id!, 'EN_PRODUCCION')} 
                        className="btn btn-secondary-light btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                      >
                        <Play size={12} /> A Producción
                      </button>
                    )}
                    {(item.status === 'PRODUCIDO' || item.status === 'EN_PRODUCCION') && (
                      <button 
                        onClick={() => handleTransitionStatus(item.id!, 'ENTREGADO')} 
                        className="btn btn-success-light btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', backgroundColor: '#cffafe', color: '#0891b2', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        <Truck size={12} /> Entregar
                      </button>
                    )}
                    {['PENDIENTE', 'EN_PRODUCCION'].includes(item.status) && (
                      <button onClick={() => openForm(item)} className="btn btn-icon" title="Editar">
                        <Edit2 size={16} color="#2563eb" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(item.id!)} className="btn btn-icon" title="Eliminar">
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

      {/* DETAIL MODAL */}
      {selectedOrderForView && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>Ficha del Pedido</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '20px' }}>Cliente: {selectedOrderForView.customerName}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <h4 style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>Artículos Solicitados</h4>
                <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px' }}>
                  {selectedOrderForView.items.map((i: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', paddingBottom: '4px' }}>
                      <span>{i.quantity}x {i.productName}</span>
                      <span style={{ fontWeight: 600 }}>{formatCurrency(i.price * i.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>Ingredientes de Recetas Consumidos</h4>
                <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px' }}>
                  {selectedOrderForView.rawMaterialNeeds && selectedOrderForView.rawMaterialNeeds.length > 0 ? (
                    selectedOrderForView.rawMaterialNeeds.map((need: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', paddingBottom: '4px' }}>
                        <span>{need.productName}</span>
                        <span style={{ fontWeight: 600 }}>{need.quantity.toFixed(3)} Kg/un</span>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No registra materias primas asociadas.</p>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Costo Elaboración</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatCurrency(selectedOrderForView.productionCost || 0)}</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Monto Facturado</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatCurrency(selectedOrderForView.total || 0)}</span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Margen Neto Est.</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>
                    {formatNumber(selectedOrderForView.marginPercent || 0, '%')}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSelectedOrderForView(null)} className="btn btn-secondary">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* BILLING/INVOICING MODAL */}
      {billingOrderId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg-primary)', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '400px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>Generar Venta / Facturación</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <Select 
                label="Condición de Pago" 
                value={paymentMethod} 
                onChange={e => setPaymentMethod(e.target.value)} 
                options={[
                  { value: 'cc', label: 'Cuenta Corriente (Deuda)' },
                  { value: 'cash', label: 'Efectivo Contado' },
                  { value: 'transfer', label: 'Transferencia Bancaria' }
                ]} 
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setBillingOrderId(null)} className="btn btn-secondary" disabled={isSaving}>Cancelar</button>
              <button onClick={handleInvoiceSubmit} className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Registrando...' : 'Confirmar y Facturar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Pedidos;
