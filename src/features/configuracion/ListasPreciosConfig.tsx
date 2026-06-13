import { useState, useEffect } from 'react';
import { getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { PriceList, Customer } from '../../types/domain';

export default function ListasPreciosConfig() {
  const [listas, setListas] = useState<PriceList[]>([]);
  const [clientes, setClientes] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentLista, setCurrentLista] = useState<Partial<PriceList>>({ items: [], activo: true });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [listSnap, cliSnap] = await Promise.all([
        getDocs(COLLECTIONS.PRICE_LISTS),
        getDocs(COLLECTIONS.CUSTOMERS)
      ]);
      setListas(listSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PriceList)));
      setClientes(cliSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSave = {
        name: currentLista.name,
        customerId: currentLista.customerId || null,
        activo: currentLista.activo !== false,
        items: currentLista.items || []
      };
      
      if (currentLista.id) {
        await updateDoc(doc(db, 'price_lists', currentLista.id), dataToSave);
      } else {
        await addDoc(COLLECTIONS.PRICE_LISTS, dataToSave);
      }
      setIsEditing(false);
      setCurrentLista({ items: [], activo: true });
      fetchData();
    } catch (error) {
      console.error("Error saving:", error);
    }
  };

  const toggleActivo = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'price_lists', id), { activo: !currentStatus });
      fetchData();
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const handleExportPDF = () => {
    alert("Exportación PDF - Funcionalidad preparada para próxima etapa.");
  };

  if (loading) return <p>Cargando listas de precios...</p>;

  return (
    <div>
      <div className="search-bar">
        <h3>Listas de Precios</h3>
        <div>
          <button className="btn-secondary" style={{ marginRight: '10px' }} onClick={handleExportPDF}>
            Exportar PDF
          </button>
          <button className="btn-primary" onClick={() => { setIsEditing(true); setCurrentLista({ activo: true, items: [] }); }}>
            + Nueva Lista
          </button>
        </div>
      </div>

      {isEditing ? (
        <form className="apple-form" onSubmit={handleSave}>
          <div className="form-group">
            <label>Nombre de la Lista</label>
            <input required value={currentLista.name || ''} onChange={e => setCurrentLista({...currentLista, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Cliente Asignado (Opcional)</label>
            <select value={currentLista.customerId || ''} onChange={e => setCurrentLista({...currentLista, customerId: e.target.value})}>
              <option value="">(Ninguno / Global)</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
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
              <th>Cliente Asignado</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {listas.map(lista => (
              <tr key={lista.id}>
                <td>{lista.name}</td>
                <td>{lista.customerId ? clientes.find(c => c.id === lista.customerId)?.nombre : 'Global'}</td>
                <td>
                  <span className={`badge ${lista.activo ? 'active' : 'inactive'}`}>
                    {lista.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <button className="btn-secondary" style={{ marginRight: '8px' }} onClick={() => { setIsEditing(true); setCurrentLista(lista); }}>Editar</button>
                  <button className="btn-danger" onClick={() => toggleActivo(lista.id, lista.activo)}>
                    {lista.activo ? 'Dar de Baja' : 'Reactivar'}
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
