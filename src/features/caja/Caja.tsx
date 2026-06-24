import { useState, useEffect, useMemo } from 'react';
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
  Info,
  Pen,
  Trash2
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import type { FinancialAccount, Arqueo, CajaMovement } from '../../types/domain';
import { cajaRepository } from '../../repositories/caja/cajaRepository';

const formatMoney = (val: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

type FilterCategory = 'ALL' | 'EFECTIVO' | 'BANCOS';
type ResolvedCajaMovement = CajaMovement & { resolvedAccountId: string };


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
    annulMovement,
    updateMovement,
    deleteMovementFisico,
    transferFunds
  } = useCaja();

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [movType, setMovType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>('INCOME');
  
  // Arqueo & Corte de Caja States
  const [activeView, setActiveView] = useState<'MOVIMIENTOS' | 'ARQUEO'>('MOVIMIENTOS');
  const [arqueos, setArqueos] = useState<Arqueo[]>([]);
  const [arqueoAccountId, setArqueoAccountId] = useState('');
  const [billCounts, setBillCounts] = useState<Record<number, number>>({
    20000: 0,
    10000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    200: 0,
    100: 0,
    50: 0
  });
  const [coinsAmount, setCoinsAmount] = useState<number | ''>('');
  const [arqueoObservations, setArqueoObservations] = useState('');

  // Fetch active cash accounts
  const activeCashAccounts = useMemo(() => {
    return accounts.filter(a => a.tipo === 'EFECTIVO' && a.activa);
  }, [accounts]);

  // Set default cash account for arqueo
  useEffect(() => {
    if (!arqueoAccountId && activeCashAccounts.length > 0) {
      setArqueoAccountId(activeCashAccounts[0].id);
    }
  }, [activeCashAccounts, arqueoAccountId]);

  // Subscribe to arqueo history
  useEffect(() => {
    const unsub = cajaRepository.subscribeArqueos((data) => {
      setArqueos(data);
    });
    return () => unsub();
  }, []);
  const [amount, setAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [formAccountId, setFormAccountId] = useState('');
  const [formToAccountId, setFormToAccountId] = useState('');

  // Filtering states
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('ALL');
  const [filterAccountId, setFilterAccountId] = useState<string>('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;
    if (!formAccountId) return alert('Debe seleccionar una cuenta financiera.');

    if (editingId) {
      await updateMovement(editingId, {
        type: movType as 'INCOME' | 'EXPENSE',
        amount: Number(amount),
        description,
        accountId: formAccountId
      });
    } else {
      if (movType === 'TRANSFER') {
        if (!formToAccountId) return alert('Debe seleccionar la cuenta destino.');
        if (formAccountId === formToAccountId) return alert('La cuenta origen y destino no pueden ser la misma.');
        await transferFunds(formAccountId, formToAccountId, Number(amount), description);
      } else {
        await addMovement({
          type: movType as 'INCOME' | 'EXPENSE',
          amount: Number(amount),
          category: 'OTROS',
          description,
          accountId: formAccountId
        });
      }
    }

    setShowAddPanel(false);
    setEditingId(null);
    setAmount('');
    setDescription('');
    setFormToAccountId('');
  };

  const handleOpenAdd = (type: 'INCOME' | 'EXPENSE' | 'TRANSFER') => {
    setEditingId(null);
    setAmount('');
    setDescription('');
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

  const handleEditMovement = (mov: ResolvedCajaMovement) => {
    setEditingId(mov.id);
    setMovType(mov.type === 'INCOME' ? 'INCOME' : 'EXPENSE');
    setAmount(mov.amount);
    setDescription(mov.description || '');
    setFormAccountId(mov.resolvedAccountId || '');
    setShowAddPanel(true);
  };

  const handleDeleteDefinitivo = async (id: string) => {
    if (window.confirm("ATENCIÓN: ¿Estás seguro de que deseas eliminar PERMANENTEMENTE este movimiento? Esta acción borrará el registro de la base de datos sin dejar rastro.")) {
      await deleteMovementFisico(id);
    }
  };

  const handleSelectCategory = (cat: FilterCategory) => {
    setFilterCategory(cat);
    setFilterAccountId('');
  };

  const handleSelectAccount = (accountId: string) => {
    setFilterAccountId(prev => prev === accountId ? '' : accountId);
  };

  const selectedCashAccount = useMemo(() => {
    return accounts.find(a => a.id === arqueoAccountId);
  }, [accounts, arqueoAccountId]);

  const corteDetails = useMemo(() => {
    if (!arqueoAccountId) return { saldoInicial: 0, ingresos: 0, egresos: 0, saldoTeorico: 0 };
    const accMovements = resolvedMovements.filter(m => m.resolvedAccountId === arqueoAccountId);
    
    const saldoInicial = accMovements
      .filter(m => m.category === 'SALDO_INICIAL' || m.category === 'APORTE_SOCIOS_INICIAL' || m.description?.toLowerCase().includes('inicial'))
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
      
    const ingresos = accMovements
      .filter(m => m.type === 'INCOME' && m.category !== 'SALDO_INICIAL' && m.category !== 'APORTE_SOCIOS_INICIAL' && !m.description?.toLowerCase().includes('inicial'))
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
      
    const egresos = accMovements
      .filter(m => m.type === 'EXPENSE')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
      
    const saldoTeorico = saldoInicial + ingresos - egresos;
    
    return { saldoInicial, ingresos, egresos, saldoTeorico };
  }, [arqueoAccountId, resolvedMovements]);

  const totalContado = useMemo(() => {
    const totalBilletes = Object.entries(billCounts).reduce((sum, [denom, count]) => {
      return sum + (Number(denom) * Number(count || 0));
    }, 0);
    return totalBilletes + Number(coinsAmount || 0);
  }, [billCounts, coinsAmount]);

  const diferencia = useMemo(() => {
    return totalContado - corteDetails.saldoTeorico;
  }, [totalContado, corteDetails.saldoTeorico]);

  const handleSaveArqueo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arqueoAccountId) return alert('Seleccione una cuenta de efectivo.');
    
    try {
      await cajaRepository.saveArqueo({
        date: new Date().toISOString(),
        accountId: arqueoAccountId,
        accountName: selectedCashAccount?.nombre || 'Efectivo',
        billetes: billCounts,
        monedas: Number(coinsAmount || 0),
        totalContado,
        saldoInicial: corteDetails.saldoInicial,
        ingresos: corteDetails.ingresos,
        egresos: corteDetails.egresos,
        saldoTeorico: corteDetails.saldoTeorico,
        diferencia,
        observaciones: arqueoObservations
      });
      alert('Arqueo de caja guardado con éxito.');
      setBillCounts({
        20000: 0,
        10000: 0,
        2000: 0,
        1000: 0,
        500: 0,
        200: 0,
        100: 0,
        50: 0
      });
      setCoinsAmount('');
      setArqueoObservations('');
    } catch (err: any) {
      alert(`Error al guardar arqueo: ${err.message || err}`);
    }
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
          <button
            onClick={() => handleOpenAdd('TRANSFER')}
            className="btn-secondary"
            style={{ color: '#0284c7' }}
          >
            ⇄ Transferencia
          </button>
        </div>
      </div>

      {/* Tabs de Sub-Módulos */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button 
          onClick={() => setActiveView('MOVIMIENTOS')}
          style={{
            background: 'none', border: 'none', padding: '8px 16px', borderRadius: '20px',
            fontWeight: 600, fontSize: '13.5px', cursor: 'pointer',
            backgroundColor: activeView === 'MOVIMIENTOS' ? 'var(--alvacio-red)' : 'transparent',
            color: activeView === 'MOVIMIENTOS' ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.2s ease'
          }}
        >
          Movimientos y Saldo
        </button>
        <button 
          onClick={() => setActiveView('ARQUEO')}
          style={{
            background: 'none', border: 'none', padding: '8px 16px', borderRadius: '20px',
            fontWeight: 600, fontSize: '13.5px', cursor: 'pointer',
            backgroundColor: activeView === 'ARQUEO' ? 'var(--alvacio-red)' : 'transparent',
            color: activeView === 'ARQUEO' ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.2s ease'
          }}
        >
          Arqueo y Corte de Caja
        </button>
      </div>

      {activeView === 'MOVIMIENTOS' ? (
        <>
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

          {/* --- Sub-cuentas --- */}
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
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <button
                                  onClick={() => handleEditMovement(mov)}
                                  title="Editar movimiento"
                                  style={{
                                    background: 'transparent', border: 'none',
                                    color: '#3b82f6', cursor: 'pointer', padding: 0,
                                    display: 'flex', alignItems: 'center'
                                  }}
                                >
                                  <Pen size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteDefinitivo(mov.id)}
                                  title="Eliminar definitivamente"
                                  style={{
                                    background: 'transparent', border: 'none',
                                    color: '#ef4444', cursor: 'pointer', padding: 0,
                                    display: 'flex', alignItems: 'center'
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                                {mov.category !== 'ANULACION' && (
                                  <button
                                    onClick={() => handleAnnul(mov.id)}
                                    title="Anulación contable"
                                    style={{
                                      background: 'transparent', border: 'none',
                                      color: 'var(--text-secondary)', textDecoration: 'underline',
                                      fontSize: '12px', cursor: 'pointer', padding: 0
                                    }}
                                  >
                                    Anular
                                  </button>
                                )}
                              </div>
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
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
          {/* Formulario de Arqueo */}
          <div className="apple-card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '20px', color: 'var(--text-primary)' }}>Registrar Arqueo de Caja</h2>
            
            <form onSubmit={handleSaveArqueo} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label>Cuenta de Efectivo a Arquear</label>
                <select
                  required
                  value={arqueoAccountId}
                  onChange={e => setArqueoAccountId(e.target.value)}
                >
                  {activeCashAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Controles de Billetes */}
              <div>
                <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                  Conteo de Billetes
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {[20000, 10000, 2000, 1000, 500, 200, 100, 50].map(denom => (
                    <div key={denom} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ minWidth: '70px', fontWeight: 600, fontSize: '14px' }}>$ {denom.toLocaleString('es-AR')}:</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Cantidad"
                        value={billCounts[denom] || ''}
                        onChange={e => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setBillCounts(prev => ({ ...prev, [denom]: val }));
                        }}
                        style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', width: '100%' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Monedas */}
              <div className="form-group">
                <label>Total en Monedas ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej: 150.50"
                  value={coinsAmount}
                  onChange={e => setCoinsAmount(e.target.value ? parseFloat(e.target.value) : '')}
                />
              </div>

              <div className="form-group">
                <label>Observaciones</label>
                <textarea
                  placeholder="Detalle o nota del arqueo..."
                  value={arqueoObservations}
                  onChange={e => setArqueoObservations(e.target.value)}
                  rows={2}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ padding: '12px', fontWeight: 600 }}>
                Guardar Arqueo en Historial
              </button>
            </form>
          </div>

          {/* Resultados de Corte y Arqueo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="apple-card" style={{ padding: '24px', background: 'var(--surface-color)' }}>
              <h2 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                Corte de Caja
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Saldo Inicial:</span>
                  <strong>{formatMoney(corteDetails.saldoInicial)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                  <span>(+) Ingresos:</span>
                  <strong>{formatMoney(corteDetails.ingresos)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                  <span>(−) Egresos:</span>
                  <strong>{formatMoney(corteDetails.egresos)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px', fontSize: '16px' }}>
                  <span>Saldo Teórico:</span>
                  <strong>{formatMoney(corteDetails.saldoTeorico)}</strong>
                </div>
              </div>
            </div>

            <div className="apple-card" style={{ padding: '24px', background: 'var(--surface-color)' }}>
              <h2 style={{ fontSize: '18px', color: 'var(--text-primary)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                Arqueo de Efectivo
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                  <span>Total Contado:</span>
                  <strong style={{ color: 'var(--alvacio-red)' }}>{formatMoney(totalContado)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Saldo Teórico:</span>
                  <strong>{formatMoney(corteDetails.saldoTeorico)}</strong>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  borderTop: '1px solid var(--border-color)', 
                  paddingTop: '10px', 
                  marginTop: '4px', 
                  fontSize: '18px',
                  color: diferencia === 0 ? 'var(--text-primary)' : diferencia > 0 ? '#16a34a' : '#ef4444'
                }}>
                  <span>Diferencia:</span>
                  <strong>{diferencia > 0 ? '+' : ''}{formatMoney(diferencia)}</strong>
                </div>
                {diferencia !== 0 && (
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '8px 12px', 
                    borderRadius: '8px', 
                    fontSize: '12px', 
                    backgroundColor: diferencia > 0 ? '#dcfce7' : '#fee2e2',
                    color: diferencia > 0 ? '#15803d' : '#b91c1c' 
                  }}>
                    {diferencia > 0 ? 'Sobrante de caja detectado.' : 'Faltante de caja detectado.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Historial de Arqueos */}
          <div className="apple-card" style={{ gridColumn: '1 / -1', padding: '24px', marginTop: '16px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '16px', color: 'var(--text-primary)' }}>Historial de Arqueos</h2>
            {arqueos.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No hay arqueos registrados.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="apple-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      <th style={{ padding: '10px' }}>Fecha</th>
                      <th style={{ padding: '10px' }}>Cuenta</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Teórico</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Contado</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Diferencia</th>
                      <th style={{ padding: '10px' }}>Detalles / Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arqueos.map(arq => (
                      <tr key={arq.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px' }}>{new Date(arq.date).toLocaleString()}</td>
                        <td style={{ padding: '10px', fontWeight: 600 }}>{arq.accountName}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>{formatMoney(arq.saldoTeorico)}</td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 600 }}>{formatMoney(arq.totalContado)}</td>
                        <td style={{ 
                          padding: '10px', 
                          textAlign: 'right', 
                          fontWeight: 600,
                          color: arq.diferencia === 0 ? 'var(--text-primary)' : arq.diferencia > 0 ? '#16a34a' : '#ef4444'
                        }}>
                          {arq.diferencia > 0 ? '+' : ''}{formatMoney(arq.diferencia)}
                        </td>
                        <td style={{ padding: '10px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                          {arq.observaciones || 'Sin observaciones.'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Panel Lateral de Nuevo Movimiento --- */}
      <RightPanel
        isOpen={showAddPanel}
        onClose={() => { setShowAddPanel(false); setEditingId(null); }}
        title={editingId ? 'Editar Movimiento' : (movType === 'INCOME' ? 'Nuevo Ingreso' : movType === 'EXPENSE' ? 'Nuevo Egreso' : 'Transferencia')}
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
            <label>{movType === 'TRANSFER' ? 'Cuenta Origen *' : 'Cuenta Financiera *'}</label>
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
          {movType === 'TRANSFER' && (
            <div className="form-group">
              <label>Cuenta Destino *</label>
              <select
                required
                value={formToAccountId}
                onChange={(e) => setFormToAccountId(e.target.value)}
              >
                <option value="">Seleccione cuenta destino...</option>
                {accounts.filter(a => a.activa && a.id !== formAccountId).map(a => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} ({getTipoLabel(a.tipo)})
                  </option>
                ))}
              </select>
            </div>
          )}
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
