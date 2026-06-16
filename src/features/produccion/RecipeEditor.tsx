import { useMemo } from 'react';
import type { Product, RecipeItem, Equivalencia } from '../../types/domain';
import { convertUnit } from '../../lib/unitConverter';
import { truncateDecimals } from '../../lib/formatters';

interface RecipeEditorProps {
  ingredients: RecipeItem[];
  onChange: (newIngredients: RecipeItem[]) => void;
  products: Product[];
  equivalences: Equivalencia[];
  prodQty: number;
}

export default function RecipeEditor({
  ingredients,
  onChange,
  products,
  equivalences,
  prodQty
}: RecipeEditorProps) {
  
  const sortedProducts = useMemo(() => {
    return [...(products || [])]
      .filter(p => p && p.activo)
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }, [products]);

  const handleIngredientProductChange = (index: number, newProductId: string) => {
    const updated = [...ingredients];
    const prodObj = products.find(p => p.id === newProductId);
    updated[index] = {
      ...updated[index],
      productId: newProductId,
      unit: prodObj ? (prodObj.unitType as any) : 'GRAMOS'
    };
    onChange(updated);
  };

  const handleIngredientQuantityChange = (index: number, qty: number) => {
    const updated = [...ingredients];
    updated[index] = {
      ...updated[index],
      quantity: qty
    };
    onChange(updated);
  };

  const handleIngredientUnitChange = (index: number, unit: any) => {
    const updated = [...ingredients];
    updated[index] = {
      ...updated[index],
      unit: unit
    };
    onChange(updated);
  };

  const handleIngredientPesoNetoChange = (index: number, pesoNeto: number | undefined) => {
    const updated = [...ingredients];
    updated[index] = {
      ...updated[index],
      pesoNeto: pesoNeto
    };
    onChange(updated);
  };

  const handleRemoveIngredient = (index: number) => {
    const updated = ingredients.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  const handleAddIngredient = () => {
    onChange([
      ...ingredients,
      {
        productId: '',
        quantity: 0,
        unit: 'GRAMOS'
      }
    ]);
  };

  return (
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
        {ingredients.map((ing, idx) => {
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
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '12px', borderBottom: idx < ingredients.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
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
                  style={{ width: '60px', padding: '6px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  value={ing.quantity || ''}
                  required
                  onChange={(e) => handleIngredientQuantityChange(idx, Number(e.target.value))}
                />
                <select
                  style={{ width: '90px', padding: '6px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff' }}
                  value={ing.unit}
                  required
                  onChange={(e) => handleIngredientUnitChange(idx, e.target.value as any)}
                >
                  <option value="GRAMOS">GRAMOS</option>
                  <option value="KG">KG</option>
                  <option value="UNIDADES">UNIDADES</option>
                  <option value="FETAS">FETAS</option>
                </select>
                <input
                  type="number"
                  step="any"
                  placeholder="Neto KG"
                  style={{ width: '80px', padding: '6px', fontSize: '13px', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                  value={ing.pesoNeto !== undefined ? ing.pesoNeto : ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? undefined : Number(e.target.value);
                    handleIngredientPesoNetoChange(idx, val);
                  }}
                />
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
                    Necesario: <strong style={{ color: 'var(--text-primary)' }}>{truncateDecimals(totalNeeded, 3)} {ingProduct?.unitType || ''}</strong>
                  </span>
                  <span style={{ color: hasEnough ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                    Stock: {truncateDecimals(currentStock, 3)} {ingProduct?.unitType || ''} ({hasEnough ? 'OK' : 'FALTA'})
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {ingredients.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '12px 0' }}>
            Sin ingredientes. Presione "+ Agregar Insumo" para añadir uno.
          </div>
        )}
      </div>
    </div>
  );
}
