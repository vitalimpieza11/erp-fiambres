import React, { useState, useEffect } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Input, Select } from '../components/ui/Forms';
import {
  Wallet, Users, DollarSign, ShieldAlert, ArrowLeft, Activity,
  CreditCard, ArrowRight, History, Receipt, FileText, CheckSquare, Square
} from 'lucide-react';
import { formatCurrency, parseNumber } from '../utils/format';
import { useCustomers } from '../hooks/useCustomers';
import { useReceipts } from '../hooks/useReceipts';
import { useSales } from '../hooks/useSales';
import { db } from '../firebase/firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useDateFilter } from '../contexts/DateFilterContext';
import type { Sale } from '../types/database';

export const CCDetail = ({ customer, onBack }: { customer: any; onBack: () => void }) => {
  const { receipts, loading: loadingReceipts, createReceipt } = useReceipts();
  const { currentUser } = useAuth();
  const { filterDate } = useDateFilter();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [paymentConcept, setPaymentConcept] = useState('Cobro de facturas');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [pendingSales, setPendingSales] = useState<Sale[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());

  useEffect(() => {
    const q = query(
      collection(db, 'sales'), 
      where('customerId', '==', customer.id),
      where('paymentMethod', '==', 'cc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sales: Sale[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as Sale;
        if (data.status === 'PENDIENTE' || data.status === 'PARCIAL') {
          sales.push({ ...data, id: doc.id });
        }
      });
      // Sort descending by date
      sales.sort((a, b) => b.date - a.date);
      setPendingSales(sales);
      setLoadingSales(false);
    });
    
    return () => unsubscribe();
  }, [customer.id]);

  const customerReceipts = receipts.filter(r => r.customerId === customer.id && filterDate(r.date));

  const toggleSaleSelection = (saleId: string) => {
    const newSelection = new Set(selectedSales);
    if (newSelection.has(saleId)) {
      newSelection.delete(saleId);
    } else {
      newSelection.add(saleId);
    }
    setSelectedSales(newSelection);
  };

  const calculateTotalSelected = () => {
    let total = 0;
    pendingSales.forEach(s => {
      if (selectedSales.has(s.id!)) {
        total += s.saldoPendiente !== undefined ? s.saldoPendiente : s.total;
      }
    });
    return total;
  };

  useEffect(() => {
    if (isPaymentModalOpen) {
      setPaymentAmount(calculateTotalSelected().toString());
    }
  }, [selectedSales, isPaymentModalOpen]);

  const handleRegisterPayment = async () => {
    const amount = parseNumber(paymentAmount);
    if (amount <= 0) return alert('El monto debe ser mayor a 0');
    if (selectedSales.size === 0) return alert('Debe seleccionar al menos una factura para cobrar');

    setIsSubmitting(true);
    try {
      // Distribute amount to selected invoices
      let remainingAmount = amount;
      const appliedInvoices = [];
      
      // Sort selected sales by oldest first
      const sortedSelectedSales = pendingSales
        .filter(s => selectedSales.has(s.id!))
        .sort((a, b) => a.date - b.date);

      for (const sale of sortedSelectedSales) {
        if (remainingAmount <= 0) break;
        const saldo = sale.saldoPendiente !== undefined ? sale.saldoPendiente : sale.total;
        const toApply = Math.min(saldo, remainingAmount);
        appliedInvoices.push({
          saleId: sale.id!,
          invoiceNumber: sale.invoiceNumber || sale.remitoNumber || '',
          amountToApply: toApply
        });
        remainingAmount -= toApply;
      }

      await createReceipt({
        customerId: customer.id,
        customerName: customer.name,
        date: Date.now(),
        amount: amount,
        method: paymentMethod,
        observations: paymentConcept
      }, appliedInvoices);

      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setSelectedSales(new Set());
    } catch (e: any) {
      console.error(e);
      alert('Error registrando cobro: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deuda = pendingSales.reduce((acc, sale) => acc + (sale.saldoPendiente !== undefined ? sale.saldoPendiente : sale.total), 0);
  const limite = customer.creditLimit || 0;
  const disponible = Math.max(0, limite - deuda);
  const esMoroso = deuda > limite && limite > 0;

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
              Cuenta Corriente: {customer.name}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Gestión de facturas y cobranzas por comprobante
            </p>
          </div>
        </div>
        <button 
          onClick={() => setIsPaymentModalOpen(true)} 
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
            {formatCurrency(deuda)}
          </h3>
        </Card>

        <Card padding="md">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>
            Facturas Pendientes
          </p>
          <h3 style={{ fontSize: '1.875rem', fontWeight: 700, color: '#dc2626', marginTop: '8px' }}>
            {pendingSales.length}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Facturas Pendientes */}
        <Card padding="none">
          <div style={{ padding: '20px', backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} color="var(--primary-color)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Facturas Pendientes de Cobro</h3>
          </div>
          {loadingSales ? (
            <SkeletonLoader rows={4} height="52px" />
          ) : pendingSales.length === 0 ? (
            <div style={{ padding: '40px' }}>
              <EmptyState icon={FileText} title="Al día" description="El cliente no tiene facturas pendientes." />
            </div>
          ) : (
            <Table
              data={pendingSales}
              keyExtractor={(item) => item.id!}
              columns={[
                {
                  header: 'Factura',
                  accessor: (item) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.invoiceNumber || item.remitoNumber}</span>
                },
                {
                  header: 'Fecha',
                  accessor: (item) => new Date(item.date).toLocaleDateString()
                },
                {
                  header: 'Total',
                  accessor: (item) => formatCurrency(item.total),
                  align: 'right'
                },
                {
                  header: 'Saldo',
                  accessor: (item) => (
                    <span style={{ fontWeight: 700, color: '#dc2626' }}>
                      {formatCurrency(item.saldoPendiente !== undefined ? item.saldoPendiente : item.total)}
                    </span>
                  ),
                  align: 'right'
                }
              ]}
            />
          )}
        </Card>

        {/* Historial de Recibos */}
        <Card padding="none">
          <div style={{ padding: '20px', backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Receipt size={20} color="var(--primary-color)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Historial de Cobros (Recibos)</h3>
          </div>
          {loadingReceipts ? (
            <SkeletonLoader rows={4} height="52px" />
          ) : customerReceipts.length === 0 ? (
            <div style={{ padding: '40px' }}>
              <EmptyState icon={Receipt} title="Sin cobros registrados" description="Los recibos de pago aparecerán aquí." />
            </div>
          ) : (
            <Table
              data={customerReceipts}
              keyExtractor={(item) => item.id!}
              columns={[
                {
                  header: 'Fecha',
                  accessor: (item) => new Date(item.date).toLocaleDateString()
                },
                {
                  header: 'Método',
                  accessor: (item) => <span style={{ textTransform: 'capitalize' }}>{item.method}</span>
                },
                {
                  header: 'Monto',
                  accessor: (item) => <span style={{ fontWeight: 700, color: '#166534' }}>{formatCurrency(item.amount)}</span>,
                  align: 'right'
                }
              ]}
            />
          )}
        </Card>
      </div>

      {/* Modal Cobro */}
      {isPaymentModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-primary)', padding: '24px', borderRadius: '12px',
            width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px' }}>Registrar Cobro a {customer.name}</h2>
            
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Seleccionar Facturas a Pagar:</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {pendingSales.length === 0 && <p style={{ fontSize: '0.875rem', color: '#666' }}>No hay facturas pendientes.</p>}
                {pendingSales.map(sale => {
                  const isSelected = selectedSales.has(sale.id!);
                  return (
                    <div 
                      key={sale.id} 
                      onClick={() => toggleSaleSelection(sale.id!)}
                      style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                        padding: '12px', border: `1px solid ${isSelected ? '#16a34a' : '#e2e8f0'}`,
                        backgroundColor: isSelected ? '#f0fdf4' : '#fff', borderRadius: '8px', cursor: 'pointer' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isSelected ? <CheckSquare size={20} color="#16a34a" /> : <Square size={20} color="#94a3b8" />}
                        <div>
                          <div style={{ fontWeight: 600 }}>{sale.invoiceNumber || sale.remitoNumber}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{new Date(sale.date).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: '#dc2626' }}>{formatCurrency(sale.saldoPendiente !== undefined ? sale.saldoPendiente : sale.total)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total: {formatCurrency(sale.total)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Input
                  label="Monto a cobrar ($)"
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="Ej: 15000"
                  icon={<DollarSign size={16} />}
                />
                <Select
                  label="Método de Pago"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  options={[
                    { value: 'efectivo', label: 'Efectivo' },
                    { value: 'transferencia', label: 'Transferencia' },
                    { value: 'cheque', label: 'Cheque' }
                  ]}
                />
              </div>
              <Input
                label="Concepto / Observación"
                type="text"
                value={paymentConcept}
                onChange={e => setPaymentConcept(e.target.value)}
                placeholder="Ej: Cobro de facturas atrasadas"
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => { setIsPaymentModalOpen(false); setSelectedSales(new Set()); }} 
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button 
                onClick={handleRegisterPayment} 
                className="btn btn-primary"
                style={{ backgroundColor: '#166534', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                disabled={isSubmitting || selectedSales.size === 0}
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

export const CuentaCorriente = () => {
  const { customers, loading, error } = useCustomers();
  const { sales } = useSales();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (error) return <ErrorState message={error} />;

  const selectedCustomer = selectedId ? customers.find(c => c.id === selectedId) : null;

  if (selectedCustomer) {
    return <CCDetail customer={selectedCustomer} onBack={() => setSelectedId(null)} />;
  }

  const getCustomerDebt = (customerId: string) => {
    return sales
      .filter(s => s.customerId === customerId && s.paymentMethod === 'cc' && (s.status === 'PENDIENTE' || s.status === 'PARCIAL'))
      .reduce((acc, sale) => acc + (sale.saldoPendiente !== undefined ? sale.saldoPendiente : sale.total), 0);
  };

  const totalDeuda = customers.reduce((acc, c) => acc + Math.max(0, getCustomerDebt(c.id!)), 0);
  const morosos = customers.filter(c => getCustomerDebt(c.id!) > (c.creditLimit || 0) && c.creditLimit > 0);
  const activos = customers.filter(c => c.isActive);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <PageHeader title="Cuenta Corriente" description="Facturas pendientes, cobranzas por comprobante y estados de crédito" />
      </div>

      <Card padding="none">
        <div style={{ padding: '20px', backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Cuentas Corrientes por Cliente</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Seleccioná un cliente para conciliar facturas y registrar recibos
          </p>
        </div>

        {loading ? (
          <SkeletonLoader rows={5} height="56px" />
        ) : customers.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState icon={Wallet} title="Sin cuentas" description="Registrá clientes con crédito habilitado." />
          </div>
        ) : (
          <Table
            data={customers}
            keyExtractor={(item) => item.id!}
            onRowClick={(item) => setSelectedId(item.id!)}
            columns={[
              {
                header: 'Cliente',
                accessor: (item) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                  </div>
                )
              },
              {
                header: 'Deuda Total',
                accessor: (item) => {
                  const debt = getCustomerDebt(item.id!);
                  return (
                    <span style={{ fontWeight: 700, color: debt > 0 ? '#dc2626' : '#166534' }}>
                      {formatCurrency(debt)}
                    </span>
                  );
                },
                align: 'right'
              },
              {
                header: 'Límite',
                accessor: (item) => (
                  <span style={{ fontWeight: 500 }}>
                    {(item.creditLimit || 0) > 0 ? formatCurrency(item.creditLimit) : '—'}
                  </span>
                ),
                align: 'right'
              },
              {
                header: 'Acciones',
                accessor: (item) => (
                  <button onClick={(e) => { e.stopPropagation(); setSelectedId(item.id!); }} style={{ background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, cursor: 'pointer' }}>
                    Ver Facturas <ArrowRight size={14} style={{ verticalAlign: 'middle' }} />
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
