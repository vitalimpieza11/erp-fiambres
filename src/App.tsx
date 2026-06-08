import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import {
  Dashboard,
  Compras,
  Pedidos,
  Stock,
  Ventas,
  Clientes,
  Precios,
  Competencia,
  CajaBancos,
  CuentaCorriente,
  Proveedores,
  Rentabilidad,
  TopProductos,
  Configuracion,
  Productos,
  Reportes,
  Produccion,
  Login,
  DashboardFinanciero
} from './pages';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DateFilterProvider } from './contexts/DateFilterContext';

const ProtectedRoute = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <DateFilterProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route
                index
                element={<Dashboard />}
              />

              <Route
                path="productos"
                element={<Productos />}
              />

              <Route
                path="produccion"
                element={<Produccion />}
              />

              <Route
                path="compras"
                element={<Compras />}
              />

              <Route
                path="pedidos"
                element={<Pedidos />}
              />

              <Route
                path="stock"
                element={<Stock />}
              />

              <Route
                path="ventas"
                element={<Ventas />}
              />

              <Route
                path="clientes"
                element={<Clientes />}
              />

              <Route
                path="precios"
                element={<Precios />}
              />

              <Route
                path="competencia"
                element={<Competencia />}
              />

              <Route
                path="caja-bancos"
                element={<CajaBancos />}
              />

              <Route
                path="dashboard-financiero"
                element={<DashboardFinanciero />}
              />

              <Route
                path="cuenta-corriente"
                element={<CuentaCorriente />}
              />

              <Route
                path="proveedores"
                element={<Proveedores />}
              />

              <Route
                path="reportes"
                element={<Reportes />}
              />

              <Route
                path="rentabilidad"
                element={<Rentabilidad />}
              />

              <Route
                path="top-productos"
                element={<TopProductos />}
              />

              <Route
                path="configuracion"
                element={<Configuracion />}
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </DateFilterProvider>
    </AuthProvider>
  );
}

export default App;