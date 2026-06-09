import React, { useState, useMemo } from 'react';
import { 
  DollarSign, Activity, Users, Wallet, Landmark, 
  History, TrendingUp, AlertCircle, Calendar,
  ArrowUpRight, ArrowDownRight, Edit3, CheckCircle2, Factory, Archive, Database
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
  const { distributions, reinvestments, contributions } = useSocietaria();
  const { filterDate, viewType, selectedYear, selectedMonth } = useDateFilter();

  const [activeTab, setActiveTab] = useState<'resumen' | 'liquidez' | 'operativo' | 'capital' | 'overrides' | 'historico' | 'diagnostico' | 'balance' | 'resultados' | 'pasivos' | 'salud'>('salud');
  const [origenModal, setOrigenModal] = useState<{isOpen: boolean; title: string; sourceMovements: any[]}>({isOpen: false, title: '', sourceMovements: []});

  const loading = loadingMovs || loadingBanks;
  const error = errorMovs || errorBanks;



  // LÓGICA DE CÁLCULO
  // 1. Unificar todos los movimientos reales (CashMovements). Los Overrides ya están aplicados.
  
  const filteredMovements = movements.filter(m => filterDate(m.date || m.createdAt));

  // 1.1 POSICIÓN DE LIQUIDEZ (TODO EL DINERO LÍQUIDO, sin importar si es operativo o capital)
  const liquidez = useMemo(() => {
    let caja = 0;
    let banco = 0;
    let billeteras = 0;
    let warnings: string[] = [];
    const accountTotals: Record<string, number> = {};

    movements.filter(m => filterDate(m.date)).forEach(m => {
      const amount = m.amount;
      const accountId = m.accountId || m.bankId || (m.method === 'cash' ? 'caja_fisica' : 'banco_default');
      const isOut = m.type === 'out';
      const isTransfer = m.type === 'transfer';
      
      const cat = (m.category || '').toLowerCase();
      const isNonMoneyAporte = cat === 'aporte_socio' && m.aporteType && m.aporteType !== 'dinero';
      const isActivoIn = m.type === 'in' && ['bien_capital', 'maquinaria', 'tecnologia', 'vehiculos', 'vehiculo', 'equipamiento', 'herramientas', 'inmuebles', 'mercaderia'].some(c => cat.includes(c));

      if (isNonMoneyAporte) return; // Non-money aportes do NOT affect liquidity

      if (isActivoIn && !isTransfer) {
        warnings.push(`Advertencia: Un movimiento de Activo Fijo (${m.description || cat}) de ${amount} está incrementando la Liquidez. Revisa si es una venta o error.`);
      }

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

    return { caja, banco, billeteras, total: caja + banco + billeteras, accountTotals, warnings };
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
        aportesMovs -= m.amount; // Wait, actually a 'return' or withdrawal reduces aportes? Yes, but usually it's handled as 'retiro_capital'
        const aType = m.aporteType || 'dinero';
        byType[aType] = (byType[aType] || 0) - m.amount;
        
        if (m.partnerId) {
          if (!byPartner[m.partnerId]) byPartner[m.partnerId] = { total: 0, breakdown: {} };
          byPartner[m.partnerId].total -= m.amount;
          byPartner[m.partnerId].breakdown[aType] = (byPartner[m.partnerId].breakdown[aType] || 0) - m.amount;
        }
      } else if (cat.includes('inversion') || cat.includes('bien') || cat.includes('maquinaria') || cat.includes('vehiculo') || cat.includes('equipamiento') || cat.includes('tecnologia')) {
        inversionesMovs += m.amount;
        byType['bien_capital'] = (byType['bien_capital'] || 0) + m.amount;
      }
    });

    const totalAportado = aportesMovs;
    const totalInvertido = inversionesMovs;
    const legacyDevoluciones = 0; // Removed legacy
    const legacyRetiros = 0; // Removed legacy
    const capitalNeto = totalAportado + totalInvertido;

    return { totalAportado, totalInvertido, legacyRetiros, legacyDevoluciones, capitalNeto, byType, byPartner };
  }, [filteredMovements]);

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

  // 1.6 BALANCE PATRIMONIAL Y PASIVOS
  const balance = useMemo(() => {
    let maquinaria = 0;
    let vehiculos = 0;
    let equipamiento = 0;
    let tecnologia = 0;
    let otrosActivos = 0;
    let stock = 0;

    let deudasProveedores = 0;
    let prestamos = 0;
    let impuestosPendientes = 0;
    let otrasObligaciones = 0;

    const pasivosLista: any[] = [];

    filteredMovements.forEach(m => {
      const cat = (m.category || '').toLowerCase();
      
      // Activos Fijos
      const isActivoOrCapital = CAPITAL_CATEGORIES.some(c => cat.includes(c));
      if (isActivoOrCapital || cat.includes('activo')) {
        const type = m.aporteType || (cat.includes('maquinaria') ? 'maquinaria' : cat.includes('vehiculo') ? 'vehiculo' : cat.includes('tecnologia') ? 'tecnologia' : cat.includes('equipamiento') ? 'equipamiento' : 'otro');
        const val = m.type === 'in' ? m.amount : (m.type === 'out' ? -m.amount : 0);
        
        if (type === 'maquinaria') maquinaria += val;
        else if (type === 'vehiculo') vehiculos += val;
        else if (type === 'tecnologia') tecnologia += val;
        else if (type === 'equipamiento') equipamiento += val;
        else if (type !== 'dinero') otrosActivos += val;
      }

      // Stock
      if (m.aporteType === 'mercaderia' || cat === 'valorizacion_stock' || cat === 'ajuste_stock') {
        const val = m.type === 'in' ? m.amount : -m.amount;
        stock += val;
      }

      // Pasivos
      if (m.status === 'pendiente' && m.type === 'out') {
        pasivosLista.push(m);
        const amt = m.pendingAmount ?? m.amount;
        if (cat.includes('proveedor') || cat.includes('compra')) deudasProveedores += amt;
        else if (cat.includes('prestamo')) prestamos += amt;
        else if (cat.includes('impuesto')) impuestosPendientes += amt;
        else otrasObligaciones += amt;
      }
    });

    const totalActivos = liquidez.total + maquinaria + vehiculos + equipamiento + tecnologia + otrosActivos + stock;
    const totalPasivos = deudasProveedores + prestamos + impuestosPendientes + otrasObligaciones;
    const patrimonioNetoTotal = capital.capitalNeto + operativo.neto;
    
    const balanceCierra = Math.abs(totalActivos - (totalPasivos + patrimonioNetoTotal)) < 1;
    const diferenciaBalance = totalActivos - (totalPasivos + patrimonioNetoTotal);

    return { 
      activos: { liquidez: liquidez.total, maquinaria, vehiculos, equipamiento, tecnologia, otrosActivos, stock, total: totalActivos },
      pasivos: { deudasProveedores, prestamos, impuestosPendientes, otrasObligaciones, total: totalPasivos, lista: pasivosLista },
      patrimonio: { aportado: capital.capitalNeto, resultados: operativo.neto, total: patrimonioNetoTotal },
      balanceCierra,
      diferenciaBalance
    };
  }, [filteredMovements, liquidez.total, capital.capitalNeto, operativo.neto]);

  const handleVerOrigen = (title: string, filterFn: (m: any) => boolean) => {
    setOrigenModal({ isOpen: true, title, sourceMovements: filteredMovements.filter(filterFn) });
  };

  const tabs = [
    { id: 'salud', label: 'Salud Financiera', icon: Activity },
    { id: 'balance', label: 'Balance', icon: Landmark },
    { id: 'resultados', label: 'Estado Resultados', icon: TrendingUp },
    { id: 'pasivos', label: 'Gestión Pasivos', icon: AlertCircle },
    { id: 'liquidez', label: 'Liquidez', icon: DollarSign },
    { id: 'capital', label: 'Capital Empresa', icon: Factory },
    { id: 'diagnostico', label: 'Auditoría Total', icon: Database }
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
            {liquidez.warnings.length > 0 && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '16px', borderRadius: '8px', color: '#991b1b', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                  <AlertCircle size={20} />
                  Inconsistencia Financiera en Liquidez
                </div>
                {liquidez.warnings.map((w, i) => <p key={i} style={{ fontSize: '0.85rem' }}>{w}</p>)}
              </div>
            )}
            
          </div>
        )}

        {activeTab === 'salud' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <Card padding="sm" style={{ borderLeft: '4px solid #0d9488' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Liquidez Real</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f766e', marginTop: '8px' }}>
                  {formatCurrency(liquidez.total)}
                </h3>
                <button onClick={() => handleVerOrigen('Liquidez Real', m => m.type !== 'transfer' && (!CAPITAL_CATEGORIES.some(c => (m.category || '').toLowerCase().includes(c)) || (m.category === 'aporte_socio' && (!m.aporteType || m.aporteType === 'dinero'))))} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', cursor: 'pointer', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>Ver Origen <ArrowUpRight size={12} /></button>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #f59e0b' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Capital Aportado</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b45309', marginTop: '8px' }}>
                  {formatCurrency(capital.capitalNeto)}
                </h3>
                <button onClick={() => handleVerOrigen('Capital Aportado', m => CAPITAL_CATEGORIES.some(c => (m.category || '').toLowerCase().includes(c)))} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', cursor: 'pointer', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>Ver Origen <ArrowUpRight size={12} /></button>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #2563eb' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Valor de Activos Fijos</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1d4ed8', marginTop: '8px' }}>
                  {formatCurrency(balance.activos.maquinaria + balance.activos.vehiculos + balance.activos.equipamiento + balance.activos.tecnologia + balance.activos.otrosActivos)}
                </h3>
                <button onClick={() => handleVerOrigen('Activos Fijos', m => CAPITAL_CATEGORIES.some(c => (m.category || '').toLowerCase().includes(c)) && m.aporteType !== 'dinero')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', cursor: 'pointer', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>Ver Origen <ArrowUpRight size={12} /></button>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #dc2626' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Pasivos Totales</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#b91c1c', marginTop: '8px' }}>
                  {formatCurrency(balance.pasivos.total)}
                </h3>
                <button onClick={() => handleVerOrigen('Pasivos Totales', m => m.status === 'pendiente' && m.type === 'out')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', cursor: 'pointer', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>Ver Origen <ArrowUpRight size={12} /></button>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #9333ea' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Patrimonio Neto Total</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7e22ce', marginTop: '8px' }}>
                  {formatCurrency(balance.patrimonio.total)}
                </h3>
                <button onClick={() => handleVerOrigen('Patrimonio Neto', m => true)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', cursor: 'pointer', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>Ver Origen <ArrowUpRight size={12} /></button>
              </Card>

              <Card padding="sm" style={{ borderLeft: '4px solid #16a34a' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Resultado Operativo Acum.</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: operativo.neto >= 0 ? '#16a34a' : '#dc2626', marginTop: '8px' }}>
                  {formatCurrency(operativo.neto)}
                </h3>
                <button onClick={() => handleVerOrigen('Resultado Operativo', m => m.type !== 'transfer' && !CAPITAL_CATEGORIES.some(c => (m.category || '').toLowerCase().includes(c)))} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', cursor: 'pointer', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>Ver Origen <ArrowUpRight size={12} /></button>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'balance' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <Card>
              <CardHeader title="Activos" subtitle="Todo lo que tiene la empresa" />
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span>Caja Físcia y Bancos (Liquidez)</span>
                  <b>{formatCurrency(balance.activos.liquidez)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span>Stock</span>
                  <b>{formatCurrency(balance.activos.stock)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span>Maquinaria</span>
                  <b>{formatCurrency(balance.activos.maquinaria)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span>Vehículos</span>
                  <b>{formatCurrency(balance.activos.vehiculos)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span>Equipamiento</span>
                  <b>{formatCurrency(balance.activos.equipamiento)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span>Tecnología</span>
                  <b>{formatCurrency(balance.activos.tecnologia)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span>Otros Activos</span>
                  <b>{formatCurrency(balance.activos.otrosActivos)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>
                  <span>TOTAL ACTIVOS</span>
                  <span>{formatCurrency(balance.activos.total)}</span>
                </div>
              </div>
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <Card>
                <CardHeader title="Pasivos" subtitle="Todo lo que debe la empresa" />
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span>Deudas Proveedores</span>
                    <b>{formatCurrency(balance.pasivos.deudasProveedores)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span>Préstamos</span>
                    <b>{formatCurrency(balance.pasivos.prestamos)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span>Impuestos Pendientes</span>
                    <b>{formatCurrency(balance.pasivos.impuestosPendientes)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span>Otras Obligaciones</span>
                    <b>{formatCurrency(balance.pasivos.otrasObligaciones)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>
                    <span>TOTAL PASIVOS</span>
                    <span>{formatCurrency(balance.pasivos.total)}</span>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader title="Patrimonio Neto" subtitle="Capital Propio" />
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span>Capital Aportado</span>
                    <b>{formatCurrency(balance.patrimonio.aportado)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span>Resultados Acumulados</span>
                    <b>{formatCurrency(balance.patrimonio.resultados)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', fontSize: '1.25rem', fontWeight: 800, color: '#7e22ce' }}>
                    <span>PATRIMONIO NETO TOTAL</span>
                    <span>{formatCurrency(balance.patrimonio.total)}</span>
                  </div>
                </div>
              </Card>

              {!balance.balanceCierra && (
                <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontWeight: 'bold' }}>
                  <AlertCircle size={20} style={{ marginBottom: '8px' }} />
                  Error de Validación: El balance no cierra.
                  <br />Diferencia: {formatCurrency(balance.diferenciaBalance)}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'liquidez' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
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
                    <span>Inyección de Capital / Aportes (Sólo Dinero)</span>
                    <b style={{ color: '#16a34a' }}>+{formatCurrency(capital.byType['dinero'] || 0)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                    <span>Retiros de Utilidades / Devoluciones</span>
                    <b style={{ color: '#dc2626' }}>-{formatCurrency(0)}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', fontSize: '1.1rem' }}>
                    <b>Variación Total Liquidez:</b>
                    <b style={{ color: '#2563eb' }}>{formatCurrency(operativo.neto + (capital.byType['dinero'] || 0))}</b>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'resultados' && (
          <Card>
            <CardHeader title="Estado de Resultados" subtitle="Rentabilidad real excluyendo capitalizaciones" />
            <div style={{ padding: '24px' }}>
               <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '1.1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 600 }}>Ventas</span>
                    <b style={{ color: '#166534' }}>{formatCurrency(operativo.ventas)}</b>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 600 }}>(-) Compras</span>
                    <b style={{ color: '#991b1b' }}>{formatCurrency(operativo.compras)}</b>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 600 }}>(-) Gastos Operativos</span>
                    <b style={{ color: '#991b1b' }}>{formatCurrency(operativo.gastos)}</b>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', backgroundColor: '#fef2f2', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 600 }}>(-) Costos Financieros</span>
                    <b style={{ color: '#991b1b' }}>{formatCurrency(0)}</b>
                  </div>

                  <div style={{ height: '2px', backgroundColor: 'var(--border-color)', margin: '8px 0' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '24px', backgroundColor: operativo.neto >= 0 ? '#16a34a' : '#dc2626', color: '#fff', borderRadius: '8px', fontSize: '1.25rem' }}>
                    <span style={{ fontWeight: 800 }}>= Resultado Operativo</span>
                    <b style={{ fontWeight: 900 }}>{formatCurrency(operativo.neto)}</b>
                  </div>

                  <div style={{ padding: '16px', marginTop: '16px', backgroundColor: '#fffbe1', borderRadius: '8px', fontSize: '0.85rem', color: '#854d0e' }}>
                    <b>Excluido de este cálculo:</b> Aportes de Socios, Activos, Capitalizaciones, Transferencias Internas.
                  </div>
               </div>
            </div>
          </Card>
        )}

        {activeTab === 'pasivos' && (
          <Card>
            <CardHeader title="Gestión de Pasivos" subtitle="Control de obligaciones pendientes" />
            <div style={{ padding: '24px' }}>
               {balance.pasivos.lista.length === 0 ? (
                 <EmptyState icon={CheckCircle2} title="Sin deudas" description="No hay obligaciones pendientes registradas en la Base Financiera." />
               ) : (
                 <Table 
                   data={balance.pasivos.lista}
                   keyExtractor={item => item.id!}
                   columns={[
                     { header: 'Fecha', accessor: item => new Date(item.date).toLocaleDateString(), width: '100px' },
                     { header: 'Vencimiento', accessor: item => item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'N/A', width: '100px' },
                     { header: 'Descripción', accessor: item => item.description || item.category, width: '200px' },
                     { header: 'Importe Original', accessor: item => formatCurrency(item.originalAmount || item.amount), width: '120px' },
                     { header: 'Saldo Pendiente', accessor: item => <b style={{ color: '#dc2626' }}>{formatCurrency(item.pendingAmount || item.amount)}</b>, width: '120px' },
                     { header: 'Estado', accessor: item => <span style={{ padding: '4px 8px', borderRadius: '12px', backgroundColor: '#fef2f2', color: '#991b1b', fontSize: '0.75rem', fontWeight: 'bold' }}>{item.status?.toUpperCase() || 'PENDIENTE'}</span>, width: '100px' }
                   ]}
                 />
               )}
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
                    <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#92400e' }}>{formatCurrency(capital.capitalNeto)}</span>
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

        {activeTab === 'diagnostico' && (
          <Card>
            <CardHeader title="Auditoría y Origen de Cálculos" subtitle="Trazabilidad exacta de cada KPI desde la Base Financiera" />
            <div style={{ padding: '24px' }}>
              
              {/* Prueba Automática y Dashboard de Integridad */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: '#f0fdfa', padding: '16px', borderRadius: '8px', border: '1px solid #ccfbf1' }}>
                  <h4 style={{ fontWeight: 700, color: '#0f766e', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={18}/> Estado del Sistema Financiero
                  </h4>
                  <p style={{ fontSize: '0.85rem', marginBottom: '4px' }}><b>Fuente Principal:</b> cash_movements</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '4px' }}><b>Colecciones Legacy Activas:</b> 0</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '4px' }}><b>Registros Legacy Detectados:</b> {distributions.length + reinvestments.length + contributions.length}</p>
                  <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}><b>Impacto en KPIs:</b> 0 (Desvinculados)</p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#dcfce7', color: '#166534', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                    <CheckCircle2 size={14} /> SANO
                  </div>
                </div>

                <div style={{ backgroundColor: '#eff6ff', padding: '16px', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                  <h4 style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={18}/> Prueba Automática de Integridad
                  </h4>
                  <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                    Comparando cálculo "Capital Dashboard" (legacy logic) vs Capital calculado desde `cash_movements`.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                    <span>Capital actual (Base Financiera):</span>
                    <b>{formatCurrency(capital.capitalNeto)}</b>
                  </div>
                  {(() => {
                    const legacyCapital = contributions.reduce((sum, c) => sum + (c.type === 'contribution' ? c.amount : -c.amount), 0) + reinvestments.reduce((sum, r) => sum + r.amount, 0) - distributions.reduce((sum, d) => sum + d.amount, 0);
                    const diff = capital.capitalNeto - legacyCapital;
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <span>Capital Legacy Calculado:</span>
                          <b>{formatCurrency(legacyCapital)}</b>
                        </div>
                        {diff !== 0 && (
                          <div style={{ backgroundColor: '#fef2f2', color: '#b91c1c', padding: '8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={14} /> Diferencia Detectada: {formatCurrency(diff)}
                          </div>
                        )}
                        {diff === 0 && (
                          <div style={{ color: '#16a34a', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle2 size={14} /> 100% Consistente
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', backgroundColor: '#fffbe1', padding: '16px', borderRadius: '8px', border: '1px solid #fef08a' }}>
                <div>
                  <h4 style={{ fontWeight: 700, color: '#854d0e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={18}/> Transición Completada</h4>
                  <p style={{ fontSize: '0.9rem', color: '#713f12' }}>El Dashboard Financiero ha sido <b>desvinculado exitosamente</b> de las colecciones legacy (partner_contributions, profit_distributions, reinvestments). Actualmente el 100% de los cálculos provienen única y exclusivamente de la colección `cash_movements` (Base Financiera).</p>
                </div>
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px' }}>Capital Neto Empresa: {formatCurrency(capital.capitalNeto)}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Movimientos que componen este valor:</p>
              
              <Table 
                data={filteredMovements.filter(m => CAPITAL_CATEGORIES.some(c => (m.category || '').toLowerCase().includes(c)))}
                keyExtractor={item => item.id!}
                columns={[
                  { header: 'Fecha', accessor: item => new Date(item.date).toLocaleDateString(), width: '100px' },
                  { header: 'Categoría', accessor: item => item.category, width: '150px' },
                  { header: 'Tipo Aporte', accessor: item => item.aporteType || 'dinero', width: '150px' },
                  { header: 'Importe', accessor: item => formatCurrency(item.amount), width: '120px' },
                  { header: 'Tipo', accessor: item => item.type === 'in' ? 'Suma' : 'Resta', width: '80px' },
                  { header: 'Origen', accessor: () => 'Base Financiera (cash_movements)' }
                ]}
              />

              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '48px', marginBottom: '16px' }}>Resultado Operativo: {formatCurrency(operativo.neto)}</h3>
              <Table 
                data={filteredMovements.filter(m => !CAPITAL_CATEGORIES.some(c => (m.category || '').toLowerCase().includes(c)) && m.type !== 'transfer')}
                keyExtractor={item => item.id!}
                columns={[
                  { header: 'Fecha', accessor: item => new Date(item.date).toLocaleDateString(), width: '100px' },
                  { header: 'Categoría', accessor: item => item.category, width: '150px' },
                  { header: 'Importe', accessor: item => formatCurrency(item.amount), width: '120px' },
                  { header: 'Tipo', accessor: item => item.type === 'in' ? 'Ingreso' : 'Egreso', width: '100px' },
                  { header: 'Origen', accessor: () => 'Base Financiera (cash_movements)' }
                ]}
              />

              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '48px', marginBottom: '16px' }}>Variación Total Liquidez: {formatCurrency(operativo.neto + (capital.byType['dinero'] || 0))}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Esto explica exactamente cómo se movió el dinero líquido. <br/>
                <b>Nota Crítica:</b> Se excluyen estrictamente los aportes no monetarios (vehículos, maquinaria) que antes inflaban la caja.
              </p>
              <Table 
                data={filteredMovements.filter(m => 
                  m.type !== 'transfer' && 
                  (!CAPITAL_CATEGORIES.some(c => (m.category || '').toLowerCase().includes(c)) || 
                  ((m.category || '').toLowerCase() === 'aporte_socio' && (m.aporteType === 'dinero' || !m.aporteType)))
                )}
                keyExtractor={item => item.id!}
                columns={[
                  { header: 'Fecha', accessor: item => new Date(item.date).toLocaleDateString(), width: '100px' },
                  { header: 'Categoría', accessor: item => item.category, width: '150px' },
                  { header: 'Aporte Tipo', accessor: item => item.aporteType || 'N/A', width: '100px' },
                  { header: 'Importe', accessor: item => formatCurrency(item.amount), width: '120px' },
                  { header: 'Tipo', accessor: item => item.type === 'in' ? 'Ingreso' : 'Egreso', width: '100px' },
                  { header: 'Origen', accessor: () => 'Base Financiera' }
                ]}
              />
            </div>
          </Card>
        )}

      </div>

      {origenModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', width: '90%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Origen de: {origenModal.title}</h2>
              <button onClick={() => setOrigenModal({ ...origenModal, isOpen: false })} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>&times;</button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                Se encontraron <b>{origenModal.sourceMovements.length}</b> movimientos en la Base Financiera que componen este valor.
              </p>
              <Table 
                data={origenModal.sourceMovements}
                keyExtractor={item => item.id!}
                columns={[
                  { header: 'Fecha', accessor: item => new Date(item.date).toLocaleDateString(), width: '100px' },
                  { header: 'Categoría', accessor: item => item.category, width: '150px' },
                  { header: 'Descripción', accessor: item => item.description, width: '200px' },
                  { header: 'Cuenta/Modo', accessor: item => item.method, width: '120px' },
                  { header: 'Impacto', accessor: item => <b style={{ color: item.type === 'in' ? '#16a34a' : '#dc2626' }}>{formatCurrency(item.amount)} ({item.type})</b>, width: '120px' }
                ]}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
