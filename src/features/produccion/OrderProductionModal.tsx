import { useState, useEffect, useMemo } from 'react';
import Modal from '../../components/Modal';
import RecipeEditor from './RecipeEditor';
import { convertQuantityToBaseUnit } from '../../lib/unitConverter';
import type { Order, Product, RecipeItem, Equivalencia, Customer } from '../../types/domain';

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
    merma?: number;
    observaciones: string;
    elaborado: boolean;
    recipeItems?: RecipeItem[];
  }[]>([]);

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
          let items = p.recipeItems || [];
          if (items.length === 0) {
            const recipeId = p.recipeId || (p as any).recetaId;
            if (recipeId) {
              const recipe = (recipes || []).find(r => r.id === recipeId);
              if (recipe) {
                const ingredients = recipe.ingredients || [];
                items = ingredients.map((ing: any) => ({
                  productId: ing.productId,
                  quantity: ing.quantity,
                  unit: ing.unit || 'GRAMOS'
                }));
              }
            }
          }
          defaultRecipeItems = items;
        }

        const isUnitBased = item.unidad === 'UNIDADES' || (p && p.unitType === 'UNIDADES');

        if (isUnitBased) {
          const qtyTotal = Math.max(1, Math.round(Number(item.cantidad || 0)));
          
          let unitsElaboradas = 0;
          if (order.status === 'EN_PRODUCCION' && item.pesoReal && p?.pesoObjetivoGramos) {
            const targetWeightKg = p.pesoObjetivoGramos / 1000;
            unitsElaboradas = Math.min(qtyTotal - 1, Math.round(item.pesoReal / targetWeightKg));
          }

          const qtyRemaining = qtyTotal - unitsElaboradas;

          for (let i = 0; i < qtyRemaining; i++) {
            const realIndex = unitsElaboradas + i;
            let initialPesoReal = p?.pesoObjetivoGramos ? Number((p.pesoObjetivoGramos / 1000).toFixed(3)) : undefined;
            steps.push({
              productId: item.productId,
              productName: p?.nombre || 'Producto Desconocido',
              unitIndex: realIndex,
              totalUnits: qtyTotal,
              cantidad: 1,
              unidad: 'UNIDADES',
              pesoReal: initialPesoReal,
              merma: undefined,
              observaciones: `Preparación de Pedido ${(orderId || '').slice(0, 6)}${clientSuffix} - ${p?.nombre || ''} (Pza ${realIndex + 1}/${qtyTotal})`,
              elaborado: true,
              recipeItems: JSON.parse(JSON.stringify(defaultRecipeItems))
            });
          }
        } else {
          let initialPesoReal = item.pesoReal !== undefined ? Number(item.pesoReal) : undefined;
          if (initialPesoReal === undefined && p) {
            const baseQtyInKg = convertQuantityToBaseUnit(Number(item.cantidad || 0), item.unidad || p.unitType || 'KG', { ...p, unitType: 'KG' });
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

    let stepWeight = 0;
    if (currentItem.recipeItems) {
      currentItem.recipeItems.forEach(ing => {
        const ingProduct = products.find(p => p.id === ing.productId);
        if (ingProduct && ingProduct.type !== 'INSUMO') {
          try {
            if (ing.pesoNeto !== undefined && ing.pesoNeto > 0) {
              stepWeight += ing.pesoNeto;
            } else {
              const qtyInKg = convertQuantityToBaseUnit(ing.quantity, ing.unit, { ...ingProduct, unitType: 'KG' });
              stepWeight += qtyInKg;
            }
          } catch (err) {
            console.error("Error converting unit for weight calculation", err);
          }
        }
      });
    }

    const finalWeight = stepWeight > 0 ? stepWeight : (currentItem.pesoReal || 0);
    const isLast = activeStep === orderProdItems.length - 1;

    try {
      await produceStep({
        orderId: selectedOrder,
        productId: currentItem.productId,
        cantidad: currentItem.cantidad,
        unidad: currentItem.unidad,
        pesoReal: finalWeight > 0 ? finalWeight : undefined,
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
                        newItems[activeStep].observaciones = e.target.value;
                        setOrderProdItems(newItems);
                      }} 
                    />
                  </div>

                  {!currentItem.recipeItems || currentItem.recipeItems.length === 0 ? (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Peso Real de esta Unidad (KG)</label>
                      <input 
                        type="number" 
                        step="0.001"
                        min="0.001"
                        required
                        placeholder="0.000"
                        value={currentItem.pesoReal !== undefined ? currentItem.pesoReal : ''} 
                        onChange={e => {
                          const newItems = [...orderProdItems];
                          newItems[activeStep].pesoReal = e.target.value ? Number(e.target.value) : undefined;
                          setOrderProdItems(newItems);
                        }} 
                      />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px dashed var(--border-color)', margin: '4px 0' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        Peso Real Total de esta Unidad (Calculado):
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
                      newItems[activeStep].recipeItems = newRecipe;
                      
                      let calculatedWeight = 0;
                      newRecipe.forEach(ing => {
                        const ingProduct = products.find(p => p.id === ing.productId);
                        if (ingProduct && ingProduct.type !== 'INSUMO') {
                          if (ing.pesoNeto !== undefined && ing.pesoNeto > 0) {
                            calculatedWeight += ing.pesoNeto;
                          } else {
                            try {
                              calculatedWeight += convertQuantityToBaseUnit(ing.quantity, ing.unit, { ...ingProduct, unitType: 'KG' });
                            } catch (e) {
                              console.error(e);
                            }
                          }
                        }
                      });
                      newItems[activeStep].pesoReal = calculatedWeight > 0 ? Number(calculatedWeight.toFixed(3)) : undefined;
                      
                      setOrderProdItems(newItems);
                    }}
                    products={products}
                    equivalences={equivalences}
                    prodQty={currentItem.cantidad}
                  />
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
