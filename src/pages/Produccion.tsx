import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { useOrders } from '../hooks/useOrders';
import { usePresentaciones } from '../hooks/usePresentaciones';
import { useMercaderias } from '../hooks/useMercaderias';
import { useInsumos } from '../hooks/useInsumos';
import { useRecipes } from '../hooks/useRecipes';
import { useDateFilter } from '../contexts/DateFilterContext';
import { Play, CheckCircle, ClipboardList, Calendar, ShoppingBag } from 'lucide-react';
import { getIngredientGrams } from '../core/calculations';
import { IngredientInput } from '../components/IngredientInput';
import type { Presentacion, Mercaderia, Recipe, Order, OrderItem } from '../types/database';

// ─── Types ────────────────────────────────────────────────────────────────────
type ConsumptionUnit = 'g' | 'kg' | 'fetas' | 'unidades';
type ConsumptionsMap = Record<string, { value: number; unit: ConsumptionUnit }>;

// ─── Pure helper: build ingredient rows for one order-item ───────────────────
interface IngredientRow {
  productId: string;
  name: string;
  theoreticalQty: number;
  unit: ConsumptionUnit;
}

function buildIngredientRows(
  item: OrderItem,
  pres: Presentacion,
  recipe: Recipe | undefined,
  mercaderias: Mercaderia[]
): IngredientRow[] {
  // Simple presentation (no recipe): single raw-material row
  if (pres.productoBaseId) {
    const merc = mercaderias.find(m => m.id === pres.productoBaseId);
    const totalWeightKg = (pres.pesoObjetivoGramos * item.quantity) / 1000;
    return [{
      productId: pres.productoBaseId,
      name: merc?.name || 'Materia Prima',
      theoreticalQty: totalWeightKg,
      unit: 'kg'
    }];
  }

  if (!recipe) return [];

  return recipe.ingredients.map(ing => {
    const merc = mercaderias.find(m => m.id === ing.productId);
    const parts = (ing.productName || '').split(' @');
    const name = merc?.name || parts[0] || 'Ingrediente';
    const suffixUnit = parts[1] as ConsumptionUnit | undefined;

    const totalGrams = getIngredientGrams(ing, recipe.method, pres, merc) * item.quantity;
    const originalUnit: ConsumptionUnit = suffixUnit || (recipe.method === 'fetas' ? 'fetas' : recipe.method === 'weight' ? 'kg' : 'g');

    const recipeFetaWeight =
      (pres.pesoObjetivoGramos && pres.cantidadFetasEstimada)
        ? pres.pesoObjetivoGramos / pres.cantidadFetasEstimada
        : (merc?.pesoFeta || 15);

    let theoreticalQty = totalGrams;
    if (originalUnit === 'kg') theoreticalQty = totalGrams / 1000;
    else if (originalUnit === 'fetas' || originalUnit === 'unidades')
      theoreticalQty = recipeFetaWeight > 0 ? totalGrams / recipeFetaWeight : 0;

    return { productId: ing.productId, name, theoreticalQty, unit: originalUnit };
  });
}

