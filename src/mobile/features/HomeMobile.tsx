import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileTopBar from '../layout/MobileTopBar';
import MobileSearchBar from '../components/MobileSearchBar';
import MobileCard from '../components/MobileCard';
import MobileBadge from '../components/MobileBadge';
import { ShoppingBag, Truck, DollarSign, PlusCircle, Package, Users, Wallet, CreditCard } from 'lucide-react';

// Importamos los stores existentes sin duplicar lógica (Fase 3)
import { useOrdersStore } from '../../store/ordersStore';
import { useSalesStore } from '../../store/salesStore';
import { useCajaStore } from '../../store/cajaStore';
import { useClientesStore } from '../../store/clientesStore';

// Componente memoizado para evitar renders innecesarios en las tarjetas de acción
const ActionCard = React.memo(({ icon: Icon, title, onClick, colorTheme }: { icon: any, title: string, onClick: () => void, colorTheme: { bg: string, fg: string } }) => (
  <MobileCard 
    noPadding 
    style={{ padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
    onClick={onClick}
  >
    <div style={{ backgroundColor: colorTheme.bg, color: colorTheme.fg, padding: '12px', borderRadius: '12px' }}>
      <Icon size={24} />
    </div>
    <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'center' }}>{title}</span>
  </MobileCard>
));

export default function HomeMobile() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Consumimos los stores actuales
  const { pedidos, fetchData: fetchOrders } = useOrdersStore();
  const { sales, fetchData: fetchSales } = useSalesStore();
  const { movements, subscribeMovements } = useCajaStore();
  const { customers: clientes, fetchClientesData: fetchClientes } = useClientesStore();

  // 2. Cargamos los datos al montar la vista
  useEffect(() => {
    fetchOrders();
    fetchSales();
    fetchClientes();
    const unsub = subscribeMovements();
    return () => unsub();
  }, [fetchOrders, fetchSales, fetchClientes, subscribeMovements]);

  // 3. Cálculos de indicadores con useMemo para performance
  const today = new Date().toISOString().split('T')[0];

  const { pedidosPendientes, pedidosProduccion, pedidosProducidos } = useMemo(() => {
    let pPendientes = 0;
    let pProduccion = 0;
    let pProducidos = 0;
    
    // Ignoramos anulados y entregados para los badges urgentes
    pedidos.forEach(p => {
      if (p.isDeleted || p.status === 'ANULADO') return;
      if (p.status === 'PENDIENTE') pPendientes++;
      if (p.status === 'EN_PRODUCCION') pProduccion++;
      if (p.status === 'PRODUCIDO') pProducidos++;
    });

    return { pedidosPendientes: pPendientes, pedidosProduccion: pProduccion, pedidosProducidos: pProducidos };
  }, [pedidos]);

  const ventasDelDia = useMemo(() => {
    return sales
      .filter(s => !s.isDeleted && s.date.startsWith(today) && s.status !== 'ANULADO')
      .reduce((acc, curr) => acc + curr.totalAmount, 0);
  }, [sales, today]);

  const cajaDelDia = useMemo(() => {
    return movements
      .filter(m => !m.isDeleted && m.date.startsWith(today))
      .reduce((acc, curr) => curr.type === 'INCOME' ? acc + curr.amount : acc - curr.amount, 0);
  }, [movements, today]);

  // Navegación
  const handleNav = useCallback((path: string) => {
    navigate(`/mobile/${path}`);
  }, [navigate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: '20px' }}>
      <MobileTopBar 
        title="Inicio" 
        rightElement={
          <div style={{
            width: '36px', height: '36px', borderRadius: '18px',
            backgroundColor: 'var(--mobile-primary-light)', color: 'var(--mobile-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
          }}>
            L
          </div>
        }
      />

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Sección de Búsqueda */}
        <section>
          <h2 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--mobile-text-primary)' }}>
            Hola, Lucas
          </h2>
          <MobileSearchBar 
            value={searchTerm} 
            onChange={setSearchTerm} 
            placeholder="Buscar en el ERP..." 
          />
        </section>

        {/* Acciones Rápidas Funcionales */}
        <section>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px 0', color: 'var(--mobile-text-secondary)' }}>
            Accesos Rápidas
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            <ActionCard icon={ShoppingBag} title="Pedidos" onClick={() => handleNav('pedidos')} colorTheme={{bg: '#fef3c7', fg: '#d97706'}} />
            <ActionCard icon={DollarSign} title="Ventas" onClick={() => handleNav('ventas')} colorTheme={{bg: '#d1fae5', fg: '#059669'}} />
            <ActionCard icon={Package} title="Productos" onClick={() => handleNav('productos')} colorTheme={{bg: '#dbeafe', fg: '#2563eb'}} />
            <ActionCard icon={CreditCard} title="Compras" onClick={() => handleNav('compras')} colorTheme={{bg: '#f3e8ff', fg: '#7e22ce'}} />
          </div>
        </section>

        {/* Resumen Operativo */}
        <section>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px 0', color: 'var(--mobile-text-secondary)' }}>
            Estado Operativo
          </h3>
          <MobileCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--mobile-border)', paddingBottom: '12px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: '#fef3c7', color: '#d97706', padding: '10px', borderRadius: '10px' }}>
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--mobile-text-secondary)' }}>Pendientes / Prod.</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>{pedidosPendientes} / {pedidosProduccion}</div>
                </div>
              </div>
              {pedidosPendientes > 0 && <MobileBadge variant="warning">Atención</MobileBadge>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ backgroundColor: '#dbeafe', color: '#2563eb', padding: '10px', borderRadius: '10px' }}>
                <Truck size={20} />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--mobile-text-secondary)' }}>Producidos (Listos)</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{pedidosProducidos}</div>
              </div>
            </div>
          </MobileCard>
        </section>

        {/* Resumen Financiero */}
        <section>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px 0', color: 'var(--mobile-text-secondary)' }}>
            Finanzas Hoy
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <MobileCard style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--mobile-text-secondary)', fontSize: '13px' }}>
                <DollarSign size={16} /> Ventas
              </div>
              <strong style={{ fontSize: '20px', color: 'var(--mobile-text-primary)' }}>${ventasDelDia.toLocaleString('es-AR')}</strong>
            </MobileCard>

            <MobileCard style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--mobile-text-secondary)', fontSize: '13px' }}>
                <Wallet size={16} /> Flujo Caja
              </div>
              <strong style={{ fontSize: '20px', color: cajaDelDia >= 0 ? '#10b981' : '#ef4444' }}>
                ${cajaDelDia.toLocaleString('es-AR')}
              </strong>
            </MobileCard>
          </div>
        </section>

        {/* Total Clientes */}
        <section style={{ opacity: 0.8 }}>
          <MobileCard style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Users size={20} color="var(--mobile-text-secondary)" />
              <span style={{ fontSize: '14px', fontWeight: 500 }}>Clientes en el sistema</span>
            </div>
            <strong style={{ fontSize: '16px' }}>{clientes.length}</strong>
          </MobileCard>
        </section>

      </div>
    </div>
  );
}
