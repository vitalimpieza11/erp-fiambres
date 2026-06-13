import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Supplier } from '../../types/domain';

export default function ProveedoresConfig() {
  const [proveedores, setProveedores] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentProveedor, setCurrentProveedor] = useState<Partial<Supplier>>({});

  useEffect(() => {
    fetchProveedores();
  }, []);

  const fetchProveedores = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(COLLECTIONS.SUPPLIERS);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
      setProveedores(data);
    } catch (error) {
      console.error("Error fetching proveedores:", error);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...currentProveedor,
        activo: currentProveedor.activo !== false
      };
      
      if (currentProveedor.id) {
        await updateDoc(doc(db, 'suppliers', currentProveedor.id), dataToSave);
      } else {
        await addDoc(COLLECTIONS.SUPPLIERS, dataToSave);
      }
      setIsEditing(false);
      setCurrentProveedor({});
      fetchProveedores();
    } catch (error) {
      console.error("Error saving:", error);
    }
  };

  const toggleActivo = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'suppliers', id), { activo: !currentStatus });
      fetchProveedores();
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const filteredProveedores = proveedores.filter(p => 
    p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.cuit?.includes(searchTerm)
  );

  if (loading) return <p>Cargando proveedores...</p>;

  return (
    <div>
      <div className="search-bar">
        <input 
          type="text" 
          placeholder="Buscar por nombre o CUIT..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button className="btn-primary" onClick={() => { setIsEditing(true); setCurrentProveedor({ activo: true }); }}>
          + Nuevo Proveedor
        </button>
      </div>

      {isEditing ? (
        <form className="apple-form" onSubmit={handleSave}>
          <div className="form-group">
            <label>Nombre Comercial</label>
            <input required value={currentProveedor.nombre || ''} onChange={e => setCurrentProveedor({...currentProveedor, nombre: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Razón Social</label>
            <input required value={currentProveedor.razonSocial || ''} onChange={e => setCurrentProveedor({...currentProveedor, razonSocial: e.target.value})} />
          </div>
          <div className="form-group">
            <label>CUIT</label>
            <input value={currentProveedor.cuit || ''} onChange={e => setCurrentProveedor({...currentProveedor, cuit: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Teléfono</label>
            <input value={currentProveedor.telefono || ''} onChange={e => setCurrentProveedor({...currentProveedor, telefono: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={currentProveedor.email || ''} onChange={e => setCurrentProveedor({...currentProveedor, email: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Dirección</label>
            <input value={currentProveedor.direccion || ''} onChange={e => setCurrentProveedor({...currentProveedor, direccion: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Observaciones</label>
            <textarea value={currentProveedor.observaciones || ''} onChange={e => setCurrentProveedor({...currentProveedor, observaciones: e.target.value})} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Guardar</button>
            <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)}>Cancelar</button>
          </div>
        </form>
      ) : (
        <table className="apple-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>CUIT</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredProveedores.map(proveedor => (
              <tr key={proveedor.id}>
                <td>{proveedor.nombre}</td>
                <td>{proveedor.cuit}</td>
                <td>{proveedor.telefono}</td>
                <td>
                  <span className={`badge ${proveedor.activo ? 'active' : 'inactive'}`}>
                    {proveedor.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <button className="btn-secondary" style={{ marginRight: '8px' }} onClick={() => { setIsEditing(true); setCurrentProveedor(proveedor); }}>Editar</button>
                  <button className="btn-danger" onClick={() => toggleActivo(proveedor.id, proveedor.activo)}>
                    {proveedor.activo ? 'Dar de Baja' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
