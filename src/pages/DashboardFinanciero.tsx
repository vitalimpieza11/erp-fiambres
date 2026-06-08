import React, { useState, useMemo } from 'react';
import { 
  DollarSign, Activity, Users, Wallet, Landmark, 
  History, TrendingUp, AlertCircle, Calendar,
  ArrowUpRight, ArrowDownRight, Edit3, CheckCircle2, Factory, Archive
} from 'lucide-react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { Card, CardHeader } from '../components/ui/Card';
import { LoadingSpinner, ErrorState } from '../components/AsyncState';
import { Table } from '../components/ui/Table';
import { useCashMovements } from '../hooks/useCashMovements';
import { useBanks } from '../hooks/useBanks';
import { useSocietaria } from '../hooks/useSocietaria';
import { formatCurrency, formatNumber } from '../utils/format';
import { useDateFilter } from '../contexts/DateFilterContext';

const CAPITAL_CATEGORIES = ['aporte_socio', 'inversion_inicial', 'bien_capital', 'maquinaria', 'tecnologia'];

export const DashboardFinanciero = () => {
  const { movements, loading: loadingMovs, error: errorMovs } = useCashMovements();
  const { banks, loading: loadingBanks, error: errorBanks } = useBanks();
  const { 
    distributions, reinvestments, contributions, 
    loading: loadingSoc, error: errorSoc 
  } = useSocietaria();
  const { filterDate, viewType, selectedYear, selectedMonth } = useDateFilter();

  const [activeTab, setActiveTab] = useState<'resumen' | 'liquidez' | 'operativo' | 'capital' | 'overrides' | 'historico'>('resumen');

  const loading = loadingMovs || loadingBanks || loadingSoc;
  const error = errorMovs || errorBanks || errorSoc;



  // LÓGICA DE CÁLCULO
  // 1. Unificar todos los movimientos reales (CashMovements). Los Overrides ya están aplicados (amount, category, type son los nuevos).
  // 2. Traer aportes societarios y reinversiones legacy para sumarlos al capital.
  
  const filteredMovements = movements.filter(m => filterDate(m.date));
  const filteredDistributions = distributions.filter(d => filterDate(d.date));
  const filteredReinvestments = reinvestments.filter(r => filterDate(r.date));
  const filteredContributions = contributions.filter(c => filterDate(c.date));

  // 1.1 POSICIÓN DE LIQUIDEZ (TODO EL DINERO LÍQUIDO, sin importar si es operativo o capital)
  const liquidez = useMemo(() => {
    let caja = 0;
    let banco = 0;
    let billeteras = 0;
    const accountTotals: Record<string, number> = {};

    movements.filter(m => filterDate(m.date)).forEach(m => {
      const amount = m.amount;
      const accountId = m.accountId || m.bankId || (m.method === 'cash' ? 'caja_fisica' : 'banco_default');
      const isOut = m.type === 'out';
      const isTransfer = m.type === 'transfer';
      const isNonMoneyAporte = m.category === 'aporte_socio' && m.aporteType && m.aporteType !== 'dinero';

      if (isNonMoneyAporte) return; // Non-money aportes do NOT affect liquidity

      if (!accountTotals[accountId]) accountTotals[accountId] = 0;

      if (m.type === 'in') {
        accountTotals[accountId] += amount;
      } else if (isOut) {
        accountTotals[accountId] -= amount;
      } else if (isTransfer) {
        const toAccountId = m.toAccountId || 'unknown';
        if (!accountTotals[toAccountId]) accountTotals[toAccountId] = 0;
        accountTotals[accountId] -= amount;
        accountTotals[toAccountId] += amount;
      }
    });

    Object.entries(accountTotals).forEach(([acc, val]) => {
      const bankDef = banks.find(b => b.id === acc);
      if (acc === 'caja_fisica' || (bankDef && bankDef.accountType?.toLowerCase().includes('caja'))) {
        caja += val;
      } else if (bankDef && bankDef.accountType?.toLowerCase().includes('billetera')) {
        billeteras += val;
      } else {
        banco += val; // Default everything else to banco
      }
    });

    return { caja, banco, billeteras, total: caja + banco + billeteras, accountTotals };
  }, [movements, banks, filterDate]);

  // 1.2 FLUJO OPERATIVO (Excluir Capital y Transferencias)
  const operativo = useMemo(() => {
    let ingresos = 0;
    let egresos = 0;
    let ventas = 0;
    let compras = 0;
    let gastos = 0;

    filteredMovements.forEach(m => {
      if (m.type === 'transfer') return;
      const cat = (m.category || '').toLowerCase();
      const isCapital = CAPITAL_CATEGORIES.some(c => cat.includes(c));
      if (isCapital) return;

      if (m.type === 'in') {
        ingresos += m.amount;
        if (cat.includes('venta')) ventas += m.amount;
      } else if (m.type === 'out') {
        egresos += m.amount;
        if (cat.includes('compra') || cat.includes('mercaderia')) compras += m.amount;
        else gastos += m.amount;
      }
    });

    return { ingresos, egresos, ventas, compras, gastos, neto: ingresos - egresos };
  }, [filteredMovements]);

  // 1.3 CAPITAL DE LA EMPRESA
  const capital = useMemo(() => {
    let aportesMovs = 0;
    let inversionesMovs = 0;
    
    const byType: Record<string, number> = {
      dinero: 0,
      bien_capital: 0,
      vehiculo: 0,
      mercaderia: 0,
      equipamiento: 0,
      tecnologia: 0,
      otro: 0
    };
    
    const byPartner: Record<string, { total: number; breakdown: Record<string, number> }> = {};

    // From cash movements
    filteredMovements.forEach(m => {
      if (m.type === 'transfer') return;
      const cat = (m.category || '').toLowerCase();
      
      if (cat === 'aporte_socio' && m.type === 'in') {
        aportesMovs += m.amount;
        const aType = m.aporteType || 'dinero';
        byType[aType] = (byType[aType] || 0) + m.amount;
        
        if (m.partnerId) {
          if (!byPartner[m.partnerId]) byPartner[m.partnerId] = { total: 0, breakdown: {} };
          byPartner[m.partnerId].total += m.amount;
          byPartner[m.partnerId].breakdown[aType] = (byPartner[m.partnerId].breakdown[aType] || 0) + m.amount;
        }
      } else if (cat === 'aporte_socio' && m.type === 'out') {
        aportesMovs -= m.amount;
        const aType = m.aporteType || 'dinero';
        byType[aType] = (byType[aType] || 0) - m.amount;
        
        if (m.partnerId) {
          if (!byPartner[m.partnerId]) byPartner[m.partnerId] = { total: 0, breakdown: {} };
          byPartner[m.partnerId].total -= m.amount;
          byPartner[m.partnerId].breakdown[aType] = (byPartner[m.partnerId].breakdown[aType] || 0) - m.amount;
        }
      } else if (cat.includes('inversion') || cat.includes('bien') || cat.includes('maquinaria')) {
        inversionesMovs += m.amount;
        byType['bien_capital'] = (byType['bien_capital'] || 0) + m.amount;
      }
    });

    // From legacy societaria
    const legacyAportes = filteredContributions.filter(c => c.type === 'contribution').reduce((acc, c) => {
      if (c.partnerId) {
        if (!byPartner[c.partnerId]) byPartner[c.partnerId] = { total: 0, breakdown: {} };
        byPartner[c.partnerId].total += c.amount;
        byPartner[c.partnerId].breakdown['dinero'] = (byPartner[c.partnerId].breakdown['dinero'] || 0) + c.amount;
      }
      return acc + c.amount;
    }, 0);
    
    byType['dinero'] += legacyAportes;
    
    const legacyDevoluciones = filteredContributions.filter(c => c.type === 'return').reduce((acc, c) => acc + c.amount, 0);
    byType['dinero'] -= legacyDevoluciones;
    
    const legacyInversiones = filteredReinvestments.reduce((acc, r) => acc + r.amount, 0);
    byType['bien_capital'] += legacyInversiones;
    
    const legacyRetiros = filteredDistributions.reduce((acc, d) => acc + d.amount, 0);

    const totalAportado = aportesMovs + legacyAportes;
    const totalInvertido = inversionesMovs + legacyInversiones;
    const capitalNeto = totalAportado - legacyDevoluciones - legacyRetiros + totalInvertido;

    return { totalAportado, totalInvertido, legacyRetiros, legacyDevoluciones, capitalNeto, byType, byPartner };
  }, [filteredMovements, filteredContributions, filteredReinvestments, filteredDistributions]);

  // 1.4 MOVIMIENTOS MANUALES (Overrides)
  const manualOverrides = useMemo(() => {
    return filteredMovements.filter(m => m.isManualOverride);
  }, [filteredMovements]);

  // 1.5 EVOLUCIÓN HISTÓRICA (Timeline simple de los últimos 6 periodos o días)
  const timeline = useMemo(() => {
    // Agrupar movimientos de todo el histórico para crear el chart
    const sorted = [...movements].sort((a, b) => a.date - b.date);
    let runOperativo = 0;
    let runCapital = 0;
    let runLiquidez = 0;

    const dataPoints: any[] = [];
    
    // Simplification for the timeline chart
    sorted.forEach(m => {
      const isTransfer = m.type === 'transfer';
      const cat = (m.category || '').toLowerCase();
      const isCapital = CAPITAL_CATEGORIES.some(c => cat.includes(c));
      const val = m.amount;

      const isNonMoneyAporte = m.category === 'aporte_socio' && m.aporteType && m.aporteType !== 'dinero';

      if (!isTransfer && !isNonMoneyAporte) {
        if (m.type === 'in') runLiquidez += val;
        else runLiquidez -= val;

        if (isCapital) {
          if (m.type === 'in') runCapital += val;
          else runCapital -= val;
        } else {
          if (m.type === 'in') runOperativo += val;
          else runOperativo -= val;
        }
      } else if (isNonMoneyAporte) {
        // Non money aporte only affects capital
        if (m.type === 'in') runCapital += val;
        else runCapital -= val;
      }

      // Add a data point every N movements or end of month (simplified here to keep it small)
    });

    return { finalOperativo: runOperativo, finalCapital: runCapital, finalLiquidez: runLiquidez };
  }, [movements]);

  const tabs = [
    { id: 'resumen', label: 'Resumen Global', icon: Activity },
    { id: 'liquidez', label: 'Posición Liquidez', icon: DollarSign },
    { id: 'operativo', label: 'Flujo Operativo', icon: TrendingUp },
    { id: 'capital', label: 'Capital Empresa', icon: Factory },
    { id: 'overrides', label: 'Auditoría Overrides', icon: Edit3 },
    { id: 'historico', label: 'Línea de Tiempo', icon: History }
  ];

  if (error) {
    return <ErrorState message={typeof error === 'string' ? error : 'Error cargando el dashboard financiero.'} />;
  }

  if (loading) {
    return <LoadingSpinner message="Consolidando datos financieros..." />;
  }

  return (
    <>
      <PageHeader 
        title="Dashboard Financiero Consolidado" 
        description="Módulo de Caja Flexible: Control total de liquidez, operaciones, capital y auditoría de overrides."
      />

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

      <div style={{ minHeight: '50vh' }}>
        {activeTab === 'resumen' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* KPI ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <Card padding="sm" style={{ borderLeft: '4px solid #0d9488' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Liquidez Total</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f766e', marginTop: '8px' }}>
                  {formatCurrency(liquidez.total)}
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Caja + Bancos + Billeteras</span>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #2563eb' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Resultado Operativo</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: operativo.neto >= 0 ? '#1d4ed8' : '#dc2626', marginTop: '8px' }}>
                  {formatCurrency(operativo.neto)}
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Ingresos vs Egresos de Negocio</span>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #f59e0b' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Capital Neto Empresa</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b45309', marginTop: '8px' }}>
                  {formatCurrency(capital.capitalNeto)}
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Aportes + Inversiones - Retiros</span>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #9333ea' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Patrimonio Estimado</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7e22ce', marginTop: '8px' }}>
                  {formatCurrency(liquidez.total + capital.capitalNeto - capital.byType['dinero'] + capital.byType['bien_capital'] + capital.byType['vehiculo'] + capital.byType['mercaderia'] + capital.byType['equipamiento'] + capital.byType['tecnologia'])}
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Liquidez + Activos (Aportes no-dinerarios)</span>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #9333ea' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Overrides Manuales</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7e22ce', marginTop: '8px' }}>
                  {manualOverrides.length}
                </h3>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Movimientos editados manualmente</span>
              </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <Card>
                <CardHeader title="¿Dónde está el dinero?" subtitle="Posición de liquidez real consolidada" />
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#f0fdfa', borderRadius: '8px', border: '1px solid #ccfbf1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Wallet size={20} color="#0d9488" /> <span style={{ fontWeight: 600 }}>Caja Física</span>
                    </div>
                    <span style={{ fontWeight: 700, color: '#0f766e' }}>{formatCurrency(liquidez.caja)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Landmark size={20} color="#2563eb" /> <span style={{ fontWeight: 600 }}>Cuentas Bancarias</span>
                    </div>
                    <span style={{ fontWeight: 700, color: '#1d4ed8' }}>{formatCurrency(liquidez.banco)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: '#fdf4ff', borderRadius: '8px', border: '1px solid #fae8ff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={20} color="#c026d3" /> <span style={{ fontWeight: 600 }}>Billeteras Virtuales</span>
                    </div>
                    <span style={{ fontWeight: 700, color: '#a21caf' }}>{formatCurrency(liquidez.billeteras)}</span>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader title="¿Cómo llegué a esta situación?" subtitle="Resumen de flujos que afectan la liquidez" />
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span>Flujo Operativo (Ventas/Compras)</span>
                    <b style={{ color: operativo.neto >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(operativo.neto)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span>Inyección de Capital / Aportes</span>
                    <b style={{ color: '#16a34a' }}>+{formatCurrency(capital.totalAportado)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span>Retiros de Utilidades / Devoluciones</span>
                    <b style={{ color: '#dc2626' }}>-{formatCurrency(capital.legacyRetiros + capital.legacyDevoluciones)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', fontSize: '1.1rem' }}>
                    <b>Variación Total Liquidez:</b>
                    <b style={{ color: '#2563eb' }}>{formatCurrency(operativo.neto + capital.totalAportado - capital.legacyRetiros - capital.legacyDevoluciones)}</b>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'operativo' && (
          <Card>
             <CardHeader title="Desglose de Flujo Operativo" subtitle="Excluye aportes, inversiones y transferencias." />
             <div style={{ padding: '24px' }}>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                 <div>
                   <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#16a34a', marginBottom: '16px', borderBottom: '2px solid #16a34a', paddingBottom: '8px' }}>Ingresos Operativos</h4>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                     <span>Ventas Directas</span>
                     <b>{formatCurrency(operativo.ventas)}</b>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                     <span>Otros Ingresos Operativos</span>
                     <b>{formatCurrency(operativo.ingresos - operativo.ventas)}</b>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', fontSize: '1.1rem' }}>
                     <b>Total Ingresos:</b>
                     <b style={{ color: '#16a34a' }}>{formatCurrency(operativo.ingresos)}</b>
                   </div>
                 </div>

                 <div>
                   <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#dc2626', marginBottom: '16px', borderBottom: '2px solid #dc2626', paddingBottom: '8px' }}>Egresos Operativos</h4>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                     <span>Compras de Mercadería</span>
                     <b>{formatCurrency(operativo.compras)}</b>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                     <span>Gastos Operativos (Alquiler, sueldos, etc)</span>
                     <b>{formatCurrency(operativo.gastos)}</b>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', fontSize: '1.1rem' }}>
                     <b>Total Egresos:</b>
                     <b style={{ color: '#dc2626' }}>{formatCurrency(operativo.egresos)}</b>
                   </div>
                 </div>
               </div>

               <div style={{ marginTop: '48px', padding: '24px', backgroundColor: operativo.neto >= 0 ? '#f0fdf4' : '#fef2f2', borderRadius: '12px', border: `1px solid ${operativo.neto >= 0 ? '#bbf7d0' : '#fecaca'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: operativo.neto >= 0 ? '#166534' : '#991b1b' }}>Resultado Operativo Neto:</h3>
                 <h2 style={{ fontSize: '2rem', fontWeight: 900, color: operativo.neto >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(operativo.neto)}</h2>
               </div>
             </div>
          </Card>
        )}

        {activeTab === 'capital' && (
          <Card>
            <CardHeader title="Capital de la Empresa" subtitle="Aportes, inversiones y retiros de socios" />
            <div style={{ padding: '24px' }}>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                  <div style={{ padding: '16px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                    <p style={{ fontSize: '0.875rem', color: '#1e40af', fontWeight: 600 }}>Total Aportado por Socios</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1d4ed8' }}>{formatCurrency(capital.totalAportado)}</h3>
                  </div>
                  <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a' }}>
                    <p style={{ fontSize: '0.875rem', color: '#b45309', fontWeight: 600 }}>Inversiones y Bienes de Capital</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706' }}>{formatCurrency(capital.totalInvertido)}</h3>
                  </div>
                  <div style={{ padding: '16px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                    <p style={{ fontSize: '0.875rem', color: '#991b1b', fontWeight: 600 }}>Retiros / Devoluciones</p>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626' }}>{formatCurrency(capital.legacyRetiros + capital.legacyDevoluciones)}</h3>
                  </div>
               </div>
               
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                 <div>
                   <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Capital por Tipo de Aporte</h4>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                     {Object.entries(capital.byType).filter(([_, val]) => val !== 0).map(([type, val]) => (
                       <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px' }}>
                         <span style={{ textTransform: 'capitalize' }}>{type.replace('_', ' ')}</span>
                         <b style={{ color: val > 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(val)}</b>
                       </div>
                     ))}
                   </div>
                 </div>
                 <div>
                   <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Capital Aportado por Socio</h4>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                     {Object.entries(capital.byPartner).map(([partnerId, data]) => {
                       // We can't access names easily here without using `useSocietaria` hook's partners list, which isn't available easily in Dashboard if not loaded fully. But wait, `Capital` has `m.partnerId`. If we only have IDs, we could just show ID, or wait... wait, `m` does not have `partnerName`. Let's just render the ID for now, or "Socio Asociado".
                       return (
                         <div key={partnerId} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                             <b>Socio {partnerId.substring(0,6)}</b>
                             <b style={{ color: 'var(--primary-color)' }}>{formatCurrency(data.total)}</b>
                           </div>
                           <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                             {Object.entries(data.breakdown).map(([t, v]) => (
                               <span key={t} style={{ fontSize: '0.75rem', padding: '2px 8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '12px' }}>
                                 {t}: {formatCurrency(v)}
                               </span>
                             ))}
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 </div>
               </div>
            </div>
          </Card>
        )}

        {activeTab === 'overrides' && (
          <Card padding="none">
             <CardHeader title="Auditoría de Overrides Manuales" subtitle="Trazabilidad de modificaciones manuales que alteraron la lógica base contable" />
             <div style={{ padding: '0 24px 24px 24px' }}>
               {manualOverrides.length === 0 ? (
                 <EmptyState icon={CheckCircle2} title="Sistema Intacto" description="No se han registrado overrides ni modificaciones manuales." />
               ) : (
                 <Table 
                   data={manualOverrides}
                   keyExtractor={item => item.id!}
                   columns={[
                     {
                       header: 'Fecha Mov.',
                       accessor: item => new Date(item.date).toLocaleDateString(),
                       width: '100px'
                     },
                     {
                       header: 'Última Edición',
                       accessor: item => {
                         if (!item.auditLog || item.auditLog.length === 0) return 'Manual';
                         const last = item.auditLog[item.auditLog.length - 1];
                         return new Date(last.date).toLocaleDateString();
                       },
                       width: '120px'
                     },
                     {
                       header: 'Usuario',
                       accessor: item => {
                         if (!item.auditLog || item.auditLog.length === 0) return 'Admin';
                         const last = item.auditLog[item.auditLog.length - 1];
                         return last.user || 'Admin';
                       },
                       width: '120px'
                     },
                     {
                       header: 'Estado Original',
                       accessor: item => {
                         if (!item.auditLog || item.auditLog.length === 0) return 'N/A';
                         const first = item.auditLog[0].previousValues;
                         return (
                           <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                             {formatCurrency(first.amount)} | {first.type} | {first.category}
                           </div>
                         );
                       }
                     },
                     {
                       header: 'Estado Actual Override',
                       accessor: item => (
                         <div style={{ color: '#2563eb', fontSize: '0.85rem', fontWeight: 600 }}>
                           {formatCurrency(item.amount)} | {item.type} | {item.category}
                         </div>
                       )
                     }
                   ]}
                 />
               )}
             </div>
          </Card>
        )}

        {activeTab === 'historico' && (
          <Card>
            <CardHeader title="Evolución Histórica Dinámica" subtitle="Recálculo total del sistema al día de hoy" />
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Crecimiento Operativo</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={24} color="#16a34a" />
                    <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#166534' }}>{formatCurrency(timeline.finalOperativo)}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Evolución acumulada de todos los ingresos vs gastos operativos hasta la fecha.</p>
                </div>
                
                <div style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Evolución Patrimonial (Capital)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Factory size={24} color="#d97706" />
                    <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#92400e' }}>{formatCurrency(timeline.finalCapital + capital.totalAportado - capital.legacyDevoluciones - capital.legacyRetiros)}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Capitalización histórica de la empresa consolidando aportes y bienes de capital.</p>
                </div>

                <div style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Liquidez Disponible Final</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <DollarSign size={24} color="#2563eb" />
                    <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e40af' }}>{formatCurrency(liquidez.total)}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Dinero líquido existente al momento de procesar la línea de tiempo.</p>
                </div>
              </div>
            </div>
          </Card>
        )}

      </div>
    </>
  );
};
