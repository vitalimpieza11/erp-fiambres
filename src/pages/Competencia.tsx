import React, { useState } from 'react';
import { PageHeader } from '../components/EmptyState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Input, Select } from '../components/ui/Forms';
import { 
  Search, Plus, Filter, Target, TrendingDown, TrendingUp, Minus
} from 'lucide-react';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';

const initialCompetencia = [
  { id: 1, competidor: 'Fiambrería El Tano', product: 'Jamón Cocido Paladini', gramaje: '200g', price: 2800, date: '15/05/2026', internalPrice: 3000 },
  { id: 2, competidor: 'Supermercado Dar', product: 'Queso Tybo', gramaje: '150g', price: 2100, date: '16/05/2026', internalPrice: 2000 },
  { id: 3, competidor: 'Rotisería Central', product: 'Salame Milán', gramaje: '100g', price: 3500, date: '18/05/2026', internalPrice: 3000 },
];

export const Competencia = () => {
  const [competencia, setCompetencia] = useState(initialCompetencia);
  const [competidor, setCompetidor] = useState('');
  const [productoInterno, setProductoInterno] = useState('p1');
  const [gramaje, setGramaje] = useState('200g');
  const [precioObsStr, setPrecioObsStr] = useState('');
  
  const handleSave = () => {
    const pObs = parseNumber(precioObsStr);
    if (!competidor || pObs <= 0) return;
    
    let prodName = 'Jamón Cocido Paladini';
    let intPrice = 3000;
    if (productoInterno === 'p2') {
      prodName = 'Queso Tybo';
      intPrice = 2000;
    }

    const newItem = {
      id: Date.now(),
      competidor,
      product: prodName,
      gramaje,
      price: pObs,
      date: new Date().toLocaleDateString('es-AR'),
      internalPrice: intPrice
    };

    setCompetencia([newItem, ...competencia]);
    setCompetidor('');
    setPrecioObsStr('');
  };

  const getDiffStatus = (theirPrice: number, ourPrice: number) => {
    const threshold = ourPrice * 0.05; // 5% difference is "similar"
    if (Math.abs(theirPrice - ourPrice) <= threshold) return 'SIMILAR';
    if (theirPrice < ourPrice) return 'MÁS BARATO';
    return 'MÁS CARO';
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <PageHeader title="Competencia" description="Relevamiento de precios de mercado" />
        <button className="btn btn-primary">
          <Plus size={18} />
          Registrar Precio
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '32px' }}>
        {/* Formulario rápido de carga */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Target size={20} color="var(--primary-color)" />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Carga Rápida</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input label="Competidor" placeholder="Ej: Fiambrería Norte" value={competidor} onChange={e => setCompetidor(e.target.value)} />
            <Select label="Producto Interno Relacionado" value={productoInterno} onChange={e => setProductoInterno(e.target.value)} options={[
              { value: 'p1', label: 'Jamón Cocido Paladini' },
              { value: 'p2', label: 'Queso Tybo' }
            ]} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Input label="Gramaje Relevado" placeholder="200g" value={gramaje} onChange={e => setGramaje(e.target.value)} />
              <Input label="Precio Observado ($)" type="number" placeholder="2800" value={precioObsStr} onChange={e => setPrecioObsStr(e.target.value)} />
            </div>
            <Input label="Fecha del Relevamiento" type="date" defaultValue="2026-05-18" />
            <button onClick={handleSave} style={{ width: '100%', padding: '12px', backgroundColor: '#1e293b', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', marginTop: '8px' }}>
              Guardar Relevamiento
            </button>
          </div>
        </Card>

        {/* Tabla principal */}
        <Card padding="none">
          <div style={{ padding: '20px', display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
              <input 
                type="text" 
                placeholder="Buscar competidor o producto..." 
                style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
              />
            </div>
            <button className="btn btn-secondary">
              <Filter size={18} />
              Filtros
            </button>
          </div>

          <Table 
            data={competencia}
            keyExtractor={(item) => item.id.toString()}
            columns={[
              { header: 'Competidor', accessor: (item) => <span style={{ fontWeight: 600 }}>{item.competidor}</span> },
              { 
                header: 'Producto Observado', 
                accessor: (item) => (
                  <div>
                    <span style={{ display: 'block', color: 'var(--text-primary)' }}>{item.product}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.gramaje}</span>
                  </div>
                ) 
              },
              { header: 'Precio', accessor: (item) => <span style={{ fontWeight: 700 }}>{formatCurrency(item.price)}</span> },
              { header: 'Fecha', accessor: 'date' },
              { 
                header: 'Análisis (Vs Nosotros)', 
                accessor: (item) => {
                  const diff = getDiffStatus(item.price, item.internalPrice);
                  let bg, color, Icon;
                  if (diff === 'MÁS BARATO') { bg = '#fee2e2'; color = '#dc2626'; Icon = TrendingDown; }
                  else if (diff === 'SIMILAR') { bg = '#f1f5f9'; color = '#475569'; Icon = Minus; }
                  else { bg = '#dcfce7'; color = '#16a34a'; Icon = TrendingUp; }

                  return (
                    <span style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
                      backgroundColor: bg, color: color
                    }}>
                      <Icon size={14} /> {diff}
                    </span>
                  )
                },
                align: 'center'
              },
            ]}
          />
        </Card>
      </div>
    </>
  );
};
