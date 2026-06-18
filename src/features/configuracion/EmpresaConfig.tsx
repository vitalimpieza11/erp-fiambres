import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { Save, Building2, Upload, Trash2, Info } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function EmpresaConfig() {
  const { settings, loading, fetchSettings, updateSettings } = useSettingsStore();
  const [razonSocial, setRazonSocial] = useState('');
  const [nombreComercial, setNombreComercial] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [provincia, setProvincia] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [cuit, setCuit] = useState('');
  const [condicionIva, setCondicionIva] = useState('');
  const [ingresosBrutos, setIngresosBrutos] = useState('');
  const [observacionesLegales, setObservacionesLegales] = useState('');
  const [logo, setLogo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings().then((res) => {
      setRazonSocial(res.companyRazonSocial || '');
      setNombreComercial(res.companyNombreComercial || '');
      setDireccion(res.companyDireccion || '');
      setCiudad(res.companyCiudad || '');
      setProvincia(res.companyProvincia || '');
      setTelefono(res.companyTelefono || '');
      setEmail(res.companyEmail || '');
      setCuit(res.companyCuit || '');
      setCondicionIva(res.companyCondicionIva || '');
      setIngresosBrutos(res.companyIngresosBrutos || '');
      setObservacionesLegales(res.companyObservacionesLegales || '');
      setLogo(res.companyLogo || '');
    });
  }, [fetchSettings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogo('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings({
        companyRazonSocial: razonSocial,
        companyNombreComercial: nombreComercial,
        companyDireccion: direccion,
        companyCiudad: ciudad,
        companyProvincia: provincia,
        companyTelefono: telefono,
        companyEmail: email,
        companyCuit: cuit,
        companyCondicionIva: condicionIva,
        companyIngresosBrutos: ingresosBrutos,
        companyObservacionesLegales: observacionesLegales,
        companyLogo: logo,
      });
      alert("Configuración de empresa guardada con éxito.");
    } catch (err) {
      alert("Error al guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !saving) return <LoadingSpinner message="Cargando configuración de la empresa..." />;

  return (
    <div className="apple-card" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <Building2 size={28} color="var(--alvacio-red)" />
        <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Datos Corporativos de la Empresa</h3>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Logo Section */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', backgroundColor: 'var(--bg-color)', padding: '20px', borderRadius: '16px' }}>
          <div style={{ width: '120px', height: '120px', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', overflow: 'hidden', position: 'relative' }}>
            {logo ? (
              <img src={logo} alt="Logo Empresa" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            ) : (
              <Building2 size={40} style={{ color: 'var(--text-secondary)' }} />
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Logo de la Empresa</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Recomendado: Imagen PNG cuadrada con fondo transparente (max 200KB).</span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <label className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '8px 16px', fontSize: '13px' }}>
                <Upload size={16} /> Subir Logo
                <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
              </label>
              {logo && (
                <button type="button" className="btn-danger" onClick={handleRemoveLogo} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}>
                  <Trash2 size={16} /> Quitar
                </button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>Razón Social *</label>
            <input required type="text" value={razonSocial} onChange={e => setRazonSocial(e.target.value)} placeholder="Ej. Al Vacío S.A." />
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>Nombre Comercial</label>
            <input type="text" value={nombreComercial} onChange={e => setNombreComercial(e.target.value)} placeholder="Ej. Al Vacío" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>Dirección *</label>
            <input required type="text" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Ej. Pablo Buitrago 5996" />
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>Ciudad *</label>
            <input required type="text" value={ciudad} onChange={e => setCiudad(e.target.value)} placeholder="Ej. Córdoba" />
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>Provincia *</label>
            <input required type="text" value={provincia} onChange={e => setProvincia(e.target.value)} placeholder="Ej. Córdoba" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>Teléfono *</label>
            <input required type="text" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej. 3513938769" />
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>Email *</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Ej. info@alvacio.com.ar" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>CUIT *</label>
            <input required type="text" value={cuit} onChange={e => setCuit(e.target.value)} placeholder="Ej. 20-39494658-4" />
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>Condición frente al IVA *</label>
            <select required value={condicionIva} onChange={e => setCondicionIva(e.target.value)}>
              <option value="">Seleccione...</option>
              <option value="Monotributista">Monotributista</option>
              <option value="Responsable Inscripto">Responsable Inscripto</option>
              <option value="Exento">Exento</option>
              <option value="Consumidor Final">Consumidor Final</option>
            </select>
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>Ingresos Brutos *</label>
            <input required type="text" value={ingresosBrutos} onChange={e => setIngresosBrutos(e.target.value)} placeholder="Ej. No Inscripto o 20-39494658-4" />
          </div>
        </div>

        <div className="form-group">
          <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>Observaciones Legales / Leyendas en Pie de Página</label>
          <textarea rows={3} value={observacionesLegales} onChange={e => setObservacionesLegales(e.target.value)} placeholder="Ej. El presente remito documenta el traslado de mercaderías. DOCUMENTO NO VÁLIDO COMO FACTURA." />
        </div>

        <div style={{ display: 'flex', gap: '12px', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(196, 49, 38, 0.03)' }}>
          <Info size={20} color="var(--alvacio-red)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            Estos datos corporativos se utilizarán para generar los encabezados, pies de página y sellos fiscales en todos los comprobantes PDF (Remitos, Listas de Precios, etc.) generados por el ERP.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}>
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar Empresa'}
          </button>
        </div>
      </form>
    </div>
  );
}
