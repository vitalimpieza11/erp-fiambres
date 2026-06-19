import { useState, useMemo, useEffect } from 'react';
import RightPanel from '../../components/RightPanel';
import ProductionFields from './ProductionFields';
import RecipeEditor from './RecipeEditor';
import { convertQuantityToBaseUnit } from '../../lib/unitConverter';
import type { Product, RecipeItem, Equivalencia } from '../../types/domain';
import { mapRecipeUnitToUnitType } from '../../types/domain';
import { truncateDecimals } from '../../lib/formatters';
import { calculateProductionCostDetails } from '../../utils/costHelpers';

interface FreeProductionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  recipes: any[];
  equivalences: Equivalencia[];
  produce: (data: {
    productId: string;
    cantidad: number;
    pesoReal?: number;
    merma?: number;
    observaciones: string;
    recipeItemsOverride?: RecipeItem[];
  }) => Promise<void>;
  initialProductId?: string;
  pendingTotals?: Record<string, number>;
}

export default function FreeProductionPanel({
  isOpen,
  onClose,
  products,
  recipes,
  equivalences,
  produce,
  initialProductId,
  pendingTotals
}: FreeProductionPanelProps) {
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [prodQty, setProdQty] = useState<number>(0);
  const [prodWeight, setProdWeight] = useState<number>(0);
  const [prodMerma, setProdMerma] = useState<number>(0);
  const [prodObs, setProdObs] = useState<string>('');
  const [customIngredients, setCustomIngredients] = useState<RecipeItem[]>([]);

  const finishedProducts = useMemo(() => {
    return (products || []).filter(p => p && p.type === 'PRESENTACION');
  }, [products]);

  const selectedProdObj = useMemo(() => {
    return (products || []).find(p => p && p.id === selectedProduct);
  }, [products, selectedProduct]);

  const resolvedRecipeItems = useMemo(() => {
    if (!selectedProdObj) return [];
    const recipe = (recipes || []).find(r => r.productId === selectedProdObj.id);
    return recipe ? recipe.items : [];
  }, [selectedProdObj, recipes]);

  useEffect(() => {
    setCustomIngredients(resolvedRecipeItems);
  }, [resolvedRecipeItems]);

  useEffect(() => {
    if (isOpen) {
      setSelectedProduct(initialProductId || '');
      setProdQty(0);
      setProdWeight(0);
      setProdMerma(0);
      setProdObs('');
      
      if (initialProductId && pendingTotals) {
        const p = products.find(prod => prod.id === initialProductId);
        if (p) {
          let baseSum = 0;
          Object.entries(pendingTotals).forEach(([unit, qty]) => {
            baseSum += convertQuantityToBaseUnit(qty, unit, p);
          });
          if (p.unitType === 'UNIDADES') {
            setProdQty(Math.max(1, Math.round(baseSum)));
          } else {
            setProdQty(Number(baseSum.toFixed(3)));
          }
        }
      }
    }
  }, [isOpen, initialProductId, pendingTotals, products]);

  useEffect(() => {
    // Solo inicializar el peso si es 0, no lo sobreescribas cada vez
    if (customIngredients.length > 0 && selectedProduct && prodWeight === 0) {
      let calculatedWeight = 0;
      customIngredients.forEach(ing => {
        const ingProduct = products.find(p => p.id === ing.ingredientProductId);
        if (ingProduct && ingProduct.type !== 'INSUMO') {
          try {
            calculatedWeight += convertQuantityToBaseUnit(ing.quantity, mapRecipeUnitToUnitType(ing.unit), { ...ingProduct, unitType: 'KG' }) * prodQty;
          } catch (e) {
            console.error(e);
          }
        }
      });
      if (calculatedWeight > 0) {
        setProdWeight(Number(calculatedWeight.toFixed(3)));
      }
    }
  }, [customIngredients, prodQty, selectedProduct, products]);

  const costDetails = useMemo(() => {
    return calculateProductionCostDetails(
      customIngredients,
      prodQty,
      prodWeight > 0 ? prodWeight : undefined,
      selectedProdObj,
      products,
      equivalences
    );
  }, [customIngredients, prodQty, prodWeight, selectedProdObj, products, equivalences]);

  const handleProduce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || prodQty <= 0) {
      alert("Seleccione un producto y cantidad válida.");
      return;
    }
    try {
      const validOverride = customIngredients.filter(ing => ing.ingredientProductId && ing.quantity > 0);
      await produce({
        productId: selectedProduct,
        cantidad: prodQty,
        pesoReal: prodWeight > 0 ? prodWeight : undefined,
        merma: prodMerma > 0 ? prodMerma : undefined,
        observaciones: prodObs,
        recipeItemsOverride: validOverride
      });
      onClose();
    } catch (error) {
      alert("Error en producción: " + error);
    }
  };

  return (
    <RightPanel 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Producción Libre (Stock / Preventa)"
    >
      <form onSubmit={handleProduce} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
              <option key={p.id} value={p.id}>{p.nombre} (Stock: {truncateDecimals(p.stockActual || 0, 3)} {p.unitType})</option>
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

            <RecipeEditor
              ingredients={customIngredients}
              onChange={setCustomIngredients}
              products={products}
              equivalences={equivalences}
              prodQty={prodQty}
              pesoReal={prodWeight > 0 ? prodWeight : undefined}
              targetProduct={selectedProdObj}
            />

            {/* Panel de Costos de Producción Libre */}
            {prodQty > 0 && (
              <div style={{ 
                background: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: '12px', 
                padding: '16px',
                marginTop: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📊</span> Análisis de Costos de Producción
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div style={{ background: '#fff', padding: '6px 10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Mat. Prima</span>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>${costDetails.rawMaterialCost.toFixed(2)}</strong>
                  </div>
                  <div style={{ background: '#fff', padding: '6px 10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', display: 'block' }}>Insumos/Emb.</span>
                    <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>${costDetails.packagingCost.toFixed(2)}</strong>
                  </div>
                  <div style={{ background: '#fffbeb', padding: '6px 10px', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                    <span style={{ fontSize: '10px', color: '#b45309', display: 'block' }}>Costo Total</span>
                    <strong style={{ fontSize: '13px', color: '#b45309' }}>${costDetails.totalCost.toFixed(2)}</strong>
                  </div>
                </div>

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

                <div style={{ marginTop: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Desglose de Ingredientes:
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                    {costDetails.ingredients.map((ing, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '3px 0', borderBottom: '1px dashed #f1f5f9' }}>
                        <span style={{ color: 'var(--text-primary)' }}>
                          • {ing.ingredientName} ({ing.quantityUsed} {ing.unit})
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                            [${ing.unitCost.toFixed(2)}/{ing.unit}]
                          </span>
                        </span>
                        <strong style={{ color: 'var(--text-primary)' }}>${ing.totalCost.toFixed(2)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" style={{ flex: 1 }}>Confirmar</button>
        </div>
      </form>
    </RightPanel>
  );
}
