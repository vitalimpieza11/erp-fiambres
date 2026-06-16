import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Sale, Customer, Product } from '../../types/domain';

export function generateInvoicePDF(sale: Sale, customer: Customer | undefined, products: Product[]) {
  const doc = new jsPDF();
  
  // 1. Top Brand Accent Line (Al Vacío Red: #c43126)
  doc.setFillColor(196, 49, 38);
  doc.rect(0, 0, 210, 8, 'F');
  
  // 2. Large Central Document Type Box ("R" for Remito)
  doc.setDrawColor(80, 80, 80);
  doc.rect(98, 12, 14, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 30, 30);
  doc.text('R', 105, 23, { align: 'center' });
  doc.setFontSize(5.5);
  doc.text('NO VÁLIDO FAC.', 105, 26, { align: 'center' });

  // 3. Header Details
  // Left Side: Seller Info
  doc.setFontSize(20);
  doc.setTextColor(196, 49, 38);
  doc.text('ALVACÍO', 15, 22);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text('Distribuidora Al Vacío SRL', 15, 28);
  doc.text('Dirección: Parque Industrial Al Vacío, Lote 14', 15, 33);
  doc.text('Provincia de Buenos Aires, Argentina', 15, 38);
  doc.text('Condición IVA: IVA Responsable Inscripto', 15, 43);

  // Right Side: Voucher Info
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text('REMITO COMERCIAL', 195, 22, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(`Punto de Vta: 0001  Comp. N°: ${sale.id.slice(-8).toUpperCase()}`, 195, 28, { align: 'right' });
  doc.text(`Fecha Emisión: ${new Date(sale.date).toLocaleDateString()}`, 195, 33, { align: 'right' });
  doc.text(`CUIT Emisor: 30-76543210-9`, 195, 38, { align: 'right' });
  doc.text(`Ing. Brutos: 901-765432-1`, 195, 43, { align: 'right' });
  doc.text(`Inicio Actividades: 01/10/2020`, 195, 48, { align: 'right' });

  // Horizontal divider line
  doc.setDrawColor(200, 200, 200);
  doc.line(15, 52, 195, 52);

  // 4. Customer Info Box
  doc.rect(15, 56, 180, 32);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 30, 30);
  doc.text('Destinatario / Cliente', 20, 62);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 60, 60);
  
  const clientName = customer?.razonSocial || customer?.nombre || 'Consumidor Final';
  const clientCuit = customer?.cuit || '99-99999999-9';
  const clientIva = customer?.razonSocial ? 'Responsable Inscripto' : 'Consumidor Final';
  const clientAddress = customer?.direccion || 'Domicilio no registrado';
  const clientPhone = customer?.telefono || 'Sin teléfono';
  
  doc.text(`Razón Social: ${clientName}`, 20, 69);
  doc.text(`CUIT: ${clientCuit}`, 20, 75);
  doc.text(`Condición IVA: ${clientIva}`, 20, 81);
  
  doc.text(`Dirección: ${clientAddress}`, 110, 69);
  doc.text(`Teléfono: ${clientPhone}`, 110, 75);
  doc.text(`Email: ${customer?.email || '-'}`, 110, 81);

  // 5. Items Table
  const tableHeaders = ['Producto', 'Cantidad', 'Unidad', 'Precio Unit.', 'Subtotal'];
  
  const tableData = sale.items.map(item => {
    const prod = products.find(p => p.id === item.productId);
    const prodName = prod?.nombre || 'Producto Desconocido';
    
    return [
      prodName,
      item.cantidad.toString(),
      item.unidad,
      `$ ${item.precioUnitario.toFixed(2)}`,
      `$ ${item.subtotal.toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY: 94,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 3, textColor: [50, 50, 50] },
    headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 92;

  // 6. Totals Box
  const total = sale.totalAmount;
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 30, 30);
  
  doc.setFillColor(245, 245, 245);
  doc.rect(138, finalY + 8, 57, 10, 'F');
  doc.setFontSize(10.5);
  doc.text(`TOTAL REMITO:`, 140, finalY + 14, { align: 'left' });
  doc.text(`$ ${total.toFixed(2)}`, 195, finalY + 14, { align: 'right' });

  // 7. Footer: Conform signature block & warnings
  const footerY = Math.max(finalY + 32, 235);
  doc.setDrawColor(220, 220, 220);
  doc.line(15, footerY, 195, footerY);
  
  // Signature Box
  doc.rect(15, footerY + 5, 180, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text('Recibí Conforme (Control de mercadería recibida):', 20, footerY + 11);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Firma: _____________________________________', 20, footerY + 20);
  doc.text('Aclaración: _________________________________', 20, footerY + 26);
  doc.text('DNI/Doc: ___________________________________', 110, footerY + 20);
  doc.text('Fecha/Hora: _____/_____/_________  ____:____ hs', 110, footerY + 26);

  // Legal legend
  doc.setFontSize(7.5);
  doc.setTextColor(140, 140, 140);
  doc.text('El presente remito documenta el traslado de mercaderías. DOCUMENTO NO VÁLIDO COMO FACTURA.', 15, footerY + 38);
  
  doc.save(`Remito_${sale.id.slice(-8).toUpperCase()}.pdf`);
}
