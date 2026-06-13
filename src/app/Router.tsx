import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Suspense, lazy } from 'react';

const Dashboard = lazy(() => import('../features/dashboard/Dashboard'));
const Clientes = lazy(() => import('../features/clientes/Clientes'));
const Proveedores = lazy(() => import('../features/proveedores/Proveedores'));
const Pedidos = lazy(() => import('../features/pedidos/Pedidos'));
const Produccion = lazy(() => import('../features/produccion/Produccion'));
const Ventas = lazy(() => import('../features/ventas/Ventas'));
const Stock = lazy(() => import('../features/stock/Stock'));
const Caja = lazy(() => import('../features/caja/Caja'));
const Socios = lazy(() => import('../features/socios/Socios'));
const Configuracion = lazy(() => import('../features/configuracion/Configuracion'));
const Compras = lazy(() => import('../features/compras/Compras'));

export default function Router() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#86868b' }}>Cargando módulo...</div>}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="proveedores" element={<Proveedores />} />
            <Route path="compras" element={<Compras />} />
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="produccion" element={<Produccion />} />
            <Route path="ventas" element={<Ventas />} />
            <Route path="stock" element={<Stock />} />
            <Route path="caja" element={<Caja />} />
            <Route path="socios" element={<Socios />} />
            <Route path="configuracion" element={<Configuracion />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
