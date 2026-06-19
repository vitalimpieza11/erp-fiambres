import { create } from 'zustand';
import type { PeriodType } from '../utils/dateRangeUtils';
import { getPeriodRange, getComparisonRange, formatDateToString } from '../utils/dateRangeUtils';

interface PeriodFilterState {
  selectedPeriod: PeriodType;
  customRange: { startDate: string; endDate: string };
  setPeriod: (period: PeriodType) => void;
  setCustomRange: (range: { startDate: string; endDate: string }) => void;
  getRanges: () => {
    current: { startDate: Date; endDate: Date };
    comparison: { startDate: Date; endDate: Date };
  };
}

export const usePeriodFilterStore = create<PeriodFilterState>((set, get) => {
  const todayStr = formatDateToString(new Date());
  return {
    selectedPeriod: 'ESTE_MES',
    customRange: {
      startDate: todayStr,
      endDate: todayStr,
    },
    setPeriod: (period) => set({ selectedPeriod: period }),
    setCustomRange: (range) => set({ customRange: range }),
    getRanges: () => {
      const state = get();
      const current = getPeriodRange(state.selectedPeriod, state.customRange);
      const comparison = getComparisonRange(state.selectedPeriod, current);
      return { current, comparison };
    },
  };
});
