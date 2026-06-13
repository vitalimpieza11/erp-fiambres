import React, { useState } from 'react';
import { useSocios } from './useSocios';
import type { Shareholder, ShareholderMovement } from '../../types/domain';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import { Users, TrendingUp, TrendingDown, RotateCcw, Plus, Edit, User, BarChart2, Check, X } from 'lucide-react';

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

const formatDate = (dateStr: any) => {
  if (!dateStr) return 'S/D';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 'S/D' : d.toLocaleDateString();
};

const formatTime = (dateStr: any) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

export default function Socios() {
  const { 
    shareholders, 
    movements, 
    loading, 
    addMovement, 
    annulMovement, 
    getBalance,
    saveShareholder,
    toggleShareholderStatus 
  } = useSocios();
  
  // Search and status filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  // RightPanel state
  const [panelMode, setPanelMode] = useState<'NEW_SOCIO' | 'EDIT_SOCIO' | 'MOVEMENT' | null>(null);
  const [selectedShareholderId, setSelectedShareholderId] = useState<string>('');
  
  // Partner Form State
  const [socioName, setSocioName] = useState('');
  const [socioType, setSocioType] = useState<'ACTIVO' | 'INVERSOR' | 'OPERATIVO'>('ACTIVO');
  const [socioPercentage, setSocioPercentage] = useState<number | ''>('');
  const [socioActivo, setSocioActivo] = useState(true);

  // Movement Form State
  type MovFormType = 'APORTE_INICIAL' | 'APORTE_OPERATIVO' | 'RETIRO' | 'AJUSTE';
  const [movType, setMovType] = useState<MovFormType>('APORTE_INICIAL');
  const [amount, setAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [impactCaja, setImpactCaja] = useState<boolean>(true);

  if (loading && shareholders.length === 0) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Cargando socios...</p>
      </div>
    );
  }

  const handleOpenNewSocio = () => {
    setPanelMode('NEW_SOCIO');
    setSelectedShareholderId('');
    setSocioName('');
    setSocioType('ACTIVO');
    setSocioPercentage('');
    setSocioActivo(true);
  };

  const handleOpenEditSocio = (e: React.MouseEvent, socio: Shareholder) => {
    e.stopPropagation();
    setPanelMode('EDIT_SOCIO');
    setSelectedShareholderId(socio.id);
    setSocioName(socio.nombre);
    setSocioType(socio.type);
    setSocioPercentage(socio.participacionPorcentaje);
    setSocioActivo(socio.activo);
  };

  const handleOpenMovementPanel = (socioId: string, defaultType: MovFormType) => {
    setSelectedShareholderId(socioId);
    setMovType(defaultType);
    setAmount('');
    setDescription('');
    
    if (defaultType === 'APORTE_INICIAL') setImpactCaja(true);
    if (defaultType === 'APORTE_OPERATIVO') setImpactCaja(false);
    if (defaultType === 'RETIRO') setImpactCaja(true);
    if (defaultType === 'AJUSTE') setImpactCaja(false);
    
    setPanelMode('MOVEMENT');
  };

  const handleMovTypeChange = (type: MovFormType) => {
    setMovType(type);
    if (type === 'APORTE_INICIAL') setImpactCaja(true);
    if (type === 'RETIRO') setImpactCaja(true);
    if (type === 'AJUSTE') setImpactCaja(false);
  };

  const handleClosePanel = () => {
    setPanelMode(null);
    setSelectedShareholderId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (panelMode === 'NEW_SOCIO' || panelMode === 'EDIT_SOCIO') {
      if (!socioName.trim()) {
        alert("El nombre del socio es obligatorio.");
        return;
      }
      try {
        const socioData: Partial<Shareholder> = {
          nombre: socioName,
          type: socioType,
          participacionPorcentaje: Number(socioPercentage || 0),
          activo: socioActivo
        };
        if (selectedShareholderId) {
          socioData.id = selectedShareholderId;
        }
        await saveShareholder(socioData);
        handleClosePanel();
      } catch (error) {
        console.error("Error al guardar socio:", error);
        alert("No se pudo guardar el socio.");
      }
      return;
    }

    if (!amount || amount <= 0 || !selectedShareholderId) return;

    let sourceType: 'APORTE' | 'RETIRO' | 'AJUSTE' = 'APORTE';
    if (movType === 'RETIRO') sourceType = 'RETIRO';
    if (movType === 'AJUSTE') sourceType = 'AJUSTE';

    let cajaCategory = 'SOCIOS';
    if (movType === 'APORTE_INICIAL') cajaCategory = 'Aporte Inicial de Socio';
    if (movType === 'APORTE_OPERATIVO') cajaCategory = 'Aporte Operativo de Socio';
    if (movType === 'RETIRO') cajaCategory = 'Distribución / Retiro de Socio';

    try {
      await addMovement({
        shareholderId: selectedShareholderId,
        sourceType,
        amount: Number(amount),
        description: description || movType.replace('_', ' '),
        impactCaja,
        cajaCategory
      });
      handleClosePanel();
    } catch (error) {
      console.error("Error al registrar movimiento:", error);
      alert("Error al registrar movimiento.");
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent, socio: Shareholder) => {
    e.stopPropagation();
    try {
      await toggleShareholderStatus(socio.id, socio.activo);
    } catch (error) {
      console.error("Error al cambiar estado de socio:", error);
    }
  };

  const handleAnnul = async (id: string) => {
    const reason = window.prompt("Motivo de anulación:");
    if (!reason || !reason.trim()) return;
    try {
      await annulMovement(id, reason);
    } catch (error) {
      console.error("Error al anular movimiento:", error);
      alert("No se pudo anular el movimiento.");
    }
  };

  // Filter partners
  const filteredShareholders = shareholders.filter(s => {
    const matchesSearch = s.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    if (statusFilter === 'active') return matchesSearch && s.activo;
    if (statusFilter === 'inactive') return matchesSearch && !s.activo;
    return matchesSearch;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Socios</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '15px' }}>Gestión inmutable de aportes y distribuciones</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleOpenNewSocio}>
          <Plus size={18} /> Nuevo Socio
        </button>
      </div>

      {/* Top filters */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <input 
          type="text" 
          placeholder="Buscar socio por nombre..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: '280px', maxWidth: '400px' }}
        />

        <div style={{ display: 'flex', gap: '4px', background: '#e5e7eb', padding: '4px', borderRadius: '12px' }}>
          <button 
            type="button" 
            onClick={() => setStatusFilter('active')}
            style={{
              padding: '8px 16px', fontSize: '13px', borderRadius: '10px',
              backgroundColor: statusFilter === 'active' ? '#fff' : 'transparent',
              color: statusFilter === 'active' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: statusFilter === 'active' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Activos
          </button>
          <button 
            type="button" 
            onClick={() => setStatusFilter('inactive')}
            style={{
              padding: '8px 16px', fontSize: '13px', borderRadius: '10px',
              backgroundColor: statusFilter === 'inactive' ? '#fff' : 'transparent',
              color: statusFilter === 'inactive' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: statusFilter === 'inactive' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Inactivos
          </button>
          <button 
            type="button" 
            onClick={() => setStatusFilter('all')}
            style={{
              padding: '8px 16px', fontSize: '13px', borderRadius: '10px',
              backgroundColor: statusFilter === 'all' ? '#fff' : 'transparent',
              color: statusFilter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: statusFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Todos
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
        {filteredShareholders.length === 0 ? (
          <div className="apple-card" style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No se encontraron socios.
          </div>
        ) : (
          filteredShareholders.map(socio => {
            const balance = getBalance(socio.id);
            const socioMovs = movements
              .filter(m => m.shareholderId === socio.id)
              .sort((a,b) => {
                const tA = a.date ? new Date(a.date).getTime() : 0;
                const tB = b.date ? new Date(b.date).getTime() : 0;
                return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
              });

            return (
              <ExpandableCard
                key={socio.id}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>{socio.nombre}</span>
                    <button 
                      type="button" 
                      onClick={(e) => handleOpenEditSocio(e, socio)}
                      style={{ background: 'transparent', padding: '4px', color: 'var(--text-secondary)', borderRadius: '50%' }}
                      title="Editar Socio"
                    >
                      <Edit size={14} />
                    </button>
                  </div>
                }
                subtitle={`${socio.type} • ${socio.participacionPorcentaje}% Participación`}
                statusBadge={
                  <span 
                    onClick={(e) => handleToggleStatus(e, socio)}
                    style={{ 
                      fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', cursor: 'pointer',
                      backgroundColor: socio.activo ? '#dcfce7' : '#fee2e2',
                      color: socio.activo ? '#16a34a' : '#ef4444'
                    }}
                    title="Haga clic para cambiar estado"
                  >
                    {socio.activo ? 'Activo' : 'Inactivo'}
                  </span>
                }
                collapsedContent={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Saldo Actual</span>
                    <strong style={{ fontSize: '20px', color: balance >= 0 ? '#16a34a' : '#ef4444' }}>
                      {formatCurrency(balance)}
                    </strong>
                  </div>
                }
                expandedContent={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenMovementPanel(socio.id, 'APORTE_INICIAL'); }}
                        className="btn-secondary" style={{ flex: 1, padding: '6px 12px', fontSize: '12px', color: '#16a34a', borderColor: '#16a34a' }}
                      >
                        + Aporte Inicial
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenMovementPanel(socio.id, 'APORTE_OPERATIVO'); }}
                        className="btn-secondary" style={{ flex: 1, padding: '6px 12px', fontSize: '12px', color: '#3b82f6', borderColor: '#3b82f6' }}
                      >
                        + Aporte Op.
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenMovementPanel(socio.id, 'RETIRO'); }}
                        className="btn-secondary" style={{ flex: 1, padding: '6px 12px', fontSize: '12px', color: '#a855f7', borderColor: '#a855f7' }}
                      >
                        - Retiro
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenMovementPanel(socio.id, 'AJUSTE'); }}
                        className="btn-secondary" style={{ flex: 1, padding: '6px 12px', fontSize: '12px', color: '#f97316', borderColor: '#f97316' }}
                      >
                        ± Ajuste
                      </button>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>Historial de Movimientos</h4>
                      {socioMovs.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>No hay movimientos registrados.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
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
                                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{mov.sourceType}</span>
                                      {mov.sourceType === 'ANULACION' && (
                                        <span style={{ fontSize: '9px', background: '#f3f4f6', padding: '2px 6px', borderRadius: '8px', color: 'var(--text-secondary)' }}>Compensatorio</span>
                                      )}
                                    </div>
                                    {mov.description && (
                                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{mov.description}</div>
                                    )}
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                      {formatDate(mov.date)} {formatTime(mov.date)}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                  <strong style={{ fontSize: '14px', color: isPositive ? '#16a34a' : '#ef4444' }}>
                                    {isPositive ? '+' : ''}{formatCurrency(mov.amount)}
                                  </strong>
                                  {mov.sourceType !== 'ANULACION' && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleAnnul(mov.id); }}
                                      style={{ background: 'none', border: 'none', color: '#ef4444', textDecoration: 'underline', fontSize: '11px', cursor: 'pointer', padding: 0 }}
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

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={handleClosePanel}>Cancelar</button>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Registrar</button>
            </div>
          </form>
        )}
      </RightPanel>
    </div>
  );
}
