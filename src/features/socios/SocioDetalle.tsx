import React, { useState } from 'react';
import type { Shareholder, ShareholderMovement, ShareholderLoan, FinancialAccount } from '../../types/domain';
import { ArrowLeft, TrendingUp, TrendingDown, Landmark, Wallet, DollarSign } from 'lucide-react';
import { formatCurrency, formatDate, formatTime } from '../../lib/formatters';

interface SocioDetalleProps {
  socio: Shareholder;
  movements: ShareholderMovement[];
  loans: ShareholderLoan[];
  accounts: FinancialAccount[];
  onBack: () => void;
  getBalance: (id: string) => number;
  onAnnulMovement: (id: string) => Promise<void>;
}

export default function SocioDetalle({
  socio,
  movements,
  loans,
  accounts,
  onBack,
  getBalance,
  onAnnulMovement,
}: SocioDetalleProps) {
  const [activeTab, setActiveTab] = useState<'aportes' | 'prestamos' | 'devoluciones' | 'resumen'>('resumen');

  // Filter movements for this shareholder
  const socioMovs = movements
    .filter((m) => m.shareholderId === socio.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter loans for this shareholder
  const socioLoans = loans
    .filter((l) => l.shareholderId === socio.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Consolidate loan payments (Devoluciones)
  const socioPayments = socioLoans
    .flatMap((l) =>
      (l.payments || []).map((p) => ({
        ...p,
        loanDescription: l.description,
        loanDate: l.date,
      }))
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculations
  const capitalAportadoTotal = getBalance(socio.id);
  const prestamosRealizados = socioLoans.reduce((sum, l) => sum + l.amount, 0);
  const prestamosPendientes = socioLoans.reduce((sum, l) => sum + l.remainingAmount, 0);
  const capitalNeto = Number((capitalAportadoTotal + prestamosPendientes).toFixed(2));
  const participacion = socio.participacionPorcentaje;

  // Account helper
  const getAccountName = (accountId?: string) => {
    if (!accountId) return 'Sin especificar';
    const acc = accounts.find((a) => a.id === accountId);
    return acc ? `${acc.nombre} (${acc.tipo})` : 'Cuenta desconocida';
  };

  return (
    <div className="socio-detalle-container" style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: '1px solid var(--border-color)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            transition: 'all 0.2s',
          }}
          title="Volver"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {socio.nombre}
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Ficha Detallada del Socio • {socio.type}
          </p>
        </div>
      </div>

      {/* Premium Dashboard Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}
      >
        <div
          className="apple-card"
          style={{
            padding: '20px',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
            border: '1px solid #bbf7d0',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Capital Aportado Total
          </span>
          <h2 style={{ fontSize: '24px', margin: '8px 0 0 0', color: '#14532d', fontWeight: 700 }}>
            {formatCurrency(capitalAportadoTotal)}
          </h2>
        </div>

        <div
          className="apple-card"
          style={{
            padding: '20px',
            background: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)',
            border: '1px solid #fecaca',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Préstamos Realizados
          </span>
          <h2 style={{ fontSize: '24px', margin: '8px 0 0 0', color: '#7f1d1d', fontWeight: 700 }}>
            {formatCurrency(prestamosRealizados)}
          </h2>
        </div>

        <div
          className="apple-card"
          style={{
            padding: '20px',
            background: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)',
            border: '1px solid #fef3c7',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Préstamos Pendientes
          </span>
          <h2 style={{ fontSize: '24px', margin: '8px 0 0 0', color: '#78350f', fontWeight: 700 }}>
            {formatCurrency(prestamosPendientes)}
          </h2>
        </div>

        <div
          className="apple-card"
          style={{
            padding: '20px',
            background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
            border: '1px solid #bfdbfe',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Capital Neto
          </span>
          <h2 style={{ fontSize: '24px', margin: '8px 0 0 0', color: '#1e3a8a', fontWeight: 700 }}>
            {formatCurrency(capitalNeto)}
          </h2>
        </div>

        <div
          className="apple-card"
          style={{
            padding: '20px',
            background: 'linear-gradient(135deg, #faf5ff 0%, #ffffff 100%)',
            border: '1px solid #e9d5ff',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#9333ea', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Participación
          </span>
          <h2 style={{ fontSize: '24px', margin: '8px 0 0 0', color: '#581c87', fontWeight: 700 }}>
            {participacion.toFixed(2)}%
          </h2>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px',
        }}
      >
        {(['resumen', 'aportes', 'prestamos', 'devoluciones'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '20px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              backgroundColor: activeTab === tab ? 'var(--alvacio-red)' : 'transparent',
              color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {tab === 'resumen'
              ? 'Resumen Financiero'
              : tab === 'aportes'
              ? 'Aportes'
              : tab === 'prestamos'
              ? 'Préstamos'
              : 'Devoluciones'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="apple-card" style={{ padding: '24px', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
        {activeTab === 'resumen' && (
          <div>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: 'var(--text-primary)' }}>Consolidado Financiero</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Aportes de Capital (Brutos)</span>
                <strong style={{ color: '#16a34a' }}>
                  {formatCurrency(
                    socioMovs
                      .filter((m) => m.estado !== 'ANULADO' && (m.sourceType === 'APORTE' || (m.sourceType === 'AJUSTE' && m.amount > 0)))
                      .reduce((sum, m) => sum + m.amount, 0)
                  )}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Retiros / Distribuciones</span>
                <strong style={{ color: '#ef4444' }}>
                  {formatCurrency(
                    socioMovs
                      .filter((m) => m.estado !== 'ANULADO' && m.sourceType === 'RETIRO')
                      .reduce((sum, m) => sum + m.amount, 0)
                  )}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Ajustes Netos</span>
                <strong style={{ color: 'var(--text-primary)' }}>
                  {formatCurrency(
                    socioMovs
                      .filter((m) => m.estado !== 'ANULADO' && m.sourceType === 'AJUSTE')
                      .reduce((sum, m) => sum + m.amount, 0)
                  )}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Capital Neto Aportado</span>
                <strong>{formatCurrency(capitalAportadoTotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Deuda Préstamos Pendiente</span>
                <strong style={{ color: '#ef4444' }}>{formatCurrency(prestamosPendientes)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', fontSize: '18px' }}>
                <span style={{ fontWeight: 700 }}>Patrimonio Neto Socio</span>
                <strong style={{ color: capitalNeto >= 0 ? '#16a34a' : '#ef4444', fontWeight: 700 }}>
                  {formatCurrency(capitalNeto)}
                </strong>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'aportes' && (
          <div>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: 'var(--text-primary)' }}>Historial de Aportes y Retiros</h3>
            {socioMovs.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No hay aportes ni retiros registrados.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="apple-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px 8px' }}>Fecha</th>
                      <th style={{ padding: '12px 8px' }}>Tipo</th>
                      <th style={{ padding: '12px 8px' }}>Concepto / Descripción</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Importe</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {socioMovs.map((mov) => {
                      const isAnulado = mov.estado === 'ANULADO';
                      const isPositive =
                        mov.sourceType === 'APORTE' ||
                        (mov.sourceType === 'AJUSTE' && mov.amount > 0) ||
                        (mov.sourceType === 'ANULACION' && mov.amount > 0);
                      return (
                        <tr key={mov.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '14px', textDecoration: isAnulado ? 'line-through' : 'none', opacity: isAnulado ? 0.55 : 1 }}>
                          <td style={{ padding: '12px 8px' }}>{formatDate(mov.date)} {formatTime(mov.date)}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                            {mov.sourceType}
                            {isAnulado && <span style={{ marginLeft: '6px', fontSize: '10px', background: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px' }}>ANULADO</span>}
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                            {mov.description || '-'}
                            {isAnulado && mov.motivoAnulacion && (
                              <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '3px', textDecoration: 'none' }}>
                                Motivo: {mov.motivoAnulacion} • {mov.fechaAnulacion ? formatDate(mov.fechaAnulacion) : ''} ({mov.usuarioAnulacion || 'Sistema'})
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: isAnulado ? 'var(--text-secondary)' : isPositive ? '#16a34a' : '#ef4444' }}>
                            {isPositive ? '+' : ''}{formatCurrency(mov.amount)}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                            {!isAnulado && (
                              <button
                                onClick={() => onAnnulMovement(mov.id)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', textDecoration: 'underline', cursor: 'pointer', fontSize: '12px' }}
                              >
                                Anular
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'prestamos' && (
          <div>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: 'var(--text-primary)' }}>
              Historial de Préstamos y Devoluciones
            </h3>

            {/* Summary chips */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 16px' }}>
                <span style={{ fontSize: '11px', color: '#1e40af', fontWeight: 600, textTransform: 'uppercase' }}>Prestado</span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e3a8a' }}>{formatCurrency(prestamosRealizados)}</div>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 16px' }}>
                <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 600, textTransform: 'uppercase' }}>Devuelto</span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#14532d' }}>
                  {formatCurrency(prestamosRealizados - prestamosPendientes)}
                </div>
              </div>
              <div style={{
                background: prestamosPendientes > 0 ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${prestamosPendientes > 0 ? '#fecaca' : '#bbf7d0'}`,
                borderRadius: '10px', padding: '10px 16px'
              }}>
                <span style={{ fontSize: '11px', color: prestamosPendientes > 0 ? '#dc2626' : '#15803d', fontWeight: 600, textTransform: 'uppercase' }}>Saldo Pendiente</span>
                <div style={{ fontSize: '16px', fontWeight: 700, color: prestamosPendientes > 0 ? '#991b1b' : '#14532d' }}>
                  {formatCurrency(prestamosPendientes)}
                </div>
              </div>
            </div>

            {/* Unified timeline with saldo acumulado */}
            {(() => {
              // Build unified events: loans creations + all payments
              type EventType = 'PRESTAMO_SOCIO_EMPRESA' | 'DEVOLUCION_EMPRESA_SOCIO' | 'CAPITALIZACION';
              const events: { date: string; type: EventType; label: string; importe: number; description: string; id: string }[] = [];

              socioLoans.forEach(loan => {
                events.push({
                  date: loan.date,
                  type: 'PRESTAMO_SOCIO_EMPRESA',
                  label: 'Préstamo',
                  importe: loan.amount,
                  description: loan.description,
                  id: loan.id,
                });
                (loan.payments || []).forEach(pay => {
                  events.push({
                    date: pay.date,
                    type: pay.type === 'CAPITALIZATION' ? 'CAPITALIZACION' : 'DEVOLUCION_EMPRESA_SOCIO',
                    label: pay.type === 'CAPITALIZATION' ? 'Capitalización' : 'Devolución',
                    importe: -pay.amount,
                    description: pay.description,
                    id: pay.id || '',
                  });
                });
              });

              // Sort chronologically ascending
              events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

              // Compute running saldo
              let saldo = 0;
              const eventsWithSaldo = events.map(ev => {
                saldo = Number((saldo + ev.importe).toFixed(2));
                return { ...ev, saldoAcumulado: saldo };
              });

              // Display newest first
              const eventsDesc = [...eventsWithSaldo].reverse();

              if (eventsDesc.length === 0) {
                return <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No hay préstamos registrados.</p>;
              }

              return (
                <div style={{ overflowX: 'auto' }}>
                  <table className="apple-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '12px 8px' }}>Fecha</th>
                        <th style={{ padding: '12px 8px' }}>Tipo</th>
                        <th style={{ padding: '12px 8px' }}>Concepto</th>
                        <th style={{ padding: '12px 8px', textAlign: 'right' }}>Importe</th>
                        <th style={{ padding: '12px 8px', textAlign: 'right' }}>Saldo Acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventsDesc.map((ev, idx) => {
                        const isPrestamo = ev.type === 'PRESTAMO_SOCIO_EMPRESA';
                        const isCapitalizacion = ev.type === 'CAPITALIZACION';
                        return (
                          <tr key={ev.id || idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '14px' }}>
                            <td style={{ padding: '12px 8px', whiteSpace: 'nowrap' }}>{formatDate(ev.date)}</td>
                            <td style={{ padding: '12px 8px' }}>
                              <span style={{
                                fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '8px',
                                backgroundColor: isPrestamo ? '#eff6ff' : isCapitalizacion ? '#f0fdf4' : '#fef2f2',
                                color: isPrestamo ? '#1e40af' : isCapitalizacion ? '#15803d' : '#dc2626',
                              }}>
                                {ev.label}
                              </span>
                            </td>
                            <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontSize: '13px' }}>{ev.description || '-'}</td>
                            <td style={{
                              padding: '12px 8px', textAlign: 'right', fontWeight: 700,
                              color: isPrestamo ? '#1e40af' : '#dc2626'
                            }}>
                              {isPrestamo ? '+' : ''}{formatCurrency(ev.importe)}
                            </td>
                            <td style={{
                              padding: '12px 8px', textAlign: 'right', fontWeight: 700,
                              color: ev.saldoAcumulado > 0 ? '#dc2626' : '#16a34a',
                              fontSize: '15px'
                            }}>
                              {formatCurrency(ev.saldoAcumulado)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--border-color)', background: 'var(--bg-color)' }}>
                        <td colSpan={4} style={{ padding: '12px 8px', fontWeight: 700, fontSize: '14px' }}>Saldo Pendiente Actual</td>
                        <td style={{
                          padding: '12px 8px', textAlign: 'right', fontWeight: 800, fontSize: '16px',
                          color: prestamosPendientes > 0 ? '#dc2626' : '#16a34a'
                        }}>
                          {formatCurrency(prestamosPendientes)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'devoluciones' && (
          <div>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: 'var(--text-primary)' }}>Historial de Devoluciones</h3>
            {socioPayments.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No hay devoluciones registradas.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="apple-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px 8px' }}>Fecha</th>
                      <th style={{ padding: '12px 8px' }}>Préstamo Ref</th>
                      <th style={{ padding: '12px 8px' }}>Detalle / Referencia</th>
                      <th style={{ padding: '12px 8px' }}>Cuenta Utilizada</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {socioPayments.map((pay, idx) => (
                      <tr key={pay.id || idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '14px' }}>
                        <td style={{ padding: '12px 8px' }}>{formatDate(pay.date)} {formatTime(pay.date)}</td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                          {pay.loanDescription} ({formatDate(pay.loanDate)})
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{pay.description || '-'}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{ fontSize: '13px', background: pay.type === 'CAPITALIZATION' ? '#e6f4ea' : '#f3f4f6', color: pay.type === 'CAPITALIZATION' ? '#137333' : 'inherit', padding: '2px 8px', borderRadius: '4px' }}>
                            {pay.type === 'CAPITALIZATION' ? 'Capitalizado' : getAccountName(pay.linkedCajaMovementId ? accounts.find(a => a.id === pay.linkedCajaMovementId)?.id : undefined)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                          -{formatCurrency(pay.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
