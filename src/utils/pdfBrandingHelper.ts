import jsPDF from 'jspdf';
import type { SystemSettings } from '../types/domain';

// Color Palette
export const BRAND_COLORS = {
  primary: [196, 49, 38] as [number, number, number],   // #c43126 (Rojo)
  secondary: [30, 30, 30] as [number, number, number],   // #1e1e1e (Negro)
  gray: [107, 114, 128] as [number, number, number],    // #6b7280 (Gris)
  background: [248, 249, 250] as [number, number, number] // #f8f9fa (Fondo Gris Claro)
};

export const BRAND_COLORS_HEX = {
  primary: '#c43126',
  secondary: '#1e1e1e',
  gray: '#6b7280',
  background: '#f8f9fa'
};

/**
 * Draws the common corporate header for any PDF document.
 */
export function drawCorporateHeader(
  doc: jsPDF,
  settings: SystemSettings,
  title: string,
  options?: {
    documentNumber?: string;
    date?: string;
    docCode?: string; // e.g. "R" for Remito, "P" for Presupuesto, etc.
    subtitle?: string;
  }
) {
  // 1. Top Brand Accent Line
  doc.setFillColor(BRAND_COLORS.primary[0], BRAND_COLORS.primary[1], BRAND_COLORS.primary[2]);
  doc.rect(0, 0, 210, 8, 'F');

  // 2. Logo drawing
  let logoDrawn = false;
  if (settings.companyLogo) {
    try {
      doc.addImage(settings.companyLogo, 'PNG', 15, 12, 45, 18, undefined, 'FAST');
      logoDrawn = true;
    } catch (e) {
      console.warn("Failed to draw companyLogo image on PDF. Falling back to text.", e);
    }
  }

  if (!logoDrawn) {
    // Fallback: Text Logo
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(BRAND_COLORS.primary[0], BRAND_COLORS.primary[1], BRAND_COLORS.primary[2]);
    const commercialName = settings.companyNombreComercial || settings.companyRazonSocial || 'AL VACÍO';
    doc.text(commercialName.toUpperCase(), 15, 24);
  }

  // 3. Document Identifier (docCode like "R")
  if (options?.docCode) {
    doc.setDrawColor(BRAND_COLORS.gray[0], BRAND_COLORS.gray[1], BRAND_COLORS.gray[2]);
    doc.setFillColor(BRAND_COLORS.background[0], BRAND_COLORS.background[1], BRAND_COLORS.background[2]);
    doc.rect(98, 12, 14, 16, 'FD');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(BRAND_COLORS.secondary[0], BRAND_COLORS.secondary[1], BRAND_COLORS.secondary[2]);
    doc.text(options.docCode.toUpperCase(), 105, 22, { align: 'center' });
    doc.setFontSize(5.5);
    doc.text('NO VÁLIDO FAC.', 105, 26, { align: 'center' });
  }

  // 4. Document Info (Right side)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(BRAND_COLORS.secondary[0], BRAND_COLORS.secondary[1], BRAND_COLORS.secondary[2]);
  doc.text(title.toUpperCase(), 195, 20, { align: 'right' });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(BRAND_COLORS.gray[0], BRAND_COLORS.gray[1], BRAND_COLORS.gray[2]);
  
  let currentRightY = 26;
  if (options?.subtitle) {
    doc.text(options.subtitle, 195, currentRightY, { align: 'right' });
    currentRightY += 5;
  }
  if (options?.documentNumber) {
    doc.text(`Comp. N°: ${options.documentNumber}`, 195, currentRightY, { align: 'right' });
    currentRightY += 5;
  }
  if (options?.date) {
    doc.text(`Fecha: ${options.date}`, 195, currentRightY, { align: 'right' });
  }

  // 5. Company Details (Left side, below the logo area)
  const companyYStart = 35;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(BRAND_COLORS.secondary[0], BRAND_COLORS.secondary[1], BRAND_COLORS.secondary[2]);
  
  const cName = settings.companyRazonSocial || 'AL VACÍO';
  doc.text(cName, 15, companyYStart);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(BRAND_COLORS.gray[0], BRAND_COLORS.gray[1], BRAND_COLORS.gray[2]);
  
  const dir = settings.companyDireccion
    ? `${settings.companyDireccion}, ${settings.companyCiudad || ''}, ${settings.companyProvincia || ''}`
    : 'Pablo Buitrago 5996, Córdoba, Argentina';
  const tel = settings.companyTelefono || '3513938769';
  const cuit = settings.companyCuit || '20-39494658-4';
  const iva = settings.companyCondicionIva || 'Monotributista';
  const ib = settings.companyIngresosBrutos || 'No Inscripto';
  const email = settings.companyEmail || '';

  let detailsText = `Dirección: ${dir}`;
  if (tel) detailsText += ` | Tel: ${tel}`;
  if (email) detailsText += ` | Email: ${email}`;

  doc.text(detailsText, 15, companyYStart + 4);
  doc.text(`CUIT: ${cuit} | IVA: ${iva} | Ing. Brutos: ${ib}`, 15, companyYStart + 8);

  // Divider line below header
  doc.setDrawColor(220, 220, 220);
  doc.line(15, companyYStart + 12, 195, companyYStart + 12);
}

/**
 * Draws the common corporate footer.
 */
export function drawCorporateFooter(
  doc: jsPDF,
  settings: SystemSettings,
  pageNumber: number,
  totalPages: number
) {
  const footerY = 282;

  // Divider line
  doc.setDrawColor(230, 230, 230);
  doc.line(15, footerY - 5, 195, footerY - 5);

  // Observaciones legales or company text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(BRAND_COLORS.gray[0], BRAND_COLORS.gray[1], BRAND_COLORS.gray[2]);
  
  const legalLegend = settings.companyObservacionesLegales || 
    'El presente remito documenta el traslado de mercaderías. DOCUMENTO NO VÁLIDO COMO FACTURA.';
  doc.text(legalLegend, 15, footerY);

  // Fiscal summary / company details inline
  const cName = settings.companyRazonSocial || 'AL VACÍO';
  const cuit = settings.companyCuit || '20-39494658-4';
  const iva = settings.companyCondicionIva || 'Monotributista';
  doc.text(`${cName} • CUIT: ${cuit} • Condición IVA: ${iva}`, 15, footerY + 4);

  // Page numbering on the right
  doc.text(`Página ${pageNumber} de ${totalPages}`, 195, footerY, { align: 'right' });
}
