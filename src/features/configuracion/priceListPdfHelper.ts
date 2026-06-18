import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PriceList, Product, SystemSettings } from '../../types/domain';
import { formatDate } from '../../lib/formatters';
import { drawCorporateHeader, drawCorporateFooter, BRAND_COLORS } from '../../utils/pdfBrandingHelper';

export function generatePriceListPDF(
  priceList: PriceList,
  customerName: string,
  products: Product[],
  settings: SystemSettings
) {
  const doc = new jsPDF();

  // 1. Draw Corporate Header
  drawCorporateHeader(doc, settings, 'LISTA DE PRECIOS', {
    subtitle: `Lista: ${priceList.name}`,
    documentNumber: priceList.id?.slice(-8).toUpperCase() || 'NUEVA',
    date: formatDate(new Date().toISOString()),
    docCode: 'L'
  });

  // Additional subtitle for customer scope
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 30, 30);
  doc.text(`Cliente Asignado: ${customerName}`, 15, 52);

  // 2. Table Headers & Data
  const tableHeaders = ['Producto / Detalle', 'Precio por Kg ($)', 'Unidad'];
  
  const tableData = priceList.items.map(item => {
    const prod = products.find(p => p.id === item.productId);
    const prodName = prod?.nombre || 'Producto Desconocido';
    const unit = prod?.unitType || 'KG';
    return [
      prodName,
      `$ ${item.price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
      unit
    ];
  });

  autoTable(doc, {
    startY: 56,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [30, 30, 30], valign: 'middle' },
    headStyles: { fillColor: BRAND_COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: BRAND_COLORS.background },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 40, halign: 'right' },
      2: { cellWidth: 25, halign: 'center' }
    }
  });

  // 3. Render footers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawCorporateFooter(doc, settings, i, totalPages);
  }

  doc.save(`Lista_Precios_${priceList.name.replace(/\s+/g, '_')}.pdf`);
}
