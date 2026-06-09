import React from 'react';
import { 
  LayoutDashboard, ShoppingCart, Factory, Package, Store, Users, Tags, LineChart, 
  Landmark, Wallet, Truck, TrendingUp, Award, Settings, 
  ArrowUpRight, ArrowDownRight, DollarSign, Activity
} from 'lucide-react';
import { EmptyState, PageHeader } from '../components/EmptyState';
import { Card, CardHeader } from '../components/ui/Card';
import { Table } from '../components/ui/Table';

export { Productos } from './Productos';
export { Stock } from './Stock';
export { Compras } from './Compras';
export { Pedidos } from './Pedidos';
export { Ventas } from './Ventas';
export { Clientes } from './Clientes';
export { Precios } from './Precios';
export { Competencia } from './Competencia';
export { Rentabilidad } from './Rentabilidad';
export { Reportes } from './Reportes';
export { Dashboard } from './Dashboard';
export { DashboardFinanciero } from './DashboardFinanciero';
export { BaseFinanciera } from './BaseFinanciera';
export { MigracionFinanciera } from './MigracionFinanciera';
export { Login } from './Login';

// --- Stock moved to Stock.tsx ---

// --- Ventas moved to Ventas.tsx ---

// --- Compras moved to Compras.tsx ---

export { Produccion } from './Produccion';

// --- Clientes moved to Clientes.tsx ---

// --- Precios moved to Precios.tsx ---

export { CajaBancos } from './CajaBancos';
export { Proveedores } from './Proveedores';

export { CuentaCorriente } from './CuentaCorriente';

// --- Rentabilidad moved to Rentabilidad.tsx ---

export const TopProductos = () => (
  <>
    <PageHeader title="Productos más vendidos" description="Ranking de ventas" />
    <EmptyState icon={Award} title="Top Productos" description="Descubre qué productos rotan más." />
  </>
);

export { Configuracion } from './Configuracion';
