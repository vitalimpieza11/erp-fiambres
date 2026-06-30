import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map, Phone, MessageCircle, Check, X, CreditCard, Banknote, QrCode } from 'lucide-react';
import MobileTopBar from '../../layout/MobileTopBar';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import MobileButton from '../../components/MobileButton';
import { useSalesStore } from '../../../store/salesStore';
import { useClientesStore } from '../../../store/clientesStore';
import { useCajaStore } from '../../../store/cajaStore';

export default function HojaRutaFlow() {
  const navigate = useNavigate();
  const { sales, updateSale, fetchData: fetchVentasData } = useSalesStore();
  const { customers, fetchClientesData } = useClientesStore();
  const { addMovement } = useCajaStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCobroSheetOpen, setIsCobroSheetOpen] = useState(false);
  const [metodoPago, setMetodoPago] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'QR' | null>(null);

  useEffect(() => {
    fetchVentasData();
    fetchClientesData();
  }, [fetchVentasData, fetchClientesData]);

  const pendientes = useMemo(() => {
    return sales.filter(s => !s.isDeleted && s.deliveryStatus !== 'ENTREGADO');
  }, [sales]);

  const currentSale = pendientes[currentIndex];
  const currentClient = currentSale ? customers.find((c: any) => c.id === currentSale.customerId) : null;

  if (pendientes.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#10b981', color: 'white' }}>
        <Check size={80} />
        <h1 style={{ marginTop: '24px' }}>¡Recorrido Terminado!</h1>
        <MobileButton variant="outline" style={{ marginTop: '24px', borderColor: 'white', color: 'white' }} onClick={() => navigate('/mobile/reparto')}>
          Volver a Base
        </MobileButton>
      </div>
    );
  }

  const handleOpenMap = () => {
    if (currentClient?.direccion) {
      window.open(`https://maps.google.com/?q=${encodeURIComponent(currentClient.direccion)}`, '_blank');
    }
  };

  const handleWhatsApp = () => {
    if (currentClient?.telefono) {
      window.open(`https://wa.me/${currentClient.telefono.replace(/[^0-9]/g, '')}`, '_blank');
    }
  };

  const handleLlamar = () => {
    if (currentClient?.telefono) {
      window.open(`tel:${currentClient.telefono.replace(/[^0-9]/g, '')}`);
    }
  };

  const handleEntregadoClick = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    setIsCobroSheetOpen(true);
  };

  const handleFinalizarEntrega = async () => {
    if (!currentSale) return;
    
    // Simulate register payment
    if (metodoPago !== null) {
      await addMovement({
        type: 'INCOME',
        amount: currentSale.totalAmount,
        category: 'VENTAS',
        description: 'Cobro de reparto'
      });
    }

    // Cambiar estado a ENTREGADO/COBRADO
    await updateSale(currentSale.id, { 
      status: metodoPago ? 'COBRADO' : 'PENDIENTE',
      deliveryStatus: 'ENTREGADO' 
    });
    
    setIsCobroSheetOpen(false);
    setMetodoPago(null);
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([100, 50, 100]); // Success
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#ffffff' }}>
      {/* Indicador de Progreso Superior */}
      <div style={{ height: '6px', width: '100%', backgroundColor: '#f3f4f6' }}>
        <div style={{ 
          height: '100%', 
          backgroundColor: '#3b82f6', 
          width: `${((currentIndex) / pendientes.length) * 100}%`,
          transition: 'width 0.3s ease'
        }} />
      </div>

      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--mobile-text-secondary)', fontWeight: 600 }}>
          PARADA {currentIndex + 1} DE {pendientes.length}
        </span>
        <button onClick={() => navigate('/mobile/reparto')} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 600, fontSize: '16px' }}>
          Abortar
        </button>
      </div>

      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 800, margin: '0 0 12px 0', lineHeight: 1.1, color: 'var(--mobile-text-primary)' }}>
            {currentClient?.nombre || 'Cliente Desconocido'}
          </h2>
          <p style={{ fontSize: '18px', color: 'var(--mobile-text-secondary)', margin: 0 }}>
            {currentClient?.direccion || 'Sin dirección registrada'}
          </p>
        </div>

        {/* Action Grid Gigante */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
          <button onClick={handleOpenMap} style={{ backgroundColor: '#eff6ff', border: 'none', borderRadius: '24px', padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <Map size={32} color="#3b82f6" />
            <span style={{ color: '#1e3a8a', fontWeight: 700, fontSize: '14px' }}>MAPS</span>
          </button>
          <button onClick={handleWhatsApp} style={{ backgroundColor: '#f0fdf4', border: 'none', borderRadius: '24px', padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <MessageCircle size={32} color="#22c55e" />
            <span style={{ color: '#14532d', fontWeight: 700, fontSize: '14px' }}>WHATSAPP</span>
          </button>
          <button onClick={handleLlamar} style={{ backgroundColor: '#fef2f2', border: 'none', borderRadius: '24px', padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <Phone size={32} color="#ef4444" />
            <span style={{ color: '#7f1d1d', fontWeight: 700, fontSize: '14px' }}>LLAMAR</span>
          </button>
        </div>

        <div style={{ backgroundColor: '#f9fafb', borderRadius: '24px', padding: '24px', marginTop: 'auto' }}>
          <span style={{ color: 'var(--mobile-text-secondary)', textTransform: 'uppercase', fontSize: '13px', fontWeight: 600 }}>Total a cobrar</span>
          <div style={{ fontSize: '48px', fontWeight: 800, color: 'var(--mobile-text-primary)', marginTop: '8px' }}>
            ${currentSale?.totalAmount.toLocaleString('es-AR')}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px' }}>
        <MobileButton 
          size="lg" 
          fullWidth 
          onClick={handleEntregadoClick}
          style={{ height: '70px', fontSize: '24px', borderRadius: '24px', backgroundColor: '#10b981' }}
        >
          <Check size={28} style={{ marginRight: '12px' }} /> MARCAR ENTREGADO
        </MobileButton>
      </div>

      {/* BottomSheet de Cobro */}
      <MobileBottomSheet isOpen={isCobroSheetOpen} onClose={() => setIsCobroSheetOpen(false)} height="60vh">
        <h3 style={{ fontSize: '24px', fontWeight: 800, textAlign: 'center', marginBottom: '24px' }}>
          ¿Cómo paga ${currentSale?.totalAmount}?
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <MobileButton variant={metodoPago === 'EFECTIVO' ? 'primary' : 'outline'} size="lg" onClick={() => setMetodoPago('EFECTIVO')}>
            <Banknote size={24} style={{ marginRight: '12px' }} /> Efectivo
          </MobileButton>
          <MobileButton variant={metodoPago === 'TRANSFERENCIA' ? 'primary' : 'outline'} size="lg" onClick={() => setMetodoPago('TRANSFERENCIA')}>
            <CreditCard size={24} style={{ marginRight: '12px' }} /> Transferencia
          </MobileButton>
          <MobileButton variant={metodoPago === 'QR' ? 'primary' : 'outline'} size="lg" onClick={() => setMetodoPago('QR')}>
            <QrCode size={24} style={{ marginRight: '12px' }} /> Código QR
          </MobileButton>
        </div>

        <div style={{ marginTop: '32px' }}>
          <MobileButton size="lg" fullWidth disabled={!metodoPago} onClick={handleFinalizarEntrega} style={{ backgroundColor: '#10b981' }}>
            Confirmar y Cobrar
          </MobileButton>
        </div>
      </MobileBottomSheet>

    </div>
  );
}
