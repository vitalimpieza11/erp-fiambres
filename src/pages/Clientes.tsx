import React, { useState } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { LoadingSpinner, ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Input, Select, Toggle } from '../components/ui/Forms';
import { 
  Search, Plus, Filter, ArrowLeft, Save, 
  Users, DollarSign, Activity, Award, Wallet,
  Store, Handshake, Truck, History, Phone,
  CreditCard, ShieldAlert, ArrowRight, ArrowDown, Download, Loader2, Edit2, Trash2, Tag
} from 'lucide-react';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { useCustomers } from '../hooks/useCustomers';
import { usePriceLists } from '../hooks/usePriceLists';
import { usePresentaciones } from '../hooks/usePresentaciones';
import { useMercaderias } from '../hooks/useMercaderias';
import { CCDetail } from './CuentaCorriente';


export const Clientes = () => {
  const { customers, loading, error, saveCustomer, deleteCustomer } = useCustomers();
  const { priceLists } = usePriceLists();
  const { presentaciones } = usePresentaciones();
  const { mercaderias } = useMercaderias();
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'cc'>('list');
  const [creditEnabled, setCreditEnabled] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [cuit, setCuit] = useState('');
  const [responsable, setResponsable] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [barrio, setBarrio] = useState('');
  const [notes, setNotes] = useState('');
  const [classification, setClassification] = useState('gastro');
  const [priceListId, setPriceListId] = useState('');
  const [creditLimitStr, setCreditLimitStr] = useState('100000');
  const [paymentTermsStr, setPaymentTermsStr] = useState('30');
  const [specialPrices, setSpecialPrices] = useState<Record<string, { mode: 'price' | 'margin', value: number }>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // UI states for new special price
  const [newSpecialProduct, setNewSpecialProduct] = useState('');
  const [newSpecialMode, setNewSpecialMode] = useState<'price' | 'margin'>('price');
  const [newSpecialValue, setNewSpecialValue] = useState('');  if (error) {
    return <ErrorState message={typeof error === 'string' ? error : (error as any).message || 'Error cargando clientes.'} />;
  }

  const handleSaveCustomer = async () => {
    if (!name) {
      alert("Por favor ingrese el Nombre de Fantasía o Razón Social.");
      return;
    }
    setIsSaving(true);
    try {
      await saveCustomer({
        name,
        cuit: cuit || '',
        email: email || '',
        phone: phone || '',
        address: `${address}${barrio ? ` (${barrio})` : ''}`,
        creditLimit: creditEnabled ? parseNumber(creditLimitStr) : 0,
        currentBalance: 0,
        paymentTerms: creditEnabled ? parseNumber(paymentTermsStr) : 0,
        isActive: true,
        priceListId: priceListId || '',
        priceListName: priceListId ? (priceLists.find(p => p.id === priceListId)?.name || '') : '',
        specialPrices
      }, selectedCustomer?.id);
      setViewMode('list');
      setSelectedCustomer(null);
      // Reset form
      setName('');
      setCuit('');
      setResponsable('');
      setEmail('');
      setPhone('');
      setAddress('');
      setBarrio('');
      setNotes('');
      setCreditLimitStr('100000');
      setPaymentTermsStr('30');
      setPriceListId('');
      setSpecialPrices({});
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Error al registrar cliente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCC = (customer: any) => {
    setSelectedCustomer(customer._original);
    setViewMode('cc');
  };

  const handleEditCustomer = (item: any) => {
    const c = item._original;
    setSelectedCustomer(c);
    setName(c.name || '');
    setCuit(c.cuit || '');
    setResponsable(c.responsable || '');
    setEmail(c.email || '');
    setPhone(c.phone || '');
    setAddress(c.address || '');
    setBarrio('');
    setNotes(c.notes || '');
    setCreditLimitStr(c.creditLimit?.toString() || '100000');
    setPaymentTermsStr(c.paymentTerms?.toString() || '30');
    setCreditEnabled(c.creditLimit > 0 || c.paymentTerms > 0);
    setPriceListId(c.priceListId || '');
    setSpecialPrices(c.specialPrices || {});
    setViewMode('create');
  };

  const handleDeleteCustomer = async (item: any) => {
    if (window.confirm(`¿Estás seguro de eliminar el cliente ${item.commerce}?`)) {
      try {
        await deleteCustomer(item.id);
      } catch (e: any) {
        alert(e.message || "Error al eliminar.");
      }
    }
  };

  // VISTA CUENTA CORRIENTE (CC)
  if (viewMode === 'cc' && selectedCustomer) {
    return <CCDetail customer={selectedCustomer} onBack={() => { setViewMode('list'); setSelectedCustomer(null); }} />;
  }

  // VISTA NUEVO CLIENTE
  if (viewMode === 'create') {
    return (
      <div style={{ paddingBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={() => setViewMode('list')}
              className="btn btn-icon"
              disabled={isSaving}
            >
              <ArrowLeft size={20} color="var(--text-secondary)" />
            </button>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedCustomer ? 'Editar Cliente' : 'Alta de Cliente'}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Registro y configuración comercial</p>
            </div>
          </div>
          <button onClick={handleSaveCustomer} disabled={isSaving} className="btn btn-primary">
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {isSaving ? 'Guardando...' : 'Guardar Cliente'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          {/* COLUMNA IZQUIERDA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* SECCIÓN 1 — DATOS DEL COMERCIO */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Store size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>1. Datos del Comercio</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Input label="Nombre de Fantasía" placeholder="Ej: Bar Los Pinos" value={name} onChange={e => setName(e.target.value)} />
                <Input label="CUIT / Razón Social" placeholder="30-12345678-9" value={cuit} onChange={e => setCuit(e.target.value)} />
                <Input label="Responsable / Dueño" placeholder="Juan Pérez" value={responsable} onChange={e => setResponsable(e.target.value)} />
                <Input label="Email" placeholder="contacto@barlospinos.com" value={email} onChange={e => setEmail(e.target.value)} />
                <Input label="Teléfono / Celular" placeholder="341-555-0192" icon={<Phone size={16} />} value={phone} onChange={e => setPhone(e.target.value)} />
                <Input label="WhatsApp" placeholder="341-155-0192" value={responsable} onChange={e => setResponsable(e.target.value)} />
                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                  <Input label="Dirección" placeholder="Av. Pellegrini 1234" value={address} onChange={e => setAddress(e.target.value)} />
                  <Input label="Barrio / Zona" placeholder="Ej: Centro" value={barrio} onChange={e => setBarrio(e.target.value)} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Input label="Observaciones Internas" placeholder="Restricciones, datos clave..." value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>
            </Card>

            {/* SECCIÓN 4 — LOGÍSTICA */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Truck size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>4. Logística y Entrega</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Select label="Modo Preferido" options={[
                  { value: 'reparto', label: 'Reparto a Domicilio' },
                  { value: 'retiro', label: 'Retira por Local' }
                ]} />
                <Input label="Días Habituales" placeholder="Ej: Lun - Mie - Vie" />
                <Input label="Horario Habitual" placeholder="Ej: Por la mañana" />
                <Input label="Notas para el Chofer" placeholder="Llamar antes de ir..." />
              </div>
            </Card>

          </div>

          {/* COLUMNA DERECHA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* SECCIÓN 2 — TIPO DE CLIENTE */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Users size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>2. Tipo de Cliente</h3>
              </div>
              <Select label="Clasificación" value={classification} onChange={e => setClassification(e.target.value)} options={[
                { value: 'gastro', label: 'Gastronómico (Restaurante/Bar)' },
                { value: 'kiosco', label: 'Kiosco / Minimarket' },
                { value: 'almacen', label: 'Almacén de Barrio' },
                { value: 'despensa', label: 'Despensa / Fiambrería' },
                { value: 'minorista', label: 'Consumidor Final Minorista' }
              ]} />
            </Card>

            {/* SECCIÓN 3 — CONDICIONES COMERCIALES */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Handshake size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>3. Condiciones Comerciales</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {priceLists.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.875rem', fontWeight: 500 }}>
                    No existen listas de precios. Cree una lista antes de asignarla a un cliente.
                  </div>
                ) : (
                  <Select 
                    label="Lista de Precios" 
                    value={priceListId}
                    onChange={e => setPriceListId(e.target.value)}
                    options={[
                      { value: '', label: 'Seleccionar lista...' },
                      ...priceLists.map(list => ({ value: list.id!, label: list.name }))
                    ]} 
                  />
                )}
                <Input label="Descuento Fijo (%)" placeholder="Ej: 5" type="number" />
                
                <div style={{ gridColumn: '1 / -1', padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <Toggle label="Habilitar Cuenta Corriente" checked={creditEnabled} onChange={setCreditEnabled} />
                  </div>
                  {creditEnabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                      <Input label="Límite de Crédito ($)" placeholder="Ej: 100000" icon={<DollarSign size={16} />} value={creditLimitStr} onChange={e => setCreditLimitStr(e.target.value)} />
                      <Select label="Días de Pago" value={paymentTermsStr} onChange={e => setPaymentTermsStr(e.target.value)} options={[
                        { value: '7', label: '7 días' },
                        { value: '15', label: '15 días' },
                        { value: '30', label: '30 días' }
                      ]} />
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* SECCIÓN 6 — PRECIOS ESPECIALES */}
            <Card style={{ backgroundColor: 'var(--bg-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Tag size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Precios Especiales</h3>
              </div>
              
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Producto</label>
                    <select value={newSpecialProduct} onChange={e => setNewSpecialProduct(e.target.value)} className="form-input" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px' }}>
                      <option value="">Seleccionar producto...</option>
                      <optgroup label="Mercaderías">
                        {mercaderias.filter(m => m.isActive).map(m => (
                          <option key={m.id} value={m.id}>{m.name} (Por Kg)</option>
                        ))}
                      </optgroup>
                      <optgroup label="Presentaciones">
                        {presentaciones.filter(p => p.isActive).map(p => (
                          <option key={p.id} value={p.id}>{p.name} (Por Unidad)</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Modo</label>
                    <select value={newSpecialMode} onChange={e => setNewSpecialMode(e.target.value as 'price'|'margin')} className="form-input" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px' }}>
                      <option value="price">Precio Fijo ($)</option>
                      <option value="margin">Margen Especial (%)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Valor</label>
                    <input type="number" value={newSpecialValue} onChange={e => setNewSpecialValue(e.target.value)} className="form-input" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px' }} placeholder={newSpecialMode === 'price' ? '11500' : '28'} />
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (newSpecialProduct && newSpecialValue) {
                      setSpecialPrices({
                        ...specialPrices,
                        [newSpecialProduct]: { mode: newSpecialMode, value: parseNumber(newSpecialValue) }
                      });
                      setNewSpecialProduct('');
                      setNewSpecialValue('');
                    }
                  }}
                  className="btn btn-secondary btn-sm" style={{ width: '100%' }}
                >
                  <Plus size={16} /> Agregar Excepción
                </button>
              </div>

              {Object.keys(specialPrices).length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ textAlign: 'left', padding: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Producto</th>
                      <th style={{ textAlign: 'right', padding: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Excepción</th>
                      <th style={{ padding: '8px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(specialPrices).map(([prodId, special]) => {
                      const prodName = mercaderias.find(m => m.id === prodId)?.name || presentaciones.find(p => p.id === prodId)?.name || 'Producto Desconocido';
                      return (
                        <tr key={prodId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px', fontSize: '0.85rem' }}>{prodName}</td>
                          <td style={{ padding: '8px', fontSize: '0.85rem', textAlign: 'right', fontWeight: 600 }}>
                            {special.mode === 'price' ? formatCurrency(special.value) : `${special.value}%`}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>
                            <button onClick={() => {
                              const newSp = { ...specialPrices };
                              delete newSp[prodId];
                              setSpecialPrices(newSp);
                            }} className="btn btn-icon btn-sm" style={{ color: '#dc2626' }}>
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>

            {/* SECCIÓN 5 — HISTORIAL COMERCIAL */}
            <Card style={{ backgroundColor: '#1e293b', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <History size={20} color="#38bdf8" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f8fafc' }}>5. Resumen Histórico</h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', border: '1px dashed #475569', borderRadius: '8px' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>El historial se generará tras la primera compra.</p>
              </div>
            </Card>

          </div>
        </div>
      </div>
    );
  }

  // VISTA PRINCIPAL (LISTA)
  const activeCount = customers.filter(c => c.isActive).length;
  const totalDebt = customers.reduce((acc, c) => acc + (c.currentBalance || 0), 0);
  const delinquentCount = customers.filter(c => (c.currentBalance || 0) > (c.creditLimit || 100000)).length;

  const stats = [
    { title: 'Clientes Activos', value: activeCount.toString(), icon: Users, color: 'var(--primary-color)', bg: 'var(--primary-light)' },
    { title: 'Deuda Total a Cobrar', value: formatCurrency(totalDebt), icon: DollarSign, color: '#dc2626', bg: '#fee2e2' },
    { title: 'Clientes Morosos', value: delinquentCount.toString(), icon: ShieldAlert, color: '#d97706', bg: '#fef3c7' },
    { title: 'Ticket Promedio', value: '$ 32.500', icon: Activity, color: '#4f46e5', bg: '#e0e7ff' },
    { title: 'Top Cliente (Mes)', value: customers.length > 0 ? customers[0].name : 'Ninguno', icon: Award, color: '#059669', bg: '#d1fae5' },
  ];

  const mappedCustomers = customers.map(c => ({
    _original: c,
    id: c.id!,
    commerce: c.name,
    type: 'Comercio',
    contact: c.cuit ? `CUIT: ${c.cuit}` : 'Sin CUIT',
    phone: c.phone || 'Sin teléfono',
    zone: c.address || 'General',
    debt: formatCurrency(c.currentBalance || 0),
    lastBuy: 'Ver ficha',
    status: (c.currentBalance || 0) > (c.creditLimit || 100000) ? 'Moroso' : c.isActive ? 'Activo' : 'Inactivo',
    rawBalance: c.currentBalance || 0
  }));

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <PageHeader title="Directorio de Clientes" description="Gestión comercial y estados de cuenta" />
        <button 
          onClick={() => {
            setSelectedCustomer(null);
            setName('');
            setCuit('');
            setResponsable('');
            setEmail('');
            setPhone('');
            setAddress('');
            setBarrio('');
            setNotes('');
            setCreditLimitStr('100000');
            setPaymentTermsStr('30');
            setPriceListId('');
            setSpecialPrices({});
            setNewSpecialProduct('');
            setNewSpecialValue('');
            setViewMode('create');
          }}
          className="btn btn-primary"
        >
          <Plus size={18} />
          Nuevo Cliente
        </button>
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
        <div style={{ padding: '20px', display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, zona o teléfono..." 
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
        ) : mappedCustomers.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState 
              icon={Users} 
              title="No hay clientes registrados" 
              description="Registra un nuevo cliente para iniciar cuentas corrientes y facturación." 
            />
          </div>
        ) : (
          <Table<any> 
            data={mappedCustomers}
            keyExtractor={(item) => item.id}
            onRowClick={(item) => handleOpenCC(item)}
            columns={[
              { 
                header: 'Comercio', 
                accessor: (item) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.commerce}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.contact}</div>
                  </div>
                ) 
              },
              { header: 'Rubro', accessor: 'type' },
              { header: 'Teléfono', accessor: 'phone' },
              { header: 'Zona', accessor: 'zone' },
              { 
                header: 'Deuda Actual', 
                accessor: (item) => <span style={{ fontWeight: 700, color: item.debt === '$ 0' ? 'var(--text-primary)' : '#dc2626' }}>{item.debt}</span> 
              },
              { header: 'Última Compra', accessor: 'lastBuy' },
              { 
                header: 'Estado', 
                accessor: (item) => {
                  let bg, color;
                  if (item.status === 'Activo') { bg = '#dcfce7'; color = '#166534'; }
                  else if (item.status === 'Preferencial') { bg = '#e0e7ff'; color = '#4f46e5'; }
                  else if (item.status === 'Moroso') { bg = '#fee2e2'; color = '#991b1b'; }
                  else { bg = '#f1f5f9'; color = '#475569'; }

                  return (
                    <span style={{ 
                      padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                      backgroundColor: bg, color: color
                    }}>
                      {item.status}
                    </span>
                  )
                },
                align: 'center'
              },
              {
                header: 'Acciones',
                accessor: (item) => (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleOpenCC(item); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: 'var(--primary-color)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }} title="Ver Cta. Cte.">
                      CC <ArrowRight size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleEditCustomer(item); }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }} title="Editar">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(item); }} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }} title="Eliminar">
                      <Trash2 size={18} />
                    </button>
                  </div>
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
