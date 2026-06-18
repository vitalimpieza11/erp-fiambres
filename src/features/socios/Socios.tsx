import React, { useState, useEffect } from 'react';
import { useSocios } from './useSocios';
import type { MovFormType } from './useSocios';
import type { Shareholder } from '../../types/domain';
import RightPanel from '../../components/RightPanel';
import { TrendingUp, TrendingDown, Plus, Edit, Calendar, Hash, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { formatCurrency, formatDate, formatTime } from '../../lib/formatters';
import LoadingSpinner from '../../components/LoadingSpinner';
import FilterBar from '../../components/FilterBar';
import { useLoansStore } from '../../store/loansStore';
import SocioDetalle from './SocioDetalle';

export default function Socios() {
  const { 
    shareholders, 
    movements, 
    loading: sociosLoading, 
    getBalance,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    panelMode,
    selectedShareholderId,
    socioName,
    setSocioName,
    socioType,
    setSocioType,
    socioPercentage,
    setSocioPercentage,
    socioActivo,
    setSocioActivo,
    movType,
    amount,
    setAmount,
    description,
    setDescription,
    impactCaja,
    setImpactCaja,
    handleOpenNewSocio,
    handleOpenEditSocio,
    handleOpenMovementPanel,
    handleMovTypeChange,
    handleClosePanel,
    handleSubmit,
    handleToggleStatus,
    handleAnnul,
    filteredShareholders,
    accounts,
    selectedAccountId,
    setSelectedAccountId
  } = useSocios();

  // Tab State
  const [activeTab, setActiveTab] = useState<'aportes' | 'prestamos'>('aportes');

  // Individual Partner View State
  const [selectedSocioForDetail, setSelectedSocioForDetail] = useState<Shareholder | null>(null);

  // Loans State - Always subscribe on mount so capital cards can use loan stats
  const { loans, loading: loansLoading, subscribeLoans, registerPayment, annulPayment } = useLoansStore();
  const [paymentPanelLoanId, setPaymentPanelLoanId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentDesc, setPaymentDesc] = useState<string>('');
  const [paymentAccountId, setPaymentAccountId] = useState<string>('');

  useEffect(() => {
    const unsubLoans = subscribeLoans();
    return () => unsubLoans();
  }, [subscribeLoans]);

  const handleOpenPaymentPanel = (loanId: string) => {
    setPaymentPanelLoanId(loanId);
    setPaymentAmount('');
    setPaymentDesc('Devolución de préstamo parcial');
    setPaymentAccountId('');
  };

  const handleClosePaymentPanel = () => {
    setPaymentPanelLoanId(null);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentPanelLoanId || !paymentAmount || !paymentAccountId) return;
    try {
      await registerPayment(paymentPanelLoanId, Number(paymentAmount), paymentDesc, paymentAccountId);
      handleClosePaymentPanel();
    } catch (err: any) {
      alert(err.message || 'Error al registrar el pago');
    }
  };

  const handleAnnulLoanPayment = async (loanId: string, paymentId: string) => {
    const reason = window.prompt("Ingrese el motivo de la anulación del pago:");
    if (!reason) return;
    try {
      await annulPayment(loanId, paymentId, reason);
    } catch (err: any) {
      alert(err.message || 'Error al anular pago');
    }
  };

  const totalPrestado = loans.reduce((acc, l) => acc + l.amount, 0);
  const totalRestante = loans.reduce((acc, l) => acc + l.remainingAmount, 0);
  const totalDevuelto = totalPrestado - totalRestante;

  if (sociosLoading && shareholders.length === 0) {
    return <LoadingSpinner message="Cargando datos de socios..." />;
  }

  // If a partner is selected for detail, show SocioDetalle instead
  if (selectedSocioForDetail) {
    return (
      <SocioDetalle
        socio={selectedSocioForDetail}
        movements={movements}
        loans={loans}
        accounts={accounts}
        onBack={() => setSelectedSocioForDetail(null)}
        getBalance={getBalance}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Socios</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '15px' }}>Gestión contable y financiera societaria</p>
        </div>
        {activeTab === 'aportes' && (
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleOpenNewSocio}>
            <Plus size={18} /> Nuevo Socio
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('aportes')}
          style={{
            background: 'none', border: 'none', padding: '8px 16px', borderRadius: '20px', 
            fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
            backgroundColor: activeTab === 'aportes' ? 'var(--alvacio-red)' : 'transparent',
            color: activeTab === 'aportes' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Aportes y Capital
        </button>
        <button
          onClick={() => setActiveTab('prestamos')}
          style={{
            background: 'none', border: 'none', padding: '8px 16px', borderRadius: '20px', 
            fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
            backgroundColor: activeTab === 'prestamos' ? 'var(--alvacio-red)' : 'transparent',
            color: activeTab === 'prestamos' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Préstamos (Pasivos)
        </button>
      </div>

      {activeTab === 'aportes' ? (
        <>
          <FilterBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Buscar socio por nombre..."
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />

          {/* Premium Shareholder Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '24px' }}>
            {filteredShareholders.length === 0 ? (
              <div className="apple-card" style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No se encontraron socios.
              </div>
            ) : (
              filteredShareholders.map(socio => {
                const balance = getBalance(socio.id);
                const socioMovs = movements.filter(m => m.shareholderId === socio.id);

                // Loan stats for this shareholder
                const socioLoans = loans.filter(l => l.shareholderId === socio.id);
                const prestamosRealizados = socioLoans.reduce((sum, l) => sum + l.amount, 0);
                const prestamosPendientes = socioLoans.reduce((sum, l) => sum + l.remainingAmount, 0);

                // Date of last movement
                const allDates = [
                  ...socioMovs.map(m => m.date),
                  ...socioLoans.map(l => l.date),
                  ...socioLoans.flatMap(l => (l.payments || []).map(p => p.date))
                ].filter(Boolean);

                const fechaUltimoMovimiento = allDates.length > 0
                  ? new Date(Math.max(...allDates.map(d => new Date(d).getTime()))).toISOString()
                  : null;

                const cantidadMovimientos = socioMovs.length + socioLoans.reduce((acc, l) => acc + 1 + (l.payments?.length || 0), 0);

                return (
                  <div
                    key={socio.id}
                    className="apple-card hover-card"
                    onClick={() => setSelectedSocioForDetail(socio)}
                    style={{
                      padding: '24px',
                      background: '#ffffff',
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                      position: 'relative',
                      transition: 'all 0.25s ease',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {socio.nombre}
                        </h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {socio.type} • {socio.participacionPorcentaje.toFixed(2)}% Part.
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span 
                          onClick={(e) => { e.stopPropagation(); handleToggleStatus(e, socio); }}
                          style={{ 
                            fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', cursor: 'pointer',
                            backgroundColor: socio.activo ? '#dcfce7' : '#fee2e2',
                            color: socio.activo ? '#16a34a' : '#ef4444'
                          }}
                          title="Cambiar estado"
                        >
                          {socio.activo ? 'Activo' : 'Inactivo'}
                        </span>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); handleOpenEditSocio(e, socio); }}
                          style={{ background: 'var(--bg-color)', padding: '6px', color: 'var(--text-secondary)', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Editar Socio"
                        >
                          <Edit size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Financial Metrics grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-color)', padding: '16px', borderRadius: '12px' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Capital Aportado</span>
                        <strong style={{ fontSize: '15px', color: '#16a34a' }}>{formatCurrency(balance)}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Préstamos Realizados</span>
                        <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{formatCurrency(prestamosRealizados)}</strong>
                      </div>
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Saldo Pendiente</span>
                        <strong style={{ fontSize: '15px', color: prestamosPendientes > 0 ? '#ef4444' : 'var(--text-primary)' }}>
                          {formatCurrency(prestamosPendientes)}
                        </strong>
                      </div>
                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Capital Neto</span>
                        <strong style={{ fontSize: '15px', color: '#2563eb' }}>{formatCurrency(balance - prestamosPendientes)}</strong>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} /> Ult: {fechaUltimoMovimiento ? formatDate(fechaUltimoMovimiento) : 'Ninguno'}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Hash size={13} /> Movs: {cantidadMovimientos}
                      </span>
                      <span style={{ color: 'var(--alvacio-red)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        Ver ficha <ArrowUpRight size={13} />
                      </span>
                    </div>

                    {/* Quick Transaction Actions */}
                    <div style={{ display: 'flex', gap: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '12px' }} onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => handleOpenMovementPanel(socio.id, 'APORTE_INICIAL')}
                        className="btn-secondary" style={{ flex: 1, padding: '6px', fontSize: '11px', color: '#16a34a', borderColor: '#16a34a' }}
                      >
                        + Aporte
                      </button>
                      <button 
                        onClick={() => handleOpenMovementPanel(socio.id, 'RETIRO')}
                        className="btn-secondary" style={{ flex: 1, padding: '6px', fontSize: '11px', color: '#a855f7', borderColor: '#a855f7' }}
                      >
                        - Retiro
                      </button>
                      <button 
                        onClick={() => handleOpenMovementPanel(socio.id, 'AJUSTE')}
                        className="btn-secondary" style={{ flex: 1, padding: '6px', fontSize: '11px', color: '#f97316', borderColor: '#f97316' }}
                      >
                        ± Ajuste
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <div>
          {/* Metrics summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '32px' }}>
            <div className="apple-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Prestado</span>
              <strong style={{ fontSize: '24px', color: '#1d1d1f' }}>{formatCurrency(totalPrestado)}</strong>
            </div>
            <div className="apple-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total Devuelto</span>
              <strong style={{ fontSize: '24px', color: '#16a34a' }}>{formatCurrency(totalDevuelto)}</strong>
            </div>
            <div className="apple-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Saldo Restante</span>
              <strong style={{ fontSize: '24px', color: '#ef4444' }}>{formatCurrency(totalRestante)}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {loans.length === 0 ? (
              <div className="apple-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                No hay préstamos societarios vigentes.
              </div>
            ) : (
              loans.map(loan => (
                <div
                  key={loan.id}
                  className="apple-card"
                  style={{
                    padding: '20px',
                    border: '1px solid var(--border-color)',
                    background: '#ffffff',
                    borderRadius: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{loan.shareholderName}</h3>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{loan.description} • {formatDate(loan.date)}</p>
                    </div>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px',
                      backgroundColor: loan.status === 'PAGADO' ? '#dcfce7' : '#fff3cd',
                      color: loan.status === 'PAGADO' ? '#16a34a' : '#d97706'
                    }}>
                      {loan.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-color)', padding: '12px 16px', borderRadius: '8px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Deuda Restante</span>
                    <strong style={{ fontSize: '16px' }}>
                      {formatCurrency(loan.remainingAmount)} / {formatCurrency(loan.amount)}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {loan.status !== 'PAGADO' && (
                      <button
                        onClick={() => handleOpenPaymentPanel(loan.id)}
                        className="btn-primary"
                        style={{ padding: '8px 16px', fontSize: '12px' }}
                      >
                        Registrar Pago
                      </button>
                    )}
                  </div>

                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>Historial de Devoluciones</h4>
                    {!loan.payments || loan.payments.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>No hay devoluciones registradas.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {loan.payments.map(pay => (
                          <div key={pay.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: '13px' }}>{pay.description}</span>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {formatDate(pay.date)} {formatTime(pay.date)}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <strong style={{ fontSize: '14px', color: '#16a34a' }}>
                                -{formatCurrency(pay.amount)}
                              </strong>
                              <button
                                onClick={() => handleAnnulLoanPayment(loan.id, pay.id)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', textDecoration: 'underline', fontSize: '11px', cursor: 'pointer' }}
                              >
                                Anular
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Right panel for Aportes/Socio Form */}
      <RightPanel 
        isOpen={panelMode !== null} 
        onClose={handleClosePanel} 
        title={
          panelMode === 'NEW_SOCIO' ? 'Nuevo Socio' :
          panelMode === 'EDIT_SOCIO' ? 'Editar Socio' :
          'Registrar Movimiento de Socio'
        }
      >
        {(panelMode === 'NEW_SOCIO' || panelMode === 'EDIT_SOCIO') ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Nombre del Socio *</label>
              <input 
                type="text" 
                required 
                placeholder="Ej. Juan Pérez"
                value={socioName} 
                onChange={e => setSocioName(e.target.value)} 
              />
            </div>
            
            <div className="form-group">
              <label>Tipo de Socio</label>
              <select value={socioType} onChange={e => setSocioType(e.target.value as any)}>
                <option value="ACTIVO">Activo</option>
                <option value="INVERSOR">Inversor</option>
                <option value="OPERATIVO">Operativo</option>
              </select>
            </div>

            <div className="form-group">
              <label>Porcentaje de Participación (%)</label>
              <input 
                type="number" 
                step="0.01" 
                required 
                placeholder="Ej. 33.33"
                value={socioPercentage} 
                onChange={e => setSocioPercentage(e.target.value === '' ? '' : Number(e.target.value))} 
              />
            </div>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
              <input 
                type="checkbox" 
                checked={socioActivo} 
                onChange={e => setSocioActivo(e.target.checked)} 
                id="socioActivoCheckbox"
                style={{ width: 'auto' }}
              />
              <label htmlFor="socioActivoCheckbox" style={{ margin: 0 }}>
                Socio Activo
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={handleClosePanel}>Cancelar</button>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Guardar</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label>Tipo de Movimiento</label>
              <select 
                value={movType} 
                onChange={(e) => handleMovTypeChange(e.target.value as MovFormType)}
              >
                <option value="APORTE_INICIAL">Aporte Inicial</option>
                <option value="APORTE_OPERATIVO">Aporte Operativo</option>
                <option value="RETIRO">Distribución / Retiro</option>
                <option value="AJUSTE">Ajuste Manual</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                Monto ($) {movType === 'AJUSTE' && <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal', fontSize: '12px' }}>- Puede ser negativo</span>}
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || '')}
                placeholder="0.00"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Descripción</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Aporte para maquinaria..."
              />
            </div>

            <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <input 
                type="checkbox" 
                id="impactCaja"
                checked={impactCaja}
                onChange={(e) => setImpactCaja(e.target.checked)}
                disabled={movType === 'RETIRO'}
                style={{ marginTop: '4px' }}
              />
              <label htmlFor="impactCaja" style={{ margin: 0, fontWeight: 'normal' }}>
                <strong style={{ display: 'block', fontSize: '14px' }}>Impactar Caja Físicamente</strong>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                  {movType === 'APORTE_INICIAL' && 'El aporte inicial asume ingreso a caja.'}
                  {movType === 'APORTE_OPERATIVO' && 'Marcar si el dinero ingresa al sistema en lugar de pagarse por fuera.'}
                  {movType === 'RETIRO' && 'Un retiro/distribución siempre sale de la caja.'}
                  {movType === 'AJUSTE' && 'Los ajustes rara vez impactan la caja física real.'}
                </span>
              </label>
            </div>

            {impactCaja && (
              <div className="form-group">
                <label>Cuenta Financiera *</label>
                <select
                  required
                  value={selectedAccountId}
                  onChange={e => setSelectedAccountId(e.target.value)}
                >
                  <option value="">Seleccione cuenta...</option>
                  {accounts.filter(a => a.activa).map(a => (
                    <option key={a.id} value={a.id}>
                      {a.nombre} ({a.tipo})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={handleClosePanel}>Cancelar</button>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Registrar</button>
            </div>
          </form>
        )}
      </RightPanel>

      {/* Right panel for Loan payment registration */}
      <RightPanel
        isOpen={paymentPanelLoanId !== null}
        onClose={handleClosePaymentPanel}
        title="Registrar Pago de Préstamo"
      >
        <form onSubmit={handlePaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label>Monto a Devolver ($) *</label>
            <input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Concepto / Referencia *</label>
            <input
              type="text"
              required
              value={paymentDesc}
              onChange={e => setPaymentDesc(e.target.value)}
              placeholder="Ej. Devolución de préstamo cuota 1"
            />
          </div>

          <div className="form-group">
            <label>Cuenta Financiera de Pago *</label>
            <select
              required
              value={paymentAccountId}
              onChange={e => setPaymentAccountId(e.target.value)}
            >
              <option value="">Seleccione cuenta...</option>
              {accounts.filter(a => a.activa).map(a => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({a.tipo})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={handleClosePaymentPanel}>Cancelar</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>Registrar Pago</button>
          </div>
        </form>
      </RightPanel>
    </div>
  );
}
