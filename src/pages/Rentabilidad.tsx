import React from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { 
  TrendingUp, TrendingDown, Percent, ShieldAlert, Award
} from 'lucide-react';
import { formatCurrency, formatNumber } from '../utils/format';
import { usePresentaciones } from '../hooks/usePresentaciones';
import { useMercaderias } from '../hooks/useMercaderias';
import { useInsumos } from '../hooks/useInsumos';
import { useRecipes } from '../hooks/useRecipes';
import { calculatePresentationCost } from '../core/calculations';

export const Rentabilidad = () => {
  const { presentaciones, loading: loadingPres, error: errorPres } = usePresentaciones();
  const { mercaderias, loading: loadingMerc, error: errorMerc } = useMercaderias();
  const { insumos, loading: loadingIns, error: errorIns } = useInsumos();
  const { recipes, loading: loadingRec, error: errorRec } = useRecipes();

  const loading = loadingPres || loadingMerc || loadingIns || loadingRec;
  const error = errorPres || errorMerc || errorIns || errorRec;

  if (loading) {
    return <SkeletonLoader rows={4} height="60px" />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  const computedItems = presentaciones.map(pres => {
    const cost = calculatePresentationCost(pres, mercaderias, insumos, recipes);
    const weightKg = (pres.pesoObjetivoGramos || 200) / 1000;
    
    // Selling price of 1 package
    const price = pres.precioVentaKg * weightKg;
    
    // Profit per package
    const utilPack = price > 0 ? price - cost : 0;
    
    // Margin percent
    const margin = price > 0 ? (utilPack / price) * 100 : 0;
    
    // Profit per Kg
    const utilKg = weightKg > 0 ? utilPack / weightKg : 0;

    let status = 'Rentable';
    if (margin < 15) status = 'Crítico';
    else if (margin < 30) status = 'Margen Bajo';

    return {
      id: pres.id!,
      name: pres.name,
      customerName: pres.customerName || 'Todos',
      cost,
      price,
      margin,
      utilPack,
      utilKg,
      status,
      weightKg
    };
  });

  const lowMarginCount = computedItems.filter(item => item.margin > 0 && item.margin < 15).length;
  const avgMargin = computedItems.length > 0 
    ? computedItems.reduce((acc, item) => acc + item.margin, 0) / computedItems.length 
    : 0;

  const mostProfitable = [...computedItems].sort((a, b) => b.margin - a.margin)[0];
  const leastProfitable = [...computedItems].sort((a, b) => a.margin - b.margin)[0];

  const cards = [
    { title: 'Margen Promedio', value: `${formatNumber(avgMargin)} %`, icon: Percent, color: 'var(--primary-color)', bg: 'var(--primary-light)' },
    { title: 'Más Rentable', value: mostProfitable?.name || '-', icon: Award, color: '#16a34a', bg: '#dcfce7' },
    { title: 'Menos Rentable', value: leastProfitable?.name || '-', icon: TrendingDown, color: '#dc2626', bg: '#fee2e2' },
    { title: 'Bajo Margen (<15%)', value: `${lowMarginCount} Pres.`, icon: ShieldAlert, color: '#d97706', bg: '#fef3c7' }
  ];

  return (
    <>
      <PageHeader title="Análisis de Rentabilidad" description="Márgenes y utilidades reales calculadas a partir del costo dinámico de elaboración" />

      {/* Alertas Visuales */}
      {lowMarginCount > 0 && (
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fee2e2', color: '#991b1b', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca' }}>
            <ShieldAlert size={20} />
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Alerta de Margen Crítico</h4>
              <p style={{ fontSize: '0.875rem' }}>Hay {lowMarginCount} presentación(es) de venta con un margen menor al 15%.</p>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {cards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} padding="sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', backgroundColor: stat.bg, color: stat.color, borderRadius: '10px' }}>
                  <Icon size={20} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>{stat.title}</p>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stat.value}</h3>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card padding="none">
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Rentabilidad por Presentación</h3>
        </div>
        
        {computedItems.length === 0 ? (
          <EmptyState 
            icon={TrendingUp} 
            title="Sin presentaciones registradas" 
            description="Registra presentaciones de productos terminados para calcular su rentabilidad." 
          />
        ) : (
          <Table 
            data={computedItems}
            keyExtractor={(item) => item.id}
            columns={[
              { 
                header: 'Presentación', 
                accessor: (item) => (
                  <div>
                    <span style={{ display: 'block', fontWeight: 600 }}>{item.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cliente: {item.customerName}</span>
                  </div>
                ) 
              },
              { header: 'Costo Unitario', accessor: (item) => formatCurrency(item.cost), align: 'right' },
              { header: 'Precio Unitario Venta', accessor: (item) => formatCurrency(item.price), align: 'right' },
              { header: 'Utilidad x Sobre', accessor: (item) => <span style={{ fontWeight: 600, color: item.utilPack > 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(item.utilPack)}</span>, align: 'right' },
              { header: 'Utilidad x Kg', accessor: (item) => formatCurrency(item.utilKg), align: 'right' },
              { 
                header: 'Margen %', 
                accessor: (item) => (
                  <span style={{ 
                    backgroundColor: item.margin >= 30 ? '#dcfce7' : item.margin >= 15 ? '#fef3c7' : '#fee2e2',
                    color: item.margin >= 30 ? '#166534' : item.margin >= 15 ? '#92400e' : '#991b1b',
                    padding: '4px 8px', borderRadius: '4px', fontWeight: 700 
                  }}>
                    {formatNumber(item.margin)}%
                  </span>
                ),
                align: 'right' 
              },
              { 
                header: 'Estado', 
                accessor: (item) => {
                  let bg, color;
                  if (item.status === 'Rentable') { bg = '#dcfce7'; color = '#166534'; }
                  else if (item.status === 'Margen Bajo') { bg = '#fef3c7'; color = '#92400e'; }
                  else { bg = '#fee2e2'; color = '#991b1b'; }

                  return (
                    <span style={{ 
                      padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
                      backgroundColor: bg, color: color
                    }}>
                      {item.status}
                    </span>
                  )
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

export default Rentabilidad;
