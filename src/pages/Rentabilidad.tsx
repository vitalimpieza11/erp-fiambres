import React, { useState } from 'react';
import { PageHeader } from '../components/EmptyState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Input } from '../components/ui/Forms';
import { 
  TrendingUp, TrendingDown, DollarSign, Percent, AlertTriangle, Scale, ShieldAlert, Award
} from 'lucide-react';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';

const initialRentabilidad = [
  { id: 1, product: 'Jamón Cocido Paladini', brand: 'Paladini', cost: 8500, comp: 12500, priceStr: '12000', gramaje: 200 },
  { id: 2, product: 'Queso Tybo La Paulina', brand: 'La Paulina', cost: 6000, comp: 7000, priceStr: '6800', gramaje: 150 },
  { id: 3, product: 'Salame Milán Cagnoli', brand: 'Cagnoli', cost: 12000, comp: 15500, priceStr: '16000', gramaje: 100 },
];

export const Rentabilidad = () => {
  const [items, setItems] = useState(initialRentabilidad);

  const updatePrice = (id: number, val: string) => {
    setItems(items.map(item => item.id === id ? { ...item, priceStr: val } : item));
  };

  const computedItems = items.map(item => {
    const price = parseNumber(item.priceStr);
    const utilKg = price > 0 ? price - item.cost : 0;
    const margin = price > 0 ? (utilKg / price) * 100 : 0;
    const utilPack = utilKg * (item.gramaje / 1000);
    const diff = price - item.comp;
    
    let status = 'Rentable';
    if (margin < 15) status = 'Riesgo';
    else if (margin < 30) status = 'Margen Bajo';

    return {
      ...item,
      price,
      utilKg,
      margin,
      utilPack,
      diff,
      status
    };
  });

  const lowMarginCount = computedItems.filter(item => item.margin > 0 && item.margin < 15).length;
  const avgMargin = computedItems.reduce((acc, item) => acc + item.margin, 0) / (computedItems.length || 1);
  const mostProfitable = [...computedItems].sort((a, b) => b.margin - a.margin)[0];
  const leastProfitable = [...computedItems].sort((a, b) => a.margin - b.margin)[0];
  const avgDiff = computedItems.reduce((acc, item) => acc + (item.price > 0 ? ((item.price - item.comp)/item.comp)*100 : 0), 0) / (computedItems.length || 1);

  const cards = [
    { title: 'Margen Promedio', value: `${formatNumber(avgMargin)} %`, icon: Percent, color: 'var(--primary-color)', bg: 'var(--primary-light)' },
    { title: 'Producto Más Rentable', value: mostProfitable?.product || '-', icon: Award, color: '#16a34a', bg: '#dcfce7' },
    { title: 'Menos Rentable', value: leastProfitable?.product || '-', icon: TrendingDown, color: '#dc2626', bg: '#fee2e2' },
    { title: 'Bajo Margen (<15%)', value: `${lowMarginCount} Prod.`, icon: ShieldAlert, color: '#d97706', bg: '#fef3c7' },
    { title: 'Diff. Vs Competencia', value: `${formatNumber(avgDiff)} %`, icon: Scale, color: '#4f46e5', bg: '#e0e7ff' },
  ];

  return (
    <>
      <PageHeader title="Análisis de Rentabilidad" description="Márgenes, utilidades reales y comparativa de mercado" />

      {/* Alertas Visuales */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        {lowMarginCount > 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fee2e2', color: '#991b1b', padding: '16px', borderRadius: '8px', border: '1px solid #fecaca' }}>
            <ShieldAlert size={20} />
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Alerta Crítica</h4>
              <p style={{ fontSize: '0.875rem' }}>Hay {lowMarginCount} producto(s) con margen menor al 15%.</p>
            </div>
          </div>
        )}
        {computedItems.some(item => item.price > item.comp) && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#fef3c7', color: '#92400e', padding: '16px', borderRadius: '8px', border: '1px solid #fde68a' }}>
            <AlertTriangle size={20} />
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Desventaja Competitiva</h4>
              <p style={{ fontSize: '0.875rem' }}>Algunos productos están más caros que la competencia.</p>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
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
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Tabla Maestra de Productos Rentables</h3>
        </div>
        <Table 
          data={computedItems}
          keyExtractor={(item) => item.id.toString()}
          columns={[
            { 
              header: 'Producto', 
              accessor: (item) => (
                <div>
                  <span style={{ display: 'block', fontWeight: 600 }}>{item.product}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.brand}</span>
                </div>
              ) 
            },
            { header: 'Costo Real /Kg', accessor: (item) => formatCurrency(item.cost), align: 'right' },
            { 
              header: 'Precio Venta', 
              accessor: (item) => (
                <div style={{ width: '100px', margin: '0 0 0 auto' }}>
                  <Input label="" type="number" value={item.priceStr} onChange={(e) => updatePrice(item.id, e.target.value)} style={{ textAlign: 'right', padding: '6px' }} />
                </div>
              ),
              align: 'right' 
            },
            { header: 'Competencia', accessor: (item) => formatCurrency(item.comp), align: 'right' },
            { 
              header: 'Diferencia', 
              accessor: (item) => (
                <span style={{ color: item.diff <= 0 ? '#166534' : '#dc2626', fontWeight: 600 }}>
                  {item.diff > 0 ? '+' : ''}{formatCurrency(item.diff)}
                </span>
              ),
              align: 'right' 
            },
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
            { header: 'Util. x Paq', accessor: (item) => formatCurrency(item.utilPack), align: 'right' },
            { header: 'Util. x Kg', accessor: (item) => formatCurrency(item.utilKg), align: 'right' },
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
      </Card>
    </>
  );
};
