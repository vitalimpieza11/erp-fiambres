import React from 'react';

interface IngredientInputProps {
  orderId: string;
  itemId: string;
  productId: string;
  name: string;
  theoreticalQty: number;
  unit: 'g' | 'kg' | 'fetas' | 'unidades';
  currentValue: number;
  currentUnit: 'g' | 'kg' | 'fetas' | 'unidades';
  isEditable: boolean;
  onChangeValue: (orderId: string, itemId: string, productId: string, value: number) => void;
  onChangeUnit: (orderId: string, itemId: string, productId: string, unit: 'g' | 'kg' | 'fetas' | 'unidades') => void;
}

export const IngredientInput: React.FC<IngredientInputProps> = ({
  orderId,
  itemId,
  productId,
  name,
  theoreticalQty,
  unit,
  currentValue,
  currentUnit,
  isEditable,
  onChangeValue,
  onChangeUnit,
}) => {
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
    onChangeValue(orderId, itemId, productId, val);
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangeUnit(orderId, itemId, productId, e.target.value as 'g' | 'kg' | 'fetas' | 'unidades');
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
      gap: '12px',
      alignItems: 'center',
      margin: '8px 0'
    }}>
      <span style={{ fontWeight: 600 }}>• {name}</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
        Teórico: {theoreticalQty % 1 === 0 ? theoreticalQty : theoreticalQty.toFixed(3)} {unit}
      </span>

      {isEditable ? (
        <>
          <input
            type="number"
            step="any"
            value={currentValue}
            onChange={handleValueChange}
            style={{
              width: '100%',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontWeight: 'bold',
              fontSize: '0.85rem'
            }}
          />
          <select
            value={currentUnit}
            onChange={handleUnitChange}
            style={{
              width: '100%',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem'
            }}
          >
            <option value="g">Gramos (g)</option>
            <option value="kg">Kilogramos (kg)</option>
            <option value="fetas">Fetas</option>
            <option value="unidades">Unidades</option>
          </select>
        </>
      ) : (
        <span style={{ gridColumn: 'span 2', color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.8rem' }}>
          Comenzar preparación para editar consumo real
        </span>
      )}
    </div>
  );
};

export default IngredientInput;