// ─── Main component ───────────────────────────────────────────────────────────
export const Produccion = () => {
  // ── ALL HOOKS UNCONDITIONALLY AT THE TOP ──────────────────────────────────
  const { orders, loading: loadingOrders, error: errorOrders, updateOrderStatus } = useOrders();
  const { presentaciones, loading: loadingPres } = usePresentaciones();
  const { mercaderias, loading: loadingMerc } = useMercaderias();
  const { insumos: _insumos, loading: loadingIns } = useInsumos();
  const { recipes, loading: loadingRec } = useRecipes();
  const { filterDate } = useDateFilter();

  // Central state for actual (operator-adjusted) consumptions
  const [actualConsumptions, setActualConsumptions] = useState<Record<string, { value: number; unit: string }>>({});
  // Central state for actual (operator-adjusted) produced quantities (Presentaciones)
  const [actualProduced, setActualProduced] = useState<Record<string, number>>({});

  // Sync state from orders when they load
  useEffect(() => {
    if (!orders.length) return;
    const loadedConsumptions: Record<string, { value: number; unit: string }> = {};
    const loadedProduced: Record<string, number> = {};

    orders.forEach(order => {
      if (order.actualConsumptions) {
        Object.assign(loadedConsumptions, order.actualConsumptions);
      }
      if (order.actualProduced) {
        Object.assign(loadedProduced, order.actualProduced);
      }
    });

    setActualConsumptions(prev => ({ ...loadedConsumptions, ...prev }));
    setActualProduced(prev => ({ ...loadedProduced, ...prev }));
  }, [orders]);

  // ── Callbacks for IngredientInput (no hooks inside) ───────────────────────
  const handleChangeValue = async (
    orderId: string,
    itemId: string,
    productId: string,
    value: number
  ) => {
    const stateKey = `${orderId}_${itemId}_${productId}`;
    const newConsumptions = {
      ...actualConsumptions,
      [stateKey]: { ...(actualConsumptions[stateKey] || {}), value, unit: actualConsumptions[stateKey]?.unit || 'g' }
    };
    setActualConsumptions(newConsumptions);
    
    try {
      await updateDoc(doc(db, 'orders', orderId), { actualConsumptions: newConsumptions });
    } catch (e) {
      console.error('Error saving draft:', e);
    }
  };

  const handleChangeUnit = async (
    orderId: string,
    itemId: string,
    productId: string,
    unit: ConsumptionUnit
  ) => {
    const stateKey = `${orderId}_${itemId}_${productId}`;
    const newConsumptions = {
      ...actualConsumptions,
      [stateKey]: { ...(actualConsumptions[stateKey] || {}), unit, value: actualConsumptions[stateKey]?.value || 0 }
    };
    setActualConsumptions(newConsumptions);

    try {
      await updateDoc(doc(db, 'orders', orderId), { actualConsumptions: newConsumptions });
    } catch (e) {
      console.error('Error saving draft:', e);
    }
  };

  const handleChangeProduced = async (orderId: string, productId: string, value: number) => {
    const stateKey = `${orderId}_${productId}`;
    const newProduced = {
      ...actualProduced,
      [stateKey]: value
    };
    setActualProduced(newProduced);

    try {
      await updateDoc(doc(db, 'orders', orderId), { actualProduced: newProduced });
    } catch (e) {
      console.error('Error saving draft:', e);
    }
  };

  const handleTransitionStatus = async (orderId: string, status: Order['status']) => {
    try {
      await updateOrderStatus(orderId, status);
    } catch (e: any) {
      alert('Error al actualizar estado: ' + e.message);
    }
  };

  const handleDeliverOrder = async (order: Order) => {
    const customConsumptions: Record<string, number> = {};
    const customProduced: Record<string, number> = {};

    order.items.forEach((item) => {
      const pres = presentaciones.find(p => p.id === item.productId);
      if (!pres) return;

      const prodKey = `${order.id}_${item.productId}`;
      if (actualProduced[prodKey] !== undefined) {
         customProduced[item.productId] = actualProduced[prodKey];
      }

      const recipe = recipes.find(r =>
        r.productId === item.productId ||
        r.id === pres.recetaId ||
        (r.productId === pres.productoBaseId && r.customerId === pres.customerId)
      );

      const rows = buildIngredientRows(item, pres, recipe, mercaderias);
      rows.forEach(row => {
        const stateKey = `${order.id}_${item.productId}_${row.productId}`;
        const currentInput = order.actualConsumptions?.[stateKey] || actualConsumptions[stateKey];
        if (!currentInput) return;

        const { value, unit } = currentInput;
        const merc = mercaderias.find(m => m.id === row.productId);
        const recipeFetaWeight =
          (pres.pesoObjetivoGramos && pres.cantidadFetasEstimada)
            ? pres.pesoObjetivoGramos / pres.cantidadFetasEstimada
            : (merc?.pesoFeta || 15);

        let qtyGrams = value;
        if (unit === 'kg') qtyGrams = value * 1000;
        else if (unit === 'fetas' || unit === 'unidades') qtyGrams = value * recipeFetaWeight;

        customConsumptions[stateKey] = qtyGrams / 1000; // store in Kg for stock
      });
    });

    try {
      await updateOrderStatus(order.id!, 'delivered', { actualConsumptions: customConsumptions, actualProduced: customProduced });
    } catch (e: any) {
      alert('Error al entregar pedido: ' + e.message);
    }
  };

  // ── Derived values (no hooks, pure computation) ───────────────────────────
  const loading = loadingOrders || loadingPres || loadingMerc || loadingIns || loadingRec;

  // ── Conditional renders AFTER all hooks ───────────────────────────────────
  if (loading) return <SkeletonLoader rows={4} height="62px" />;
  if (errorOrders) return <ErrorState message={errorOrders} />;

  const activeOrders = orders
    .filter(o => filterDate(o.date))
    .filter(o => o.status === 'pending' || o.status === 'in_production');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ marginBottom: '24px' }}>
        <PageHeader
          title="Preparación de Pedidos"
          description="Guía operativa de producción y empaque bajo demanda (Make-to-Order)"
        />
      </div>

      {activeOrders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No hay pedidos pendientes de preparación"
          description="Los nuevos pedidos ingresados con estado 'Pendiente' o 'En Producción' aparecerán aquí."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeOrders.map((order) => (
            <Card
              key={order.id}
              padding="md"
              style={{
                borderLeft: order.status === 'in_production' ? '5px solid #d97706' : '5px solid #94a3b8',
                backgroundColor: 'var(--bg-secondary)'
              }}
            >
              {/* Order header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Pedido de {order.customerName}
                    </span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      backgroundColor: order.status === 'in_production' ? '#fef3c7' : '#e2e8f0',
                      color: order.status === 'in_production' ? '#b45309' : '#475569'
                    }}>
                      {order.status === 'in_production' ? 'En Preparación' : 'Pendiente'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '16px', marginTop: '4px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> {new Date(order.date).toLocaleDateString()}
                    </span>
                    <span>ID: {order.id?.slice(-6)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {order.status === 'pending' ? (
                    <button
                      onClick={() => handleTransitionStatus(order.id!, 'in_production')}
                      className="btn btn-secondary-light btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Play size={14} /> Comenzar Preparación
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDeliverOrder(order)}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#059669', border: 'none', color: '#fff' }}
                    >
                      <CheckCircle size={14} /> Finalizar y Entregar
                    </button>
                  )}
                </div>
              </div>

              {/* Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {order.items.map((item, idx) => {
                  const pres = presentaciones.find(p => p.id === item.productId);
                  const recipe = pres
                    ? recipes.find(r =>
                        r.productId === item.productId ||
                        r.id === pres.recetaId ||
                        (r.productId === pres.productoBaseId && r.customerId === pres.customerId)
                      )
                    : undefined;

                  const rows: IngredientRow[] = pres
                    ? buildIngredientRows(item, pres, recipe, mercaderias)
                    : [];

                  const recipeMethod = recipe?.method || 'weight';
                  const methodLabel = recipeMethod === 'percentage' ? 'Porcentaje' : recipeMethod === 'fetas' ? 'Fetas' : 'Peso';

                  return (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: 'var(--bg-primary)',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      {/* Item header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShoppingBag size={14} color="var(--primary-color)" />
                          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.productName}</span>
                        </div>
                        {order.status === 'in_production' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Producido:</span>
                            <input
                              type="number"
                              min={0}
                              value={actualProduced[`${order.id}_${item.productId}`] ?? item.quantity}
                              onChange={(e) => handleChangeProduced(order.id!, item.productId, Number(e.target.value))}
                              style={{ width: '60px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}
                            />
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>u. (Pedido: {item.quantity})</span>
                          </div>
                        ) : (
                          <span style={{
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            backgroundColor: 'var(--primary-light)',
                            color: 'var(--primary-color)',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            {item.quantity} sobres / unidades
                          </span>
                        )}
                      </div>

                      {/* Guide details */}
                      <div style={{ padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', gap: '20px', marginBottom: '6px' }}>
                          <div><strong>Peso Objetivo:</strong> {pres ? `${pres.pesoObjetivoGramos} g` : '--'}</div>
                          <div><strong>Cant. Fetas Est.:</strong> {pres?.cantidadFetasEstimada ? `${pres.cantidadFetasEstimada} u` : '--'}</div>
                          <div><strong>Bolsa:</strong> {pres?.bolsaName || 'Sin especificar'}</div>
                          <div><strong>Etiqueta:</strong> {pres?.etiquetaName || 'Sin especificar'}</div>
                        </div>

                        <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}>
                          {!pres ? (
                            <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Presentación no encontrada.</span>
                          ) : rows.length === 0 ? (
                            <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No hay receta cargada para esta presentación.</span>
                          ) : (
                            <>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                {pres.productoBaseId
                                  ? 'Consumo Real de Materia Prima:'
                                  : `Guía Operativa & Carga de Consumo Real (${methodLabel}):`}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {rows.map(row => {
                                  const stateKey = `${order.id}_${item.productId}_${row.productId}`;
                                  const saved = order.actualConsumptions?.[stateKey] || actualConsumptions[stateKey];
                                  const currentValue = saved?.value ?? row.theoreticalQty;
                                  const currentUnit = (saved?.unit as ConsumptionUnit) ?? row.unit;

                                  return (
                                    <IngredientInput
                                      key={row.productId}
                                      orderId={order.id!}
                                      itemId={item.productId}
                                      productId={row.productId}
                                      name={row.name}
                                      theoreticalQty={row.theoreticalQty}
                                      unit={row.unit}
                                      currentValue={currentValue}
                                      currentUnit={currentUnit}
                                      isEditable={order.status === 'in_production'}
                                      onChangeValue={handleChangeValue}
                                      onChangeUnit={handleChangeUnit}
                                    />
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
};

export default Produccion;
