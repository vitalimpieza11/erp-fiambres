import { useMemo, useEffect, useState } from 'react';
import { useDashboardCache } from './useDashboardCache';
import { useFinancialAccountsStore } from '../../store/financialAccountsStore';
import { useLoansStore } from '../../store/loansStore';
import { usePeriodFilterStore } from '../../store/periodFilterStore';
import { useProductionStore } from '../../store/productionStore';
import { 
  Wallet, 
  TrendingUp, 
  ShoppingCart, 
  Truck, 
  Users, 
  ClipboardList,
  PiggyBank,
  Percent,
  FileText,
  Activity,
  Layers,
  Scale,
  Package as PackageIcon,
  Calculator,
  Briefcase,
  X
} from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import LoadingSpinner from '../../components/LoadingSpinner';
import './Dashboard.css';

export default function Dashboard() {
  const {
    cacheCaja,
    cacheStock,
    cacheVentas,
    cacheCompras,
    cacheProveedores,
    cacheClientes,
    loading: cacheLoading
  } = useDashboardCache();

  const [selectedProfitDetailOpen, setSelectedProfitDetailOpen] = useState(false);

  const { accounts, fetchAccounts } = useFinancialAccountsStore();
  const { movements: prodMovements, fetchData: fetchProduction, loading: prodLoading } = useProductionStore();
  const { getRanges, selectedPeriod } = usePeriodFilterStore();
  const { loans, subscribeLoans } = useLoansStore();

  useEffect(() => {
    fetchAccounts();
    fetchProduction();
    const unsubLoans = subscribeLoans();
    return () => unsubLoans();
  }, [fetchAccounts, fetchProduction, subscribeLoans]);

  const { current: currentRange, comparison: comparisonRange } = getRanges();

  const loading = cacheLoading || prodLoading;

  // ==========================================
  // BLOQUE 1 - ESTADO ACTUAL DEL NEGOCIO (Independiente del período)
  // ==========================================
  
  const activeAccounts = useMemo(() => accounts.filter(a => a.activa), [accounts]);

  const getBalanceByAccountType = (type: 'EFECTIVO' | 'BANCO' | 'BILLETERA_VIRTUAL') => {
    return cacheCaja.movements
      .filter(m => {
        if (!m.accountId) {
          const desc = (m.description || '').toLowerCase();
          const cat = (m.category || '').toLowerCase();
          const isBanco = desc.includes('banco') || 
                          desc.includes('transferencia') || 
                          desc.includes('transf') || 
                          desc.includes('deposito') || 
                          desc.includes('depósito') ||
                          desc.includes('cheque') ||
                          cat.includes('banco') || 
                          cat.includes('transferencia');
          if (type === 'EFECTIVO') return !isBanco;
          if (type === 'BANCO') return isBanco;
          return false;
        }
        const acc = activeAccounts.find(a => a.id === m.accountId);
        return acc ? acc.tipo === type : false;
      })
      .reduce((acc, mov) => acc + (mov.type === 'INCOME' ? mov.amount : -mov.amount), 0);
  };

  const cajaActual = useMemo(() => getBalanceByAccountType('EFECTIVO'), [cacheCaja.movements, activeAccounts]);
  const saldoBancos = useMemo(() => getBalanceByAccountType('BANCO'), [cacheCaja.movements, activeAccounts]);
  const billeterasActual = useMemo(() => getBalanceByAccountType('BILLETERA_VIRTUAL'), [cacheCaja.movements, activeAccounts]);
  const totalDisponible = cajaActual + saldoBancos + billeterasActual;

  const porCobrar = useMemo(() => {
    return cacheClientes.movements.reduce((acc, m) => {
      if (m.type === 'DEUDA') return acc + m.amount;
      if (m.type === 'PAGO') return acc - m.amount;
      if (m.type === 'AJUSTE') return acc + m.amount;
      return acc;
    }, 0);
  }, [cacheClientes.movements]);

  const porPagar = useMemo(() => {
    return cacheProveedores.movements.reduce((acc, m) => {
      if (m.type === 'COMPRA') return acc + m.amount;
      if (m.type === 'PAGO') return acc - m.amount;
      if (m.type === 'AJUSTE' || m.type === 'ANULACION') return acc + m.amount;
      return acc;
    }, 0);
  }, [cacheProveedores.movements]);

  const stockValorizado = useMemo(() => {
    return cacheStock.products
      .filter(p => p.activo)
      .reduce((acc, p) => acc + (Math.max(0, p.stockActual || 0) * (p.costoActual || p.costoUltimaCompra || 0)), 0);
  }, [cacheStock.products]);

  const prestamosPendientes = useMemo(() => {
    return loans.reduce((acc, l) => acc + l.remainingAmount, 0);
  }, [loans]);

  const patrimonioEstimado = totalDisponible + porCobrar + stockValorizado - porPagar - prestamosPendientes;

  // Resultado Operativo Acumulado = Ganancia Bruta Acumulada - Gastos Operativos Acumulados
  const resultadoOperativoAcumulado = useMemo(() => {
    // 1. Ventas Históricas Totales
    const ventasHist = cacheVentas.sales
      .filter(s => s.status !== 'ANULADO')
      .reduce((acc, s) => acc + s.totalAmount, 0);

    // 2. CMV Histórico Acumulado
    const cmvHistoricoAcumulado = cacheVentas.sales
      .filter(s => s.status !== 'ANULADO')
      .reduce((acc, s) => {
        // Prioridad 3: Ventas históricas globales
        if (s.isHistorical && s.costoTotal !== undefined) {
          return acc + s.costoTotal;
        }

        const saleCost = (s.items || []).reduce((itemAcc, item) => {
          // Prioridad 1: item.costoTotalHistorico
          if (item.costoTotalHistorico !== undefined) {
            return itemAcc + item.costoTotalHistorico;
          }
          // Prioridad 2: item.costoTotal
          if (item.costoTotal !== undefined) {
            return itemAcc + item.costoTotal;
          }
          
          // Prioridad 4: Fallback a catálogo actual
          const prod = cacheStock.products.find(p => p.id === item.productId);
          if (prod) {
            const qty = prod.unitType === 'KG' ? (item.pesoReal || item.cantidad) : item.cantidad;
            return itemAcc + (qty * (prod.costoActual || prod.costoUltimaCompra || 0));
          }
          
          return itemAcc;
        }, 0);

        return acc + saleCost;
      }, 0);

    // 3. Ganancia Bruta Acumulada
    const gananciaBrutaAcumulada = ventasHist - cmvHistoricoAcumulado;

    // 4. Gastos Operativos Acumulados
    const gastosOperativosAcumulados = cacheCaja.movements
      .filter(m => m.type === 'EXPENSE')
      .filter(m => {
        const cat = (m.category || '').toUpperCase();
        const excludeCategories = [
          'COMPRA_PROVEEDOR', 
          'SOCIOS', 
          'APORTE_SOCIOS_INICIAL',
          'ANULACION',
          'ANULACION_VENTA', 
          'ANULACION_COMPRA',
          'SALDO_INICIAL',
          'TRANSFERENCIA',
          'MOVIMIENTO_INTERNO'
        ];
        return !excludeCategories.includes(cat);
      })
      .reduce((acc, m) => acc + m.amount, 0);

    return gananciaBrutaAcumulada - gastosOperativosAcumulados;
  }, [cacheVentas.sales, cacheStock.products, cacheCaja.movements]);


  // ==========================================
  // BLOQUE 2 - RESULTADOS DEL PERÍODO (Dependiente del selector global)
  // ==========================================

  const getPeriodMetrics = (start: Date, end: Date) => {
    // 1. Sales and CMV
    const periodSales = cacheVentas.sales.filter(s => {
      const d = new Date(s.date);
      return d >= start && d <= end && s.status !== 'ANULADO';
    });

    const totalVentas = periodSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalCmv = periodSales.reduce((acc, s) => {
      if (s.isHistorical && s.costoTotal !== undefined) {
        return acc + s.costoTotal;
      }
      const saleCost = (s.items || []).reduce((itemAcc, item) => {
        const prod = cacheStock.products.find(p => p.id === item.productId);
        if (prod && prod.type === 'PRESENTACION') {
          return itemAcc + (item.costoTotalHistorico || item.costoTotal || 0);
        }
        return itemAcc + (item.cantidad * (prod?.costoActual || 0));
      }, 0);
      return acc + saleCost;
    }, 0);

    const gananciaBruta = totalVentas - totalCmv;
    const margenBruto = totalVentas > 0 ? (gananciaBruta / totalVentas) * 100 : 0;

    // 2. Orders
    const periodOrders = cacheVentas.orders.filter(o => {
      if (o.isDeleted || o.status === 'ANULADO') return false;
      const d = new Date(o.fecha);
      return d >= start && d <= end;
    });
    const cantidadPedidos = periodOrders.length;

    // 3. Remitos
    const cantidadRemitos = periodSales.filter(s => s.tipoComprobante === 'REMITO').length;

    // 4. Clientes únicos
    const clientesUnicos = new Set(periodSales.map(s => s.customerId)).size;

    // 5. Compras
    const periodPurchases = cacheCompras.purchases.filter(p => {
      if (p.status === 'VOIDED' || p.type !== 'PURCHASE') return false;
      const d = new Date(p.date);
      return d >= start && d <= end;
    });
    const totalCompras = periodPurchases.reduce((acc, p) => acc + p.total, 0);
    const proveedoresUtilizados = new Set(periodPurchases.map(p => p.supplierId)).size;

    // 6. Producción
    const periodProdMovs = prodMovements.filter(m => {
      if (m.isDeleted) return false;
      const d = new Date(m.date);
      return d >= start && d <= end && (m.type === 'PRODUCCION_STOCK' || m.type === 'PRODUCCION_PEDIDO');
    });
    const produccionesRealizadas = periodProdMovs.length;

    const periodPackages = (cacheVentas.packages || []).filter(p => {
      const d = new Date(p.producedAt);
      return d >= start && d <= end;
    });

    let kgProducidos = 0;
    let paquetesProducidos = 0;

    if (periodPackages.length > 0) {
      kgProducidos = periodPackages.reduce((acc, p) => acc + (p.weight || 0), 0);
      paquetesProducidos = periodPackages.length;
    } else {
      kgProducidos = periodProdMovs.reduce((acc, m) => {
        const prod = cacheStock.products.find(p => p.id === m.productId);
        if (prod && prod.type === 'PRESENTACION') {
          if (prod.unitType === 'KG') return acc + m.qty;
          return acc + (m.qty * (prod.pesoObjetivoKg || (prod.pesoObjetivoGramos || 0) / 1000 || 0));
        }
        return acc;
      }, 0);

      paquetesProducidos = periodProdMovs.reduce((acc, m) => {
        const prod = cacheStock.products.find(p => p.id === m.productId);
        if (prod && prod.type === 'PRESENTACION' && prod.unitType === 'UNIDADES') {
          return acc + m.qty;
        }
        return acc;
      }, 0);
    }

    return {
      totalVentas,
      totalCompras,
      gananciaBruta,
      margenBruto,
      cantidadPedidos,
      cantidadRemitos,
      clientesUnicos,
      proveedoresUtilizados,
      produccionesRealizadas,
      kgProducidos,
      paquetesProducidos
    };
  };

  const currentMetrics = useMemo(() => getPeriodMetrics(currentRange.startDate, currentRange.endDate), [currentRange, cacheVentas.sales, cacheVentas.orders, cacheCompras.purchases, prodMovements, cacheVentas.packages, cacheStock.products]);
  const comparisonMetrics = useMemo(() => getPeriodMetrics(comparisonRange.startDate, comparisonRange.endDate), [comparisonRange, cacheVentas.sales, cacheVentas.orders, cacheCompras.purchases, prodMovements, cacheVentas.packages, cacheStock.products]);

  const renderTrend = (curr: number, comp: number, formatFn: (v: number) => string, invertColor = false) => {
    const diff = curr - comp;
    const pct = comp > 0 ? (diff / comp) * 100 : (curr > 0 ? 100 : 0);
    const isPositive = diff > 0;
    const isNegative = diff < 0;

    if (diff === 0 && comp === 0) return null;

    let color = 'var(--text-secondary)';
    if (diff !== 0) {
      if (invertColor) {
        color = isPositive ? '#dc2626' : '#16a34a';
      } else {
        color = isPositive ? '#16a34a' : '#dc2626';
      }
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color, marginTop: '8px' }}>
        <span>{isPositive ? '▲' : isNegative ? '▼' : '●'}</span>
        <span>{isPositive ? '+' : ''}{pct.toFixed(1)}%</span>
        <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)' }}>vs anterior ({formatFn(comp)})</span>
      </div>
    );
  };

  if (loading) return <LoadingSpinner message="Sincronizando capa operativa del ERP..." />;

  const formatNumber = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
  const formatKg = (n: number) => `${n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg`;

  return (
    <div className="dashboard-v2-container">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="dashboard-subtitle">Métricas y salud financiera en tiempo real</p>
        </div>
      </div>

      {/* BLOQUE 1 - ESTADO ACTUAL DEL NEGOCIO */}
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          Estado Actual del Negocio
        </h2>
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div className="apple-card" style={{ padding: '20px', minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Caja Actual</span>
              <div className="dash-icon" style={{ backgroundColor: '#f3f4f6', color: '#1f2937' }}><Wallet size={18} /></div>
            </div>
            <div className="dash-metric" style={{ marginTop: '12px' }}>
              <span className="dash-metric-value">{formatCurrency(cajaActual)}</span>
            </div>
          </div>

          <div className="apple-card" style={{ padding: '20px', minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Saldo Bancos</span>
              <div className="dash-icon" style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}><PiggyBank size={18} /></div>
            </div>
            <div className="dash-metric" style={{ marginTop: '12px' }}>
              <span className="dash-metric-value">{formatCurrency(saldoBancos)}</span>
            </div>
          </div>

          <div className="apple-card" style={{ padding: '20px', minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Billeteras Virtuales</span>
              <div className="dash-icon" style={{ backgroundColor: '#faf5ff', color: '#7c3aed' }}><Wallet size={18} /></div>
            </div>
            <div className="dash-metric" style={{ marginTop: '12px' }}>
              <span className="dash-metric-value">{formatCurrency(billeterasActual)}</span>
            </div>
          </div>

          <div className="apple-card" style={{ padding: '20px', minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--alvacio-red-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--alvacio-red)' }}>Total Disponible</span>
              <div className="dash-icon" style={{ backgroundColor: 'var(--color-rosa-muy-claro)', color: 'var(--alvacio-red)' }}><Wallet size={18} /></div>
            </div>
            <div className="dash-metric" style={{ marginTop: '12px' }}>
              <span className="dash-metric-value" style={{ color: 'var(--alvacio-red)' }}>{formatCurrency(totalDisponible)}</span>
            </div>
          </div>

          <div className="apple-card" style={{ padding: '20px', minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Cuentas por Cobrar</span>
              <div className="dash-icon" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}><Users size={18} /></div>
            </div>
            <div className="dash-metric" style={{ marginTop: '12px' }}>
              <span className="dash-metric-value">{formatCurrency(porCobrar)}</span>
            </div>
          </div>

          <div className="apple-card" style={{ padding: '20px', minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Cuentas por Pagar</span>
              <div className="dash-icon" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}><Truck size={18} /></div>
            </div>
            <div className="dash-metric" style={{ marginTop: '12px' }}>
              <span className="dash-metric-value">{formatCurrency(porPagar)}</span>
            </div>
          </div>

          <div className="apple-card" style={{ padding: '20px', minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Stock Valorizado</span>
              <div className="dash-icon" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}><PackageIcon size={18} /></div>
            </div>
            <div className="dash-metric" style={{ marginTop: '12px' }}>
              <span className="dash-metric-value">{formatCurrency(stockValorizado)}</span>
            </div>
          </div>

          <div className="apple-card" style={{ padding: '20px', minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#e2f9ec', border: '1px solid #a7f3d0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#065f46' }}>Patrimonio Estimado</span>
              <div className="dash-icon" style={{ backgroundColor: '#10b981', color: '#ffffff' }}><Briefcase size={18} /></div>
            </div>
            <div className="dash-metric" style={{ marginTop: '12px' }}>
              <span className="dash-metric-value" style={{ color: '#047857' }}>{formatCurrency(patrimonioEstimado)}</span>
            </div>
          </div>

          <div className="apple-card" style={{ padding: '20px', minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e40af' }}>Res. Operativo Acumulado</span>
              <div className="dash-icon" style={{ backgroundColor: '#3b82f6', color: '#ffffff' }}><Calculator size={18} /></div>
            </div>
            <div className="dash-metric" style={{ marginTop: '12px' }}>
              <span className="dash-metric-value" style={{ color: '#1d4ed8' }}>{formatCurrency(resultadoOperativoAcumulado)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE 2 - RESULTADOS DEL PERÍODO */}
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          Resultados del Período
        </h2>
        <div className="dashboard-grid">
          {/* Card Ventas */}
          <div className="apple-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ventas del Período</span>
                <div className="dash-icon" style={{ backgroundColor: '#e0e7ff', color: '#4f46e5' }}><TrendingUp size={20} /></div>
              </div>
              <span className="dash-metric-value" style={{ fontSize: '32px' }}>{formatCurrency(currentMetrics.totalVentas)}</span>
            </div>
            {renderTrend(currentMetrics.totalVentas, comparisonMetrics.totalVentas, formatCurrency)}
          </div>

          {/* Card Compras */}
          <div className="apple-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>Compras del Período</span>
                <div className="dash-icon" style={{ backgroundColor: '#f3f4f6', color: '#4b5563' }}><ShoppingCart size={20} /></div>
              </div>
              <span className="dash-metric-value" style={{ fontSize: '32px' }}>{formatCurrency(currentMetrics.totalCompras)}</span>
            </div>
            {renderTrend(currentMetrics.totalCompras, comparisonMetrics.totalCompras, formatCurrency, true)}
          </div>

          {/* Card Ganancia Bruta */}
          <div 
            className="apple-card" 
            style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s ease' }}
            onClick={() => setSelectedProfitDetailOpen(true)}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ganancia Bruta</span>
                <div className="dash-icon" style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}><Wallet size={20} /></div>
              </div>
              <span className="dash-metric-value" style={{ fontSize: '32px', color: currentMetrics.gananciaBruta >= 0 ? '#15803d' : '#b91c1c' }}>
                {formatCurrency(currentMetrics.gananciaBruta)}
              </span>
            </div>
            {renderTrend(currentMetrics.gananciaBruta, comparisonMetrics.gananciaBruta, formatCurrency)}
          </div>

          {/* Card Margen Bruto */}
          <div className="apple-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>Margen Comercial</span>
                <div className="dash-icon" style={{ backgroundColor: '#f3e8ff', color: '#9333ea' }}><Percent size={20} /></div>
              </div>
              <span className="dash-metric-value" style={{ fontSize: '32px' }}>{currentMetrics.margenBruto.toFixed(1)}%</span>
            </div>
            {renderTrend(currentMetrics.margenBruto, comparisonMetrics.margenBruto, (v) => `${v.toFixed(1)}%`)}
          </div>

          {/* Card Pedidos */}
          <div className="apple-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>Cantidad de Pedidos</span>
                <div className="dash-icon" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}><ClipboardList size={20} /></div>
              </div>
              <span className="dash-metric-value" style={{ fontSize: '32px' }}>{formatNumber(currentMetrics.cantidadPedidos)}</span>
            </div>
            {renderTrend(currentMetrics.cantidadPedidos, comparisonMetrics.cantidadPedidos, formatNumber)}
          </div>

          {/* Card Remitos */}
          <div className="apple-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>Remitos Emitidos</span>
                <div className="dash-icon" style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}><FileText size={20} /></div>
              </div>
              <span className="dash-metric-value" style={{ fontSize: '32px' }}>{formatNumber(currentMetrics.cantidadRemitos)}</span>
            </div>
            {renderTrend(currentMetrics.cantidadRemitos, comparisonMetrics.cantidadRemitos, formatNumber)}
          </div>

          {/* Card Clientes que compraron */}
          <div className="apple-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>Clientes que Compraron</span>
                <div className="dash-icon" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}><Users size={20} /></div>
              </div>
              <span className="dash-metric-value" style={{ fontSize: '32px' }}>{formatNumber(currentMetrics.clientesUnicos)}</span>
            </div>
            {renderTrend(currentMetrics.clientesUnicos, comparisonMetrics.clientesUnicos, formatNumber)}
          </div>

          {/* Card Proveedores utilizados */}
          <div className="apple-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>Proveedores Utilizados</span>
                <div className="dash-icon" style={{ backgroundColor: '#fff7ed', color: '#ea580c' }}><Truck size={20} /></div>
              </div>
              <span className="dash-metric-value" style={{ fontSize: '32px' }}>{formatNumber(currentMetrics.proveedoresUtilizados)}</span>
            </div>
            {renderTrend(currentMetrics.proveedoresUtilizados, comparisonMetrics.proveedoresUtilizados, formatNumber)}
          </div>

          {/* Card Producciones */}
          <div className="apple-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>Producciones Realizadas</span>
                <div className="dash-icon" style={{ backgroundColor: '#fdf2f8', color: '#db2777' }}><Activity size={20} /></div>
              </div>
              <span className="dash-metric-value" style={{ fontSize: '32px' }}>{formatNumber(currentMetrics.produccionesRealizadas)}</span>
            </div>
            {renderTrend(currentMetrics.produccionesRealizadas, comparisonMetrics.produccionesRealizadas, formatNumber)}
          </div>

          {/* Card Kg Producidos */}
          <div className="apple-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>Kg Producidos</span>
                <div className="dash-icon" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}><Scale size={20} /></div>
              </div>
              <span className="dash-metric-value" style={{ fontSize: '28px' }}>{formatKg(currentMetrics.kgProducidos)}</span>
            </div>
            {renderTrend(currentMetrics.kgProducidos, comparisonMetrics.kgProducidos, formatKg)}
          </div>

          {/* Card Paquetes Producidos */}
          <div className="apple-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)' }}>Paquetes Producidos</span>
                <div className="dash-icon" style={{ backgroundColor: '#faf5ff', color: '#7c3aed' }}><Layers size={20} /></div>
              </div>
              <span className="dash-metric-value" style={{ fontSize: '32px' }}>{formatNumber(currentMetrics.paquetesProducidos)}</span>
            </div>
            {renderTrend(currentMetrics.paquetesProducidos, comparisonMetrics.paquetesProducidos, formatNumber)}
          </div>
        </div>
      </div>

      {/* --- MODAL DETALLE DE GANANCIA BRUTA --- */}
      {selectedProfitDetailOpen && (() => {
        const { startDate, endDate } = currentRange;
        const periodSales = cacheVentas.sales.filter(s => {
          const d = new Date(s.date);
          return d >= startDate && d <= endDate && s.status !== 'ANULADO';
        });

        const profitDetailSales = periodSales.map(sale => {
          let cost = 0;
          if (sale.isHistorical && sale.costoTotal !== undefined) {
            cost = sale.costoTotal;
          } else {
            cost = (sale.items || []).reduce((itemAcc, item) => {
              if (item.costoTotalHistorico !== undefined) return itemAcc + item.costoTotalHistorico;
              if (item.costoTotal !== undefined) return itemAcc + item.costoTotal;
              const prod = cacheStock.products.find(p => p.id === item.productId);
              return itemAcc + (item.cantidad * (prod?.costoActual || 0));
            }, 0);
          }
          
          const ganancia = sale.totalAmount - cost;
          const margin = sale.totalAmount > 0 ? (ganancia / sale.totalAmount) * 100 : 0;
          
          const customer = cacheClientes.customers.find(c => c.id === sale.customerId);
          const customerName = customer ? (customer.razonSocial || customer.nombre) : 'Cliente Desconocido';
          
          return {
            id: sale.id,
            fecha: new Date(sale.date).toLocaleDateString('es-AR'),
            cliente: customerName,
            venta: sale.totalAmount,
            costo: cost,
            ganancia,
            margen: margin,
            rawDate: new Date(sale.date).getTime()
          };
        }).sort((a, b) => b.rawDate - a.rawDate);

        const profitTotals = profitDetailSales.reduce((acc, curr) => ({
          venta: acc.venta + curr.venta,
          costo: acc.costo + curr.costo,
          ganancia: acc.ganancia + curr.ganancia
        }), { venta: 0, costo: 0, ganancia: 0 });

        return (
          <div className="modal-overlay open" onClick={() => setSelectedProfitDetailOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '95%' }}>
              <div className="modal-header">
                <h2>Detalle de Ganancia Bruta</h2>
                <button className="icon-btn" onClick={() => setSelectedProfitDetailOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '0' }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'var(--bg-secondary)' }}>
                    <tr>
                      <th style={{ padding: '12px 16px' }}>Fecha</th>
                      <th style={{ padding: '12px 16px' }}>Cliente</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Venta</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Costo</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ganancia</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Margen %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitDetailSales.map(row => (
                      <tr key={row.id}>
                        <td style={{ padding: '12px 16px' }}>{row.fecha}</td>
                        <td style={{ padding: '12px 16px' }}>{row.cliente}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatCurrency(row.venta)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatCurrency(row.costo)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: row.ganancia >= 0 ? '#15803d' : '#b91c1c', fontWeight: 500 }}>
                          {formatCurrency(row.ganancia)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{row.margen.toFixed(1)}%</td>
                      </tr>
                    ))}
                    {profitDetailSales.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>No hay ventas en este período.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '16px 24px', backgroundColor: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
                <div>Totales ({profitDetailSales.length} op)</div>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <div>Ventas: {formatCurrency(profitTotals.venta)}</div>
                  <div>Costos: {formatCurrency(profitTotals.costo)}</div>
                  <div style={{ color: profitTotals.ganancia >= 0 ? '#15803d' : '#b91c1c' }}>Ganancia: {formatCurrency(profitTotals.ganancia)}</div>
                  <div>Margen: {profitTotals.venta > 0 ? ((profitTotals.ganancia / profitTotals.venta) * 100).toFixed(1) : 0}%</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
