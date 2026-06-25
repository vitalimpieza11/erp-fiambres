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
          let weight = 0;
          if (prod.type === 'PRESENTACION' && item.presentationType) {
            if (item.presentationType === '150G') weight = item.cantidad * 0.15;
            else if (item.presentationType === '250G') weight = item.cantidad * 0.25;
            else if (item.presentationType === '500G') weight = item.cantidad * 0.5;
            else if (item.presentationType === '1KG') weight = item.cantidad * 1;
            else weight = item.cantidad; // Fallback
          } else {
            weight = item.cantidad * (prod.pesoObjetivoKg || (prod.pesoObjetivoGramos || 0) / 1000 || 0);
          }
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
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false);



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
        newItems[idx].precioUnitario = prod.type === 'PRESENTACION' ? (prod.precio1kg || 0) : (prod.precioComercial || 0);
        newItems[idx].presentationType = undefined;
      }
    }

    const item = { ...newItems[idx], [field]: parsedVal };
    const prod = products.find(p => p.id === item.productId);

    if (field === 'presentationType') {
      if (prod && item.presentationType) {
        let newPrice = item.precioUnitario;
        if (item.presentationType === '150G' && prod.precio150g !== undefined && prod.precio150g !== null) newPrice = prod.precio150g;
        if (item.presentationType === '250G' && prod.precio250g !== undefined && prod.precio250g !== null) newPrice = prod.precio250g;
        if (item.presentationType === '500G' && prod.precio500g !== undefined && prod.precio500g !== null) newPrice = prod.precio500g;
        if (item.presentationType === '1KG' && prod.precio1kg !== undefined && prod.precio1kg !== null) newPrice = prod.precio1kg;
        if ((item.presentationType as string) === 'Comercial' && prod.precioComercial !== undefined && prod.precioComercial !== null) newPrice = prod.precioComercial;
        item.precioUnitario = newPrice;
      }
      // If presentationType is empty, leave precioUnitario completely free as the user typed.
    }


    if (field === 'cantidad' && prod && prod.type === 'PRESENTACION') {
      parsedVal = Math.round(Number(val));
      if (isNaN(parsedVal) || parsedVal < 1) parsedVal = 1;
      item.cantidad = parsedVal;
    }
    
    let weightInKg = calculateWeightInKg(Number(item.cantidad), item.unidad, prod);
    weightInKg = truncateDecimals(weightInKg, 3);

    // BUG FIXED: Do not overwrite item.cantidad with parsedVal if field is 'precioUnitario'
    item.cantidad = field === 'cantidad' ? (Number(parsedVal) || 0) : (Number(item.cantidad) || 0);
    item.precioUnitario = field === 'precioUnitario' ? Number(parsedVal) || 0 : Number(Number(item.precioUnitario).toFixed(2));
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        {/* Fila 1: Principales */}
        <div className="apple-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Facturación Total</span>
          <strong style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: '4px' }}>{formatCurrency(summaryMetrics.facturacionTotal)}</strong>
        </div>
        <div className="apple-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ganancia Bruta</span>
          <strong style={{ fontSize: '20px', color: summaryMetrics.gananciaBruta >= 0 ? '#16a34a' : '#dc2626', marginTop: '4px' }}>{formatCurrency(summaryMetrics.gananciaBruta)}</strong>
        </div>
        <div className="apple-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Margen</span>
          <strong style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: '4px' }}>{summaryMetrics.margen.toFixed(1)}%</strong>
        </div>
        <div className="apple-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Kg Vendidos</span>
          <strong style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: '4px' }}>{summaryMetrics.kgVendidos.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg</strong>
        </div>
      </div>

      <div style={{ marginBottom: '24px' }}>
        <button 
          onClick={() => setShowAdvancedMetrics(!showAdvancedMetrics)}
          className="btn-secondary"
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', fontSize: '14px' }}
        >
          <span style={{ fontWeight: 600 }}>Métricas Secundarias</span>
          <span style={{ color: 'var(--text-secondary)' }}>{showAdvancedMetrics ? '▲ Ocultar' : '▼ Mostrar'}</span>
        </button>

        {showAdvancedMetrics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px', animation: 'fadeIn 0.3s ease' }}>
            <div className="apple-card" style={{ padding: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ticket Promedio</span>
              <strong style={{ display: 'block', fontSize: '16px', color: 'var(--text-primary)', marginTop: '4px' }}>{formatCurrency(summaryMetrics.ticketPromedio)}</strong>
            </div>
            <div className="apple-card" style={{ padding: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ventas Totales</span>
              <strong style={{ display: 'block', fontSize: '16px', color: 'var(--text-primary)', marginTop: '4px' }}>{summaryMetrics.cantidadVentas}</strong>
            </div>
            <div className="apple-card" style={{ padding: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Clientes Únicos</span>
              <strong style={{ display: 'block', fontSize: '16px', color: 'var(--text-primary)', marginTop: '4px' }}>{summaryMetrics.clientesUnicos}</strong>
            </div>
            <div className="apple-card" style={{ padding: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Costo Total (CMV)</span>
              <strong style={{ display: 'block', fontSize: '16px', color: 'var(--text-primary)', marginTop: '4px' }}>{formatCurrency(summaryMetrics.costoTotal)}</strong>
            </div>
            <div className="apple-card" style={{ padding: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Paquetes Vendidos</span>
              <strong style={{ display: 'block', fontSize: '16px', color: 'var(--text-primary)', marginTop: '4px' }}>{summaryMetrics.paquetesVendidos}</strong>
            </div>
          </div>
        )}
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
                
                <div className="apple-card" style={{ padding: '0', overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table-modern table-dense">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Total</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientSales.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(sale => (
                          <tr key={sale.id}>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 500 }}>{new Date(sale.date).toLocaleDateString()}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{sale.items.length} ítems</div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>${sale.totalAmount.toFixed(2)}</div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                <span style={{ 
                                  backgroundColor: STATUS_COLORS[sale.status] + '20',
                                  color: STATUS_COLORS[sale.status],
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  whiteSpace: 'nowrap'
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
                                    borderRadius: '12px',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {sale.deliveryStatus === 'PENDIENTE' ? '🚚 PENDIENTE' : sale.deliveryStatus === 'REGISTRADA' ? '📁 REGISTRADA' : '✅ ENTREGADA'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {sale.status === 'FACTURADO' && !sale.isHistorical && (
                                  <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={(e) => { e.stopPropagation(); handleCobrar(sale); }}>
                                    <DollarSign size={14} /> Cobrar
                                  </button>
                                )}
                                {sale.isHistorical && sale.deliveryStatus === 'PENDIENTE' && sale.status !== 'ANULADO' && (
                                  <button 
                                    className="btn-primary" 
                                    style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#e28743', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }} 
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
                                    🚚 Entrega
                                  </button>
                                )}
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                  <details className="dropdown-details" style={{ position: 'relative' }}>
                                    <summary className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer', listStyle: 'none' }}>
                                      ⋮ Acciones
                                    </summary>
                                    <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 10, backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: 'var(--shadow-md)', minWidth: '120px', overflow: 'hidden' }}>
                                      {sale.status === 'FACTURADO' && (
                                        <div style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} onClick={(e) => { 
                                          e.stopPropagation();
                                          const newTotal = prompt("Editar Total de Venta:", sale.totalAmount.toString());
                                          if (newTotal && !isNaN(Number(newTotal))) {
                                            updateSale(sale.id, { totalAmount: Number(newTotal) });
                                          }
                                        }}>
                                          Editar
                                        </div>
                                      )}
                                      {sale.status !== 'ANULADO' && (
                                        <div style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', color: '#ef4444' }} onClick={(e) => { 
                                          e.stopPropagation();
                                          if(confirm('¿Anular esta venta?')) anularSale(sale);
                                        }}>
                                          Anular
                                        </div>
                                      )}
                                      {sale.status === 'ANULADO' && (
                                        <div style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', color: '#ef4444' }} onClick={(e) => { 
                                          e.stopPropagation();
                                          if(confirm('¿Eliminar esta venta?')) deleteSale(sale);
                                        }}>
                                          Eliminar
                                        </div>
                                      )}
                                    </div>
                                  </details>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Presentación</label>
                    <select
                      value={item.presentationType || ''}
                      onChange={e => updateQuickSaleItem(idx, 'presentationType', e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px', background: '#fff' }}
                    >
                      <option value="">(Sin Presentación Específica)</option>
                      <option value="150G">150G</option>
                      <option value="250G">250G</option>
                      <option value="500G">500G</option>
                      <option value="1KG">1KG</option>
                    </select>
                  </div>
                  
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
                          updateQuickSaleItem(idx, 'cantidad', Number(parsedVal) || 0);
                        }} 
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Precio U.</label>
                      <input type="number" required step="0.01" value={item.precioUnitario || ''} onChange={e => updateQuickSaleItem(idx, 'precioUnitario', Number(e.target.value) || 0)} />
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
              onChange={e => setHistoricalSale({...historicalSale, deliveryStatus: e.target.value as 'PENDIENTE' | 'ENTREGADO', items: []})}
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
