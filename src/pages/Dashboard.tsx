import React, { useState, useMemo } from 'react';
import { 
  Activity, TrendingUp, Package, Wallet, Landmark, BarChart3, Clock, ArrowUpRight, ArrowDownRight, Users, CheckCircle2, AlertTriangle, Box
} from 'lucide-react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { Card, CardHeader } from '../components/ui/Card';
import { LoadingSpinner, ErrorState } from '../components/AsyncState';
import { Table } from '../components/ui/Table';
import { useSales } from '../hooks/useSales';
import { useCashMovements } from '../hooks/useCashMovements';
import { useStockMovements } from '../hooks/useStockMovements';
import { useMercaderias } from '../hooks/useMercaderias';
import { useInsumos } from '../hooks/useInsumos';
import { usePresentaciones } from '../hooks/usePresentaciones';
import { useCustomers } from '../hooks/useCustomers';
import { useSuppliers } from '../hooks/useSuppliers';
import { usePurchases } from '../hooks/usePurchases';
import { usePartnerTransactions } from '../hooks/usePartnerTransactions';
import { formatCurrency, formatNumber } from '../utils/format';

const CAPITAL_CATEGORIES = ['aporte_socio', 'inversion_inicial', 'bien_capital', 'maquinaria', 'tecnologia', 'vehiculos', 'vehiculo', 'equipamiento', 'herramientas'];

