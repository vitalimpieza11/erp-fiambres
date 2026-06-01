import React, { useState, useEffect } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { LoadingSpinner, ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Input, Select } from '../components/ui/Forms';
import { 
  Search, Plus, Filter, ArrowLeft, Save, FileText, Pickaxe, 
  Settings, DollarSign, TrendingUp, PackageCheck, Scissors,
  ArrowDown, AlertTriangle, Scale, Beaker, CheckCircle2, Loader2
} from 'lucide-react';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { useProductions } from '../hooks/useProductions';
import { useProducts } from '../hooks/useProducts';
import { StockService } from '../services/StockService';

export const Produccion = () => {
  const { productions, loading: loadingProductions, error: errorProductions, createProductionBatch } = useProductions();
  const { products, loading: loadingProducts, error: errorProducts } = useProducts();

  const globalError = errorProductions || errorProducts;


  const [isCreating, setIsCreating] = useState(false);

  // Form States
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [operario, setOperario] = useState('');
  const [observaciones, setObservaciones] = useState('');
  
  const [sourceProductId, setSourceProductId] = useState('');
  const [targetProductId, setTargetProductId] = useState('');
  const [kgHormaStr, setKgHormaStr] = useState('');
  const [gramajeInputStr, setGramajeInputStr] = useState('200');
  const [gramajeUnit, setGramajeUnit] = useState<'g' | 'kg'>('g');
  const [mermaRealKgStr, setMermaRealKgStr] = useState('');
  const [precioVentaStr, setPrecioVentaStr] = useState('');

  const [sourceStock, setSourceStock] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch stock of source product when selected
  useEffect(() => {
    const fetchStock = async () => {
      if (sourceProductId) {
        const stock = await StockService.getStock(sourceProductId);
        setSourceStock(stock);
      } else {
        setSourceStock(0);
      }
    };
    fetchStock();
  }, [sourceProductId]);

  if (globalError) {
    return <ErrorState message={globalError} />;
  }

  const kgHorma = parseNumber(kgHormaStr);
  const gramajeValue = parseNumber(gramajeInputStr);
  const gramaje = gramajeUnit === 'g' ? gramajeValue : gramajeValue * 1000;
  const mermaRealKg = parseNumber(mermaRealKgStr);
  const precioVenta = parseNumber(precioVentaStr);

  // Calculations
  const sourceProduct = products.find(p => p.id === sourceProductId);
  const targetProduct = products.find(p => p.id === targetProductId);

  const costoBaseKg = (sourceProduct && sourceProduct.pesoHorma > 0)
    ? (sourceProduct.costoHorma / sourceProduct.pesoHorma)
    : 0;
  const mermaPorcentaje = kgHorma > 0 ? (mermaRealKg / kgHorma) * 100 : 0;
  
  const kgUtiles = Math.max(0, kgHorma - mermaRealKg);
  const paquetes = gramaje > 0 ? Math.floor((kgUtiles * 1000) / gramaje) : 0;

  const costoMateriaPrima = kgHorma * costoBaseKg;
  // Use configured costs from target product; fallback to 0 to avoid inflating costs with arbitrary defaults
  const costoEmpaque = paquetes * (targetProduct?.costoBolsa ?? 0) + paquetes * (targetProduct?.costoEtiqueta ?? 0);
  const costoManoObra = paquetes * (targetProduct?.manoObra ?? 0);
  const costoTotalLote = costoMateriaPrima + costoEmpaque + costoManoObra;

  const costoXPaquete = paquetes > 0 ? costoTotalLote / paquetes : 0;
  const costoXKgFinal = gramaje > 0 ? costoXPaquete * (1000 / gramaje) : 0;

  const utilidadXPaquete = Math.max(0, precioVenta - costoXPaquete);
  const utilidadTotalLote = utilidadXPaquete * paquetes;
  const margenReal = precioVenta > 0 ? (utilidadXPaquete / precioVenta) * 100 : 0;

  const handleFinishProduction = async () => {
    if (!sourceProductId || !targetProductId) {
      setErrorMessage("Debe seleccionar el producto origen (horma) y el producto destino (paquetes feteados).");
      return;
    }
    if (kgHorma <= 0 || isNaN(kgHorma)) {
      setErrorMessage("Debe ingresar una cantidad de horma válida y mayor a 0.");
      return;
    }
    if (gramaje <= 0 || isNaN(gramaje)) {
      setErrorMessage("Debe ingresar un gramaje o peso por paquete válido y mayor a 0.");
      return;
    }
    if (sourceStock < kgHorma) {
      setErrorMessage(`Stock de horma insuficiente. Disponible: ${sourceStock} kg, Solicitado: ${kgHorma} kg.`);
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const batchData = {
        productId: targetProductId,
        productName: targetProduct?.name || 'Producto Feteado',
        quantityProduced: paquetes,
        rawMaterialsUsed: [
          { productId: sourceProductId, quantity: kgHorma }
        ],
        cost: costoTotalLote,
        mermaPercent: mermaPorcentaje,
        status: 'completed' as const,
        date: new Date(fecha).getTime()
      };

      await createProductionBatch(
        batchData,
        sourceProductId,
        sourceProduct?.name || 'Materia Prima',
        kgHorma
      );

      setIsCreating(false);
      setSourceProductId('');
      setTargetProductId('');
      setKgHormaStr('');
      setMermaRealKgStr('');
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "Error al registrar la producción.");
    } finally {
      setIsSaving(false);
    }
  };

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
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Nueva Producción</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Registro de feteado y fraccionado en tiempo real</p>
            </div>
          </div>
          <button onClick={handleFinishProduction} disabled={isSaving} className="btn btn-primary">
            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Finalizar Producción
          </button>
        </div>

        {errorMessage && (
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', padding: '16px', borderRadius: '12px', color: '#dc2626', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
            <AlertTriangle size={20} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
          
          {/* COLUMNA IZQUIERDA (Operativa) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* SECCIÓN 1 — INFORMACIÓN GENERAL */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <FileText size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>1. Información General</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Input label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
                <Input label="Operario (Opcional)" value={operario} onChange={e => setOperario(e.target.value)} placeholder="Ej: Carlos M." />
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 2 }}>
                    <Input label="Observaciones" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Cualquier eventualidad..." />
                  </div>
                  <div style={{ flex: 1, backgroundColor: 'var(--bg-primary)', padding: '12px 16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Código Producción</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-color)' }}>L-{Date.now().toString().slice(-6)}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* SECCIÓN 2 — SELECCIÓN DE HORMA */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Pickaxe size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>2. Selección de Materia Prima</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Select 
                  label="Producto Origen (Horma a procesar)" 
                  value={sourceProductId}
                  onChange={e => setSourceProductId(e.target.value)}
                  options={[
                    { value: '', label: 'Seleccionar Horma...' },
                    ...products.map(p => ({ value: p.id!, label: `${p.name} (${p.brand})` }))
                  ]} 
                />
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Stock Disp.</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: '#166534' }}>{sourceStock.toFixed(2)} kg</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Costo / Kg</span>
                    <span style={{ fontSize: '1rem', fontWeight: 600 }}>{costoBaseKg > 0 ? formatCurrency(costoBaseKg) : '--'}</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Proveedor</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sourceProduct?.provider || '--'}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* SECCIÓN 3 — PRODUCCIÓN REAL */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Scissors size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>3. Proceso de Feteado</h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                <Select 
                  label="Producto Destino (Paquetes feteados)" 
                  value={targetProductId}
                  onChange={e => setTargetProductId(e.target.value)}
                  options={[
                    { value: '', label: 'Seleccionar Producto de Destino...' },
                    ...products.map(p => ({ value: p.id!, label: `${p.name} (Feteado)` }))
                  ]}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <Input label="Kg de Horma a Utilizar" placeholder="Ej: 5.2" type="number" icon={<Scale size={16} />} value={kgHormaStr} onChange={e => setKgHormaStr(e.target.value)} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Gramaje / Peso por Paquete</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <input 
                        type="number"
                        step="any"
                        value={gramajeInputStr}
                        onChange={e => setGramajeInputStr(e.target.value)}
                        placeholder={gramajeUnit === 'g' ? 'Ej: 200' : 'Ej: 0.2'}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          fontSize: '1rem'
                        }}
                      />
                    </div>
                    <select
                      value={gramajeUnit}
                      onChange={e => setGramajeUnit(e.target.value as 'g' | 'kg')}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        width: '80px',
                        fontSize: '1rem'
                      }}
                    >
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                </div>
                <Input label="Merma Real (kg)" placeholder="Ej: 0.25" type="number" value={mermaRealKgStr} onChange={e => setMermaRealKgStr(e.target.value)} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Merma (%)</label>
                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', fontWeight: 600 }}>
                    {formatNumber(mermaPorcentaje)} %
                  </div>
                </div>
              </div>

              {/* Calculadora Visual Premium */}
              <div style={{ backgroundColor: '#1e293b', borderRadius: '12px', padding: '24px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: '-20px', top: '-20px', opacity: 0.1 }}>
                  <Settings size={150} />
                </div>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px' }}>Simulador de Rendimiento</h4>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <Scale size={24} color="#38bdf8" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{kgHorma > 0 ? formatNumber(kgHorma, 'kg') : '--'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Materia Prima</div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ height: '2px', width: '40px', backgroundColor: '#334155', position: 'relative' }}>
                      <ArrowDown size={14} color="#ef4444" style={{ position: 'absolute', top: '-20px', left: '13px' }} />
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <Beaker size={24} color="#ef4444" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fca5a5' }}>{mermaRealKg > 0 ? formatNumber(mermaRealKg, 'kg') : '--'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Merma ({formatNumber(mermaPorcentaje)}%)</div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ height: '2px', width: '40px', backgroundColor: '#334155', position: 'relative' }}>
                      <ArrowDown size={14} color="#22c55e" style={{ position: 'absolute', top: '-20px', left: '13px' }} />
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', flex: 1, backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '12px', borderRadius: '8px' }}>
                    <PackageCheck size={24} color="#22c55e" style={{ marginBottom: '8px' }} />
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#4ade80' }}>{paquetes > 0 ? paquetes : '--'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>PAQUETES ({gramaje > 0 ? gramaje : '--'}g)</div>
                  </div>
                </div>
              </div>

            </Card>
          </div>

          {/* COLUMNA DERECHA (Costos y Finanzas) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* SECCIÓN 4 — COSTOS */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <DollarSign size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>4. Costos de Lote</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Materia Prima ({kgHorma} kg)</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(costoMateriaPrima)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Empaque (Bolsa + Etiqueta, {paquetes} un.)</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(costoEmpaque)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Mano de Obra</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(costoManoObra)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', marginTop: '8px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 700 }}>Costo Total Lote</span>
                  <span style={{ fontSize: '1.125rem', fontWeight: 700 }}>{formatCurrency(costoTotalLote)}</span>
                </div>
                
                <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>COSTO X PAQUETE</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{costoXPaquete > 0 ? formatCurrency(costoXPaquete) : '--'}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>COSTO X KG (Final)</span>
                    <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{costoXKgFinal > 0 ? formatCurrency(costoXKgFinal) : '--'}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* SECCIÓN 5 — RENTABILIDAD */}
            <Card style={{ borderTop: '4px solid #16a34a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <TrendingUp size={20} color="#16a34a" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>5. Rentabilidad</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Precio Venta Sugerido</span>
                    <Input label="" type="number" value={precioVentaStr} onChange={e => setPrecioVentaStr(e.target.value)} icon={<DollarSign size={16} />} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '10px' }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Margen Real</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: margenReal >= 40 ? '#16a34a' : '#d97706' }}>
                      {margenReal > 0 ? formatNumber(margenReal, '%') : '--'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Utilidad x Paquete</span>
                    <span style={{ fontSize: '1.125rem', fontWeight: 600, color: utilidadXPaquete > 0 ? '#16a34a' : 'var(--text-primary)' }}>{utilidadXPaquete !== 0 ? formatCurrency(utilidadXPaquete) : '--'}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Utilidad Total Lote</span>
                    <span style={{ fontSize: '1.125rem', fontWeight: 700, color: utilidadTotalLote > 0 ? '#16a34a' : 'var(--text-primary)' }}>{utilidadTotalLote !== 0 ? formatCurrency(utilidadTotalLote) : '--'}</span>
                  </div>
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
        <PageHeader title="Producción y Feteado" description="Gestión operativa de fraccionamiento de fiambres" />
        <button 
          onClick={() => {
            setIsCreating(true);
            setErrorMessage(null);
          }}
          className="btn btn-primary"
        >
          <Plus size={18} />
          Nueva Producción
        </button>
      </div>

      <Card padding="none">
        <div style={{ padding: '20px', display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input 
              type="text" 
              placeholder="Buscar por lote o producto..." 
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
            />
          </div>
        </div>

        {loadingProductions ? (
          <SkeletonLoader rows={4} height="52px" />
        ) : productions.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState 
              icon={Pickaxe} 
              title="No hay lotes producidos" 
              description="Comienza un nuevo proceso de feteado y fraccionado de hormas." 
            />
          </div>
        ) : (
          <Table 
            data={productions}
            keyExtractor={(item) => item.id!}
            columns={[
              { header: 'Lote', accessor: (item) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.id?.slice(-6).toUpperCase()}</span>, width: '120px' },
              { header: 'Fecha', accessor: (item) => new Date(item.date).toLocaleDateString() },
              { 
                header: 'Producto Terminado', 
                accessor: (item) => <span style={{ fontWeight: 600 }}>{item.productName}</span> 
              },
              { header: 'Paquetes', accessor: (item) => `${item.quantityProduced} paq.`, align: 'right' },
              { header: 'Merma', accessor: (item) => `${item.mermaPercent.toFixed(1)} %`, align: 'right' },
              { header: 'Costo Lote', accessor: (item) => formatCurrency(item.cost), align: 'right' },
              { 
                header: 'Estado', 
                accessor: (item) => (
                  <span style={{ 
                    padding: '4px 12px', 
                    borderRadius: '9999px', 
                    fontSize: '0.75rem', 
                    fontWeight: 600,
                    backgroundColor: item.status === 'completed' ? '#dcfce7' : '#f1f5f9',
                    color: item.status === 'completed' ? '#166534' : '#475569'
                  }}>
                    Completado
                  </span>
                ),
                align: 'center'
              },
            ]}
          />
        )}
      </Card>
    </>
  );
};
export default Produccion;
