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

  // Legend
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const legendLines = doc.splitTextToSize(
    "Todos los precios expresados en esta lista corresponden a precio por kilogramo. El valor por kilogramo puede variar según la presentación solicitada por el cliente (150g, 250g, 500g o 1kg), debido a diferencias en costos de fraccionamiento, embolsado y presentación.",
    180
  );
  doc.text(legendLines, 15, 60);

  // 2. Table Headers & Data
  const tableHeaders = ['PRODUCTO', '150g', '250g', '500g', '1kg'];
  
  const tableData = priceList.items.map(item => {
    const prod = products.find(p => p.id === item.productId);
    const prodName = prod?.nombre || 'Producto Desconocido';
    const formatPrice = (price?: number | null) => price !== undefined && price !== null ? `$ ${price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}` : '-';

    return [
      prodName,
      formatPrice(prod?.precio150g),
      formatPrice(prod?.precio250g),
      formatPrice(prod?.precio500g),
      formatPrice(prod?.precio1kg)
    ];
  });

  autoTable(doc, {
    startY: 70,
    head: [tableHeaders],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [30, 30, 30], valign: 'middle' },
    headStyles: { fillColor: BRAND_COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: BRAND_COLORS.background },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 25, halign: 'center' },
      4: { cellWidth: 25, halign: 'center' }
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
