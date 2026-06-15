import React from 'react';
import { convertQuantityToBaseUnit } from '../../lib/unitConverter';

interface ProductionFieldsProps {
  cantidad: number;
  unidad: 'KG' | 'GRAMOS' | 'UNIDADES' | 'FETAS';
  pesoReal?: number;
  merma?: number;
  observaciones: string;
  pesoObjetivoGramos?: number;
  onChange: (updates: {
    cantidad: number;
    pesoReal?: number;
    merma?: number;
    observaciones: string;
  }) => void;
  isOrder: boolean;
}

export default function ProductionFields({
  cantidad,
  unidad,
  pesoReal,
  merma,
  observaciones,
  pesoObjetivoGramos,
  onChange,
  isOrder
}: ProductionFieldsProps) {
  const isUnitBased = unidad === 'UNIDADES';

  return (
    <>
      <div style={{ display: 'flex', gap: '12px' }}>
        {isUnitBased ? (
          <>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {isOrder ? 'Cant. Preparada (UNIDADES)' : 'Cant. Producida (UNIDADES)'}
              </label>
              <input 
                type="number" 
                step="1"
                min="1"
                required 
                value={cantidad || ''} 
                onChange={e => {
                  const val = Number(e.target.value);
                  let newPesoReal = pesoReal;
                  if (pesoObjetivoGramos) {
                    newPesoReal = Number(((val * pesoObjetivoGramos) / 1000).toFixed(3));
                  }
                  onChange({ cantidad: val, pesoReal: newPesoReal, merma, observaciones });
                }} 
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Peso Real (KG)</label>
              <input 
                type="number" 
                step="0.001" 
                required
                value={pesoReal !== undefined ? pesoReal : ''} 
                onChange={e => {
                  onChange({
                    cantidad,
                    pesoReal: e.target.value ? Number(e.target.value) : undefined,
                    merma,
                    observaciones
                  });
                }} 
              />
            </div>
          </>
        ) : (
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Peso Real ({unidad})
            </label>
            <input 
              type="number" 
              step={unidad === 'GRAMOS' || unidad === 'FETAS' ? '1' : '0.001'}
              min={unidad === 'GRAMOS' || unidad === 'FETAS' ? '1' : '0.001'}
              required 
              value={cantidad || ''} 
              onChange={e => {
                const val = Number(e.target.value);
                const baseQtyInKg = convertQuantityToBaseUnit(val, unidad, { unitType: 'KG' } as any);
                onChange({
                  cantidad: val,
                  pesoReal: Number(baseQtyInKg.toFixed(3)),
                  merma,
                  observaciones
                });
              }} 
            />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Merma (Opc.)</label>
          <input 
            type="number" 
            step="0.01" 
            value={merma || ''} 
            onChange={e => {
              onChange({
                cantidad,
                pesoReal,
                merma: e.target.value ? Number(e.target.value) : undefined,
                observaciones
              });
            }} 
          />
        </div>
      </div>
      <div className="form-group">
        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Observaciones</label>
        <input 
          type="text" 
          value={observaciones} 
          onChange={e => {
            onChange({
              cantidad,
              pesoReal,
              merma,
              observaciones: e.target.value
            });
          }} 
        />
      </div>
    </>
  );
}
