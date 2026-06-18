import { useEffect, useMemo } from 'react';
import { useCajaStore } from '../../store/cajaStore';
import { useFinancialAccountsStore } from '../../store/financialAccountsStore';
import type { FinancialAccount } from '../../types/domain';

// Helper: classify a movement without accountId using heuristic text parsing
function isBancoMovement(description: string, category: string): boolean {
  const desc = description.toLowerCase();
  const cat = category.toLowerCase();
  return (
    desc.includes('banco') ||
    desc.includes('transferencia') ||
    desc.includes('transf') ||
    desc.includes('deposito') ||
    desc.includes('depósito') ||
    desc.includes('cheque') ||
    cat.includes('banco') ||
    cat.includes('transferencia')
  );
}

export type AccountBalance = {
  account: FinancialAccount;
  balance: number;
};

export function useCaja() {
  const movements = useCajaStore((state) => state.movements);
  const loading = useCajaStore((state) => state.loading);
  const subscribeMovements = useCajaStore((state) => state.subscribeMovements);
  const addMovement = useCajaStore((state) => state.addMovement);
  const annulMovement = useCajaStore((state) => state.annulMovement);
  const { accounts, fetchAccounts } = useFinancialAccountsStore();

  useEffect(() => {
    const unsubscribe = subscribeMovements();
    return () => unsubscribe();
  }, [subscribeMovements]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // --- SALDOS POR CUENTA INDIVIDUAL ---
  const accountBalances = useMemo((): AccountBalance[] => {
    if (!accounts.length) return [];

    const balanceMap = new Map<string, number>();
    accounts.forEach(a => balanceMap.set(a.id, 0));

    // Fallback accounts for legacy movements without accountId
    const cashFallback = accounts.find(a => a.tipo === 'EFECTIVO' && a.activa) || accounts.find(a => a.tipo === 'EFECTIVO');
    const bankFallback = accounts.find(a => (a.tipo === 'BANCO' || a.tipo === 'BILLETERA_VIRTUAL') && a.activa) || accounts.find(a => a.tipo === 'BANCO' || a.tipo === 'BILLETERA_VIRTUAL');

    movements.forEach(mov => {
      let resolvedId = mov.accountId;
      if (!resolvedId) {
        // Heuristic fallback for legacy movements
        const isBanco = isBancoMovement(mov.description || '', mov.category || '');
        resolvedId = isBanco ? bankFallback?.id : cashFallback?.id;
      }
      if (resolvedId && balanceMap.has(resolvedId)) {
        const delta = mov.type === 'INCOME' ? mov.amount : -mov.amount;
        balanceMap.set(resolvedId, (balanceMap.get(resolvedId) || 0) + delta);
      }
    });

    return accounts.map(a => ({
      account: a,
      balance: balanceMap.get(a.id) || 0
    }));
  }, [movements, accounts]);

  // --- SALDO TOTAL EFECTIVO ---
  const totalEfectivo = useMemo(() => {
    return accountBalances
      .filter(ab => ab.account.tipo === 'EFECTIVO')
      .reduce((acc, ab) => acc + ab.balance, 0);
  }, [accountBalances]);

  // --- SALDO TOTAL BANCOS ---
  const totalBancos = useMemo(() => {
    return accountBalances
      .filter(ab => ab.account.tipo === 'BANCO' || ab.account.tipo === 'BILLETERA_VIRTUAL')
      .reduce((acc, ab) => acc + ab.balance, 0);
  }, [accountBalances]);

  // --- SALDO GENERAL ---
  const currentBalance = useMemo(() => totalEfectivo + totalBancos, [totalEfectivo, totalBancos]);

  // --- ESTADÍSTICAS DEL DÍA Y MES ---
  const { ingresosHoy, egresosHoy, ingresosMes, egresosMes } = useMemo(() => {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    const movementsToday = movements.filter(m => m.date >= startOfDay);
    const movementsThisMonth = movements.filter(m => m.date >= startOfMonth);

    return {
      ingresosHoy: movementsToday.filter(m => m.type === 'INCOME').reduce((acc, m) => acc + m.amount, 0),
      egresosHoy: movementsToday.filter(m => m.type === 'EXPENSE').reduce((acc, m) => acc + m.amount, 0),
      ingresosMes: movementsThisMonth.filter(m => m.type === 'INCOME').reduce((acc, m) => acc + m.amount, 0),
      egresosMes: movementsThisMonth.filter(m => m.type === 'EXPENSE').reduce((acc, m) => acc + m.amount, 0)
    };
  }, [movements]);

  // --- MOVIMIENTOS CON CUENTA RESUELTA ---
  const resolvedMovements = useMemo(() => {
    if (!accounts.length) return movements.map(m => ({ ...m, resolvedAccountId: m.accountId || '' }));

    const cashFallback = accounts.find(a => a.tipo === 'EFECTIVO' && a.activa) || accounts.find(a => a.tipo === 'EFECTIVO');
    const bankFallback = accounts.find(a => (a.tipo === 'BANCO' || a.tipo === 'BILLETERA_VIRTUAL') && a.activa) || accounts.find(a => a.tipo === 'BANCO' || a.tipo === 'BILLETERA_VIRTUAL');

    return movements.map(mov => {
      let resolvedAccountId = mov.accountId;
      if (!resolvedAccountId) {
        const isBanco = isBancoMovement(mov.description || '', mov.category || '');
        resolvedAccountId = isBanco ? (bankFallback?.id || '') : (cashFallback?.id || '');
      }
      return { ...mov, resolvedAccountId };
    });
  }, [movements, accounts]);

  return {
    movements,
    resolvedMovements,
    accounts,
    loading,
    addMovement,
    annulMovement,
    currentBalance,
    totalEfectivo,
    totalBancos,
    accountBalances,
    ingresosHoy,
    egresosHoy,
    ingresosMes,
    egresosMes
  };
}
