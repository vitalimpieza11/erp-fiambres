import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { Save, Layers, ToggleLeft, ToggleRight, Info, AlertTriangle } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function SistemaConfig() {
  const { settings, loading, fetchSettings, updateSettings } = useSettingsStore();
  const [usePackages, setUsePackages] = useState(false);
  const [allowNegativeStock, setAllowNegativeStock] = useState(true);
  const [margenObjetivo, setMargenObjetivo] = useState(35);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings().then((res) => {
      setUsePackages(res.usePackages);
      setAllowNegativeStock(res.allowNegativeStock ?? true);
      setMargenObjetivo(res.margenObjetivo ?? 35);
    });
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({ usePackages, allowNegativeStock, margenObjetivo });
      alert("Configuración del sistema guardada con éxito.");
    } catch (e) {
      alert("Error al guardar la configuración.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !saving) return <LoadingSpinner message="Cargando parámetros del sistema..." />;

  return (
    <div className="apple-card" style={{ padding: '32px', maxWidth: '650px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <Layers size={28} color="var(--alvacio-red)" />
        <h3 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Parámetros Generales del Sistema</h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Toggle Trazabilidad */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', backgroundColor: 'var(--bg-color)', padding: '20px', borderRadius: '16px' }}>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>Trazabilidad Física por Paquetes</h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Active el control físico detallado por lotes/paquetes. Cada paquete tendrá su propio peso real, costo de receta congelado y snapshot histórico al momento de elaboración.
            </p>
          </div>
          <button 
            type="button"
            onClick={() => setUsePackages(!usePackages)}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              color: usePackages ? 'var(--alvacio-red)' : 'var(--text-secondary)',
              padding: 0
            }}
          >
            {usePackages ? <ToggleRight size={48} /> : <ToggleLeft size={48} />}
          </button>
        </div>

        {/* Toggle Stock Negativo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', backgroundColor: allowNegativeStock ? 'rgba(245, 158, 11, 0.05)' : 'var(--bg-color)', padding: '20px', borderRadius: '16px', border: allowNegativeStock ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent' }}>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} color={allowNegativeStock ? '#f59e0b' : 'var(--text-secondary)'} />
              Permitir Ventas con Stock Negativo
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {allowNegativeStock
                ? <><strong>Activado:</strong> El sistema registra la operación aunque no haya stock suficiente. El stock puede quedar negativo (ej: −4.25 Kg). Se mostrará una advertencia visual en Stock y Dashboard, pero la venta no se bloqueará.</>
                : <><strong>Desactivado:</strong> Las ventas serán bloqueadas si el stock disponible es insuficiente. El sistema impedirá emitir remitos que superen el stock registrado.</>
              }
            </p>
          </div>
          <button 
            type="button"
            onClick={() => setAllowNegativeStock(!allowNegativeStock)}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              color: allowNegativeStock ? '#f59e0b' : 'var(--text-secondary)',
              padding: 0
            }}
          >
            {allowNegativeStock ? <ToggleRight size={48} /> : <ToggleLeft size={48} />}
          </button>
        </div>

        {/* Margen Objetivo Global */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', backgroundColor: 'var(--bg-color)', padding: '20px', borderRadius: '16px' }}>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
              Margen Objetivo Global (%)
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Define el margen de ganancia esperado sobre el costo total de la receta. Este valor se utiliza para calcular dinámicamente el <strong>Precio Sugerido por Kg</strong> de las presentaciones.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="number" 
              min="0"
              max="99"
              step="0.1"
              value={margenObjetivo || ''} 
              onChange={e => setMargenObjetivo(Number(e.target.value))}
              style={{ width: '80px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '16px', fontWeight: 600, textAlign: 'center' }}
            />
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>%</span>
          </div>
        </div>

        {/* Info panel based on selection */}
        <div style={{ display: 'flex', gap: '12px', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(239, 68, 68, 0.03)' }}>
          <Info size={20} color="var(--alvacio-red)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
            {usePackages ? (
              <span>
                <strong>Modo Completo Activo:</strong> La producción de fiambre feteado registrará paquetes individuales numerados. En facturación, la entrega se validará contra paquetes físicos disponibles en cámara de frío.
              </span>
            ) : (
              <span>
                <strong>Modo Simplificado Activo:</strong> La producción y facturación se operan en base a cantidades agregadas (`stockActual`). No se registran códigos ni lotes de paquetes físicos.
              </span>
            )}
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <button 
            className="btn-primary" 
            onClick={handleSave} 
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
          >
            <Save size={18} />
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>
    </div>
  );
}
