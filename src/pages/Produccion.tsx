import React, { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { useOrders } from '../hooks/useOrders';
import { usePresentaciones } from '../hooks/usePresentaciones';
import { useMercaderias } from '../hooks/useMercaderias';
import { useInsumos } from '../hooks/useInsumos';
import { useRecipes } from '../hooks/useRecipes';
import { useDateFilter } from '../contexts/DateFilterContext';
import { Play, CheckCircle, ClipboardList, Calendar, ShoppingBag, Layers, Scissors, Package, Printer, ChevronDown, ChevronRight } from 'lucide-react';
import { getIngredientGrams } from '../core/calculations';
import { IngredientInput } from '../components/IngredientInput';
import type { Presentacion, Mercaderia, Recipe, Order, OrderItem } from '../types/database';
import { formatNumber, parseNumber, formatCurrency } from '../utils/format';

type ConsumptionUnit = 'g' | 'kg' | 'fetas' | 'unidades';

const WeightInput = ({ value, onChange }: { value: number, onChange: (val: number) => void }) => {
  const [strVal, setStrVal] = useState(value === 0 ? '' : value.toString());

  useEffect(() => {
    // Only update local state if the incoming value differs numerically from what we have
    if (parseNumber(strVal) !== value) {
      setStrVal(value === 0 ? '' : value.toString());
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/[^0-9.,]/g, '');
    val = val.replace(',', '.'); // normalize to dot
    setStrVal(val);
    const parsed = parseNumber(val);
    onChange(parsed);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={strVal}
      onChange={handleChange}
      style={{ width: '60px', padding: '2px 4px', borderRadius: '2px', border: '1px solid #94a3b8', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600 }}
      placeholder="0.000"
    />
  );
};

function buildIngredientRows(item: OrderItem, pres: Presentacion, recipe: Recipe | undefined, mercaderias: Mercaderia[]): any[] {
  if (pres.productoBaseId) {
    const merc = mercaderias.find(m => m.id === pres.productoBaseId);
    const totalWeightKg = (pres.pesoObjetivoGramos * item.quantity) / 1000;
    return [{ productId: pres.productoBaseId, name: merc?.name || 'Materia Prima', theoreticalQty: totalWeightKg, unit: 'kg' }];
  }
  if (!recipe) return [];
  return recipe.ingredients.map(ing => {
    const merc = mercaderias.find(m => m.id === ing.productId);
    const parts = (ing.productName || '').split(' @');
    const name = merc?.name || parts[0] || 'Ingrediente';
    const suffixUnit = parts[1] as ConsumptionUnit | undefined;
    const totalGrams = getIngredientGrams(ing, recipe.method, pres, merc) * item.quantity;
    const originalUnit: ConsumptionUnit = suffixUnit || (recipe.method === 'fetas' ? 'fetas' : recipe.method === 'weight' ? 'kg' : 'g');
    const recipeFetaWeight = (pres.pesoObjetivoGramos && pres.cantidadFetasEstimada) ? pres.pesoObjetivoGramos / pres.cantidadFetasEstimada : (merc?.pesoFeta || 15);
    let theoreticalQty = totalGrams;
    if (originalUnit === 'kg') theoreticalQty = totalGrams / 1000;
    else if (originalUnit === 'fetas' || originalUnit === 'unidades') theoreticalQty = recipeFetaWeight > 0 ? totalGrams / recipeFetaWeight : 0;
    return { productId: ing.productId, name, theoreticalQty, unit: originalUnit, isMercaderia: !!merc };
  });
}

export const Produccion = () => {
  const { orders, loading: loadingOrders, error: errorOrders, updateOrderStatus } = useOrders();
  const { presentaciones, loading: loadingPres } = usePresentaciones();
  const { mercaderias, loading: loadingMerc } = useMercaderias();
  const { insumos, loading: loadingIns } = useInsumos();
  const { recipes, loading: loadingRec } = useRecipes();
  const { filterDate } = useDateFilter();

  const [activeTab, setActiveTab] = useState<'maestro' | 'corte' | 'empaque' | 'pedidos'>('maestro');

  const [actualConsumptions, setActualConsumptions] = useState<Record<string, { value: number; unit: string }>>({});
  const [actualProduced, setActualProduced] = useState<Record<string, number[]>>({});

  useEffect(() => {
    if (!orders.length) return;
    const loadedConsumptions: Record<string, { value: number; unit: string }> = {};
    const loadedProduced: Record<string, number[]> = {};
    orders.forEach(order => {
      if (order.actualConsumptions) Object.assign(loadedConsumptions, order.actualConsumptions);
      if (order.actualProduced) Object.assign(loadedProduced, order.actualProduced);
    });
    setActualConsumptions(prev => ({ ...loadedConsumptions, ...prev }));
    setActualProduced(prev => ({ ...loadedProduced, ...prev }));
  }, [orders]);

  const handleChangeValue = async (orderId: string, itemId: string, productId: string, value: number) => {
    const stateKey = `${orderId}_${itemId}_${productId}`;
    const newConsumptions = { ...actualConsumptions, [stateKey]: { ...(actualConsumptions[stateKey] || {}), value, unit: actualConsumptions[stateKey]?.unit || 'g' } };
    setActualConsumptions(newConsumptions);
    try { await updateDoc(doc(db, 'orders', orderId), { actualConsumptions: newConsumptions }); } catch (e) { console.error('Error saving draft:', e); }
  };

  const handleChangeUnit = async (orderId: string, itemId: string, productId: string, unit: ConsumptionUnit) => {
    const stateKey = `${orderId}_${itemId}_${productId}`;
    const newConsumptions = { ...actualConsumptions, [stateKey]: { ...(actualConsumptions[stateKey] || {}), unit, value: actualConsumptions[stateKey]?.value || 0 } };
    setActualConsumptions(newConsumptions);
    try { await updateDoc(doc(db, 'orders', orderId), { actualConsumptions: newConsumptions }); } catch (e) { console.error('Error saving draft:', e); }
  };

  const handleChangeProducedWeights = async (orderId: string, productId: string, weights: number[]) => {
    const stateKey = `${orderId}_${productId}`;
    const newProduced = { ...actualProduced, [stateKey]: weights };
    setActualProduced(newProduced);
    try { await updateDoc(doc(db, 'orders', orderId), { actualProduced: newProduced }); } catch (e) { console.error('Error saving draft:', e); }
  };

  const handleTransitionStatus = async (orderId: string, status: Order['status']) => {
    try { await updateOrderStatus(orderId, status); } catch (e: any) { alert('Error al actualizar estado: ' + e.message); }
  };

  const handleDeliverOrder = async (order: Order) => {
    const customConsumptions: Record<string, number> = {};
    const customProduced: Record<string, number[]> = {};
    let totalMpInKg = 0;
    let totalProdOutKg = 0;

    order.items.forEach((item) => {
      const pres = presentaciones.find(p => p.id === item.productId);
      if (!pres) return;
      const prodKey = `${order.id}_${item.productId}`;
      if (actualProduced[prodKey] !== undefined) {
          customProduced[item.productId] = actualProduced[prodKey];
          totalProdOutKg += actualProduced[prodKey].reduce((a, b) => a + b, 0);
      }
      let recipe = recipes.find(r => pres.recipeId && r.id === pres.recipeId);
      if (!recipe) {
        recipe = recipes.find(r => pres.recetaId && r.id === pres.recetaId);
      }
      if (!recipe) {
        recipe = recipes.find(r => r.productId && item.productId && r.productId === item.productId);
      }
      if (!recipe) {
        recipe = recipes.find(r => 
          r.productId && pres.productoBaseId && r.productId === pres.productoBaseId && 
          r.customerId && pres.customerId && r.customerId === pres.customerId
        );
      }
      const rows = buildIngredientRows(item, pres, recipe, mercaderias);
      rows.forEach(row => {
        const stateKey = `${order.id}_${item.productId}_${row.productId}`;
        const currentInput = order.actualConsumptions?.[stateKey] || actualConsumptions[stateKey];
        if (!currentInput) return;
        const { value, unit } = currentInput;
        const merc = mercaderias.find(m => m.id === row.productId);
        const recipeFetaWeight = (pres.pesoObjetivoGramos && pres.cantidadFetasEstimada) ? pres.pesoObjetivoGramos / pres.cantidadFetasEstimada : (merc?.pesoFeta || 15);
        let qtyGrams = value;
        if (unit === 'kg') qtyGrams = value * 1000;
        else if (unit === 'fetas' || unit === 'unidades') qtyGrams = value * recipeFetaWeight;
        const qtyKg = qtyGrams / 1000;
        customConsumptions[stateKey] = qtyKg;

        if (row.isMercaderia) {
            totalMpInKg += qtyKg;
        }
      });
    });

    let mermaGlobalPorcentaje = 0;
    if (totalMpInKg > 0 && totalProdOutKg > 0) {
      mermaGlobalPorcentaje = ((totalMpInKg - totalProdOutKg) / totalMpInKg) * 100;
      mermaGlobalPorcentaje = Math.round(mermaGlobalPorcentaje * 100) / 100;
    }

    try {
      await updateOrderStatus(order.id!, 'PRODUCIDO', { actualConsumptions: customConsumptions, actualProduced: customProduced, mermaGlobalPorcentaje });
    } catch (e: any) { alert('Error al producir pedido: ' + e.message); }
  };

  const loading = loadingOrders || loadingPres || loadingMerc || loadingIns || loadingRec;

  const activeOrders = useMemo(() => {
    return orders.filter(o => filterDate(o.date) && ['PENDIENTE', 'EN_PRODUCCION', 'PRODUCIDO', 'ENTREGADO'].includes(o.status));
  }, [orders, filterDate]);

  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const toggleClient = (client: string) => {
    setExpandedClients(prev => ({ ...prev, [client]: !prev[client] }));
  };

  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const groupedOrders = useMemo(() => {
    const map: Record<string, typeof activeOrders> = {};
    activeOrders.forEach(order => {
      const customer = order.customerName || 'Cliente Desconocido';
      if (!map[customer]) map[customer] = [];
      map[customer].push(order);
    });
    return map;
  }, [activeOrders]);

  // --- AGGREGATIONS ---
  const planMaestro = useMemo(() => {
    const map = new Map<string, { product: Presentacion, totalQty: number, totalWeightKg: number, orders: { customerName: string, qty: number }[] }>();
    activeOrders.forEach(o => {
      o.items.forEach(item => {
        const pres = presentaciones.find(p => p.id === item.productId);
        if (!pres) return;
        if (!map.has(pres.id!)) map.set(pres.id!, { product: pres, totalQty: 0, totalWeightKg: 0, orders: [] });
        const agg = map.get(pres.id!)!;
        agg.totalQty += item.quantity;
        agg.totalWeightKg += (item.quantity * pres.pesoObjetivoGramos) / 1000;
        const existingOrder = agg.orders.find(or => or.customerName === o.customerName);
        if (existingOrder) existingOrder.qty += item.quantity;
        else agg.orders.push({ customerName: o.customerName, qty: item.quantity });
      });
    });
    return Array.from(map.values());
  }, [activeOrders, presentaciones]);

  const parteCorte = useMemo(() => {
    const map = new Map<string, { merc: Mercaderia, totalKg: number, ordersCount: number }>();
    activeOrders.forEach(o => {
      o.items.forEach(item => {
        const pres = presentaciones.find(p => p.id === item.productId);
        if (!pres) return;
        let recipe = recipes.find(r => pres.recipeId && r.id === pres.recipeId);
        if (!recipe) {
          recipe = recipes.find(r => pres.recetaId && r.id === pres.recetaId);
        }
        if (!recipe) {
          recipe = recipes.find(r => r.productId && item.productId && r.productId === item.productId);
        }
        if (!recipe) {
          recipe = recipes.find(r => 
            r.productId && pres.productoBaseId && r.productId === pres.productoBaseId && 
            r.customerId && pres.customerId && r.customerId === pres.customerId
          );
        }
        const rows = buildIngredientRows(item, pres, recipe, mercaderias);
        rows.forEach(row => {
          if (row.isMercaderia) {
            if (!map.has(row.productId)) map.set(row.productId, { merc: mercaderias.find(m => m.id === row.productId)!, totalKg: 0, ordersCount: 0 });
            const agg = map.get(row.productId)!;
            agg.totalKg += (row.unit === 'kg' ? row.theoreticalQty : row.theoreticalQty / 1000);
            agg.ordersCount += 1; // Simplification
          }
        });
      });
    });
    return Array.from(map.values());
  }, [activeOrders, presentaciones, recipes, mercaderias]);

  const parteEmpaque = useMemo(() => {
    const map = new Map<string, { insumoId: string, name: string, type: 'bolsa' | 'etiqueta' | 'caja' | 'otro', count: number }>();
    activeOrders.forEach(o => {
      o.items.forEach(item => {
        const pres = presentaciones.find(p => p.id === item.productId);
        if (!pres) return;
        if (pres.bolsaId) {
          if (!map.has(pres.bolsaId)) map.set(pres.bolsaId, { insumoId: pres.bolsaId, name: pres.bolsaName || 'Bolsa', type: 'bolsa', count: 0 });
          map.get(pres.bolsaId)!.count += item.quantity;
        }
        if (pres.etiquetaId) {
          if (!map.has(pres.etiquetaId)) map.set(pres.etiquetaId, { insumoId: pres.etiquetaId, name: pres.etiquetaName || 'Etiqueta', type: 'etiqueta', count: 0 });
          map.get(pres.etiquetaId)!.count += item.quantity;
        }
        if (pres.unidadesPorCaja && pres.unidadesPorCaja > 0) {
          const cajas = Math.ceil(item.quantity / pres.unidadesPorCaja);
          if (!map.has('cajas_genericas')) map.set('cajas_genericas', { insumoId: 'caja', name: 'Cajas (Estimado)', type: 'caja', count: 0 });
          map.get('cajas_genericas')!.count += cajas;
        }
      });
    });
    return Array.from(map.values());
  }, [activeOrders, presentaciones]);

  if (loading) return <SkeletonLoader rows={4} height="62px" />;
  if (errorOrders) return <ErrorState message={errorOrders} />;

  return (
    <>
      <div style={{ marginBottom: '24px' }}>
        <PageHeader title="Módulo de Producción" description="Planificación diaria, corte, empaque y gestión de pedidos" />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)' }}>
        <button className={`btn ${activeTab === 'maestro' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('maestro')} style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}>
          <Layers size={18} /> Plan Maestro
        </button>
        <button className={`btn ${activeTab === 'corte' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('corte')} style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}>
          <Scissors size={18} /> Parte de Corte
        </button>
        <button className={`btn ${activeTab === 'empaque' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('empaque')} style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}>
          <Package size={18} /> Parte de Empaque
        </button>
        <button className={`btn ${activeTab === 'pedidos' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('pedidos')} style={{ borderRadius: '8px 8px 0 0', borderBottom: 'none' }}>
          <ClipboardList size={18} /> Gestión de Pedidos
        </button>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <button className="btn btn-secondary-light btn-sm" onClick={() => window.print()}><Printer size={16} /> Imprimir Parte</button>
        </div>
      </div>

      <div className="print-area">
        {activeTab === 'maestro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Parte de Producción del Día</h2>
            {planMaestro.length === 0 ? <EmptyState icon={Layers} title="Sin producción" description="No hay pedidos pendientes." /> : 
              planMaestro.map((pm, idx) => (
                <Card key={idx} padding="md" style={{ borderLeft: '5px solid var(--primary-color)' }}>
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-color)' }}>{pm.product.name} ({pm.product.pesoObjetivoGramos}g)</h3>
                    <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
                      <span style={{ fontSize: '0.9rem' }}><strong>Total a producir:</strong> {pm.totalQty} sobres</span>
                      <span style={{ fontSize: '0.9rem' }}><strong>Peso total estimado:</strong> {formatNumber(pm.totalWeightKg)} Kg</span>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>Pedidos involucrados:</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                      {pm.orders.map((o, i) => (
                        <div key={i} style={{ backgroundColor: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.9rem' }}>
                          <strong>{o.customerName}</strong> → {o.qty} sobres
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))
            }
          </div>
        )}

        {activeTab === 'corte' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Parte Diaria de Corte</h2>
            {parteCorte.length === 0 ? <EmptyState icon={Scissors} title="Sin cortes" description="No hay mercadería base requerida." /> : 
              parteCorte.map((pc, idx) => {
                const merma = pc.merc.mermaEstimada || 4;
                const realReq = pc.totalKg * (1 + merma / 100);
                return (
                  <Card key={idx} padding="md" style={{ borderLeft: '5px solid #d97706' }}>
                    <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#b45309' }}>{pc.merc.name}</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', fontSize: '0.95rem' }}>
                      <div><strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Pedidos asociados</strong>{pc.ordersCount}</div>
                      <div><strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Total neto a cortar</strong>{formatNumber(pc.totalKg)} Kg</div>
                      <div><strong style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Merma estimada</strong>{merma}%</div>
                      <div><strong style={{ display: 'block', color: '#16a34a', fontSize: '0.8rem' }}>Cantidad real requerida (Cámara)</strong><span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#16a34a' }}>{formatNumber(realReq)} Kg</span></div>
                    </div>
                  </Card>
                );
              })
            }
          </div>
        )}

        {activeTab === 'empaque' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Consumo Total Diario de Insumos</h2>
            {parteEmpaque.length === 0 ? <EmptyState icon={Package} title="Sin empaque" description="No hay insumos requeridos." /> : 
              <Card padding="none">
                <Table 
                  data={parteEmpaque}
                  keyExtractor={(i) => i.insumoId + i.name}
                  columns={[
                    { header: 'Tipo', accessor: (i) => <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{i.type}</span> },
                    { header: 'Insumo', accessor: (i) => i.name },
                    { header: 'Cantidad Total', accessor: (i) => <span style={{ fontWeight: 800, color: 'var(--primary-color)' }}>{i.count} unidades</span>, align: 'right' }
                  ]}
                />
              </Card>
            }
          </div>
        )}

        {activeTab === 'pedidos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Gestión Individual de Pedidos</h2>
            {Object.keys(groupedOrders).length === 0 ? <EmptyState icon={ClipboardList} title="Al día" description="No hay pedidos pendientes." /> : 
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px' }}>
                {Object.entries(groupedOrders).map(([clientName, clientOrders]) => (
                  <div key={clientName} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    <div 
                      onClick={() => toggleClient(clientName)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: 'var(--bg-secondary)', cursor: 'pointer', fontWeight: 700 }}
                    >
                      {expandedClients[clientName] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      <span>{clientName}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: 'auto' }}>
                        {clientOrders.length} pedido(s)
                      </span>
                    </div>

                    {expandedClients[clientName] && (
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--bg-primary)' }}>
                        {clientOrders.map(order => (
                          <div key={order.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                            <div 
                              onClick={() => toggleOrder(order.id!)}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: order.status === 'EN_PRODUCCION' ? '#fffbeb' : 'var(--bg-secondary)', cursor: 'pointer', borderLeft: order.status === 'EN_PRODUCCION' ? '4px solid #d97706' : '4px solid #94a3b8' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {expandedOrders[order.id!] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontWeight: 600 }}>Pedido {order.id?.slice(-6) || 'N/A'}</span>
                                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, backgroundColor: order.status === 'EN_PRODUCCION' ? '#fef3c7' : '#e2e8f0', color: order.status === 'EN_PRODUCCION' ? '#b45309' : '#475569' }}>
                                      {order.status === 'EN_PRODUCCION' ? 'En Preparación' : 'Pendiente'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    <Calendar size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}/> 
                                    {new Date(order.date).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
                                {order.status === 'PENDIENTE' ? (
                                  <button onClick={() => handleTransitionStatus(order.id!, 'EN_PRODUCCION')} className="btn btn-secondary-light btn-sm"><Play size={14} /> Comenzar</button>
                                ) : (
                                  <button onClick={() => handleDeliverOrder(order)} className="btn btn-primary btn-sm" style={{ backgroundColor: '#059669', border: 'none' }}><CheckCircle size={14} /> Marcar como Producido</button>
                                )}
                              </div>
                            </div>

                            {expandedOrders[order.id!] && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', backgroundColor: 'var(--bg-primary)' }}>
                                {order.items.map((item, idx) => {
                                  const pres = presentaciones.find(p => p.id === item.productId);
                                  let recipe: Recipe | undefined = undefined;
                                  if (pres) {
                                    recipe = recipes.find(r => pres.recipeId && r.id === pres.recipeId);
                                    if (!recipe) {
                                      recipe = recipes.find(r => pres.recetaId && r.id === pres.recetaId);
                                    }
                                    if (!recipe) {
                                      recipe = recipes.find(r => r.productId && item.productId && r.productId === item.productId);
                                    }
                                    if (!recipe) {
                                      recipe = recipes.find(r => 
                                        r.productId && pres.productoBaseId && r.productId === pres.productoBaseId && 
                                        r.customerId && pres.customerId && r.customerId === pres.customerId
                                      );
                                    }
                                  }
                                  const rows = pres ? buildIngredientRows(item, pres, recipe, mercaderias) : [];
                                  return (
                                    <div key={idx} style={{ backgroundColor: 'var(--bg-primary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShoppingBag size={14} color="var(--primary-color)" /> <span style={{ fontWeight: 600 }}>{item.productName}</span></div>
                                        {order.status === 'EN_PRODUCCION' ? (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Pesos Reales por Paquete (Kg):</div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                              {Array.from({ length: item.quantity }).map((_, pIdx) => {
                                                const weights = actualProduced[`${order.id}_${item.productId}`] || Array(item.quantity).fill(0);
                                                return (
                                                  <div key={pIdx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>P{pIdx+1}</span>
                                                    <WeightInput 
                                                      value={weights[pIdx] || 0}
                                                      onChange={(num) => {
                                                        const newWeights = [...weights];
                                                        newWeights[pIdx] = num;
                                                        handleChangeProducedWeights(order.id!, item.productId, newWeights);
                                                      }}
                                                    />
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        ) : (
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', padding: '2px 8px', borderRadius: '4px' }}>
                                              {item.quantity} paquetes
                                            </span>
                                            {order.status === 'PRODUCIDO' && (
                                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                Peso total: {(actualProduced[`${order.id}_${item.productId}`] || []).reduce((a, b) => a + b, 0).toFixed(3)} Kg
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                      <div style={{ padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.85rem' }}>
                                        <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {rows.length === 0 ? (
                                              <div style={{ fontSize: '0.85rem', color: '#ef4444', fontStyle: 'italic' }}>Receta no encontrada</div>
                                            ) : (
                                              rows.map(row => {
                                                const stateKey = `${order.id}_${item.productId}_${row.productId}`;
                                                const saved = order.actualConsumptions?.[stateKey] || actualConsumptions[stateKey];
                                                return (
                                                  <IngredientInput
                                                    key={row.productId} orderId={order.id!} itemId={item.productId} productId={row.productId} name={row.name}
                                                    theoreticalQty={row.theoreticalQty} unit={row.unit} currentValue={saved?.value ?? row.theoreticalQty} currentUnit={(saved?.unit as ConsumptionUnit) ?? row.unit}
                                                    isEditable={order.status === 'EN_PRODUCCION'} onChangeValue={handleChangeValue} onChangeUnit={handleChangeUnit}
                                                  />
                                                );
                                              })
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                                {['PRODUCIDO', 'ENTREGADO'].includes(order.status) && (
                                  <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <h4 style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '12px' }}>Rentabilidad Real del Pedido</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', fontSize: '0.85rem' }}>
                                      <div>
                                        <div style={{ color: 'var(--text-secondary)' }}>Costo Calculado</div>
                                        <div style={{ fontWeight: 600 }}>{formatCurrency(order.productionCost || 0)}</div>
                                      </div>
                                      <div>
                                        <div style={{ color: 'var(--text-secondary)' }}>Costo Real</div>
                                        <div style={{ fontWeight: 600, color: '#ef4444' }}>{formatCurrency(order.realProductionCost ?? order.productionCost ?? 0)}</div>
                                      </div>
                                      <div>
                                        <div style={{ color: 'var(--text-secondary)' }}>Precio Final Cobrado</div>
                                        <div style={{ fontWeight: 600, color: '#10b981' }}>{formatCurrency(order.finalChargedAmount ?? order.total ?? 0)}</div>
                                      </div>
                                      <div>
                                        <div style={{ color: 'var(--text-secondary)' }}>Ganancia Real</div>
                                        <div style={{ fontWeight: 700, color: '#10b981' }}>
                                          {formatCurrency(
                                            (order.finalChargedAmount ?? order.total ?? 0) - (order.realProductionCost ?? order.productionCost ?? 0)
                                          )}
                                        </div>
                                      </div>
                                      <div>
                                        <div style={{ color: 'var(--text-secondary)' }}>Margen Real</div>
                                        <div style={{ fontWeight: 700, color: '#3b82f6' }}>
                                          {formatNumber(
                                            ((order.finalChargedAmount ?? order.total ?? 0) > 0 ? 
                                            (((order.finalChargedAmount ?? order.total ?? 0) - (order.realProductionCost ?? order.productionCost ?? 0)) / (order.finalChargedAmount ?? order.total ?? 0)) * 100 : 0),
                                            '%'
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            }
          </div>
        )}
      </div>
    </>
  );
};
export default Produccion;
