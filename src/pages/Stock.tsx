import React, { useState } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Search, Package, AlertTriangle, CalendarClock, History, ArrowUpRight, ArrowDownRight, ShoppingBag } from 'lucide-react';
import { useMercaderias } from '../hooks/useMercaderias';
import { useInsumos } from '../hooks/useInsumos';
import { usePresentaciones } from '../hooks/usePresentaciones';
import { useStockMovements } from '../hooks/useStockMovements';
import { usePackages } from '../hooks/usePackages';
import { useDateFilter } from '../contexts/DateFilterContext';
import { formatCurrency, formatNumber } from '../utils/format';

export const Stock = () => {
  const { mercaderias, loading: loadingMerc, error: errorMerc } = useMercaderias();
  const { insumos, loading: loadingIns, error: errorIns } = useInsumos();
  const { presentaciones, loading: loadingPres, error: errorPres } = usePresentaciones();
  const { movements, loading: loadingMovements, error: errorMovements } = useStockMovements();
  const { packages, loading: loadingPackages, error: errorPackages } = usePackages();
  const [viewHistory, setViewHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'mercaderias' | 'insumos' | 'presentaciones'>('mercaderias');
  const { filterDate } = useDateFilter();

  const globalError = errorMerc || errorIns || errorMovements || errorPres || errorPackages;
  const filteredMovements = movements.filter((m: any) => filterDate(m.date));

  if (globalError) {
    return <ErrorState message={globalError} />;
  }

  // ── Mercaderías (raw materials) ──────────────────────────────
  const mercItems = mercaderias
    .filter(m => m.isActive)
    .map(m => {
      const inMovs = movements.filter(mov => mov.productId === m.id && mov.type.toLowerCase() === 'in');
      const outMovs = movements.filter(mov => mov.productId === m.id && mov.type.toLowerCase() === 'out');
      const totalIN = inMovs.reduce((sum, mov) => sum + Math.abs(mov.quantity), 0);
      const totalOUT = outMovs.reduce((sum, mov) => sum + Math.abs(mov.quantity), 0);
      const qty = ((m as any).initialStock ?? 0) + totalIN - totalOUT;

      console.log(`[Mercadería] ${m.name}: IN=${totalIN}, OUT=${totalOUT}, Stock=${qty}`);

      const min = 10;
      let status: 'Óptimo' | 'Bajo' | 'Crítico' = 'Óptimo';
      if (qty <= 0) status = 'Crítico';
      else if (qty < min) status = 'Bajo';
      const type = (m as any).type || (m as any).tipo || (m as any).productType || 'Mercadería';
      return { id: m.id!, code: m.id!.slice(-6).toUpperCase(), name: m.name, type, available: `${qty.toFixed(2)} Kg`, min: `${min.toFixed(2)} Kg`, status, rawQty: qty, rawMin: min, availableWeight: undefined, totalCost: undefined };
    });

  // ── Insumos (supplies) ───────────────────────────────────────
  const insumoItems = insumos
    .filter(i => i.isActive)
    .map(i => {
      const inMovs = movements.filter(mov => mov.productId === i.id && mov.type.toLowerCase() === 'in');
      const outMovs = movements.filter(mov => mov.productId === i.id && mov.type.toLowerCase() === 'out');
      const totalIN = inMovs.reduce((sum, mov) => sum + Math.abs(mov.quantity), 0);
      const totalOUT = outMovs.reduce((sum, mov) => sum + Math.abs(mov.quantity), 0);
      const qty = ((i as any).initialStock ?? 0) + totalIN - totalOUT;

      console.log(`[Insumo] ${i.name}: IN=${totalIN}, OUT=${totalOUT}, Stock=${qty}`);

      const min = 50;
      let status: 'Óptimo' | 'Bajo' | 'Crítico' = 'Óptimo';
      if (qty <= 0) status = 'Crítico';
      else if (qty < min) status = 'Bajo';
      const type = (i as any).type || (i as any).tipo || (i as any).productType || 'Insumo';
      return { id: i.id!, code: i.id!.slice(-6).toUpperCase(), name: i.name, type, available: `${qty.toFixed(0)} u`, min: `${min.toFixed(0)} u`, status, rawQty: qty, rawMin: min, availableWeight: undefined, totalCost: undefined };
    });

  // ── Presentaciones (finished goods - PHYSICAL PACKAGES) ─────────────────────────
  const presItems = presentaciones
    .filter(p => p.isActive)
    .map(p => {
      const productPackages = packages.filter(pkg => pkg.productId === p.id && pkg.status === 'Disponible');
      const qty = productPackages.length;
      const totalWeight = productPackages.reduce((sum, pkg) => sum + pkg.weight, 0);
      const totalCost = productPackages.reduce((sum, pkg) => sum + pkg.cost, 0);

      const min = 5;
      let status: 'Óptimo' | 'Bajo' | 'Crítico' = 'Óptimo';
      if (qty <= 0) status = 'Crítico';
      else if (qty < min) status = 'Bajo';
      const type = 'Presentación Física';
      return { 
        id: p.id!, 
        code: p.id!.slice(-6).toUpperCase(), 
        name: p.name, 
        type, 
        available: `${qty} pq`, 
        availableWeight: `${totalWeight.toFixed(3)} Kg`,
        totalCost: formatCurrency(totalCost),
        min: `${min} pq`, 
        status, 
        rawQty: qty, 
        rawMin: min 
      };
    });

  // Active set by tab
  const activeItems = activeTab === 'mercaderias' ? mercItems : activeTab === 'insumos' ? insumoItems : presItems;
  const filteredItems = activeItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Aggregates
  const totalMercKg = mercItems.reduce((acc, i) => acc + Math.max(0, i.rawQty), 0);
  const totalInsUnits = insumoItems.reduce((acc, i) => acc + Math.max(0, i.rawQty), 0);
  const totalPresUnits = presItems.reduce((acc, i) => acc + Math.max(0, i.rawQty), 0);
  const criticalCount = [...mercItems, ...insumoItems, ...presItems].filter(i => i.status === 'Crítico' || i.status === 'Bajo').length;

  const stockStats = [
    { title: 'Mercaderías', value: `${totalMercKg.toFixed(1)} Kg`, icon: Package, trend: 'Materia prima', color: 'var(--primary-color)', bg: 'var(--primary-light)' },
    { title: 'Insumos', value: `${totalInsUnits.toFixed(0)} u`, icon: Package, trend: 'Envases y etiquetas', color: '#0ea5e9', bg: '#e0f2fe' },
    { title: 'Presentaciones', value: `${Math.round(totalPresUnits)} u`, icon: ShoppingBag, trend: 'Producto terminado', color: '#7c3aed', bg: '#ede9fe' },
    { title: 'Alertas', value: criticalCount.toString(), icon: AlertTriangle, trend: 'Stock bajo o crítico', alert: criticalCount > 0, color: '#dc2626', bg: '#fee2e2' },
  ];

  const tabConfig = [
    { id: 'mercaderias' as const, label: 'Mercaderías (MP)', color: 'var(--primary-color)' },
    { id: 'insumos' as const, label: 'Insumos', color: '#0ea5e9' },
    { id: 'presentaciones' as const, label: 'Presentaciones', color: '#7c3aed' },
  ];

  if (viewHistory) {
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <PageHeader title="Historial de Stock" description="Ledger de movimientos históricos (Event Sourcing)" />
          <button 
            onClick={() => setViewHistory(false)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Package size={18} />
            Ver Stock Disponible
          </button>
        </div>

        <Card padding="none">
          <div style={{ padding: '20px', backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Registro completo de Stock Movements</h3>
          </div>
          
          {loadingMovements ? (
            <SkeletonLoader rows={4} height="52px" />
          ) : filteredMovements.length === 0 ? (
            <div style={{ padding: '40px' }}>
              <EmptyState 
                icon={History} 
                title="Sin movimientos registrados" 
                description="Aún no se ha realizado ninguna transacción que afecte el inventario físico en este período." 
              />
            </div>
          ) : (
            <Table 
              data={filteredMovements}
              keyExtractor={(item) => item.id!}
              columns={[
                { header: 'Fecha', accessor: (item) => new Date(item.date).toLocaleString() },
                { header: 'Item de Stock', accessor: (item) => <span style={{ fontWeight: 600 }}>{item.productName}</span> },
                { 
                  header: 'Cantidad', 
                  accessor: (item) => (
                    <span style={{ fontWeight: 700, color: item.quantity > 0 ? '#16a34a' : '#dc2626' }}>
                      {item.quantity > 0 ? '+' : ''}{item.quantity.toFixed(2)}
                    </span>
                  ),
                  align: 'right'
                },
                { 
                  header: 'Tipo Mov.', 
                  accessor: (item) => (
                    <span style={{ 
                      padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                      backgroundColor: item.type === 'in' ? '#dcfce7' : '#fee2e2',
                      color: item.type === 'in' ? '#166534' : '#991b1b'
                    }}>
                      {item.type === 'in' ? 'Entrada' : 'Salida'}
                    </span>
                  ),
                  align: 'center'
                },
                { header: 'Referencia', accessor: (item) => `${item.referenceType.toUpperCase()} - ${item.referenceId || 'N/A'}` },
              ]}
            />
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <PageHeader title="Stock Multicapa" description="Inventario separado por tipo: Mercaderías · Insumos · Presentaciones" />
        <button 
          onClick={() => setViewHistory(true)}
          style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <CalendarClock size={18} />
          Historial de Movimientos
        </button>
      </div>
      
      {/* Cards de Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {stockStats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500, marginBottom: '8px' }}>{stat.title}</p>
                  <h3 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>{stat.value}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', color: (stat as any).alert ? stat.color : 'var(--text-secondary)' }}>
                    <ArrowUpRight size={16} />
                    <span style={{ fontWeight: 500 }}>{stat.trend}</span>
                  </div>
                </div>
                <div style={{ padding: '12px', backgroundColor: stat.bg, color: stat.color, borderRadius: '12px' }}>
                  <Icon size={24} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card padding="none">
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          {tabConfig.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '14px 24px',
                fontSize: '0.875rem',
                fontWeight: 600,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: activeTab === tab.id ? tab.color : 'var(--text-secondary)',
                borderBottom: activeTab === tab.id ? `3px solid ${tab.color}` : '3px solid transparent',
                transition: 'all 0.2s',
                outline: 'none',
                marginBottom: '-1px'
              }}
            >
              {tab.label}
            </button>
          ))}
          <div style={{ flex: 1, padding: '14px 20px', display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', width: '260px' }}>
              <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input 
                type="text" 
                placeholder="Buscar..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 8px 8px 32px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '0.875rem', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
        </div>

        {loadingMerc || loadingIns || loadingMovements || loadingPres || loadingPackages ? (
          <SkeletonLoader rows={5} height="52px" />
        ) : filteredItems.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState 
              icon={activeTab === 'presentaciones' ? ShoppingBag : Package} 
              title={`No hay ${activeTab === 'mercaderias' ? 'mercaderías' : activeTab === 'insumos' ? 'insumos' : 'presentaciones'} en stock`}
              description={
                activeTab === 'mercaderias' 
                  ? 'Las mercaderías son materias primas. Su stock aumenta con compras y disminuye con producción.'
                  : activeTab === 'insumos'
                  ? 'Los insumos son envases y etiquetas. Su stock se deduce automáticamente con cada pedido entregado.'
                  : 'Las presentaciones son el producto final. Su stock refleja las unidades producidas disponibles para venta.'
              }
            />
          </div>
        ) : (
          <Table 
            data={filteredItems}
            keyExtractor={(item) => item.id}
            columns={[
              { header: 'Código', accessor: 'code', width: '120px' },
              { 
                header: 'Item', 
                accessor: (item) => <span style={{ fontWeight: 600 }}>{item.name}</span> 
              },
              { 
                header: 'Tipo', 
                accessor: (item) => (
                  <span style={{ 
                    color: item.type === 'Mercadería' ? 'var(--primary-color)' : item.type === 'Insumo' ? '#0ea5e9' : '#7c3aed',
                    fontWeight: 600
                  }}>
                    {item.type}
                  </span>
                )
              },
              { 
                header: 'Disponible', 
                accessor: (item) => (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: item.rawQty <= 0 ? '#ef4444' : 'inherit' }}>{item.available}</span>
                    {item.availableWeight && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.availableWeight}</span>
                    )}
                  </div>
                ),
                align: 'right'
              },
              { 
                header: 'Costo Valorizado', 
                accessor: (item) => item.totalCost ? <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{item.totalCost}</span> : <span style={{ color: '#cbd5e1' }}>-</span>, 
                align: 'right' 
              },
              { header: 'Stock Mínimo', accessor: 'min', align: 'right' },
              { 
                header: 'Estado', 
                accessor: (item) => {
                  let bg, color, dot;
                  if (item.status === 'Óptimo') { bg = '#dcfce7'; color = '#166534'; dot = '#22c55e'; }
                  else if (item.status === 'Bajo') { bg = '#fef3c7'; color = '#92400e'; dot = '#f59e0b'; }
                  else { bg = '#fee2e2'; color = '#991b1b'; dot = '#ef4444'; }

                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: bg, color: color, padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dot }} />
                      {item.status}
                    </div>
                  );
                },
                align: 'center'
              },
            ]}
          />
        )}
      </Card>
    </>
  );
};
export default Stock;
