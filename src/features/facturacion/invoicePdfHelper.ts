import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Sale, Customer, Product, SystemSettings } from '../../types/domain';
import { drawCorporateHeader, drawCorporateFooter, BRAND_COLORS } from '../../utils/pdfBrandingHelper';

export function generateInvoicePDF(
  sale: Sale,
  customer: Customer | undefined,
  products: Product[],
  settings: SystemSettings,
  showPrices: boolean = true
) {
  const doc = new jsPDF();
  
  // 1. Draw Corporate Header (page 1)
  drawCorporateHeader(doc, settings, 'REMITO COMERCIAL', {
    documentNumber: `0001-${sale.id.slice(-8).toUpperCase()}`,
    date: new Date(sale.date).toLocaleDateString(),
    docCode: 'R'
  });

  // 2. Customer Info Box (Dynamic and Compact)
  let currentY = 52;
  
  const clientName = customer?.razonSocial || customer?.nombre || 'Consumidor Final';
  
  const leftDetails: string[] = [];
  leftDetails.push(`Cliente: ${clientName}`);
  if (customer?.cuit) {
    leftDetails.push(`CUIT: ${customer.cuit}`);
  }
  const clientIva = customer?.razonSocial ? 'Responsable Inscripto' : 'Consumidor Final';
  leftDetails.push(`Condición IVA: ${clientIva}`);

  const rightDetails: string[] = [];
  if (customer?.direccion) {
    rightDetails.push(`Dirección: ${customer.direccion}`);
  }
  if (customer?.telefono) {
    rightDetails.push(`Teléfono: ${customer.telefono}`);
  }
  if (customer?.email) {
    rightDetails.push(`Email: ${customer.email}`);
  }
  if (customer?.observaciones) {
    rightDetails.push(`Obs: ${customer.observaciones}`);
  }

  // Draw lines
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text('Destinatario / Cliente', 20, currentY + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(70, 70, 70);

  let leftY = currentY + 11;
  leftDetails.forEach(line => {
    doc.text(line, 20, leftY);
    leftY += 4.5;
  });

  let rightY = currentY + 11;
  rightDetails.forEach(line => {
    doc.text(line, 110, rightY);
    rightY += 4.5;
  });

  const boxHeight = Math.max(leftY, rightY) - currentY + 1;
  doc.setDrawColor(220, 220, 220);
  doc.rect(15, currentY, 180, boxHeight);

  // 3. Items Table
  const tableHeaders = showPrices 
    ? ['Cant.', 'Producto / Detalle', 'Peso Real (KG)', 'Precio Kg ($)', 'Subtotal ($)']
    : ['Cant.', 'Producto / Detalle', 'Peso Real (KG)'];
  
  const tableData = sale.items.map(item => {
    const prod = products.find(p => p.id === item.productId);
    const prodName = prod?.nombre || 'Producto Desconocido';
    const pesosReales = item.pesosReales || (item.pesoReal ? [item.pesoReal] : []);

    let pesoRealCell = `${(item.pesoReal || 0).toFixed(3)} Kg`;
    if (pesosReales.length > 1) {
      const breakdown = pesosReales.map((w, idx) => `Paq ${idx + 1}: ${w.toFixed(3)} kg`).join(' | ');
      pesoRealCell = `${(item.pesoReal || 0).toFixed(3)} Kg (${breakdown})`;
    }
    
    if (showPrices) {
      return [
        `${item.cantidad} ${item.unidad}`,
        prodName,
        pesoRealCell,
        `$ ${item.precioUnitario.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        `$ ${item.subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
      ];
    } else {
      return [
        `${item.cantidad} ${item.unidad}`,
        prodName,
        pesoRealCell
      ];
    }
  });

  const startTableY = currentY + boxHeight + 6;

  autoTable(doc, {
    startY: startTableY,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 30, 30], valign: 'middle' },
    headStyles: { fillColor: BRAND_COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: BRAND_COLORS.background },
    columnStyles: showPrices ? {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 45, halign: 'left' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' }
    } : {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 60, halign: 'left' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY || startTableY;

  // 4. Totals Box
  let nextY = finalY;
  if (showPrices) {
    const total = sale.totalAmount;
    doc.setFillColor(248, 249, 250);
    doc.rect(130, finalY + 4, 65, 8, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(`TOTAL:`, 133, finalY + 9.5, { align: 'left' });
    doc.text(`$ ${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 192, finalY + 9.5, { align: 'right' });
    nextY = finalY + 16;
  } else {
    nextY = finalY + 8;
  }

  // 5. Observations Box
  const observationsText = (sale as any).observaciones || 'Sin observaciones.';
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  doc.text('OBSERVACIONES:', 15, nextY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(observationsText, 15, nextY + 4, { maxWidth: 180 });

  // 6. Signatures block
  const sigY = Math.max(nextY + 18, 240);
  doc.setDrawColor(220, 220, 220);
  doc.line(15, sigY, 195, sigY);

  // Line containers
  doc.rect(15, sigY + 4, 180, 22);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text('RECIBÍ CONFORME', 60, sigY + 8, { align: 'center' });
  doc.text('ENTREGÓ', 150, sigY + 8, { align: 'center' });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text('Firma y Aclaración: ___________________________', 20, sigY + 18);
  doc.text('Firma y Aclaración: ___________________________', 110, sigY + 18);

  // 7. Render corporate footers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawCorporateFooter(doc, settings, i, totalPages);
  }

  doc.save(`Remito_${sale.id.slice(-8).toUpperCase()}.pdf`);
}
