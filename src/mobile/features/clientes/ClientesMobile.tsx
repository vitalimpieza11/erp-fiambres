import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Phone, MessageCircle, MapPin, Plus, FileText, ArrowLeft } from 'lucide-react';
import MobileTopBar from '../../layout/MobileTopBar';
import MobileSearchBar from '../../components/MobileSearchBar';
import MobileListItem from '../../components/MobileListItem';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import MobileButton from '../../components/MobileButton';
import { useClientesStore } from '../../../store/clientesStore';

export default function ClientesMobile() {
  const navigate = useNavigate();
  const { customers, fetchClientesData } = useClientesStore();
  const [query, setQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<any>(null);

  useEffect(() => {
    fetchClientesData();
  }, [fetchClientesData]);

  const filtrados = useMemo(() => {
    return customers
      .filter(c => c.activo && c.nombre.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 20); // Top 20 para virtualización de pobres
  }, [customers, query]);

  const handleAction = (action: string) => {
    if (!selectedClient) return;
    if (action === 'wpp' && selectedClient.telefono) window.open(`https://wa.me/${selectedClient.telefono.replace(/[^0-9]/g, '')}`);
    if (action === 'tel' && selectedClient.telefono) window.open(`tel:${selectedClient.telefono.replace(/[^0-9]/g, '')}`);
    if (action === 'map' && selectedClient.direccion) window.open(`https://maps.google.com/?q=${encodeURIComponent(selectedClient.direccion)}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--mobile-bg)' }}>
      <MobileTopBar 
        title="CRM Clientes" 
        leftElement={<div onClick={() => navigate('/mobile')} style={{ padding: '8px' }}><ArrowLeft size={24} color="var(--mobile-text-secondary)" /></div>}
        rightElement={<Plus size={24} color="var(--mobile-primary)" />}
      />

      <div style={{ padding: '16px', backgroundColor: 'var(--mobile-surface)', borderBottom: '1px solid var(--mobile-border)' }}>
        <MobileSearchBar value={query} onChange={setQuery} placeholder="Buscar por nombre, CUIT..." />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtrados.map(c => (
          <MobileListItem 
            key={c.id} 
            title={c.nombre} 
            subtitle={c.direccion || 'Sin dirección'}
            rightElement={
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mobile-primary)' }}>Ver Ficha</div>
            }
            onClick={() => setSelectedClient(c)}
          />
        ))}
      </div>

      {/* Ficha CRM Inteligente (BottomSheet) */}
      <MobileBottomSheet isOpen={!!selectedClient} onClose={() => setSelectedClient(null)} height="75vh">
        {selectedClient && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '40px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
                <Users size={40} color="#3b82f6" />
              </div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '0 0 8px 0', lineHeight: 1.1 }}>{selectedClient.nombre}</h2>
              <span style={{ fontSize: '15px', color: 'var(--mobile-text-secondary)' }}>{selectedClient.cuit || 'Sin CUIT'}</span>
            </div>

            <div style={{ backgroundColor: '#fff1f2', borderRadius: '20px', padding: '20px', textAlign: 'center' }}>
              <span style={{ color: '#be123c', fontSize: '13px', textTransform: 'uppercase', fontWeight: 600 }}>Deuda Actual</span>
              <div style={{ fontSize: '36px', fontWeight: 800, color: '#e11d48' }}>
                $0.00 {/* Mock por ahora hasta enlazar el CustomerMovement real */}
              </div>
            </div>

            {/* Acciones Rápidas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <button onClick={() => handleAction('wpp')} style={{ padding: '16px', borderRadius: '16px', border: 'none', backgroundColor: '#f0fdf4', color: '#15803d', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={24} /> <span style={{ fontWeight: 600, fontSize: '12px' }}>WPP</span>
              </button>
              <button onClick={() => handleAction('tel')} style={{ padding: '16px', borderRadius: '16px', border: 'none', backgroundColor: '#eff6ff', color: '#1d4ed8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Phone size={24} /> <span style={{ fontWeight: 600, fontSize: '12px' }}>Llamar</span>
              </button>
              <button onClick={() => handleAction('map')} style={{ padding: '16px', borderRadius: '16px', border: 'none', backgroundColor: '#f3f4f6', color: '#4b5563', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <MapPin size={24} /> <span style={{ fontWeight: 600, fontSize: '12px' }}>Mapa</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <MobileButton fullWidth onClick={() => { setSelectedClient(null); navigate('/mobile/ventas'); }}>+ Nueva Venta</MobileButton>
              <MobileButton fullWidth variant="outline" onClick={() => { setSelectedClient(null); navigate('/mobile/pedidos'); }}>+ Pedido</MobileButton>
            </div>
            
            <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
               <FileText size={24} color="#9ca3af" />
               <span style={{ fontWeight: 600, color: '#4b5563' }}>Ver Historial de Movimientos</span>
            </div>
          </div>
        )}
      </MobileBottomSheet>
    </div>
  );
}
