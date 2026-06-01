import React, { useState } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import {
  Wallet, Users, DollarSign, ShieldAlert, ArrowLeft, Activity,
  CreditCard, ArrowRight
} from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { useCustomers } from '../hooks/useCustomers';

export const CuentaCorriente = () => {
  const { customers, loading, error } = useCustomers();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (error) {
    return <ErrorState message={error} />;
  }

  // Aggregates
  const totalDeuda = customers.reduce((acc, c) => acc + Math.max(0, c.currentBalance || 0), 0);
  const morosos = customers.filter(c => (c.currentBalance || 0) > (c.creditLimit || 0) && c.creditLimit > 0);
  const activos = customers.filter(c => c.isActive);

  const stats = [
    { title: 'Clientes con CC', value: activos.length.toString(), icon: Users, color: 'var(--primary-color)', bg: 'var(--primary-light)' },
    { title: 'Deuda Total a Cobrar', value: formatCurrency(totalDeuda), icon: DollarSign, color: '#dc2626', bg: '#fee2e2' },
    { title: 'Clientes Morosos', value: morosos.length.toString(), icon: ShieldAlert, color: '#d97706', bg: '#fef3c7' },
    { title: 'Disponible en Crédito', value: formatCurrency(customers.reduce((acc, c) => acc + Math.max(0, (c.creditLimit || 0) - (c.currentBalance || 0)), 0)), icon: CreditCard, color: '#059669', bg: '#d1fae5' },
    { title: 'Al día', value: (activos.length - morosos.length).toString(), icon: Activity, color: '#4f46e5', bg: '#e0e7ff' },
  ];

  const selectedCustomer = selectedId ? customers.find(c => c.id === selectedId) : null;

  // Vista detalle de cliente
  if (selectedCustomer) {
    const deuda = selectedCustomer.currentBalance || 0;
    const limite = selectedCustomer.creditLimit || 0;
    const disponible = Math.max(0, limite - deuda);
    const esMoroso = deuda > limite && limite > 0;

    return (
      <div style={{ paddingBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setSelectedId(null)}
              className="btn btn-icon"
            >
              <ArrowLeft size={20} color="var(--text-secondary)" />
            </button>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Cuenta Corriente
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {selectedCustomer.name}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <Card padding="md" style={{ borderTop: '4px solid #d97706' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Saldo Pendiente</p>
            <h3 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#92400e', marginTop: '8px' }}>
              {formatCurrency(deuda)}
            </h3>
          </Card>
          <Card padding="md">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Límite de Crédito</p>
            <h3 style={{ fontSize: '1.875rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
              {limite > 0 ? formatCurrency(limite) : 'Sin límite'}
            </h3>
          </Card>
          <Card padding="md">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Crédito Disponible</p>
            <h3 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#166534', marginTop: '8px' }}>
              {formatCurrency(disponible)}
            </h3>
          </Card>
          <Card padding="md" style={{ backgroundColor: esMoroso ? '#fef2f2' : '#f0fdf4', border: `1px solid ${esMoroso ? '#fecaca' : '#bbf7d0'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: esMoroso ? '#991b1b' : '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Estado</p>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: esMoroso ? '#dc2626' : '#15803d', marginTop: '8px' }}>
                  {esMoroso ? 'MOROSO' : 'AL DÍA'}
                </h3>
              </div>
              <ShieldAlert size={32} color={esMoroso ? '#ef4444' : '#22c55e'} />
            </div>
          </Card>
        </div>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Wallet size={20} color="var(--primary-color)" />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Información de la Cuenta</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Email</span>
              <span style={{ fontWeight: 500 }}>{selectedCustomer.email || 'No registrado'}</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Teléfono</span>
              <span style={{ fontWeight: 500 }}>{selectedCustomer.phone || 'No registrado'}</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>CUIT</span>
              <span style={{ fontWeight: 500 }}>{selectedCustomer.cuit || 'No registrado'}</span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Días de Pago</span>
              <span style={{ fontWeight: 500 }}>{selectedCustomer.paymentTerms > 0 ? `${selectedCustomer.paymentTerms} días` : 'Contado'}</span>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>Dirección</span>
              <span style={{ fontWeight: 500 }}>{selectedCustomer.address || 'No registrado'}</span>
            </div>
          </div>
          <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#fef9c3', border: '1px solid #fde047', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.875rem', color: '#92400e', fontWeight: 600 }}>
              💡 Los movimientos históricos de cuenta corriente se registran en la sección Ventas (método de pago: Cuenta Corriente).
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <PageHeader title="Cuenta Corriente" description="Saldos y estados de crédito de clientes en tiempo real" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} padding="sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', backgroundColor: stat.bg, color: stat.color, borderRadius: '10px' }}>
                  <Icon size={20} />
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>{stat.title}</p>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</h3>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card padding="none">
        <div style={{ padding: '20px', backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Clientes con Cuenta Corriente</h3>
        </div>

        {loading ? (
          <SkeletonLoader rows={5} height="56px" />
        ) : customers.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState
              icon={Wallet}
              title="Sin cuentas corrientes registradas"
              description="Registrá clientes con crédito habilitado para ver sus saldos aquí."
            />
          </div>
        ) : (
          <Table<typeof customers[0]>
            data={customers}
            keyExtractor={(item) => item.id!}
            onRowClick={(item) => setSelectedId(item.id!)}
            columns={[
              {
                header: 'Cliente',
                accessor: (item) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.cuit || 'Sin CUIT'}</div>
                  </div>
                )
              },
              {
                header: 'Saldo Pendiente',
                accessor: (item) => (
                  <span style={{ fontWeight: 700, color: (item.currentBalance || 0) > 0 ? '#dc2626' : '#166534' }}>
                    {formatCurrency(item.currentBalance || 0)}
                  </span>
                ),
                align: 'right'
              },
              {
                header: 'Límite de Crédito',
                accessor: (item) => (
                  <span style={{ fontWeight: 500 }}>
                    {(item.creditLimit || 0) > 0 ? formatCurrency(item.creditLimit) : '—'}
                  </span>
                ),
                align: 'right'
              },
              {
                header: 'Disponible',
                accessor: (item) => {
                  const disponible = Math.max(0, (item.creditLimit || 0) - (item.currentBalance || 0));
                  return (
                    <span style={{ fontWeight: 600, color: '#166534' }}>
                      {(item.creditLimit || 0) > 0 ? formatCurrency(disponible) : '—'}
                    </span>
                  );
                },
                align: 'right'
              },
              {
                header: 'Estado',
                accessor: (item) => {
                  const esMoroso = (item.currentBalance || 0) > (item.creditLimit || 0) && (item.creditLimit || 0) > 0;
                  const bg = !item.isActive ? '#f1f5f9' : esMoroso ? '#fee2e2' : '#dcfce7';
                  const color = !item.isActive ? '#475569' : esMoroso ? '#991b1b' : '#166534';
                  const label = !item.isActive ? 'Inactivo' : esMoroso ? 'Moroso' : 'Al día';
                  return (
                    <span style={{ padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: bg, color }}>
                      {label}
                    </span>
                  );
                },
                align: 'center'
              },
              {
                header: '',
                accessor: (item) => (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedId(item.id!); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--primary-color)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
                  >
                    Ver <ArrowRight size={14} />
                  </button>
                ),
                align: 'right'
              }
            ]}
          />
        )}
      </Card>
    </>
  );
};

export default CuentaCorriente;
