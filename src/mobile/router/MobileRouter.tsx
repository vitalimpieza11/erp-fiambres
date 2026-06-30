import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MobileLayout from '../layout/MobileLayout';
import MobileSkeleton from '../components/MobileSkeleton';

// Lazy Imports para Performance Code Splitting
const HomeMobile = React.lazy(() => import('../features/HomeMobile'));
const PedidosMobile = React.lazy(() => import('../features/pedidos/PedidosMobile'));
const PedidoDetalleMobile = React.lazy(() => import('../features/pedidos/PedidoDetalleMobile'));
const VentasMobile = React.lazy(() => import('../features/ventas/VentasMobile'));
const ModoProduccion = React.lazy(() => import('../features/produccion/ModoProduccion'));
const ProduccionFlow = React.lazy(() => import('../features/produccion/ProduccionFlow'));
const ModoDeposito = React.lazy(() => import('../features/deposito/ModoDeposito'));
const ProductosBuscador = React.lazy(() => import('../features/deposito/ProductosBuscador'));
const CentroStock = React.lazy(() => import('../features/deposito/CentroStock'));
const IngresoCompras = React.lazy(() => import('../features/deposito/IngresoCompras'));
const ModoReparto = React.lazy(() => import('../features/reparto/ModoReparto'));
const HojaRutaFlow = React.lazy(() => import('../features/reparto/HojaRutaFlow'));
const ClientesMobile = React.lazy(() => import('../features/clientes/ClientesMobile'));
const ModoCaja = React.lazy(() => import('../features/caja/ModoCaja'));
const ModoGerente = React.lazy(() => import('../features/gerente/ModoGerente'));
const ConfiguracionMobile = React.lazy(() => import('../features/configuracion/ConfiguracionMobile'));

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <MobileSkeleton height="200px" borderRadius="24px" />
      <MobileSkeleton height="80px" borderRadius="16px" />
      <MobileSkeleton height="80px" borderRadius="16px" />
      <MobileSkeleton height="80px" borderRadius="16px" />
    </div>
  }>
    {children}
  </Suspense>
);

export default function MobileRouter() {
  return (
    <Routes>
      <Route path="/" element={<MobileLayout />}>
        <Route index element={<SuspenseWrapper><HomeMobile /></SuspenseWrapper>} />
        <Route path="produccion" element={<SuspenseWrapper><ModoProduccion /></SuspenseWrapper>} />
        <Route path="produccion/flow/:id" element={<SuspenseWrapper><ProduccionFlow /></SuspenseWrapper>} />
        
        {/* Módulo de Pedidos */}
        <Route path="pedidos" element={<SuspenseWrapper><PedidosMobile /></SuspenseWrapper>} />
        <Route path="pedidos/:id" element={<SuspenseWrapper><PedidoDetalleMobile /></SuspenseWrapper>} />
        <Route path="pedidos/nuevo" element={<div style={{padding: '20px', textAlign: 'center'}}>Nuevo Pedido (Próximamente)</div>} />
        
        <Route path="ventas" element={<SuspenseWrapper><VentasMobile /></SuspenseWrapper>} />
        {/* Módulo Depósito */}
        <Route path="deposito" element={<SuspenseWrapper><ModoDeposito /></SuspenseWrapper>} />
        <Route path="deposito/productos" element={<SuspenseWrapper><ProductosBuscador /></SuspenseWrapper>} />
        <Route path="deposito/stock" element={<SuspenseWrapper><CentroStock /></SuspenseWrapper>} />
        <Route path="deposito/compras" element={<SuspenseWrapper><IngresoCompras /></SuspenseWrapper>} />
        
        {/* Nuevos Módulos Fase 5 */}
        <Route path="reparto" element={<SuspenseWrapper><ModoReparto /></SuspenseWrapper>} />
        <Route path="reparto/flow" element={<SuspenseWrapper><HojaRutaFlow /></SuspenseWrapper>} />
        
        <Route path="clientes" element={<SuspenseWrapper><ClientesMobile /></SuspenseWrapper>} />
        <Route path="caja" element={<SuspenseWrapper><ModoCaja /></SuspenseWrapper>} />
        <Route path="gerente" element={<SuspenseWrapper><ModoGerente /></SuspenseWrapper>} />
        <Route path="configuracion" element={<SuspenseWrapper><ConfiguracionMobile /></SuspenseWrapper>} />
        
        <Route path="productos" element={<Navigate to="/mobile/deposito/productos" replace />} />
        <Route path="mas" element={<div style={{padding: '20px', textAlign: 'center'}}>Opciones Adicionales</div>} />
        
        <Route path="*" element={<Navigate to="/mobile/" replace />} />
      </Route>
    </Routes>
  );
}
