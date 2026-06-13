import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Customer } from '../../types/domain';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import { Users, Edit3, Power, PowerOff } from 'lucide-react';

export default function ClientesConfig() {
  const [clientes, setClientes] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showPanel, setShowPanel] = useState(false);
  const [currentCliente, setCurrentCliente] = useState<Partial<Customer>>({});

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(COLLECTIONS.CUSTOMERS);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setClientes(data);
    } catch (error) {
      console.error("Error fetching clientes:", error);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...currentCliente,
        activo: currentCliente.activo !== false // Default true
      };
      
      if (currentCliente.id) {
        await updateDoc(doc(db, 'customers', currentCliente.id), dataToSave);
      } else {
        await addDoc(COLLECTIONS.CUSTOMERS, dataToSave);
      }
      setShowPanel(false);
      setCurrentCliente({});
      fetchClientes();
    } catch (error) {
      console.error("Error saving:", error);
    }
  };

  const toggleActivo = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'customers', id), { activo: !currentStatus });
      fetchClientes();
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const filteredClientes = clientes.filter(c => 
    c.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.cuit?.includes(searchTerm)
  );

  if (loading) return <div className="loading-container"><div className="spinner"></div><p>Cargando clientes...</p></div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: 0 }}>Directorio de Clientes</h2>
        <button className="btn-primary" onClick={() => { setCurrentCliente({ activo: true }); setShowPanel(true); }}>
          + Nuevo Cliente
        </button>
      </div>

      <div className="search-bar" style={{ marginBottom: '24px' }}>
        <input 
          type="text" 
          placeholder="Buscar por nombre o CUIT..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: '100%', maxWidth: '400px' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {filteredClientes.map(cliente => (
          <ExpandableCard
            key={cliente.id}
            title={cliente.nombre}
            statusBadge={
              <span style={{ 
                backgroundColor: cliente.activo ? '#dcfce7' : '#fee2e2',
                color: cliente.activo ? '#16a34a' : '#ef4444'
              }}>
                {cliente.activo ? 'Activo' : 'Inactivo'}
              </span>
            }
            collapsedContent={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>CUIT: {cliente.cuit || '-'}</span>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Tel: {cliente.telefono || '-'}</span>
              </div>
            }
            expandedContent={
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                <p style={{ margin: 0 }}><strong>Razón Social:</strong> {cliente.razonSocial || '-'}</p>
                <p style={{ margin: 0 }}><strong>Email:</strong> {cliente.email || '-'}</p>
                <p style={{ margin: 0 }}><strong>Dirección:</strong> {cliente.direccion || '-'}</p>
                {cliente.observaciones && (
                  <p style={{ margin: 0, fontStyle: 'italic', marginTop: '8px' }}>Obs: {cliente.observaciones}</p>
                )}
              </div>
            }
            actions={
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <button className="btn-secondary" style={{ flex: 1, padding: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }} onClick={(e) => { e.stopPropagation(); setCurrentCliente(cliente); setShowPanel(true); }}>
                  <Edit3 size={16} /> Editar
                </button>
                <button className="btn-secondary" style={{ flex: 1, padding: '8px', color: cliente.activo ? '#ef4444' : '#16a34a', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }} onClick={(e) => { e.stopPropagation(); toggleActivo(cliente.id, cliente.activo); }}>
                  {cliente.activo ? <><PowerOff size={16} /> Baja</> : <><Power size={16} /> Reactivar</>}
                </button>
              </div>
            }
          />
        ))}
        {filteredClientes.length === 0 && (
          <p style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No se encontraron clientes.</p>
        )}
      </div>

      <RightPanel isOpen={showPanel} onClose={() => setShowPanel(false)} title={currentCliente.id ? "Editar Cliente" : "Nuevo Cliente"}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label>Nombre Comercial</label>
            <input required value={currentCliente.nombre || ''} onChange={e => setCurrentCliente({...currentCliente, nombre: e.target.value})} autoFocus />
          </div>
          <div className="form-group">
            <label>Razón Social</label>
            <input required value={currentCliente.razonSocial || ''} onChange={e => setCurrentCliente({...currentCliente, razonSocial: e.target.value})} />
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>CUIT</label>
              <input value={currentCliente.cuit || ''} onChange={e => setCurrentCliente({...currentCliente, cuit: e.target.value})} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Teléfono</label>
              <input value={currentCliente.telefono || ''} onChange={e => setCurrentCliente({...currentCliente, telefono: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={currentCliente.email || ''} onChange={e => setCurrentCliente({...currentCliente, email: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Dirección</label>
            <input value={currentCliente.direccion || ''} onChange={e => setCurrentCliente({...currentCliente, direccion: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Observaciones</label>
            <textarea value={currentCliente.observaciones || ''} onChange={e => setCurrentCliente({...currentCliente, observaciones: e.target.value})} rows={3} />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowPanel(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>Guardar</button>
          </div>
        </form>
      </RightPanel>
    </div>
  );
}
