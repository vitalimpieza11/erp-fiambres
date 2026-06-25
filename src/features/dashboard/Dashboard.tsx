import { useMemo, useEffect, useState } from 'react';
import { useDashboardCache } from './useDashboardCache';
import { useFinancialAccountsStore } from '../../store/financialAccountsStore';
import { useLoansStore } from '../../store/loansStore';
import { usePeriodFilterStore } from '../../store/periodFilterStore';
import { useProductionStore } from '../../store/productionStore';
import { useSociosStore } from '../../store/sociosStore';
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
import AnalyticsModal from '../../components/AnalyticsModal/AnalyticsModal';
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
  const [selectedOpAcumDetailOpen, setSelectedOpAcumDetailOpen] = useState(false);
  const [selectedPatrimonioOpen, setSelectedPatrimonioOpen] = useState(false);
  const [selectedStockValorizadoOpen, setSelectedStockValorizadoOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { accounts, fetchAccounts } = useFinancialAccountsStore();
  const { movements: prodMovements, fetchData: fetchProduction, loading: prodLoading } = useProductionStore();
  const { getRanges, selectedPeriod } = usePeriodFilterStore();
  const { loans, subscribeLoans } = useLoansStore();
  const { movements: sociosMovements, subscribeAll: subscribeSocios } = useSociosStore();

  useEffect(() => {
    fetchAccounts();
    fetchProduction();
    const unsubLoans = subscribeLoans();
    const unsubSocios = subscribeSocios();
    return () => {
      unsubLoans();
      unsubSocios();
    };
  }, [fetchAccounts, fetchProduction, subscribeLoans, subscribeSocios]);

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
      .reduce((acc, mov) => acc + (mov.type === 'INCOME' ? (Number(mov.amount) || 0) : -(Number(mov.amount) || 0)), 0);
  };

  const cajaActual = useMemo(() => getBalanceByAccountType('EFECTIVO'), [cacheCaja.movements, activeAccounts]);
  const saldoBancos = useMemo(() => getBalanceByAccountType('BANCO'), [cacheCaja.movements, activeAccounts]);
  const billeterasActual = useMemo(() => getBalanceByAccountType('BILLETERA_VIRTUAL'), [cacheCaja.movements, activeAccounts]);
  const totalDisponible = cajaActual + saldoBancos + billeterasActual;

  const porCobrar = useMemo(() => {
    return cacheClientes.movements.reduce((acc, m) => {
      if (m.type === 'DEUDA') return acc + (Number(m.amount) || 0);
      if (m.type === 'PAGO') return acc - (Number(m.amount) || 0);
      if (m.type === 'AJUSTE') return acc + (Number(m.amount) || 0);
      return acc;
    }, 0);
  }, [cacheClientes.movements]);

  const porPagar = useMemo(() => {
    return cacheProveedores.movements.reduce((acc, m) => {
      if (m.type === 'COMPRA') return acc + (Number(m.amount) || 0);
      if (m.type === 'PAGO') return acc - (Number(m.amount) || 0);
      if (m.type === 'AJUSTE' || m.type === 'ANULACION') return acc + (Number(m.amount) || 0);
      return acc;
    }, 0);
  }, [cacheProveedores.movements]);

  const stockValorizado = useMemo(() => {
    return cacheStock.products
      .filter(p => p.activo)
      .reduce((acc, p) => acc + (Math.max(0, Number(p.stockActual) || 0) * (Number(p.costoActual) || Number(p.costoUltimaCompra) || 0)), 0);
  }, [cacheStock.products]);

  const prestamosPendientes = useMemo(() => {
    return loans.reduce((acc, l) => acc + (Number(l.remainingAmount) || 0), 0);
  }, [loans]);

  const patrimonioEstimado = totalDisponible + porCobrar + stockValorizado - porPagar - prestamosPendientes;

  const capitalAportadoSocios = useMemo(() => {
    return sociosMovements.reduce((acc, mov) => {
      if (mov.estado === 'ANULADO') return acc;
      if (mov.sourceType === 'APORTE') return acc + (Number(mov.amount) || 0);
      if (mov.sourceType === 'RETIRO') return acc - (Number(mov.amount) || 0);
      if (mov.sourceType === 'AJUSTE') return acc + (Number(mov.amount) || 0);
      if (mov.sourceType === 'ANULACION') return acc + (Number(mov.amount) || 0);
      return acc;
    }, 0);
  }, [sociosMovements]);

  const resultadoGenerado = patrimonioEstimado - capitalAportadoSocios;

  // Resultado Operativo Acumulado = Ganancia Bruta Acumulada - Gastos Operativos Acumulados
  const resultadoOperativoAcumulado = useMemo(() => {
    // 1. Ventas Históricas Totales
    const ventasHist = cacheVentas.sales
      .filter(s => s.status !== 'ANULADO')
      .reduce((acc, s) => acc + (Number(s.totalAmount) || 0), 0);

    // 2. CMV Histórico Acumulado
    const cmvHistoricoAcumulado = cacheVentas.sales
      .filter(s => s.status !== 'ANULADO')
      .reduce((acc, s) => {
        // Prioridad 3: Ventas históricas globales
        if (s.isHistorical && s.costoTotal !== undefined) {
          return acc + (Number(s.costoTotal) || 0);
        }

        const saleCost = (s.items || []).reduce((itemAcc, item) => {
          // Prioridad 1: item.costoTotalHistorico
          if (item.costoTotalHistorico !== undefined) {
            return itemAcc + (Number(item.costoTotalHistorico) || 0);
          }
          // Prioridad 2: item.costoTotal
          if (item.costoTotal !== undefined) {
            return itemAcc + (Number(item.costoTotal) || 0);
          }
          
          // Prioridad 4: Fallback a catálogo actual
          const prod = cacheStock.products.find(p => p.id === item.productId);
          if (prod) {
            const qty = prod.unitType === 'KG' ? (Number(item.pesoReal) || Number(item.cantidad) || 0) : (Number(item.cantidad) || 0);
            return itemAcc + (qty * (Number(prod.costoActual) || Number(prod.costoUltimaCompra) || 0));
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
      .reduce((acc, m) => acc + (Number(m.amount) || 0), 0);

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

    const totalVentas = periodSales.reduce((acc, s) => acc + (Number(s.totalAmount) || 0), 0);
    const totalCmv = periodSales.reduce((acc, s) => {
      if (s.isHistorical && s.costoTotal !== undefined) {
        return acc + (Number(s.costoTotal) || 0);
      }
      const saleCost = (s.items || []).reduce((itemAcc, item) => {
        const prod = cacheStock.products.find(p => p.id === item.productId);
        if (prod && prod.type === 'PRESENTACION') {
          return itemAcc + (Number(item.costoTotalHistorico) || Number(item.costoTotal) || 0);
        }
        return itemAcc + ((Number(item.cantidad) || 0) * (Number(prod?.costoActual) || 0));
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
    const totalCompras = periodPurchases.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
    const proveedoresUtilizados = new Set(periodPurchases.map(p => p.supplierId)).size;

    // 6. Producción
    const periodProdMovs = prodMovements.filter(m => {
      if (m.isDeleted) return false;
      const d = new Date(m.date);
      return d >= start && d <= end && (m.type === 'PRODUCCION_STOCK' || m.type === 'PRODUCCION_PEDIDO');
    });
    const produccionesRealizadas = periodProdMovs.length;

    // 7. Gastos Operativos del período
    const periodGastos = cacheCaja.movements.filter(m => {
      if (m.type !== 'EXPENSE') return false;
      const d = new Date(m.date);
      if (d < start || d > end) return false;
      
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
    });
    const gastosOperativos = periodGastos.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
    const resultadoOperativo = gananciaBruta - gastosOperativos;

    const periodPackages = (cacheVentas.packages || []).filter(p => {
      const d = new Date(p.producedAt);
      return d >= start && d <= end;
    });

    let kgProducidos = 0;
    let paquetesProducidos = 0;

    if (periodPackages.length > 0) {
      kgProducidos = periodPackages.reduce((acc, p) => acc + (Number(p.weight) || 0), 0);
      paquetesProducidos = periodPackages.length;
    } else {
      kgProducidos = periodProdMovs.reduce((acc, m) => {
        const prod = cacheStock.products.find(p => p.id === m.productId);
        if (prod && prod.type === 'PRESENTACION') {
          if (prod.unitType === 'KG') return acc + (Number(m.qty) || 0);
          return acc + ((Number(m.qty) || 0) * (Number(prod.pesoObjetivoKg) || (Number(prod.pesoObjetivoGramos) || 0) / 1000 || 0));
        }
        return acc;
      }, 0);

      paquetesProducidos = periodProdMovs.reduce((acc, m) => {
        const prod = cacheStock.products.find(p => p.id === m.productId);
        if (prod && prod.type === 'PRESENTACION' && prod.unitType === 'UNIDADES') {
          return acc + (Number(m.qty) || 0);
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
      paquetesProducidos,
      gastosOperativos,
      resultadoOperativo
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

      {/* MÉTRICAS PRINCIPALES (Fila 1 y 2) */}
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          Resumen General
        </h2>
        
        {/* FILA 1 */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          {/* Total Disponible */}
          <div className="apple-card" style={{ padding: '20px', minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--alvacio-red-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--alvacio-red)' }}>Total Disponible</span>
              <div className="dash-icon" style={{ backgroundColor: 'var(--color-rosa-muy-claro)', color: 'var(--alvacio-red)' }}><Wallet size={18} /></div>
            </div>
            <div className="dash-metric" style={{ marginTop: '12px' }}>
              <span className="dash-metric-value" style={{ color: 'var(--alvacio-red)' }}>{formatCurrency(totalDisponible)}</span>
            </div>
          </div>

          {/* Caja Actual */}
          <div className="apple-card" style={{ padding: '20px', minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Caja Actual</span>
              <div className="dash-icon" style={{ backgroundColor: '#f3f4f6', color: '#1f2937' }}><Wallet size={18} /></div>
            </div>
            <div className="dash-metric" style={{ marginTop: '12px' }}>
              <span className="dash-metric-value">{formatCurrency(cajaActual)}</span>
            </div>
          </div>

          {/* Saldo Bancos */}
          <div className="apple-card" style={{ padding: '20px', minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Saldo Bancos</span>
              <div className="dash-icon" style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}><PiggyBank size={18} /></div>
            </div>
            <div className="dash-metric" style={{ marginTop: '12px' }}>
              <span className="dash-metric-value">{formatCurrency(saldoBancos)}</span>
            </div>
          </div>

          {/* Resultado Operativo Acumulado */}
          <div 
            className="apple-card" 
            style={{ padding: '20px', minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', cursor: 'pointer', transition: 'all 0.2s ease' }}
            onClick={() => setSelectedOpAcumDetailOpen(true)}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e40af' }}>Res. Operativo Acum.</span>
              <div className="dash-icon" style={{ backgroundColor: '#3b82f6', color: '#ffffff' }}><Calculator size={18} /></div>
            </div>
            <div className="dash-metric" style={{ marginTop: '12px' }}>
              <span className="dash-metric-value" style={{ color: '#1d4ed8' }}>{formatCurrency(resultadoOperativoAcumulado)}</span>
            </div>
          </div>
        </div>

        {/* FILA 2 */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          {/* Ventas del Período */}
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

          {/* Ganancia Bruta (del Período) */}
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

          {/* Stock Valorizado */}
          <div className="apple-card" style={{ padding: '20px', minHeight: '120px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Stock Valorizado</span>
              <div className="dash-icon" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}><PackageIcon size={18} /></div>
            </div>
            <div className="dash-metric" style={{ marginTop: '12px' }}>
              <span className="dash-metric-value" style={{ fontSize: '32px' }}>{formatCurrency(stockValorizado)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* MÉTRICAS AVANZADAS (Colapsables) */}
      <div style={{ marginBottom: '40px' }}>
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="btn-secondary"
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)' }}
        >
          <span style={{ fontSize: '16px', fontWeight: 600 }}>Ver métricas avanzadas</span>
          <span style={{ color: 'var(--text-secondary)' }}>{showAdvanced ? '▲ Ocultar' : '▼ Mostrar'}</span>
        </button>

        {showAdvanced && (
          <div style={{ marginTop: '24px', animation: 'fadeIn 0.3s ease' }}>
            {/* ESTADO ACTUAL - SECUNDARIAS */}
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>Estado Financiero y Patrimonio</h3>
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              <div className="apple-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Billeteras Virtuales</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>{formatCurrency(billeterasActual)}</div>
              </div>
              <div className="apple-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cuentas por Cobrar</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>{formatCurrency(porCobrar)}</div>
              </div>
              <div className="apple-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cuentas por Pagar</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>{formatCurrency(porPagar)}</div>
              </div>
              <div className="apple-card" style={{ padding: '16px', backgroundColor: '#e2f9ec', border: '1px solid #a7f3d0' }}>
                <span style={{ fontSize: '13px', color: '#065f46' }}>Patrimonio Estimado</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px', color: '#047857' }}>{formatCurrency(patrimonioEstimado)}</div>
              </div>
            </div>

            {/* PERÍODO - SECUNDARIAS */}
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>Rendimiento del Período</h3>
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="apple-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Resultado Operativo</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px', color: currentMetrics.resultadoOperativo >= 0 ? '#1d4ed8' : '#dc2626' }}>{formatCurrency(currentMetrics.resultadoOperativo)}</div>
                {renderTrend(currentMetrics.resultadoOperativo, comparisonMetrics.resultadoOperativo, formatCurrency)}
              </div>
              <div className="apple-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Gastos Operativos</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px', color: '#dc2626' }}>{formatCurrency(currentMetrics.gastosOperativos)}</div>
                {renderTrend(currentMetrics.gastosOperativos, comparisonMetrics.gastosOperativos, formatCurrency, true)}
              </div>
              <div className="apple-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Compras del Período</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>{formatCurrency(currentMetrics.totalCompras)}</div>
                {renderTrend(currentMetrics.totalCompras, comparisonMetrics.totalCompras, formatCurrency, true)}
              </div>
              <div className="apple-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Margen Comercial</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>{currentMetrics.margenBruto.toFixed(1)}%</div>
                {renderTrend(currentMetrics.margenBruto, comparisonMetrics.margenBruto, (v) => `${v.toFixed(1)}%`)}
              </div>
              
              {/* Actividad Operativa */}
              <div className="apple-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cantidad de Pedidos</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>{formatNumber(currentMetrics.cantidadPedidos)}</div>
                {renderTrend(currentMetrics.cantidadPedidos, comparisonMetrics.cantidadPedidos, formatNumber)}
              </div>
              <div className="apple-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Remitos Emitidos</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>{formatNumber(currentMetrics.cantidadRemitos)}</div>
                {renderTrend(currentMetrics.cantidadRemitos, comparisonMetrics.cantidadRemitos, formatNumber)}
              </div>
              <div className="apple-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Clientes Activos</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>{formatNumber(currentMetrics.clientesUnicos)}</div>
                {renderTrend(currentMetrics.clientesUnicos, comparisonMetrics.clientesUnicos, formatNumber)}
              </div>
              <div className="apple-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Proveedores Utilizados</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>{formatNumber(currentMetrics.proveedoresUtilizados)}</div>
                {renderTrend(currentMetrics.proveedoresUtilizados, comparisonMetrics.proveedoresUtilizados, formatNumber)}
              </div>
              
              {/* Producción */}
              <div className="apple-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Kg Producidos</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>{formatKg(currentMetrics.kgProducidos)}</div>
                {renderTrend(currentMetrics.kgProducidos, comparisonMetrics.kgProducidos, formatKg)}
              </div>
              <div className="apple-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Paquetes Producidos</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>{formatNumber(currentMetrics.paquetesProducidos)}</div>
                {renderTrend(currentMetrics.paquetesProducidos, comparisonMetrics.paquetesProducidos, formatNumber)}
              </div>
              <div className="apple-card" style={{ padding: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Producciones Realizadas</span>
                <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '8px' }}>{formatNumber(currentMetrics.produccionesRealizadas)}</div>
                {renderTrend(currentMetrics.produccionesRealizadas, comparisonMetrics.produccionesRealizadas, formatNumber)}
              </div>
            </div>
          </div>
        )}
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
            cost = Number(sale.costoTotal) || 0;
          } else {
            cost = (sale.items || []).reduce((itemAcc, item) => {
              if (item.costoTotalHistorico !== undefined) return itemAcc + (Number(item.costoTotalHistorico) || 0);
              if (item.costoTotal !== undefined) return itemAcc + (Number(item.costoTotal) || 0);
              const prod = cacheStock.products.find(p => p.id === item.productId);
              return itemAcc + ((Number(item.cantidad) || 0) * (Number(prod?.costoActual) || 0));
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
          venta: acc.venta + (Number(curr.venta) || 0),
          costo: acc.costo + (Number(curr.costo) || 0),
          ganancia: acc.ganancia + (Number(curr.ganancia) || 0)
        }), { venta: 0, costo: 0, ganancia: 0 });

        return (
          <AnalyticsModal
            isOpen={true}
            onClose={() => setSelectedProfitDetailOpen(false)}
            title="Ganancia Bruta"
            subtitle="Desglose de operaciones del período seleccionado"
          >
            <div className="analytics-card">
              <div className="analytics-card-title">
                <Wallet size={18} /> Detalle de Ventas y Costos
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th className="right-align">Venta</th>
                      <th className="right-align">Costo</th>
                      <th className="right-align">Ganancia</th>
                      <th className="right-align">Margen %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitDetailSales.map(row => (
                      <tr key={row.id}>
                        <td>{row.fecha}</td>
                        <td>{row.cliente}</td>
                        <td className="right-align">{formatCurrency(row.venta)}</td>
                        <td className="right-align">{formatCurrency(row.costo)}</td>
                        <td className="right-align" style={{ color: row.ganancia >= 0 ? '#15803d' : '#b91c1c', fontWeight: 500 }}>
                          {formatCurrency(row.ganancia)}
                        </td>
                        <td className="right-align">{row.margen.toFixed(1)}%</td>
                      </tr>
                    ))}
                    {profitDetailSales.length === 0 && (
                      <tr>
                        <td colSpan={6} className="analytics-empty-state">No hay ventas en este período.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="analytics-footer-summary">
                <div style={{ color: '#6b7280' }}>Totales ({profitDetailSales.length} op)</div>
                <div>Ventas: {formatCurrency(profitTotals.venta)}</div>
                <div>Costos: {formatCurrency(profitTotals.costo)}</div>
                <div style={{ color: profitTotals.ganancia >= 0 ? '#15803d' : '#b91c1c' }}>Ganancia: {formatCurrency(profitTotals.ganancia)}</div>
                <div>Margen: {profitTotals.venta > 0 ? ((profitTotals.ganancia / profitTotals.venta) * 100).toFixed(1) : 0}%</div>
              </div>
            </div>
          </AnalyticsModal>
        );
      })()}

      {/* --- MODAL DETALLE DE RESULTADO OPERATIVO ACUMULADO --- */}
      {selectedOpAcumDetailOpen && (() => {
        const histVentas = cacheVentas.sales.filter(s => s.status !== 'ANULADO').map(sale => {
          let cost = 0;
          if (sale.isHistorical && sale.costoTotal !== undefined) {
            cost = Number(sale.costoTotal) || 0;
          } else {
            cost = (sale.items || []).reduce((itemAcc, item) => {
              if (item.costoTotalHistorico !== undefined) return itemAcc + (Number(item.costoTotalHistorico) || 0);
              if (item.costoTotal !== undefined) return itemAcc + (Number(item.costoTotal) || 0);
              const prod = cacheStock.products.find(p => p.id === item.productId);
              if (prod) {
                const qty = prod.unitType === 'KG' ? (Number(item.pesoReal) || Number(item.cantidad) || 0) : (Number(item.cantidad) || 0);
                return itemAcc + (qty * (Number(prod.costoActual) || Number(prod.costoUltimaCompra) || 0));
              }
              return itemAcc;
            }, 0);
          }
          const ganancia = sale.totalAmount - cost;
          const customer = cacheClientes.customers.find(c => c.id === sale.customerId);
          const customerName = customer ? (customer.razonSocial || customer.nombre) : 'Cliente Desconocido';
          return {
            id: sale.id,
            fecha: new Date(sale.date).toLocaleDateString('es-AR'),
            cliente: customerName,
            venta: sale.totalAmount,
            costo: cost,
            ganancia,
            rawDate: new Date(sale.date).getTime()
          };
        }).sort((a, b) => b.rawDate - a.rawDate);

        const totalVentasHist = histVentas.reduce((acc, v) => acc + (Number(v.venta) || 0), 0);
        const totalCmvHist = histVentas.reduce((acc, v) => acc + (Number(v.costo) || 0), 0);
        const gananciaBrutaAcumulada = totalVentasHist - totalCmvHist;

        const excludeCategories = [
          'COMPRA_PROVEEDOR', 'SOCIOS', 'APORTE_SOCIOS_INICIAL',
          'ANULACION', 'ANULACION_VENTA', 'ANULACION_COMPRA',
          'SALDO_INICIAL', 'TRANSFERENCIA', 'MOVIMIENTO_INTERNO'
        ];
        
        const histGastos = cacheCaja.movements
          .filter(m => m.type === 'EXPENSE')
          .filter(m => !excludeCategories.includes((m.category || '').toUpperCase()))
          .map(m => ({
            id: m.id,
            fecha: new Date(m.date).toLocaleDateString('es-AR'),
            categoria: m.category || 'Sin Categoría',
            descripcion: m.description || '',
            importe: Number(m.amount) || 0,
            rawDate: new Date(m.date).getTime()
          }))
          .sort((a, b) => b.rawDate - a.rawDate);
          
        const totalGastosAcumulados = histGastos.reduce((acc, g) => acc + (Number(g.importe) || 0), 0);
        const resultadoOperativoAcumuladoFinal = gananciaBrutaAcumulada - totalGastosAcumulados;

        const gastosPorCategoria = histGastos.reduce((acc, g) => {
          acc[g.categoria] = (acc[g.categoria] || 0) + (Number(g.importe) || 0);
          return acc;
        }, {} as Record<string, number>);
        
        const gastosPorCategoriaArr = Object.entries(gastosPorCategoria)
          .map(([categoria, total]) => ({ categoria, total }))
          .sort((a, b) => b.total - a.total);

        const visibleVentas = histVentas.slice(0, 100);
        const visibleGastos = histGastos.slice(0, 100);

        return (
          <AnalyticsModal
            isOpen={true}
            onClose={() => setSelectedOpAcumDetailOpen(false)}
            title="Resultado Operativo Acumulado"
            subtitle="Desglose financiero histórico completo"
          >
            {/* RESUMEN ACUMULADO */}
            <div className="analytics-card" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="analytics-card-title" style={{ color: '#0f172a' }}>
                <TrendingUp size={18} color="#3b82f6" /> Resumen Histórico Global
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Ventas Históricas Totales</span>
                  <span style={{ fontWeight: 500 }}>{formatCurrency(totalVentasHist)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>(-) CMV Histórico Acumulado</span>
                  <span style={{ fontWeight: 500 }}>{formatCurrency(totalCmvHist)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '1px solid #cbd5e1' }}>
                  <span style={{ fontWeight: 600 }}>(=) Ganancia Bruta Acumulada</span>
                  <span style={{ fontWeight: 600, color: gananciaBrutaAcumulada >= 0 ? '#15803d' : '#b91c1c' }}>{formatCurrency(gananciaBrutaAcumulada)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px' }}>
                  <span style={{ color: '#64748b' }}>(-) Gastos Operativos Acumulados</span>
                  <span style={{ fontWeight: 500, color: '#dc2626' }}>{formatCurrency(totalGastosAcumulados)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', borderTop: '2px solid #cbd5e1' }}>
                  <span style={{ fontWeight: 700, fontSize: '16px', color: '#1e40af' }}>(=) Resultado Operativo Final</span>
                  <span style={{ fontWeight: 700, fontSize: '20px', color: resultadoOperativoAcumuladoFinal >= 0 ? '#1d4ed8' : '#dc2626' }}>{formatCurrency(resultadoOperativoAcumuladoFinal)}</span>
                </div>
              </div>
            </div>

            {/* GASTOS POR CATEGORÍA */}
            <div className="analytics-card">
              <div className="analytics-card-title">
                <Layers size={18} color="#f59e0b" /> Gastos por Categoría
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                {gastosPorCategoriaArr.map(cat => (
                  <div key={cat.categoria} style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '10px', border: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: '13px', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.05em' }}>{cat.categoria}</div>
                    <div style={{ fontWeight: 700, fontSize: '18px', color: '#dc2626' }}>{formatCurrency(cat.total)}</div>
                  </div>
                ))}
                {gastosPorCategoriaArr.length === 0 && <div className="analytics-empty-state">No hay gastos registrados.</div>}
              </div>
            </div>

            {/* DETALLE DE GASTOS */}
            <div className="analytics-card">
              <div className="analytics-card-title" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} color="#ef4444" /> Detalle de Gastos Operativos
                </div>
                <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 400 }}>Mostrando {visibleGastos.length} de {histGastos.length}</span>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Categoría</th>
                      <th>Descripción</th>
                      <th className="right-align">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleGastos.map(row => (
                      <tr key={row.id}>
                        <td>{row.fecha}</td>
                        <td>{row.categoria}</td>
                        <td>{row.descripcion}</td>
                        <td className="right-align" style={{ color: '#dc2626', fontWeight: 500 }}>{formatCurrency(row.importe)}</td>
                      </tr>
                    ))}
                    {visibleGastos.length === 0 && (
                      <tr>
                        <td colSpan={4} className="analytics-empty-state">No hay gastos para mostrar.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DETALLE DE VENTAS */}
            <div className="analytics-card">
              <div className="analytics-card-title" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Wallet size={18} color="#10b981" /> Detalle de Ventas Utilizadas
                </div>
                <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 400 }}>Mostrando {visibleVentas.length} de {histVentas.length}</span>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th className="right-align">Venta</th>
                      <th className="right-align">Costo</th>
                      <th className="right-align">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleVentas.map(row => (
                      <tr key={row.id}>
                        <td>{row.fecha}</td>
                        <td>{row.cliente}</td>
                        <td className="right-align">{formatCurrency(row.venta)}</td>
                        <td className="right-align">{formatCurrency(row.costo)}</td>
                        <td className="right-align" style={{ color: row.ganancia >= 0 ? '#15803d' : '#b91c1c', fontWeight: 500 }}>{formatCurrency(row.ganancia)}</td>
                      </tr>
                    ))}
                    {visibleVentas.length === 0 && (
                      <tr>
                        <td colSpan={5} className="analytics-empty-state">No hay ventas para mostrar.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </AnalyticsModal>
        );
      })()}

      {/* --- MODAL DETALLE DE PATRIMONIO ESTIMADO --- */}
      {selectedPatrimonioOpen && (
        <div className="modal-overlay open" onClick={() => setSelectedPatrimonioOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px', width: '95%', padding: 0, borderRadius: '12px', overflow: 'hidden' }}>
            
            {/* HEADER */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>DESGLOSE DE PATRIMONIO</h2>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>Composición actual del Patrimonio del negocio</p>
              </div>
              <button onClick={() => setSelectedPatrimonioOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af' }}>
                <X size={24} />
              </button>
            </div>

            {/* BODY */}
            <div style={{ padding: '24px', backgroundColor: '#f9fafb', maxHeight: '70vh', overflowY: 'auto' }}>
              
              {/* BLOQUE 1: ACTIVOS */}
              <div className="apple-card" style={{ padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                  ACTIVOS
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#4b5563' }}>Caja / Efectivo</span>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(cajaActual)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#4b5563' }}>Saldo Bancario</span>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(saldoBancos)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#4b5563' }}>Billeteras Virtuales</span>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(billeterasActual)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#4b5563' }}>Cuentas por Cobrar</span>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(porCobrar)}</span>
                  </div>
                  <div 
                    style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', padding: '6px', borderRadius: '6px', transition: 'background-color 0.2s ease', margin: '-6px' }}
                    onClick={() => setSelectedStockValorizadoOpen(true)}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span style={{ color: '#4b5563', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      Stock Valorizado
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>↗</span>
                    </span>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(stockValorizado)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid #e5e7eb', marginTop: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#111827' }}>TOTAL ACTIVOS</span>
                    <span style={{ fontWeight: 700, color: '#10b981' }}>{formatCurrency(totalDisponible + porCobrar + stockValorizado)}</span>
                  </div>
                </div>
              </div>

              {/* BLOQUE 2: PASIVOS */}
              <div className="apple-card" style={{ padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                  PASIVOS
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#4b5563' }}>Proveedores por Pagar</span>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(porPagar)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#4b5563' }}>Préstamos Pendientes</span>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(prestamosPendientes)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid #e5e7eb', marginTop: '4px' }}>
                    <span style={{ fontWeight: 700, color: '#111827' }}>TOTAL PASIVOS</span>
                    <span style={{ fontWeight: 700, color: '#ef4444' }}>{formatCurrency(porPagar + prestamosPendientes)}</span>
                  </div>
                </div>
              </div>

              {/* BLOQUE 3: PATRIMONIO NETO */}
              <div className="apple-card" style={{ padding: '20px', marginBottom: '20px', backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e40af', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div>
                  PATRIMONIO NETO
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#1e40af', fontWeight: 600 }}>Patrimonio Estimado</span>
                  <span style={{ fontWeight: 700, fontSize: '20px', color: '#1d4ed8' }}>{formatCurrency(patrimonioEstimado)}</span>
                </div>
              </div>

              {/* BLOQUE 4: COMPOSICIÓN DEL PATRIMONIO */}
              <div className="apple-card" style={{ padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>COMPOSICIÓN DEL PATRIMONIO</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#4b5563' }}>Capital Aportado por Socios</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(capitalAportadoSocios)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#4b5563' }}>{resultadoGenerado >= 0 ? 'Resultado Generado' : 'Pérdida Acumulada'}</span>
                    <span style={{ fontWeight: 700, color: resultadoGenerado >= 0 ? '#10b981' : '#ef4444' }}>
                      {formatCurrency(resultadoGenerado)}
                    </span>
                  </div>
                  <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px dashed #d1d5db', textAlign: 'center', color: '#6b7280', fontSize: '14px', fontStyle: 'italic' }}>
                    FÓRMULA VISUAL<br/>
                    <span style={{ fontWeight: 600, color: '#3b82f6' }}>Patrimonio</span> = Capital Aportado {resultadoGenerado >= 0 ? '+' : '-'} {resultadoGenerado >= 0 ? 'Resultado Generado' : 'Pérdida Acumulada'}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DETALLE DE STOCK VALORIZADO --- */}
      {selectedStockValorizadoOpen && (() => {
        const stockItems = cacheStock.products
          .filter(p => p.activo)
          .map(p => {
            const stock = Math.max(0, p.stockActual || 0);
            const costo = p.costoActual || p.costoUltimaCompra || 0;
            const valorizacion = stock * costo;
            const isSinCosto = stock > 0 && costo === 0;
            return {
              id: p.id,
              nombre: p.nombre,
              tipo: p.type,
              stock,
              unitType: p.unitType,
              costo,
              valorizacion,
              isSinCosto
            };
          })
          .filter(item => item.stock > 0)
          .sort((a, b) => b.valorizacion - a.valorizacion);

        const totalStockValorizado = stockItems.reduce((acc, curr) => acc + (Number(curr.valorizacion) || 0), 0);

        return (
          <div className="modal-overlay open" onClick={() => setSelectedStockValorizadoOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '1000px', width: '95%', padding: 0, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>DESGLOSE DE STOCK VALORIZADO</h2>
                  <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>Composición detallada del capital inmovilizado en stock</p>
                </div>
                <button onClick={() => setSelectedStockValorizadoOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af' }}>
                  <X size={24} />
                </button>
              </div>

              <div style={{ padding: '24px', backgroundColor: '#f9fafb', maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="apple-card" style={{ padding: '0', overflow: 'hidden' }}>
                  <table className="analytics-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: '13px' }}>Producto</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: '13px' }}>Tipo</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: '13px' }}>Stock</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: '13px' }}>Costo Unitario</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f3f4f6', color: '#374151', fontWeight: 600, fontSize: '13px' }}>Valorización</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockItems.map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {item.nombre}
                              {item.isSinCosto && (
                                <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Sin costo</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>{item.tipo}</td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#111827', textAlign: 'right', fontWeight: 500 }}>
                            {item.stock.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {item.unitType === 'KG' ? 'kg' : item.unitType === 'UNIDADES' ? 'un' : item.unitType?.toLowerCase() || ''}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#4b5563', textAlign: 'right' }}>
                            {formatCurrency(item.costo)}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', color: '#047857', textAlign: 'right', fontWeight: 600 }}>
                            {formatCurrency(item.valorizacion)}
                          </td>
                        </tr>
                      ))}
                      {stockItems.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>No hay productos activos con stock.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* FOOTER TOTALS */}
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '24px', backgroundColor: '#ffffff', padding: '16px 24px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Cantidad de Productos</div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>{stockItems.length}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>Total Stock Valorizado</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#10b981' }}>{formatCurrency(totalStockValorizado)}</div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
