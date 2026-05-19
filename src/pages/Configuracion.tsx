import React, { useState, useEffect } from 'react';
import { 
  Building2, Briefcase, FileText, Package, Users, Landmark, MonitorSmartphone,
  Save, Download, Upload, RotateCcw, Image, FileBadge2, Check, ShieldCheck, AlertTriangle, Loader2, CheckCircle2
} from 'lucide-react';
import { PageHeader } from '../components/EmptyState';
import { Card, CardHeader } from '../components/ui/Card';
import { Input, Select, Toggle } from '../components/ui/Forms';
import { useSettings, type SystemSettings } from '../hooks/useSettings';

export const Configuracion = () => {
  const [activeTab, setActiveTab] = useState('empresa');
  const [showModal, setShowModal] = useState(false);
  
  const { settings, saveSettings, loading } = useSettings();
  const [localSettings, setLocalSettings] = useState<SystemSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                     <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Bancos Operativos</label>
                     <textarea style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', minHeight: '80px', fontFamily: 'inherit' }} value={localSettings.tesoreria_bancos} onChange={e => updateField('tesoreria_bancos', e.target.value)} />
                     <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Un banco por línea</span>
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
