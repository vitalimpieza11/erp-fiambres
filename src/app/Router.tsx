import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Suspense, lazy } from 'react';
import { useAuthStore } from '../store/authStore';
import LoadingSpinner from '../components/LoadingSpinner';

const Dashboard = lazy(() => import('../features/dashboard/Dashboard'));
const Clientes = lazy(() => import('../features/clientes/Clientes'));
const Proveedores = lazy(() => import('../features/proveedores/Proveedores'));
const Pedidos = lazy(() => import('../features/pedidos/Pedidos'));
const Produccion = lazy(() => import('../features/produccion/Produccion'));
const Ventas = lazy(() => import('../features/ventas/Ventas'));
const Facturacion = lazy(() => import('../features/facturacion/Facturacion'));
const Stock = lazy(() => import('../features/stock/Stock'));
const Caja = lazy(() => import('../features/caja/Caja'));
const Socios = lazy(() => import('../features/socios/Socios'));
const Configuracion = lazy(() => import('../features/configuracion/Configuracion'));
const Compras = lazy(() => import('../features/compras/Compras'));
const Login = lazy(() => import('../features/auth/Login'));

// Guard for authenticated users
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return <LoadingSpinner message="Verificando sesión..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Guard for guest users (login page)
function GuestGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return <LoadingSpinner message="Verificando sesión..." />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function Router() {
  const { loading } = useAuthStore();

  if (loading) {
    return <LoadingSpinner message="Inicializando ERP..." />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner message="Cargando módulo..." />}>
        <Routes>
          <Route path="/login" element={<GuestGuard><Login /></GuestGuard>} />
          
          <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="proveedores" element={<Proveedores />} />
            <Route path="compras" element={<Compras />} />
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="produccion" element={<Produccion />} />
            <Route path="ventas" element={<Ventas />} />
            <Route path="facturacion" element={<Facturacion />} />
            <Route path="stock" element={<Stock />} />
            <Route path="caja" element={<Caja />} />
            <Route path="socios" element={<Socios />} />
            <Route path="configuracion" element={<Configuracion />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
