export const formatCurrency = (val: number): string => 
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

export const formatDate = (dateStr: any): string => {
  if (!dateStr) return 'S/D';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 'S/D' : d.toLocaleDateString();
};

export const formatTime = (dateStr: any): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};
