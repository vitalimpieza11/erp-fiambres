import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PriceList, Customer, Product } from '../../types/domain';
import { formatDate, formatCurrency } from '../../lib/formatters';

export function generatePriceListPDF(
  priceList: PriceList,
  customerName: string,
  products: Product[]
) {
  const doc = new jsPDF();

  // 1. Top Brand Accent Line (Al Vacío Red: #c43126)
  doc.setFillColor(196, 49, 38);
  doc.rect(0, 0, 210, 8, 'F');

  // 2. Logo drawing (Circular emblem + Name text)
  doc.setFillColor(196, 49, 38);
  doc.circle(25, 23, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text('AV', 25, 26, { align: 'center' });

  // 3. Header Details
  // Left Side: Seller Info
  doc.setFontSize(18);
  doc.setTextColor(196, 49, 38);
  doc.text('ALVACÍO', 37, 22);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80, 80, 80);
  doc.text('Distribuidora Al Vacío SRL', 37, 27);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text('Fábrica de Embutidos y Fiambres Premium', 37, 32);
  
  // Right Side: Voucher Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text('LISTA DE PRECIOS', 195, 20, { align: 'right' });
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.text(`Lista: ${priceList.name}`, 195, 26, { align: 'right' });
  doc.text(`Cliente: ${customerName}`, 195, 31, { align: 'right' });
  doc.text(`Fecha Emisión: ${formatDate(new Date().toISOString())}`, 195, 36, { align: 'right' });

  // Horizontal divider line
  doc.setDrawColor(200, 200, 200);
  doc.line(15, 42, 195, 42);

  // 4. Table Headers & Data
  const tableHeaders = ['Producto', 'Precio Comercial', 'Unidad'];
  
  const tableData = priceList.items.map(item => {
    const prod = products.find(p => p.id === item.productId);
    const prodName = prod?.nombre || 'Producto Desconocido';
    const unit = prod?.unitType || 'U';
    return [
      prodName,
      `$ ${item.price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      unit
    ];
  });

  autoTable(doc, {
    startY: 48,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50], valign: 'middle' },
    headStyles: { fillColor: [196, 49, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 40, halign: 'right' },
      2: { cellWidth: 30, halign: 'center' }
    },
    didDrawPage: (data) => {
      // Footer
      const totalPages = (doc as any).internal.getNumberOfPages();
      const pageNo = data.pageNumber;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      
      // Right aligned page numbering
      doc.text(`Página ${pageNo} de ${totalPages}`, 195, 287, { align: 'right' });
      // Left aligned text
      doc.text('Vitalimpieza ERP • Gestión Profesional de Distribución • Precios sujetos a cambios sin previo aviso', 15, 287);
    }
  });

  doc.save(`Lista_Precios_${priceList.name.replace(/\s+/g, '_')}.pdf`);
}
