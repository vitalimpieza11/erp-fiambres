import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NumpadGigante from '../../components/NumpadGigante';
import { useOrdersStore } from '../../../store/ordersStore';
import { useProductsStore } from '../../../store/productsStore';
import { useProductionStore } from '../../../store/productionStore';
import { CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';

export default function ProduccionFlow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { pedidos, changeStatus } = useOrdersStore();
  const { productos, fetchProductos } = useProductsStore();
  const { produceStep, loading: isProducing } = useProductionStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [weightInput, setWeightInput] = useState('');
  const [completed, setCompleted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  const pedido = useMemo(() => pedidos.find(p => p.id === id), [pedidos, id]);
  
  useEffect(() => {
    if (pedido && pedido.status === 'PENDIENTE') {
      changeStatus(pedido.id, 'EN_PRODUCCION');
    }
  }, [pedido, changeStatus]);

  if (!pedido) return null;

  const currentItem = pedido.items ? pedido.items[currentIndex] : null;
  const currentProduct = currentItem ? productos.find(p => p.id === currentItem.productId) : null;

  const handleNext = async () => {
    if (isProducing || !weightInput || parseFloat(weightInput) <= 0) return;
    setErrorMsg('');
    
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    
    const isLast = currentIndex >= (pedido.items?.length || 0) - 1;
    
    try {
      await produceStep({
        orderId: pedido.id,
        productId: currentItem!.productId,
        cantidad: currentItem!.cantidad,
        unidad: currentItem!.unidad,
        pesoReal: parseFloat(weightInput),
        pesosReales: [parseFloat(weightInput)],
        observaciones: 'Producido desde Mobile',
        isLastStep: isLast,
        newOrderStatus: isLast ? 'PRODUCIDO' : 'EN_PRODUCCION'
      });

      if (!isLast) {
        setCurrentIndex(prev => prev + 1);
        setWeightInput('');
      } else {
        setCompleted(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]);
        setTimeout(() => {
          navigate('/mobile/produccion', { replace: true });
        }, 2000);
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Error al descontar receta");
    }
  };

  if (completed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#171717', color: 'white', justifyContent: 'center', alignItems: 'center', animation: 'fadeIn 0.3s ease-out' }}>
        <div style={{ width: '140px', height: '140px', borderRadius: '70px', backgroundColor: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <CheckCircle2 size={80} color="#DC2626" />
        </div>
        <h1 style={{ marginTop: '0', fontSize: '36px', fontWeight: 900 }}>¡Terminado!</h1>
        <p style={{ color: '#a3a3a3', fontSize: '18px' }}>El pedido está listo para despacho.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#171717', color: 'white' }}>
      
      {/* Indicador de Progreso Superior */}
      <div style={{ height: '6px', width: '100%', backgroundColor: '#262626' }}>
        <div style={{ 
          height: '100%', 
          backgroundColor: '#DC2626', 
          width: `${((currentIndex) / (pedido.items?.length || 1)) * 100}%`,
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />
      </div>

      <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/mobile/produccion')} style={{ background: 'none', border: 'none', color: '#a3a3a3', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={28} />
          </button>
          <span style={{ color: '#a3a3a3', fontWeight: 700, fontSize: '16px', letterSpacing: '2px' }}>
            {currentIndex + 1} DE {pedido.items?.length}
          </span>
        </div>
      </div>

      {/* Visor de Producto Gigante */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '42px', fontWeight: 900, color: '#f5f5f5', margin: 0, lineHeight: 1.1 }}>
          {currentProduct?.nombre?.toUpperCase() || 'PRODUCTO'}
        </h2>
        <span style={{ fontSize: '20px', color: '#DC2626', fontWeight: 600, marginTop: '16px', backgroundColor: 'rgba(220,38,38,0.1)', padding: '8px 16px', borderRadius: '20px' }}>
          Pedió: {currentItem?.cantidad} {currentItem?.unidad}
        </span>

        <div style={{ marginTop: 'auto', marginBottom: '24px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '72px', fontWeight: 800, color: weightInput ? '#DC2626' : '#404040', transition: 'color 0.2s' }}>
            {weightInput || '0.00'}
          </div>
          <span style={{ fontSize: '32px', color: '#737373', alignSelf: 'flex-end', marginBottom: '16px', fontWeight: 700 }}>Kg</span>
        </div>

        {errorMsg && (
          <div style={{ color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '12px', width: '100%', fontWeight: 600, marginBottom: '16px' }}>
            {errorMsg}
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px 16px 16px' }}>
        <button 
          onClick={handleNext}
          disabled={!weightInput || isProducing}
          className="mobile-no-select"
          style={{
            width: '100%', height: '80px', borderRadius: '40px',
            backgroundColor: weightInput && !isProducing ? '#DC2626' : '#262626',
            color: weightInput && !isProducing ? 'white' : '#525252',
            fontSize: '24px', fontWeight: 800, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: weightInput && !isProducing ? '0 10px 25px rgba(220,38,38,0.4)' : 'none'
          }}
          onPointerDown={(e) => weightInput && !isProducing && (e.currentTarget.style.transform = 'scale(0.97)')}
          onPointerUp={(e) => weightInput && !isProducing && (e.currentTarget.style.transform = 'scale(1)')}
          onPointerCancel={(e) => weightInput && !isProducing && (e.currentTarget.style.transform = 'scale(1)')}
        >
          {isProducing ? <Loader2 size={32} className="animate-spin" /> : 
           (currentIndex < (pedido.items?.length || 0) - 1 ? 'SIGUIENTE' : 'FINALIZAR')}
        </button>
      </div>

      <NumpadGigante value={weightInput} onChange={setWeightInput} onEnter={handleNext} />
    </div>
  );
}
