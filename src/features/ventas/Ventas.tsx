import { useState, useMemo, useEffect } from 'react';
import { useVentas } from './useVentas';
import type { Sale, Order, SaleItem } from '../../types/domain';
import { useFinancialAccountsStore } from '../../store/financialAccountsStore';
import { usePeriodFilterStore } from '../../store/periodFilterStore';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import Modal from '../../components/Modal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileText, DollarSign, XCircle, Edit3, TrendingUp, ShoppingCart, Percent, Users, Scale, Layers, HelpCircle } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { createAlvacioPDF } from '../../lib/pdfHelper';
import { calculateWeightInKg, convertQuantityToBaseUnit } from '../../lib/unitConverter';
import { truncateDecimals, formatCurrency } from '../../lib/formatters';
import { groupPresentacionesByCustomer } from '../../lib/groupByCustomer';

const STATUS_COLORS: Record<string, string> = {
  FACTURADO: '#f59e0b',
  COBRADO: '#10b981',
  ANULADO: '#ef4444'
};

export default function Ventas() {
  const { sales, orders, customers, products, loading, createSaleFromOrder, createQuickSale, createHistoricalSale, updateSale, cobrarSale, anularSale, deleteSale, markOrderAsDelivered, deliverHistoricalSale } = useVentas();
  const { getRanges } = usePeriodFilterStore();
  const { current: currentRange } = getRanges();
  
  // Period-filtered Sales
  const periodSales = useMemo(() => {
    return sales.filter(s => {
      const d = new Date(s.date);
      return d >= currentRange.startDate && d <= currentRange.endDate;
    });
  }, [sales, currentRange]);

  // Period Summary Metrics
  const summaryMetrics = useMemo(() => {
    const activeSales = periodSales.filter(s => s.status !== 'ANULADO');
    const facturacionTotal = activeSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const costoTotal = activeSales.reduce((acc, s) => {
      if (s.isHistorical && s.costoTotal !== undefined) {
        return acc + s.costoTotal;
      }
      const saleCost = (s.items || []).reduce((itemAcc, item) => {
        const prod = products.find(p => p.id === item.productId);
        if (prod && prod.type === 'PRESENTACION') {
          return itemAcc + (item.costoTotalHistorico || item.costoTotal || 0);
        }
        return itemAcc + (item.cantidad * (prod?.costoActual || 0));
      }, 0);
      return acc + saleCost;
    }, 0);

    const gananciaBruta = facturacionTotal - costoTotal;
    const margen = facturacionTotal > 0 ? (gananciaBruta / facturacionTotal) * 100 : 0;
    const cantidadVentas = activeSales.length;
    const ticketPromedio = cantidadVentas > 0 ? facturacionTotal / cantidadVentas : 0;
    const clientesUnicos = new Set(activeSales.map(s => s.customerId)).size;

    const kgVendidos = activeSales.reduce((acc, s) => {
      return acc + (s.items || []).reduce((itemAcc, item) => {
        const prod = products.find(p => p.id === item.productId);
        if (item.pesoReal !== undefined && item.pesoReal > 0) return itemAcc + item.pesoReal;
        if (item.pesoTotal !== undefined && item.pesoTotal > 0) return itemAcc + item.pesoTotal;
        if (item.unidad === 'KG') return itemAcc + item.cantidad;
        if (prod) {
          const weight = item.cantidad * (prod.pesoObjetivoKg || (prod.pesoObjetivoGramos || 0) / 1000 || 0);
          return itemAcc + weight;
        }
        return itemAcc;
      }, 0);
    }, 0);

    const paquetesVendidos = activeSales.reduce((acc, s) => {
      return acc + (s.items || []).reduce((itemAcc, item) => {
        const prod = products.find(p => p.id === item.productId);
        if (item.cantidadPaquetes !== undefined && item.cantidadPaquetes > 0) {
          return itemAcc + item.cantidadPaquetes;
        }
        if (item.unidad === 'UNIDADES' || (prod && prod.type === 'PRESENTACION')) {
          return itemAcc + item.cantidad;
        }
        return itemAcc;
      }, 0);
    }, 0);

    return {
      facturacionTotal,
      costoTotal,
      gananciaBruta,
      margen,
      cantidadVentas,
      ticketPromedio,
      clientesUnicos,
      kgVendidos,
      paquetesVendidos
    };
  }, [periodSales, products]);

  
  // RightPanel states
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [showHistoricalSale, setShowHistoricalSale] = useState(false);
  const [saleToCobrar, setSaleToCobrar] = useState<Sale | null>(null);
  const { accounts, fetchAccounts } = useFinancialAccountsStore();
  const [selectedAccountId, setSelectedAccountId] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (accounts.length > 0) {
      const activeCash = accounts.find(a => a.activa && a.tipo === 'EFECTIVO');
      const activeAny = accounts.find(a => a.activa);
      setSelectedAccountId(activeCash?.id || activeAny?.id || '');
    }
  }, [accounts, saleToCobrar]);
  
  // Quick Sale State
  const [quickSale, setQuickSale] = useState<{ customerId: string; items: SaleItem[]; totalAmount: number; observaciones: string }>({
    customerId: '', items: [], totalAmount: 0, observaciones: ''
  });

  // Historical Sale State
  const [historicalSale, setHistoricalSale] = useState<{
    customerId: string;
    date: string;
    observaciones: string;
    totalAmount: number;
    costoTotal: number;
    deliveryStatus: 'PENDIENTE' | 'ENTREGADO';
    items: { productId: string; cantidad: number }[];
  }>({
    customerId: '',
    date: new Date().toISOString().split('T')[0],
    observaciones: '',
    totalAmount: 0,
    costoTotal: 0,
    deliveryStatus: 'ENTREGADO',
    items: []
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [showHistorical, setShowHistorical] = useState(false);



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
    let parsedVal = val;
    
    if (field === 'productId') {
      const prod = products.find(p => p.id === val);
      if (prod) {
        newItems[idx].unidad = prod.type === 'PRESENTACION' ? 'UNIDADES' : prod.unitType;
        newItems[idx].precioUnitario = prod.precioComercial || 0;
      }
    }

    const item = { ...newItems[idx], [field]: parsedVal };
    const prod = products.find(p => p.id === item.productId);

    if (field === 'cantidad' && prod && prod.type === 'PRESENTACION') {
      parsedVal = Math.round(Number(val));
      if (isNaN(parsedVal) || parsedVal < 1) parsedVal = 1;
      item.cantidad = parsedVal;
    }
    
    let weightInKg = calculateWeightInKg(Number(item.cantidad), item.unidad, prod);
    weightInKg = truncateDecimals(weightInKg, 3);

    item.cantidad = parsedVal as any;
    item.precioUnitario = field === 'precioUnitario' ? parsedVal as any : Number(Number(item.precioUnitario).toFixed(2));
    item.subtotal = Number((weightInKg * Number(item.precioUnitario)).toFixed(2));
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

  const addHistoricalItem = () => {
    setHistoricalSale(prev => ({
      ...prev,
      items: [...prev.items, { productId: '', cantidad: 1 }]
    }));
  };

  const updateHistoricalItem = (idx: number, field: string, val: any) => {
    const newItems = [...historicalSale.items];
    let parsedVal = val;
    if (field === 'cantidad') {
      parsedVal = Math.round(Number(val));
      if (isNaN(parsedVal) || parsedVal < 1) parsedVal = 1;
    }
    newItems[idx] = { ...newItems[idx], [field]: parsedVal };
    setHistoricalSale(prev => ({ ...prev, items: newItems }));
  };

  const removeHistoricalItem = (idx: number) => {
    const newItems = [...historicalSale.items];
    newItems.splice(idx, 1);
    setHistoricalSale(prev => ({ ...prev, items: newItems }));
  };

  const handleCreateHistoricalSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!historicalSale.customerId) return alert("Seleccione cliente");
    if (historicalSale.deliveryStatus === 'PENDIENTE' && historicalSale.items.length === 0) {
      return alert("Debe agregar al menos una presentación y cantidad para una venta histórica PENDIENTE.");
    }
    try {
      await createHistoricalSale({
        customerId: historicalSale.customerId,
        date: historicalSale.date,
        observaciones: historicalSale.observaciones || 'Venta histórica',
        totalAmount: Number(historicalSale.totalAmount),
        costoTotal: Number(historicalSale.costoTotal),
        deliveryStatus: historicalSale.deliveryStatus,
        items: historicalSale.deliveryStatus === 'PENDIENTE' ? historicalSale.items : []
      });
      setShowHistoricalSale(false);
      alert("Venta histórica registrada con éxito.");
    } catch (err: any) {
      alert(`Error al guardar venta histórica: ${err.message || err}`);
    }
  };



  const handleCobrar = (sale: Sale) => {
    setSaleToCobrar(sale);
  };

  const executeCobrar = async (method: 'EFECTIVO_TRANSFERENCIA' | 'CUENTA_CORRIENTE') => {
    if (!saleToCobrar) return;
    if (method === 'EFECTIVO_TRANSFERENCIA' && !selectedAccountId) {
      alert("Debe seleccionar una cuenta financiera para cobrar.");
      return;
    }
    try {
      await cobrarSale(saleToCobrar, method, method === 'EFECTIVO_TRANSFERENCIA' ? selectedAccountId : undefined);
      setSaleToCobrar(null);
    } catch (err: any) {
      alert(`Error al registrar cobro: ${err.message || err}`);
    }
  };

  // Grouped Sales View
  const groupedSales = useMemo(() => {
    const filtered = sales.filter(s => {
      if (!showHistorical && s.isHistorical) return false;
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
  }, [periodSales, customers, searchTerm, showHistorical]);



  if (loading) return <LoadingSpinner message="Cargando módulo de ventas..." />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Ventas</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={() => {
            setHistoricalSale({
              customerId: '',
              date: new Date().toISOString().split('T')[0],
              observaciones: '',
              totalAmount: 0,
              costoTotal: 0,
              deliveryStatus: 'ENTREGADO',
              items: []
            });
            setShowHistoricalSale(true);
          }}>+ Venta Histórica</button>
          <button className="btn-primary" onClick={() => setShowQuickSale(true)}>+ Venta Rápida</button>
        </div>
      </div>

      {/* Resumen del Período */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Fila 1: Financiero */}
        <div className="apple-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '80px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Facturación Total</span>
          <strong style={{ fontSize: '18px', color: 'var(--text-primary)', marginTop: '4px' }}>{formatCurrency(summaryMetrics.facturacionTotal)}</strong>
        </div>
        <div className="apple-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '80px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ganancia Bruta</span>
          <strong style={{ fontSize: '18px', color: summaryMetrics.gananciaBruta >= 0 ? '#16a34a' : '#dc2626', marginTop: '4px' }}>{formatCurrency(summaryMetrics.gananciaBruta)}</strong>
        </div>
        <div className="apple-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '80px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Costo Total (CMV)</span>
          <strong style={{ fontSize: '18px', color: 'var(--text-primary)', marginTop: '4px' }}>{formatCurrency(summaryMetrics.costoTotal)}</strong>
        </div>
        <div className="apple-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '80px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Margen</span>
          <strong style={{ fontSize: '18px', color: 'var(--text-primary)', marginTop: '4px' }}>{summaryMetrics.margen.toFixed(1)}%</strong>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Fila 2: Operativa */}
        <div className="apple-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '80px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ticket Promedio</span>
          <strong style={{ fontSize: '18px', color: 'var(--text-primary)', marginTop: '4px' }}>{formatCurrency(summaryMetrics.ticketPromedio)}</strong>
        </div>
        <div className="apple-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '80px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ventas Totales</span>
          <strong style={{ fontSize: '18px', color: 'var(--text-primary)', marginTop: '4px' }}>{summaryMetrics.cantidadVentas}</strong>
        </div>
        <div className="apple-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '80px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Clientes Únicos</span>
          <strong style={{ fontSize: '18px', color: 'var(--text-primary)', marginTop: '4px' }}>{summaryMetrics.clientesUnicos}</strong>
        </div>
        <div className="apple-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '80px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Kg Vendidos</span>
          <strong style={{ fontSize: '16px', color: 'var(--text-primary)', marginTop: '4px' }}>{summaryMetrics.kgVendidos.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg</strong>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {/* Fila 3: Restante */}
        <div className="apple-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '80px', maxWidth: '25%' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Paquetes Vendidos</span>
          <strong style={{ fontSize: '18px', color: 'var(--text-primary)', marginTop: '4px' }}>{summaryMetrics.paquetesVendidos}</strong>
        </div>
      </div>

      <div className="search-bar" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input 
          type="text" 
          placeholder="Buscar ventas por cliente..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', maxWidth: '400px' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input 
            type="checkbox" 
            id="toggleSalesHistorical" 
            checked={showHistorical} 
            onChange={e => setShowHistorical(e.target.checked)} 
            style={{ width: 'auto' }}
          />
          <label htmlFor="toggleSalesHistorical" style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Mostrar ventas históricas de carga inicial
          </label>
        </div>
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
                        <div style={{ display: 'flex', gap: '8px' }}>
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
                          {sale.isHistorical && (
                            <span style={{
                              backgroundColor: sale.deliveryStatus === 'PENDIENTE' ? '#feebc8' : sale.deliveryStatus === 'REGISTRADA' ? '#edf2f7' : '#c6f6d5',
                              color: sale.deliveryStatus === 'PENDIENTE' ? '#c05621' : sale.deliveryStatus === 'REGISTRADA' ? '#4a5568' : '#22543d',
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '12px'
                            }}>
                              {sale.deliveryStatus === 'PENDIENTE' ? '🚚 Lista para preparar' : sale.deliveryStatus === 'REGISTRADA' ? '📁 Registrada' : '✅ Entregada'}
                            </span>
                          )}
                        </div>
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

                          {sale.status === 'FACTURADO' && !sale.isHistorical && (
                            <button className="btn-primary" style={{ flex: 1, padding: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }} onClick={(e) => { e.stopPropagation(); handleCobrar(sale); }}>
                              <DollarSign size={16} /> Cobrar
                            </button>
                          )}
                          {sale.status === 'COBRADO' && !sale.isHistorical && (
                            <div style={{ flex: 1, padding: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', backgroundColor: '#10b981', color: 'white', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px' }}>
                              ✅ COBRADA
                            </div>
                          )}
                          {sale.isHistorical && sale.deliveryStatus === 'PENDIENTE' && sale.status !== 'ANULADO' && (
                            <button 
                              className="btn-primary" 
                              style={{ flex: 1, padding: '8px', backgroundColor: '#e28743', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }} 
                              onClick={async (e) => { 
                                e.stopPropagation();
                                if (window.confirm(`¿Confirmar entrega física de mercaderías para la venta histórica ${sale.id.slice(-8).toUpperCase()}? Se descontará el stock físico.`)) {
                                  try {
                                    await deliverHistoricalSale(sale.id);
                                    alert("Entrega física registrada con éxito. Se actualizó el inventario.");
                                  } catch (err: any) {
                                    alert(`Error al registrar entrega: ${err.message || err}`);
                                  }
                                }
                              }}
                            >
                              🚚 Registrar Entrega
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
                      <input 
                        type="number" 
                        required 
                        min={products.find(p => p.id === item.productId)?.type === 'PRESENTACION' ? "1" : "0.1"} 
                        step={products.find(p => p.id === item.productId)?.type === 'PRESENTACION' ? "1" : "0.1"} 
                        value={item.cantidad || ''} 
                        onChange={e => {
                          const val = e.target.value;
                          const parsedVal = products.find(p => p.id === item.productId)?.type === 'PRESENTACION' ? Math.round(Number(val)) : val;
                          updateQuickSaleItem(idx, 'cantidad', parsedVal as any);
                        }} 
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Precio U.</label>
                      <input type="number" required step="0.01" value={item.precioUnitario || ''} onChange={e => updateQuickSaleItem(idx, 'precioUnitario', e.target.value as any)} />
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

      <RightPanel isOpen={showHistoricalSale} onClose={() => setShowHistoricalSale(false)} title="Registrar Venta Histórica">
        <form onSubmit={handleCreateHistoricalSale} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label>Cliente</label>
            <select required value={historicalSale.customerId} onChange={e => setHistoricalSale({...historicalSale, customerId: e.target.value})}>
              <option value="">Seleccione Cliente</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Fecha Histórica</label>
            <input 
              type="date" 
              required 
              value={historicalSale.date} 
              onChange={e => setHistoricalSale({...historicalSale, date: e.target.value})} 
            />
          </div>

          <div className="form-group">
            <label>Estado de Entrega</label>
            <select 
              value={historicalSale.deliveryStatus} 
              onChange={e => setHistoricalSale({...historicalSale, deliveryStatus: e.target.value as any, items: []})}
            >
              <option value="ENTREGADO">ENTREGADA (Sin impacto de stock)</option>
              <option value="PENDIENTE">PENDIENTE DE ENTREGA (Requiere remito posterior)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Importe Facturación Total ($)</label>
            <input 
              type="number" 
              required 
              min="0" 
              step="0.01" 
              value={historicalSale.totalAmount || ''} 
              onChange={e => setHistoricalSale({...historicalSale, totalAmount: parseFloat(e.target.value) || 0})} 
            />
          </div>

          <div className="form-group">
            <label>Costo Total ($)</label>
            <input 
              type="number" 
              required 
              min="0" 
              step="0.01" 
              value={historicalSale.costoTotal || ''} 
              onChange={e => setHistoricalSale({...historicalSale, costoTotal: parseFloat(e.target.value) || 0})} 
            />
          </div>

          <div className="form-group" style={{ padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Ganancia: </span>
            <strong style={{ color: (historicalSale.totalAmount - historicalSale.costoTotal) >= 0 ? '#16a34a' : '#ef4444' }}>
              ${(historicalSale.totalAmount - historicalSale.costoTotal).toFixed(2)}
            </strong>
            <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Margen: </span>
            <strong>
              {historicalSale.totalAmount > 0 
                ? (((historicalSale.totalAmount - historicalSale.costoTotal) / historicalSale.totalAmount) * 100).toFixed(1) 
                : '0.0'}%
            </strong>
          </div>

          <div className="form-group">
            <label>Observaciones (Opcional)</label>
            <textarea 
              value={historicalSale.observaciones || ''} 
              onChange={e => setHistoricalSale({...historicalSale, observaciones: e.target.value})} 
              placeholder="Notas de auditoría o registro..."
              rows={2}
            />
          </div>

          {historicalSale.deliveryStatus === 'PENDIENTE' && (
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: 0 }}>Desglose de Presentaciones</h3>
                <button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={addHistoricalItem}>+ Agregar</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {historicalSale.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', backgroundColor: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <select 
                      required 
                      value={item.productId} 
                      style={{ flex: 2, padding: '6px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff' }}
                      onChange={e => updateHistoricalItem(idx, 'productId', e.target.value)}
                    >
                      <option value="">Seleccione Presentación</option>
                      {(() => {
                        const pres = products.filter(p => p.type === 'PRESENTACION');
                        const { byCustomer, loose } = groupPresentacionesByCustomer(pres, customers, historicalSale.customerId);
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

                    <input 
                      type="number" 
                      required 
                      min="1" 
                      step="1" 
                      placeholder="Cant. Pq" 
                      style={{ width: '80px', padding: '6px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                      value={item.cantidad || ''} 
                      onChange={e => updateHistoricalItem(idx, 'cantidad', e.target.value)} 
                    />

                    <button 
                      type="button" 
                      onClick={() => removeHistoricalItem(idx)} 
                      style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '15px' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {historicalSale.items.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0' }}>Agregue las presentaciones para poder remitir stock posteriormente.</p>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowHistoricalSale(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>Registrar Venta</button>
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

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '8px 0 4px 0' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>Cuenta de Destino (Solo para Efectivo/Transferencia)</label>
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px' }}
              >
                <option value="">Seleccione cuenta destino...</option>
                {accounts.filter(a => a.activa).map(a => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} ({a.tipo})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => executeCobrar('EFECTIVO_TRANSFERENCIA')}
                disabled={!selectedAccountId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: 600,
                  opacity: !selectedAccountId ? 0.5 : 1,
                  cursor: !selectedAccountId ? 'not-allowed' : 'pointer'
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
