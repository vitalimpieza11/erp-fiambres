import { useMemo } from 'react';
import { useDashboardCache } from './useDashboardCache';
import ExpandableCard from '../../components/ExpandableCard';
import { 
  Wallet, 
  TrendingUp, 
  ShoppingCart, 
  Package, 
  Truck, 
  Users, 
  AlertCircle,
  AlertTriangle
} from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  const {
    cacheCaja,
    cacheStock,
    cacheVentas,
    cacheCompras,
    cacheProveedores,
    cacheClientes,
    loading
  } = useDashboardCache();

  // FORMATTER
  const formatCurrency = (val: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

  // DATES
  const today = new Date();
  const startOfMonthStr = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  // SECTION 1: CAJA
  const { currentBalance, ingresosMes, egresosMes } = cacheCaja;
  const flujoNeto = ingresosMes - egresosMes;

  // SECTION 2: VENTAS
  const ventasDelMes = useMemo(() => {
    return cacheVentas.sales.filter(s => s.date >= startOfMonthStr && s.status !== 'ANULADO').reduce((acc, s) => acc + s.totalAmount, 0);
  }, [cacheVentas.sales, startOfMonthStr]);
  
  const ventasPendientesCobro = useMemo(() => {
    return cacheVentas.sales.filter(s => s.status === 'FACTURADO' && s.paymentMethod === 'PENDIENTE').reduce((acc, s) => acc + s.totalAmount, 0);
  }, [cacheVentas.sales]);

  const ventasCobradas = useMemo(() => {
    return cacheVentas.sales.filter(s => s.status === 'COBRADO' && s.paymentMethod === 'EFECTIVO_TRANSFERENCIA').reduce((acc, s) => acc + s.totalAmount, 0);
  }, [cacheVentas.sales]);

  const cuentaCorrienteGeneradaVentas = useMemo(() => {
    return cacheVentas.sales.filter(s => s.status === 'COBRADO' && s.paymentMethod === 'CUENTA_CORRIENTE' && s.date >= startOfMonthStr).reduce((acc, s) => acc + s.totalAmount, 0);
  }, [cacheVentas.sales, startOfMonthStr]);

  // SECTION 3: COMPRAS
  const comprasDelMes = useMemo(() => {
    return cacheCompras.purchases.filter(p => p.date >= startOfMonthStr && p.type === 'PURCHASE').reduce((acc, p) => acc + p.total, 0);
  }, [cacheCompras.purchases, startOfMonthStr]);

  const comprasPagadasMes = useMemo(() => {
    return cacheCompras.purchases.filter(p => p.date >= startOfMonthStr && p.type === 'PURCHASE').reduce((acc, p) => acc + p.montoPagado, 0);
  }, [cacheCompras.purchases, startOfMonthStr]);

  const comprasCCMes = useMemo(() => {
    return cacheCompras.purchases.filter(p => p.date >= startOfMonthStr && p.type === 'PURCHASE').reduce((acc, p) => acc + p.montoCuentaCorriente, 0);
  }, [cacheCompras.purchases, startOfMonthStr]);

  // SECTION 4: STOCK
  const { stockMercaderias, stockInsumos, stockTerminados } = useMemo(() => {
    let m = 0, i = 0, t = 0;
    cacheStock.products.forEach(p => {
      if (p.type === 'MERCADERIA') m += (p.stockActual || 0);
      else if (p.type === 'INSUMO') i += (p.stockActual || 0);
      else t += (p.stockActual || 0);
    });
    return { stockMercaderias: m, stockInsumos: i, stockTerminados: t };
  }, [cacheStock.products]);

  // ALERTAS DE STOCK
  const alertasStockBajo = useMemo(() => {
    return cacheStock.products.filter(p => p.stockActual !== undefined && p.stockActual <= 10 && p.stockActual > 0).length;
  }, [cacheStock.products]);

  const alertasSinStock = useMemo(() => {
    return cacheStock.products.filter(p => p.stockActual !== undefined && p.stockActual <= 0).length;
  }, [cacheStock.products]);

  // SECTION 5: PROVEEDORES
  const deudaTotalProveedores = useMemo(() => {
    return cacheProveedores.movements.reduce((acc, m) => {
      if (m.type === 'COMPRA') return acc + m.amount;
      if (m.type === 'PAGO') return acc - m.amount;
      if (m.type === 'AJUSTE' || m.type === 'ANULACION') return acc + m.amount;
      return acc;
    }, 0);
  }, [cacheProveedores.movements]);
  
  const movsProveedoresMes = useMemo(() => {
    return cacheProveedores.movements.filter(m => m.date >= startOfMonthStr).length;
  }, [cacheProveedores.movements, startOfMonthStr]);

  const pagosRealizadosMes = useMemo(() => {
    return cacheProveedores.movements.filter(m => m.date >= startOfMonthStr && m.type === 'PAGO').reduce((acc, m) => acc + m.amount, 0);
  }, [cacheProveedores.movements, startOfMonthStr]);

  // SECTION 6: CLIENTES
  const deudaTotalClientes = useMemo(() => {
    return cacheClientes.movements.reduce((acc, m) => {
      if (m.type === 'DEUDA') return acc + m.amount;
      if (m.type === 'PAGO') return acc - m.amount;
      if (m.type === 'AJUSTE') return acc + m.amount;
      return acc;
    }, 0);
  }, [cacheClientes.movements]);

  const clientesActivos = useMemo(() => {
    return cacheClientes.customers.filter(c => c.activo).length;
  }, [cacheClientes.customers]);

  const movsClientesMes = useMemo(() => {
    return cacheClientes.movements.filter(m => m.date >= startOfMonthStr).length;
  }, [cacheClientes.movements, startOfMonthStr]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Sincronizando capa operativa...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-v2-container">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="dashboard-subtitle">Resumen general del negocio</p>
        </div>
      </div>

      {/* ALERTAS VISUALES */}
      <div className="alerts-grid">
        {alertasSinStock > 0 && (
          <div className="alert-card danger">
            <div className="alert-icon"><AlertCircle size={24} /></div>
            <div className="alert-content">
              <strong>{alertasSinStock} productos sin stock</strong>
              <button>Ver productos</button>
            </div>
          </div>
        )}
        {alertasStockBajo > 0 && (
          <div className="alert-card warning">
            <div className="alert-icon"><AlertTriangle size={24} /></div>
            <div className="alert-content">
              <strong>{alertasStockBajo} productos con stock bajo</strong>
              <button>Ver productos</button>
            </div>
          </div>
        )}
        {ventasPendientesCobro > 0 && (
          <div className="alert-card info">
            <div className="alert-icon"><Wallet size={24} /></div>
            <div className="alert-content">
              <strong>Cobros pendientes</strong>
              <button>Ver ventas</button>
            </div>
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        {/* SECCIÓN 1 - RESUMEN FINANCIERO */}
        <ExpandableCard
          title={
            <div className="dash-card-title-content">
              <span className="dash-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}><Wallet size={20} /></span>
              Caja Actual
            </div>
          }
          collapsedContent={
            <div className="dash-metric">
              <span className={`dash-metric-value ${currentBalance >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(currentBalance)}
              </span>
              <span className="dash-metric-label">Disponible</span>
            </div>
          }
          expandedContent={
            <>
              <div className="dash-metric-row">
                <span className="dash-metric-label">Ingresos del Mes</span>
                <span className="dash-metric-value positive">{formatCurrency(ingresosMes)}</span>
              </div>
              <div className="dash-metric-row">
                <span className="dash-metric-label">Egresos del Mes</span>
                <span className="dash-metric-value negative">{formatCurrency(egresosMes)}</span>
              </div>
              <div className="dash-metric-row">
                <span className="dash-metric-label">Flujo Neto</span>
                <span className={`dash-metric-value ${flujoNeto >= 0 ? 'positive' : 'negative'}`}>
                  {formatCurrency(flujoNeto)}
                </span>
              </div>
            </>
          }
        />

        {/* SECCIÓN 2 - VENTAS */}
        <ExpandableCard
          title={
            <div className="dash-card-title-content">
              <span className="dash-icon" style={{ background: '#dcfce7', color: '#16a34a' }}><TrendingUp size={20} /></span>
              Ventas del Mes
            </div>
          }
          collapsedContent={
            <div className="dash-metric">
              <span className="dash-metric-value">{formatCurrency(ventasDelMes)}</span>
              <span className="dash-metric-label positive">+ vs mes anterior</span>
            </div>
          }
          expandedContent={
            <>
              <div className="dash-metric-row">
                <span className="dash-metric-label">Cobradas</span>
                <span className="dash-metric-value positive">{formatCurrency(ventasCobradas)}</span>
              </div>
              <div className="dash-metric-row">
                <span className="dash-metric-label">Cta. Corriente</span>
                <span className="dash-metric-value">{formatCurrency(cuentaCorrienteGeneradaVentas)}</span>
              </div>
              <div className="dash-metric-row">
                <span className="dash-metric-label">Pendientes Cobro</span>
                <span className="dash-metric-value negative">{formatCurrency(ventasPendientesCobro)}</span>
              </div>
            </>
          }
        />

        {/* SECCIÓN 3 - COMPRAS */}
        <ExpandableCard
          title={
            <div className="dash-card-title-content">
              <span className="dash-icon" style={{ background: '#f3e8ff', color: '#9333ea' }}><ShoppingCart size={20} /></span>
              Compras del Mes
            </div>
          }
          collapsedContent={
            <div className="dash-metric">
              <span className="dash-metric-value">{formatCurrency(comprasDelMes)}</span>
              <span className="dash-metric-label">Total en el mes</span>
            </div>
          }
          expandedContent={
            <>
              <div className="dash-metric-row">
                <span className="dash-metric-label">Pagadas</span>
                <span className="dash-metric-value">{formatCurrency(comprasPagadasMes)}</span>
              </div>
              <div className="dash-metric-row">
                <span className="dash-metric-label">En Cta. Corriente</span>
                <span className="dash-metric-value">{formatCurrency(comprasCCMes)}</span>
              </div>
            </>
          }
        />

        {/* SECCIÓN 4 - STOCK */}
        <ExpandableCard
          title={
            <div className="dash-card-title-content">
              <span className="dash-icon" style={{ background: '#ffedd5', color: '#ea580c' }}><Package size={20} /></span>
              Stock Derivado
            </div>
          }
          collapsedContent={
            <div className="dash-metric">
              <span className="dash-metric-value">{(stockMercaderias + stockInsumos + stockTerminados).toLocaleString('es-AR')}</span>
              <span className="dash-metric-label">Ítems totales</span>
            </div>
          }
          expandedContent={
            <>
              <div className="dash-metric-row">
                <span className="dash-metric-label">Mercaderías</span>
                <span className="dash-metric-value">{stockMercaderias.toLocaleString('es-AR')}</span>
              </div>
              <div className="dash-metric-row">
                <span className="dash-metric-label">Insumos</span>
                <span className="dash-metric-value">{stockInsumos.toLocaleString('es-AR')}</span>
              </div>
              <div className="dash-metric-row">
                <span className="dash-metric-label">Terminados</span>
                <span className="dash-metric-value">{stockTerminados.toLocaleString('es-AR')}</span>
              </div>
            </>
          }
        />

        {/* SECCIÓN 5 - PROVEEDORES */}
        <ExpandableCard
          title={
            <div className="dash-card-title-content">
              <span className="dash-icon" style={{ background: '#fee2e2', color: '#dc2626' }}><Truck size={20} /></span>
              Proveedores
            </div>
          }
          collapsedContent={
            <div className="dash-metric">
              <span className="dash-metric-value negative">{formatCurrency(deudaTotalProveedores)}</span>
              <span className="dash-metric-label">Deuda Total</span>
            </div>
          }
          expandedContent={
            <>
              <div className="dash-metric-row">
                <span className="dash-metric-label">Pagos del Mes</span>
                <span className="dash-metric-value positive">{formatCurrency(pagosRealizadosMes)}</span>
              </div>
              <div className="dash-metric-row">
                <span className="dash-metric-label">Movs. Mes</span>
                <span className="dash-metric-value">{movsProveedoresMes}</span>
              </div>
            </>
          }
        />

        {/* SECCIÓN 6 - CLIENTES */}
        <ExpandableCard
          title={
            <div className="dash-card-title-content">
              <span className="dash-icon" style={{ background: '#e0e7ff', color: '#4f46e5' }}><Users size={20} /></span>
              Clientes
            </div>
          }
          collapsedContent={
            <div className="dash-metric">
              <span className="dash-metric-value positive">{formatCurrency(deudaTotalClientes)}</span>
              <span className="dash-metric-label">Deuda a Favor</span>
            </div>
          }
          expandedContent={
            <>
              <div className="dash-metric-row">
                <span className="dash-metric-label">Clientes Activos</span>
                <span className="dash-metric-value">{clientesActivos}</span>
              </div>
              <div className="dash-metric-row">
                <span className="dash-metric-label">Movs. Mes</span>
                <span className="dash-metric-value">{movsClientesMes}</span>
              </div>
            </>
          }
        />
      </div>
    </div>
  );
}
