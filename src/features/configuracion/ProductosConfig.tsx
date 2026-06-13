import { useState } from 'react';
import type { Product, ProductType, UnitType } from '../../types/domain';
import { Plus, ChevronDown, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import { useProducts } from './useProducts';

export default function ProductosConfig() {
  const { productos, loading, saveProduct, toggleStatus } = useProducts();
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({ 
    type: 'MERCADERIA', 
    unitType: 'KG', 
    activo: true,
    recipeItems: []
  });
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'MERCADERIA': true,
    'INSUMO': false,
    'PRESENTACION': false
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await saveProduct(currentProduct);
      setIsEditing(false);
      setCurrentProduct({ type: 'MERCADERIA', unitType: 'KG', activo: true, recipeItems: [] });
    } catch (error: any) {
      if (error.code && error.message) {
        // Es un DomainError estructurado
        alert(error.message);
      } else {
        // Error genérico no esperado
        alert("Ocurrió un error inesperado al guardar el producto.");
      }
      console.error("Error saving:", error);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await toggleStatus(id, currentStatus);
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const addIngredient = () => {
    setCurrentProduct(prev => ({
      ...prev,
      recipeItems: [...(prev.recipeItems || []), { productId: '', quantity: 0, unit: 'KG' }]
    }));
  };

  const removeIngredient = (index: number) => {
    setCurrentProduct(prev => ({
      ...prev,
      recipeItems: prev.recipeItems?.filter((_, i) => i !== index)
    }));
  };

  const updateIngredient = (index: number, field: string, value: any) => {
    setCurrentProduct(prev => {
      const newReceta = [...(prev.recipeItems || [])];
      newReceta[index] = { ...newReceta[index], [field]: value };
      return { ...prev, recipeItems: newReceta };
    });
  };

  const getProductName = (id: string) => productos.find(p => p.id === id)?.nombre || 'Desconocido';

  const groupedProducts = {
    MERCADERIA: productos.filter(p => p.type === 'MERCADERIA'),
    INSUMO: productos.filter(p => p.type === 'INSUMO'),
    PRESENTACION: productos.filter(p => p.type === 'PRESENTACION')
  };

  if (loading) return <p>Cargando productos...</p>;

  return (
    <div className="productos-v2">
      {!isEditing ? (
        <>
          <div className="header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Catálogo de Productos</h2>
            <button 
              className="btn-primary" 
              onClick={() => { 
                setIsEditing(true); 
                setCurrentProduct({ type: 'MERCADERIA', unitType: 'KG', activo: true, recipeItems: [] }); 
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={18} /> Nuevo Producto
            </button>
          </div>

          <div className="accordion-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(['MERCADERIA', 'INSUMO', 'PRESENTACION'] as ProductType[]).map(type => (
              <div key={type} className="accordion-item" style={{ border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', background: 'white' }}>
                <div 
                  className="accordion-header" 
                  onClick={() => toggleCategory(type)}
                  style={{ display: 'flex', alignItems: 'center', padding: '15px 20px', cursor: 'pointer', background: '#f9f9f9', borderBottom: expandedCategories[type] ? '1px solid #e0e0e0' : 'none' }}
                >
                  <div className="accordion-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                    {expandedCategories[type] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <h3 style={{ margin: 0, fontSize: '16px' }}>{type === 'MERCADERIA' ? 'Mercaderías' : type === 'INSUMO' ? 'Insumos' : 'Presentaciones'}</h3>
                    <span className="badge" style={{ marginLeft: 'auto', background: '#007aff', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>
                      {groupedProducts[type].length}
                    </span>
                  </div>
                </div>
                
                {expandedCategories[type] && (
                  <div className="accordion-content" style={{ padding: '20px' }}>
                    {groupedProducts[type].length === 0 ? (
                      <p className="empty-state" style={{ color: '#888', textAlign: 'center', margin: 0 }}>No hay productos en esta categoría.</p>
                    ) : (
                      <table className="apple-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                            <th style={{ padding: '10px' }}>Nombre</th>
                            <th style={{ padding: '10px' }}>Unidad Base</th>
                            <th style={{ padding: '10px' }}>Precios (Sug / Com)</th>
                            {type === 'PRESENTACION' && <th style={{ padding: '10px' }}>Receta</th>}
                            <th style={{ padding: '10px' }}>Estado</th>
                            <th style={{ padding: '10px', textAlign: 'right' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedProducts[type].map(prod => (
                            <tr key={prod.id} style={{ borderBottom: '1px solid #eee' }}>
                              <td style={{ padding: '10px' }}><strong>{prod.nombre}</strong></td>
                              <td style={{ padding: '10px' }}>{prod.unitType}</td>
                              <td style={{ padding: '10px' }}>
                                ${prod.precioSugerido || 0} / ${prod.precioComercial || 0}
                              </td>
                              {type === 'PRESENTACION' && (
                                <td style={{ padding: '10px' }}>
                                  {prod.recipeItems && prod.recipeItems.length > 0 ? (
                                    <div className="recipe-summary" style={{ fontSize: '12px', color: '#555' }}>
                                      {prod.recipeItems.map((r, i) => (
                                        <div key={i} className="recipe-ingredient">
                                          • {r.quantity} {r.unit.toLowerCase()} de {getProductName(r.productId)}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span style={{ color: '#999', fontSize: '12px' }}>Sin receta</span>
                                  )}
                                </td>
                              )}
                              <td style={{ padding: '10px' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: prod.activo ? '#28a745' : '#dc3545' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: prod.activo ? '#28a745' : '#dc3545' }} />
                                  {prod.activo ? 'Activo' : 'Inactivo'}
                                </span>
                              </td>
                              <td style={{ padding: '10px', textAlign: 'right' }}>
                                <button className="btn-secondary" style={{ marginRight: '5px', padding: '4px 8px' }} onClick={() => { setIsEditing(true); setCurrentProduct(prod); }}>
                                  Editar
                                </button>
                                <button className="btn-danger" style={{ padding: '4px 8px' }} onClick={() => handleToggleStatus(prod.id, prod.activo)}>
                                  {prod.activo ? 'Baja' : 'Activar'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="editor-container" style={{ background: 'white', padding: '30px', borderRadius: '12px', border: '1px solid #e0e0e0', maxWidth: '800px', margin: '0 auto' }}>
          <h3 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
            {currentProduct.id ? 'Editar Producto' : 'Nuevo Producto'}
          </h3>
          <form className="apple-form" onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div className="form-group">
                <label>Nombre del Producto</label>
                <input 
                  required 
                  value={currentProduct.nombre || ''} 
                  onChange={e => setCurrentProduct({...currentProduct, nombre: e.target.value})} 
                  placeholder="Ej: Jamón Cocido"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select 
                  required 
                  value={currentProduct.type} 
                  onChange={e => setCurrentProduct({...currentProduct, type: e.target.value as ProductType})}
                  style={{ width: '100%' }}
                >
                  <option value="MERCADERIA">Mercadería</option>
                  <option value="INSUMO">Insumo</option>
                  <option value="PRESENTACION">Presentación</option>
                </select>
              </div>
              <div className="form-group">
                <label>Unidad Base</label>
                <select 
                  required 
                  value={currentProduct.unitType} 
                  onChange={e => setCurrentProduct({...currentProduct, unitType: e.target.value as UnitType})}
                  style={{ width: '100%' }}
                >
                  <option value="KG">Kilogramos</option>
                  <option value="GRAMOS">Gramos</option>
                  <option value="UNIDADES">Unidades</option>
                  <option value="FETAS">Fetas</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div className="form-group">
                <label>Precio Sugerido (Opcional)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={currentProduct.precioSugerido || ''} 
                  onChange={e => setCurrentProduct({...currentProduct, precioSugerido: Number(e.target.value)})} 
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-group">
                <label>Precio Comercial (Opcional)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={currentProduct.precioComercial || ''} 
                  onChange={e => setCurrentProduct({...currentProduct, precioComercial: Number(e.target.value)})} 
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {currentProduct.type === 'PRESENTACION' && (
              <div className="recipe-editor" style={{ background: '#f9f9f9', padding: '20px', borderRadius: '8px', border: '1px solid #eee', marginBottom: '20px' }}>
                <div className="recipe-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ margin: 0 }}>Receta Simple</h4>
                  <button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '13px' }} onClick={addIngredient}>
                    + Agregar Ingrediente
                  </button>
                </div>
                
                {(!currentProduct.recipeItems || currentProduct.recipeItems.length === 0) ? (
                  <p className="empty-state" style={{ color: '#888', margin: 0, fontSize: '14px' }}>No hay ingredientes en esta receta.</p>
                ) : (
                  <div className="ingredient-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {currentProduct.recipeItems.map((ing, idx) => (
                      <div key={idx} className="ingredient-row" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <select 
                          required 
                          value={ing.productId} 
                          onChange={e => updateIngredient(idx, 'productId', e.target.value)}
                          style={{ flex: 2 }}
                        >
                          <option value="">Seleccionar Producto...</option>
                          {productos.filter(p => p.type !== 'PRESENTACION').map(p => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                          ))}
                        </select>
                        <input 
                          required 
                          type="number" 
                          step="0.01" 
                          placeholder="Cant." 
                          value={ing.quantity || ''} 
                          onChange={e => updateIngredient(idx, 'quantity', Number(e.target.value))} 
                          style={{ flex: 1 }}
                        />
                        <select 
                          required 
                          value={ing.unit} 
                          onChange={e => updateIngredient(idx, 'unit', e.target.value as UnitType)}
                          style={{ flex: 1 }}
                        >
                          <option value="KG">KG</option>
                          <option value="GRAMOS">Gramos</option>
                          <option value="UNIDADES">Unidades</option>
                          <option value="FETAS">Fetas</option>
                        </select>
                        <button type="button" className="btn-danger" style={{ padding: '6px' }} onClick={() => removeIngredient(idx)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="form-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: '20px' }}>
              <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)}>Cancelar</button>
              <button type="submit" className="btn-primary">Guardar Producto</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
