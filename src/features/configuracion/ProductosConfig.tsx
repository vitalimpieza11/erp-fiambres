import { useState, useMemo, useEffect } from 'react';
import type { Product, ProductType, UnitType, RecipeItem, RecipeUnitType } from '../../types/domain';
import { mapRecipeUnitToUnitType, mapUnitTypeToRecipeUnit } from '../../types/domain';
import { Plus, ChevronDown, ChevronRight, Trash2, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import { useProducts } from './useProducts';
import { useRecipes } from './useRecipes';
import { useClientesStore } from '../../store/clientesStore';
import { useSettingsStore } from '../../store/settingsStore';
import { groupPresentacionesByCustomer } from '../../lib/groupByCustomer';
import { convertUnit } from '../../lib/unitConverter';

export default function ProductosConfig() {
  const { productos, loading: loadingProd, saveProduct, toggleStatus } = useProducts();
  const { recipes, loading: loadingRec, saveRecipe, getRecipeCost, getProductRecipeCost, equivalences } = useRecipes();
  const { customers, fetchClientesData } = useClientesStore();
  const { settings, fetchSettings } = useSettingsStore();

  useEffect(() => { 
    fetchClientesData(); 
    fetchSettings();
  }, [fetchClientesData, fetchSettings]);

  const getDefaultUtility = (name: string): number => {
    const n = String(name || '').toLowerCase();
    if (n.includes('trecer') && n.includes('cocido')) return 30;
    if (n.includes('crudo')) return 20;
    if (n.includes('panceta')) return 35;
    if (n.includes('combinado')) return 35;
    if (n.includes('paulina')) return 20;
    if (n.includes('cheddar')) return 25;
    if (n.includes('natural') && n.includes('cocido')) return 23;
    return 30; // Default
  };

  const getPesoRealKg = (prod: Product): number => {
    const peso = prod.pesoObjetivoKg || 1;
    if (peso > 10) {
      return peso / 1000;
    }
    return peso <= 0 ? 1 : peso;
  };

  const getFolexQty = (name: string): number => {
    const n = String(name || '').toLowerCase();
    if (n.includes('cheddar')) return 12;
    if (n.includes('combinado')) return 2;
    return 1;
  };

  const [activeTab, setActiveTab] = useState<'CATALOGO' | 'PRECIOS_SUGERIDOS'>('CATALOGO');
  const [activeSubTab, setActiveSubTab] = useState<'PRESENTACIONES' | 'COSTOS' | 'PRECIOS'>('PRESENTACIONES');
  const [expandedCostoRows, setExpandedCostoRows] = useState<Record<string, boolean>>({});
  const [sortBy, setSortBy] = useState<string>('default');
  const loading = loadingProd || loadingRec;

  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({ 
    type: 'MERCADERIA', 
    unitType: 'KG', 
    activo: true
  });
  
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [recipeExpanded, setRecipeExpanded] = useState(false);

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'MERCADERIA': true,
    'INSUMO': false,
    'PRESENTACION': false
  });

  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('vitalimpieza_expanded_customers');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const toggleCustomerAccordion = (customerId: string) => {
    setExpandedCustomers(prev => {
      const updated = { ...prev, [customerId]: !prev[customerId] };
      localStorage.setItem('vitalimpieza_expanded_customers', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const savedId = await saveProduct(currentProduct);
      
      if (currentProduct.type === 'PRESENTACION') {
        await saveRecipe({
          productId: savedId,
          productName: currentProduct.nombre,
          items: recipeItems
        });
      }

      setIsEditing(false);
      setCurrentProduct({ type: 'MERCADERIA', unitType: 'KG', activo: true });
      setRecipeItems([]);
    } catch (error: any) {
      if (error.code && error.message) {
        alert(error.message);
      } else {
        alert(error.message || "Ocurrió un error inesperado al guardar el producto.");
      }
      console.error("Error al guardar:", error);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await toggleStatus(id, currentStatus);
    } catch (error) {
      console.error("Error al cambiar estado:", error);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const addIngredient = () => {
    setRecipeItems(prev => [
      ...prev,
      { ingredientProductId: '', ingredientName: '', quantity: 0, unit: 'gramos' }
    ]);
  };

  const removeIngredient = (index: number) => {
    setRecipeItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: keyof RecipeItem, value: any) => {
    setRecipeItems(prev => {
      const newItems = [...prev];
      if (field === 'ingredientProductId') {
        const prodObj = productos.find(p => p.id === value);
        newItems[index] = {
          ...newItems[index],
          ingredientProductId: value,
          ingredientName: prodObj ? prodObj.nombre : '',
          unit: prodObj ? mapUnitTypeToRecipeUnit(prodObj.unitType) : 'gramos'
        };
      } else {
        newItems[index] = {
          ...newItems[index],
          [field]: value
        };
      }
      return newItems;
    });
  };

  const moveIngredient = (index: number, direction: 'up' | 'down') => {
    const newItems = [...recipeItems];
    if (direction === 'up' && index > 0) {
      const temp = newItems[index];
      newItems[index] = newItems[index - 1];
      newItems[index - 1] = temp;
    } else if (direction === 'down' && index < newItems.length - 1) {
      const temp = newItems[index];
      newItems[index] = newItems[index + 1];
      newItems[index + 1] = temp;
    }
    setRecipeItems(newItems);
  };

  const getProductMetrics = useMemo(() => (prod: Product) => {
    const cost = prod.type === 'PRESENTACION' ? getProductRecipeCost(prod.id) : (prod.costoActual || 0);
    const sellPrice = prod.precioComercial || 0;
    const gain = sellPrice - cost;
    const margin = sellPrice > 0 ? (gain / sellPrice) * 100 : 0;
    return { cost, sellPrice, gain, margin };
  }, [getProductRecipeCost]);

  const groupedProducts = useMemo(() => {
    const listMercaderia = productos.filter(p => p.type === 'MERCADERIA');
    const listInsumo = productos.filter(p => p.type === 'INSUMO');
    const listPresentacion = productos.filter(p => p.type === 'PRESENTACION');

    const sortList = (list: Product[]) => {
      if (sortBy === 'default') {
        return [...list].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
      }
      return [...list].sort((a, b) => {
        const metA = getProductMetrics(a);
        const metB = getProductMetrics(b);
        if (sortBy === 'margenDesc') return metB.margin - metA.margin;
        if (sortBy === 'margenAsc') return metA.margin - metB.margin;
        if (sortBy === 'gananciaDesc') return metB.gain - metA.gain;
        if (sortBy === 'gananciaAsc') return metA.gain - metB.gain;
        return 0;
      });
    };

    const sortedPresentacion = sortList(listPresentacion);
    const presentacionGroups = groupPresentacionesByCustomer(sortedPresentacion, customers);

    return {
      MERCADERIA: sortList(listMercaderia),
      INSUMO: sortList(listInsumo),
      PRESENTACION: sortedPresentacion,
      PRESENTACION_GROUPS: presentacionGroups,
    };
  }, [productos, sortBy, getProductMetrics, customers]);

  if (loading) return <p style={{ padding: '20px', textAlign: 'center', fontSize: '15px' }}>Cargando catálogo de productos y recetas...</p>;

  // Cálculo dinámico para la receta en edición
  const computedRecipeCost = getRecipeCost({ items: recipeItems } as any);

  return (
    <div className="productos-v2" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      
      {/* TABS NAVEGACIÓN */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <button 
          onClick={() => setActiveTab('CATALOGO')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', borderRadius: '24px', 
            fontWeight: 600, fontSize: '15px',
            backgroundColor: activeTab === 'CATALOGO' ? 'var(--alvacio-red)' : 'transparent',
            color: activeTab === 'CATALOGO' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Catálogo
        </button>
        <button 
          onClick={() => setActiveTab('PRECIOS_SUGERIDOS')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', borderRadius: '24px', 
            fontWeight: 600, fontSize: '15px',
            backgroundColor: activeTab === 'PRECIOS_SUGERIDOS' ? 'var(--alvacio-red)' : 'transparent',
            color: activeTab === 'PRECIOS_SUGERIDOS' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Precios Sugeridos por Kg
        </button>
      </div>

      {activeTab === 'CATALOGO' && !isEditing && (
        <>
          <div className="header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>Catálogo de Productos</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Definición de productos, insumos y recetas de producción.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ordenar por:</span>
                <select 
                  value={sortBy} 
                  onChange={e => setSortBy(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '13px', fontWeight: 500 }}
                >
                  <option value="default">Por Defecto (Nombre)</option>
                  <option value="margenDesc">Margen % (Mayor a Menor)</option>
                  <option value="margenAsc">Margen % (Menor a Mayor)</option>
                  <option value="gananciaDesc">Ganancia $ (Mayor a Menor)</option>
                  <option value="gananciaAsc">Ganancia $ (Menor a Mayor)</option>
                </select>
              </div>
              <button 
                className="btn-primary" 
                onClick={() => { 
                  setIsEditing(true); 
                  setCurrentProduct({ type: 'MERCADERIA', unitType: 'KG', activo: true }); 
                  setRecipeItems([]);
                  setRecipeExpanded(false);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '10px', fontWeight: 600 }}
              >
                <Plus size={18} /> Nuevo Producto
              </button>
            </div>
          </div>

          <div className="accordion-list" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {(['MERCADERIA', 'INSUMO', 'PRESENTACION'] as ProductType[]).map(type => (
              <div key={type} className="accordion-item" style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div 
                  className="accordion-header" 
                  onClick={() => toggleCategory(type)}
                  style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', cursor: 'pointer', background: '#f8fafc', borderBottom: expandedCategories[type] ? '1px solid var(--border-color)' : 'none', transition: 'background-color 0.2s' }}
                >
                  <div className="accordion-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                    {expandedCategories[type] ? <ChevronDown size={20} style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight size={20} style={{ color: 'var(--text-secondary)' }} />}
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {type === 'MERCADERIA' ? 'Mercaderías' : type === 'INSUMO' ? 'Insumos' : 'Presentaciones'}
                    </h3>
                    <span className="badge" style={{ marginLeft: 'auto', background: 'var(--alvacio-red-dark)', color: 'white', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                      {groupedProducts[type].length}
                    </span>
                  </div>
                </div>
                
                {expandedCategories[type] && (
                  <div className="accordion-content" style={{ padding: '24px' }}>
                    {groupedProducts[type].length === 0 ? (
                      <p className="empty-state" style={{ color: '#888', textAlign: 'center', margin: 0, padding: '20px 0' }}>No hay productos en esta categoría.</p>
                    ) : type !== 'PRESENTACION' ? (
                      // Tabla estándar para MERCADERIA e INSUMO
                      <div style={{ overflowX: 'auto' }}>
                        <table className="apple-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #edf2f7', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '13px' }}>
                              <th style={{ padding: '12px 10px', fontWeight: 600 }}>Nombre</th>
                              <th style={{ padding: '12px 10px', fontWeight: 600 }}>Unidad Base</th>
                              <th style={{ padding: '12px 10px', fontWeight: 600 }}>Costo</th>
                              <th style={{ padding: '12px 10px', fontWeight: 600 }}>Estado</th>
                              <th style={{ padding: '12px 10px', fontWeight: 600, textAlign: 'right' }}>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupedProducts[type].map(prod => {
                              const metrics = getProductMetrics(prod);
                              return (
                                <tr key={prod.id} style={{ borderBottom: '1px solid #edf2f7', transition: 'background-color 0.2s', fontSize: '14px' }}>
                                  <td style={{ padding: '14px 10px', color: 'var(--text-primary)' }}><strong>{prod.nombre}</strong></td>
                                  <td style={{ padding: '14px 10px', color: 'var(--text-secondary)' }}>{prod.unitType}</td>
                                  <td style={{ padding: '14px 10px', color: 'var(--text-primary)' }}>
                                    ${metrics.cost.toFixed(2)}
                                  </td>
                                  <td style={{ padding: '14px 10px' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, padding: '4px 8px', borderRadius: '20px', background: prod.activo ? '#e6f4ea' : '#fce8e6', color: prod.activo ? '#137333' : '#c5221f' }}>
                                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: prod.activo ? '#137333' : '#c5221f' }} />
                                      {prod.activo ? 'Activo' : 'Baja'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '14px 10px', textAlign: 'right' }}>
                                    <button className="btn-secondary" style={{ marginRight: '8px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }} onClick={() => { setIsEditing(true); setCurrentProduct(prod); setRecipeItems([]); setRecipeExpanded(false); }}>Editar</button>
                                    <button className="btn-danger" style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }} onClick={() => handleToggleStatus(prod.id, prod.activo)}>{prod.activo ? 'Baja' : 'Activar'}</button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      // Vista agrupada por cliente para PRESENTACION
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {(() => {
                          const groups = groupedProducts['PRESENTACION_GROUPS' as keyof typeof groupedProducts] as any;
                          const renderProductRow = (prod: Product) => {
                            const metrics = getProductMetrics(prod);
                            const recipe = recipes.find(r => r.productId === prod.id);
                            return (
                              <tr key={prod.id} style={{ borderBottom: '1px solid #edf2f7', transition: 'background-color 0.2s', fontSize: '14px' }}>
                                <td style={{ padding: '14px 10px', color: 'var(--text-primary)' }}><strong>{prod.nombre}</strong></td>
                                <td style={{ padding: '14px 10px', color: 'var(--text-secondary)' }}>{prod.unitType}</td>
                                <td style={{ padding: '14px 10px', color: 'var(--text-primary)' }}>
                                  <span style={{ fontWeight: 600 }}>${metrics.cost.toFixed(2)}</span>
                                  <span style={{ fontSize: '10px', color: '#16a34a', display: 'block', fontWeight: 500 }}>(Costo Receta)</span>
                                </td>
                                <td style={{ padding: '14px 10px', color: 'var(--text-secondary)' }}>${prod.precioComercial || 0}</td>
                                <td style={{ padding: '14px 10px' }}>
                                  {recipe && recipe.items && recipe.items.length > 0 ? (
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      {recipe.items.map((r, i) => (
                                        <div key={i} style={{ padding: '1px 0' }}>• {r.quantity} {r.unit} de <span style={{ color: 'var(--text-primary)' }}>{r.ingredientName}</span></div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span style={{ color: '#a0aec0', fontSize: '12px', fontStyle: 'italic' }}>Sin receta</span>
                                  )}
                                </td>
                                <td style={{ padding: '14px 10px' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, padding: '4px 8px', borderRadius: '20px', background: prod.activo ? '#e6f4ea' : '#fce8e6', color: prod.activo ? '#137333' : '#c5221f' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: prod.activo ? '#137333' : '#c5221f' }} />
                                    {prod.activo ? 'Activo' : 'Baja'}
                                  </span>
                                </td>
                                <td style={{ padding: '14px 10px', textAlign: 'right' }}>
                                  <button className="btn-secondary" style={{ marginRight: '8px', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }} onClick={() => { setIsEditing(true); setCurrentProduct(prod); const existingRecipe = recipes.find(r => r.productId === prod.id); setRecipeItems(existingRecipe ? existingRecipe.items : []); setRecipeExpanded(false); }}>Editar</button>
                                  <button className="btn-danger" style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }} onClick={() => handleToggleStatus(prod.id, prod.activo)}>{prod.activo ? 'Baja' : 'Activar'}</button>
                                </td>
                              </tr>
                            );
                          };

                          const tableHeader = (
                            <thead>
                              <tr style={{ borderBottom: '2px solid #edf2f7', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                <th style={{ padding: '12px 10px', fontWeight: 600 }}>Nombre</th>
                                <th style={{ padding: '12px 10px', fontWeight: 600 }}>Unidad Base</th>
                                <th style={{ padding: '12px 10px', fontWeight: 600 }}>Costo</th>
                                <th style={{ padding: '12px 10px', fontWeight: 600 }}>Precio Comercial</th>
                                <th style={{ padding: '12px 10px', fontWeight: 600 }}>Receta</th>
                                <th style={{ padding: '12px 10px', fontWeight: 600 }}>Estado</th>
                                <th style={{ padding: '12px 10px', fontWeight: 600, textAlign: 'right' }}>Acciones</th>
                              </tr>
                            </thead>
                          );

                           return (
                            <>
                              {/* Grupos con cliente asignado */}
                              {groups.byCustomer.map((grp: any) => {
                                const isExpanded = !!expandedCustomers[grp.customer.id];
                                return (
                                  <div key={grp.customer.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                                    <div 
                                      onClick={() => toggleCustomerAccordion(grp.customer.id)}
                                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'linear-gradient(135deg, #f0f4ff 0%, #f8f9ff 100%)', borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none', cursor: 'pointer', userSelect: 'none' }}
                                    >
                                      <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                      </span>
                                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#3b5bdb' }}>👤 {grp.customer.nombre}</span>
                                      <span style={{ fontSize: '11px', background: '#dbe4ff', color: '#364fc7', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>{grp.products.length} presentación{grp.products.length !== 1 ? 'es' : ''}</span>
                                    </div>
                                    {isExpanded && (
                                      <div style={{ overflowX: 'auto' }}>
                                        <table className="apple-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                          {tableHeader}
                                          <tbody>{grp.products.map(renderProductRow)}</tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Presentaciones sin cliente asignado */}
                              {groups.loose.length > 0 && (() => {
                                const isExpanded = !!expandedCustomers['loose'];
                                return (
                                  <div style={{ border: '1px dashed #d1d5db', borderRadius: '10px', overflow: 'hidden' }}>
                                    <div 
                                      onClick={() => toggleCustomerAccordion('loose')}
                                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: '#f9fafb', borderBottom: isExpanded ? '1px dashed #d1d5db' : 'none', cursor: 'pointer', userSelect: 'none' }}
                                    >
                                      <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                      </span>
                                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>📦 Sin cliente asignado</span>
                                      <span style={{ fontSize: '11px', background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>{groups.loose.length} presentación{groups.loose.length !== 1 ? 'es' : ''}</span>
                                    </div>
                                    {isExpanded && (
                                      <div style={{ overflowX: 'auto' }}>
                                        <table className="apple-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                          {tableHeader}
                                          <tbody>{groups.loose.map(renderProductRow)}</tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'PRECIOS_SUGERIDOS' && !isEditing && (
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          {/* Subtabs Navigation */}
          <div style={{ display: 'flex', gap: '8px', padding: '16px 24px', borderBottom: '1px solid #edf2f7', background: '#f8fafc' }}>
            <button
              type="button"
              onClick={() => setActiveSubTab('PRESENTACIONES')}
              style={{
                background: 'none', border: 'none', padding: '8px 16px', borderRadius: '24px',
                fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
                backgroundColor: activeSubTab === 'PRESENTACIONES' ? 'var(--alvacio-red)' : 'transparent',
                color: activeSubTab === 'PRESENTACIONES' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              Presentaciones
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('COSTOS')}
              style={{
                background: 'none', border: 'none', padding: '8px 16px', borderRadius: '24px',
                fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
                backgroundColor: activeSubTab === 'COSTOS' ? 'var(--alvacio-red)' : 'transparent',
                color: activeSubTab === 'COSTOS' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              Costos
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('PRECIOS')}
              style={{
                background: 'none', border: 'none', padding: '8px 16px', borderRadius: '24px',
                fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
                backgroundColor: activeSubTab === 'PRECIOS' ? 'var(--alvacio-red)' : 'transparent',
                color: activeSubTab === 'PRECIOS' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              Precios y Margen
            </button>
          </div>

          <div style={{ padding: '24px' }}>
            {activeSubTab === 'PRESENTACIONES' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="apple-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #edf2f7', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Nombre</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Estado</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Unidad</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Precio Comercial / Kg</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Utilidad Objetivo</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Merma Objetivo</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600, textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedProducts.PRESENTACION.map(prod => {
                      const util = prod.utilidadObjetivo !== undefined ? prod.utilidadObjetivo : getDefaultUtility(prod.nombre);
                      const merma = prod.mermaObjetivo !== undefined ? prod.mermaObjetivo : 5;
                      return (
                        <tr key={prod.id} style={{ borderBottom: '1px solid #edf2f7', fontSize: '14px' }}>
                          <td style={{ padding: '14px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>{prod.nombre}</td>
                          <td style={{ padding: '14px 10px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, padding: '4px 8px', borderRadius: '20px', background: prod.activo ? '#e6f4ea' : '#fce8e6', color: prod.activo ? '#137333' : '#c5221f' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: prod.activo ? '#137333' : '#c5221f' }} />
                              {prod.activo ? 'Activo' : 'Baja'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 10px', color: 'var(--text-secondary)' }}>{prod.unitType}</td>
                          <td style={{ padding: '14px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>
                            ${(prod.precioComercial || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '14px 10px', color: 'var(--text-primary)' }}>{util}%</td>
                          <td style={{ padding: '14px 10px', color: 'var(--text-primary)' }}>{merma}%</td>
                          <td style={{ padding: '14px 10px', textAlign: 'right' }}>
                            <button
                              className="btn-secondary"
                              style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}
                              onClick={() => {
                                setIsEditing(true);
                                setCurrentProduct(prod);
                                const existingRecipe = recipes.find(r => r.productId === prod.id);
                                setRecipeItems(existingRecipe ? existingRecipe.items : []);
                                setRecipeExpanded(false);
                              }}
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {groupedProducts.PRESENTACION.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No hay presentaciones configuradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeSubTab === 'COSTOS' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="apple-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #edf2f7', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      <th style={{ width: '40px' }}></th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Presentación</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Peso Objetivo</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Costo Mercadería Kg</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Packaging</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Costo Operativo Kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedProducts.PRESENTACION.map(prod => {
                      const recipe = recipes.find(r => r.productId === prod.id);
                      const pesoReal = getPesoRealKg(prod);
                      const isExpanded = !!expandedCostoRows[prod.id];

                      let comestibleCost = 0;
                      const itemsDetails = (recipe?.items || []).map(item => {
                        const ing = productos.find(p => p.id === item.ingredientProductId);
                        const cost = ing?.costoActual || 0;
                        const convertedQty = convertUnit(
                          item.quantity,
                          mapRecipeUnitToUnitType(item.unit),
                          ing?.unitType || 'KG',
                          ing?.nombre || '',
                          '',
                          equivalences
                        );
                        const subtotal = convertedQty * cost;

                        const nameLower = (ing?.nombre || item.ingredientName || '').toLowerCase();
                        const isPack = nameLower.includes('bolsa') || 
                                       nameLower.includes('etiqueta') || 
                                       nameLower.includes('folex') || 
                                       nameLower.includes('film') || 
                                       nameLower.includes('packaging');

                        if (!isPack) {
                          comestibleCost += subtotal;
                        }

                        return {
                          nombre: ing?.nombre || item.ingredientName,
                          quantity: item.quantity,
                          unit: item.unit,
                          costoUnitario: cost,
                          subtotal,
                          isPack
                        };
                      });

                      const costoMercaderiaKg = comestibleCost / pesoReal;
                      const folexQty = getFolexQty(prod.nombre);
                      const packagingCost = 550 + 0.25 + (folexQty * 7);
                      const costoOperativoKg = costoMercaderiaKg + packagingCost;

                      return (
                        <>
                          <tr key={prod.id} style={{ borderBottom: '1px solid #edf2f7', fontSize: '14px' }}>
                            <td style={{ padding: '14px 10px', textAlign: 'center' }}>
                              <button
                                type="button"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => setExpandedCostoRows(prev => ({ ...prev, [prod.id]: !prev[prod.id] }))}
                              >
                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </button>
                            </td>
                            <td style={{ padding: '14px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>{prod.nombre}</td>
                            <td style={{ padding: '14px 10px', color: 'var(--text-secondary)' }}>
                              {prod.pesoObjetivoKg || 1} Kg {prod.pesoObjetivoKg && prod.pesoObjetivoKg > 10 ? '(Autocorregido a ' + pesoReal.toFixed(3) + ' Kg)' : ''}
                            </td>
                            <td style={{ padding: '14px 10px', color: 'var(--text-primary)' }}>
                              ${costoMercaderiaKg.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '14px 10px', color: 'var(--text-primary)' }}>
                              ${packagingCost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '14px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>
                              ${costoOperativoKg.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr style={{ background: '#f8fafc' }}>
                              <td></td>
                              <td colSpan={5} style={{ padding: '16px 24px' }}>
                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: '#fff', padding: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                  <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Desglose de Costo Operativo:</h4>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                    <div>
                                      <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Ingredientes de Receta (Comestibles)</h5>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                        <thead>
                                          <tr style={{ borderBottom: '1px solid #edf2f7', textAlign: 'left', color: 'var(--text-secondary)' }}>
                                            <th style={{ padding: '6px 0' }}>Ingrediente</th>
                                            <th style={{ padding: '6px' }}>Cantidad</th>
                                            <th style={{ padding: '6px', textAlign: 'right' }}>Subtotal</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {itemsDetails.filter(it => !it.isPack).map((it, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                              <td style={{ padding: '6px 0', fontWeight: 500 }}>{it.nombre}</td>
                                              <td style={{ padding: '6px' }}>{it.quantity} {it.unit}</td>
                                              <td style={{ padding: '6px', textAlign: 'right', fontWeight: 600 }}>
                                                ${it.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                              </td>
                                            </tr>
                                          ))}
                                          {itemsDetails.filter(it => !it.isPack).length === 0 && (
                                            <tr>
                                              <td colSpan={3} style={{ padding: '8px 0', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Sin ingredientes comestibles.</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '1px solid #edf2f7', paddingLeft: '24px' }}>
                                      <h5 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Estructura Comercial Fija</h5>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span>Mercadería (Costo Receta Comestible):</span>
                                        <strong style={{ color: 'var(--text-primary)' }}>${comestibleCost.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span>Bolsa (Costo Fijo):</span>
                                        <strong>$550,00</strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span>Etiqueta (Costo Fijo):</span>
                                        <strong>$0,25</strong>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                        <span>Folex (Cantidad: {folexQty}):</span>
                                        <strong>{folexQty} x $7,00 = ${(folexQty * 7).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                                      </div>
                                      <hr style={{ border: 'none', borderTop: '1px solid #edf2f7', margin: '8px 0' }} />
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700 }}>
                                        <span>Costo Operativo Final (Paquete):</span>
                                        <span style={{ color: 'var(--alvacio-red)' }}>
                                          ${(comestibleCost + packagingCost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 700 }}>
                                        <span>Costo Operativo Final (por Kg):</span>
                                        <span style={{ color: 'var(--alvacio-red)' }}>
                                          ${costoOperativoKg.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                    {groupedProducts.PRESENTACION.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No hay presentaciones configuradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeSubTab === 'PRECIOS' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="apple-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #edf2f7', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Nombre</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Costo Base / Kg</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Precio Sugerido / Kg</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Precio Comercial / Kg</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Margen Objetivo</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Margen Real Actual</th>
                      <th style={{ padding: '12px 10px', fontWeight: 600 }}>Diferencia $</th>
                      <th style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 600 }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const items = groupedProducts.PRESENTACION.map(prod => {
                        const recipe = recipes.find(r => r.productId === prod.id);
                        const pesoReal = getPesoRealKg(prod);

                        let comestibleCost = 0;
                        if (recipe && recipe.items) {
                          recipe.items.forEach(item => {
                            const ing = productos.find(p => p.id === item.ingredientProductId);
                            const cost = ing?.costoActual || 0;
                            const convertedQty = convertUnit(
                              item.quantity,
                              mapRecipeUnitToUnitType(item.unit),
                              ing?.unitType || 'KG',
                              ing?.nombre || '',
                              '',
                              equivalences
                            );
                            const subtotal = convertedQty * cost;

                            const nameLower = (ing?.nombre || item.ingredientName || '').toLowerCase();
                            const isPack = nameLower.includes('bolsa') || 
                                           nameLower.includes('etiqueta') || 
                                           nameLower.includes('folex') || 
                                           nameLower.includes('film') || 
                                           nameLower.includes('packaging');

                            if (!isPack) {
                              comestibleCost += subtotal;
                            }
                          });
                        }

                        const costoMercaderiaKg = comestibleCost / pesoReal;
                        const folexQty = getFolexQty(prod.nombre);
                        const packagingCost = 550 + 0.25 + (folexQty * 7);
                        const costoOperativoKg = costoMercaderiaKg + packagingCost;

                        const util = prod.utilidadObjetivo !== undefined ? prod.utilidadObjetivo : getDefaultUtility(prod.nombre);
                        const merma = prod.mermaObjetivo !== undefined ? prod.mermaObjetivo : 5;
                        const denom = 1 - (merma / 100) - (util / 100);
                        const sugeridoKg = denom <= 0 ? 0 : costoOperativoKg / denom;
                        const comercial = prod.precioComercial || 0;

                        const diff = comercial - sugeridoKg;
                        const margenReal = comercial > 0 ? ((comercial - costoOperativoKg) / comercial) * 100 : 0;

                        let stateLabel = 'OK';
                        let badgeColor = '#137333';
                        let badgeBg = '#e6f4ea';
                        let rank = 2; // OK

                        if (margenReal < util) {
                          stateLabel = 'BAJO PRECIO';
                          badgeColor = '#c5221f';
                          badgeBg = '#fce8e6';
                          rank = 1;
                        } else if (margenReal > util + 10) {
                          stateLabel = 'SOBRE PRECIO';
                          badgeColor = '#b06000';
                          badgeBg = '#fef3c7';
                          rank = 3;
                        }

                        return {
                          prod,
                          costoOperativoKg,
                          sugeridoKg,
                          comercial,
                          util,
                          margenReal,
                          diff,
                          stateLabel,
                          badgeColor,
                          badgeBg,
                          rank
                        };
                      });

                      // Sort: rank ascending (BAJO PRECIO = 1, OK = 2, SOBRE PRECIO = 3)
                      items.sort((a, b) => a.rank - b.rank);

                      return items.map(({ prod, costoOperativoKg, sugeridoKg, comercial, util, margenReal, diff, stateLabel, badgeColor, badgeBg }) => (
                        <tr key={prod.id} style={{ borderBottom: '1px solid #edf2f7', fontSize: '14px' }}>
                          <td style={{ padding: '14px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>{prod.nombre}</td>
                          <td style={{ padding: '14px 10px', color: 'var(--text-primary)' }}>
                            ${costoOperativoKg.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '14px 10px', color: '#6b21a8', fontWeight: 600 }}>
                            ${sugeridoKg.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '14px 10px', color: '#1d4ed8', fontWeight: 600 }}>
                            ${comercial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '14px 10px', color: 'var(--text-secondary)' }}>
                            {util}%
                          </td>
                          <td style={{ padding: '14px 10px', color: badgeColor, fontWeight: 600 }}>
                            {margenReal.toFixed(1)}%
                          </td>
                          <td style={{ padding: '14px 10px', color: diff >= 0 ? '#137333' : '#c5221f', fontWeight: 600 }}>
                            {diff >= 0 ? '+' : ''}${diff.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '14px 10px', textAlign: 'center' }}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: badgeBg,
                              color: badgeColor
                            }}>
                              {stateLabel}
                            </span>
                          </td>
                        </tr>
                      ));
                    })()}
                    {groupedProducts.PRESENTACION.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No hay presentaciones configuradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {isEditing && (
        <div className="editor-container" style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid var(--border-color)', maxWidth: '900px', margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '24px', fontSize: '20px', fontWeight: 700, borderBottom: '1px solid #edf2f7', paddingBottom: '14px', color: 'var(--text-primary)' }}>
            {currentProduct.id ? 'Editar Producto' : 'Nuevo Producto'}
          </h3>
          <form className="apple-form" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre del Producto</label>
                <input 
                  required 
                  value={currentProduct.nombre || ''} 
                  onChange={e => setCurrentProduct({...currentProduct, nombre: e.target.value})} 
                  placeholder="Ej: Jamón Cocido Feteado"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Tipo</label>
                <select 
                  required 
                  value={currentProduct.type} 
                  onChange={e => setCurrentProduct({...currentProduct, type: e.target.value as ProductType})}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff' }}
                >
                  <option value="MERCADERIA">Mercadería</option>
                  <option value="INSUMO">Insumo</option>
                  <option value="PRESENTACION">Presentación</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Unidad Base</label>
                <select 
                  required 
                  value={currentProduct.unitType} 
                  onChange={e => setCurrentProduct({...currentProduct, unitType: e.target.value as UnitType})}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff' }}
                >
                  <option value="KG">Kilogramos</option>
                  <option value="GRAMOS">Gramos</option>
                  <option value="UNIDADES">Unidades</option>
                  <option value="FETAS">Fetas</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {currentProduct.type === 'PRESENTACION' ? 'Costo Actual (Calculado Dinámicamente)' : 'Costo Actual (Manual)'}
                </label>
                <input 
                  type="number" 
                  step="0.01" 
                  disabled={currentProduct.type === 'PRESENTACION'}
                  value={currentProduct.type === 'PRESENTACION' ? computedRecipeCost : (currentProduct.costoActual || '')} 
                  onChange={e => setCurrentProduct({...currentProduct, costoActual: Number(e.target.value)})} 
                  placeholder={currentProduct.type === 'PRESENTACION' ? 'Calculado al vuelo' : '0.00'}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: currentProduct.type === 'PRESENTACION' ? '#f8fafc' : '#fff', fontWeight: currentProduct.type === 'PRESENTACION' ? 600 : 'normal' }}
                />
              </div>
              {currentProduct.type === 'PRESENTACION' ? (
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Peso Objetivo (Kg)</label>
                  <input 
                    type="number" 
                    step="0.001" 
                    value={currentProduct.pesoObjetivoKg || ''} 
                    onChange={e => setCurrentProduct({...currentProduct, pesoObjetivoKg: Number(e.target.value)})} 
                    placeholder="Ej: 1.200"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                  />
                </div>
              ) : (
                <div className="form-group">
                  {/* Empty placeholder to keep grid layout */}
                </div>
              )}
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {currentProduct.type === 'PRESENTACION' ? 'Precio Comercial / Kg' : 'Precio Comercial'}
                </label>
                <input 
                  type="number" 
                  step="0.01" 
                  value={currentProduct.precioComercial || ''} 
                  onChange={e => setCurrentProduct({...currentProduct, precioComercial: Number(e.target.value)})} 
                  placeholder="0.00"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                />
              </div>
            </div>

            {currentProduct.type === 'MERCADERIA' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Merma por Defecto (Kg / Unidad)
                  </label>
                  <input 
                    type="number" 
                    step="0.001" 
                    value={currentProduct.mermaPorDefecto === undefined ? '' : currentProduct.mermaPorDefecto} 
                    onChange={e => setCurrentProduct({...currentProduct, mermaPorDefecto: e.target.value === '' ? undefined : Number(e.target.value)})} 
                    placeholder="0.000"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>
            )}

            {currentProduct.type === 'PRESENTACION' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Cliente Asignado (Opcional)
                  </label>
                  <select
                    value={currentProduct.clienteAsignado || ''}
                    onChange={e => setCurrentProduct({ ...currentProduct, clienteAsignado: e.target.value || undefined })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#fff' }}
                  >
                    <option value="">(Sin cliente / General)</option>
                    {customers.filter(c => c.activo).map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                    Si se asigna, esta presentación se agrupa bajo ese cliente en todas las vistas.
                  </span>
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Utilidad Objetivo (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="30"
                    value={currentProduct.utilidadObjetivo !== undefined ? currentProduct.utilidadObjetivo : ''}
                    onChange={e => setCurrentProduct({ ...currentProduct, utilidadObjetivo: e.target.value === '' ? undefined : Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Merma Objetivo (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="5"
                    value={currentProduct.mermaObjetivo !== undefined ? currentProduct.mermaObjetivo : ''}
                    onChange={e => setCurrentProduct({ ...currentProduct, mermaObjetivo: e.target.value === '' ? undefined : Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>
            )}

            {currentProduct.type === 'PRESENTACION' && (
              <div 
                className="recipe-accordion" 
                style={{ 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '12px', 
                  overflow: 'hidden', 
                  backgroundColor: '#fafbfc',
                  transition: 'box-shadow 0.2s',
                  boxShadow: recipeExpanded ? '0 4px 12px rgba(0,0,0,0.03)' : 'none'
                }}
              >
                <div 
                  className="recipe-accordion-header"
                  onClick={() => setRecipeExpanded(prev => !prev)}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '16px 20px', 
                    cursor: 'pointer', 
                    borderBottom: recipeExpanded ? '1px solid var(--border-color)' : 'none',
                    background: '#f8fafc',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={16} style={{ color: 'var(--alvacio-red-dark)' }} />
                    <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>Receta de Producción</strong>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#e2e8f0', fontWeight: 600 }}>
                      {recipeItems.length} insumos
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#16a34a', backgroundColor: '#e6f4ea', padding: '4px 10px', borderRadius: '20px' }}>
                      Costo Dinámico: ${computedRecipeCost.toFixed(2)}
                    </span>
                    {recipeExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                </div>

                {recipeExpanded && (
                  <div className="recipe-accordion-content" style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Defina los componentes requeridos para elaborar una unidad de esta presentación.
                      </span>
                      <button 
                        type="button" 
                        className="btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '8px' }} 
                        onClick={addIngredient}
                      >
                        + Agregar Ingrediente
                      </button>
                    </div>

                    {recipeItems.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 0', border: '1px dashed var(--border-color)', borderRadius: '8px', background: '#fff' }}>
                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Esta presentación no tiene ingredientes en su receta.</p>
                        <button type="button" className="btn-secondary" style={{ marginTop: '10px', padding: '4px 10px', fontSize: '13px' }} onClick={addIngredient}>
                          Crear Receta Ahora
                        </button>
                      </div>
                    ) : (
                      <div className="ingredient-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {recipeItems.map((ing, idx) => (
                          <div 
                            key={idx} 
                            className="ingredient-row" 
                            style={{ 
                              display: 'flex', 
                              gap: '10px', 
                              alignItems: 'center', 
                              backgroundColor: '#fff', 
                              padding: '10px 14px', 
                              borderRadius: '10px', 
                              border: '1px solid var(--border-color)',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                            }}
                          >
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', width: '20px', textAlign: 'center' }}>
                              {idx + 1}
                            </span>
                            
                            <select 
                              required 
                              value={ing.ingredientProductId} 
                              onChange={e => updateIngredient(idx, 'ingredientProductId', e.target.value)}
                              style={{ flex: 3, padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                            >
                              <option value="">Seleccionar Ingrediente...</option>
                              {productos.filter(p => p.type !== 'PRESENTACION').map(p => (
                                <option key={p.id} value={p.id}>{p.nombre} ({p.type})</option>
                              ))}
                            </select>
                            
                            <input 
                              required 
                              type="number" 
                              step="any" 
                              placeholder="Cant." 
                              value={ing.quantity || ''} 
                              onChange={e => updateIngredient(idx, 'quantity', Number(e.target.value))} 
                              style={{ width: '80px', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
                            />
                            
                            <select 
                              required 
                              value={ing.unit} 
                              onChange={e => updateIngredient(idx, 'unit', e.target.value as RecipeUnitType)}
                              style={{ width: '110px', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff', fontSize: '13px' }}
                            >
                              <option value="gramos">gramos</option>
                              <option value="kilogramos">kilogramos</option>
                              <option value="unidades">unidades</option>
                              <option value="fetas">fetas</option>
                            </select>

                            <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                              <button 
                                type="button" 
                                disabled={idx === 0}
                                style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', background: idx === 0 ? '#f8fafc' : '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                                onClick={() => moveIngredient(idx, 'up')}
                                title="Subir orden"
                              >
                                <ArrowUp size={14} style={{ color: idx === 0 ? '#cbd5e1' : 'var(--text-secondary)' }} />
                              </button>
                              <button 
                                type="button" 
                                disabled={idx === recipeItems.length - 1}
                                style={{ padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', background: idx === recipeItems.length - 1 ? '#f8fafc' : '#fff', cursor: idx === recipeItems.length - 1 ? 'not-allowed' : 'pointer' }}
                                onClick={() => moveIngredient(idx, 'down')}
                                title="Bajar orden"
                              >
                                <ArrowDown size={14} style={{ color: idx === recipeItems.length - 1 ? '#cbd5e1' : 'var(--text-secondary)' }} />
                              </button>
                              <button 
                                type="button" 
                                style={{ padding: '6px', border: '1px solid #fee2e2', borderRadius: '6px', background: '#fef2f2', cursor: 'pointer', display: 'flex', alignItems: 'center' }} 
                                onClick={() => removeIngredient(idx)}
                                title="Quitar ingrediente"
                              >
                                <Trash2 size={14} style={{ color: '#ef4444' }} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="form-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid #edf2f7', paddingTop: '24px' }}>
              <button type="button" className="btn-secondary" style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }} onClick={() => setIsEditing(false)}>Cancelar</button>
              <button type="submit" className="btn-primary" style={{ padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600 }}>Guardar Producto</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
