import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Check } from 'lucide-react';
import MobileTopBar from '../../layout/MobileTopBar';
import MobileButton from '../../components/MobileButton';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import MobileSearchBar from '../../components/MobileSearchBar';
import MobileListItem from '../../components/MobileListItem';
import NumpadGigante from '../../components/NumpadGigante';
import { useProveedoresStore } from '../../../store/proveedoresStore';
import { useProductsStore } from '../../../store/productsStore';

export default function IngresoCompras() {
  const navigate = useNavigate();
  const { suppliers, subscribeAll } = useProveedoresStore();
  const { productos, fetchProductos } = useProductsStore();

  const [proveedor, setProveedor] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  
  const [isProvSheetOpen, setIsProvSheetOpen] = useState(false);
  const [isProdSheetOpen, setIsProdSheetOpen] = useState(false);
  const [isNumpadOpen, setIsNumpadOpen] = useState(false);
  
  const [currentAddingProd, setCurrentAddingProd] = useState<any>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [costInput, setCostInput] = useState('');
  const [stepNumpad, setStepNumpad] = useState<'QTY' | 'COST'>('QTY');

  useEffect(() => {
    fetchProductos();
    const unsub = subscribeAll();
    return () => unsub();
  }, [fetchProductos, subscribeAll]);

  const handleStartAddProduct = (prod: any) => {
    setCurrentAddingProd(prod);
    setQtyInput('');
    setCostInput(prod.costoActual?.toString() || '');
    setStepNumpad('QTY');
    setIsProdSheetOpen(false);
    setIsNumpadOpen(true);
  };

  const handleNumpadEnter = () => {
    if (stepNumpad === 'QTY') {
      if (!qtyInput) return;
      setStepNumpad('COST'); // Pasamos a preguntar el costo
    } else {
      if (!costInput) return;
      // Terminar carga del producto
      setItems([...items, {
        productId: currentAddingProd.id,
        nombre: currentAddingProd.nombre,
        cantidad: parseFloat(qtyInput),
        costoUnitario: parseFloat(costInput),
        subtotal: parseFloat(qtyInput) * parseFloat(costInput)
      }]);
      setIsNumpadOpen(false);
      setCurrentAddingProd(null);
      // Feedback si se quiere
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    }
  };

  const total = items.reduce((acc, i) => acc + i.subtotal, 0);

  const handleFinalizarCompra = () => {
    // Aquí se llamaría a purchaseStore.addPurchase
    alert("Compra registrada. Costos y stock actualizados (Simulado).");
    navigate('/mobile/deposito');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#ffffff', paddingBottom: '120px' }}>
      <MobileTopBar 
        title="Ingreso de Mercadería" 
        leftElement={<div onClick={() => navigate(-1)} style={{ padding: '8px' }}><ArrowLeft size={24} color="var(--mobile-text-secondary)" /></div>}
      />

      <div style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '13px', color: 'var(--mobile-text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>1. Remito de Proveedor</h3>
        
        {proveedor ? (
          <div onClick={() => setIsProvSheetOpen(true)} style={{ backgroundColor: '#f3f4f6', padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '18px', fontWeight: 600 }}>{proveedor.nombre}</span>
            <span style={{ color: 'var(--mobile-primary)', fontSize: '14px', fontWeight: 600 }}>Cambiar</span>
          </div>
        ) : (
          <MobileButton variant="outline" fullWidth onClick={() => setIsProvSheetOpen(true)} style={{ height: '60px', borderStyle: 'dashed' }}>
            <Plus size={20} style={{ marginRight: '8px' }} /> Seleccionar Proveedor
          </MobileButton>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '13px', color: 'var(--mobile-text-secondary)', textTransform: 'uppercase', margin: 0 }}>2. Carga de Ítems</h3>
          <span onClick={() => setIsProdSheetOpen(true)} style={{ color: 'var(--mobile-primary)', fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Plus size={18} /> Agregar
          </span>
        </div>

        {items.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', backgroundColor: '#f9fafb', borderRadius: '16px' }}>
            Toque "Agregar" o escanee un código de barras para ingresar productos.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid var(--mobile-border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong style={{ fontSize: '16px' }}>{item.nombre}</strong>
                  <span style={{ fontSize: '13px', color: 'var(--mobile-text-secondary)' }}>{item.cantidad} x ${item.costoUnitario}</span>
                </div>
                <strong style={{ fontSize: '16px' }}>${item.subtotal}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        backgroundColor: 'var(--mobile-surface)', padding: '16px',
        borderTop: '1px solid var(--mobile-border)', boxShadow: '0 -4px 12px rgba(0,0,0,0.05)',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ color: 'var(--mobile-text-secondary)' }}>Total Ingreso</span>
          <strong style={{ fontSize: '24px' }}>${total.toLocaleString('es-AR')}</strong>
        </div>
        <MobileButton size="lg" fullWidth disabled={!proveedor || items.length === 0} onClick={handleFinalizarCompra}>
          <Check size={20} style={{ marginRight: '8px' }} /> Finalizar Ingreso
        </MobileButton>
      </div>

      {/* Selectores */}
      <MobileBottomSheet isOpen={isProvSheetOpen} onClose={() => setIsProvSheetOpen(false)} title="Proveedores" height="70vh">
        {suppliers.map(s => (
          <MobileListItem key={s.id} title={s.nombre} onClick={() => { setProveedor(s); setIsProvSheetOpen(false); }} />
        ))}
      </MobileBottomSheet>

      <MobileBottomSheet isOpen={isProdSheetOpen} onClose={() => setIsProdSheetOpen(false)} title="Agregar al Ingreso" height="85vh">
        <MobileSearchBar value="" onChange={() => {}} placeholder="Buscar producto..." />
        <div style={{ marginTop: '16px' }}>
          {productos.map(p => (
            <MobileListItem 
              key={p.id} title={p.nombre} subtitle={`Costo Actual: $${p.costoActual || 0}`}
              onClick={() => handleStartAddProduct(p)}
            />
          ))}
        </div>
      </MobileBottomSheet>

      {/* Teclado In-App para Cantidades y Costos */}
      <MobileBottomSheet isOpen={isNumpadOpen} onClose={() => setIsNumpadOpen(false)} height="60vh">
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '20px' }}>{currentAddingProd?.nombre}</h3>
          <p style={{ margin: '4px 0 0 0', color: 'var(--mobile-text-secondary)', fontSize: '14px' }}>
            {stepNumpad === 'QTY' ? 'Ingrese la cantidad recibida:' : 'Confirme el costo unitario nuevo:'}
          </p>
          <div style={{ fontSize: '40px', fontWeight: 800, color: 'var(--mobile-primary)', marginTop: '8px' }}>
            {stepNumpad === 'QTY' ? qtyInput || '0' : costInput || '0'}
          </div>
        </div>
        <NumpadGigante 
          value={stepNumpad === 'QTY' ? qtyInput : costInput} 
          onChange={stepNumpad === 'QTY' ? setQtyInput : setCostInput} 
          onEnter={handleNumpadEnter} 
        />
        <div style={{ padding: '16px' }}>
          <MobileButton fullWidth onClick={handleNumpadEnter}>Siguiente</MobileButton>
        </div>
      </MobileBottomSheet>
    </div>
  );
}
