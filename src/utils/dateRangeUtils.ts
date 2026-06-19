export type PeriodType =
  | 'HOY'
  | 'ESTA_SEMANA'
  | 'ESTE_MES'
  | 'MES_ANTERIOR'
  | 'ULTIMOS_3_MESES'
  | 'ULTIMOS_6_MESES'
  | 'ESTE_ANO'
  | 'PERSONALIZADO';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export function getPeriodRange(
  period: PeriodType,
  customRange?: { startDate: string; endDate: string }
): DateRange {
  const now = new Date();
  
  // Helpers to reset time
  const startOfDay = (d: Date) => {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
  };
  const endOfDay = (d: Date) => {
    const r = new Date(d);
    r.setHours(23, 59, 59, 999);
    return r;
  };

  switch (period) {
    case 'HOY': {
      return {
        startDate: startOfDay(now),
        endDate: endOfDay(now),
      };
    }
    case 'ESTA_SEMANA': {
      // Get Monday of current week
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        startDate: startOfDay(monday),
        endDate: endOfDay(sunday),
      };
    }
    case 'ESTE_MES': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        startDate: startOfDay(firstDay),
        endDate: endOfDay(lastDay),
      };
    }
    case 'MES_ANTERIOR': {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: startOfDay(firstDay),
        endDate: endOfDay(lastDay),
      };
    }
    case 'ULTIMOS_3_MESES': {
      // 3 complete calendar months before current month
      // e.g. if June, then March, April, May
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: startOfDay(firstDay),
        endDate: endOfDay(lastDay),
      };
    }
    case 'ULTIMOS_6_MESES': {
      // 6 complete calendar months before current month
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: startOfDay(firstDay),
        endDate: endOfDay(lastDay),
      };
    }
    case 'ESTE_ANO': {
      const firstDay = new Date(now.getFullYear(), 0, 1);
      const lastDay = new Date(now.getFullYear(), 12, 0);
      return {
        startDate: startOfDay(firstDay),
        endDate: endOfDay(lastDay),
      };
    }
    case 'PERSONALIZADO': {
      if (customRange) {
        return {
          startDate: startOfDay(new Date(customRange.startDate + 'T00:00:00')),
          endDate: endOfDay(new Date(customRange.endDate + 'T23:59:59')),
        };
      }
      // Fallback to today
      return {
        startDate: startOfDay(now),
        endDate: endOfDay(now),
      };
    }
    default:
      return {
        startDate: startOfDay(now),
        endDate: endOfDay(now),
      };
  }
}

export function getComparisonRange(
  period: PeriodType,
  currentRange: DateRange
): DateRange {
  const startOfDay = (d: Date) => {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
  };
  const endOfDay = (d: Date) => {
    const r = new Date(d);
    r.setHours(23, 59, 59, 999);
    return r;
  };

  switch (period) {
    case 'HOY': {
      // Compare with Yesterday
      const prev = new Date(currentRange.startDate);
      prev.setDate(prev.getDate() - 1);
      return {
        startDate: startOfDay(prev),
        endDate: endOfDay(prev),
      };
    }
    case 'ESTA_SEMANA': {
      // Compare with previous week
      const prevStart = new Date(currentRange.startDate);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(currentRange.endDate);
      prevEnd.setDate(prevEnd.getDate() - 7);
      return {
        startDate: startOfDay(prevStart),
        endDate: endOfDay(prevEnd),
      };
    }
    case 'ESTE_MES': {
      // Compare with previous month
      const start = currentRange.startDate;
      const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
      const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0);
      return {
        startDate: startOfDay(prevStart),
        endDate: endOfDay(prevEnd),
      };
    }
    case 'MES_ANTERIOR': {
      // Compare with month before that
      const start = currentRange.startDate;
      const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
      const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0);
      return {
        startDate: startOfDay(prevStart),
        endDate: endOfDay(prevEnd),
      };
    }
    case 'ULTIMOS_3_MESES': {
      // 3 complete calendar months before that
      const start = currentRange.startDate;
      const prevStart = new Date(start.getFullYear(), start.getMonth() - 3, 1);
      const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0);
      return {
        startDate: startOfDay(prevStart),
        endDate: endOfDay(prevEnd),
      };
    }
    case 'ULTIMOS_6_MESES': {
      // 6 complete calendar months before that
      const start = currentRange.startDate;
      const prevStart = new Date(start.getFullYear(), start.getMonth() - 6, 1);
      const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0);
      return {
        startDate: startOfDay(prevStart),
        endDate: endOfDay(prevEnd),
      };
    }
    case 'ESTE_ANO': {
      // Compare with previous year
      const start = currentRange.startDate;
      const prevStart = new Date(start.getFullYear() - 1, 0, 1);
      const prevEnd = new Date(start.getFullYear() - 1, 12, 0);
      return {
        startDate: startOfDay(prevStart),
        endDate: endOfDay(prevEnd),
      };
    }
    case 'PERSONALIZADO': {
      // Compare with the equivalent previous duration
      const diffMs = currentRange.endDate.getTime() - currentRange.startDate.getTime();
      const prevEnd = new Date(currentRange.startDate.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - diffMs);
      return {
        startDate: startOfDay(prevStart),
        endDate: endOfDay(prevEnd),
      };
    }
    default: {
      const prev = new Date(currentRange.startDate);
      prev.setDate(prev.getDate() - 1);
      return {
        startDate: startOfDay(prev),
        endDate: endOfDay(prev),
      };
    }
  }
}

// Utility to format date for input/standard YYYY-MM-DD
export function formatDateToString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
