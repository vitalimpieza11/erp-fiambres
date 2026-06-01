import React, { useState, useEffect } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { LoadingSpinner, ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Input, Select, Toggle } from '../components/ui/Forms';
import { Search, Plus, Filter, ArrowLeft, Save, Info, DollarSign, Package, Tag, TrendingUp, Layers, Loader2, Edit2 } from 'lucide-react';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { useProducts, type Product } from '../hooks/useProducts';
import { calculateProductMetrics } from '../core/calculations';

export const Productos = () => {
  const { products, loading, error, saveProduct } = useProducts();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('fiambres');
  const [brand, setBrand] = useState('');
  const [provider, setProvider] = useState('');
  const [observations, setObservations] = useState('');
  const [isActive, setIsActive] = useState(true);

  // States for calculations
  const [costoHormaStr, setCostoHormaStr] = useState('');
  const [pesoHormaStr, setPesoHormaStr] = useState('');
  
  const [pesoFetaStr, setPesoFetaStr] = useState('');
  const [mermaEstimadaStr, setMermaEstimadaStr] = useState('');
  const [gramajeVentaStr, setGramajeVentaStr] = useState('200');
  
  const [costoBolsaStr, setCostoBolsaStr] = useState('');
  const [costoEtiquetaStr, setCostoEtiquetaStr] = useState('');
  const [manoObraStr, setManoObraStr] = useState('');
  
  const [margenDeseadoStr, setMargenDeseadoStr] = useState('');
  const [precioManualStr, setPrecioManualStr] = useState('');

  // No early-return on error here — we still allow viewing the list when Firestore
  // has a temporary error after a save, to avoid a blank-screen regression.

  const openForm = (prod?: Product) => {
    if (prod) {
      setEditingId(prod.id!);
      setName(prod.name);
      setCategory(prod.category);
      setBrand(prod.brand);
      setProvider(prod.provider);
      setObservations(prod.observations);
      setIsActive(prod.isActive);
      
      setCostoHormaStr(prod.costoHorma.toString());
      setPesoHormaStr(prod.pesoHorma.toString());
      setPesoFetaStr(prod.pesoFeta.toString());
      setMermaEstimadaStr(prod.mermaEstimada.toString());
      setGramajeVentaStr(prod.gramajeVenta.toString());
      setCostoBolsaStr(prod.costoBolsa.toString());
      setCostoEtiquetaStr(prod.costoEtiqueta.toString());
      setManoObraStr(prod.manoObra.toString());
      setMargenDeseadoStr(prod.margenDeseado.toString());
      setPrecioManualStr(prod.precioManual > 0 ? prod.precioManual.toString() : '');
    } else {
      setEditingId(null);
      setName('');
      setCategory('fiambres');
      setBrand('');
      setProvider('');
      setObservations('');
      setIsActive(true);
      
      setCostoHormaStr('');
      setPesoHormaStr('');
      setPesoFetaStr('');
      setMermaEstimadaStr('');
      setGramajeVentaStr('200');
      setCostoBolsaStr('');
      setCostoEtiquetaStr('');
      setManoObraStr('');
      setMargenDeseadoStr('');
      setPrecioManualStr('');
    }
    setIsFormOpen(true);
  };

  const resetFormStates = () => {
    setEditingId(null);
    setName('');
    setCategory('fiambres');
    setBrand('');
    setProvider('');
    setObservations('');
    setIsActive(true);
    setCostoHormaStr('');
    setPesoHormaStr('');
    setPesoFetaStr('');
    setMermaEstimadaStr('');
    setGramajeVentaStr('200');
    setCostoBolsaStr('');
    setCostoEtiquetaStr('');
    setManoObraStr('');
    setMargenDeseadoStr('');
    setPrecioManualStr('');
  };

  const handleSave = async () => {
    if (!name) return;
    setIsSaving(true);
    try {
      await saveProduct({
        name, category, brand, provider, observations, isActive,
        costoHorma: parseNumber(costoHormaStr),
        pesoHorma: parseNumber(pesoHormaStr),
        pesoFeta: parseNumber(pesoFetaStr),
        mermaEstimada: parseNumber(mermaEstimadaStr),
        gramajeVenta: parseNumber(gramajeVentaStr),
        costoBolsa: parseNumber(costoBolsaStr),
        costoEtiqueta: parseNumber(costoEtiquetaStr),
        manoObra: parseNumber(manoObraStr),
        margenDeseado: parseNumber(margenDeseadoStr),
        precioManual: parseNumber(precioManualStr),
      }, editingId || undefined);
      resetFormStates();
      setIsFormOpen(false);
    } catch (e) {
      alert('Error guardando producto. Revisá la consola.');
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (error && !isFormOpen) {
    return <ErrorState message={error} />;
  }

  if (isFormOpen) {
    const {
      costoKg,
      kgNetos,
      paquetesEstimados,
      costoMateriaPrimaPorPaq,
      costoTotalPaquete,
      precioSugerido,
      precioVenta,
      utilidadNetaPaquete,
      margenReal,
      utilidadKg,
      hasValidData
    } = calculateProductMetrics({
      costoHorma: costoHormaStr,
      pesoHorma: pesoHormaStr,
      mermaEstimada: mermaEstimadaStr,
      gramajeVenta: gramajeVentaStr,
      costoBolsa: costoBolsaStr,
      costoEtiqueta: costoEtiquetaStr,
      manoObra: manoObraStr,
      margenDeseado: margenDeseadoStr,
      precioManual: precioManualStr
    });
    return (
      <div style={{ paddingBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={() => { resetFormStates(); setIsFormOpen(false); }} className="btn btn-icon">
              <ArrowLeft size={20} color="var(--text-secondary)" />
            </button>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{editingId ? 'Editar Producto' : 'Nuevo Producto'}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Ficha técnica y costos para feteado/fraccionado</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={isSaving} className="btn btn-primary">
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Guardar Producto
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Info size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>1. Datos Generales</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <Input label="Nombre del Producto" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Jamón Cocido Paladini" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <Select label="Categoría" value={category} onChange={e => setCategory(e.target.value)} options={[{ value: 'fiambres', label: 'Fiambres' }, { value: 'lacteos', label: 'Lácteos' }]} />
                  <Input label="Marca" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Ej: Paladini" />
                </div>
                <Input label="Proveedor Principal" value={provider} onChange={e => setProvider(e.target.value)} placeholder="Distribuidora XYZ" />
                <Input label="Observaciones" value={observations} onChange={e => setObservations(e.target.value)} placeholder="Notas internas sobre el producto..." />
                <div style={{ marginTop: '8px', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px' }}>
                  <Toggle label="Estado del Producto (Activo/Inactivo)" checked={isActive} onChange={setIsActive} />
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Layers size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>3. Producción y Rinde</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Input label="Peso Promedio x Feta (g)" placeholder="Ej: 15" type="number" value={pesoFetaStr} onChange={e => setPesoFetaStr(e.target.value)} />
                <Input label="Merma Estimada (%)" placeholder="Ej: 5" type="number" value={mermaEstimadaStr} onChange={e => setMermaEstimadaStr(e.target.value)} />
                <Select label="Gramaje de Venta" value={gramajeVentaStr} onChange={e => setGramajeVentaStr(e.target.value)} options={[
                  { value: '100', label: '100g' },
                  { value: '150', label: '150g' },
                  { value: '200', label: '200g' },
                  { value: '250', label: '250g' },
                  { value: '500', label: '500g' },
                ]} />
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Paquetes Estimados (Horma)</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{paquetesEstimados > 0 ? `${paquetesEstimados} paq.` : '--'}</span>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Package size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>4. Empaque y Operación</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <Input label="Costo Bolsa ($)" type="number" placeholder="15.00" icon={<DollarSign size={16} />} value={costoBolsaStr} onChange={e => setCostoBolsaStr(e.target.value)} />
                <Input label="Costo Etiqueta ($)" type="number" placeholder="8.50" icon={<DollarSign size={16} />} value={costoEtiquetaStr} onChange={e => setCostoEtiquetaStr(e.target.value)} />
                <Input label="Mano de Obra ($)" type="number" placeholder="45.00" icon={<DollarSign size={16} />} value={manoObraStr} onChange={e => setManoObraStr(e.target.value)} />
              </div>
            </Card>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <DollarSign size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>2. Costos de Compra</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Input label="Costo Horma ($)" type="number" placeholder="Ej: 45000" icon={<DollarSign size={16} />} value={costoHormaStr} onChange={e => setCostoHormaStr(e.target.value)} />
                <Input label="Peso Horma (kg)" type="number" placeholder="Ej: 5.2" value={pesoHormaStr} onChange={e => setPesoHormaStr(e.target.value)} />
                <div style={{ gridColumn: '1 / -1', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#166534', fontWeight: 600, fontSize: '0.875rem' }}>Costo Calculado por KG</span>
                  <span style={{ color: '#166534', fontWeight: 700, fontSize: '1.25rem' }}>{costoKg > 0 ? formatCurrency(costoKg) : '--'}</span>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Tag size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>5. Configuración de Precio</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Input label="Margen Deseado (%)" type="number" placeholder="Ej: 45" value={margenDeseadoStr} onChange={e => setMargenDeseadoStr(e.target.value)} />
                <Input label="Precio Competencia ($)" type="number" placeholder="Opcional" icon={<DollarSign size={16} />} />
                
                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px' }}>
                  <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '8px' }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>Precio Sugerido (por Paquete)</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{precioSugerido > 0 ? formatCurrency(precioSugerido) : '--'}</span>
                  </div>
                  <Input label="Precio Manual Editable ($)" type="number" placeholder="1250" icon={<DollarSign size={16} />} value={precioManualStr} onChange={e => setPrecioManualStr(e.target.value)} />
                </div>
              </div>
            </Card>

            <Card className="card-highlight">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <TrendingUp size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>6. Análisis de Rentabilidad</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Utilidad Neta por Paquete</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: hasValidData ? (utilidadNetaPaquete >= 0 ? '#16a34a' : '#dc2626') : 'var(--text-primary)' }}>
                    {hasValidData ? formatCurrency(utilidadNetaPaquete) : '--'}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Margen Real</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: hasValidData ? (margenReal >= 0 ? 'var(--text-primary)' : '#dc2626') : 'var(--text-primary)' }}>
                    {hasValidData ? formatNumber(margenReal, '%') : '--'}
                  </span>
                </div>
                <div style={{ gridColumn: '1 / -1', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Utilidad por KG vendido</span>
                  <span style={{ fontSize: '1.125rem', fontWeight: 600, color: hasValidData ? (utilidadKg >= 0 ? 'var(--text-primary)' : '#dc2626') : 'var(--text-primary)' }}>
                    {hasValidData ? formatCurrency(utilidadKg) : '--'}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <PageHeader title="Catálogo de Productos" description="Gestión maestra de fiambres y lácteos" />
        <button onClick={() => openForm()} className="btn btn-primary">
          <Plus size={18} /> Nuevo Producto
        </button>
      </div>

      <Card padding="none">
        <div style={{ padding: '20px', display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input type="text" placeholder="Buscar por nombre, marca o código..." style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} />
          </div>
        </div>
        
        {loading ? (
          <SkeletonLoader rows={5} height="56px" />
        ) : products.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState 
              icon={Package} 
              title="No hay productos registrados" 
              description="Registra un nuevo producto para configurar sus especificaciones, mermas y costos." 
            />
          </div>
        ) : (
          <Table 
            data={products}
            keyExtractor={(item) => item.id!}
            columns={[
              { 
                header: 'Producto', 
                accessor: (item) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.brand} • {item.category}</div>
                  </div>
                ) 
              },
              { 
                header: 'Costo/Kg', 
                accessor: (item) => {
                  const kg = item.pesoHorma > 0 ? item.costoHorma / item.pesoHorma : 0;
                  return <span style={{ fontWeight: 500 }}>{formatCurrency(kg)}</span>;
                }
              },
              { 
                header: 'Precio Ref. (Paq)', 
                accessor: (item) => {
                  const kgNetos = item.pesoHorma * (1 - (item.mermaEstimada || 0) / 100);
                  const paqEst = item.gramajeVenta > 0 ? Math.floor((kgNetos * 1000) / item.gramajeVenta) : 0;
                  const cMat = paqEst > 0 ? item.costoHorma / paqEst : 0;
                  const cTot = paqEst > 0 ? cMat + item.costoBolsa + item.costoEtiqueta + item.manoObra : 0;
                  const sug = cTot > 0 ? cTot * (1 + item.margenDeseado / 100) : 0;
                  const pVenta = item.precioManual > 0 ? item.precioManual : sug;
                  return <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{formatCurrency(pVenta)}</span>;
                }
              },
              { 
                header: 'Estado', 
                accessor: (item) => (
                  <span style={{ 
                    padding: '4px 12px', 
                    borderRadius: '9999px', 
                    fontSize: '0.75rem', 
                    fontWeight: 600,
                    backgroundColor: item.isActive ? '#dcfce7' : '#fef2f2',
                    color: item.isActive ? '#166534' : '#991b1b'
                  }}>
                    {item.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                ),
                align: 'center'
              },
              {
                header: '',
                accessor: (item) => (
                  <button onClick={() => openForm(item)} className="btn btn-icon" title="Editar">
                    <Edit2 size={16} />
                  </button>
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
