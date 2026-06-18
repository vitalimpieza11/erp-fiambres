import { useState } from 'react';
import ClientesConfig from './ClientesConfig';
import ProveedoresConfig from './ProveedoresConfig';
import SociosConfig from './SociosConfig';
import ProductosConfig from './ProductosConfig';
import ListasPreciosConfig from './ListasPreciosConfig';
import EquivalenciasConfig from './EquivalenciasConfig';
import SistemaConfig from './SistemaConfig';
import EmpresaConfig from './EmpresaConfig';
import CuentasFinancierasConfig from './CuentasFinancierasConfig';
import { Settings } from 'lucide-react';

type Tab = 'clientes' | 'proveedores' | 'socios' | 'productos' | 'listas' | 'equivalencias' | 'sistema' | 'cuentas' | 'empresa';

export default function Configuracion() {
  const [activeTab, setActiveTab] = useState<Tab>('clientes');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'clientes', label: 'Clientes' },
    { id: 'proveedores', label: 'Proveedores' },
    { id: 'socios', label: 'Socios' },
    { id: 'productos', label: 'Productos' },
    { id: 'listas', label: 'Listas de Precios' },
    { id: 'equivalencias', label: 'Equivalencias' },
    { id: 'cuentas', label: 'Cuentas Financieras' },
    { id: 'sistema', label: 'Sistema' },
    { id: 'empresa', label: 'Empresa' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--alvacio-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Settings size={24} color="#fff" />
        </div>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Configuración Maestra</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>Administración centralizada de entidades del sistema</p>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none', border: 'none', padding: '8px 16px', borderRadius: '24px', 
              fontWeight: 600, fontSize: '15px', cursor: 'pointer', transition: 'all 0.2s',
              backgroundColor: activeTab === tab.id ? 'var(--alvacio-red)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'clientes' && <ClientesConfig />}
        {activeTab === 'proveedores' && <ProveedoresConfig />}
        {activeTab === 'socios' && <SociosConfig />}
        {activeTab === 'productos' && <ProductosConfig />}
        {activeTab === 'listas' && <ListasPreciosConfig />}
        {activeTab === 'equivalencias' && <EquivalenciasConfig />}
        {activeTab === 'cuentas' && <CuentasFinancierasConfig />}
        {activeTab === 'sistema' && <SistemaConfig />}
        {activeTab === 'empresa' && <EmpresaConfig />}
      </div>
    </div>
  );
}
