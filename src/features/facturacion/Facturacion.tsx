import { useState, useMemo, useEffect } from 'react';
import { useFacturacion } from './useFacturacion';
import { usePeriodFilterStore } from '../../store/periodFilterStore';
import type { Sale, Order, SaleItem } from '../../types/domain';
import { useFinancialAccountsStore } from '../../store/financialAccountsStore';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import { generateInvoicePDF } from './invoicePdfHelper';
import { calculateWeightInKg } from '../../lib/unitConverter';
import { truncateDecimals, formatCurrency } from '../../lib/formatters';
import { useSettingsStore } from '../../store/settingsStore';
import { calculateProductionCostDetails } from '../../utils/costHelpers';
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
    recipes,
    equivalences,
    packages,
    loading,
    pendingOrders,
    createSaleFromOrder,
    cobrarSale,
    anularSale,
    deleteSale,
    markOrderAsDelivered,
    deliverHistoricalSale
  } = useFacturacion();

  const settings = useSettingsStore(state => state.settings);
  const { accounts, fetchAccounts } = useFinancialAccountsStore();
  const { getRanges } = usePeriodFilterStore();
  const { current: currentRange } = getRanges();

  // Navigation tabs: 'pending' or 'issued'
  const [activeTab, setActiveTab] = useState<'pending' | 'issued'>('pending');

  // Right Panel states
  const [showFacturarPanel, setShowFacturarPanel] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [saleToCobrar, setSaleToCobrar] = useState<Sale | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Period-filtered Sales and Pending Orders
  const periodSales = useMemo(() => {
    return sales.filter(s => {
      const d = new Date(s.date);
      return d >= currentRange.startDate && d <= currentRange.endDate;
    });
  }, [sales, currentRange]);

  const periodPendingOrders = useMemo(() => {
    return pendingOrders.filter(o => {
      const d = new Date(o.fecha);
      return d >= currentRange.startDate && d <= currentRange.endDate;
    });
  }, [pendingOrders, currentRange]);

  // Period Summary Metrics
  const summaryMetrics = useMemo(() => {
    const activeSales = periodSales.filter(s => s.status !== 'ANULADO');
    const facturacionEmitida = activeSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const remitosEmitidos = activeSales.length;
    const remitosPendientes = periodPendingOrders.filter(o => o.status === 'ENTREGADO').length;
    const facturasPendientes = periodSales.filter(s => s.status === 'FACTURADO').length;
    const ticketPromedio = remitosEmitidos > 0 ? facturacionEmitida / remitosEmitidos : 0;

    return {
      facturacionEmitida,
      remitosEmitidos,
      remitosPendientes,
      facturasPendientes,
      ticketPromedio
    };
  }, [periodSales, periodPendingOrders]);

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

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');

  // Filter & Search Sales (Remitos)
  const filteredSales = useMemo(() => {
    return periodSales.filter(s => {
      const customer = customers.find(c => c.id === s.customerId);
      const customerName = customer?.nombre?.toLowerCase() || '';
      const customerRazon = customer?.razonSocial?.toLowerCase() || '';
      const saleId = s.id.toLowerCase();
      
      return customerName.includes(searchTerm.toLowerCase()) || 
             customerRazon.includes(searchTerm.toLowerCase()) ||
             saleId.includes(searchTerm.toLowerCase());
    });
  }, [periodSales, customers, searchTerm]);

  // Open billing panel for a specific order
  const handleOpenFacturar = (order: Order) => {
    setSelectedOrder(order);

    setSaleItems(
      order.items.map(it => {
        const prod = products.find(p => p.id === it.productId);
        
        // Sum packages if usePackages = true
        let pkgWeightSum = 0;
        let pkgCostSum = 0;
        if (settings.usePackages) {
          const prodPkgs = packages.filter(pkg => pkg.productId === it.productId && pkg.status === 'STOCK');
          prodPkgs.sort((a, b) => {
            const aIsOrder = a.orderId === order.id ? 1 : 0;
            const bIsOrder = b.orderId === order.id ? 1 : 0;
            if (aIsOrder !== bIsOrder) return bIsOrder - aIsOrder;

            const aNoOrder = !a.orderId ? 1 : 0;
            const bNoOrder = !b.orderId ? 1 : 0;
            if (aNoOrder !== bNoOrder) return aNoOrder - bNoOrder;

            return new Date(a.producedAt).getTime() - new Date(b.producedAt).getTime();
          });
          const selectedPkgs = prodPkgs.slice(0, Math.ceil(it.cantidad));
          selectedPkgs.forEach(pkg => {
            pkgWeightSum += pkg.weight;
            pkgCostSum += pkg.totalCost;
          });
        }

        const hasPackages = settings.usePackages && pkgWeightSum > 0;
        const pesoReal = hasPackages ? pkgWeightSum : (it.pesoReal !== undefined && it.pesoReal > 0 ? it.pesoReal : calculateWeightInKg(it.cantidad, it.unidad, prod));
        const finalPesoReal = truncateDecimals(pesoReal, 3);

        // Calculate dynamic recipe cost if not using packages
        let costPerKg = 0;
        if (hasPackages) {
          costPerKg = pkgWeightSum > 0 ? pkgCostSum / pkgWeightSum : 0;
        } else {
          const recipe = recipes.find(r => r.productId === it.productId);
          if (recipe && prod) {
            const details = calculateProductionCostDetails(
              recipe.items || [],
              it.cantidad,
              finalPesoReal,
              prod,
              products,
              equivalences
            );
            costPerKg = details.costPerKg;
          } else {
            costPerKg = prod?.costoActual || 0;
          }
        }
        
        const finalCostPerKg = truncateDecimals(costPerKg, 2);
        const finalTotalCost = truncateDecimals(finalCostPerKg * finalPesoReal, 2);

        const precioRealKg = Number(it.precioEstimado.toFixed(2));
        const importeReal = Number((finalPesoReal * precioRealKg).toFixed(2));

        return {
          productId: it.productId,
          cantidad: it.cantidad,
          unidad: it.unidad,
          precioUnitario: precioRealKg,
          subtotal: importeReal,
          // Cost and Profitability real weight fields
          pesoReal: finalPesoReal,
          precioRealKg: precioRealKg,
          importeReal: importeReal,
          costoUnitarioHistorico: finalCostPerKg,
          costoTotalHistorico: finalTotalCost,
          rentabilidadBruta: Number((importeReal - finalTotalCost).toFixed(2)),
          pesosReales: it.pesosReales || (it.pesoReal ? [it.pesoReal] : []),
          cantidadPaquetes: it.cantidadPaquetes || (it.pesosReales ? it.pesosReales.length : (it.pesoReal ? 1 : 0)),
          pesoTotal: it.pesoTotal || finalPesoReal,
          pesoPromedio: it.pesoPromedio || (it.pesosReales && it.pesosReales.length > 0 ? finalPesoReal / it.pesosReales.length : finalPesoReal)
        };
      })
    );
    setShowFacturarPanel(true);
  };

  const handleUpdateItem = (idx: number, field: keyof SaleItem, val: any) => {
    const newItems = [...saleItems];
    const item = { ...newItems[idx], [field]: val };
    const prod = products.find(p => p.id === item.productId);

    if (field === 'precioRealKg') {
      const precioReal = Number(val);
      const peso = item.pesoReal || 0;
      item.precioRealKg = precioReal;
      item.precioUnitario = precioReal;
      item.importeReal = Number((peso * precioReal).toFixed(2));
      item.subtotal = item.importeReal;
      
      const totalCost = item.costoTotalHistorico || 0;
      item.rentabilidadBruta = Number((item.importeReal - totalCost).toFixed(2));
    }
    
    newItems[idx] = item as SaleItem;
    setSaleItems(newItems);
  };

  const totalFacturar = useMemo(() => {
    return Number(saleItems.reduce((acc, it) => acc + (it.importeReal || 0), 0).toFixed(2));
  }, [saleItems]);

  const totalCostoInterno = useMemo(() => {
    return Number(saleItems.reduce((acc, it) => acc + (it.costoTotalHistorico || 0), 0).toFixed(2));
  }, [saleItems]);

  const totalRentabilidadInterna = useMemo(() => {
    return Number(saleItems.reduce((acc, it) => acc + (it.rentabilidadBruta || 0), 0).toFixed(2));
  }, [saleItems]);

  const totalMargenInterno = useMemo(() => {
    if (totalFacturar <= 0) return 0;
    return Number(((totalRentabilidadInterna / totalFacturar) * 100).toFixed(1));
  }, [totalFacturar, totalRentabilidadInterna]);

  const handleSubmitSale = async () => {
    if (!selectedOrder) return;
    
    // Repository validations at client-side before submission
    for (const item of saleItems) {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) continue;
      
      const stockToDeduct = item.pesoReal || item.cantidad;
      if (!settings.allowNegativeStock && stockToDeduct > (prod.stockActual || 0)) {
        alert(`Error: El stock disponible para ${prod.nombre} (${prod.stockActual || 0} Kg) es menor a la cantidad a remisionar (${stockToDeduct} Kg). La operación está bloqueada por la configuración de Stock Negativo.`);
        return;
      }
      
      if (item.pesoReal === undefined || item.pesoReal <= 0) {
        alert(`Error: El peso real para ${prod.nombre} debe ser mayor a 0.`);
        return;
      }
      
      if (item.precioRealKg !== undefined && item.precioRealKg < 0) {
        alert(`Error: El precio de venta para ${prod.nombre} no puede ser negativo.`);
        return;
      }
    }
    
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
            Pendientes de Remitir ({periodPendingOrders.length})
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

      {/* Resumen del Período */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        <div className="apple-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Facturación Emitida</span>
          <strong style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: '8px' }}>{formatCurrency(summaryMetrics.facturacionEmitida)}</strong>
        </div>
        <div className="apple-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Remitos Emitidos</span>
          <strong style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: '8px' }}>{summaryMetrics.remitosEmitidos}</strong>
        </div>
        <div className="apple-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Remitos Pendientes</span>
          <strong style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: '8px' }}>{summaryMetrics.remitosPendientes}</strong>
        </div>
        <div className="apple-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Facturas Pendientes</span>
          <strong style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: '8px' }}>{summaryMetrics.facturasPendientes}</strong>
        </div>
        <div className="apple-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ticket Promedio</span>
          <strong style={{ fontSize: '20px', color: 'var(--text-primary)', marginTop: '8px' }}>{formatCurrency(summaryMetrics.ticketPromedio)}</strong>
        </div>
      </div>

      {/* Tabs Content */}
      {activeTab === 'pending' ? (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
            Listado de pedidos terminados. Los pedidos deben ser marcados como <strong>Entregados</strong> para poder confeccionar y emitir su Remito Comercial.
          </p>

          {periodPendingOrders.length === 0 ? (
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
              {periodPendingOrders.map(order => {
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
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            const showPrices = window.confirm("¿Desea incluir precios en el PDF del remito? (Aceptar = SI, Cancelar = NO)");
                            generateInvoicePDF(sale, customer, products, settings, showPrices); 
                          }}
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
                        {sale.isHistorical && sale.deliveryStatus === 'PENDIENTE' && sale.status !== 'ANULADO' && (
                          <button 
                            className="btn-primary" 
                            style={{ flex: 1, padding: '8px 12px', backgroundColor: '#e28743', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }} 
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
                const isPres = prod?.type === 'PRESENTACION';
                const totalCost = item.costoTotalHistorico || 0;
                const profit = isPres ? (item.importeReal || 0) - totalCost : 0;
                const margin = isPres && item.importeReal && item.importeReal > 0 ? (profit / item.importeReal) * 100 : 0;

                return (
                  <div 
                    key={idx} 
                    style={{
                      background: '#ffffff',
                      padding: '16px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{prod?.nombre || 'Producto Desconocido'}</strong>
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#f3f4f6', color: 'var(--text-secondary)' }}>
                        Cant: {item.cantidad} {item.unidad}
                      </span>
                    </div>

                    {item.pesosReales && item.pesosReales.length > 0 && (
                      <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#fdfdfd', border: '1px dashed var(--border-color)', fontSize: '12.5px' }}>
                        <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: 600 }}>Pesos Reales Individuales:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {item.pesosReales.map((w, wIdx) => (
                            <span key={wIdx} style={{ backgroundColor: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontSize: '11.5px' }}>
                              Paq {wIdx + 1}: <strong>{w.toFixed(3)} kg</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Peso Total (Kg)</label>
                        <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#f9fafb', border: '1px solid var(--border-color)', fontSize: '13px', fontWeight: 600 }}>
                          {item.pesoReal || 0} Kg
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Precio/Kg ($)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={item.precioRealKg || ''} 
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            handleUpdateItem(idx, 'precioRealKg', val);
                          }}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', fontWeight: 600 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Subtotal ($)</label>
                        <div style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#f9fafb', border: '1px solid var(--border-color)', fontSize: '13px', fontWeight: 600, color: 'var(--alvacio-red)' }}>
                          ${(item.importeReal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {/* ERP Internal Margins Panel */}
                    {isPres && (
                      <div style={{ 
                        marginTop: '8px', 
                        padding: '12px', 
                        borderRadius: '8px', 
                        backgroundColor: 'rgba(0, 0, 0, 0.02)', 
                        border: '1px solid var(--border-color)',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '8px',
                        fontSize: '11.5px'
                      }}>
                        <div>Costo/Kg: <strong>${item.costoUnitarioHistorico?.toFixed(2) || '0.00'}</strong></div>
                        <div>Costo Total: <strong>${totalCost.toFixed(2)}</strong></div>
                        <div style={{ color: profit >= 0 ? '#16a34a' : '#ef4444' }}>
                          Ganancia: <strong>${profit.toFixed(2)}</strong>
                        </div>
                        <div style={{ color: margin >= 0 ? '#16a34a' : '#ef4444' }}>
                          Margen: <strong>{margin.toFixed(1)}%</strong>
                        </div>
                      </div>
                    )}
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
            {/* ERP Internal Totals */}
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.03)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '16px',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Costo Total Interno:</span>
                <strong>${totalCostoInterno.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: totalRentabilidadInterna >= 0 ? '#16a34a' : '#ef4444' }}>
                <span>Ganancia Estimada:</span>
                <strong>${totalRentabilidadInterna.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: totalMargenInterno >= 0 ? '#16a34a' : '#ef4444' }}>
                <span>Margen Comercial Promedio:</span>
                <strong>{totalMargenInterno}%</strong>
              </div>
            </div>

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
