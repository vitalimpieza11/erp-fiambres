import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { 
  Dashboard, Compras, Produccion, Stock, Ventas, 
  Clientes, Precios, Competencia, 
  CajaBancos, CuentaCorriente, Proveedores, 
  Rentabilidad, TopProductos, Configuracion,
  Productos, Reportes, Login
} from './pages';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { initializeCollections } from './firebase/dbInitializer';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Login />;
  return <>{children}</>;
};

function App() {
  React.useEffect(() => {
    initializeCollections();
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <ProtectedRoute>
          <Routes>
            <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="productos" element={<Productos />} />
          <Route path="compras" element={<Compras />} />
          <Route path="produccion" element={<Produccion />} />
          <Route path="stock" element={<Stock />} />
          <Route path="ventas" element={<Ventas />} />
          
          <Route path="clientes" element={<Clientes />} />
          <Route path="precios" element={<Precios />} />
          <Route path="competencia" element={<Competencia />} />
          
          <Route path="caja-bancos" element={<CajaBancos />} />
          <Route path="cuenta-corriente" element={<CuentaCorriente />} />
          <Route path="proveedores" element={<Proveedores />} />
          
          <Route path="reportes" element={<Reportes />} />
          <Route path="rentabilidad" element={<Rentabilidad />} />
          <Route path="top-productos" element={<TopProductos />} />
          
          <Route path="configuracion" element={<Configuracion />} />
        </Route>
      </Routes>
        </ProtectedRoute>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
