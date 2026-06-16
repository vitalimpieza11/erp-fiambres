import { useState, useMemo, useEffect } from 'react';
import RightPanel from '../../components/RightPanel';
import ProductionFields from './ProductionFields';
import RecipeEditor from './RecipeEditor';
import { convertQuantityToBaseUnit } from '../../lib/unitConverter';
import type { Product, RecipeItem, Equivalencia } from '../../types/domain';
import { truncateDecimals } from '../../lib/formatters';

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
    if (customIngredients.length > 0 && selectedProduct) {
      let calculatedWeight = 0;
      customIngredients.forEach(ing => {
        const ingProduct = products.find(p => p.id === ing.productId);
        if (ingProduct && ingProduct.type !== 'INSUMO') {
          if (ing.pesoNeto !== undefined && ing.pesoNeto > 0) {
            calculatedWeight += ing.pesoNeto;
          } else {
            try {
              calculatedWeight += convertQuantityToBaseUnit(ing.quantity, ing.unit, { ...ingProduct, unitType: 'KG' }) * prodQty;
            } catch (e) {
              console.error(e);
            }
          }
        }
      });
      if (calculatedWeight > 0) {
        setProdWeight(Number(calculatedWeight.toFixed(3)));
      }
    }
  }, [customIngredients, prodQty, selectedProduct, products]);

  const handleProduce = async (e: React.FormEvent) => {
    e.preventDefault();
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
            />
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
