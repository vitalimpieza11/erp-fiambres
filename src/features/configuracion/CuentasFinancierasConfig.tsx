import React, { useEffect, useState } from 'react';
import { useFinancialAccountsStore } from '../../store/financialAccountsStore';
import { Plus, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import RightPanel from '../../components/RightPanel';
import type { FinancialAccount } from '../../types/domain';

export default function CuentasFinancierasConfig() {
  const { accounts, loading, fetchAccounts, saveAccount, toggleAccountStatus } = useFinancialAccountsStore();
  
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<FinancialAccount> | null>(null);
  
  // Form states
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<'EFECTIVO' | 'BANCO' | 'BILLETERA_VIRTUAL'>('EFECTIVO');
  const [activa, setActiva] = useState(true);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleOpenNew = () => {
    setEditingAccount(null);
    setNombre('');
    setTipo('EFECTIVO');
    setActiva(true);
    setIsPanelOpen(true);
  };

  const handleOpenEdit = (account: FinancialAccount) => {
    setEditingAccount(account);
    setNombre(account.nombre);
    setTipo(account.tipo);
    setActiva(account.activa);
    setIsPanelOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return alert("El nombre es requerido.");

    try {
      const accountData: Partial<FinancialAccount> = {
        nombre: nombre.trim(),
        tipo,
        activa
      };
      if (editingAccount?.id) {
        accountData.id = editingAccount.id;
      }
      await saveAccount(accountData);
      setIsPanelOpen(false);
    } catch (err) {
      alert("Error al guardar la cuenta.");
    }
  };

  if (loading && accounts.length === 0) return <LoadingSpinner message="Cargando cuentas financieras..." />;

  return (
    <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Cuentas Financieras</h3>
        <button className="btn-primary" onClick={handleOpenNew} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '14px' }}>
          <Plus size={16} /> Nueva Cuenta
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="apple-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>Nombre</th>
              <th style={{ padding: '12px' }}>Tipo</th>
              <th style={{ padding: '12px' }}>Estado</th>
              <th style={{ padding: '12px', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(acc => (
              <tr key={acc.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px', fontWeight: 600 }}>{acc.nombre}</td>
                <td style={{ padding: '12px' }}>
                  <span style={{ 
                    fontSize: '12px', padding: '4px 8px', borderRadius: '12px', fontWeight: 600,
                    backgroundColor: acc.tipo === 'EFECTIVO' ? '#f3f4f6' : (acc.tipo === 'BANCO' ? '#e0f2fe' : '#e0e7ff'),
                    color: acc.tipo === 'EFECTIVO' ? '#1f2937' : (acc.tipo === 'BANCO' ? '#0369a1' : '#4338ca')
                  }}>
                    {acc.tipo}
                  </span>
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{ 
                    fontSize: '12px', padding: '4px 8px', borderRadius: '12px', fontWeight: 600,
                    backgroundColor: acc.activa ? '#e6f4ea' : '#fce8e6',
                    color: acc.activa ? '#137333' : '#c5221f'
                  }}>
                    {acc.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td style={{ padding: '12px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                  <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => handleOpenEdit(acc)}>
                    Editar
                  </button>
                  <button 
                    type="button"
                    onClick={async () => {
                      try {
                        await toggleAccountStatus(acc.id, acc.activa);
                      } catch (err: any) {
                        alert(`Error al cambiar el estado de la cuenta: ${err.message || 'Sin permisos o error de red.'}`);
                      }
                    }}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: acc.activa ? '#137333' : '#cbd5e1', display: 'flex', alignItems: 'center', padding: 0 }}
                    title={acc.activa ? 'Desactivar Cuenta' : 'Activar Cuenta'}
                  >
                    {acc.activa ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RightPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} title={editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label>Nombre de la Cuenta *</label>
            <input 
              type="text" 
              required 
              placeholder="Ej: Banco Galicia o Caja Chica"
              value={nombre} 
              onChange={e => setNombre(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label>Tipo de Cuenta</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as any)}>
              <option value="EFECTIVO">Efectivo (Caja física)</option>
              <option value="BANCO">Banco (Cuenta Bancaria)</option>
              <option value="BILLETERA_VIRTUAL">Billetera Virtual (Mercado Pago, MP, etc.)</option>
            </select>
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
            <input 
              type="checkbox" 
              checked={activa} 
              onChange={e => setActiva(e.target.checked)} 
              id="accountActiveCheckbox"
              style={{ width: 'auto' }}
            />
            <label htmlFor="accountActiveCheckbox" style={{ margin: 0 }}>Cuenta Activa</label>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsPanelOpen(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
              <Save size={16} /> Guardar
            </button>
          </div>
        </form>
      </RightPanel>
    </div>
  );
}
