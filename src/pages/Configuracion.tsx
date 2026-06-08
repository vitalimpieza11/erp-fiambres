import React, { useState, useEffect } from 'react';
import { 
  Building2, Briefcase, FileText, Package, Users, Landmark, MonitorSmartphone,
  Save, Download, Upload, RotateCcw, Image, FileBadge2, Check, ShieldCheck, AlertTriangle, Loader2, CheckCircle2,
  Plus, Trash2, Edit2, Coins, DollarSign
} from 'lucide-react';
import { PageHeader } from '../components/EmptyState';
import { Card, CardHeader } from '../components/ui/Card';
import { Input, Select, Toggle } from '../components/ui/Forms';
import { useSettings, type SystemSettings } from '../hooks/useSettings';
import { useSocietaria } from '../hooks/useSocietaria';
import { useBanks } from '../hooks/useBanks';

export const Configuracion = () => {
  const [activeTab, setActiveTab] = useState('empresa');
  const [showModal, setShowModal] = useState(false);
  
  const { settings, saveSettings, loading } = useSettings();
  const [localSettings, setLocalSettings] = useState<SystemSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  // Partners CRUD form states
  const { partners, savePartner, deletePartner } = useSocietaria();
  const [partnerName, setPartnerName] = useState('');
  const [partnerShare, setPartnerShare] = useState('50');
  const [partnerActive, setPartnerActive] = useState(true);
  const [partnerObs, setPartnerObs] = useState('');
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);

  // Banks CRUD form states
  const { banks, saveBank, deleteBank } = useBanks();
  const [bankName, setBankName] = useState('');
  const [bankAccountType, setBankAccountType] = useState('Cuenta Corriente');
  const [bankCurrency, setBankCurrency] = useState('ARS');
  const [bankActive, setBankActive] = useState(true);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);

  // Currency form states
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('');
  const [newCurrencyRate, setNewCurrencyRate] = useState('1');

  // Categories states
  const [newExpenseCategory, setNewExpenseCategory] = useState('');
  const [newReinvestmentCategory, setNewReinvestmentCategory] = useState('');

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const updateField = (field: keyof SystemSettings, value: any) => {
    if (localSettings) {
      setLocalSettings({ ...localSettings, [field]: value });
    }
  };

  const handleSave = async () => {
    if (!localSettings) return;
    setIsSaving(true);
    try {
      await saveSettings(localSettings);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (e) {
      console.error(e);
      alert("Error al guardar la configuración.");
    } finally {
      setIsSaving(false);
    }
  };

  const tabs = [
    { id: 'empresa', label: 'Empresa', icon: Building2 },
    { id: 'comercial', label: 'Datos Comerciales', icon: Briefcase },
    { id: 'ventas', label: 'Ventas & Remitos', icon: FileText },
    { id: 'stock', label: 'Stock & Producción', icon: Package },
    { id: 'clientes', label: 'Clientes & Créditos', icon: Users },
    { id: 'tesoreria', label: 'Tesorería', icon: Landmark },
    { id: 'bancos', label: 'Cuentas Bancarias', icon: Landmark },
    { id: 'socios', label: 'Socios', icon: Users },
    { id: 'monedas', label: 'Monedas & TC', icon: Coins },
    { id: 'categorias', label: 'Categorías Gastos/Reinv', icon: Landmark },
    { id: 'sistema', label: 'Sistema', icon: MonitorSmartphone },
  ];

  if (loading || !localSettings) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Configuración del Sistema" description="Administra todas las preferencias y parámetros del ERP." />
      
      {/* Toast Premium */}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px', backgroundColor: '#10b981', color: 'white',
        padding: '16px 24px', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
        display: 'flex', alignItems: 'center', gap: '12px', zIndex: 50,
        transform: showToast ? 'translateY(0)' : 'translateY(100px)', opacity: showToast ? 1 : 0,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <CheckCircle2 size={24} />
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>Configuración guardada</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Menu Lateral Interno */}
        <Card padding="none" style={{ position: 'sticky', top: '100px' }}>
           <div style={{ display: 'flex', flexDirection: 'column', padding: '12px' }}>
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', border: 'none', background: isActive ? 'var(--primary-light)' : 'transparent',
                      color: isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
                      borderRadius: '8px', cursor: 'pointer', fontWeight: isActive ? 600 : 500,
                      transition: 'all 0.2s', textAlign: 'left'
                    }}
                  >
                    <tab.icon size={20} />
                    {tab.label}
                  </button>
                )
              })}
           </div>
        </Card>

        {/* Contenido Principal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
           
           {activeTab === 'empresa' && (
              <Card>
                <CardHeader title="Datos de la Empresa" subtitle="Información general y de contacto" />
                <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <Input label="Nombre de la Empresa" value={localSettings.empresa_nombre} onChange={e => updateField('empresa_nombre', e.target.value)} />
                  <Input label="Razón Social" value={localSettings.empresa_razon} onChange={e => updateField('empresa_razon', e.target.value)} />
                  <Input label="CUIT" value={localSettings.empresa_cuit} onChange={e => updateField('empresa_cuit', e.target.value)} />
                  <Input label="Dirección" value={localSettings.empresa_direccion} onChange={e => updateField('empresa_direccion', e.target.value)} />
                  <Input label="Teléfono Fijo" value={localSettings.empresa_telefono} onChange={e => updateField('empresa_telefono', e.target.value)} />
                  <Input label="Email de Contacto" value={localSettings.empresa_email} onChange={e => updateField('empresa_email', e.target.value)} />
                  <Input label="WhatsApp Comercial" value={localSettings.empresa_whatsapp} onChange={e => updateField('empresa_whatsapp', e.target.value)} />
                  <Input label="Instagram" value={localSettings.empresa_instagram} onChange={e => updateField('empresa_instagram', e.target.value)} />
                  
                  <div style={{ gridColumn: '1 / -1', marginTop: '12px', padding: '16px', border: '1px dashed var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '64px', height: '64px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                       <Image size={32} />
                    </div>
                    <div>
                       <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Logo de la Empresa</p>
                       <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Formato recomendado: PNG transparente, 500x500px.</p>
                       <button style={{ marginTop: '8px', padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}>Subir Nuevo Logo</button>
                    </div>
                  </div>
                </div>
              </Card>
           )}

           {activeTab === 'comercial' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <Card>
                  <CardHeader title="Parámetros Comerciales" subtitle="Márgenes y listas de precios por defecto" />
                  <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <Select label="Lista de Precios Predeterminada" options={[{label: 'Lista Mayorista', value: '1'}, {label: 'Lista Minorista', value: '2'}]} value={localSettings.comercial_listaDefault} onChange={e => updateField('comercial_listaDefault', e.target.value)} />
                    <Input label="Margen de Ganancia Default (%)" type="number" value={localSettings.comercial_margenDefault} onChange={e => updateField('comercial_margenDefault', Number(e.target.value))} />
                    <Select label="Política de Descuentos" options={[{label: 'Estricto (Solo Admin)', value: '1'}, {label: 'Flexible (Vendedores)', value: '2'}]} value={localSettings.comercial_politicaDescuento} onChange={e => updateField('comercial_politicaDescuento', e.target.value)} />
                    <Input label="Umbral Margen Riesgo (%)" type="number" value={localSettings.comercial_margenRiesgo || 15} onChange={e => updateField('comercial_margenRiesgo', Number(e.target.value))} />
                    <Input label="Umbral Margen Óptimo (%)" type="number" value={localSettings.comercial_margenOptimo || 30} onChange={e => updateField('comercial_margenOptimo', Number(e.target.value))} />
                    <Input label="Alerta Aumento Costo (%)" type="number" value={localSettings.comercial_alertaCostoAumento || 10} onChange={e => updateField('comercial_alertaCostoAumento', Number(e.target.value))} />
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Costos Operativos Variables" subtitle="Valores base para cálculos de rentabilidad" />
                  <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                    <Input label="Costo Bolsa (Unidad)" type="number" value={localSettings.costo_bolsa} onChange={e => updateField('costo_bolsa', Number(e.target.value))} />
                    <Input label="Costo Etiqueta (Unidad)" type="number" value={localSettings.costo_etiqueta} onChange={e => updateField('costo_etiqueta', Number(e.target.value))} />
                    <Input label="Mano de Obra (por Kg)" type="number" value={localSettings.costo_manoObra} onChange={e => updateField('costo_manoObra', Number(e.target.value))} />
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Fraccionamiento" subtitle="Gramajes habilitados para la venta" />
                  <div style={{ marginTop: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                     {['100g', '150g', '200g', '250g', '500g', 'Horma Entera'].map(gramaje => (
                       <label key={gramaje} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'var(--bg-secondary)' }}>
                         <input type="checkbox" defaultChecked />
                         <span style={{ fontWeight: 500 }}>{gramaje}</span>
                       </label>
                     ))}
                  </div>
                </Card>
              </div>
           )}

           {activeTab === 'ventas' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <Card>
                  <CardHeader title="Configuración de Remitos" subtitle="Personalización de comprobantes" />
                  <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <Toggle label="Numeración Automática" checked={localSettings.ventas_numeracionAutomatica} onChange={v => updateField('ventas_numeracionAutomatica', v)} />
                    <Input label="Prefijo del Comprobante" value={localSettings.ventas_prefijoRemito} onChange={e => updateField('ventas_prefijoRemito', e.target.value)} />
                    <Input label="Próximo Número" type="number" value={localSettings.ventas_proximoNumero} onChange={e => updateField('ventas_proximoNumero', Number(e.target.value))} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                       <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Observaciones Default</label>
                       <textarea style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', minHeight: '80px', fontFamily: 'inherit' }} value={localSettings.ventas_observacionesDefault} onChange={e => updateField('ventas_observacionesDefault', e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                       <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Texto al Pie del Remito</label>
                       <input style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} value={localSettings.ventas_textoPieRemito} onChange={e => updateField('ventas_textoPieRemito', e.target.value)} />
                    </div>
                    <Toggle label="Incluir Firma Digital Visual" checked={localSettings.ventas_firmaDigital} onChange={v => updateField('ventas_firmaDigital', v)} />
                  </div>
                </Card>
                <Card>
                   <CardHeader title="Vista Previa del Remito" subtitle="Así se verá al imprimir" />
                   <div style={{ marginTop: '24px', padding: '24px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--primary-color)', paddingBottom: '16px' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><FileBadge2 size={32} color="var(--primary-color)"/> <b>{localSettings.empresa_nombre || 'Fiambres del Sur'}</b></div>
                         <div style={{ textAlign: 'right' }}>
                           <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>REMITO</h3>
                           <p style={{ color: 'var(--text-secondary)' }}>Nº {localSettings.ventas_prefijoRemito}-{localSettings.ventas_proximoNumero}</p>
                         </div>
                      </div>
                      <div style={{ minHeight: '150px', backgroundColor: 'white', border: '1px dashed #cbd5e1', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                         [ Detalle de Artículos ]
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '16px' }}>
                         {localSettings.ventas_observacionesDefault}<br/>
                         {localSettings.ventas_textoPieRemito}
                      </div>
                   </div>
                </Card>
              </div>
           )}

           {activeTab === 'stock' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <Card>
                  <CardHeader title="Control de Stock" subtitle="Alertas y parámetros base" />
                  <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <Input label="Días para Alerta de Vencimiento" type="number" value={localSettings.stock_diasAlertaVencimiento} onChange={e => updateField('stock_diasAlertaVencimiento', Number(e.target.value))} />
                    <Input label="Stock Crítico Global (Unidades/Kg)" type="number" value={localSettings.stock_criticoGlobal} onChange={e => updateField('stock_criticoGlobal', Number(e.target.value))} />
                    <Toggle label="Notificar por Email stock crítico" checked={localSettings.stock_notificarEmail} onChange={v => updateField('stock_notificarEmail', v)} />
                    <Toggle label="Permitir stock negativo en ventas" checked={localSettings.stock_permitirNegativo} onChange={v => updateField('stock_permitirNegativo', v)} />
                  </div>
                </Card>
                <Card>
                  <CardHeader title="Parámetros de Producción" subtitle="Valores para manufactura" />
                  <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <Input label="Merma Estándar Aceptable (%)" type="number" value={localSettings.prod_mermaEstandar} onChange={e => updateField('prod_mermaEstandar', Number(e.target.value))} />
                    <Select label="Unidad de Medida Default" options={[{label: 'Kilogramos (kg)', value: 'kg'}, {label: 'Unidades (un)', value: 'un'}]} value={localSettings.prod_unidadMedida} onChange={e => updateField('prod_unidadMedida', e.target.value)} />
                  </div>
                </Card>
              </div>
           )}

           {activeTab === 'clientes' && (
              <Card>
                <CardHeader title="Créditos y Cobranzas" subtitle="Políticas para cuentas corrientes" />
                <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <Input label="Días Predeterminados de Pago" type="number" value={localSettings.clientes_diasPago} onChange={e => updateField('clientes_diasPago', Number(e.target.value))} />
                  <Input label="Límite de Crédito Global Default ($)" type="number" value={localSettings.clientes_limiteCredito} onChange={e => updateField('clientes_limiteCredito', Number(e.target.value))} />
                  <Toggle label="Bloquear ventas a clientes morosos" checked={localSettings.clientes_bloquearMorosos} onChange={v => updateField('clientes_bloquearMorosos', v)} />
                  <Select label="Alerta de Morosidad" options={[{label: 'Al vencimiento exacto', value: '1'}, {label: '5 días de gracia', value: '2'}]} value={localSettings.clientes_alertaMorosidad} onChange={e => updateField('clientes_alertaMorosidad', e.target.value)} />
                </div>
              </Card>
           )}

           {activeTab === 'tesoreria' && (
              <Card>
                <CardHeader title="Caja y Bancos" subtitle="Configuración financiera" />
                <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <Input label="Fondo de Caja Fijo Diario ($)" type="number" value={localSettings.tesoreria_fondoCajaFijo} onChange={e => updateField('tesoreria_fondoCajaFijo', Number(e.target.value))} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
                     <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Bancos Operativos</label>
                     <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                       La configuración de bancos ha sido migrada a una sección dedicada. Utilice la pestaña <strong>Cuentas Bancarias</strong> para administrar las cuentas de forma granular.
                     </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                     <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Medios de Pago Habilitados</label>
                     <textarea style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', minHeight: '80px', fontFamily: 'inherit' }} value={localSettings.tesoreria_mediosPago} onChange={e => updateField('tesoreria_mediosPago', e.target.value)} />
                  </div>
                </div>
              </Card>
           )}

           {activeTab === 'sistema' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <Card>
                  <CardHeader title="Administración del Sistema" subtitle="Copias de seguridad y mantenimiento" />
                  <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <button style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
                       <Download size={32} color="var(--primary-color)" />
                       <span style={{ fontWeight: 600 }}>Exportar Backup</span>
                       <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Descargar base de datos local</span>
                    </button>
                    <button style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
                       <Upload size={32} color="#3b82f6" />
                       <span style={{ fontWeight: 600 }}>Importar Backup</span>
                       <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Restaurar desde archivo JSON</span>
                    </button>
                    <button onClick={() => setShowModal(true)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
                       <RotateCcw size={32} color="#dc2626" />
                       <span style={{ fontWeight: 600, color: '#dc2626' }}>Reset Sistema</span>
                       <span style={{ fontSize: '0.75rem', color: '#dc2626', textAlign: 'center' }}>Borrar toda la información local</span>
                    </button>
                  </div>
                </Card>
                <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                   <ShieldCheck size={24} color="#16a34a" />
                   <div>
                     <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Listo para Firebase</p>
                     <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Esta configuración está guardada en la nube y persistida remotamente.</p>
                   </div>
                </div>
              </div>
           )}

            {activeTab === 'bancos' && (
              <Card>
                <CardHeader title="Gestión de Cuentas Bancarias" subtitle="Administra las cuentas bancarias operativas de la empresa" />
                <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                  {/* Formulario de Alta/Edición */}
                  <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ fontWeight: 600, fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      {editingBankId ? 'Editar Cuenta' : 'Nueva Cuenta'}
                    </h4>
                    <Input label="Nombre del Banco" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Ej: Banco Galicia" />
                    <Select 
                      label="Tipo de Cuenta" 
                      value={bankAccountType} 
                      onChange={e => setBankAccountType(e.target.value)} 
                      options={[
                        { value: 'Cuenta Corriente', label: 'Cuenta Corriente' },
                        { value: 'Caja de Ahorro', label: 'Caja de Ahorro' },
                        { value: 'Virtual (e-wallet)', label: 'Virtual (e-wallet)' }
                      ]} 
                    />
                    <Select 
                      label="Moneda" 
                      value={bankCurrency} 
                      onChange={e => setBankCurrency(e.target.value)} 
                      options={(localSettings.currencies || []).map((c) => ({ value: c.code, label: `${c.code} (${c.symbol})` }))} 
                    />
                    <Toggle label="Activa" checked={bankActive} onChange={setBankActive} />
                    
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button 
                        onClick={async () => {
                          if (!bankName) return alert('Ingrese el nombre del banco');
                          await saveBank({
                            name: bankName,
                            accountType: bankAccountType,
                            currency: bankCurrency,
                            isActive: bankActive
                          }, editingBankId || undefined);
                          
                          // Reset Form
                          setBankName('');
                          setBankAccountType('Cuenta Corriente');
                          setBankCurrency('ARS');
                          setBankActive(true);
                          setEditingBankId(null);
                        }}
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                      >
                        <Save size={16} /> Guardar
                      </button>
                      {editingBankId && (
                        <button 
                          onClick={() => {
                            setBankName('');
                            setBankAccountType('Cuenta Corriente');
                            setBankCurrency('ARS');
                            setBankActive(true);
                            setEditingBankId(null);
                          }}
                          className="btn btn-secondary"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Listado de Cuentas */}
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '16px' }}>Cuentas Configuradas</h4>
                    {(banks || []).length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No hay cuentas bancarias registradas.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(banks || []).map(b => (
                          <div 
                            key={b.id} 
                            style={{ 
                              padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', 
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              backgroundColor: b.isActive ? 'transparent' : 'var(--bg-secondary)',
                              opacity: b.isActive ? 1 : 0.7
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 700, fontSize: '1rem', marginRight: '8px' }}>{b.name}</span>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                                <span style={{ 
                                  padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                                  backgroundColor: 'var(--secondary-light)', color: 'var(--text-primary)'
                                }}>
                                  {b.accountType}
                                </span>
                                <span style={{ 
                                  padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                                  backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)'
                                }}>
                                  {b.currency}
                                </span>
                                {!b.isActive && <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>Inactiva</span>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                onClick={() => {
                                  setBankName(b.name);
                                  setBankAccountType(b.accountType);
                                  setBankCurrency(b.currency);
                                  setBankActive(b.isActive);
                                  setEditingBankId(b.id!);
                                }}
                                className="btn btn-icon"
                                style={{ color: '#2563eb', padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                                title="Editar"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={async () => {
                                  if (confirm(`¿Estás seguro de eliminar la cuenta de ${b.name}?`)) {
                                    await deleteBank(b.id!);
                                  }
                                }}
                                className="btn btn-icon"
                                style={{ color: '#dc2626', padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                                title="Eliminar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'socios' && (
              <Card>
                <CardHeader title="Gestión de Socios" subtitle="Administra los socios del negocio y su participación (%)" />
                <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                  {/* Formulario de Alta/Edición */}
                  <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ fontWeight: 600, fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      {editingPartnerId ? 'Editar Socio' : 'Nuevo Socio'}
                    </h4>
                    <Input label="Nombre" value={partnerName} onChange={e => setPartnerName(e.target.value)} placeholder="Ej: Lucas" />
                    <Input label="Participación (%)" type="number" value={partnerShare} onChange={e => setPartnerShare(e.target.value)} placeholder="Ej: 50" min="0" max="100" />
                    <Toggle label="Activo" checked={partnerActive} onChange={setPartnerActive} />
                    <Input label="Observaciones" value={partnerObs} onChange={e => setPartnerObs(e.target.value)} placeholder="Detalle..." />
                    
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button 
                        onClick={async () => {
                          if (!partnerName) return alert('Ingrese el nombre');
                          const shareNum = parseFloat(partnerShare) || 0;
                          await savePartner({
                            name: partnerName,
                            share: shareNum,
                            isActive: partnerActive,
                            observations: partnerObs
                          }, editingPartnerId || undefined);
                          
                          // Reset Form
                          setPartnerName('');
                          setPartnerShare('50');
                          setPartnerActive(true);
                          setPartnerObs('');
                          setEditingPartnerId(null);
                        }}
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                      >
                        <Save size={16} /> Guardar
                      </button>
                      {editingPartnerId && (
                        <button 
                          onClick={() => {
                            setPartnerName('');
                            setPartnerShare('50');
                            setPartnerActive(true);
                            setPartnerObs('');
                            setEditingPartnerId(null);
                          }}
                          className="btn btn-secondary"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Listado de Socios */}
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '16px' }}>Listado de Socios</h4>
                    {(partners || []).length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No hay socios registrados.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(partners || []).map(p => (
                          <div 
                            key={p.id} 
                            style={{ 
                              padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', 
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              backgroundColor: p.isActive ? 'transparent' : 'var(--bg-secondary)',
                              opacity: p.isActive ? 1 : 0.7
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 700, fontSize: '1rem', marginRight: '8px' }}>{p.name}</span>
                              <span style={{ 
                                padding: '2px 8px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                                backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)'
                              }}>
                                {p.share}% participación
                              </span>
                              {!p.isActive && <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>Inactivo</span>}
                              {p.observations && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{p.observations}</p>}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button 
                                onClick={() => {
                                  setPartnerName(p.name);
                                  setPartnerShare(p.share.toString());
                                  setPartnerActive(p.isActive);
                                  setPartnerObs(p.observations);
                                  setEditingPartnerId(p.id!);
                                }}
                                className="btn btn-icon"
                                style={{ color: '#2563eb', padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                                title="Editar"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={async () => {
                                  if (confirm(`¿Estás seguro de eliminar al socio ${p.name}?`)) {
                                    await deletePartner(p.id!);
                                  }
                                }}
                                className="btn btn-icon"
                                style={{ color: '#dc2626', padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                                title="Eliminar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'monedas' && (
              <Card>
                <CardHeader title="Gestión de Monedas y Tipo de Cambio" subtitle="Administra las monedas de transacción y sus cotizaciones en ARS" />
                <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                  {/* Formulario de Alta de Moneda */}
                  <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h4 style={{ fontWeight: 600, fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      Agregar Moneda
                    </h4>
                    <Input label="Código (e.g. USD, EUR)" value={newCurrencyCode} onChange={e => setNewCurrencyCode(e.target.value.toUpperCase())} placeholder="USD" />
                    <Input label="Símbolo (e.g. U$S, €)" value={newCurrencySymbol} onChange={e => setNewCurrencySymbol(e.target.value)} placeholder="U$S" />
                    <Input label="Tipo de Cambio (en ARS)" type="number" value={newCurrencyRate} onChange={e => setNewCurrencyRate(e.target.value)} placeholder="Cotización..." />
                    
                    <button 
                      onClick={() => {
                        if (!newCurrencyCode || !newCurrencySymbol) return alert('Complete los campos');
                        const rateNum = parseFloat(newCurrencyRate) || 1;
                        const currenciesList = localSettings.currencies || [];
                        const exists = currenciesList.some(c => c.code === newCurrencyCode);
                        if (exists) return alert('La moneda ya existe');
                        
                        const updated = [...currenciesList, { code: newCurrencyCode, symbol: newCurrencySymbol, rate: rateNum }];
                        updateField('currencies', updated);
                        
                        // Reset Form
                        setNewCurrencyCode('');
                        setNewCurrencySymbol('');
                        setNewCurrencyRate('1');
                      }}
                      className="btn btn-primary"
                      style={{ marginTop: '12px' }}
                    >
                      <Plus size={16} /> Agregar Moneda
                    </button>
                  </div>

                  {/* Listado de Monedas & Cotizaciones */}
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '16px' }}>Monedas Habilitadas</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(localSettings.currencies || []).map((curr, idx) => (
                        <div 
                          key={curr.code} 
                          style={{ 
                            padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 700, fontSize: '1.1rem', marginRight: '8px' }}>{curr.code}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>({curr.symbol})</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Tipo de Cambio (1 {curr.code} = x ARS):</span>
                            {curr.code === 'ARS' ? (
                              <span style={{ fontWeight: 600, width: '100px', textAlign: 'right' }}>1.00 (Base)</span>
                            ) : (
                              <input 
                                type="number" 
                                value={curr.rate} 
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  const updated = (localSettings.currencies || []).map((c, i) => i === idx ? { ...c, rate: val } : c);
                                  updateField('currencies', updated);
                                }}
                                style={{ width: '100px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 600 }}
                              />
                            )}
                            {curr.code !== 'ARS' && curr.code !== 'USD' && (
                              <button 
                                onClick={() => {
                                  const updated = (localSettings.currencies || []).filter(c => c.code !== curr.code);
                                  updateField('currencies', updated);
                                }}
                                style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                                title="Eliminar Moneda"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'categorias' && (
              <Card>
                <CardHeader title="Categorías de Gastos y Reinversiones" subtitle="Administra las clasificaciones para un mejor desglose financiero" />
                <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  {/* Panel Categorías de Gastos */}
                  <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <h4 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '16px' }}>Categorías de Gastos</h4>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <input 
                        type="text" 
                        value={newExpenseCategory} 
                        onChange={e => setNewExpenseCategory(e.target.value)} 
                        placeholder="Nueva categoría de gasto..." 
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', outline: 'none' }}
                      />
                      <button 
                        onClick={() => {
                          if (!newExpenseCategory) return;
                          const expList = localSettings.expense_categories || [];
                          if (expList.includes(newExpenseCategory)) return alert('Ya existe');
                          const updated = [...expList, newExpenseCategory];
                          updateField('expense_categories', updated);
                          setNewExpenseCategory('');
                        }}
                        className="btn btn-primary"
                        style={{ padding: '8px 12px' }}
                      >
                        <Plus size={16} /> Add
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                      {(localSettings.expense_categories || []).map((cat) => (
                        <div 
                          key={cat} 
                          style={{ 
                            padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem'
                          }}
                        >
                          <span>{cat}</span>
                          <button 
                            onClick={() => {
                              const updated = (localSettings.expense_categories || []).filter(c => c !== cat);
                              updateField('expense_categories', updated);
                            }}
                            style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Panel Categorías de Reinversión */}
                  <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <h4 style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '16px' }}>Categorías de Reinversión</h4>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <input 
                        type="text" 
                        value={newReinvestmentCategory} 
                        onChange={e => setNewReinvestmentCategory(e.target.value)} 
                        placeholder="Nueva categoría de reinversión..." 
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', outline: 'none' }}
                      />
                      <button 
                        onClick={() => {
                          if (!newReinvestmentCategory) return;
                          const reinvList = localSettings.reinvestment_categories || [];
                          if (reinvList.includes(newReinvestmentCategory)) return alert('Ya existe');
                          const updated = [...reinvList, newReinvestmentCategory];
                          updateField('reinvestment_categories', updated);
                          setNewReinvestmentCategory('');
                        }}
                        className="btn btn-primary"
                        style={{ padding: '8px 12px' }}
                      >
                        <Plus size={16} /> Add
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '300px', overflowY: 'auto' }}>
                      {(localSettings.reinvestment_categories || []).map((cat) => (
                        <div 
                          key={cat} 
                          style={{ 
                            padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem'
                          }}
                        >
                          <span>{cat}</span>
                          <button 
                            onClick={() => {
                              const updated = (localSettings.reinvestment_categories || []).filter(c => c !== cat);
                              updateField('reinvestment_categories', updated);
                            }}
                            style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}

           {/* Botón Guardar Flotante */}
           <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px', 
                  backgroundColor: 'var(--primary-color)', color: 'white', 
                  border: 'none', padding: '12px 24px', borderRadius: '8px', 
                  fontWeight: 600, cursor: isSaving ? 'not-allowed' : 'pointer', 
                  boxShadow: 'var(--shadow-md)', transition: 'background 0.2s',
                  opacity: isSaving ? 0.7 : 1
                }}
              >
                 {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                 {isSaving ? 'Guardando...' : 'Guardar Configuración'}
              </button>
           </div>
        </div>
      </div>

      {/* Modal Premium Confirmación Reset */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', maxWidth: '400px', width: '100%', boxShadow: 'var(--shadow-lg)' }}>
             <div style={{ width: '64px', height: '64px', backgroundColor: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', margin: '0 auto 24px' }}>
                <AlertTriangle size={32} />
             </div>
             <h3 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>¿Resetear Sistema?</h3>
             <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
               Estás a punto de borrar permanentemente toda la base de datos operativa y configuraciones locales. Esta acción <b>no se puede deshacer</b>.
             </p>
             <div style={{ display: 'flex', gap: '16px' }}>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', border: '1px solid var(--border-color)', backgroundColor: 'white', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', border: 'none', backgroundColor: '#dc2626', color: 'white', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Sí, Resetear Todo</button>
             </div>
          </div>
        </div>
      )}
    </>
  );
};
