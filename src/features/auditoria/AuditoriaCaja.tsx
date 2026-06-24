import React, { useState, useMemo } from 'react';
import { useCajaStore } from '../../store/cajaStore';
import { useDashboardCache } from '../dashboard/useDashboardCache';
import { useFinancialAccountsStore } from '../../store/financialAccountsStore';
import { ShieldAlert, Activity, GitCompare } from 'lucide-react';
import type { CajaMovement } from '../../types/domain';

const formatMoney = (val: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

export default function AuditoriaCaja() {
  const [activeTab, setActiveTab] = useState<'AUDITORIA' | 'REVISAR' | 'DIAGNOSTICO'>('AUDITORIA');
  
  const movements = useCajaStore(state => state.movements);
  const { cacheCaja } = useDashboardCache();
  const accounts = useFinancialAccountsStore(state => state.accounts);

  // A. Auditoria de Caja
  const [filterText, setFilterText] = useState('');

  const { normales, anulados, compensatorios } = useMemo(() => {
    const norm: CajaMovement[] = [];
    const anul: CajaMovement[] = [];
    const comp: CajaMovement[] = [];
    
    movements.forEach(m => {
      // Un movimiento "anulado" lógicamente (el registro original cuando se hace click en anular, no tenemos una marca clara en el viejo modelo, pero si tiene estado "ANULADO")
      // Asumiremos que si la category es ANULACION, es un compensatorio.
      if (m.category === 'ANULACION' || m.description?.toLowerCase().includes('anulaci')) {
        comp.push(m);
      } else {
        // En el viejo sistema no habia isDeleted ni nada, solo se inyectaba el opuesto.
        // Mantenemos logica simplificada.
        norm.push(m);
      }
    });

    return { normales: norm, anulados: anul, compensatorios: comp };
  }, [movements]);

  // B. Movimientos a Revisar (Anomalías)
  const anomalies = useMemo(() => {
    return movements.filter((m, i, arr) => {
      if (Number.isNaN(Number(m.amount))) return true;
      if (Number(m.amount) === 0) return true;
      if (!m.accountId) return true;
      if (m.category === 'ANULACION') return true;
      if (new Date(m.date).getTime() > Date.now() + 86400000) return true; // Fecha futura (> 1 dia)
      
      // Duplicados: mismo monto, mismo tipo, misma cuenta, tiempo muy cercano (1 minuto)
      const isDuplicate = arr.some(other => 
        other.id !== m.id &&
        other.amount === m.amount &&
        other.type === m.type &&
        other.accountId === m.accountId &&
        Math.abs(new Date(m.date).getTime() - new Date(other.date).getTime()) < 60000
      );
      if (isDuplicate) return true;

      return false;
    });
  }, [movements]);

  // C. Diagnostico Financiero (Dashboard vs Caja)
  const diag = useMemo(() => {
    // Calculo CAJA
    let ingresosCaja = 0;
    let egresosCaja = 0;
    let efectivoCaja = 0;
    let bancosCaja = 0;

    movements.forEach(m => {
      const amt = Number(m.amount) || 0;
      if (m.type === 'INCOME') ingresosCaja += amt;
      else if (m.type === 'EXPENSE') egresosCaja += amt;

      const acc = accounts.find(a => a.id === m.accountId);
      const isBanco = acc ? (acc.tipo === 'BANCO' || acc.tipo === 'BILLETERA_VIRTUAL') : (m.description?.toLowerCase().includes('banco') || m.category?.toLowerCase().includes('transferencia'));
      
      if (isBanco) {
        if (m.type === 'INCOME') bancosCaja += amt;
        else if (m.type === 'EXPENSE') bancosCaja -= amt;
      } else {
        if (m.type === 'INCOME') efectivoCaja += amt;
        else if (m.type === 'EXPENSE') efectivoCaja -= amt;
      }
    });

    // Calculo DASHBOARD (Usando el cache)
    let ingresosDash = 0;
    let egresosDash = 0;
    (cacheCaja?.movements || []).forEach(m => {
      const amt = Number(m.amount) || 0;
      if (m.type === 'INCOME') ingresosDash += amt;
      else if (m.type === 'EXPENSE') egresosDash += amt;
    });
    
    // Identificar exactos que generan diferencias
    const diffRecords: CajaMovement[] = [];
    const NaNRecords = movements.filter(m => Number.isNaN(Number(m.amount)));
    
    return {
      caja: {
        ingresos: ingresosCaja,
        egresos: egresosCaja,
        efectivo: efectivoCaja,
        bancos: bancosCaja,
        saldo: efectivoCaja + bancosCaja
      },
      dashboard: {
        ingresos: ingresosDash,
        egresos: egresosDash,
        saldo: ingresosDash - egresosDash
      },
      diffRecords,
      NaNRecords
    };
  }, [movements, accounts, cacheCaja]);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 className="page-title">Centro de Auditoría</h1>
      
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button 
          onClick={() => setActiveTab('AUDITORIA')}
          style={{ background: 'none', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', backgroundColor: activeTab === 'AUDITORIA' ? '#1e293b' : 'transparent', color: activeTab === 'AUDITORIA' ? '#fff' : 'var(--text-secondary)' }}
        >
          <Activity size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }}/> 
          Auditoría de Caja
        </button>
        <button 
          onClick={() => setActiveTab('REVISAR')}
          style={{ background: 'none', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', backgroundColor: activeTab === 'REVISAR' ? '#1e293b' : 'transparent', color: activeTab === 'REVISAR' ? '#fff' : 'var(--text-secondary)' }}
        >
          <ShieldAlert size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }}/> 
          Movimientos a Revisar
        </button>
        <button 
          onClick={() => setActiveTab('DIAGNOSTICO')}
          style={{ background: 'none', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 600, fontSize: '13.5px', cursor: 'pointer', backgroundColor: activeTab === 'DIAGNOSTICO' ? '#1e293b' : 'transparent', color: activeTab === 'DIAGNOSTICO' ? '#fff' : 'var(--text-secondary)' }}
        >
          <GitCompare size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }}/> 
          Diagnóstico Financiero
        </button>
      </div>

      {activeTab === 'AUDITORIA' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="apple-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Movimientos</span><div style={{ fontSize: '24px', fontWeight: 'bold' }}>{movements.length}</div></div>
            <div><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Normales</span><div style={{ fontSize: '24px', fontWeight: 'bold' }}>{normales.length}</div></div>
            <div><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Anulados/Compens.</span><div style={{ fontSize: '24px', fontWeight: 'bold' }}>{compensatorios.length}</div></div>
            <div><span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Saldo Neto</span><div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>{formatMoney(diag.caja.saldo)}</div></div>
          </div>

          <div className="apple-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3>Historial General</h3>
            <input 
              type="text" 
              placeholder="Buscar por descripción, categoría..." 
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
            />
            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="apple-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Categoría</th>
                    <th>Descripción</th>
                    <th>Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.filter(m => JSON.stringify(m).toLowerCase().includes(filterText.toLowerCase())).map(m => (
                    <tr key={m.id}>
                      <td>{new Date(m.date).toLocaleString()}</td>
                      <td>{m.type}</td>
                      <td>{m.category}</td>
                      <td>{m.description}</td>
                      <td style={{ color: m.type === 'INCOME' ? '#16a34a' : '#ef4444' }}>{formatMoney(Number(m.amount)||0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'REVISAR' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="apple-card">
            <h3>Movimientos Sospechosos ({anomalies.length})</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
              Se detectaron {anomalies.length} movimientos que cumplen reglas de anomalía (duplicados, compensatorios, importes NaN/0, sin cuenta).
            </p>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <table className="apple-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Importe</th>
                    <th>Motivo Posible</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.map(m => {
                    let motivo = "Anomalía no especificada";
                    if (Number.isNaN(Number(m.amount))) motivo = "Importe NaN";
                    else if (Number(m.amount) === 0) motivo = "Importe Cero";
                    else if (!m.accountId) motivo = "Sin cuenta";
                    else if (m.category === 'ANULACION') motivo = "Es una anulación compensatoria";
                    else motivo = "Posible duplicado o fecha futura";

                    return (
                      <tr key={m.id}>
                        <td><span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{m.id}</span></td>
                        <td>{new Date(m.date).toLocaleString()}</td>
                        <td style={{ color: '#ef4444' }}>{m.amount}</td>
                        <td style={{ fontWeight: 'bold' }}>{motivo}</td>
                      </tr>
                    );
                  })}
                  {anomalies.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>No hay anomalías detectadas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'DIAGNOSTICO' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="apple-card">
              <h3>Cálculos según Dashboard</h3>
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ingresos Totales:</span> <strong>{formatMoney(diag.dashboard.ingresos)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Egresos Totales:</span> <strong>{formatMoney(diag.dashboard.egresos)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}><span>Saldo Final:</span> <strong style={{ fontSize: '20px' }}>{formatMoney(diag.dashboard.saldo)}</strong></div>
              </div>
            </div>

            <div className="apple-card">
              <h3>Cálculos según Caja</h3>
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Ingresos Totales:</span> <strong>{formatMoney(diag.caja.ingresos)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Egresos Totales:</span> <strong>{formatMoney(diag.caja.egresos)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Fondo Efectivo:</span> <strong>{formatMoney(diag.caja.efectivo)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Fondo Bancos:</span> <strong>{formatMoney(diag.caja.bancos)}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}><span>Saldo Final:</span> <strong style={{ fontSize: '20px' }}>{formatMoney(diag.caja.saldo)}</strong></div>
              </div>
            </div>
          </div>
          
          <div className="apple-card">
            <h3>Desvíos Detectados</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
              Diferencia Matemática Global: <strong>{formatMoney(diag.caja.saldo - diag.dashboard.saldo)}</strong>
            </p>
            {diag.NaNRecords.length > 0 ? (
              <div style={{ color: '#ef4444', padding: '12px', backgroundColor: '#fee2e2', borderRadius: '8px' }}>
                <strong>Cuidado:</strong> Hay {diag.NaNRecords.length} registros generando NaN y corrompiendo operaciones.
              </div>
            ) : (
              <div style={{ color: '#16a34a', padding: '12px', backgroundColor: '#dcfce7', borderRadius: '8px' }}>
                No se detectaron registros NaN matemáticamente irresolubles.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
