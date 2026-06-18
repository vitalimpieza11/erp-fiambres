import { useState } from 'react';
import { useCaja } from './useCaja';
import RightPanel from '../../components/RightPanel';
import {
  TrendingUp,
  TrendingDown,
  Landmark,
  Wallet,
  LayoutDashboard,
  ChevronRight,
  RotateCcw,
  Info
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import type { FinancialAccount } from '../../types/domain';

const formatMoney = (val: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

type FilterCategory = 'ALL' | 'EFECTIVO' | 'BANCOS';

export default function Caja() {
  const {
    resolvedMovements,
    accounts,
    loading,
    totalEfectivo,
    totalBancos,
    currentBalance,
    accountBalances,
    ingresosHoy,
    egresosHoy,
    ingresosMes,
    egresosMes,
    addMovement,
    annulMovement
  } = useCaja();

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [movType, setMovType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [amount, setAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [formAccountId, setFormAccountId] = useState('');

  // Filtering states
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('ALL');
  const [filterAccountId, setFilterAccountId] = useState<string>('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;
    if (!formAccountId) return alert('Debe seleccionar una cuenta financiera.');
    await addMovement({
      type: movType,
      amount: Number(amount),
      category: 'OTROS',
      description,
      accountId: formAccountId
    });
    setShowAddPanel(false);
    setAmount('');
    setDescription('');
  };

  const handleOpenAdd = (type: 'INCOME' | 'EXPENSE') => {
    setMovType(type);
    // Default to active cash account, or first account in the current filter category
    const activeCash = accounts.find(a => a.activa && a.tipo === 'EFECTIVO');
    const activeAny = accounts.find(a => a.activa);
    setFormAccountId(activeCash?.id || activeAny?.id || '');
    setShowAddPanel(true);
  };

  const handleAnnul = async (id: string) => {
    const reason = window.prompt('Motivo de anulación:');
    if (!reason) return;
    await annulMovement(id, reason);
  };

  const handleSelectCategory = (cat: FilterCategory) => {
    setFilterCategory(cat);
    setFilterAccountId('');
  };

  const handleSelectAccount = (accountId: string) => {
    setFilterAccountId(prev => prev === accountId ? '' : accountId);
  };

  if (loading) return <LoadingSpinner message="Cargando caja..." />;

  // Accounts grouped by category
  const efectivoAccounts = accountBalances.filter(ab => ab.account.tipo === 'EFECTIVO');
  const bancosAccounts = accountBalances.filter(ab => ab.account.tipo === 'BANCO' || ab.account.tipo === 'BILLETERA_VIRTUAL');

  // Active sub-accounts to display as pill filters
  const activeSubAccounts: typeof accountBalances =
    filterCategory === 'EFECTIVO' ? efectivoAccounts :
    filterCategory === 'BANCOS' ? bancosAccounts :
    [];

  // Filtered movements
  const filteredMovements = resolvedMovements.filter(mov => {
    if (filterAccountId) return mov.resolvedAccountId === filterAccountId;
    if (filterCategory === 'ALL') return true;
    if (filterCategory === 'EFECTIVO') {
      const acc = accounts.find(a => a.id === mov.resolvedAccountId);
      return acc ? acc.tipo === 'EFECTIVO' : false;
    }
    if (filterCategory === 'BANCOS') {
      const acc = accounts.find(a => a.id === mov.resolvedAccountId);
      return acc ? (acc.tipo === 'BANCO' || acc.tipo === 'BILLETERA_VIRTUAL') : false;
    }
    return true;
  });

  // Group filtered movements by date
  const groupedMovements = filteredMovements.reduce((acc, mov) => {
    const dateStr = new Date(mov.date).toLocaleDateString('es-AR');
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(mov);
    return acc;
  }, {} as Record<string, typeof filteredMovements>);

  const getAccountName = (resolvedAccountId: string) =>
    accounts.find(a => a.id === resolvedAccountId)?.nombre || 'Cuenta desconocida';

  const getTipoLabel = (tipo: FinancialAccount['tipo']) => {
    if (tipo === 'EFECTIVO') return 'Efectivo';
    if (tipo === 'BANCO') return 'Banco';
    return 'Billetera Virtual';
  };

  return (
    <div>
      {/* --- Header --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Caja</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => handleOpenAdd('INCOME')}
            className="btn-secondary"
            style={{ color: '#16a34a' }}
          >
            + Ingreso Manual
          </button>
          <button
            onClick={() => handleOpenAdd('EXPENSE')}
            className="btn-secondary"
            style={{ color: '#ef4444' }}
          >
            − Egreso Manual
          </button>
        </div>
      </div>

      {/* --- Tarjetas de Balance --- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
        {/* Caja Física */}
        <div
          onClick={() => handleSelectCategory(filterCategory === 'EFECTIVO' ? 'ALL' : 'EFECTIVO')}
          className="apple-card"
          style={{
            cursor: 'pointer',
            background: filterCategory === 'EFECTIVO'
              ? 'linear-gradient(135deg, #166534, #16a34a)'
              : 'var(--surface-color)',
            color: filterCategory === 'EFECTIVO' ? 'white' : 'inherit',
            border: filterCategory === 'EFECTIVO' ? 'none' : '2px solid transparent',
            transition: 'all 0.25s ease',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: filterCategory === 'EFECTIVO' ? 'rgba(255,255,255,0.2)' : '#dcfce7',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Wallet size={22} color={filterCategory === 'EFECTIVO' ? 'white' : '#16a34a'} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Caja Física
              </div>
              <div style={{ fontSize: '11px', opacity: 0.6 }}>Efectivo en mano</div>
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {formatMoney(totalEfectivo)}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.65, marginTop: '8px' }}>
            {efectivoAccounts.length} {efectivoAccounts.length === 1 ? 'cuenta' : 'cuentas'}
          </div>
          {filterCategory === 'EFECTIVO' && (
            <div style={{
              position: 'absolute', bottom: '16px', right: '16px',
              fontSize: '11px', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              Filtrando <ChevronRight size={12} />
            </div>
          )}
        </div>

        {/* Bancos y Billeteras */}
        <div
          onClick={() => handleSelectCategory(filterCategory === 'BANCOS' ? 'ALL' : 'BANCOS')}
          className="apple-card"
          style={{
            cursor: 'pointer',
            background: filterCategory === 'BANCOS'
              ? 'linear-gradient(135deg, #1e3a5f, #1d4ed8)'
              : 'var(--surface-color)',
            color: filterCategory === 'BANCOS' ? 'white' : 'inherit',
            border: filterCategory === 'BANCOS' ? 'none' : '2px solid transparent',
            transition: 'all 0.25s ease',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: filterCategory === 'BANCOS' ? 'rgba(255,255,255,0.2)' : '#dbeafe',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Landmark size={22} color={filterCategory === 'BANCOS' ? 'white' : '#1d4ed8'} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Bancos y Billeteras
              </div>
              <div style={{ fontSize: '11px', opacity: 0.6 }}>Cuentas bancarias</div>
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {formatMoney(totalBancos)}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.65, marginTop: '8px' }}>
            {bancosAccounts.length} {bancosAccounts.length === 1 ? 'cuenta' : 'cuentas'}
          </div>
          {filterCategory === 'BANCOS' && (
            <div style={{
              position: 'absolute', bottom: '16px', right: '16px',
              fontSize: '11px', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              Filtrando <ChevronRight size={12} />
            </div>
          )}
        </div>

        {/* Total Consolidado */}
        <div
          onClick={() => handleSelectCategory('ALL')}
          className="apple-card"
          style={{
            cursor: 'pointer',
            background: filterCategory === 'ALL'
              ? 'linear-gradient(135deg, var(--alvacio-red-dark), var(--alvacio-red))'
              : 'var(--surface-color)',
            color: filterCategory === 'ALL' ? 'white' : 'inherit',
            border: filterCategory === 'ALL' ? 'none' : '2px solid transparent',
            transition: 'all 0.25s ease',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: filterCategory === 'ALL' ? 'rgba(255,255,255,0.2)' : '#fee2e2',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <LayoutDashboard size={22} color={filterCategory === 'ALL' ? 'white' : 'var(--alvacio-red)'} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Consolidado
              </div>
              <div style={{ fontSize: '11px', opacity: 0.6 }}>Todos los fondos</div>
            </div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {formatMoney(currentBalance)}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.65, marginTop: '8px' }}>
            {accounts.length} {accounts.length === 1 ? 'cuenta activa' : 'cuentas activas'}
          </div>
        </div>
      </div>

      {/* --- Sub-cuentas (Drill-down de cuentas de la categoría seleccionada) --- */}
      {filterCategory !== 'ALL' && activeSubAccounts.length > 0 && (
        <div style={{
          background: 'var(--surface-color)',
          borderRadius: '16px',
          padding: '20px 24px',
          marginBottom: '24px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Cuentas · {filterCategory === 'EFECTIVO' ? 'Efectivo' : 'Bancos y Billeteras'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {activeSubAccounts.map(ab => {
              const isSelected = filterAccountId === ab.account.id;
              const isEfectivo = ab.account.tipo === 'EFECTIVO';
              const accentColor = isEfectivo ? '#16a34a' : '#1d4ed8';
              const bgColor = isEfectivo ? '#dcfce7' : '#dbeafe';
              return (
                <button
                  key={ab.account.id}
                  onClick={() => handleSelectAccount(ab.account.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '16px 20px',
                    borderRadius: '14px',
                    border: isSelected ? `2px solid ${accentColor}` : '2px solid var(--border-color)',
                    background: isSelected ? bgColor : 'var(--bg-color)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    minWidth: '180px',
                    fontFamily: 'inherit'
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: isSelected ? accentColor : 'var(--text-secondary)', marginBottom: '4px' }}>
                    {ab.account.nombre}
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: isSelected ? accentColor : 'var(--text-primary)' }}>
                    {formatMoney(ab.balance)}
                  </span>
                  <span style={{
                    marginTop: '6px', fontSize: '10px', fontWeight: 600,
                    padding: '2px 8px', borderRadius: '999px',
                    background: isSelected ? accentColor : 'var(--border-color)',
                    color: isSelected ? 'white' : 'var(--text-secondary)'
                  }}>
                    {getTipoLabel(ab.account.tipo)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* --- Estadísticas Hoy / Mes --- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
        <div className="apple-card">
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '20px', fontWeight: 600 }}>
            Hoy
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Ingresos</span>
              <strong style={{ fontSize: '20px', color: '#16a34a' }}>{formatMoney(ingresosHoy)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Egresos</span>
              <strong style={{ fontSize: '20px', color: '#ef4444' }}>{formatMoney(egresosHoy)}</strong>
            </div>
          </div>
        </div>

        <div className="apple-card">
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '20px', fontWeight: 600 }}>
            Este Mes
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Ingresos</span>
              <strong style={{ fontSize: '20px', color: '#16a34a' }}>{formatMoney(ingresosMes)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Egresos</span>
              <strong style={{ fontSize: '20px', color: '#ef4444' }}>{formatMoney(egresosMes)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* --- Movimientos --- */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '24px', margin: 0 }}>
            Movimientos
            {filterAccountId && (
              <span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '12px' }}>
                · {getAccountName(filterAccountId)}
              </span>
            )}
            {!filterAccountId && filterCategory !== 'ALL' && (
              <span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '12px' }}>
                · {filterCategory === 'EFECTIVO' ? 'Caja Física' : 'Bancos y Billeteras'}
              </span>
            )}
          </h2>
          {(filterCategory !== 'ALL' || filterAccountId) && (
            <button
              onClick={() => { setFilterCategory('ALL'); setFilterAccountId(''); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                padding: '8px 16px', borderRadius: '999px',
                fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer'
              }}
            >
              <RotateCcw size={13} /> Ver todos
            </button>
          )}
        </div>

        {Object.keys(groupedMovements).length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '60px 20px', color: 'var(--text-secondary)', gap: '12px'
          }}>
            <Info size={32} color="var(--border-color)" />
            <p style={{ textAlign: 'center', margin: 0, fontSize: '15px' }}>
              No hay movimientos{filterCategory !== 'ALL' || filterAccountId ? ' para el filtro seleccionado' : ' registrados'}.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {Object.entries(groupedMovements).map(([dateStr, movs]) => (
              <div key={dateStr}>
                <h3 style={{
                  fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)',
                  marginBottom: '16px', borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>
                  {dateStr}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {movs.map((mov) => {
                    const accName = getAccountName(mov.resolvedAccountId);
                    const accObj = accounts.find(a => a.id === mov.resolvedAccountId);
                    const accColor = accObj?.tipo === 'EFECTIVO' ? '#16a34a'
                      : accObj?.tipo === 'BANCO' ? '#1d4ed8' : '#7c3aed';
                    const accBg = accObj?.tipo === 'EFECTIVO' ? '#dcfce7'
                      : accObj?.tipo === 'BANCO' ? '#dbeafe' : '#ede9fe';

                    return (
                      <div key={mov.id} className="apple-card" style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                          <div style={{
                            width: '42px', height: '42px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backgroundColor: mov.type === 'INCOME' ? '#dcfce7' : '#fee2e2',
                            color: mov.type === 'INCOME' ? '#16a34a' : '#ef4444',
                            flexShrink: 0
                          }}>
                            {mov.type === 'INCOME' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '15px' }}>{mov.category}</div>
                            {mov.description && (
                              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {mov.description}
                              </div>
                            )}
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span>{new Date(mov.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span>•</span>
                              <span
                                onClick={() => { handleSelectAccount(mov.resolvedAccountId); setFilterCategory(accObj?.tipo === 'EFECTIVO' ? 'EFECTIVO' : 'BANCOS'); }}
                                style={{
                                  backgroundColor: accBg, padding: '2px 8px', borderRadius: '999px',
                                  fontSize: '11px', fontWeight: 600, color: accColor, cursor: 'pointer'
                                }}
                              >
                                {accName}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          <span style={{
                            fontSize: '20px', fontWeight: 700,
                            color: mov.type === 'INCOME' ? '#16a34a' : '#ef4444'
                          }}>
                            {mov.type === 'INCOME' ? '+' : '−'}{formatMoney(mov.amount)}
                          </span>
                          {mov.category !== 'ANULACION' && (
                            <button
                              onClick={() => handleAnnul(mov.id)}
                              style={{
                                background: 'transparent', border: 'none',
                                color: '#ef4444', textDecoration: 'underline',
                                fontSize: '12px', cursor: 'pointer', padding: 0
                              }}
                            >
                              Anular
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- Panel Lateral de Nuevo Movimiento --- */}
      <RightPanel
        isOpen={showAddPanel}
        onClose={() => setShowAddPanel(false)}
        title={movType === 'INCOME' ? 'Nuevo Ingreso' : 'Nuevo Egreso'}
      >
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label>Monto ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || '')}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Cuenta Financiera *</label>
            <select
              required
              value={formAccountId}
              onChange={(e) => setFormAccountId(e.target.value)}
            >
              <option value="">Seleccione una cuenta...</option>
              {accounts.filter(a => a.activa).map(a => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({getTipoLabel(a.tipo)})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Motivo del movimiento..."
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddPanel(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>
              Registrar
            </button>
          </div>
        </form>
      </RightPanel>
    </div>
  );
}
