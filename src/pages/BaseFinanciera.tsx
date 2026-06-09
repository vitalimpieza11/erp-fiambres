import React, { useState, useMemo } from 'react';
import { 
  Database, Plus, Edit2, Copy, Trash2, Search, Filter, AlertTriangle, 
  Save, X, Info
} from 'lucide-react';
import { useCashMovements } from '../hooks/useCashMovements';
import { useCustomers } from '../hooks/useCustomers';
import { useSuppliers } from '../hooks/useSuppliers';
import { useSocietaria } from '../hooks/useSocietaria';
import { useBanks } from '../hooks/useBanks';
import { PageHeader } from '../components/EmptyState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { formatCurrency } from '../utils/format';

export const BaseFinanciera = () => {
  const { movements, createMovement, updateMovement, deleteMovement, loading: loadingMovs } = useCashMovements();
  const { customers } = useCustomers();
  const { suppliers } = useSuppliers();
  const { partners } = useSocietaria();
  const { banks } = useBanks();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'registros' | 'diagnostico'>('registros');

  const categories = [
    'venta', 'compra', 'gasto', 'devolucion', 
    'caja', 'banco', 'billetera', 
    'aporte_socio', 'inversion_inicial', 'retiro_capital',
    'maquinaria', 'vehiculos', 'tecnologia', 'equipamiento', 'herramientas', 'inmuebles',
    'mercaderia_aportada', 'ajuste_stock'
  ];

  const handleEdit = (mov: any) => {
    setEditingId(mov.id);
    setFormData({
      ...mov,
      date: new Date(mov.date).toISOString().split('T')[0]
    });
    setIsCreating(false);
  };

  const handleDuplicate = (mov: any) => {
    setFormData({
      ...mov,
      id: undefined,
      date: new Date().toISOString().split('T')[0]
    });
    setEditingId('new');
    setIsCreating(true);
  };

  const handleCreate = () => {
    setFormData({
      type: 'out',
      amount: 0,
      currency: 'ARS',
      method: 'transfer',
      category: 'gasto',
      date: new Date().toISOString().split('T')[0],
      status: 'completado'
    });
    setEditingId('new');
    setIsCreating(true);
  };

  const handleSave = async () => {
    try {
      const dataToSave = {
        ...formData,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date).getTime(),
        isManualOverride: true,
      };

      if (isCreating) {
        await createMovement(dataToSave);
      } else {
        await updateMovement(editingId!, dataToSave);
      }
      
      setEditingId(null);
      setIsCreating(false);
    } catch (e: any) {
      alert("Error al guardar: " + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Estás seguro de eliminar este registro? Esto afectará todos los cálculos del sistema.")) {
      try {
        await deleteMovement(id);
      } catch (e: any) {
        alert("Error al eliminar: " + e.message);
      }
    }
  };

  const filteredMovements = useMemo(() => {
    return movements
      .filter(m => {
        const q = searchQuery.toLowerCase();
        return (
          (m.description || '').toLowerCase().includes(q) ||
          (m.category || '').toLowerCase().includes(q) ||
          m.amount.toString().includes(q)
        );
      })
      .sort((a, b) => b.date - a.date);
  }, [movements, searchQuery]);

  // KPIs Derivados Exclusivos
  const kpis = useMemo(() => {
    let liquidez = 0;
    let operativoVentas = 0;
    let operativoComprasGastos = 0;
    let capitalAportes = 0;
    let capitalRetiros = 0;
    let activosValor = 0;

    movements.forEach(m => {
      const isOut = m.type === 'out';
      const amt = (isOut ? -1 : 1) * m.amount;
      
      const cat = (m.category || '').toLowerCase();
      const isAporte = cat.includes('aporte_socio') || cat.includes('inversion_inicial');
      const isRetiro = cat.includes('retiro');
      const isActivo = ['maquinaria', 'vehiculos', 'tecnologia', 'equipamiento', 'herramientas', 'inmuebles', 'bien_capital'].some(c => cat.includes(c));
      
      // Liquidez (solo dinero)
      if (!isActivo && (!isAporte || (m.aporteType === 'dinero' || !m.aporteType))) {
        if (m.type !== 'transfer') {
          liquidez += amt;
        }
      }

      // Operativo
      if (!isAporte && !isRetiro && !isActivo && m.type !== 'transfer') {
        if (m.type === 'in' && cat.includes('venta')) operativoVentas += m.amount;
        if (m.type === 'out' && (cat.includes('compra') || cat.includes('gasto'))) operativoComprasGastos += m.amount;
      }

      // Capital
      if (isAporte) {
        capitalAportes += m.amount; // Aportes siempre suman al capital
      }
      if (isRetiro) capitalRetiros += m.amount;

      // Activos
      if (isActivo) activosValor += m.amount;
    });

    return {
      liquidez,
      resultadoOperativo: operativoVentas - operativoComprasGastos,
      capital: capitalAportes - capitalRetiros,
      activos: activosValor,
      patrimonio: liquidez + activosValor // - pasivos (simplificado por ahora)
    };
  }, [movements]);

  return (
    <>
      <PageHeader 
        title="Base Financiera Central" 
        description="Fuente única de verdad. Toda la información del sistema se calcula desde estos registros."
      />

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button
          onClick={() => setActiveTab('registros')}
          style={{
            padding: '10px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer',
            backgroundColor: activeTab === 'registros' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'registros' ? '#fff' : 'var(--text-secondary)',
            fontWeight: activeTab === 'registros' ? 700 : 500,
          }}
        >
          <Database size={18} style={{ display: 'inline', marginRight: '8px' }}/>
          Registros Maestros
        </button>
        <button
          onClick={() => setActiveTab('diagnostico')}
          style={{
            padding: '10px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer',
            backgroundColor: activeTab === 'diagnostico' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'diagnostico' ? '#fff' : 'var(--text-secondary)',
            fontWeight: activeTab === 'diagnostico' ? 700 : 500,
          }}
        >
          <Info size={18} style={{ display: 'inline', marginRight: '8px' }}/>
          Explicación de Cálculos
        </button>
      </div>

      {activeTab === 'diagnostico' && (
        <Card>
          <div style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px' }}>KPIs Calculados Exclusivamente desde la Base</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
              <div style={{ padding: '16px', backgroundColor: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.8rem', color: '#0f766e', fontWeight: 600 }}>Liquidez Total</p>
                <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#115e59' }}>{formatCurrency(kpis.liquidez)}</h4>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Caja + Bancos + Billeteras</p>
              </div>
              <div style={{ padding: '16px', backgroundColor: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.8rem', color: '#1d4ed8', fontWeight: 600 }}>Resultado Operativo</p>
                <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e40af' }}>{formatCurrency(kpis.resultadoOperativo)}</h4>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Ventas - (Compras + Gastos)</p>
              </div>
              <div style={{ padding: '16px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>Capital</p>
                <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#92400e' }}>{formatCurrency(kpis.capital)}</h4>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Aportes - Retiros</p>
              </div>
              <div style={{ padding: '16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.8rem', color: '#b91c1c', fontWeight: 600 }}>Activos Físicos</p>
                <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#991b1b' }}>{formatCurrency(kpis.activos)}</h4>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Maquinaria, Vehículos, etc.</p>
              </div>
              <div style={{ padding: '16px', backgroundColor: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.8rem', color: '#6d28d9', fontWeight: 600 }}>Patrimonio Neto</p>
                <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#5b21b6' }}>{formatCurrency(kpis.patrimonio)}</h4>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Liquidez + Activos</p>
              </div>
            </div>

            <div style={{ backgroundColor: '#fffbe1', padding: '16px', borderRadius: '8px', border: '1px solid #fef08a' }}>
              <h4 style={{ fontWeight: 700, color: '#854d0e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={18}/> Nota Arquitectónica</h4>
              <p style={{ fontSize: '0.9rem', color: '#713f12' }}>Todos los valores de este sistema se construyen <b>sumando y restando dinámicamente cada fila de la pestaña "Registros Maestros"</b>. No existe información "oculta" ni cálculos intermedios estáticos. Si eliminas un registro, todo el sistema retrocederá su impacto instantáneamente.</p>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'registros' && (
        <Card padding="none">
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '50%' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input 
                  type="text" 
                  placeholder="Buscar en la base central..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
                />
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleCreate} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} /> Nuevo Registro Maestro
            </button>
          </div>

          <div style={{ overflowX: 'auto', padding: '0 24px 24px 24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Fecha</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Tipo</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Categoría</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Descripción</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Entidad</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Cuenta</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>Importe</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {editingId === 'new' && (
                  <tr style={{ backgroundColor: '#f0fdfa', borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px' }}>
                      <input type="date" className="form-input" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} style={{ minWidth: '130px' }} />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <select className="form-select" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                        <option value="in">Ingreso</option>
                        <option value="out">Egreso</option>
                        <option value="transfer">Traspaso</option>
                      </select>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <select className="form-select" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input type="text" className="form-input" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Descripción..." />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input type="text" className="form-input" value={formData.referenceId || ''} onChange={e => setFormData({...formData, referenceId: e.target.value})} placeholder="Ref/Entidad..." />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <select className="form-select" value={formData.method} onChange={e => setFormData({...formData, method: e.target.value})}>
                        <option value="cash">Efectivo</option>
                        <option value="transfer">Transferencia</option>
                        <option value="otro">Otro</option>
                      </select>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <input type="number" className="form-input" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button onClick={handleSave} className="btn-icon" style={{ color: '#16a34a' }}><Save size={18} /></button>
                        <button onClick={() => setEditingId(null)} className="btn-icon" style={{ color: '#dc2626' }}><X size={18} /></button>
                      </div>
                    </td>
                  </tr>
                )}

                {filteredMovements.map(mov => (
                  editingId === mov.id ? (
                    <tr key={mov.id} style={{ backgroundColor: '#f0fdfa', borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px' }}>
                        <input type="date" className="form-input" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} style={{ minWidth: '130px' }} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <select className="form-select" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                          <option value="in">Ingreso</option>
                          <option value="out">Egreso</option>
                          <option value="transfer">Traspaso</option>
                        </select>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <select className="form-select" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="text" className="form-input" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="text" className="form-input" value={formData.referenceId || ''} onChange={e => setFormData({...formData, referenceId: e.target.value})} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <select className="form-select" value={formData.method} onChange={e => setFormData({...formData, method: e.target.value})}>
                          <option value="cash">Efectivo</option>
                          <option value="transfer">Transferencia</option>
                          <option value="otro">Otro</option>
                        </select>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="number" className="form-input" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          <button onClick={handleSave} className="btn-icon" style={{ color: '#16a34a' }}><Save size={18} /></button>
                          <button onClick={() => setEditingId(null)} className="btn-icon" style={{ color: '#dc2626' }}><X size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={mov.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px' }}>{new Date(mov.date).toLocaleDateString()}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ 
                          padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                          backgroundColor: mov.type === 'in' ? '#dcfce7' : mov.type === 'out' ? '#fee2e2' : '#f3f4f6',
                          color: mov.type === 'in' ? '#166534' : mov.type === 'out' ? '#991b1b' : '#374151'
                        }}>
                          {mov.type === 'in' ? 'INGRESO' : mov.type === 'out' ? 'EGRESO' : 'TRASPASO'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textTransform: 'capitalize' }}>{(mov.category || '').replace('_', ' ')}</td>
                      <td style={{ padding: '12px' }}>{mov.description}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                        {mov.customerName || mov.supplierName || mov.referenceId || '-'}
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                        {mov.method === 'cash' ? 'Caja Física' : 'Banco'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 600 }}>
                        {formatCurrency(mov.amount)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyItems: 'center', justifyContent: 'center' }}>
                          <button onClick={() => handleEdit(mov)} className="btn-icon"><Edit2 size={16} /></button>
                          <button onClick={() => handleDuplicate(mov)} className="btn-icon"><Copy size={16} /></button>
                          <button onClick={() => handleDelete(mov.id!)} className="btn-icon" style={{ color: '#dc2626' }}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
            {filteredMovements.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No hay registros que coincidan con la búsqueda.
              </div>
            )}
          </div>
        </Card>
      )}
    </>
  );
};
