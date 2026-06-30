import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileTopBar from '../../layout/MobileTopBar';
import MobileButton from '../../components/MobileButton';
import MobileListItem from '../../components/MobileListItem';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import MobileCard from '../../components/MobileCard';
import MobileSearchBar from '../../components/MobileSearchBar';
import { useSalesStore } from '../../../store/salesStore';
import { useClientesStore } from '../../../store/clientesStore';
import { useProductsStore } from '../../../store/productsStore';
import { User, Package, Trash2, Plus, CreditCard, Banknote } from 'lucide-react';

export default function VentasMobile() {
  const navigate = useNavigate();
  
  // Data stores
  const { createQuickSale } = useSalesStore();
  const { customers: clientes, fetchClientesData } = useClientesStore();
  const { productos, fetchProductos } = useProductsStore();

  // State
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [cart, setCart] = useState<any[]>([]);
  
  // UI State
  const [isClientSheetOpen, setIsClientSheetOpen] = useState(false);
  const [isProductSheetOpen, setIsProductSheetOpen] = useState(false);
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchClientesData();
    fetchProductos();
  }, [fetchClientesData, fetchProductos]);

  const total = cart.reduce((acc, item) => acc + (item.subtotal), 0);

  // --- Handlers ---
  const handleAddProduct = (prod: any) => {
    const existing = cart.find(c => c.productId === prod.id);
    if (existing) {
      setCart(cart.map(c => c.productId === prod.id ? { ...c, cantidad: c.cantidad + 1, subtotal: (c.cantidad + 1) * (prod.precioComercial || 0) } : c));
    } else {
      setCart([...cart, { 
        productId: prod.id, 
        nombre: prod.nombre, 
        cantidad: 1, 
        unidad: prod.type === 'PRESENTACION' ? 'UNIDADES' : prod.unitType,
        precioUnitario: prod.precioComercial || 0,
        subtotal: prod.precioComercial || 0 
      }]);
    }
    // No cerramos el bottomsheet para permitir carga múltiple rapidísima
  };

  const handleCharge = async (method: 'CONTADO' | 'CUENTA_CORRIENTE') => {
    if (!selectedClient) return alert("Seleccione un cliente");
    if (cart.length === 0) return alert("Agregue productos");

    try {
      await createQuickSale({
        customerId: selectedClient.id,
        date: new Date().toISOString().split('T')[0],
        items: cart,
        totalAmount: total,
      });
      // Venta exitosa -> Compartir -> Limpiar
      setIsPaymentSheetOpen(false);
      setCart([]);
      setSelectedClient(null);
      // Aquí idealmente mostraríamos un Toast de Éxito o BottomSheet para compartir ticket
      alert("Venta procesada con éxito");
    } catch (e) {
      alert("Error al cobrar");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#ffffff', paddingBottom: '140px' }}>
      <MobileTopBar title="Nueva Venta" />

      <div style={{ padding: '16px', flex: 1 }}>
        {/* 1. Cliente */}
        <h3 style={{ fontSize: '14px', color: 'var(--mobile-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>1. Cliente</h3>
        {selectedClient ? (
          <MobileListItem 
            title={selectedClient.nombre} 
            subtitle={selectedClient.cuit} 
            leftIcon={<div style={{ backgroundColor: '#dbeafe', padding: '10px', borderRadius: '50%' }}><User color="#2563eb" size={20} /></div>}
            rightElement={<span style={{ color: 'var(--mobile-primary)', fontSize: '14px', fontWeight: 600 }}>Cambiar</span>}
            onClick={() => {setSearch(''); setIsClientSheetOpen(true);}}
          />
        ) : (
          <MobileButton variant="outline" fullWidth onClick={() => {setSearch(''); setIsClientSheetOpen(true);}} style={{ height: '60px', borderStyle: 'dashed' }}>
            <Plus size={20} style={{ marginRight: '8px' }} /> Seleccionar Cliente
          </MobileButton>
        )}

        {/* 2. Productos */}
        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--mobile-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>2. Productos</h3>
          <span onClick={() => {setSearch(''); setIsProductSheetOpen(true);}} style={{ color: 'var(--mobile-primary)', fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Plus size={18} /> Agregar
          </span>
        </div>

        <div style={{ marginTop: '8px' }}>
          {cart.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#9ca3af', backgroundColor: '#f9fafb', borderRadius: '16px' }}>
              Sin productos
            </div>
          ) : (
            cart.map((item, i) => (
              <MobileListItem 
                key={i}
                title={item.nombre}
                subtitle={`${item.cantidad} ${item.unidad} x $${item.precioUnitario}`}
                rightElement={<strong style={{ fontSize: '18px' }}>${item.subtotal}</strong>}
              />
            ))
          )}
        </div>
      </div>

      {/* Zona Fija de Cobro Gigante */}
      <div style={{
        position: 'fixed',
        bottom: '70px', /* Por encima del BottomNav */
        left: 0, right: 0,
        backgroundColor: 'var(--mobile-surface)',
        padding: '16px',
        borderTop: '1px solid var(--mobile-border)',
        boxShadow: '0 -10px 20px rgba(0,0,0,0.05)',
        zIndex: 40
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ fontSize: '16px', color: 'var(--mobile-text-secondary)', fontWeight: 500 }}>Total a cobrar</span>
          <strong style={{ fontSize: '32px', color: 'var(--mobile-text-primary)', lineHeight: 1 }}>
            ${total.toLocaleString('es-AR')}
          </strong>
        </div>
        <MobileButton 
          fullWidth 
          size="lg" 
          disabled={!selectedClient || cart.length === 0}
          onClick={() => setIsPaymentSheetOpen(true)}
          style={{ fontSize: '20px', height: '60px' }}
        >
          Cobrar Venta
        </MobileButton>
      </div>

      {/* --- BOTTOM SHEETS --- */}
      
      {/* Selector de Cliente */}
      <MobileBottomSheet isOpen={isClientSheetOpen} onClose={() => setIsClientSheetOpen(false)} title="Seleccionar Cliente" height="85vh">
        <MobileSearchBar value={search} onChange={setSearch} placeholder="Nombre o CUIT..." />
        <div style={{ marginTop: '16px' }}>
          {clientes.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase())).slice(0,20).map(c => (
            <MobileListItem 
              key={c.id} 
              title={c.nombre} 
              subtitle={c.cuit} 
              onClick={() => { setSelectedClient(c); setIsClientSheetOpen(false); }}
            />
          ))}
        </div>
      </MobileBottomSheet>

      {/* Selector de Producto */}
      <MobileBottomSheet isOpen={isProductSheetOpen} onClose={() => setIsProductSheetOpen(false)} title="Agregar Productos" height="85vh">
        <MobileSearchBar value={search} onChange={setSearch} placeholder="Buscar producto..." />
        <div style={{ marginTop: '16px' }}>
          {productos.filter(p => p.activo && p.nombre.toLowerCase().includes(search.toLowerCase())).slice(0,30).map(p => (
            <MobileListItem 
              key={p.id} 
              title={p.nombre} 
              subtitle={`$${p.precioComercial || 0} x ${p.unitType}`}
              rightElement={
                <div style={{ backgroundColor: 'var(--mobile-primary-light)', color: 'var(--mobile-primary)', padding: '6px 12px', borderRadius: '20px', fontWeight: 600 }}>
                  Añadir
                </div>
              }
              onClick={() => handleAddProduct(p)}
            />
          ))}
        </div>
      </MobileBottomSheet>

      {/* Hoja de Pago */}
      <MobileBottomSheet isOpen={isPaymentSheetOpen} onClose={() => setIsPaymentSheetOpen(false)} title="Método de Pago" height="50vh">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <MobileCard 
            onClick={() => handleCharge('CONTADO')}
            style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}
          >
            <Banknote size={32} color="#16a34a" />
            <div>
              <strong style={{ fontSize: '20px', color: '#166534', display: 'block' }}>Efectivo / Transf.</strong>
              <span style={{ color: '#15803d' }}>Ingresa a caja instantáneamente</span>
            </div>
          </MobileCard>

          <MobileCard 
            onClick={() => handleCharge('CUENTA_CORRIENTE')}
            style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px', backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}
          >
            <CreditCard size={32} color="#475569" />
            <div>
              <strong style={{ fontSize: '20px', color: '#334155', display: 'block' }}>Cuenta Corriente</strong>
              <span style={{ color: '#64748b' }}>Se carga a la deuda del cliente</span>
            </div>
          </MobileCard>
        </div>
      </MobileBottomSheet>

    </div>
  );
}
