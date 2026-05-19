export const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '--';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '--';
  
  return new Intl.NumberFormat('es-AR', { 
    style: 'currency', 
    currency: 'ARS', 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(num).replace('ARS', '$');
}

export const formatNumber = (value: number | string | null | undefined, suffix: string = ''): string => {
  if (value === null || value === undefined || value === '') return '--';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '--';
  
  const formatted = new Intl.NumberFormat('es-AR', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 2 
  }).format(num);
  return `${formatted}${suffix ? ` ${suffix}` : ''}`;
}

export const parseNumber = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;
  const parsed = parseFloat(value.replace(',', '.'));
  return isNaN(parsed) ? 0 : parsed;
}
