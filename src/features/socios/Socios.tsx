import React, { useState } from 'react';
import { useSocios } from './useSocios';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import { Users, TrendingUp, TrendingDown, RotateCcw } from 'lucide-react';

export default function Socios() {
  const { shareholders, movements, loading, addMovement, annulMovement, getBalance } = useSocios();
  
  // RightPanel state
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedShareholderId, setSelectedShareholderId] = useState<string>('');
  
  type MovFormType = 'APORTE_INICIAL' | 'APORTE_OPERATIVO' | 'RETIRO' | 'AJUSTE';
  const [movType, setMovType] = useState<MovFormType>('APORTE_INICIAL');
  
  const [amount, setAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [impactCaja, setImpactCaja] = useState<boolean>(true);

  if (loading) return <div className="loading-container"><div className="spinner"></div><p>Cargando socios...</p></div>;

  const formatMoney = (val: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

  const handleOpenPanel = (socioId: string, defaultType: MovFormType) => {
    setSelectedShareholderId(socioId);
    setMovType(defaultType);
    setAmount('');
    setDescription('');
    
    // Configurar default options basados en las reglas de negocio
    if (defaultType === 'APORTE_INICIAL') setImpactCaja(true);
    if (defaultType === 'APORTE_OPERATIVO') setImpactCaja(false);
    if (defaultType === 'RETIRO') setImpactCaja(true);
    if (defaultType === 'AJUSTE') setImpactCaja(false);
    
    setShowAddPanel(true);
  };

  const handleMovTypeChange = (type: MovFormType) => {
    setMovType(type);
    if (type === 'APORTE_INICIAL') setImpactCaja(true);
    if (type === 'RETIRO') setImpactCaja(true);
    if (type === 'AJUSTE') setImpactCaja(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0 || !selectedShareholderId) return;

    let sourceType: 'APORTE' | 'RETIRO' | 'AJUSTE' = 'APORTE';
    if (movType === 'RETIRO') sourceType = 'RETIRO';
    if (movType === 'AJUSTE') sourceType = 'AJUSTE';

    // Determinar categoría de caja si impacta
    let cajaCategory = 'SOCIOS';
    if (movType === 'APORTE_INICIAL') cajaCategory = 'Aporte Inicial de Socio';
    if (movType === 'APORTE_OPERATIVO') cajaCategory = 'Aporte Operativo de Socio';
    if (movType === 'RETIRO') cajaCategory = 'Distribución / Retiro de Socio';

    await addMovement({
      shareholderId: selectedShareholderId,
      sourceType,
      amount: Number(amount),
      description: description || movType.replace('_', ' '),
      impactCaja,
      cajaCategory
    });

    setShowAddPanel(false);
  };

  const handleAnnul = async (id: string) => {
    const reason = window.prompt("Motivo de anulación:");
    if (!reason) return;
    await annulMovement(id, reason);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Socios</h1>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '15px' }}>Gestión inmutable de aportes y distribuciones</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
        {shareholders.length === 0 ? (
          <div className="apple-card" style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No hay socios registrados. Créelos en Configuración Maestra.
          </div>
        ) : (
          shareholders.map(socio => {
            const balance = getBalance(socio.id);
            const socioMovs = movements.filter(m => m.shareholderId === socio.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            return (
              <ExpandableCard
                key={socio.id}
                title={socio.nombre}
                subtitle={`${socio.type} • ${socio.participacionPorcentaje}% Participación`}
                collapsedContent={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Saldo Actual</span>
                    <strong style={{ fontSize: '24px', color: balance >= 0 ? '#16a34a' : '#ef4444' }}>
                      {formatMoney(balance)}
                    </strong>
                  </div>
                }
                expandedContent={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenPanel(socio.id, 'APORTE_INICIAL'); }}
                        className="btn-secondary" style={{ flex: 1, padding: '6px 12px', fontSize: '13px', color: '#16a34a', borderColor: '#16a34a' }}
                      >
                        + Aporte Inicial
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenPanel(socio.id, 'APORTE_OPERATIVO'); }}
                        className="btn-secondary" style={{ flex: 1, padding: '6px 12px', fontSize: '13px', color: '#3b82f6', borderColor: '#3b82f6' }}
                      >
                        + Aporte Op.
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenPanel(socio.id, 'RETIRO'); }}
                        className="btn-secondary" style={{ flex: 1, padding: '6px 12px', fontSize: '13px', color: '#a855f7', borderColor: '#a855f7' }}
                      >
                        - Retiro
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenPanel(socio.id, 'AJUSTE'); }}
                        className="btn-secondary" style={{ flex: 1, padding: '6px 12px', fontSize: '13px', color: '#f97316', borderColor: '#f97316' }}
                      >
                        ± Ajuste
                      </button>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '0 0 12px 0' }}>Historial de Movimientos</h4>
                      {socioMovs.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No hay movimientos registrados.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                          {socioMovs.map(mov => {
                            const isPositive = mov.sourceType === 'APORTE' || (mov.sourceType === 'AJUSTE' && mov.amount > 0) || (mov.sourceType === 'ANULACION' && mov.amount > 0);
                            return (
                              <div key={mov.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                  <div style={{ 
                                    width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    backgroundColor: isPositive ? '#dcfce7' : '#fee2e2',
                                    color: isPositive ? '#16a34a' : '#ef4444'
                                  }}>
                                    {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{mov.sourceType}</span>
                                      {mov.sourceType === 'ANULACION' && (
                                        <span style={{ fontSize: '10px', background: '#f3f4f6', padding: '2px 6px', borderRadius: '8px', color: 'var(--text-secondary)' }}>Compensatorio</span>
                                      )}
                                    </div>
                                    {mov.description && (
                                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{mov.description}</div>
                                    )}
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                      {new Date(mov.date).toLocaleDateString()} {new Date(mov.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                  <strong style={{ fontSize: '15px', color: isPositive ? '#16a34a' : '#ef4444' }}>
                                    {isPositive ? '+' : ''}{formatMoney(mov.amount)}
                                  </strong>
                                  {mov.sourceType !== 'ANULACION' && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleAnnul(mov.id); }}
                                      style={{ background: 'none', border: 'none', color: '#ef4444', textDecoration: 'underline', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                                    >
                                      Anular
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                }
              />
            );
          })
        )}
      </div>

      <RightPanel isOpen={showAddPanel} onClose={() => setShowAddPanel(false)} title="Nuevo Movimiento de Socio">
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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

          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddPanel(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>Registrar</button>
          </div>
        </form>
      </RightPanel>
    </div>
  );
}
