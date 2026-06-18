import { useState, useEffect } from 'react';
import { getDocs, addDoc, updateDoc, doc, query, collection, where } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { PriceList, Customer, Product } from '../../types/domain';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { Eye, FileText, CheckSquare, Square, Printer, ArrowLeft, Loader2 } from 'lucide-react';
import { generatePriceListPDF } from './priceListPdfHelper';

export default function ListasPreciosConfig() {
  const [listas, setListas] = useState<PriceList[]>([]);
  const [clientes, setClientes] = useState<Customer[]>([]);
  const [presentaciones, setPresentaciones] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentLista, setCurrentLista] = useState<Partial<PriceList>>({ items: [], activo: true });
  
  // Saving and Alert states
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // Selected presentations state: { [productId]: { selected: boolean, price: number } }
  const [selectedItems, setSelectedItems] = useState<Record<string, { selected: boolean; price: number }>>({});
  
  // Preview State
  const [previewLista, setPreviewLista] = useState<PriceList | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [listSnap, cliSnap, prodSnap] = await Promise.all([
        getDocs(COLLECTIONS.PRICE_LISTS),
        getDocs(COLLECTIONS.CUSTOMERS),
        getDocs(query(collection(db, 'products'), where('type', '==', 'PRESENTACION'), where('activo', '==', true)))
      ]);
      setListas(listSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PriceList)));
      setClientes(cliSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      
      // Order presentations A-Z alphabetically using localeCompare
      const sortedProds = prodSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Product))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      setPresentaciones(sortedProds);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  const handleEdit = (lista: PriceList) => {
    setSaveStatus(null);
    setCurrentLista(lista);
    const initialSelected: Record<string, { selected: boolean; price: number }> = {};
    
    presentaciones.forEach(p => {
      const match = lista.items.find(item => item.productId === p.id);
      if (match) {
        initialSelected[p.id] = { selected: true, price: match.price };
      } else {
        initialSelected[p.id] = { selected: false, price: p.precioComercial || 0 };
      }
    });
    setSelectedItems(initialSelected);
    setIsEditing(true);
  };

  const handleNew = () => {
    setSaveStatus(null);
    setCurrentLista({ name: '', customerId: '', activo: true, items: [] });
    const initialSelected: Record<string, { selected: boolean; price: number }> = {};
    presentaciones.forEach(p => {
      initialSelected[p.id] = { selected: false, price: p.precioComercial || 0 };
    });
    setSelectedItems(initialSelected);
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const itemsToSave = Object.entries(selectedItems)
        .filter(([_, value]) => value.selected)
        .map(([productId, value]) => ({ productId, price: value.price }));

      const dataToSave = {
        name: currentLista.name,
        customerId: currentLista.customerId || null,
        activo: currentLista.activo !== false,
        items: itemsToSave
      };
      
      if (currentLista.id) {
        await updateDoc(doc(db, 'price_lists', currentLista.id), dataToSave);
      } else {
        await addDoc(COLLECTIONS.PRICE_LISTS, dataToSave);
      }
      setSaveStatus({ type: 'success', message: 'Lista de precios guardada con éxito.' });
      setTimeout(() => {
        setIsEditing(false);
        setCurrentLista({ items: [], activo: true });
        setSaveStatus(null);
      }, 1500);
      fetchData();
    } catch (error: any) {
      console.error("Error saving:", error);
      setSaveStatus({ type: 'error', message: `Error al guardar: ${error.message || error}` });
    } finally {
      setIsSaving(false);
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
    if (!previewLista) return;
    const listCustomer = previewLista.customerId
      ? clientes.find(c => c.id === previewLista.customerId)?.nombre || 'Desconocido'
      : 'Global';
    generatePriceListPDF(previewLista, listCustomer, presentaciones);
  };

  if (loading) return <p>Cargando listas de precios...</p>;

  // If in Preview Mode
  if (previewLista) {
    const listCustomer = previewLista.customerId
      ? clientes.find(c => c.id === previewLista.customerId)?.nombre
      : 'Global';

    return (
      <div className="price-list-preview-container">
        {/* Actions section hidden during print */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: 'var(--bg-color)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setPreviewLista(null)}>
            <ArrowLeft size={16} /> Volver
          </button>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={handleExportPDF}>
            <Printer size={16} /> Exportar PDF Profesional
          </button>
        </div>

        {/* Printable price list sheet */}
        <div className="printable-sheet" style={{ background: '#fff', padding: '40px', border: '1px solid #e2e8f0', borderRadius: '8px', maxWidth: '800px', margin: '0 auto', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--alvacio-red)', paddingBottom: '20px', marginBottom: '30px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: 'var(--alvacio-red)', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontWeight: 900, fontSize: '18px', letterSpacing: '1px' }}>V</span>
                <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>VITALIMPIEZA</h1>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#718096', fontWeight: 500 }}>Fábrica de Embutidos y Fiambres Premium</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{previewLista.name}</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#718096' }}>Cliente: <strong>{listCustomer}</strong></p>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#718096' }}>Fecha de Emisión: <strong>{formatDate(new Date().toISOString())}</strong></p>
            </div>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#4a5568', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <th style={{ padding: '12px 8px' }}>Producto</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Precio por Kg</th>
              </tr>
            </thead>
            <tbody>
              {previewLista.items.map((item, idx) => {
                const prod = presentaciones.find(p => p.id === item.productId);
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #edf2f7', fontSize: '14px' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 600, color: '#2d3748' }}>{prod?.nombre || 'Producto Desconocido'}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: '#1a202c' }}>
                      {formatCurrency(item.price)}
                    </td>
                  </tr>
                );
              })}
              {previewLista.items.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ padding: '24px', textAlign: 'center', color: '#718096', fontStyle: 'italic' }}>Esta lista de precios no contiene productos.</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', textAlign: 'center', fontSize: '11px', color: '#a0aec0' }}>
            <p style={{ margin: '0 0 4px 0', fontWeight: 600 }}>Precios sujetos a modificaciones sin previo aviso.</p>
            <p style={{ margin: 0 }}>Vitalimpieza ERP • Gestión Profesional de Distribución</p>
          </div>
        </div>

        {/* Print Styles injected locally */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .printable-sheet, .printable-sheet * {
              visibility: visible;
            }
            .printable-sheet {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              border: none !important;
              box-shadow: none !important;
              padding: 0 !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}} />
      </div>
    );
  }

  return (
    <div>
      <div className="search-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Listas de Precios</h3>
        <div>
          <button className="btn-primary" onClick={handleNew}>
            + Nueva Lista
          </button>
        </div>
      </div>

      {isEditing ? (
        <form className="apple-form" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <div className="form-group">
            <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>Nombre de la Lista *</label>
            <input required value={currentLista.name || ''} onChange={e => setCurrentLista({...currentLista, name: e.target.value})} placeholder="Ej. Mayorista Panther, Distribuidor..." />
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>Cliente Asignado (Opcional)</label>
            <select value={currentLista.customerId || ''} onChange={e => setCurrentLista({...currentLista, customerId: e.target.value})}>
              <option value="">(Ninguno / Global)</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '16px 0 12px 0' }}>Selección de Presentaciones a Incluir</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto', padding: '4px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              {presentaciones.map(p => {
                const isSelected = !!selectedItems[p.id]?.selected;
                const priceValue = selectedItems[p.id]?.price || 0;
                
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: isSelected ? 'var(--bg-color)' : 'transparent', borderRadius: '8px', borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer' }} onClick={() => setSelectedItems({ ...selectedItems, [p.id]: { selected: !isSelected, price: priceValue } })}>
                      {isSelected ? <CheckSquare size={18} style={{ color: 'var(--alvacio-red)' }} /> : <Square size={18} style={{ color: 'var(--text-secondary)' }} />}
                      <span style={{ fontSize: '14px', fontWeight: isSelected ? 600 : 500 }}>{p.nombre}</span>
                    </div>
                    {isSelected && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Precio: $</span>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={priceValue || ''}
                          style={{ width: '120px', textAlign: 'right', margin: 0, padding: '4px 8px' }}
                          onChange={e => setSelectedItems({ ...selectedItems, [p.id]: { selected: true, price: parseFloat(e.target.value) || 0 } })}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {saveStatus && (
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: saveStatus.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: saveStatus.type === 'success' ? '#15803d' : '#991b1b',
              fontSize: '14px',
              fontWeight: 500
            }}>
              {saveStatus.message}
            </div>
          )}

          <div className="form-actions" style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button type="submit" className="btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" size={16} />}
              {isSaving ? 'Guardando...' : 'Guardar'}
            </button>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsEditing(false)} disabled={isSaving}>Cancelar</button>
          </div>
        </form>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="apple-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th>Nombre</th>
                <th>Cliente Asignado</th>
                <th>Productos</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listas.map(lista => (
                <tr key={lista.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td><strong>{lista.name}</strong></td>
                  <td>{lista.customerId ? clientes.find(c => c.id === lista.customerId)?.nombre : 'Global'}</td>
                  <td><span className="badge" style={{ background: 'var(--bg-color)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>{lista.items?.length || 0} ítems</span></td>
                  <td>
                    <span className={`badge ${lista.activo ? 'active' : 'inactive'}`}>
                      {lista.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-secondary" style={{ marginRight: '8px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => setPreviewLista(lista)}>
                      <Eye size={14} /> Vista Previa
                    </button>
                    <button className="btn-secondary" style={{ marginRight: '8px', padding: '6px 12px' }} onClick={() => handleEdit(lista)}>Editar</button>
                    <button className="btn-danger" style={{ padding: '6px 12px' }} onClick={() => toggleActivo(lista.id, lista.activo)}>
                      {lista.activo ? 'Baja' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
