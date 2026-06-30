import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Star, Clock, Package } from 'lucide-react';
import MobileTopBar from '../../layout/MobileTopBar';
import MobileSearchBar from '../../components/MobileSearchBar';
import MobileListItem from '../../components/MobileListItem';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import { useProductsStore } from '../../../store/productsStore';
import { useStockStore } from '../../../store/stockStore';

export default function ProductosBuscador() {
  const navigate = useNavigate();
  const { productos, fetchProductos } = useProductsStore();
  const { products: stockInfo, fetchData: fetchStock } = useStockStore();
  
  const [query, setQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProductos();
    fetchStock();
  }, [fetchProductos, fetchStock]);

  const filtrados = useMemo(() => {
    if (!query) return productos.slice(0, 15); // Mostrar recientes/primeros cuando no hay query
    return productos.filter(p => p.nombre.toLowerCase().includes(query.toLowerCase()));
  }, [query, productos]);

  const handleSelect = (prod: any) => {
    setSelectedProduct(prod);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--mobile-bg)' }}>
      <MobileTopBar 
        title="Buscador" 
        leftElement={<div onClick={() => navigate(-1)} style={{ padding: '8px' }}><ArrowLeft size={24} color="var(--mobile-text-secondary)" /></div>}
      />
      
      {/* Barra Fija */}
      <div style={{ padding: '16px', backgroundColor: 'var(--mobile-surface)', borderBottom: '1px solid var(--mobile-border)' }}>
        <MobileSearchBar 
          value={query} 
          onChange={setQuery} 
          placeholder="Escanear o buscar producto..." 
          // autofocus in futuro o hook de teclado
        />
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mobile-primary)', borderBottom: '2px solid var(--mobile-primary)', paddingBottom: '4px' }}>Todos</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mobile-text-secondary)', paddingBottom: '4px' }}>Favoritos</span>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mobile-text-secondary)', paddingBottom: '4px' }}>Recientes</span>
        </div>
      </div>

      {/* Lista virtualizada (conceptual) */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
        {filtrados.map(p => {
          const sInfo = stockInfo.find(s => s.id === p.id);
          const stockGral = sInfo ? (sInfo as any).stockFisico : p.stockActual;

          return (
            <MobileListItem
              key={p.id}
              title={p.nombre}
              subtitle={`Costo: $${p.costoActual || 0} | Venta: $${p.precioComercial || 0}`}
              rightElement={
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: stockGral > 0 ? '#10b981' : '#ef4444' }}>
                    {stockGral || 0} {p.unitType}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--mobile-text-secondary)' }}>Disp.</div>
                </div>
              }
              onClick={() => handleSelect(p)}
            />
          );
        })}
      </div>

      {/* Ficha Rápida del Producto (BottomSheet) */}
      <MobileBottomSheet isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)} height="65vh">
        {selectedProduct && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ backgroundColor: '#f3f4f6', padding: '16px', borderRadius: '20px' }}>
                <Package size={40} color="#6b7280" />
              </div>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0', lineHeight: 1.1 }}>{selectedProduct.nombre}</h2>
                <span style={{ fontSize: '15px', color: 'var(--mobile-text-secondary)' }}>Código: {selectedProduct.codigo || 'S/N'} • {selectedProduct.unitType}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ backgroundColor: '#f0fdf4', padding: '16px', borderRadius: '16px' }}>
                <span style={{ fontSize: '13px', color: '#166534' }}>Precio Venta</span>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#15803d' }}>${selectedProduct.precioComercial || 0}</div>
              </div>
              <div style={{ backgroundColor: '#fef2f2', padding: '16px', borderRadius: '16px' }}>
                <span style={{ fontSize: '13px', color: '#991b1b' }}>Costo Unit.</span>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#b91c1c' }}>${selectedProduct.costoActual || 0}</div>
              </div>
            </div>

            {/* Accesos Rápidos Ficha */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button style={{ flex: 1, height: '50px', borderRadius: '16px', backgroundColor: 'var(--mobile-primary)', color: 'white', border: 'none', fontWeight: 600, fontSize: '16px' }}>
                Editar Precios
              </button>
              <button style={{ flex: 1, height: '50px', borderRadius: '16px', backgroundColor: '#e5e7eb', color: 'var(--mobile-text-primary)', border: 'none', fontWeight: 600, fontSize: '16px' }}>
                Ver Movimientos
              </button>
            </div>
          </div>
        )}
      </MobileBottomSheet>
    </div>
  );
}
