import React, { useState } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import {
  Wallet, Users, DollarSign, ShieldAlert, ArrowLeft, Activity,
  CreditCard, ArrowRight, History, TrendingDown, TrendingUp
} from 'lucide-react';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { useCustomers } from '../hooks/useCustomers';
import { useCCMovements } from '../hooks/useCCMovements';
import { db } from '../firebase/firebase';
import { doc, collection, runTransaction } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '../components/ui/Forms';
import { useDateFilter } from '../contexts/DateFilterContext';

// ─── Vista detalle de un cliente ────────────────────────────────────────────
export const CCDetail = ({ customer, onBack }: { customer: any; onBack: () => void }) => {
  const { movements, loading: loadingMovs } = useCCMovements(customer.id);
  const { currentUser } = useAuth();
  const { filterDate } = useDateFilter();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentConcept, setPaymentConcept] = useState('Cobro en cuenta corriente');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredMovements = movements.filter((m: any) => filterDate(m.date));

  const handleRegisterPayment = async () => {
    console.log('COBRO STEP 3: submit del formulario / inicio de handleRegisterPayment');
    const amount = parseNumber(paymentAmount);
    console.log('COBRO INFO: monto ingresado =', amount, 'customer.id =', customer.id);
    if (amount <= 0) {
      console.log('COBRO ABORT: monto <= 0');
      return alert('El monto debe ser mayor a 0');
    }
    setIsSubmitting(true);
    try {
      const customerRef = doc(db, 'customers', customer.id);
      const paymentRef = doc(collection(db, 'cc_payments'));
      
      console.log('COBRO STEP 4: antes de runTransaction');
      await runTransaction(db, async (transaction) => {
        console.log('COBRO STEP 4.1: dentro de runTransaction, leyendo customerRef');
        const custSnap = await transaction.get(customerRef);
        if (!custSnap.exists()) {
          console.log('COBRO ABORT: Cliente no encontrado en BD');
          throw new Error('Cliente no encontrado');
        }
        
        const currentBalance = custSnap.data().currentBalance || 0;
        const newBalance = currentBalance - amount;
        console.log('COBRO INFO: saldo actual =', currentBalance, '| saldo nuevo =', newBalance);
        
        console.log('COBRO STEP 4.2: actualizando customerRef');
        transaction.update(customerRef, {
          currentBalance: newBalance,
          updatedAt: Date.now()
        });
        
        console.log('COBRO STEP 4.3: creando registro de pago en paymentRef');
        transaction.set(paymentRef, {
          customerId: customer.id,
          date: Date.now(),
          amount: amount,
          concept: paymentConcept,
          referenceNumber: `COB-${String(Date.now()).slice(-6)}`,
          userId: currentUser?.uid || 'anonymous',
          createdAt: Date.now()
        });
      });
      console.log('COBRO STEP 5: después de runTransaction (éxito)');
      
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentConcept('Cobro en cuenta corriente');
      console.log('COBRO STEP 6: estados reseteados, fin del flujo');
    } catch (e: any) {
      console.error('COBRO STEP 7 (ERROR): catch(error)');
      console.error('COBRO ERROR DETAIL:', {
        code: e?.code,
        message: e?.message,
        stack: e?.stack,
        fullError: e
      });
      alert('Error registrando cobro: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deuda = customer.currentBalance || 0;
  const limite = customer.creditLimit || 0;
  const disponible = Math.max(0, limite - deuda);
  const esMoroso = deuda > limite && limite > 0;

  // Totales del historial
  const totalVentas = filteredMovements.reduce((acc, m) => acc + m.debe, 0);
  const totalCobros = filteredMovements.reduce((acc, m) => acc + m.haber, 0);

  // Saldo calculado desde el historial (más confiable que currentBalance en escenarios mixtos)
  const saldoCalculado = filteredMovements.length > 0 ? filteredMovements[0].saldo : deuda;

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={onBack} className="btn btn-icon">
            <ArrowLeft size={20} color="var(--text-secondary)" />
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Cuenta Corriente
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {customer.name}
              {customer.cuit ? ` · CUIT: ${customer.cuit}` : ''}
            </p>
          </div>
        </div>
        <button 
          onClick={() => {
            console.log('COBRO STEP 1: click del botón Registrar Cobro');
            setIsPaymentModalOpen(true);
            console.log('COBRO STEP 2: apertura del modal');
          }} 

          className="btn btn-primary"
          style={{ backgroundColor: '#166534', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
        >
          <DollarSign size={18} />
          Registrar Cobro
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <Card padding="md" style={{ borderTop: '4px solid #d97706' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Saldo Pendiente
          </p>
          <h3 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#92400e', marginTop: '8px' }}>
            {formatCurrency(saldoCalculado)}
          </h3>
        </Card>

        <Card padding="md">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Ventas CC
          </p>
          <h3 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#dc2626', marginTop: '8px' }}>
            {formatCurrency(totalVentas)}
          </h3>
        </Card>

        <Card padding="md">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Cobros
          </p>
          <h3 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#166534', marginTop: '8px' }}>
            {formatCurrency(totalCobros)}
          </h3>
        </Card>

        <Card padding="md" style={{
          backgroundColor: esMoroso ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${esMoroso ? '#fecaca' : '#bbf7d0'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: esMoroso ? '#991b1b' : '#166534', fontWeight: 600, textTransform: 'uppercase' }}>
                Estado
              </p>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: esMoroso ? '#dc2626' : '#15803d', marginTop: '8px' }}>
                {esMoroso ? 'MOROSO' : 'AL DÍA'}
              </h3>
              {limite > 0 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Límite: {formatCurrency(limite)} · Disponible: {formatCurrency(disponible)}
                </p>
              )}
            </div>
            <ShieldAlert size={28} color={esMoroso ? '#ef4444' : '#22c55e'} />
          </div>
        </Card>
      </div>

      {/* Historial de movimientos */}
      <Card padding="none">
        <div style={{
          padding: '20px',
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <History size={20} color="var(--primary-color)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
            Historial de Movimientos en Cuenta Corriente
          </h3>
        </div>

        {loadingMovs ? (
          <SkeletonLoader rows={4} height="52px" />
        ) : filteredMovements.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState
              icon={History}
              title="Sin movimientos registrados"
              description="Las ventas registradas con método de pago 'Cuenta Corriente' en este período aparecerán aquí."
            />
          </div>
        ) : (
          <Table<typeof movements[0]>
            data={filteredMovements}
            keyExtractor={(item) => item.id}
            columns={[
              {
                header: 'Fecha',
                accessor: (item) => (
                  <span style={{ fontSize: '0.875rem' }}>
                    {new Date(item.date).toLocaleDateString('es-AR')}
                  </span>
                )
              },
              {
                header: 'Comprobante',
                accessor: (item) => (
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.875rem' }}>
                    {item.comprobante}
                  </span>
                )
              },
              {
                header: 'Concepto',
                accessor: (item) => (
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{item.concepto}</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        backgroundColor: item.type === 'venta' ? '#fef3c7' : '#dcfce7',
                        color: item.type === 'venta' ? '#92400e' : '#166534'
                      }}>
                        {item.type === 'venta' ? 'Venta' : 'Cobro'}
                      </span>
                    </div>
                  </div>
                )
              },
              {
                header: 'Venta (Debe)',
                accessor: (item) => (
                  <span style={{ fontWeight: 600, color: item.debe > 0 ? '#dc2626' : 'var(--text-secondary)' }}>
                    {item.debe > 0 ? formatCurrency(item.debe) : '—'}
                  </span>
                ),
                align: 'right'
              },
              {
                header: 'Cobro (Haber)',
                accessor: (item) => (
                  <span style={{ fontWeight: 600, color: item.haber > 0 ? '#166534' : 'var(--text-secondary)' }}>
                    {item.haber > 0 ? formatCurrency(item.haber) : '—'}
                  </span>
                ),
                align: 'right'
              },
              {
                header: 'Saldo',
                accessor: (item) => (
                  <span style={{
                    fontWeight: 700,
                    color: item.saldo > 0 ? '#92400e' : item.saldo < 0 ? '#166534' : 'var(--text-secondary)'
                  }}>
                    {formatCurrency(item.saldo)}
                  </span>
                ),
                align: 'right'
              }
            ]}
          />
        )}
      </Card>

      {/* Modal Cobro */}
      {isPaymentModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)', padding: '24px', borderRadius: '12px',
            width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>Registrar Cobro</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <Input
                label="Monto a cobrar ($)"
                type="number"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder="Ej: 15000"
                icon={<DollarSign size={16} />}
              />
              <Input
                label="Concepto / Observación"
                type="text"
                value={paymentConcept}
                onChange={e => setPaymentConcept(e.target.value)}
                placeholder="Ej: Pago en efectivo"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => setIsPaymentModalOpen(false)} 
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button 
                onClick={handleRegisterPayment} 
                className="btn btn-primary"
                style={{ backgroundColor: '#166534', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Guardando...' : 'Confirmar Cobro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Vista principal (lista de clientes) ────────────────────────────────────
export const CuentaCorriente = () => {
  const { customers, loading, error } = useCustomers();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (error) {
    return <ErrorState message={error} />;
  }

  const selectedCustomer = selectedId ? customers.find(c => c.id === selectedId) : null;

  if (selectedCustomer) {
    return <CCDetail customer={selectedCustomer} onBack={() => setSelectedId(null)} />;
  }

  // Aggregates para KPIs
  const totalDeuda = customers.reduce((acc, c) => acc + Math.max(0, c.currentBalance || 0), 0);
  const morosos = customers.filter(c => (c.currentBalance || 0) > (c.creditLimit || 0) && c.creditLimit > 0);
  const activos = customers.filter(c => c.isActive);
  const creditoDisponible = customers.reduce((acc, c) => acc + Math.max(0, (c.creditLimit || 0) - (c.currentBalance || 0)), 0);

  const stats = [
    { title: 'Clientes con CC', value: activos.length.toString(), icon: Users, color: 'var(--primary-color)', bg: 'var(--primary-light)' },
    { title: 'Deuda Total a Cobrar', value: formatCurrency(totalDeuda), icon: DollarSign, color: '#dc2626', bg: '#fee2e2' },
    { title: 'Clientes Morosos', value: morosos.length.toString(), icon: ShieldAlert, color: '#d97706', bg: '#fef3c7' },
    { title: 'Crédito Disponible', value: formatCurrency(creditoDisponible), icon: CreditCard, color: '#059669', bg: '#d1fae5' },
    { title: 'Al día', value: (activos.length - morosos.length).toString(), icon: Activity, color: '#4f46e5', bg: '#e0e7ff' },
  ];

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
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                    {stat.title}
                  </p>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {stat.value}
                  </h3>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card padding="none">
        <div style={{
          padding: '20px',
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Clientes con Cuenta Corriente</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Hacé click en un cliente para ver su historial completo de movimientos
          </p>
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
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {item.cuit || 'Sin CUIT'}
                      {item.phone ? ` · ${item.phone}` : ''}
                    </div>
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
                header: 'Días de Pago',
                accessor: (item) => (
                  <span style={{ fontSize: '0.875rem' }}>
                    {item.paymentTerms > 0 ? `${item.paymentTerms} días` : 'Contado'}
                  </span>
                ),
                align: 'center'
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
                    Ver historial <ArrowRight size={14} />
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
