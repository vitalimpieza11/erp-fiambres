import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Check } from 'lucide-react';
import MobileTopBar from '../../layout/MobileTopBar';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import NumpadGigante from '../../components/NumpadGigante';
import MobileButton from '../../components/MobileButton';
import { useCajaStore } from '../../../store/cajaStore';

export default function ModoCaja() {
  const navigate = useNavigate();
  const { movements, subscribeMovements, addMovement } = useCajaStore();
  const [isNumpadOpen, setIsNumpadOpen] = useState(false);
  const [numpadMode, setNumpadMode] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [amountInput, setAmountInput] = useState('');

  useEffect(() => {
    const unsub = subscribeMovements();
    return () => unsub();
  }, [subscribeMovements]);

  const saldoHoy = useMemo(() => {
    // Simulando saldo del día
    const today = new Date().toISOString().split('T')[0];
    return movements
      .filter(m => m.date.startsWith(today) && !m.isDeleted)
      .reduce((acc, m) => acc + (m.type === 'INCOME' ? m.amount : -m.amount), 0);
  }, [movements]);

  const handleOpenTransaction = (type: 'INCOME' | 'EXPENSE') => {
    setNumpadMode(type);
    setAmountInput('');
    setIsNumpadOpen(true);
  };

  const handleConfirmTransaction = async () => {
    if (!amountInput || parseFloat(amountInput) <= 0) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
    
    await addMovement({
      type: numpadMode,
      amount: parseFloat(amountInput),
      category: numpadMode === 'INCOME' ? 'INGRESO VARIO' : 'EGRESO VARIO',
      description: 'Ingresado desde Mobile'
    });
    setIsNumpadOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#0f172a' }}>
      <MobileTopBar 
        title="Caja Fuerte" 
        leftElement={<div onClick={() => navigate('/mobile')} style={{ padding: '8px' }}><ArrowLeft size={24} color="#94a3b8" /></div>}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
        <span style={{ color: '#94a3b8', fontSize: '18px', textTransform: 'uppercase', letterSpacing: '2px' }}>Saldo del Día</span>
        <div style={{ fontSize: '64px', fontWeight: 800, color: 'white', margin: '16px 0', display: 'flex', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '32px', marginTop: '12px', marginRight: '4px', color: '#94a3b8' }}>$</span>
          {saldoHoy.toLocaleString('es-AR')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', width: '100%', marginTop: '48px' }}>
          <button onClick={() => handleOpenTransaction('INCOME')} style={{ height: '100px', borderRadius: '24px', backgroundColor: '#10b981', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', gap: '8px' }}>
            <Plus size={32} />
            <span style={{ fontWeight: 700, fontSize: '16px' }}>INGRESO</span>
          </button>
          <button onClick={() => handleOpenTransaction('EXPENSE')} style={{ height: '100px', borderRadius: '24px', backgroundColor: '#ef4444', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', gap: '8px' }}>
            <Minus size={32} />
            <span style={{ fontWeight: 700, fontSize: '16px' }}>EGRESO</span>
          </button>
        </div>
      </div>

      <MobileBottomSheet isOpen={isNumpadOpen} onClose={() => setIsNumpadOpen(false)} height="65vh">
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span style={{ color: numpadMode === 'INCOME' ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase' }}>
            {numpadMode === 'INCOME' ? 'Registrar Ingreso' : 'Registrar Egreso'}
          </span>
          <div style={{ fontSize: '56px', fontWeight: 800, color: 'var(--mobile-text-primary)' }}>
            ${amountInput || '0'}
          </div>
        </div>

        <NumpadGigante value={amountInput} onChange={setAmountInput} onEnter={handleConfirmTransaction} />

        <div style={{ padding: '16px', marginTop: '16px' }}>
          <MobileButton size="lg" fullWidth onClick={handleConfirmTransaction} style={{ backgroundColor: numpadMode === 'INCOME' ? '#10b981' : '#ef4444' }}>
            <Check size={24} style={{ marginRight: '8px' }} /> Confirmar
          </MobileButton>
        </div>
      </MobileBottomSheet>
    </div>
  );
}
