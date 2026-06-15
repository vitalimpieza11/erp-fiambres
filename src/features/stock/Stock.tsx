import { useState, useMemo } from 'react';
import { useStock } from './useStock';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import { Package, Activity, AlertCircle, AlertTriangle, TrendingUp } from 'lucide-react';

import LoadingSpinner from '../../components/LoadingSpinner';

export default function Stock() {
  const { products, movements, loading, getCapacityData, registerAdjustment } = useStock();

  const [activeTab, setActiveTab] = useState<'ACTUAL' | 'MOVES' | 'CAPACITY'>('ACTUAL');

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
  const alertsAgotado = useMemo(() => products.filter(p => (p.stockActual || 0) <= 0), [products]);
  const alertsBajo = useMemo(() => products.filter(p => (p.stockActual || 0) > 0 && (p.stockActual || 0) <= 10), [products]);

  // Filtered Stock
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.nombre.toLowerCase().includes(searchStock.toLowerCase());
      const matchType = filterType ? p.type === filterType : true;
      return matchSearch && matchType;
    });
  }, [products, searchStock, filterType]);

  // Filtered Moves
  const filteredMoves = useMemo(() => {
    return movements
      .filter(m => {
        const prod = products.find(p => p.id === m.productId);
        const prodName = prod ? prod.nombre.toLowerCase() : '';
        const matchSearch = prodName.includes(searchMove.toLowerCase());
        const matchType = moveTypeFilter ? m.type === moveTypeFilter : true;
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
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {filteredProducts.map(p => (
              <ExpandableCard
                key={p.id}
                title={p.nombre}
                subtitle={p.type}
                collapsedContent={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                    <Package size={20} color={(p.stockActual || 0) <= 0 ? '#ef4444' : (p.stockActual || 0) <= 10 ? '#f59e0b' : '#16a34a'} />
                    <span style={{ 
                      fontSize: '24px', 
                      fontWeight: 'bold',
                      color: (p.stockActual || 0) <= 0 ? '#ef4444' : (p.stockActual || 0) <= 10 ? '#f59e0b' : '#16a34a'
                    }}>
                      {p.stockActual || 0}
                    </span>
                    <span style={{ color: 'var(--text-secondary)' }}>{p.unitType}</span>
                  </div>
                }
                expandedContent={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Costo Actual</span>
                    <strong>${p.costoActual?.toFixed(2) || '0.00'}</strong>
                  </div>
                }
              />
            ))}
            {filteredProducts.length === 0 && (
              <p style={{ color: 'var(--text-secondary)' }}>No hay productos en stock con esos filtros.</p>
            )}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {products.filter(p => p.type === 'PRESENTACION').map(p => {
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
          })}
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
                <option key={p.id} value={p.id}>{p.nombre} (Actual: {p.stockActual || 0} {p.unitType})</option>
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
