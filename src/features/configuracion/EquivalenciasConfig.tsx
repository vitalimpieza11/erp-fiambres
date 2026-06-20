import { useState, useEffect } from 'react';
import { getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Equivalencia } from '../../types/domain';

export default function EquivalenciasConfig() {
  const [equivalencias, setEquivalencias] = useState<Equivalencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentEquiv, setCurrentEquiv] = useState<Partial<Equivalencia>>({});

  useEffect(() => {
    fetchEquivalencias();
  }, []);

  const fetchEquivalencias = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(COLLECTIONS.EQUIVALENCES);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equivalencia));
      setEquivalencias(data);
    } catch (error) {
      console.error("Error fetching equivalencias:", error);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        nombre: currentEquiv.nombre,
        origen: currentEquiv.origen,
        destino: currentEquiv.destino,
        factor: Number(currentEquiv.factor || 1)
      };
      
      if (currentEquiv.id) {
        await updateDoc(doc(db, 'equivalences', currentEquiv.id), dataToSave);
      } else {
        await addDoc(COLLECTIONS.EQUIVALENCES, dataToSave);
      }
      setIsEditing(false);
      setCurrentEquiv({});
      fetchEquivalencias();
    } catch (error) {
      console.error("Error saving:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Eliminar equivalencia?')) {
      try {
        await deleteDoc(doc(db, 'equivalences', id));
        fetchEquivalencias();
      } catch (error) {
        console.error("Error deleting:", error);
      }
    }
  };

  if (loading) return <p>Cargando equivalencias...</p>;

  return (
    <div>
      <div className="search-bar">
        <h3>Equivalencias Globales</h3>
        <button className="btn-primary" onClick={() => { setIsEditing(true); setCurrentEquiv({}); }}>
          + Nueva Equivalencia
        </button>
      </div>

      {isEditing ? (
        <form className="apple-form" onSubmit={handleSave}>
          <div className="form-group">
            <label>Nombre / Descripción</label>
            <input required placeholder="Ej: Feta de Jamón a Gramos" value={currentEquiv.nombre || ''} onChange={e => setCurrentEquiv({...currentEquiv, nombre: e.target.value})} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Unidad Origen</label>
              <input required placeholder="Ej: Feta" value={currentEquiv.origen || ''} onChange={e => setCurrentEquiv({...currentEquiv, origen: e.target.value})} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Unidad Destino</label>
              <input required placeholder="Ej: Gramos" value={currentEquiv.destino || ''} onChange={e => setCurrentEquiv({...currentEquiv, destino: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label>Factor (Multiplicador)</label>
            <input type="number" step="0.001" required placeholder="Ej: 25" value={currentEquiv.factor !== undefined ? currentEquiv.factor : ''} onChange={e => setCurrentEquiv({...currentEquiv, factor: e.target.value as any})} />
            <small style={{ color: '#86868b' }}>Ej: 1 origen = [factor] destino</small>
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
              <th>Origen</th>
              <th>Destino</th>
              <th>Factor Multiplicador</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {equivalencias.map(equiv => (
              <tr key={equiv.id}>
                <td>{equiv.nombre}</td>
                <td>{equiv.origen}</td>
                <td>{equiv.destino}</td>
                <td>{equiv.factor}</td>
                <td>
                  <button className="btn-secondary" style={{ marginRight: '8px' }} onClick={() => { setIsEditing(true); setCurrentEquiv(equiv); }}>Editar</button>
                  <button className="btn-danger" onClick={() => handleDelete(equiv.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
