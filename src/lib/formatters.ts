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

export function truncateDecimals(val: number, decimals: number): number {
  if (!val || isNaN(val)) return 0;
  
  // Handle scientific notation for very small numbers (e.g. 1.2e-7)
  const str = val.toString();
  if (str.toLowerCase().includes('e')) {
    if (val < 1 && val > -1) return 0;
    return val;
  }
  
  const dotIdx = str.indexOf('.');
  if (dotIdx === -1) return val;
  const truncatedStr = str.substring(0, dotIdx + decimals + 1);
  return Number(truncatedStr);
}
