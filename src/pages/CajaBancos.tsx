import React, { useState } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { LoadingSpinner, ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Input, Select } from '../components/ui/Forms';
import { 
  Landmark, Wallet, Search, Filter, Plus, ArrowLeft, Save, 
  ArrowUpRight, ArrowDownRight, Activity, Receipt, Loader2
} from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { useCashMovements } from '../hooks/useCashMovements';

export const CajaBancos = () => {
  const { movements, loading, error, createMovement, stats } = useCashMovements();

  if (error) {
    return <ErrorState message={error} />;
  }


  const [isCreating, setIsCreating] = useState(false);
  const [tipoMovimiento, setTipoMovimiento] = useState<'in' | 'out'>('in');

  // Form States
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [categoria, setCategoria] = useState('venta');
  const [medioPago, setMedioPago] = useState<'cash' | 'transfer' | 'cheque'>('cash');
  const [montoStr, setMontoStr] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [comprobanteRef, setComprobanteRef] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegisterMovement = async () => {
    const monto = Math.abs(parseFloat(montoStr));
    if (isNaN(monto) || monto <= 0) {
      setErrorMessage("Debe ingresar un monto válido y mayor a cero.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      await createMovement({
        type: tipoMovimiento,
        amount: tipoMovimiento === 'in' ? monto : -monto,
        method: medioPago,
        description: observaciones || 'Movimiento de Caja',
        category: categoria,
        referenceId: comprobanteRef || '',
        date: new Date(fecha).getTime()
      });

      setIsCreating(false);
      setMontoStr('');
      setObservaciones('');
      setComprobanteRef('');
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "Error al registrar movimiento.");
    } finally {
      setIsSaving(false);
    }
  };

  const topCards = [
    { title: 'Saldo Caja (Físico)', value: formatCurrency(stats.balanceCaja), icon: Wallet, color: '#16a34a', bg: '#dcfce7' },
    { title: 'Saldo Bancos', value: formatCurrency(stats.balanceBancos), icon: Landmark, color: '#2563eb', bg: '#dbeafe' },
    { title: 'Ingresos del Día', value: formatCurrency(stats.ingresosDia), icon: ArrowUpRight, color: '#059669', bg: '#d1fae5' },
    { title: 'Egresos del Día', value: formatCurrency(stats.egresosDia), icon: ArrowDownRight, color: '#dc2626', bg: '#fee2e2' },
    { title: 'Resultado Neto', value: formatCurrency(stats.resultadoNeto), icon: Activity, color: '#4f46e5', bg: '#e0e7ff' },
  ];

  if (isCreating) {
    return (
      <div style={{ paddingBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={() => setIsCreating(false)}
              className="btn btn-icon"
            >
              <ArrowLeft size={20} color="var(--text-secondary)" />
            </button>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Nuevo Movimiento</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Registro manual de ingresos y egresos de caja o banco</p>
            </div>
          </div>
          <button onClick={handleRegisterMovement} disabled={isSaving} className="btn btn-primary">
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Registrar Movimiento
          </button>
        </div>

        {errorMessage && (
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', padding: '16px', borderRadius: '12px', color: '#dc2626', marginBottom: '24px', fontWeight: 600 }}>
            <span>{errorMessage}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', maxWidth: '800px', margin: '0 auto' }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <Receipt size={20} color="var(--primary-color)" />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Detalle de la Operación</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Tipo de Operación</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => setTipoMovimiento('in')}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: tipoMovimiento === 'in' ? '2px solid #16a34a' : '1px solid var(--border-color)', backgroundColor: tipoMovimiento === 'in' ? '#f0fdf4' : '#fff', color: tipoMovimiento === 'in' ? '#166534' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Ingreso
                  </button>
                  <button 
                    onClick={() => setTipoMovimiento('out')}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: tipoMovimiento === 'out' ? '2px solid #dc2626' : '1px solid var(--border-color)', backgroundColor: tipoMovimiento === 'out' ? '#fef2f2' : '#fff', color: tipoMovimiento === 'out' ? '#991b1b' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Egreso
                  </button>
                </div>
              </div>

              <Select label="Categoría" value={categoria} onChange={e => setCategoria(e.target.value)} options={[
                { value: 'venta', label: 'Venta' },
                { value: 'proveedor', label: 'Pago a Proveedor' },
                { value: 'combustible', label: 'Combustible / Logística' },
                { value: 'sueldo', label: 'Sueldos / Adelantos' },
                { value: 'gastos', label: 'Gastos Generales' },
                { value: 'retiro', label: 'Retiro de Socios' },
                { value: 'otros', label: 'Otros' }
              ]} />
              
              <Select label="Medio de Pago / Destino" value={medioPago} onChange={e => setMedioPago(e.target.value as any)} options={[
                { value: 'cash', label: 'Efectivo (Caja)' },
                { value: 'transfer', label: 'Transferencia Bancaria' },
                { value: 'cheque', label: 'Cheque' }
              ]} />
              
              <div style={{ gridColumn: '1 / -1' }}>
                <Input label="Monto del Movimiento ($)" type="number" placeholder="Ej: 45000" value={montoStr} onChange={e => setMontoStr(e.target.value)} style={{ fontSize: '1.25rem', fontWeight: 700 }} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <Input label="Observaciones / Concepto" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Motivo o detalle de la operación..." />
              </div>
              
              <div style={{ gridColumn: '1 / -1' }}>
                <Input label="Comprobante de Referencia" value={comprobanteRef} onChange={e => setComprobanteRef(e.target.value)} placeholder="Nº de remito, factura o recibo interno (Opcional)" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <PageHeader title="Caja y Bancos" description="Control financiero, ingresos y egresos diarios en tiempo real" />
        <button 
          onClick={() => {
            setIsCreating(true);
            setErrorMessage(null);
          }}
          className="btn btn-primary"
        >
          <Plus size={18} />
          Nuevo Movimiento
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {topCards.map((stat, idx) => {
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
        <div style={{ padding: '20px', display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input 
              type="text" 
              placeholder="Buscar por comprobante, detalle o monto..." 
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
            />
          </div>
        </div>

        {loading ? (
          <SkeletonLoader rows={4} height="52px" />
        ) : movements.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState 
              icon={Wallet} 
              title="Sin movimientos financieros" 
              description="Registra ingresos o egresos para comenzar a auditar la caja diaria." 
            />
          </div>
        ) : (
          <Table 
            data={movements}
            keyExtractor={(item) => item.id!}
            columns={[
              { header: 'Fecha', accessor: (item) => new Date(item.date).toLocaleDateString() },
              { 
                header: 'Operación', 
                accessor: (item) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.description}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.category} • {item.method === 'cash' ? 'Efectivo' : 'Banco/Transferencia'}</div>
                  </div>
                ) 
              },
              { 
                header: 'Tipo', 
                accessor: (item) => (
                  <span style={{ 
                    padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                    backgroundColor: item.type === 'in' ? '#dcfce7' : '#fee2e2',
                    color: item.type === 'in' ? '#166534' : '#991b1b'
                  }}>
                    {item.type === 'in' ? 'Ingreso' : 'Egreso'}
                  </span>
                ),
                align: 'center'
              },
              { 
                header: 'Monto', 
                accessor: (item) => (
                  <span style={{ fontWeight: 700, color: item.amount > 0 ? '#16a34a' : '#dc2626' }}>
                    {formatCurrency(item.amount)}
                  </span>
                ),
                align: 'right'
              },
            ]}
          />
        )}
      </Card>
    </>
  );
};
export default CajaBancos;
