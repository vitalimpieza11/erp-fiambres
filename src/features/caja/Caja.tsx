import { useState } from 'react';
import { useCaja } from './useCaja';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import { TrendingUp, TrendingDown, DollarSign, RotateCcw, Info } from 'lucide-react';

export default function Caja() {
  const { movements, loading, currentBalance, ingresosHoy, egresosHoy, ingresosMes, egresosMes, addMovement, annulMovement } = useCaja();
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [movType, setMovType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [amount, setAmount] = useState<number | ''>('');
  const [description, setDescription] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;
    await addMovement({
      type: movType,
      amount: Number(amount),
      category: 'OTROS',
      description
    });
    setShowAddPanel(false);
    setAmount('');
    setDescription('');
  };

  const handleAnnul = async (id: string) => {
    const reason = window.prompt("Motivo de anulación:");
    if (!reason) return;
    await annulMovement(id, reason);
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div><p>Cargando caja...</p></div>;

  const formatMoney = (val: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

  // Group movements by date string (YYYY-MM-DD)
  const groupedMovements = movements.reduce((acc, mov) => {
    const dateStr = new Date(mov.date).toLocaleDateString('es-AR');
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(mov);
    return acc;
  }, {} as Record<string, typeof movements>);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Caja</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => { setMovType('INCOME'); setShowAddPanel(true); }}
            className="btn-secondary"
            style={{ color: '#16a34a' }}
          >
            + Ingreso Manual
          </button>
          <button 
            onClick={() => { setMovType('EXPENSE'); setShowAddPanel(true); }}
            className="btn-secondary"
            style={{ color: '#ef4444' }}
          >
            - Egreso Manual
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        <div className="apple-card" style={{ gridColumn: '1 / -1', background: 'linear-gradient(135deg, var(--alvacio-red-dark), var(--alvacio-red))', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', opacity: 0.9, fontWeight: 'normal' }}>Saldo Actual en Caja</h2>
          <p style={{ margin: 0, fontSize: '48px', fontWeight: 700, letterSpacing: '-0.02em' }}>{formatMoney(currentBalance)}</p>
        </div>

        <div className="apple-card">
          <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '20px' }}>Hoy</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Ingresos</span>
              <strong style={{ fontSize: '20px', color: '#16a34a' }}>{formatMoney(ingresosHoy)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Egresos</span>
              <strong style={{ fontSize: '20px', color: '#ef4444' }}>{formatMoney(egresosHoy)}</strong>
            </div>
          </div>
        </div>

        <div className="apple-card">
          <h3 style={{ fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '20px' }}>Este Mes</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Ingresos</span>
              <strong style={{ fontSize: '20px', color: '#16a34a' }}>{formatMoney(ingresosMes)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Egresos</span>
              <strong style={{ fontSize: '20px', color: '#ef4444' }}>{formatMoney(egresosMes)}</strong>
            </div>
          </div>
        </div>
        
        <div className="apple-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <Info size={24} color="var(--alvacio-red)" />
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            La caja refleja exclusivamente el dinero real. Toda anulación generará un movimiento compensatorio.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h2 style={{ fontSize: '24px', margin: 0 }}>Movimientos</h2>
        
        {Object.keys(groupedMovements).length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>No hay movimientos registrados.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {Object.entries(groupedMovements).map(([dateStr, movs]) => (
              <div key={dateStr}>
                <h3 style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  {dateStr}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {movs.map((mov) => (
                    <div key={mov.id} className="apple-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                        <div style={{ 
                          width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: mov.type === 'INCOME' ? '#dcfce7' : '#fee2e2',
                          color: mov.type === 'INCOME' ? '#16a34a' : '#ef4444'
                        }}>
                          {mov.type === 'INCOME' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '16px' }}>{mov.category}</div>
                          {mov.description && (
                            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>{mov.description}</div>
                          )}
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {new Date(mov.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        <span style={{ fontSize: '20px', fontWeight: 600, color: mov.type === 'INCOME' ? '#16a34a' : '#ef4444' }}>
                          {mov.type === 'INCOME' ? '+' : '-'}{formatMoney(mov.amount)}
                        </span>
                        {mov.category !== 'ANULACION' && (
                          <button 
                            onClick={() => handleAnnul(mov.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', textDecoration: 'underline', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                          >
                            Anular
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RightPanel isOpen={showAddPanel} onClose={() => setShowAddPanel(false)} title={movType === 'INCOME' ? 'Nuevo Ingreso' : 'Nuevo Egreso'}>
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
