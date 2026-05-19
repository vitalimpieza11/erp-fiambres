import React, { useState, useEffect } from 'react';
import { PageHeader, EmptyState } from '../components/EmptyState';
import { LoadingSpinner, ErrorState, SkeletonLoader } from '../components/AsyncState';
import { Card } from '../components/ui/Card';
import { Table } from '../components/ui/Table';
import { Input, Select } from '../components/ui/Forms';
import { 
  Search, Plus, Filter, ArrowLeft, Save, 
  User, ShoppingCart, DollarSign, Truck, PackageCheck, FileText,
  AlertTriangle, ArrowRight, Printer, X, TrendingUp, Loader2, Download
} from 'lucide-react';
import { formatCurrency, formatNumber, parseNumber } from '../utils/format';
import { useSales } from '../hooks/useSales';
import { useProducts } from '../hooks/useProducts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCustomers } from '../hooks/useCustomers';
import { calculateSaleTotals } from '../core/calculations';
import { StockService } from '../services/StockService';

interface SaleFormItem {
  id: number;
  productId: string;
  productName: string;
  gramaje: string;
  paquetesStr: string;
  precioUnitario: number;
  costoUnitario: number;
}

export const Ventas = () => {
  const { sales, loading: loadingSales, error: errorSales, createSale } = useSales();
  const { products, loading: loadingProducts, error: errorProducts } = useProducts();
  const { customers, loading: loadingCustomers, error: errorCustomers } = useCustomers();

  const globalError = errorSales || errorProducts || errorCustomers;


  const [isCreating, setIsCreating] = useState(false);
  const [showRemito, setShowRemito] = useState(false);
  const [selectedPreviewSale, setSelectedPreviewSale] = useState<any | null>(null);

  // Form States
  const [customerId, setCustomerId] = useState('');
  const [tipoCliente, setTipoCliente] = useState('gastro');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [formaPago, setFormaPago] = useState('cc');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  
  const [items, setItems] = useState<SaleFormItem[]>([]);
  const [descuentoStr, setDescuentoStr] = useState('0');
  const [costoEnvioStr, setCostoEnvioStr] = useState('0');
  
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Real-time stock status cache for UI warnings
  const [stockCache, setStockCache] = useState<Record<string, number>>({});

  if (globalError) {
    return <ErrorState message={globalError} />;
  }

  useEffect(() => {
    // Pre-populate customers details when customer selection changes
    if (customerId) {
      const client = customers.find((c: any) => c.id === customerId);
      if (client) {
        setTelefono(client.phone || '');
        setDireccion(client.address || '');
      }
    }
  }, [customerId, customers]);

  // Load stock levels for form items
  useEffect(() => {
    const fetchStocks = async () => {
      const cache: Record<string, number> = {};
      for (const item of items) {
        if (item.productId && !cache[item.productId]) {
          const qty = await StockService.getStock(item.productId);
          cache[item.productId] = qty;
        }
      }
      setStockCache(cache);
    };
    if (items.length > 0) {
      fetchStocks();
    }
  }, [items]);

  const discountPercent = parseNumber(descuentoStr);
  const shippingCost = parseNumber(costoEnvioStr);

  const updateItemQty = (id: number, paquetesStr: string) => {
    setItems(items.map(item => item.id === id ? { ...item, paquetesStr } : item));
  };

  const updateItemProduct = (id: number, prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;
    
    // In our system, product prices are calculated or entered manually
    // Let's get the sale price
    const precio = prod.precioManual > 0 ? prod.precioManual : (prod.costoHorma * 1.4); // Suggested or manual
    // Cost per package (materia prima + empaque + mano obra)
    const pesoHorma = prod.pesoHorma || 1;
    const kgNetos = pesoHorma * (1 - (prod.mermaEstimada || 0) / 100);
    const paqEstimados = prod.gramajeVenta > 0 ? Math.floor((kgNetos * 1000) / prod.gramajeVenta) : 1;
    const costoMateriaPrimaPorPaq = paqEstimados > 0 ? prod.costoHorma / paqEstimados : 0;
    const costoTotalPaquete = costoMateriaPrimaPorPaq + (prod.costoBolsa || 0) + (prod.costoEtiqueta || 0) + (prod.manoObra || 0);

    setItems(items.map(item => item.id === id ? {
      ...item,
      productId: prodId,
      productName: prod.name,
      gramaje: `${prod.gramajeVenta}g`,
      precioUnitario: precio,
      costoUnitario: costoTotalPaquete
    } : item));
  };

  const removeItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  const addItem = () => {
    const firstProd = products[0];
    if (!firstProd) return;
    
    setItems([...items, {
      id: Date.now(),
      productId: '',
      productName: 'Seleccione un Producto',
      gramaje: '--',
      paquetesStr: '1',
      precioUnitario: 0,
      costoUnitario: 0
    }]);
  };

  // Normalized calculations via core logic
  const normalizedItemsForCalc = items.map(item => ({
    quantity: parseNumber(item.paquetesStr),
    price: item.precioUnitario,
    cost: item.costoUnitario
  }));
  
  const calc = calculateSaleTotals(normalizedItemsForCalc, discountPercent, shippingCost);

  const handleConfirmSale = async () => {
    if (!customerId) {
      setErrorMessage("Debe seleccionar un cliente.");
      return;
    }
    if (items.length === 0 || items.some(item => !item.productId)) {
      setErrorMessage("Debe agregar al menos un producto válido.");
      return;
    }
    
    setErrorMessage(null);
    setIsSaving(true);
    
    try {
      const selectedCustomer = customers.find((c: any) => c.id === customerId);
      
      // 1. Validate Stock before saving
      for (const item of items) {
        const qtyToReduce = parseNumber(item.paquetesStr);
        const availableStock = await StockService.getStock(item.productId);
        if (availableStock < qtyToReduce) {
          throw new Error(`Stock insuficiente para ${item.productName}. Disponible: ${availableStock}, Requerido: ${qtyToReduce}`);
        }
      }

      // 2. Prepare payload
      const saleData = {
        customerId,
        customerName: selectedCustomer?.name || 'Cliente Genérico',
        items: items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: parseNumber(item.paquetesStr),
          price: item.precioUnitario,
          cost: item.costoUnitario
        })),
        status: 'completed' as const,
        paymentStatus: formaPago === 'cc' ? 'pending' as const : 'paid' as const,
        paymentMethod: formaPago,
        remitoNumber: `REM-${Date.now().toString().slice(-6)}`,
        date: Date.now(),
        discount: discountPercent
      };

      // 3. Register Sale via transactional ErpEngine
      await createSale(saleData, discountPercent, shippingCost);
      
      // Clean up form
      setItems([]);
      setCustomerId('');
      setIsCreating(false);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "Error al registrar la venta.");
    } finally {
      setIsSaving(false);
    }
  };

  const exportRemitoPDF = async (sale: any) => {
    // Preload circular stamp image
    const img = new Image();
    img.src = '/logo_circular.png';
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve; // fallback in case of errors
    });

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor: [number, number, number] = [230, 57, 70]; // Rojo Tomate Vivo #E63946
    const darkColor = [33, 37, 41]; // Negro Carbón #212529
    const lightColor = [248, 249, 250]; // Blanco Puro #F8F9FA

    // Header Background - Negro Carbón
    doc.setFillColor(33, 37, 41);
    doc.rect(0, 0, 210, 42, 'F');

    // Add Logo Circular Image - high quality brand image
    try {
      doc.addImage(img, 'PNG', 15, 6, 30, 30);
    } catch (e) {
      // Fallback seal vector if image error
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.6);
      doc.circle(30, 21, 13, 'S'); // Outer circle
      doc.setLineWidth(0.2);
      doc.circle(30, 21, 12, 'S'); // Inner circle
      doc.circle(30, 21, 8.5, 'S'); // Central frame
      doc.setFillColor(255, 255, 255);
      doc.rect(27, 18, 6, 6, 'F');
    }

    // Logo text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('Al Vacío', 50, 20);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('DISTRIBUIDORA MAYORISTA • ALIMENTOS ENVASADOS', 50, 26);
    doc.text('Frescura y Calidad de Origen Garantizada', 50, 31);

    // Right side document type
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('REMITO COMERCIAL', 195, 18, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Comprobante Nº: ${sale.remitoNumber || 'REM-0001'}`, 195, 24, { align: 'right' });
    doc.text(`Fecha: ${new Date(sale.date).toLocaleDateString()}`, 195, 28, { align: 'right' });

    // Client section
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 48, 180, 26, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.roundedRect(15, 48, 180, 26, 3, 3, 'S');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('DATOS DEL CLIENTE', 20, 54);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Razón Social: ${sale.customerName}`, 20, 60);
    doc.text(`Condición Pago: ${sale.paymentMethod === 'cc' ? 'Cuenta Corriente' : 'Contado / Transferencia'}`, 20, 65);
    
    doc.text(`Estado Cobro: ${sale.paymentStatus === 'paid' ? 'Cobrado / Liquidado' : 'Pendiente en CC'}`, 110, 60);
    doc.text(`Comprobante: ${sale.remitoNumber}`, 110, 65);

    // Products Table
    const tableItems = sale.items || [];
    const tableRows = tableItems.map((item: any) => [
      `${item.quantity} paq.`,
      item.productName,
      `$${item.price.toFixed(2)}`,
      `$${(item.quantity * item.price).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 80,
      head: [['Cant.', 'Descripción del Producto', 'Precio Unit.', 'Subtotal']],
      body: tableRows,
      theme: 'striped',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 95 },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: 15, right: 15 }
    });

    const currentY = (doc as any).lastAutoTable.finalY + 10;

    // Totals section
    const subtotal = sale.subtotal || sale.total || 0;
    const discount = sale.discount || 0;
    const discountAmount = subtotal * (discount / 100);
    const total = sale.total || 0;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Subtotal:', 140, currentY);
    doc.text(`$${subtotal.toFixed(2)}`, 195, currentY, { align: 'right' });

    doc.text(`Descuento (${discount}%):`, 140, currentY + 5);
    doc.text(`-$${discountAmount.toFixed(2)}`, 195, currentY + 5, { align: 'right' });

    doc.setDrawColor(230, 57, 70);
    doc.setLineWidth(0.5);
    doc.line(135, currentY + 8, 195, currentY + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL FINAL:', 140, currentY + 14);
    doc.text(`$${total.toFixed(2)}`, 195, currentY + 14, { align: 'right' });

    // Signature and footer space
    const signatureY = currentY + 36;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Observaciones: La mercadería viaja por cuenta y orden del comprador.', 15, signatureY);

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.5);
    doc.line(130, signatureY + 8, 195, signatureY + 8);
    doc.text('Firma y Aclaración - Recibí Conforme', 162.5, signatureY + 12, { align: 'center' });

    // Save PDF
    doc.save(`remito-${sale.remitoNumber.toLowerCase()}.pdf`);
  };

  const handleOpenPreview = (sale: any) => {
    setSelectedPreviewSale(sale);
    setShowRemito(true);
  };

  // A4 PDF VIEW PREVIEW
  if (showRemito && selectedPreviewSale) {
    const saleItems = selectedPreviewSale.items || [];
    const subtotal = selectedPreviewSale.subtotal || 0;
    const discount = selectedPreviewSale.discount || 0;
    const discountAmount = subtotal * (discount / 100);
    const total = selectedPreviewSale.total || 0;

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '800px', marginBottom: '20px' }}>
          <button onClick={() => { setShowRemito(false); setSelectedPreviewSale(null); }} className="btn btn-dark">
            <ArrowLeft size={18} /> Volver a Ventas
          </button>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => exportRemitoPDF(selectedPreviewSale)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={18} /> Descargar Remito (PDF)
            </button>
            <button onClick={() => window.print()} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Printer size={18} /> Imprimir Remito
            </button>
          </div>
        </div>
        
        {/* A4 Document */}
        <div className="print-area" style={{ backgroundColor: '#fff', width: '100%', maxWidth: '800px', padding: '60px', borderRadius: '4px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', color: '#000' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img src="/logo_stamp.svg" alt="Al Vacío Sello" style={{ width: '64px', height: '64px' }} />
              <div>
                <h1 style={{ fontSize: '1.85rem', fontWeight: 900, letterSpacing: '-0.03em', color: '#212529', margin: 0, fontFamily: 'var(--font-title)' }}>Al Vacío</h1>
                <p style={{ color: '#495057', fontSize: '0.85rem', fontWeight: 500, fontFamily: 'var(--font-body)' }}>Distribuidora Mayorista • Alimentos Envasados</p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>REMITO</h2>
              <p style={{ fontSize: '1rem', color: '#444' }}>{selectedPreviewSale.remitoNumber || 'REM-0001'}</p>
              <p style={{ fontSize: '0.875rem', color: '#666' }}>Fecha: {new Date(selectedPreviewSale.date).toLocaleDateString()}</p>
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px', textTransform: 'uppercase', color: '#000' }}>Datos del Cliente</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.9rem' }}>
              <div><strong>Razón Social:</strong> {selectedPreviewSale.customerName}</div>
              <div><strong>Método Pago:</strong> {selectedPreviewSale.paymentMethod === 'cc' ? 'Cuenta Corriente' : 'Contado/Transferencia'}</div>
              <div><strong>Estado Pago:</strong> {selectedPreviewSale.paymentStatus === 'paid' ? 'Pagado/Cobrado' : 'Pendiente'}</div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #000', borderBottom: '2px solid #000' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875rem', color: '#000' }}>Cant.</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.875rem', color: '#000' }}>Descripción</th>
                <th style={{ padding: '12px', textAlign: 'right', fontSize: '0.875rem', color: '#000' }}>Precio Unit.</th>
                <th style={{ padding: '12px', textAlign: 'right', fontSize: '0.875rem', color: '#000' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {saleItems.map((item: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px' }}><strong>{item.quantity}</strong> paq.</td>
                  <td style={{ padding: '12px' }}>{item.productName}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{formatCurrency(item.quantity * item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}>
            <div style={{ width: '300px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ color: '#666' }}>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ color: '#666' }}>Descuento ({discount}%):</span>
                <span>- {formatCurrency(discountAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderTop: '2px solid #000' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>TOTAL:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800 }}>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px' }}>
            <div style={{ width: '45%' }}>
              <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '4px' }}>Observaciones:</p>
              <p style={{ fontSize: '0.875rem' }}>La mercadería viaja por cuenta y orden del comprador.</p>
            </div>
            <div style={{ width: '45%', borderTop: '1px dashed #000', paddingTop: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.875rem', color: '#666' }}>Firma y Aclaración - Recibí Conforme</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // VISTA NUEVA VENTA
  if (isCreating) {
    return (
      <div style={{ paddingBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={() => setIsCreating(false)}
              className="btn btn-icon"
            >
              <ArrowLeft size={20} color="var(--text-secondary)" />
            </button>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Nuevo Pedido de Venta</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Toma rápida de pedidos para clientes en tiempo real</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleConfirmSale} disabled={isSaving} className="btn btn-primary">
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              {isSaving ? 'Guardando...' : 'Confirmar Venta'}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fecaca', padding: '16px', borderRadius: '12px', color: '#dc2626', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
            <AlertTriangle size={20} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
          
          {/* COLUMNA IZQUIERDA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* SECCIÓN 1 — CLIENTE */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <User size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>1. Datos del Cliente</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Select 
                  label="Buscar Cliente" 
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  options={[
                    { value: '', label: 'Seleccionar Cliente...' },
                    ...customers.map((c: any) => ({ value: c.id!, label: c.name }))
                  ]} 
                />
                <Select 
                  label="Tipo de Cliente" 
                  value={tipoCliente}
                  onChange={e => setTipoCliente(e.target.value)}
                  options={[
                    { value: 'gastro', label: 'Gastronómico' },
                    { value: 'kiosco', label: 'Kiosco' },
                    { value: 'minorista', label: 'Minorista' },
                    { value: 'almacen', label: 'Almacén' }
                  ]} 
                />
                <Input label="Teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 341-555-0192" />
                <Input label="Dirección de Entrega" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Av. Pellegrini 1234" />
                <div style={{ gridColumn: '1 / -1' }}>
                  <Input label="Observaciones del Cliente" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Preferencias, horarios de descarga..." />
                </div>
              </div>
            </Card>

            {/* SECCIÓN 2 — PRODUCTOS */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <ShoppingCart size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>2. Carga de Productos</h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {items.map(item => {
                  const paq = parseNumber(item.paquetesStr);
                  const available = stockCache[item.productId] ?? 0;
                  const isInsufficient = available < paq;
                  
                  return (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', backgroundColor: 'var(--bg-primary)', border: isInsufficient && item.productId ? '1px solid #ef4444' : '1px solid var(--border-color)', borderRadius: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <Select 
                          label=""
                          value={item.productId}
                          onChange={e => updateItemProduct(item.id, e.target.value)}
                          options={[
                            { value: '', label: 'Seleccione un Producto...' },
                            ...products.filter(p => p.isActive).map(p => ({ value: p.id!, label: `${p.name} (${p.brand})` }))
                          ]}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '9999px', border: '1px solid var(--border-color)' }}>{item.gramaje}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatCurrency(item.precioUnitario)} c/u</span>
                          {item.productId && (
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isInsufficient ? '#ef4444' : '#16a34a' }}>
                              Disponible: {available} paq.
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fff', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>PAQ:</span>
                        <input 
                          type="number" 
                          value={item.paquetesStr} 
                          onChange={e => updateItemQty(item.id, e.target.value)} 
                          style={{ width: '50px', textAlign: 'center', padding: '4px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--bg-primary)', outline: 'none', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }} 
                        />
                      </div>

                      <div style={{ width: '100px', textAlign: 'right' }}>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Subtotal</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>{formatCurrency(paq * item.precioUnitario)}</span>
                      </div>

                      <button onClick={() => removeItem(item.id)} style={{ background: '#fee2e2', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', borderRadius: '8px', transition: 'background-color 0.2s' }}>
                        <X size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
              
              <button onClick={addItem} className="btn btn-primary-light w-full">
                <Plus size={18} /> Agregar Producto al Pedido
              </button>
            </Card>

          </div>

          {/* COLUMNA DERECHA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* SECCIÓN 3 — RESUMEN DE PEDIDO */}
            <Card style={{ backgroundColor: '#1e293b', color: '#fff', borderColor: '#334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                <FileText size={20} color="#94a3b8" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f8fafc' }}>3. Resumen de Operación</h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #334155' }}>
                  <span style={{ color: '#cbd5e1', fontSize: '0.95rem' }}>Subtotal ({calc.quantity} paq.)</span>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{formatCurrency(calc.subtotal)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #334155' }}>
                  <span style={{ color: '#cbd5e1', fontSize: '0.95rem' }}>Descuento (%)</span>
                  <input 
                    type="number" 
                    value={descuentoStr} 
                    onChange={e => setDescuentoStr(e.target.value)} 
                    style={{ width: '80px', textAlign: 'right', padding: '8px 12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', outline: 'none', fontWeight: 600, fontSize: '0.95rem' }} 
                  />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #334155' }}>
                  <span style={{ color: '#cbd5e1', fontSize: '0.95rem' }}>Envío ($)</span>
                  <input 
                    type="number" 
                    value={costoEnvioStr} 
                    onChange={e => setCostoEnvioStr(e.target.value)} 
                    style={{ width: '100px', textAlign: 'right', padding: '8px 12px', borderRadius: '8px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#fff', outline: 'none', fontWeight: 600, fontSize: '0.95rem' }} 
                  />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '8px' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>Total Final</span>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: '#4ade80', lineHeight: 1 }}>{formatCurrency(calc.total)}</span>
                </div>
                
                <div style={{ marginTop: '8px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Rentabilidad Est.</span>
                  <span style={{ fontSize: '1rem', color: calc.marginPercent >= 30 ? '#4ade80' : '#fca5a5', fontWeight: 700 }}>{formatNumber(calc.marginPercent, '%')}</span>
                </div>
              </div>
            </Card>

            {/* SECCIÓN 4 — COBRO */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <DollarSign size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>4. Condiciones de Cobro</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <Select 
                  label="Forma de Pago" 
                  value={formaPago}
                  onChange={e => setFormaPago(e.target.value)}
                  options={[
                    { value: 'cc', label: 'Cuenta Corriente' },
                    { value: 'efectivo', label: 'Efectivo Contado' },
                    { value: 'transferencia', label: 'Transferencia Bancaria' }
                  ]} 
                />
                <Input label="Fecha Vencimiento" type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)} />
                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#991b1b', fontWeight: 600, fontSize: '0.875rem' }}>Deuda a Generar</span>
                  <span style={{ color: '#991b1b', fontWeight: 700, fontSize: '1.25rem' }}>{formatCurrency(calc.total)}</span>
                </div>
              </div>
            </Card>

          </div>
        </div>
      </div>
    );
  }

  // CALCULAR RESUMEN DIARIO DESDE LAS VENTAS REALES
  const dailyTotal = sales.reduce((acc, sale) => {
    const isToday = new Date(sale.date).toDateString() === new Date().toDateString();
    return isToday ? acc + sale.total : acc;
  }, 0);

  const pendingDeliveries = sales.filter(s => s.status === 'pending').length;

  const topCards = [
    { title: 'Ventas de Hoy', value: formatCurrency(dailyTotal), icon: DollarSign, color: 'var(--primary-color)', bg: 'var(--primary-light)' },
    { title: 'Pedidos Pendientes', value: pendingDeliveries.toString(), icon: ShoppingCart, color: '#d97706', bg: '#fef3c7' },
    { title: 'Total Histórico', value: formatCurrency(sales.reduce((acc, s) => acc + s.total, 0)), icon: PackageCheck, color: '#059669', bg: '#d1fae5' },
    { title: 'Tickets Emitidos', value: sales.length.toString(), icon: FileText, color: '#4f46e5', bg: '#e0e7ff' },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <PageHeader title="Ventas y Remitos" description="Gestión rápida de pedidos mayoristas y gastronómicos en tiempo real" />
        <button 
          onClick={() => {
            setIsCreating(true);
            setItems([]);
            setErrorMessage(null);
          }}
          className="btn btn-primary"
        >
          <Plus size={18} />
          Nueva Venta
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {topCards.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} padding="sm">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', backgroundColor: stat.bg, color: stat.color, borderRadius: '10px' }}>
                  <Icon size={20} />
                </div>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>{stat.title}</p>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</h3>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card padding="none">
        <div style={{ padding: '20px', display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '10px' }} />
            <input 
              type="text" 
              placeholder="Buscar por cliente o comprobante..." 
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }}
            />
          </div>
        </div>

        {loadingSales ? (
          <SkeletonLoader rows={4} height="52px" />
        ) : sales.length === 0 ? (
          <div style={{ padding: '40px' }}>
            <EmptyState 
              icon={ShoppingCart} 
              title="No hay ventas registradas" 
              description="Registra una nueva venta para actualizar el stock e iniciar operaciones." 
            />
          </div>
        ) : (
          <Table 
            data={sales}
            keyExtractor={(item) => item.id!}
            columns={[
              { header: 'Comprobante', accessor: (item) => <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.remitoNumber}</span>, width: '150px' },
              { header: 'Fecha', accessor: (item) => new Date(item.date).toLocaleDateString() },
              { header: 'Cliente', accessor: (item) => <span style={{ fontWeight: 600 }}>{item.customerName}</span> },
              { header: 'Total', accessor: (item) => <span style={{ fontWeight: 700 }}>{formatCurrency(item.total)}</span> },
              { 
                header: 'Estado Pago', 
                accessor: (item) => (
                  <span style={{ 
                    padding: '4px 12px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                    backgroundColor: item.paymentStatus === 'paid' ? '#dcfce7' : '#fee2e2',
                    color: item.paymentStatus === 'paid' ? '#166534' : '#dc2626'
                  }}>
                    {item.paymentStatus === 'paid' ? 'Cobrado' : 'Pendiente'}
                  </span>
                ),
                align: 'center'
              },
              { 
                header: 'Remito PDF', 
                accessor: (item) => (
                  <button onClick={() => handleOpenPreview(item)} className="btn btn-secondary-light btn-sm" style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={14} /> Ver Remito
                  </button>
                ),
                align: 'center'
              },
            ]}
          />
        )}
      </Card>
    </>
  );
};
export default Ventas;
