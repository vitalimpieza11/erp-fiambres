import jsPDF from 'jspdf';

export function createAlvacioPDF(title: string): jsPDF {
  const doc = new jsPDF();
  
  // Brand header
  doc.setFillColor(196, 49, 38); // Red brand color
  doc.rect(0, 0, 210, 8, 'F');

  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.text('ALVACÍO', 105, 25, { align: 'center' });
  
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(title.toUpperCase(), 105, 32, { align: 'center' });

  return doc;
}
