import React, { useState } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { LoadingSpinner, ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Search, Filter, Package, AlertTriangle, CalendarClock, History, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { useStockMovements } from '../hooks/useStockMovements';
import { formatNumber } from '../utils/format';

export const Stock = () => {
  const { products, loading: loadingProducts, error: errorProducts } = useProducts();
  const { movements, loading: loadingMovements, error: errorMovements, productStocks } = useStockMovements();
  const [viewHistory, setViewHistory] = useState(false);

  const globalError = errorProducts || errorMovements;

  if (globalError) {
    return <ErrorState message={globalError} />;
  }

  // Combine products with live calculated stock levels
  const activeProducts = products.filter(p => p.isActive);
  const stockTableData = activeProducts.map(p => {
    const qty = productStocks[p.id!] || 0;
    const min = p.pesoHorma || 10; // Fallback min stock weight
    
    let status: 'Óptimo' | 'Bajo' | 'Crítico' = 'Óptimo';
    if (qty <= 0) status = 'Crítico';
    else if (qty < min) status = 'Bajo';

    return {
      id: p.id!,
      code: p.id!.slice(-6).toUpperCase(),
      name: p.name,
      brand: p.brand,
      available: `${qty.toFixed(2)} kg/un`,
      committed: '0.0 kg', // Committed placeholder if not supported yet
      min: `${min.toFixed(2)} kg/un`,
      status,
      rawQty: qty,
      rawMin: min
    };
  });

  // Calculate aggregates
  const totalStockKg = Object.values(productStocks).reduce((acc, val) => acc + Math.max(0, val), 0);
  const criticalProductsCount = stockTableData.filter(item => item.status === 'Crítico' || item.status === 'Bajo').length;

  const stockStats = [
    { title: 'Stock Total (Kg/Un)', value: `${totalStockKg.toFixed(2)}`, icon: Package, trend: 'En tiempo real', isUp: true, color: 'var(--primary-color)', bg: 'var(--primary-light)' },
    { title: 'Alertas de Stock', value: criticalProductsCount.toString(), icon: AlertTriangle, trend: 'Stock bajo o crítico', isUp: false, alert: criticalProductsCount > 0, color: '#dc2626', bg: '#fee2e2' },
    { title: 'Movimientos Totales', value: movements.length.toString(), icon: History, trend: 'Eventos registrados', isUp: true, color: '#059669', bg: '#d1fae5' },
    { title: 'Última Actividad', value: movements.length > 0 ? new Date(movements[0].date).toLocaleDateString() : 'Sin registros', icon: CalendarClock, trend: 'Registro de ledger', isUp: true, color: '#4f46e5', bg: '#e0e7ff' },
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
          ) : movements.length === 0 ? (
            <div style={{ padding: '40px' }}>
              <EmptyState 
                icon={History} 
                title="Sin movimientos registrados" 
                description="Aún no se ha realizado ninguna transacción que afecte el inventario físico." 
              />
            </div>
          ) : (
            <Table 
              data={movements}
              keyExtractor={(item) => item.id!}
              columns={[
                { header: 'Fecha', accessor: (item) => new Date(item.date).toLocaleString() },
                { header: 'Producto', accessor: (item) => <span style={{ fontWeight: 600 }}>{item.productName}</span> },
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
        <PageHeader title="Stock Real" description="Gestión de inventario físico y comprometido en tiempo real" />
        <button 
          onClick={() => setViewHistory(true)}
          style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <History size={18} />
          Historial de Movimientos
        </button>
      </div>
      
      {/* Cards de Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {stockStats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500, marginBottom: '8px' }}>{stat.title}</p>
                  <h3 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>{stat.value}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', color: stat.alert ? stat.color : 'var(--text-secondary)' }}>
                    {stat.isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
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
        <div style={{ padding: '20px', display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input 
              type="text" 
              placeholder="Buscar por producto o código..." 
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
            />
          </div>
        </div>

        {loadingProducts || loadingMovements ? (
          <SkeletonLoader rows={5} height="52px" />
        ) : stockTableData.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState 
              icon={Package} 
              title="No hay productos registrados" 
              description="Registra nuevos productos en el catálogo para darles seguimiento de stock." 
            />
          </div>
        ) : (
          <Table 
            data={stockTableData}
            keyExtractor={(item) => item.id}
            columns={[
              { header: 'Código', accessor: 'code', width: '120px' },
              { 
                header: 'Producto', 
                accessor: (item) => <span style={{ fontWeight: 600 }}>{item.name}</span> 
              },
              { 
                header: 'Disponible', 
                accessor: (item) => <span style={{ fontWeight: 700, fontSize: '1rem', color: item.rawQty <= 0 ? '#ef4444' : 'inherit' }}>{item.available}</span>,
                align: 'right'
              },
              { header: 'Mínimo', accessor: 'min', align: 'right' },
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
