import React, { useState } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { LoadingSpinner, ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Input, Select } from '../components/ui/Forms';
import { 
  Truck, Search, Filter, Plus, ArrowLeft, Save, 
  Building2, Phone, MapPin, CreditCard, FileText, 
  DollarSign, Clock, CheckCircle2, Loader2, Edit2, Trash2
} from 'lucide-react';
import { formatCurrency, parseNumber } from '../utils/format';
import { useSuppliers } from '../hooks/useSuppliers';

const mockCC: any[] = [];

export const Proveedores = () => {
  const { suppliers, loading, error, saveSupplier, deleteSupplier } = useSuppliers();
  const [viewState, setViewState] = useState<'list' | 'create' | 'account'>('list');
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [cuit, setCuit] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('contado');
  const [creditLimitStr, setCreditLimitStr] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (error) {
    return <ErrorState message={typeof error === 'string' ? error : (error as any).message || 'Error cargando proveedores.'} />;
  }

  const handleSaveSupplier = async () => {
    if (!name) {
      alert("Por favor ingrese la Razón Social o Nombre.");
      return;
    }
    setIsSaving(true);
    try {
      await saveSupplier({
        name,
        cuit: cuit || '',
        email: email || '',
        phone: phone || '',
        address: address || '',
        category: category || 'General',
        isActive: true
      }, selectedSupplier?.id);
      setViewState('list');
      setSelectedSupplier(null);
      // Reset form
      setName('');
      setCategory('');
      setCuit('');
      setContact('');
      setPhone('');
      setEmail('');
      setAddress('');
      setPaymentTerms('contado');
      setCreditLimitStr('');
      setNotes('');
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Error al registrar proveedor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAccount = (supplier: any) => {
    setSelectedSupplier(supplier);
    setViewState('account');
    setIsPaying(false);
  };

  const mappedProveedores = suppliers.map((s: any) => {
    const balance = (s as any).currentBalance || 0;
    return {
      _original: s,
      id: s.id!,
      name: s.name,
      category: s.category || 'General',
      cuit: s.cuit ? `CUIT: ${s.cuit}` : 'Sin CUIT',
      phone: s.phone || 'Sin teléfono',
      debt: formatCurrency(balance),
      lastPurchase: s.address || 'General',
      status: balance > 0 ? 'Deuda' : s.isActive ? 'Activo' : 'Inactivo',
      rawBalance: balance
    };
  });

  const handleEditSupplier = (item: any) => {
    const s = item._original;
    setSelectedSupplier(s);
    setName(s.name || '');
    setCategory(s.category || 'General');
    setCuit(s.cuit || '');
    setContact(s.contact || '');
    setPhone(s.phone || '');
    setEmail(s.email || '');
    setAddress(s.address || '');
    setPaymentTerms(s.paymentTerms || 'contado');
    setCreditLimitStr(s.creditLimitStr || '');
    setNotes(s.notes || '');
    setViewState('create');
  };

  const handleDeleteSupplier = async (item: any) => {
    if (window.confirm(`¿Estás seguro de eliminar el proveedor ${item.name}?`)) {
      try {
        await deleteSupplier(item.id);
      } catch (e: any) {
        alert(e.message || "Error al eliminar.");
      }
    }
  };

  // VISTA CREAR PROVEEDOR
  if (viewState === 'create') {
    return (
      <div style={{ paddingBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={() => setViewState('list')}
              className="btn btn-icon"
              disabled={isSaving}
            >
              <ArrowLeft size={20} color="var(--text-secondary)" />
            </button>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Alta de proveedores e insumos</p>
            </div>
          </div>
          <button onClick={handleSaveSupplier} disabled={isSaving} className="btn btn-primary">
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {isSaving ? 'Guardando...' : 'Guardar Proveedor'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <Building2 size={20} color="var(--primary-color)" />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>1. Datos de la Empresa</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              <Input label="Razón Social / Nombre" placeholder="Ej: Frigorífico Paladini SA" value={name} onChange={e => setName(e.target.value)} />
              <Input label="Rubro / Categoría" placeholder="Ej: Fiambres, Lácteos, Insumos" value={category} onChange={e => setCategory(e.target.value)} />
              <Input label="CUIT" placeholder="Ej: 30-12345678-9" value={cuit} onChange={e => setCuit(e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Input label="Contacto (Persona)" placeholder="Ej: Juan Pérez" value={contact} onChange={e => setContact(e.target.value)} />
                <Input label="Teléfono / WhatsApp" placeholder="Ej: 341 555 0101" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <Input label="Email de Ventas/Cobranzas" type="email" placeholder="ventas@paladini.com" value={email} onChange={e => setEmail(e.target.value)} />
              <Input label="Dirección Física" placeholder="Ej: Calle Principal 123, Rosario" value={address} onChange={e => setAddress(e.target.value)} />
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <CreditCard size={20} color="var(--primary-color)" />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>2. Condiciones Comerciales</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              <Select label="Condición de Pago Habitual" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)} options={[
                { value: 'contado', label: 'Contado Contra Entrega' },
                { value: 'cc_7', label: 'Cuenta Corriente a 7 días' },
                { value: 'cc_15', label: 'Cuenta Corriente a 15 días' },
                { value: 'cc_30', label: 'Cuenta Corriente a 30 días' }
              ]} />
              <div style={{ gridColumn: '1 / -1' }}>
                <Input label="Línea de Crédito Otorgada ($)" type="number" placeholder="Opcional" value={creditLimitStr} onChange={e => setCreditLimitStr(e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <Input label="Observaciones Internas" placeholder="Días de visita, horarios de entrega..." value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // VISTA CUENTA CORRIENTE
  if (viewState === 'account' && selectedSupplier) {
    const saldoReal = selectedSupplier.rawBalance || 0;

    return (
      <div style={{ paddingBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={() => { setViewState('list'); setSelectedSupplier(null); }}
              className="btn btn-icon"
            >
              <ArrowLeft size={20} color="var(--text-secondary)" />
            </button>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedSupplier.name}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Cuenta Corriente y Facturación</p>
            </div>
          </div>
          <button 
            onClick={() => setIsPaying(true)}
            className="btn btn-primary"
          >
            <DollarSign size={18} /> Registrar Pago
          </button>
        </div>

        {isPaying && (
          <Card style={{ marginBottom: '24px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <CreditCard size={20} color="var(--primary-color)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Nuevo Pago a Proveedor</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr auto', gap: '16px', alignItems: 'flex-end' }}>
              <Input label="Monto a Pagar ($)" type="number" placeholder="0.00" />
              <Select label="Medio de Pago" options={[
                { value: 'efectivo', label: 'Efectivo' },
                { value: 'transferencia', label: 'Transferencia' },
                { value: 'cheque', label: 'Cheque' }
              ]} />
              <Input label="Fecha" type="date" />
              <Input label="Referencia / Comprobante" placeholder="Nº de recibo" />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setIsPaying(false)} className="btn btn-secondary">Cancelar</button>
                <button onClick={() => setIsPaying(false)} className="btn btn-primary">Confirmar</button>
              </div>
            </div>
          </Card>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <Card padding="sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '10px', backgroundColor: '#fee2e2', color: '#dc2626', borderRadius: '10px' }}><DollarSign size={20} /></div>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Deuda Total</p>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(saldoReal)}</h3>
              </div>
            </div>
          </Card>
          <Card padding="sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '10px', backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: '10px' }}><CheckCircle2 size={20} /></div>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Pagos Este Mes</p>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>$ 0</h3>
              </div>
            </div>
          </Card>
          <Card padding="sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '10px', backgroundColor: '#dbeafe', color: '#2563eb', borderRadius: '10px' }}><FileText size={20} /></div>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Compras Este Mes</p>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>$ 0</h3>
              </div>
            </div>
          </Card>
          <Card padding="sm">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '10px', backgroundColor: '#fef3c7', color: '#d97706', borderRadius: '10px' }}><Clock size={20} /></div>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>Próx. Vencimiento</p>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>--/--/----</h3>
              </div>
            </div>
          </Card>
        </div>

        <Card padding="none">
          <Table 
            data={mockCC}
            keyExtractor={(item) => item.id}
            columns={[
              { header: 'Fecha', accessor: 'date', width: '120px' },
              { header: 'Comprobante', accessor: 'id', width: '120px' },
              { 
                header: 'Tipo', 
                accessor: (item) => (
                  <span style={{ 
                    padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                    backgroundColor: item.type === 'Pago' ? '#dcfce7' : '#fef2f2',
                    color: item.type === 'Pago' ? '#166534' : '#991b1b'
                  }}>
                    {item.type}
                  </span>
                ),
                align: 'center'
              },
              { header: 'Descripción', accessor: 'desc' },
              { 
                header: 'Monto', 
                accessor: (item) => (
                  <span style={{ fontWeight: 600, color: item.amount > 0 ? '#dc2626' : '#16a34a' }}>
                    {formatCurrency(item.amount)}
                  </span>
                ),
                align: 'right'
              },
              { 
                header: 'Saldo', 
                accessor: (item) => (
                  <span style={{ fontWeight: 700 }}>
                    {formatCurrency(item.balance)}
                  </span>
                ),
                align: 'right'
              },
            ]}
          />
        </Card>
      </div>
    );
  }

  // VISTA LISTA (MAIN)
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <PageHeader title="Proveedores" description="Gestión de compras, pagos y cuentas corrientes" />
        <button 
          onClick={() => {
            setSelectedSupplier(null);
            setName('');
            setCategory('');
            setCuit('');
            setContact('');
            setPhone('');
            setEmail('');
            setAddress('');
            setPaymentTerms('contado');
            setCreditLimitStr('');
            setNotes('');
            setViewState('create');
          }}
          className="btn btn-primary"
        >
          <Plus size={18} />
          Nuevo Proveedor
        </button>
      </div>

      <Card padding="none">
        <div style={{ padding: '20px', display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, rubro o teléfono..." 
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
            />
          </div>
          <button className="btn btn-secondary">
            <Filter size={18} />
            Filtros
          </button>
        </div>

        {loading ? (
          <SkeletonLoader rows={4} height="52px" />
        ) : mappedProveedores.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState 
              icon={Truck} 
              title="No hay proveedores registrados" 
              description="Registra un nuevo proveedor para gestionar las cuentas corrientes e insumos." 
            />
          </div>
        ) : (
          <Table<any> 
            data={mappedProveedores}
            keyExtractor={(item) => item.id}
            columns={[
              { 
                header: 'Proveedor', 
                accessor: (item) => (
                  <div style={{ cursor: 'pointer' }} onClick={() => handleOpenAccount(item)}>
                    <div style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{item.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.cuit} | {item.category}</div>
                  </div>
                ) 
              },
              { header: 'Teléfono', accessor: 'phone' },
              { header: 'Ubicación / Dirección', accessor: 'lastPurchase' },
              { 
                header: 'Deuda Actual', 
                accessor: (item) => (
                  <span style={{ fontWeight: 700, color: item.debt !== '$ 0' ? '#dc2626' : '#16a34a' }}>
                    {item.debt}
                  </span>
                ),
                align: 'right'
              },
              { 
                header: 'Estado', 
                accessor: (item) => (
                  <span style={{ 
                    padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                    backgroundColor: item.status === 'Activo' || item.status === 'Al Día' ? '#dcfce7' : '#fee2e2',
                    color: item.status === 'Activo' || item.status === 'Al Día' ? '#166534' : '#991b1b'
                  }}>
                    {item.status}
                  </span>
                ),
                align: 'center'
              },
              {
                header: 'Acciones',
                accessor: (item) => (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button onClick={() => handleOpenAccount(item)} style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }} title="Ver Cta. Cte.">
                      <FileText size={18} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleEditSupplier(item); }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }} title="Editar">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSupplier(item); }} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }} title="Eliminar">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ),
                align: 'center'
              }
            ]}
          />
        )}
      </Card>
    </>
  );
};
