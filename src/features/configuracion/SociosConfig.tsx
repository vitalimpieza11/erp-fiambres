import { useState, useEffect } from 'react';
import { getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { Shareholder } from '../../types/domain';

export default function SociosConfig() {
  const [socios, setSocios] = useState<Shareholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentSocio, setCurrentSocio] = useState<Partial<Shareholder>>({});

  useEffect(() => {
    fetchSocios();
  }, []);

  const fetchSocios = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(COLLECTIONS.SHAREHOLDERS);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shareholder));
      setSocios(data);
    } catch (error) {
      console.error("Error fetching socios:", error);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...currentSocio,
        activo: currentSocio.activo !== false,
        participacionPorcentaje: Number(currentSocio.participacionPorcentaje || 0)
      };
      
      if (currentSocio.id) {
        await updateDoc(doc(db, 'shareholders', currentSocio.id), dataToSave);
      } else {
        await addDoc(COLLECTIONS.SHAREHOLDERS, dataToSave);
      }
      setIsEditing(false);
      setCurrentSocio({});
      fetchSocios();
    } catch (error) {
      console.error("Error saving:", error);
    }
  };

  const toggleActivo = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'shareholders', id), { activo: !currentStatus });
      fetchSocios();
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  if (loading) return <p>Cargando socios...</p>;

  return (
    <div>
      <div className="search-bar">
        <h3>Socios</h3>
        <button className="btn-primary" onClick={() => { setIsEditing(true); setCurrentSocio({ activo: true }); }}>
          + Nuevo Socio
        </button>
      </div>

      {isEditing ? (
        <form className="apple-form" onSubmit={handleSave}>
          <div className="form-group">
            <label>Nombre del Socio</label>
            <input required value={currentSocio.nombre || ''} onChange={e => setCurrentSocio({...currentSocio, nombre: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Participación (%)</label>
            <input type="number" step="0.01" required value={currentSocio.participacionPorcentaje || ''} onChange={e => setCurrentSocio({...currentSocio, participacionPorcentaje: Number(e.target.value)})} />
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
              <th>Participación</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {socios.map(socio => (
              <tr key={socio.id}>
                <td>{socio.nombre}</td>
                <td>{socio.participacionPorcentaje}%</td>
                <td>
                  <span className={`badge ${socio.activo ? 'active' : 'inactive'}`}>
                    {socio.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <button className="btn-secondary" style={{ marginRight: '8px' }} onClick={() => { setIsEditing(true); setCurrentSocio(socio); }}>Editar</button>
                  <button className="btn-danger" onClick={() => toggleActivo(socio.id, socio.activo)}>
                    {socio.activo ? 'Dar de Baja' : 'Reactivar'}
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
