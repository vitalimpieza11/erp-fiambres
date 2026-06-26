import { useState, useEffect, useMemo } from 'react';
import Modal from '../../components/Modal';
import RecipeEditor from './RecipeEditor';
import { convertQuantityToBaseUnit } from '../../lib/unitConverter';
import type { Order, Product, RecipeItem, Equivalencia, Customer } from '../../types/domain';
import { mapRecipeUnitToUnitType } from '../../types/domain';
import { useSettingsStore } from '../../store/settingsStore';
import { getOperationalCost } from '../../utils/pricingHelpers';

interface OrderProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrderId?: string;
  targetProductId?: string;
  orders: Order[];
  products: Product[];
  recipes: any[];
  equivalences: Equivalencia[];
  customers: Customer[];
  produceStep: (data: {
    orderId: string;
    productId: string;
    cantidad: number;
    unidad: string;
    pesoReal?: number;
    pesosReales?: number[];
    merma?: number;
    observaciones: string;
    recipeItemsOverride?: RecipeItem[];
    isLastStep: boolean;
    newOrderStatus?: 'EN_PRODUCCION' | 'PRODUCIDO';
  }) => Promise<void>;
}

export default function OrderProductionModal({
  isOpen,
  onClose,
  selectedOrderId,
  targetProductId,
  orders,
  products,
  recipes,
  equivalences,
  customers,
  produceStep
}: OrderProductionModalProps) {
  const [selectedOrder, setSelectedOrder] = useState<string>('');
  const [activeStep, setActiveStep] = useState<number>(0);
  const [newStatus, setNewStatus] = useState<'EN_PRODUCCION' | 'PRODUCIDO'>('EN_PRODUCCION');
  const [orderProdItems, setOrderProdItems] = useState<{
    productId: string;
    productName: string;
    unitIndex: number;
    totalUnits: number;
    cantidad: number;
    unidad: string;
    pesoReal?: number;
    pesosReales?: number[];
    merma?: number;
    observaciones: string;
    elaborado: boolean;
    recipeItems?: RecipeItem[];
  }[]>([]);

  const currentItem = orderProdItems[activeStep];
  const currentProdObj = useMemo(() => {
    if (!currentItem) return undefined;
    return products.find(p => p.id === currentItem.productId);
  }, [currentItem, products]);

  const { settings } = useSettingsStore();

  const costDetails = useMemo(() => {
    if (!currentItem || !currentItem.recipeItems || currentItem.cantidad <= 0) return null;
    console.log('RECALCULANDO_COSTOS', {
      pesoReal: currentItem?.pesoReal,
      pesosReales: currentItem?.pesosReales
    });
    const prodQty = currentItem.cantidad;
    const prodWeight = currentItem.pesoReal || 0;
    
    let realWeightKg = prodWeight > 0 ? prodWeight : undefined;

    const opCost = getOperationalCost({
      recipeItems: currentItem.recipeItems,
      settings,
      equivalences,
      allProducts: products,
      targetProduct: currentProdObj,
      unitsProduced: prodQty,
      realWeightKg
    });

    const totalWeightKg = (realWeightKg && realWeightKg > 0) ? realWeightKg : (prodQty > 0 ? prodQty : 0);
    const costPerUnit = prodQty > 0 ? opCost.costoOperativoTotal / prodQty : 0;
    const costPerKg = totalWeightKg > 0 ? opCost.costoOperativoTotal / totalWeightKg : 0;

    return {
      ...opCost,
      costPerUnit,
      costPerKg
    };
  }, [currentItem, currentProdObj, products, equivalences, settings]);

  const pendingOrders = useMemo(() => {
    return (orders || []).filter(o => o && (o.status === 'PENDIENTE' || o.status === 'EN_PRODUCCION'));
  }, [orders]);

  const handleOrderChange = (orderId: string, targetProduct?: string) => {
    setSelectedOrder(orderId);
    if (!orderId) {
      setOrderProdItems([]);
      setActiveStep(0);
      return;
    }
    const order = orders.find(o => o.id === orderId);
    if (order) {
      const client = (customers || []).find(c => c.id === order.customerId);
      const clientName = client ? (client.name || client.nombre) : '';
      const clientSuffix = clientName ? ` - ${clientName}` : '';

      const steps: typeof orderProdItems = [];

      (order.items || []).forEach(item => {
        const p = products.find(prod => prod.id === item.productId);
        
        let defaultRecipeItems: RecipeItem[] = [];
        if (p) {
          const recipe = (recipes || []).find(r => r.productId === p.id);
          if (recipe && recipe.items) {
            defaultRecipeItems = recipe.items;
          }
        }

        const isUnitBased = item.unidad === 'UNIDADES' || (p && p.unitType === 'UNIDADES');

        if (isUnitBased) {
          const qtyTotal = Math.max(1, Math.round(Number(item.cantidad || 0)));
          
          let unitsElaboradas = item.pesosReales ? item.pesosReales.length : 0;
          if (unitsElaboradas === 0 && item.pesoReal && p?.pesoObjetivoGramos) {
            const targetWeightKg = p.pesoObjetivoGramos / 1000;
            unitsElaboradas = Math.min(qtyTotal - 1, Math.round(item.pesoReal / targetWeightKg));
          }

          const qtyRemaining = qtyTotal - unitsElaboradas;

          if (qtyRemaining > 0) {
            const defaultWeight = p?.pesoObjetivoGramos ? Number((p.pesoObjetivoGramos / 1000).toFixed(3)) : 0.150;
            const initialPesos = Array(qtyRemaining).fill(defaultWeight);
            steps.push({
              productId: item.productId,
              productName: p?.nombre || 'Producto Desconocido',
              unitIndex: 0,
              totalUnits: qtyTotal,
              cantidad: qtyRemaining,
              unidad: 'UNIDADES',
              pesoReal: Number((qtyRemaining * defaultWeight).toFixed(3)),
              pesosReales: initialPesos,
              merma: undefined,
              observaciones: `Preparación de Pedido ${(orderId || '').slice(0, 6)}${clientSuffix} - ${p?.nombre || ''}`,
              elaborado: true,
              recipeItems: JSON.parse(JSON.stringify(defaultRecipeItems))
            });
          }
        } else {
          let initialPesoReal = item.pesoReal !== undefined ? Number(item.pesoReal) : undefined;
          if (initialPesoReal === undefined && p) {
            const baseQtyInKg = convertQuantityToBaseUnit(Number(item.cantidad || 0), item.unidad || p?.unitType || 'KG', { ...p, unitType: 'KG' });
            initialPesoReal = Number(baseQtyInKg.toFixed(3));
          }
          
          const isAlreadyDone = order.status === 'EN_PRODUCCION' && item.pesoReal !== undefined && item.pesoReal > 0;
          if (!isAlreadyDone) {
            steps.push({
              productId: item.productId,
              productName: p?.nombre || 'Producto Desconocido',
              unitIndex: 0,
              totalUnits: 1,
              cantidad: Number(item.cantidad || 0),
              unidad: item.unidad || p?.unitType || 'KG',
              pesoReal: initialPesoReal,
              pesosReales: item.pesosReales || (initialPesoReal ? [initialPesoReal] : []),
              merma: undefined,
              observaciones: `Preparación de Pedido ${(orderId || '').slice(0, 6)}${clientSuffix} - ${p?.nombre || ''}`,
              elaborado: true,
              recipeItems: JSON.parse(JSON.stringify(defaultRecipeItems))
            });
          }
        }
      });

      setOrderProdItems(steps);

      if (targetProduct) {
        const targetIdx = steps.findIndex(step => step.productId === targetProduct);
        if (targetIdx !== -1) {
          setActiveStep(targetIdx);
        } else {
          setActiveStep(0);
        }
      } else {
        setActiveStep(0);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedOrder(selectedOrderId || '');
      setOrderProdItems([]);
      setActiveStep(0);
      
      const orderIdToLoad = selectedOrderId || (() => {
        const orderWithProduct = pendingOrders.find(o => 
          o.items && o.items.some(item => item.productId === targetProductId)
        );
        return orderWithProduct ? orderWithProduct.id : '';
      })();

      if (orderIdToLoad) {
        handleOrderChange(orderIdToLoad, targetProductId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedOrderId, targetProductId]);

  const autoOrderStatus = useMemo(() => {
    if (orderProdItems.length === 0) return 'EN_PRODUCCION';
    const allElaborados = orderProdItems.every(it => it.elaborado);
    return allElaborados ? 'PRODUCIDO' : 'EN_PRODUCCION';
  }, [orderProdItems]);

  useEffect(() => {
    setNewStatus(autoOrderStatus);
  }, [autoOrderStatus]);

  const handleCompleteStep = async () => {
    const currentItem = orderProdItems[activeStep];
    if (!currentItem) return;

    const finalWeight = currentItem.pesoReal || 0;
    const isLast = activeStep === orderProdItems.length - 1;

    try {
      await produceStep({
        orderId: selectedOrder,
        productId: currentItem.productId,
        cantidad: currentItem.cantidad,
        unidad: currentItem.unidad,
        pesoReal: finalWeight > 0 ? finalWeight : undefined,
        pesosReales: currentItem.pesosReales,
        merma: currentItem.merma,
        observaciones: currentItem.observaciones,
        recipeItemsOverride: currentItem.recipeItems,
        isLastStep: isLast,
        newOrderStatus: isLast ? newStatus : 'EN_PRODUCCION'
      });

      if (isLast) {
        onClose();
      } else {
        setActiveStep(prev => prev + 1);
      }
    } catch (error) {
      alert("Error al completar unidad: " + error);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      title="Preparación desde Pedido"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0, lineHeight: '1.4' }}>
          Esta acción registra la preparación o feteado de los productos para cumplir con el pedido. Disminuye el stock del producto terminado y consume insumos de receta.
        </p>
        <div className="form-group" style={{ marginBottom: '8px' }}>
          <label>Seleccionar Pedido</label>
          <select required value={selectedOrder} onChange={e => handleOrderChange(e.target.value)}>
            <option value="">-- Seleccione --</option>
            {pendingOrders.map(o => {
              const client = (customers || []).find(c => c.id === o.customerId);
              const clientName = client ? (client.name || client.nombre) : 'Cliente Desconocido';
              return (
                <option key={o.id} value={o.id}>
                  {clientName} - Pedido {(o.id || '').slice(0,6)} ({o.status})
                </option>
              );
            })}
          </select>
        </div>

        {selectedOrder && orderProdItems.length > 0 && (() => {
          const currentItem = orderProdItems[activeStep];
          const prod = products.find(p => p.id === currentItem.productId);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Elaborando producto {activeStep + 1} de {orderProdItems.length}
                </span>
                <strong style={{ fontSize: '15px', color: 'var(--alvacio-red-dark)' }}>
                  {activeStep + 1} / {orderProdItems.length}
                </strong>
              </div>

              <div style={{ background: '#f9f9f9', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {prod?.nombre || 'Producto Desconocido'}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Observaciones</label>
                    <input 
                      type="text" 
                      value={currentItem.observaciones} 
                      onChange={e => {
                        const newItems = [...orderProdItems];
                        newItems[activeStep] = {
                          ...newItems[activeStep],
                          observaciones: e.target.value
                        };
                        setOrderProdItems(newItems);
                      }} 
                    />
                  </div>
                  {currentItem.pesosReales !== undefined ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Pesos Reales por Paquete (KG)</label>
                        <button 
                          type="button" 
                          className="btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={() => {
                            const newItems = [...orderProdItems];
                            const updatedPesos = [...(newItems[activeStep].pesosReales || []), 0];
                            newItems[activeStep] = { ...newItems[activeStep], pesosReales: updatedPesos };
                            setOrderProdItems(newItems);
                          }}
                        >
                          + Agregar paquete
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                        {currentItem.pesosReales.map((w, pkgIdx) => (
                          <div key={pkgIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Paquete {pkgIdx + 1}</span>
                              {currentItem.pesosReales!.length > 1 && (
                                <button type="button" onClick={() => {
                                  const newItems = [...orderProdItems];
                                  const updatedPesos = [...(newItems[activeStep].pesosReales || [])];
                                  updatedPesos.splice(pkgIdx, 1);
                                  const pesoRealTotal = Number(updatedPesos.reduce((a, b) => Number(a) + Number(b), 0).toFixed(3));
                                  newItems[activeStep] = { ...newItems[activeStep], pesosReales: updatedPesos, pesoReal: pesoRealTotal };
                                  setOrderProdItems(newItems);
                                }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', padding: 0 }}>✕</button>
                              )}
                            </div>
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              required
                              value={w !== undefined && w !== 0 ? w : ''}
                              style={{ padding: '6px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                              onChange={e => {
                                  const newItems = [...orderProdItems];
                                  const updatedPesos = [...(newItems[activeStep].pesosReales || [])] as any[];
                                  updatedPesos[pkgIdx] = e.target.value ? Number(e.target.value) : 0;
                                  
                                  const pesoRealTotal = Number(updatedPesos.reduce((a, b) => Number(a) + Number(b), 0).toFixed(3));
                                  
                                  newItems[activeStep] = {
                                    ...newItems[activeStep],
                                    pesosReales: updatedPesos,
                                    pesoReal: pesoRealTotal
                                  };
                                  
                                  setOrderProdItems(newItems);
                                }}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginTop: '10px', padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '8px' }}>
                        <span>Peso Total: <strong>{(currentItem.pesoReal || 0).toFixed(3)} kg</strong></span>
                        <span>Promedio: <strong>{currentItem.pesosReales.length > 0 ? ((currentItem.pesosReales.reduce((a, b) => Number(a) + Number(b), 0)) / currentItem.pesosReales.length || 0).toFixed(3) : '0.000'} kg</strong></span>
                      </div>
                    </div>
                  ) : !currentItem.recipeItems || currentItem.recipeItems.length === 0 ? (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Peso Real Total (KG)</label>
                      <input 
                        type="number" 
                        step="0.001"
                        min="0.001"
                        required
                        placeholder="0.000"
                        value={currentItem.pesoReal !== undefined ? currentItem.pesoReal : ''} 
                        onChange={e => {
                          const newItems = [...orderProdItems];
                          newItems[activeStep] = {
                            ...newItems[activeStep],
                            pesoReal: e.target.value as any
                          };
                          setOrderProdItems(newItems);
                        }} 
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px dashed var(--border-color)', margin: '4px 0' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        Peso Real Total (Calculado):
                      </span>
                      <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>
                        {currentItem.pesoReal !== undefined ? `${currentItem.pesoReal} KG` : 'Calculando...'}
                      </strong>
                    </div>
                  )}

                  <RecipeEditor
                    ingredients={currentItem.recipeItems || []}
                    onChange={(newRecipe) => {
                      const newItems = [...orderProdItems];
                      newItems[activeStep] = {
                        ...newItems[activeStep],
                        recipeItems: newRecipe
                      };
                      setOrderProdItems(newItems);
                    }}
                    products={products}
                    equivalences={equivalences}
                    prodQty={currentItem.cantidad}
                    pesoReal={currentItem.pesoReal}
                    targetProduct={prod}
                  />

                  {/* Panel de Costos de Producción por Pedido */}
                  {costDetails && currentItem.cantidad > 0 && (
                    <div style={{ 
                      backgroundColor: '#f8fafc', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '12px', 
                      padding: '16px',
                      marginTop: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      {(() => {
                        console.log('DEBUG_PRODUCCION', {
                          pesoReal: currentItem?.pesoReal,
                          pesosReales: currentItem?.pesosReales,
                          costDetails
                        });
                        return null;
                      })()}
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>📊</span> Análisis de Costos (Paso Actual)
                      </h4>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ background: '#fff', padding: '6px 10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Materia Prima</span>
                          <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>${costDetails.costoMateriaPrima.toFixed(2)}</strong>
                        </div>
                        <div style={{ background: '#fff', padding: '6px 10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Insumos de Receta</span>
                          <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>${costDetails.costoInsumosReceta.toFixed(2)}</strong>
                        </div>
                        <div style={{ background: '#fff', padding: '6px 10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Embalaje Automático</span>
                          <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>${costDetails.costoEmbalajeTotal.toFixed(2)}</strong>
                        </div>
                        <div style={{ background: '#fffbeb', padding: '6px 10px', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                          <span style={{ fontSize: '10px', color: '#b45309', display: 'block' }}>Total Operativo</span>
                          <strong style={{ fontSize: '13px', color: '#b45309' }}>${costDetails.costoOperativoTotal.toFixed(2)}</strong>
                        </div>
                      </div>

                      {costDetails.desgloseMateriaPrima.length > 0 && (
                        <div style={{ marginTop: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                            Materia Prima
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {costDetails.desgloseMateriaPrima.map((ing, i) => (
                              <div key={i} style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', padding: '4px 8px', background: '#fff', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>• {ing.nombre}</span>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>{ing.cantidad.toFixed(3)} {ing.unidad} × ${ing.costoUnitario.toFixed(2)}</span>
                                  <strong style={{ color: 'var(--text-primary)' }}>${ing.subtotal.toFixed(2)}</strong>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {costDetails.desgloseInsumos.length > 0 && (
                        <div style={{ marginTop: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                            Insumos
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {costDetails.desgloseInsumos.map((ing, i) => (
                              <div key={i} style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', padding: '4px 8px', background: '#fff', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>• {ing.nombre}</span>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>{ing.cantidad.toFixed(3)} {ing.unidad} × ${ing.costoUnitario.toFixed(2)}</span>
                                  <strong style={{ color: 'var(--text-primary)' }}>${ing.subtotal.toFixed(2)}</strong>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {costDetails.desgloseEmbalaje.length > 0 && (
                        <div style={{ marginTop: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                            Embalaje
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {costDetails.desgloseEmbalaje.map((ing, i) => (
                              <div key={i} style={{ display: 'flex', flexDirection: 'column', fontSize: '11px', padding: '4px 8px', background: '#fff', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>• {ing.nombre}</span>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>{ing.cantidad.toFixed(3)} {ing.unidad} × ${ing.costoUnitario.toFixed(2)}</span>
                                  <strong style={{ color: 'var(--text-primary)' }}>${ing.subtotal.toFixed(2)}</strong>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div style={{ background: '#fff', padding: '6px 10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Costo Unitario</span>
                          <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>${costDetails.costPerUnit.toFixed(2)} / u</strong>
                        </div>
                        <div style={{ background: '#fff', padding: '6px 10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Costo por Kg</span>
                          <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>${costDetails.costPerKg.toFixed(2)} / kg</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {activeStep === orderProdItems.length - 1 && (
                <div className="form-group" style={{ padding: '16px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid var(--border-color)', margin: 0 }}>
                  <label style={{ fontWeight: 600 }}>Cambiar Estado del Pedido a:</label>
                  <select value={newStatus} onChange={e => setNewStatus(e.target.value as any)}>
                    <option value="EN_PRODUCCION">EN_PRODUCCION</option>
                    <option value="PRODUCIDO">PRODUCIDO</option>
                  </select>
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button 
            type="button" 
            className="btn-secondary" 
            style={{ flex: 1 }} 
            onClick={onClose}
          >
            Cancelar
          </button>
          <button 
            type="button" 
            className="btn-primary" 
            style={{ flex: 1 }} 
            onClick={handleCompleteStep}
            disabled={!selectedOrder}
          >
            {activeStep === orderProdItems.length - 1 ? 'Finalizar Producción' : 'Completar Unidad'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
