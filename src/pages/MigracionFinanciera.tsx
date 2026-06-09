import React from 'react';
import { PageHeader } from '../components/EmptyState';
import { Card } from '../components/ui/Card';
import { useSocietaria } from '../hooks/useSocietaria';
import { formatCurrency } from '../utils/format';

export const MigracionFinanciera = () => {
  const { distributions, reinvestments, contributions } = useSocietaria();

  const getStats = (arr: any[]) => {
    if (!arr || arr.length === 0) return { count: 0, total: 0, minDate: '-', maxDate: '-' };
    const total = arr.reduce((sum, item) => sum + (item.amount || 0), 0);
    const dates = arr.map(item => item.date).filter(Boolean);
    const minDate = dates.length ? new Date(Math.min(...dates)).toLocaleDateString() : '-';
    const maxDate = dates.length ? new Date(Math.max(...dates)).toLocaleDateString() : '-';
    return { count: arr.length, total, minDate, maxDate };
  };

  const distStats = getStats(distributions);
  const reinvStats = getStats(reinvestments);
  const contStats = getStats(contributions);

  return (
    <>
      <PageHeader title="Migración Financiera" description="Modo Auditoría: Visualización de colecciones legacy de solo lectura." />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        <Card>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', color: '#1d4ed8' }}>partner_contributions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p><b>Cantidad de registros:</b> {contStats.count}</p>
            <p><b>Importe total:</b> {formatCurrency(contStats.total)}</p>
            <p><b>Fecha más antigua:</b> {contStats.minDate}</p>
            <p><b>Fecha más reciente:</b> {contStats.maxDate}</p>
          </div>
        </Card>
        
        <Card>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', color: '#b45309' }}>profit_distributions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p><b>Cantidad de registros:</b> {distStats.count}</p>
            <p><b>Importe total:</b> {formatCurrency(distStats.total)}</p>
            <p><b>Fecha más antigua:</b> {distStats.minDate}</p>
            <p><b>Fecha más reciente:</b> {distStats.maxDate}</p>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', color: '#16a34a' }}>reinvestments</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p><b>Cantidad de registros:</b> {reinvStats.count}</p>
            <p><b>Importe total:</b> {formatCurrency(reinvStats.total)}</p>
            <p><b>Fecha más antigua:</b> {reinvStats.minDate}</p>
            <p><b>Fecha más reciente:</b> {reinvStats.maxDate}</p>
          </div>
        </Card>
      </div>
    </>
  );
};