export const Dashboard = () => {
  const { sales, loading: loadingSales, error: errorSales } = useSales();
  const { mercaderias, loading: loadingMercaderias, error: errorMercaderias } = useMercaderias();
  const { insumos, loading: loadingInsumos, error: errorInsumos } = useInsumos();
  const { presentaciones, loading: loadingPresentaciones, error: errorPresentaciones } = usePresentaciones();
  const { customers, loading: loadingCustomers, error: errorCustomers } = useCustomers();
  const { suppliers, loading: loadingSuppliers, error: errorSuppliers } = useSuppliers();
  const { movements, loading: loadingMovements, error: errorMovements } = useCashMovements();
  const { productStocks, loading: loadingStocks, error: errorStocks } = useStockMovements();
  const { purchases, loading: loadingPurchases, error: errorPurchases } = usePurchases();
  const { transactions, loading: loadingTrans, error: errorTrans } = usePartnerTransactions();

  const [activeTab, setActiveTab] = useState<'ejecutivo' | 'comercial' | 'stock' | 'rentabilidad' | 'flujo' | 'valor'>('ejecutivo');

  const loading = loadingSales || loadingMercaderias || loadingInsumos || loadingPresentaciones || loadingCustomers || loadingSuppliers || loadingMovements || loadingStocks || loadingPurchases || loadingTrans;
  const error = errorSales || errorMercaderias || errorInsumos || errorPresentaciones || errorCustomers || errorSuppliers || errorMovements || errorStocks || errorPurchases || errorTrans;

  // 1. Stock Valorizado
  const stockValorizado = useMemo(() => {
    let totalMercaderia = 0;
    let totalInsumos = 0;
    let totalProductoTerminado = 0;

    const list: any[] = [];

    mercaderias.forEach(m => {
      const qty = productStocks[m.id!] || 0;
      if (qty <= 0) return;
      const total = qty * m.costoKg;
      totalMercaderia += total;
      list.push({ id: m.id, type: 'Mercadería', name: m.name, qty, cost: m.costoKg, total });
    });

    insumos.forEach(i => {
      const qty = productStocks[i.id!] || 0;
      if (qty <= 0) return;
      const total = qty * i.costoUnitario;
      totalInsumos += total;
      list.push({ id: i.id, type: i.name.toLowerCase().includes('bolsa') || i.name.toLowerCase().includes('envase') ? 'Envases' : (i.name.toLowerCase().includes('etiqueta') ? 'Etiquetas' : 'Insumos'), name: i.name, qty, cost: i.costoUnitario, total });
    });

    presentaciones.forEach(p => {
      const qty = productStocks[p.id!] || 0;
      if (qty <= 0) return;
      // Estimate cost from base product + inputs if possible, or fallback to an arbitrary logic for now. We assume a generic cost if not calculated.
      let cost = 0;
      if (p.productoBaseId) {
        const base = mercaderias.find(m => m.id === p.productoBaseId);
        if (base) cost += base.costoKg * (p.pesoObjetivoGramos / 1000);
      }
      cost += p.manoObra || 0;
      const total = qty * cost;
      totalProductoTerminado += total;
      list.push({ id: p.id, type: 'Producto Terminado', name: p.name, qty, cost, total });
    });

    return { totalMercaderia, totalInsumos, totalProductoTerminado, total: totalMercaderia + totalInsumos + totalProductoTerminado, list };
  }, [mercaderias, insumos, presentaciones, productStocks]);

  // 2. Rentabilidad por Producto
  const rentabilidad = useMemo(() => {
    const stats: Record<string, { name: string, sales: number, cost: number, profit: number, units: number }> = {};
    
    sales.filter(s => s.status !== 'ANULADA').forEach(s => {
      s.items.forEach(item => {
        if (!stats[item.productId]) stats[item.productId] = { name: item.productName, sales: 0, cost: 0, profit: 0, units: 0 };
        const rev = item.price * item.quantity;
        const cst = (item.cost || 0) * item.quantity;
        stats[item.productId].sales += rev;
        stats[item.productId].cost += cst;
        stats[item.productId].profit += (rev - cst);
        stats[item.productId].units += item.quantity;
      });
    });

    const list = Object.values(stats).map(s => ({
      ...s,
      margin: s.sales > 0 ? (s.profit / s.sales) * 100 : 0
    })).sort((a, b) => b.profit - a.profit);

    return {
      list,
      masRentables: list.slice(0, 5),
      menosRentables: [...list].sort((a, b) => a.margin - b.margin).slice(0, 5)
    };
  }, [sales]);

  // 3. Liquidez y Pasivos (Base Financiera)
  const finData = useMemo(() => {
    let liquidez = 0;
    let pasivos = 0;
    let activosFijos = 0;
    let ingresosOp = 0;
    let egresosOp = 0;

    const pasivosList: any[] = [];

    movements.forEach(m => {
      const cat = (m.category || '').toLowerCase();
      const isNonMoney = (cat === 'aporte_socio' || m.tipoMovimiento === 'APORTE_SOCIO') && (m.aporteType && m.aporteType !== 'dinero' || m.destino === 'activo');
      const isCapital = CAPITAL_CATEGORIES.some(c => cat.includes(c)) || m.tipoMovimiento === 'APORTE_SOCIO';

      // Liquidity
      if (!isNonMoney && m.type !== 'transfer') {
        if (m.type === 'in') liquidez += m.amount;
        else if (m.type === 'out') liquidez -= m.amount;
      }

      // Activos Fijos
      if (isCapital && (m.destino === 'activo' || (m.aporteType && m.aporteType !== 'dinero'))) {
        if (m.type === 'in') activosFijos += m.amount;
      }

      // Pasivos (pending outs)
      if (m.status === 'pendiente' && m.type === 'out') {
        const amt = m.pendingAmount ?? m.amount;
        pasivos += amt;
        pasivosList.push(m);
      }

      // Operativo
      if (!isCapital && m.type !== 'transfer') {
        if (m.type === 'in') ingresosOp += m.amount;
        else if (m.type === 'out') egresosOp += m.amount;
      }
    });

    // Also consider Customer Debts as Pending Collections
    const cobrosPendientes = sales
      .filter(s => s.paymentMethod === 'cc' && (s.status === 'PENDIENTE' || s.status === 'PARCIAL'))
      .reduce((acc, sale) => acc + (sale.saldoPendiente !== undefined ? sale.saldoPendiente : sale.total), 0);

    // Supplier Debts as Pending Payments
    let totalSupplierPurchases = 0;
    let totalSupplierPayments = 0;
    
    suppliers.forEach(s => {
      const sPurchases = purchases.filter(p => p.supplierId === s.id);
      const sPayments = movements.filter(m => 
        (m.type === 'out' || m.category === 'aporte_socio') &&
        (m.supplierId === s.id || sPurchases.some(p => p.id === m.referenceId))
      );
      const sAportes = transactions.filter(t => 
         t.type === 'APORTE' && 
         (t.referenceId === s.id || sPurchases.some(p => p.id === t.referenceId))
      );

      totalSupplierPurchases += sPurchases.reduce((acc, p) => acc + (p.total || 0), 0);
      totalSupplierPayments += sPayments.reduce((acc, m) => acc + (m.amount || 0), 0) + sAportes.reduce((acc, a) => acc + (a.amount || 0), 0);
    });

    const pagosPendientes = pasivos + (totalSupplierPurchases - totalSupplierPayments);

    return { liquidez, activosFijos, pasivos, pasivosList, cobrosPendientes, pagosPendientes, gananciaAcumulada: ingresosOp - egresosOp };
  }, [movements, sales, suppliers, purchases, transactions]);

  // 4. Flujo de Fondos Proyectado
  const flujo = useMemo(() => {
    const proj7 = finData.liquidez + (finData.cobrosPendientes * 0.3) - (finData.pagosPendientes * 0.5);
    const proj15 = finData.liquidez + (finData.cobrosPendientes * 0.7) - (finData.pagosPendientes * 0.8);
    const proj30 = finData.liquidez + finData.cobrosPendientes - finData.pagosPendientes;
    return { proj7, proj15, proj30 };
  }, [finData]);

  // Gerencial Real Data
  const gerencialData = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const isThisMonth = (d: number) => {
      const date = new Date(d);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    };

    const ventasDelMes = sales.filter(s => isThisMonth(s.date) && s.status !== 'ANULADA').reduce((sum, s) => sum + s.total, 0);
    
    // Cobros del Mes: pagos de sales y movements de tipo "in" operativos
    const cobrosDelMes = movements.filter(m => isThisMonth(m.date || m.createdAt) && m.type === 'in' && !CAPITAL_CATEGORIES.some(c => (m.category || '').toLowerCase().includes(c)) && m.tipoMovimiento !== 'APORTE_SOCIO').reduce((sum, m) => sum + m.amount, 0);

    const comprasDelMes = purchases.filter(p => isThisMonth(p.date)).reduce((sum, p) => sum + (p.total || 0), 0);
    
    // Pagos a Proveedores del Mes
    let pagosProveedoresMes = 0;
    suppliers.forEach(s => {
      const sPurchases = purchases.filter(p => p.supplierId === s.id);
      const sPayments = movements.filter(m => 
        isThisMonth(m.date || m.createdAt) && 
        (m.type === 'out' || m.category === 'aporte_socio') &&
        (m.supplierId === s.id || sPurchases.some(p => p.id === m.referenceId))
      );
      const sAportes = transactions.filter(t => 
         isThisMonth(t.date) && 
         t.type === 'APORTE' && 
         (t.referenceId === s.id || sPurchases.some(p => p.id === t.referenceId))
      );
      pagosProveedoresMes += sPayments.reduce((acc, m) => acc + (m.amount || 0), 0) + sAportes.reduce((acc, a) => acc + (a.amount || 0), 0);
    });

    const clientesConDeuda = sales
      .filter(s => s.paymentMethod === 'cc' && (s.status === 'PENDIENTE' || s.status === 'PARCIAL'))
      .map(s => s.customerId)
      .filter((v, i, a) => a.indexOf(v) === i).length; // Unique customer IDs with debt

    let proveedoresConDeuda = 0;
    suppliers.forEach(s => {
      const sPurchases = purchases.filter(p => p.supplierId === s.id);
      const sPayments = movements.filter(m => 
        (m.type === 'out' || m.category === 'aporte_socio') &&
        (m.supplierId === s.id || sPurchases.some(p => p.id === m.referenceId))
      );
      const sAportes = transactions.filter(t => 
         t.type === 'APORTE' && 
         (t.referenceId === s.id || sPurchases.some(p => p.id === t.referenceId))
      );

      const tPur = sPurchases.reduce((acc, p) => acc + (p.total || 0), 0);
      const tPay = sPayments.reduce((acc, m) => acc + (m.amount || 0), 0) + sAportes.reduce((acc, a) => acc + (a.amount || 0), 0);
      if (tPur - tPay > 0) proveedoresConDeuda++;
    });

    let cajaDisponible = 0;
    let bancosDisponible = 0;
    
    movements.forEach(m => {
      const cat = (m.category || '').toLowerCase();
      const isNonMoneyAporte = (cat === 'aporte_socio' || m.tipoMovimiento === 'APORTE_SOCIO') && (m.aporteType && m.aporteType !== 'dinero' || m.destino === 'activo');
      if (isNonMoneyAporte || m.type === 'transfer') return;
      
      const val = m.type === 'in' ? m.amount : -m.amount;
      if (m.method === 'cash' || m.method === 'efectivo') {
         cajaDisponible += val;
      } else {
         bancosDisponible += val;
      }
    });

    const capitalAportado = transactions.filter(t => t.type === 'APORTE').reduce((sum, t) => sum + t.amount, 0) 
      - transactions.filter(t => t.type === 'RETIRO' || t.type === 'DEVOLUCION').reduce((sum, t) => sum + t.amount, 0);
      
    let ingresosOp = 0;
    let egresosOp = 0;
    movements.forEach(m => {
      if (m.type === 'transfer') return;
      const cat = (m.category || '').toLowerCase();
      const isCapital = CAPITAL_CATEGORIES.some(c => cat.includes(c)) || m.tipoMovimiento === 'APORTE_SOCIO';
      if (!isCapital) {
        if (m.type === 'in') ingresosOp += m.amount;
        else if (m.type === 'out') egresosOp += m.amount;
      }
    });
    const resultadoOperativo = ingresosOp - egresosOp;

    return { ventasDelMes, cobrosDelMes, comprasDelMes, pagosProveedoresMes, clientesConDeuda, proveedoresConDeuda, cajaDisponible, bancosDisponible, capitalAportado, resultadoOperativo };
  }, [sales, movements, purchases, suppliers, transactions]);

  // 5. Valor de Empresa
  const valorEmpresa = finData.liquidez + stockValorizado.total + finData.activosFijos - finData.pagosPendientes;

  // Comercial Data (Phase 5B)
  const comercialData = useMemo(() => {
    let ventaBruta = 0;
    let bonificaciones = 0;
    let ventaNeta = 0;
    
    const clientesMap: Record<string, { name: string, bonificacion: number }> = {};

    sales.filter(s => s.status !== 'ANULADA').forEach(s => {
      const gross = s.grossTotal || s.subtotal || s.total || 0;
      const net = s.total || 0;
      const bonif = s.commercialDiscount || 0;

      ventaBruta += gross;
      ventaNeta += net;
      bonificaciones += bonif;

      if (bonif > 0) {
        if (!clientesMap[s.customerId]) {
          clientesMap[s.customerId] = { name: s.customerName, bonificacion: 0 };
        }
        clientesMap[s.customerId].bonificacion += bonif;
      }
    });

    const descuentoPromedio = ventaBruta > 0 ? (bonificaciones / ventaBruta) * 100 : 0;
    
    const topClientes = Object.values(clientesMap)
      .sort((a, b) => b.bonificacion - a.bonificacion)
      .slice(0, 5);

    return { ventaBruta, bonificaciones, ventaNeta, descuentoPromedio, topClientes };
  }, [sales]);

  if (error) return <ErrorState message="Error cargando módulos de gestión empresarial." />;
  if (loading) return <LoadingSpinner message="Calculando inteligencia de negocios..." />;

  const tabs = [
    { id: 'ejecutivo', label: 'Centro de Decisiones', icon: Activity },
    { id: 'comercial', label: 'Análisis Comercial', icon: BarChart3 },
    { id: 'stock', label: 'Stock Valorizado', icon: Package },
    { id: 'rentabilidad', label: 'Rentabilidad por Producto', icon: TrendingUp },
    { id: 'flujo', label: 'Flujo de Fondos', icon: Clock },
    { id: 'valor', label: 'Valor de la Empresa', icon: Landmark }
  ];

  return (
    <>
      <PageHeader title="Gestión Empresarial" description="Módulos de inteligencia de negocios para toma de decisiones." />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        {tabs.map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                backgroundColor: isActive ? 'var(--primary-color)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                transition: 'all 0.2s',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none'
              }}
            >
              <TabIcon size={18} />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div style={{ minHeight: '60vh' }}>
        {activeTab === 'ejecutivo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* 1. KPIs Operativos (Mes Actual) */}
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Métricas del Mes (Operativo)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <Card padding="sm" style={{ borderLeft: '4px solid #16a34a' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Ventas del Mes</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#166534', marginTop: '8px' }}>{formatCurrency(gerencialData.ventasDelMes)}</h3>
              </Card>
              <Card padding="sm" style={{ borderLeft: '4px solid #0d9488' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Cobros del Mes</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f766e', marginTop: '8px' }}>{formatCurrency(gerencialData.cobrosDelMes)}</h3>
              </Card>
              <Card padding="sm" style={{ borderLeft: '4px solid #dc2626' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Compras del Mes</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#991b1b', marginTop: '8px' }}>{formatCurrency(gerencialData.comprasDelMes)}</h3>
              </Card>
              <Card padding="sm" style={{ borderLeft: '4px solid #ea580c' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Pagos Proveedores (Mes)</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#9a3412', marginTop: '8px' }}>{formatCurrency(gerencialData.pagosProveedoresMes)}</h3>
              </Card>
            </div>

            {/* 2. KPIs Financieros y Patrimonio */}
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Liquidez y Capital</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <Card padding="sm" style={{ borderLeft: '4px solid #0284c7' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Caja Física Disponible</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0369a1', marginTop: '8px' }}>{formatCurrency(gerencialData.cajaDisponible)}</h3>
              </Card>
              <Card padding="sm" style={{ borderLeft: '4px solid #2563eb' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Bancos y Billeteras</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1d4ed8', marginTop: '8px' }}>{formatCurrency(gerencialData.bancosDisponible)}</h3>
              </Card>
              <Card padding="sm" style={{ borderLeft: '4px solid #8b5cf6', backgroundColor: '#f5f3ff' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Capital Aportado Socios</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6d28d9', marginTop: '8px' }}>{formatCurrency(gerencialData.capitalAportado)}</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Aislado de la operación</span>
              </Card>
              <Card padding="sm" style={{ borderLeft: '4px solid #10b981', backgroundColor: '#ecfdf5' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Resultado Operativo Total</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#047857', marginTop: '8px' }}>{formatCurrency(gerencialData.resultadoOperativo)}</h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Sin ingresos de socios</span>
              </Card>
            </div>

            {/* 3. Deudas y Obligaciones */}
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Estado de Deudas</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
               <Card padding="sm" style={{ borderLeft: '4px solid #f59e0b' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Clientes con Deuda</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b45309', marginTop: '8px' }}>{gerencialData.clientesConDeuda} Clientes</h3>
              </Card>
              <Card padding="sm" style={{ borderLeft: '4px solid #14b8a6' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total a Cobrar</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f766e', marginTop: '8px' }}>{formatCurrency(finData.cobrosPendientes)}</h3>
              </Card>
               <Card padding="sm" style={{ borderLeft: '4px solid #ef4444' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Proveedores con Deuda</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b91c1c', marginTop: '8px' }}>{gerencialData.proveedoresConDeuda} Proveedores</h3>
              </Card>
              <Card padding="sm" style={{ borderLeft: '4px solid #f43f5e' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total a Pagar</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#be123c', marginTop: '8px' }}>{formatCurrency(finData.pagosPendientes)}</h3>
              </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <Card>
                <CardHeader title="Top Productos Más Rentables" subtitle="Mayor ganancia neta absoluta" />
                <div style={{ padding: '24px' }}>
                  {rentabilidad.masRentables.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {rentabilidad.masRentables.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#f0fdf4' }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{item.name}</span>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Margen: {item.margin.toFixed(1)}%</div>
                          </div>
                          <b style={{ color: '#16a34a' }}>+{formatCurrency(item.profit)}</b>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState icon={Box} title="Sin datos" description="No hay ventas registradas." />}
                </div>
              </Card>
              
              <Card>
                <CardHeader title="Productos Menos Rentables" subtitle="Atención a márgenes bajos" />
                <div style={{ padding: '24px' }}>
                  {rentabilidad.menosRentables.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {rentabilidad.menosRentables.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: item.margin < 15 ? '#fef2f2' : '#fefce8' }}>
                          <div>
                            <span style={{ fontWeight: 600 }}>{item.name}</span>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Margen: {item.margin.toFixed(1)}%</div>
                          </div>
                          <b style={{ color: item.profit <= 0 ? '#dc2626' : '#d97706' }}>{formatCurrency(item.profit)}</b>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState icon={Box} title="Sin datos" description="No hay ventas registradas." />}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'comercial' && (
          <Card>
            <CardHeader title="Análisis Comercial y de Precios" subtitle="Impacto de listas de precios y bonificaciones otorgadas" />
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>Venta Bruta (Oficial)</p>
                  <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#334155' }}>{formatCurrency(comercialData.ventaBruta)}</h3>
                </div>
                <div style={{ padding: '20px', backgroundColor: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ef4444' }}>Bonificaciones Otorgadas</p>
                  <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#dc2626' }}>{formatCurrency(comercialData.bonificaciones)}</h3>
                </div>
                <div style={{ padding: '20px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#16a34a' }}>Venta Neta</p>
                  <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#15803d' }}>{formatCurrency(comercialData.ventaNeta)}</h3>
                </div>
                <div style={{ padding: '20px', backgroundColor: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#2563eb' }}>% Descuento Promedio</p>
                  <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1d4ed8' }}>{comercialData.descuentoPromedio.toFixed(1)}%</h3>
                </div>
              </div>

              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Top Clientes por Bonificación</h3>
              {comercialData.topClientes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {comercialData.topClientes.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#fff' }}>
                      <span style={{ fontWeight: 600 }}>{i + 1}. {item.name}</span>
                      <b style={{ color: '#dc2626' }}>{formatCurrency(item.bonificacion)}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Users} title="Sin datos" description="No hay bonificaciones otorgadas todavía." />
              )}
            </div>
          </Card>
        )}

        {activeTab === 'stock' && (
          <Card>
            <CardHeader title="Stock Valorizado Total" subtitle={`Valor total en plaza: ${formatCurrency(stockValorizado.total)}`} />
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ padding: '16px', backgroundColor: '#f0fdfa', borderRadius: '8px', border: '1px solid #ccfbf1' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f766e' }}>Mercadería</p>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0d9488' }}>{formatCurrency(stockValorizado.totalMercaderia)}</h3>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1d4ed8' }}>Insumos/Envases</p>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>{formatCurrency(stockValorizado.totalInsumos)}</h3>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#fdf4ff', borderRadius: '8px', border: '1px solid #fae8ff' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#a21caf' }}>Producto Terminado</p>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#c026d3' }}>{formatCurrency(stockValorizado.totalProductoTerminado)}</h3>
                </div>
              </div>
              <Table 
                data={stockValorizado.list.sort((a, b) => b.total - a.total)}
                keyExtractor={item => item.id!}
                columns={[
                  { header: 'Tipo', accessor: item => <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'var(--bg-secondary)', fontWeight: 600 }}>{item.type}</span>, width: '150px' },
                  { header: 'Item', accessor: item => item.name },
                  { header: 'Cantidad', accessor: item => formatNumber(item.qty), width: '120px' },
                  { header: 'Costo Unit.', accessor: item => formatCurrency(item.cost), width: '120px' },
                  { header: 'Valor Total', accessor: item => <b style={{ color: 'var(--primary-color)' }}>{formatCurrency(item.total)}</b>, width: '150px' }
                ]}
              />
            </div>
          </Card>
        )}

        {activeTab === 'rentabilidad' && (
          <Card>
            <CardHeader title="Rentabilidad por Producto" subtitle="Ventas vs Costos Históricos" />
            <div style={{ padding: '24px' }}>
              <Table 
                data={rentabilidad.list}
                keyExtractor={item => item.name}
                columns={[
                  { header: 'Producto', accessor: item => item.name },
                  { header: 'Unidades Vendidas', accessor: item => formatNumber(item.units), width: '150px' },
                  { header: 'Total Ventas', accessor: item => <b style={{ color: '#16a34a' }}>{formatCurrency(item.sales)}</b>, width: '150px' },
                  { header: 'Total Costos', accessor: item => <b style={{ color: '#dc2626' }}>{formatCurrency(item.cost)}</b>, width: '150px' },
                  { header: 'Ganancia Neta', accessor: item => <b style={{ color: item.profit >= 0 ? '#1d4ed8' : '#991b1b' }}>{formatCurrency(item.profit)}</b>, width: '150px' },
                  { header: 'Margen %', accessor: item => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '60px', height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, item.margin))}%`, backgroundColor: item.margin >= 30 ? '#16a34a' : item.margin > 10 ? '#f59e0b' : '#dc2626' }} />
                      </div>
                      <span style={{ fontWeight: 'bold', color: item.margin >= 30 ? '#16a34a' : item.margin > 10 ? '#f59e0b' : '#dc2626' }}>{item.margin.toFixed(1)}%</span>
                    </div>
                  ), width: '150px' }
                ]}
              />
            </div>
          </Card>
        )}

        {activeTab === 'flujo' && (
          <Card>
            <CardHeader title="Flujo de Fondos Proyectado" subtitle="Evolución estimada de liquidez a corto plazo" />
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>
                <div style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Liquidez Actual (Hoy)</h4>
                  <b style={{ fontSize: '1.75rem', color: '#0f766e' }}>{formatCurrency(finData.liquidez)}</b>
                </div>
                <div style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Cobros Pendientes</h4>
                  <b style={{ fontSize: '1.75rem', color: '#16a34a' }}>+{formatCurrency(finData.cobrosPendientes)}</b>
                </div>
                <div style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Pagos Pendientes</h4>
                  <b style={{ fontSize: '1.75rem', color: '#dc2626' }}>-{formatCurrency(finData.pagosPendientes)}</b>
                </div>
              </div>

              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '24px', color: '#1e293b' }}>Proyección Estimada de Liquidez</h3>
              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1, padding: '24px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center' }}>
                  <p style={{ fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>A 7 días</p>
                  <h3 style={{ fontSize: '2rem', fontWeight: 800, color: flujo.proj7 >= 0 ? '#1d4ed8' : '#dc2626' }}>{formatCurrency(flujo.proj7)}</h3>
                </div>
                <div style={{ flex: 1, padding: '24px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '12px', textAlign: 'center' }}>
                  <p style={{ fontWeight: 600, color: '#475569', marginBottom: '8px' }}>A 15 días</p>
                  <h3 style={{ fontSize: '2rem', fontWeight: 800, color: flujo.proj15 >= 0 ? '#1d4ed8' : '#dc2626' }}>{formatCurrency(flujo.proj15)}</h3>
                </div>
                <div style={{ flex: 1, padding: '24px', backgroundColor: '#e2e8f0', border: '1px solid #94a3b8', borderRadius: '12px', textAlign: 'center' }}>
                  <p style={{ fontWeight: 600, color: '#334155', marginBottom: '8px' }}>A 30 días</p>
                  <h3 style={{ fontSize: '2rem', fontWeight: 800, color: flujo.proj30 >= 0 ? '#1d4ed8' : '#dc2626' }}>{formatCurrency(flujo.proj30)}</h3>
                </div>
              </div>
              <p style={{ marginTop: '24px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>* Proyección algorítmica asumiendo prorrateo de cobros y pagos pendientes a lo largo del mes.</p>
            </div>
          </Card>
        )}

        {activeTab === 'valor' && (
          <Card>
            <CardHeader title="Valor Dinámico de la Empresa" subtitle="Cálculo patrimonial integral en tiempo real" />
            <div style={{ padding: '32px' }}>
               <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '1.1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 600 }}>Liquidez Total</span>
                    <b style={{ color: '#166534' }}>{formatCurrency(finData.liquidez)}</b>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 600 }}>(+) Stock Valorizado</span>
                    <b style={{ color: '#166534' }}>{formatCurrency(stockValorizado.total)}</b>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 600 }}>(+) Activos Fijos</span>
                    <b style={{ color: '#166534' }}>{formatCurrency(finData.activosFijos)}</b>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 600 }}>(-) Pasivos / Obligaciones</span>
                    <b style={{ color: '#991b1b' }}>{formatCurrency(finData.pagosPendientes)}</b>
                  </div>

                  <div style={{ height: '2px', backgroundColor: 'var(--border-color)', margin: '8px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '24px', backgroundColor: '#1e293b', color: '#fff', borderRadius: '8px', fontSize: '1.25rem' }}>
                    <span style={{ fontWeight: 800 }}>= VALOR DE LA EMPRESA</span>
                    <b style={{ fontWeight: 900, color: '#38bdf8' }}>{formatCurrency(valorEmpresa)}</b>
                  </div>
               </div>
            </div>
          </Card>
        )}

      </div>
    </>
  );
};
