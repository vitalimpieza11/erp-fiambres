import { useState, useMemo, useEffect } from 'react';
import { useStock } from './useStock';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import { Package, Activity, AlertCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { truncateDecimals } from '../../lib/formatters';
import { groupPresentacionesByCustomer } from '../../lib/groupByCustomer';
import { useClientesStore } from '../../store/clientesStore';

export default function Stock() {
  const { products, movements, loading, getCapacityData, registerAdjustment } = useStock();
  const { customers, fetchClientesData } = useClientesStore();

  const [activeTab, setActiveTab] = useState<'ACTUAL' | 'MOVES' | 'CAPACITY'>('ACTUAL');

  // Fetch clients for grouping
  useEffect(() => { fetchClientesData(); }, [fetchClientesData]);

  // Filters
  const [searchStock, setSearchStock] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  
  const [searchMove, setSearchMove] = useState('');
  const [moveTypeFilter, setMoveTypeFilter] = useState('');
  
  // RightPanel Adjustment
  const [showAdjPanel, setShowAdjPanel] = useState(false);
  const [adjProduct, setAdjProduct] = useState('');
  const [adjQty, setAdjQty] = useState<number>(0);
  const [adjObs, setAdjObs] = useState('');

  // Alerts
  const alertsNegativo = useMemo(() => products.filter(p => (p.stockActual || 0) < 0), [products]);
  const alertsAgotado = useMemo(() => products.filter(p => (p.stockActual || 0) === 0), [products]);
  const alertsBajo = useMemo(() => products.filter(p => (p.stockActual || 0) > 0 && (p.stockActual || 0) <= 10), [products]);

  // Filtered Stock
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.nombre.toLowerCase().includes(searchStock.toLowerCase());
      const matchType = filterType ? p.type === filterType : true;
      return matchSearch && matchType;
    });
  }, [products, searchStock, filterType]);

  const [collapsedSections, setCollapsedSections] = useState<{ [key: string]: boolean }>(() => {
    try {
      const stored = localStorage.getItem('stock_collapsed_sections');
      return stored ? JSON.parse(stored) : { MERCADERIA: false, INSUMO: false, PRESENTACION: false };
    } catch {
      return { MERCADERIA: false, INSUMO: false, PRESENTACION: false };
    }
  });

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = { ...prev, [section]: !prev[section] };
      localStorage.setItem('stock_collapsed_sections', JSON.stringify(next));
      return next;
    });
  };

  const sectionStats = useMemo(() => {
    const stats = {
      MERCADERIA: { count: 0, value: 0, items: [] as typeof products },
      INSUMO: { count: 0, value: 0, items: [] as typeof products },
      PRESENTACION: { count: 0, value: 0, items: [] as typeof products }
    };
    filteredProducts.forEach(p => {
      if (stats[p.type]) {
        stats[p.type].count += 1;
        const cost = p.costoActual || 0;
        const stock = p.stockActual || 0;
        stats[p.type].value += (stock * cost);
        stats[p.type].items.push(p);
      }
    });
    const totalValue = stats.MERCADERIA.value + stats.INSUMO.value + stats.PRESENTACION.value;
    return { ...stats, totalValue };
  }, [filteredProducts]);

  // Filtered Moves
  const filteredMoves = useMemo(() => {
    return movements
      .filter(m => {
        const prod = products.find(p => p.id === m.productId);
        const prodName = prod ? prod.nombre.toLowerCase() : '';
        const matchSearch = prodName.includes(searchMove.toLowerCase());
        
        let matchType = true;
        if (moveTypeFilter) {
          if (moveTypeFilter === 'PRODUCCION') {
            matchType = m.type === 'PRODUCCION' || m.type === 'PRODUCCION_STOCK' || m.type === 'PRODUCCION_PEDIDO';
          } else {
            matchType = m.type === moveTypeFilter;
          }
        }
        
        return matchSearch && matchType;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [movements, products, searchMove, moveTypeFilter]);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjProduct || !adjObs.trim() || adjQty === 0) {
      alert("Comlete todos los campos. La observación es obligatoria y la cantidad no puede ser 0.");
      return;
    }
    try {
      await registerAdjustment({
        productId: adjProduct,
        qty: adjQty,
        observaciones: adjObs
      });
      setShowAdjPanel(false);
      setAdjProduct('');
      setAdjQty(0);
      setAdjObs('');
    } catch (error: any) {
      alert("Error: " + error.message);
    }
  };

  if (loading) return <LoadingSpinner message="Cargando módulo de stock..." />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Stock</h1>
        <button className="btn-primary" onClick={() => setShowAdjPanel(true)}>+ Nuevo Ajuste</button>
      </div>

      {/* Alertas */}
      <div className="alerts-grid" style={{ marginBottom: '32px' }}>
        {alertsNegativo.length > 0 && (
          <div className="alert-card danger" style={{ backgroundColor: '#fee2e2', border: '1px solid #ef4444' }}>
            <div className="alert-icon"><AlertCircle size={24} color="#b91c1c" /></div>
            <div className="alert-content">
              <strong style={{ color: '#b91c1c' }}>{alertsNegativo.length} productos con STOCK NEGATIVO</strong>
              <div style={{ fontSize: '13px', color: '#991b1b' }}>
                {alertsNegativo.slice(0,3).map(p => p.nombre).join(', ')} {alertsNegativo.length > 3 && '...'}
              </div>
            </div>
          </div>
        )}
        {alertsAgotado.length > 0 && (
          <div className="alert-card danger">
            <div className="alert-icon"><AlertCircle size={24} /></div>
            <div className="alert-content">
              <strong>{alertsAgotado.length} productos sin stock</strong>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {alertsAgotado.slice(0,3).map(p => p.nombre).join(', ')} {alertsAgotado.length > 3 && '...'}
              </div>
            </div>
          </div>
        )}
        {alertsBajo.length > 0 && (
          <div className="alert-card warning">
            <div className="alert-icon"><AlertTriangle size={24} /></div>
            <div className="alert-content">
              <strong>{alertsBajo.length} productos con stock bajo</strong>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {alertsBajo.slice(0,3).map(p => p.nombre).join(', ')} {alertsBajo.length > 3 && '...'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <button 
          onClick={() => setActiveTab('ACTUAL')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', borderRadius: '24px', 
            fontWeight: 600, fontSize: '15px',
            backgroundColor: activeTab === 'ACTUAL' ? 'var(--alvacio-red)' : 'transparent',
            color: activeTab === 'ACTUAL' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Stock Actual
        </button>
        <button 
          onClick={() => setActiveTab('MOVES')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', borderRadius: '24px', 
            fontWeight: 600, fontSize: '15px',
            backgroundColor: activeTab === 'MOVES' ? 'var(--alvacio-red)' : 'transparent',
            color: activeTab === 'MOVES' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Movimientos
        </button>
        <button 
          onClick={() => setActiveTab('CAPACITY')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', borderRadius: '24px', 
            fontWeight: 600, fontSize: '15px',
            backgroundColor: activeTab === 'CAPACITY' ? 'var(--alvacio-red)' : 'transparent',
            color: activeTab === 'CAPACITY' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Rendimientos
        </button>
      </div>

      {/* Content */}
      {activeTab === 'ACTUAL' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="search-bar" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <input 
              type="text" 
              placeholder="Buscar producto..." 
              value={searchStock} 
              onChange={e => setSearchStock(e.target.value)} 
            />
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="MERCADERIA">Mercadería</option>
              <option value="INSUMO">Insumo</option>
              <option value="PRESENTACION">Terminado / Presentación</option>
            </select>
          </div>

          {/* Inventario Valorizado Total */}
          <div className="apple-card" style={{ padding: '24px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '16px' }}>
            <div>
              <span style={{ fontSize: '13px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inventario Valorizado Total</span>
              <div style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '6px', color: '#38bdf8' }}>
                ${sectionStats.totalValue.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '24px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Filtro de Ítems</span>
                <div style={{ fontSize: '18px', fontWeight: 600, marginTop: '2px' }}>{filteredProducts.length}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {['MERCADERIA', 'INSUMO', 'PRESENTACION'].map(type => {
              const sec = sectionStats[type as keyof typeof sectionStats] as { count: number; value: number; items: typeof products };
              if (filterType && filterType !== type) return null;
              const isCollapsed = collapsedSections[type];
              const title = type === 'MERCADERIA' ? 'Mercaderías' : type === 'INSUMO' ? 'Insumos' : 'Presentaciones';

              return (
                <div key={type} className="apple-card" style={{ padding: '0px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <div 
                    onClick={() => toggleSection(type)}
                    style={{ 
                      padding: '20px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      cursor: 'pointer',
                      background: '#f8fafc',
                      borderBottom: isCollapsed ? 'none' : '1px solid var(--border-color)',
                      userSelect: 'none'
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                        <span>{type === 'MERCADERIA' ? '📦' : type === 'INSUMO' ? '🧪' : '✨'}</span>
                        {title}
                      </h3>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                        Cantidad de ítems: <strong>{sec.count}</strong>
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block' }}>Valor Sección</span>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ${sec.value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                        {isCollapsed ? 'Mostrar ⬇️' : 'Ocultar ⬆️'}
                      </span>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                      {sec.items.map(p => (
                        <ExpandableCard
                          key={p.id}
                          title={p.nombre}
                          subtitle={p.type}
                          collapsedContent={
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Package size={20} color={(p.stockActual || 0) < 0 ? '#b91c1c' : (p.stockActual || 0) === 0 ? '#ef4444' : (p.stockActual || 0) <= 10 ? '#f59e0b' : '#16a34a'} />
                                <span style={{ 
                                  fontSize: '24px', 
                                  fontWeight: 'bold',
                                  color: (p.stockActual || 0) < 0 ? '#b91c1c' : (p.stockActual || 0) === 0 ? '#ef4444' : (p.stockActual || 0) <= 10 ? '#f59e0b' : '#16a34a'
                                }}>
                                  {truncateDecimals(p.stockActual || 0, 3)}
                                </span>
                                <span style={{ color: 'var(--text-secondary)' }}>{p.unitType}</span>
                              </div>
                              {(p.stockActual || 0) < 0 && (
                                <div style={{ alignSelf: 'flex-start', background: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px', border: '1px solid #fca5a5' }}>
                                  STOCK NEGATIVO
                                </div>
                              )}
                            </div>
                          }
                          expandedContent={
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Costo Actual</span>
                                <strong>${p.costoActual?.toFixed(2) || '0.00'}</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Valorización Stock</span>
                                <strong>${((p.stockActual || 0) * (p.costoActual || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                              </div>
                            </div>
                          }
                        />
                      ))}
                      {sec.items.length === 0 && (
                        <p style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1', margin: 0, textAlign: 'center', padding: '10px' }}>No hay productos en esta sección.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'MOVES' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="search-bar" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <input 
              type="text" 
              placeholder="Buscar por producto..." 
              value={searchMove} 
              onChange={e => setSearchMove(e.target.value)} 
            />
            <select value={moveTypeFilter} onChange={e => setMoveTypeFilter(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="PRODUCCION">Producción</option>
              <option value="VENTA">Venta</option>
              <option value="AJUSTE">Ajuste</option>
              <option value="COMPRA">Compra</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredMoves.slice(0, 50).map(m => {
              const p = products.find(prod => prod.id === m.productId);
              return (
                <div key={m.id} className="apple-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <Activity size={24} color={m.qty > 0 ? '#16a34a' : '#ef4444'} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '16px' }}>{p?.nombre || 'Desconocido'} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--text-secondary)', marginLeft: '8px', background: 'var(--bg-color)', padding: '2px 8px', borderRadius: '12px' }}>{m.type}</span></div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {new Date(m.date).toLocaleString()} • {m.observaciones || m.referenceId}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <strong style={{ fontSize: '20px', color: m.qty > 0 ? '#16a34a' : '#ef4444' }}>
                      {m.qty > 0 ? `+${m.qty}` : m.qty}
                    </strong>
                  </div>
                </div>
              );
            })}
            {filteredMoves.length === 0 && (
              <p style={{ color: 'var(--text-secondary)' }}>No hay movimientos.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'CAPACITY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {(() => {
            const pres = products.filter(p => p.type === 'PRESENTACION');
            const { byCustomer, loose } = groupPresentacionesByCustomer(pres, customers);

            const renderCard = (p: typeof products[number]) => {
              const cap = getCapacityData(p.id);
              return (
                <ExpandableCard
                  key={p.id}
                  title={p.nombre}
                  collapsedContent={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                      <TrendingUp size={20} color={cap.max > 0 ? "var(--alvacio-red)" : "var(--text-secondary)"} />
                      <span style={{ fontSize: '24px', fontWeight: 'bold', color: cap.max > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {cap.max}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{p.unitType}</span>
                    </div>
                  }
                  expandedContent={
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                      Limitante: <strong>{cap.limitante}</strong>
                    </div>
                  }
                />
              );
            };

            return (
              <>
                {byCustomer.map(grp => (
                  <div key={grp.customer.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid var(--border-color)' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#3b5bdb' }}>👤 {grp.customer.nombre}</span>
                      <span style={{ fontSize: '11px', background: '#dbe4ff', color: '#364fc7', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>{grp.products.length} presentación{grp.products.length !== 1 ? 'es' : ''}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                      {grp.products.map(renderCard)}
                    </div>
                  </div>
                ))}

                {loose.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px dashed #d1d5db' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>📦 Sin cliente asignado</span>
                      <span style={{ fontSize: '11px', background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>{loose.length} presentación{loose.length !== 1 ? 'es' : ''}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                      {loose.map(renderCard)}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Ajuste Manual Panel */}
      <RightPanel 
        isOpen={showAdjPanel} 
        onClose={() => setShowAdjPanel(false)} 
        title="Registrar Ajuste Manual"
      >
        <form onSubmit={handleAdjust} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '10px' }}>
            Utilice esta herramienta para compensar diferencias de inventario, mermas no registradas o ingresos anómalos.
          </p>
          <div className="form-group">
            <label>Producto</label>
            <select required value={adjProduct} onChange={e => setAdjProduct(e.target.value)}>
              <option value="">-- Seleccione un producto --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} (Actual: {truncateDecimals(p.stockActual || 0, 3)} {p.unitType})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Cantidad (Usa negativo para descontar)</label>
            <input 
              type="number" 
              step="0.01" 
              required 
              value={adjQty || ''} 
              onChange={e => setAdjQty(Number(e.target.value))} 
              placeholder="Ej: -5"
            />
          </div>
          <div className="form-group">
            <label>Observaciones (Obligatorio)</label>
            <textarea 
              required 
              value={adjObs} 
              onChange={e => setAdjObs(e.target.value)} 
              placeholder="Motivo del ajuste..."
              rows={3}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowAdjPanel(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>Registrar Ajuste</button>
          </div>
        </form>
      </RightPanel>
    </div>
  );
}
