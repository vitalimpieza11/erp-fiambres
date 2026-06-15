import { useState, useMemo, useEffect } from 'react';
import { useProduccion } from './useProduccion';
import type { Order, RecipeItem } from '../../types/domain';
import ExpandableCard from '../../components/ExpandableCard';
import RightPanel from '../../components/RightPanel';
import { Package, Clock, Activity, CheckCircle, RotateCcw } from 'lucide-react';

import LoadingSpinner from '../../components/LoadingSpinner';
import { convertQuantityToBaseUnit, convertUnit } from '../../lib/unitConverter';
import ProductionFields from './ProductionFields';

export default function Produccion() {
  const { orders, products, recipes, equivalences, movements, customers, loading, getCapacity, produce, produceMultiple, revertMovement } = useProduccion();

  const [activeTab, setActiveTab] = useState<'PENDING' | 'STOCK' | 'CAPACITY'>('PENDING');
  
  // Production RightPanel State
  const [showPanel, setShowPanel] = useState(false);
  const [prodMode, setProdMode] = useState<'FREE' | 'ORDER'>('FREE');
  const [selectedOrder, setSelectedOrder] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [prodQty, setProdQty] = useState<number>(0);
  const [prodWeight, setProdWeight] = useState<number>(0);
  const [prodMerma, setProdMerma] = useState<number>(0);
  const [prodObs, setProdObs] = useState<string>('');
  const [newStatus, setNewStatus] = useState<'EN_PRODUCCION' | 'PRODUCIDO'>('EN_PRODUCCION');
  
  // For production from order, list of items:
  // { productId, cantidad, unidad, pesoReal, merma, observaciones, elaborado }
  const [orderProdItems, setOrderProdItems] = useState<{
    productId: string;
    cantidad: number;
    unidad: string;
    pesoReal?: number;
    merma?: number;
    observaciones: string;
    elaborado: boolean;
  }[]>([]);

  const selectedProdObj = useMemo(() => {
    return (products || []).find(p => p && p.id === selectedProduct);
  }, [products, selectedProduct]);

  const resolvedRecipeItems = useMemo(() => {
    if (!selectedProdObj) return [];
    let items = selectedProdObj.recipeItems || [];
    if (items.length === 0) {
      const recipeId = selectedProdObj.recipeId || (selectedProdObj as any).recetaId;
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
    return items;
  }, [selectedProdObj, recipes]);

  // Local state for editable recipe items (custom ingredients)
  const [customIngredients, setCustomIngredients] = useState<RecipeItem[]>([]);

  useEffect(() => {
    setCustomIngredients(resolvedRecipeItems);
  }, [resolvedRecipeItems]);

  const sortedProducts = useMemo(() => {
    return [...(products || [])]
      .filter(p => p && p.activo)
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }, [products]);

  const handleIngredientProductChange = (index: number, newProductId: string) => {
    const updated = [...customIngredients];
    const prodObj = products.find(p => p.id === newProductId);
    updated[index] = {
      ...updated[index],
      productId: newProductId,
      unit: prodObj ? prodObj.unitType : 'GRAMOS'
    };
    setCustomIngredients(updated);
  };

  const handleIngredientQuantityChange = (index: number, qty: number) => {
    const updated = [...customIngredients];
    updated[index] = {
      ...updated[index],
      quantity: qty
    };
    setCustomIngredients(updated);
  };

  const handleIngredientUnitChange = (index: number, unit: any) => {
    const updated = [...customIngredients];
    updated[index] = {
      ...updated[index],
      unit: unit
    };
    setCustomIngredients(updated);
  };

  const handleRemoveIngredient = (index: number) => {
    const updated = customIngredients.filter((_, idx) => idx !== index);
    setCustomIngredients(updated);
  };

  const handleAddIngredient = () => {
    setCustomIngredients([
      ...customIngredients,
      {
        productId: '',
        quantity: 0,
        unit: 'GRAMOS'
      }
    ]);
  };

  const handleOrderChange = (orderId: string) => {
    setSelectedOrder(orderId);
    if (!orderId) {
      setOrderProdItems([]);
      return;
    }
    const order = orders.find(o => o.id === orderId);
    if (order) {
      const client = (customers || []).find(c => c.id === order.customerId);
      const clientName = client ? (client.name || client.nombre) : '';
      const clientSuffix = clientName ? ` - ${clientName}` : '';

      setOrderProdItems((order.items || []).map(item => {
        const p = products.find(prod => prod.id === item.productId);
        let initialPesoReal = item.pesoReal !== undefined ? Number(item.pesoReal) : undefined;
        if (initialPesoReal === undefined && p) {
          const isWeightBased = p.unitType === 'KG' || p.unitType === 'UNIDADES';
          if (isWeightBased) {
            const baseQtyInKg = convertQuantityToBaseUnit(Number(item.cantidad || 0), item.unidad || p.unitType || 'KG', { ...p, unitType: 'KG' });
            initialPesoReal = Number(baseQtyInKg.toFixed(3));
          }
        }
        return {
          productId: item.productId,
          cantidad: Number(item.cantidad || 0),
          unidad: item.unidad || p?.unitType || 'KG',
          pesoReal: initialPesoReal,
          merma: undefined,
          observaciones: `Producción de Pedido ${(orderId || '').slice(0, 6)}${clientSuffix} - ${p?.nombre || ''}`,
          elaborado: true
        };
      }));
    }
  };

  const autoOrderStatus = useMemo(() => {
    if (orderProdItems.length === 0) return 'EN_PRODUCCION';
    const allElaborados = orderProdItems.every(it => it.elaborado);
    return allElaborados ? 'PRODUCIDO' : 'EN_PRODUCCION';
  }, [orderProdItems]);

  useEffect(() => {
    setNewStatus(autoOrderStatus);
  }, [autoOrderStatus]);

  const pendingOrders = useMemo(() => {
    return (orders || []).filter(o => o && (o.status === 'PENDIENTE' || o.status === 'EN_PRODUCCION'));
  }, [orders]);

  const pendingByProduct = useMemo(() => {
    const grouped: Record<string, { productName: string, totals: Record<string, number> }> = {};
    pendingOrders.forEach(o => {
      (o.items || []).forEach(item => {
        if (!item || !item.productId) return;
        const p = products.find(prod => prod.id === item.productId);
        if (p) {
          if (!grouped[p.id]) {
            grouped[p.id] = { productName: p.nombre, totals: {} };
          }
          const unit = String(item.unidad || p.unitType || 'KG').toUpperCase().trim();
          if (!grouped[p.id].totals[unit]) {
            grouped[p.id].totals[unit] = 0;
          }
          grouped[p.id].totals[unit] += Number(item.cantidad || 0);
        }
      });
    });
    return grouped;
  }, [pendingOrders, products]);

  const finishedProducts = useMemo(() => {
    return (products || []).filter(p => p && p.type === 'PRESENTACION');
  }, [products]);

  const handleProduce = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (prodMode === 'ORDER') {
      const itemsToProduce = orderProdItems.filter(it => it.elaborado);
      if (itemsToProduce.length === 0) {
        alert("Debe marcar al menos un ítem como elaborado.");
        return;
      }
      
      try {
        await produceMultiple({
          orderId: selectedOrder,
          items: itemsToProduce.map(it => ({
            productId: it.productId,
            cantidad: it.cantidad,
            unidad: it.unidad,
            pesoReal: it.pesoReal,
            merma: it.merma,
            observaciones: it.observaciones
          })),
          newOrderStatus: newStatus
        });
        setShowPanel(false);
        resetPanel();
      } catch (error) {
        alert("Error en producción: " + error);
      }
    } else {
      if (!selectedProduct || prodQty <= 0) {
        alert("Seleccione un producto y cantidad válida.");
        return;
      }
      
      try {
        const validOverride = customIngredients.filter(ing => ing.productId && ing.quantity > 0);
        await produce({
          productId: selectedProduct,
          cantidad: prodQty,
          pesoReal: prodWeight > 0 ? prodWeight : undefined,
          merma: prodMerma > 0 ? prodMerma : undefined,
          observaciones: prodObs,
          recipeItemsOverride: validOverride
        });
        setShowPanel(false);
        resetPanel();
      } catch (error) {
        alert("Error en producción: " + error);
      }
    }
  };

  const resetPanel = () => {
    setProdMode('FREE');
    setSelectedOrder('');
    setSelectedProduct('');
    setProdQty(0);
    setProdWeight(0);
    setProdMerma(0);
    setProdObs('');
    setNewStatus('EN_PRODUCCION');
    setOrderProdItems([]);
    setCustomIngredients([]);
  };

  const openProducePanel = (mode: 'FREE' | 'ORDER', orderId?: string, productId?: string) => {
    resetPanel();
    setProdMode(mode);
    if (productId) {
      setSelectedProduct(productId);
      const totals = pendingByProduct[productId]?.totals || {};
      const p = products.find(prod => prod.id === productId);
      if (p) {
        let baseSum = 0;
        Object.entries(totals).forEach(([unit, qty]) => {
          baseSum += convertQuantityToBaseUnit(qty, unit, p);
        });
        if (p.unitType === 'UNIDADES') {
          setProdQty(Math.max(1, Math.round(baseSum)));
        } else {
          setProdQty(Number(baseSum.toFixed(3)));
        }
      }
    }
    if (orderId) {
      handleOrderChange(orderId);
    }
    setShowPanel(true);
  };

  if (loading) return <LoadingSpinner message="Cargando módulo de producción..." />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Producción</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={() => openProducePanel('FREE')}>+ Prod. Libre</button>
          <button className="btn-primary" onClick={() => openProducePanel('ORDER')}>+ Prod. desde Pedido</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        <button 
          onClick={() => setActiveTab('PENDING')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', borderRadius: '24px', 
            fontWeight: 600, fontSize: '15px',
            backgroundColor: activeTab === 'PENDING' ? 'var(--alvacio-red)' : 'transparent',
            color: activeTab === 'PENDING' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Pendiente
        </button>
        <button 
          onClick={() => setActiveTab('STOCK')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', borderRadius: '24px', 
            fontWeight: 600, fontSize: '15px',
            backgroundColor: activeTab === 'STOCK' ? 'var(--alvacio-red)' : 'transparent',
            color: activeTab === 'STOCK' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Stock Terminado
        </button>
        <button 
          onClick={() => setActiveTab('CAPACITY')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', borderRadius: '24px', 
            fontWeight: 600, fontSize: '15px',
            backgroundColor: activeTab === 'CAPACITY' ? 'var(--alvacio-red)' : 'transparent',
            color: activeTab === 'CAPACITY' ? '#fff' : 'var(--text-secondary)'
          }}
        >
          Capacidad
        </button>
      </div>

      {activeTab === 'PENDING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          <div>
            <h3 style={{ fontSize: '20px', marginBottom: '20px', color: 'var(--text-primary)' }}>Agrupado por Producto</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {Object.keys(pendingByProduct).length === 0 && (
                <p style={{ color: 'var(--text-secondary)' }}>No hay productos pendientes.</p>
              )}
              {Object.entries(pendingByProduct).map(([productId, data]) => (
                <ExpandableCard
                  key={productId}
                  title={data.productName}
                  collapsedContent={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '12px' }}>
                      {Object.entries(data?.totals || {}).map(([unit, total]) => (
                        <div key={unit} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Package size={18} color="var(--alvacio-red)" />
                          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                            {Number(Number(total || 0).toFixed(3))} {unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  }
                  expandedContent={<></>}
                  actions={
                    <button className="btn-secondary" onClick={() => openProducePanel('FREE', undefined, productId)}>
                      Producir esto
                    </button>
                  }
                />
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '20px', marginBottom: '20px', color: 'var(--text-primary)' }}>Pedidos Pendientes</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
              {pendingOrders.map(order => {
                const client = (customers || []).find(c => c.id === order.customerId);
                const clientName = client ? (client.name || client.nombre) : 'Cliente Desconocido';
                return (
                  <ExpandableCard
                    key={order.id}
                    title={`${clientName} - Pedido ${(order.id || '').slice(0, 6)}`}
                    statusBadge={
                      <span style={{ 
                        backgroundColor: order.status === 'PENDIENTE' ? '#fef3c7' : '#dbeafe',
                        color: order.status === 'PENDIENTE' ? '#d97706' : '#2563eb'
                      }}>
                        {order.status}
                      </span>
                    }
                  collapsedContent={
                    <div style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                      {(order.items || []).length} ítems
                    </div>
                  }
                  expandedContent={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(order.items || []).map((item, idx) => {
                        if (!item) return null;
                        const p = products.find(prod => prod.id === item.productId);
                        return (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <span>{p?.nombre}</span>
                            <strong>{item.cantidad || 0} {item.unidad || ''}</strong>
                          </div>
                        );
                      })}
                    </div>
                  }
                  actions={
                    <button className="btn-secondary" style={{ width: '100%' }} onClick={() => openProducePanel('ORDER', order.id)}>
                      Producir este Pedido
                    </button>
                  }
                />
              );
            })}
              {pendingOrders.length === 0 && (
                <p style={{ color: 'var(--text-secondary)' }}>No hay pedidos pendientes de producción.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'STOCK' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          <div>
            <h3 style={{ fontSize: '20px', marginBottom: '20px', color: 'var(--text-primary)' }}>Stock de Terminados</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {(finishedProducts || []).map(p => {
                if (!p) return null;
                return (
                  <ExpandableCard
                    key={p.id}
                    title={p.nombre || 'Producto Desconocido'}
                    collapsedContent={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                        <CheckCircle size={20} color="#16a34a" />
                        <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{p.stockActual || 0}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{p.unitType || ''}</span>
                      </div>
                    }
                    expandedContent={<></>}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '20px', marginBottom: '20px', color: 'var(--text-primary)' }}>Últimos Movimientos</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(movements || []).filter(m => {
                if (!m) return false;
                const isProduction = m.type === 'PRODUCCION';
                const isOrderPrep = m.type === 'VENTA' && (
                  m.observaciones?.startsWith('Preparación de Pedido') ||
                  m.observaciones?.startsWith('Reversión de movimiento')
                );
                return isProduction || isOrderPrep;
              }).sort((a,b) => {
                const timeA = a && a.date ? new Date(a.date).getTime() : 0;
                const timeB = b && b.date ? new Date(b.date).getTime() : 0;
                return timeB - timeA;
              }).slice(0,10).map(m => {
                if (!m) return null;
                const p = products.find(prod => prod.id === m.productId);
                const isOrder = m.type === 'VENTA';
                return (
                  <div key={m.id} className="apple-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <Activity size={24} color={isOrder ? '#f59e0b' : 'var(--alvacio-red)'} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>{p?.nombre || 'Producto Desconocido'}</span>
                          <span style={{ 
                            fontSize: '11px', 
                            padding: '2px 8px', 
                            borderRadius: '12px',
                            fontWeight: 'normal',
                            backgroundColor: isOrder ? '#fef3c7' : '#dcfce7',
                            color: isOrder ? '#b45309' : '#15803d'
                          }}>
                            {isOrder ? 'Por Pedido (Descuenta Stock)' : 'Prod. Libre / Preventa (Ingresa Stock)'}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{m.date ? new Date(m.date).toLocaleString() : ''} • {m.observaciones || 'Sin observaciones'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <strong style={{ fontSize: '18px', color: m.qty > 0 ? '#16a34a' : '#ef4444' }}>
                        {m.qty > 0 ? `+${m.qty}` : m.qty}
                      </strong>
                      <button className="btn-secondary" style={{ padding: '8px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={async () => {
                        if (confirm('¿Generar movimiento compensatorio?')) await revertMovement(m.id);
                      }}>
                        <RotateCcw size={16} /> Revertir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'CAPACITY' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '20px', color: 'var(--text-primary)', margin: 0 }}>Capacidad Máxima</h3>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Basado en stock de insumos</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {(finishedProducts || []).map(p => {
              if (!p) return null;
              const max = getCapacity(p.id) || 0;
              return (
                <ExpandableCard
                  key={p.id}
                  title={p.nombre || 'Producto Desconocido'}
                  collapsedContent={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                      <Clock size={20} color={max > 0 ? "var(--alvacio-red)" : "var(--text-secondary)"} />
                      <span style={{ fontSize: '24px', fontWeight: 'bold', color: max > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {max}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{p.unitType || ''}</span>
                    </div>
                  }
                  expandedContent={<></>}
                  actions={
                    <button className="btn-primary" onClick={() => openProducePanel('FREE', undefined, p.id)} disabled={max === 0}>
                      Producir
                    </button>
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      <RightPanel 
        isOpen={showPanel} 
        onClose={() => setShowPanel(false)} 
        title={prodMode === 'ORDER' ? 'Preparación desde Pedido (Descuenta Stock)' : 'Producción Libre (Stock / Preventa)'}
      >
        <form onSubmit={handleProduce} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {prodMode === 'ORDER' ? (
            <>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px', lineHeight: '1.4' }}>
                Esta acción registra la preparación o feteado de los productos para cumplir con el pedido. Disminuye el stock del producto terminado y no consume insumos de receta.
              </p>
              <div className="form-group">
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

              {selectedOrder && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <label style={{ fontWeight: 600 }}>Ítems del Pedido</label>
                  {orderProdItems.map((item, idx) => {
                    const prod = products.find(p => p.id === item.productId);
                    return (
                      <div key={idx} style={{ background: '#f9f9f9', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="checkbox" 
                            checked={item.elaborado} 
                            onChange={e => {
                              const newItems = [...orderProdItems];
                              newItems[idx].elaborado = e.target.checked;
                              setOrderProdItems(newItems);
                            }} 
                            id={`item-elaborado-${idx}`}
                            style={{ width: 'auto' }}
                          />
                          <label htmlFor={`item-elaborado-${idx}`} style={{ fontWeight: 600, margin: 0 }}>
                            {prod?.nombre || 'Producto Desconocido'}
                          </label>
                        </div>

                        {item.elaborado && (
                          <ProductionFields
                            cantidad={item.cantidad}
                            unidad={item.unidad as any}
                            pesoReal={item.pesoReal}
                            merma={item.merma}
                            observaciones={item.observaciones || ''}
                            pesoObjetivoGramos={prod?.pesoObjetivoGramos}
                            onChange={(updates) => {
                              const newItems = [...orderProdItems];
                              newItems[idx] = { ...newItems[idx], ...updates };
                              setOrderProdItems(newItems);
                            }}
                            isOrder={true}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedOrder && (
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label>Cambiar Estado del Pedido a:</label>
                  <select value={newStatus} onChange={e => setNewStatus(e.target.value as any)}>
                    <option value="EN_PRODUCCION">EN_PRODUCCION</option>
                    <option value="PRODUCIDO">PRODUCIDO</option>
                  </select>
                </div>
              )}
            </>
          ) : (
            <>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px', lineHeight: '1.4' }}>
                Esta acción registra la elaboración/producción de producto terminado. Aumenta el stock del producto terminado y consume los insumos correspondientes de la receta.
              </p>
              <div className="form-group">
                <label>Producto a Producir</label>
                <select required value={selectedProduct} onChange={e => {
                  setSelectedProduct(e.target.value);
                  setProdQty(0);
                  setProdWeight(0);
                  setProdMerma(0);
                  setProdObs('');
                }}>
                  <option value="">-- Seleccione --</option>
                  {finishedProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} (Stock: {p.stockActual || 0} {p.unitType})</option>
                  ))}
                </select>
              </div>

              {selectedProdObj && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  <ProductionFields
                    cantidad={prodQty}
                    unidad={selectedProdObj.unitType}
                    pesoReal={prodWeight > 0 ? prodWeight : undefined}
                    merma={prodMerma > 0 ? prodMerma : undefined}
                    observaciones={prodObs}
                    pesoObjetivoGramos={selectedProdObj.pesoObjetivoGramos}
                    onChange={(updates) => {
                      setProdQty(updates.cantidad);
                      setProdWeight(updates.pesoReal || 0);
                      setProdMerma(updates.merma || 0);
                      setProdObs(updates.observaciones);
                    }}
                    isOrder={false}
                  />

                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <label style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>
                          Ingredientes / Receta Personalizada:
                        </label>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                          onClick={handleAddIngredient}
                        >
                          + Agregar Insumo
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {customIngredients.map((ing, idx) => {
                          const ingProduct = products.find(p => p.id === ing.productId);
                          
                          let convertedQty = 0;
                          if (ingProduct) {
                            try {
                              convertedQty = convertUnit(
                                Number(ing.quantity || 0),
                                ing.unit as any,
                                ingProduct.unitType,
                                ingProduct.nombre || '',
                                '',
                                equivalences || []
                              );
                            } catch (err) {
                              console.error("Error converting unit", err);
                            }
                          }
                          const totalNeeded = convertedQty * (prodQty || 0);
                          const currentStock = ingProduct ? (ingProduct.stockActual || 0) : 0;
                          const hasEnough = currentStock >= totalNeeded;

                          return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '12px', borderBottom: idx < customIngredients.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <select
                                  style={{ flex: 2, padding: '6px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff' }}
                                  value={ing.productId}
                                  required
                                  onChange={(e) => handleIngredientProductChange(idx, e.target.value)}
                                >
                                  <option value="">-- Seleccione Insumo --</option>
                                  {sortedProducts.map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  step="any"
                                  placeholder="Cant"
                                  style={{ width: '80px', padding: '6px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                                  value={ing.quantity || ''}
                                  required
                                  onChange={(e) => handleIngredientQuantityChange(idx, Number(e.target.value))}
                                />
                                <select
                                  style={{ width: '100px', padding: '6px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff' }}
                                  value={ing.unit}
                                  required
                                  onChange={(e) => handleIngredientUnitChange(idx, e.target.value as any)}
                                >
                                  <option value="GRAMOS">GRAMOS</option>
                                  <option value="KG">KG</option>
                                  <option value="UNIDADES">UNIDADES</option>
                                  <option value="FETAS">FETAS</option>
                                </select>
                                <button
                                  type="button"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: '16px'
                                  }}
                                  onClick={() => handleRemoveIngredient(idx)}
                                >
                                  ✕
                                </button>
                              </div>
                              {ing.productId && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '4px' }}>
                                  <span>
                                    Necesario: <strong style={{ color: 'var(--text-primary)' }}>{Number(totalNeeded.toFixed(3))} {ingProduct?.unitType || ''}</strong>
                                  </span>
                                  <span style={{ color: hasEnough ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                                    Stock: {Number(currentStock.toFixed(3))} {ingProduct?.unitType || ''} ({hasEnough ? 'OK' : 'FALTA'})
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {customIngredients.length === 0 && (
                          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '12px 0' }}>
                            Sin ingredientes. Presione "+ Agregar Insumo" para añadir uno.
                          </div>
                        )}
                      </div>
                    </div>
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
            <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowPanel(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" style={{ flex: 1 }}>Confirmar</button>
          </div>
        </form>
      </RightPanel>
    </div>
  );
}
