import React, { createContext, useContext, useState, type ReactNode } from 'react';

export type ViewType = 'day' | 'month' | 'year' | 'all';

interface DateFilterContextType {
  selectedYear: number;
  selectedMonth: number; // 0-11
  selectedDay: number; // 1-31
  viewType: ViewType;
  setSelectedYear: (year: number) => void;
  setSelectedMonth: (month: number) => void;
  setSelectedDay: (day: number) => void;
  setViewType: (type: ViewType) => void;
  handlePrev: () => void;
  handleNext: () => void;
  getRange: () => { start: number; end: number };
  filterDate: (date: number | string | Date | undefined) => boolean;
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined);

export const DateFilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(now.getDate());
  const [viewType, setViewType] = useState<ViewType>('month'); // default to monthly management

  const handlePrev = () => {
    if (viewType === 'day') {
      const d = new Date(selectedYear, selectedMonth, selectedDay - 1);
      setSelectedYear(d.getFullYear());
      setSelectedMonth(d.getMonth());
      setSelectedDay(d.getDate());
    } else if (viewType === 'month') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear((y) => y - 1);
      } else {
        setSelectedMonth((m) => m - 1);
      }
    } else if (viewType === 'year') {
      setSelectedYear((y) => y - 1);
    }
  };

  const handleNext = () => {
    if (viewType === 'day') {
      const d = new Date(selectedYear, selectedMonth, selectedDay + 1);
      setSelectedYear(d.getFullYear());
      setSelectedMonth(d.getMonth());
      setSelectedDay(d.getDate());
    } else if (viewType === 'month') {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear((y) => y + 1);
      } else {
        setSelectedMonth((m) => m + 1);
      }
    } else if (viewType === 'year') {
      setSelectedYear((y) => y + 1);
    }
  };

  const getRange = () => {
    let start = 0;
    let end = Infinity;

    if (viewType === 'day') {
      start = new Date(selectedYear, selectedMonth, selectedDay, 0, 0, 0, 0).getTime();
      end = new Date(selectedYear, selectedMonth, selectedDay, 23, 59, 59, 999).getTime();
    } else if (viewType === 'month') {
      start = new Date(selectedYear, selectedMonth, 1, 0, 0, 0, 0).getTime();
      end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999).getTime();
    } else if (viewType === 'year') {
      start = new Date(selectedYear, 0, 1, 0, 0, 0, 0).getTime();
      end = new Date(selectedYear, 11, 31, 23, 59, 59, 999).getTime();
    }

    return { start, end };
  };

  const filterDate = (date: number | string | Date | undefined): boolean => {
    if (!date) return false;
    let timestamp: number;
    if (typeof date === 'number') {
      timestamp = date;
    } else if (typeof date === 'string') {
      timestamp = new Date(date).getTime();
    } else {
      timestamp = date.getTime();
    }

    if (isNaN(timestamp)) return false;

    const { start, end } = getRange();
    return timestamp >= start && timestamp <= end;
  };

  return (
    <DateFilterContext.Provider
      value={{
        selectedYear,
        selectedMonth,
        selectedDay,
        viewType,
        setSelectedYear,
        setSelectedMonth,
        setSelectedDay,
        setViewType,
        handlePrev,
        handleNext,
        getRange,
        filterDate,
      }}
    >
      {children}
    </DateFilterContext.Provider>
  );
};

export const useDateFilter = () => {
  const context = useContext(DateFilterContext);
  if (!context) {
    throw new Error('useDateFilter must be used within a DateFilterProvider');
  }
  return context;
};
