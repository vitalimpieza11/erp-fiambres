import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import {
  Dashboard,
  Compras,
  Produccion,
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
  Reportes
} from './pages';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase/firebase';
import { AlertTriangle } from 'lucide-react';

const ProtectedRoute = ({
  children
}: {
  children: React.ReactNode;
}) => {
  const { currentUser } = useAuth();
  const [diagnosticError, setDiagnosticError] = useState<any>(null);

  useEffect(() => {
    const runDiagnostics = async () => {
      console.log('Starting Firebase Firestore Diagnostic Test...');

      try {
        // 1. Read settings
        const settingsRef = doc(db, 'settings', 'global');
        await getDoc(settingsRef);

        // 2. Create test document
        const testRef = doc(
          db,
          'test_connection',
          'temp_test_doc'
        );

        await setDoc(testRef, {
          test: true,
          timestamp: Date.now()
        });

        // 3. Read test document
        await getDoc(testRef);

        // 4. Delete test document
        await deleteDoc(testRef);

        console.log(
          '--- DIAGNOSTICS PASSED SUCCESSFULLY ---'
        );

        setDiagnosticError(null);
      } catch (error: any) {
        console.error(
          '--- DIAGNOSTICS FAILED ---',
          error
        );

        setDiagnosticError(error);
      }
    };

    runDiagnostics();
  }, []);

  // AUTH TEMPORALMENTE DESACTIVADA
  if (!currentUser) {
    console.warn(
      'AUTH TEMPORARILY DISABLED FOR DEBUG'
    );
  }

  return (
    <>
      {diagnosticError && (
        <div
          style={{
            backgroundColor: '#FEE2E2',
            border: '2px solid #EF4444',
            borderRadius: '8px',
            padding: '20px',
            margin: '20px',
            color: '#991B1B',
            fontFamily: 'monospace',
            fontSize: '0.9rem'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '12px'
            }}
          >
            <AlertTriangle
              color="#EF4444"
              size={24}
            />

            <strong>
              ERROR DE CONEXIÓN FIREBASE
            </strong>
          </div>

          <p>
            {diagnosticError.message ||
              'Error desconocido'}
          </p>

          <p>
            <strong>Código:</strong>{' '}
            {diagnosticError.code}
          </p>

          <pre
            style={{
              backgroundColor: '#F3F4F6',
              padding: '12px',
              borderRadius: '6px',
              overflowX: 'auto'
            }}
          >
            {diagnosticError.stack ||
              JSON.stringify(
                diagnosticError,
                null,
                2
              )}
          </pre>
        </div>
      )}

      {children}
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ProtectedRoute>
          <Routes>
            <Route
              path="/"
              element={<Layout />}
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
                path="compras"
                element={<Compras />}
              />

              <Route
                path="produccion"
                element={<Produccion />}
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
        </ProtectedRoute>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;