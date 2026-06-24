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
  const updateMovement = useCajaStore((state) => state.updateMovement);
  const deleteMovementFisico = useCajaStore((state) => state.deleteMovementFisico);
  const { accounts, fetchAccounts } = useFinancialAccountsStore();

  const transferFunds = async (fromAccountId: string, toAccountId: string, amount: number, description: string) => {
    const fromAccount = accounts.find(a => a.id === fromAccountId);
    const toAccount = accounts.find(a => a.id === toAccountId);
    if (!fromAccount || !toAccount) return;

    const baseDescription = description || 'Transferencia entre cuentas';

    await addMovement({
      type: 'EXPENSE',
      amount,
      category: 'TRANSFERENCIA',
      description: `${baseDescription} (a ${toAccount.nombre})`,
      accountId: fromAccountId
    });

    await addMovement({
      type: 'INCOME',
      amount,
      category: 'TRANSFERENCIA',
      description: `${baseDescription} (de ${fromAccount.nombre})`,
      accountId: toAccountId
    });
  };

  useEffect(() => {
    const unsubscribe = subscribeMovements();
    return () => unsubscribe();
  }, [subscribeMovements]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const activeAccounts = useMemo(() => accounts.filter(a => a.activa), [accounts]);

  const activeMovements = useMemo(() => {
    return movements.filter(mov => {
      if (!mov.accountId) return true;
      return activeAccounts.some(a => a.id === mov.accountId);
    });
  }, [movements, activeAccounts]);

  // --- SALDOS POR CUENTA INDIVIDUAL ---
  const accountBalances = useMemo((): AccountBalance[] => {
    if (!activeAccounts.length) return [];

    const balanceMap = new Map<string, number>();
    activeAccounts.forEach(a => balanceMap.set(a.id, 0));

    // Fallback accounts for legacy movements without accountId
    const cashFallback = activeAccounts.find(a => a.tipo === 'EFECTIVO');
    const bankFallback = activeAccounts.find(a => a.tipo === 'BANCO' || a.tipo === 'BILLETERA_VIRTUAL');

    activeMovements.forEach(mov => {
      let resolvedId = mov.accountId;
      if (!resolvedId) {
        // Heuristic fallback for legacy movements
        const isBanco = isBancoMovement(mov.description || '', mov.category || '');
        resolvedId = isBanco ? bankFallback?.id : cashFallback?.id;
      }
      if (resolvedId && balanceMap.has(resolvedId)) {
        const amount = Number(mov.amount) || 0;
        const delta = mov.type === 'INCOME' ? amount : -amount;
        balanceMap.set(resolvedId, (balanceMap.get(resolvedId) || 0) + delta);
      }
    });

    return activeAccounts.map(a => ({
      account: a,
      balance: balanceMap.get(a.id) || 0
    }));
  }, [activeMovements, activeAccounts]);

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

    const movementsToday = activeMovements.filter(m => m.date >= startOfDay);
    const movementsThisMonth = activeMovements.filter(m => m.date >= startOfMonth);

    return {
      ingresosHoy: movementsToday.filter(m => m.type === 'INCOME').reduce((acc, m) => acc + (Number(m.amount) || 0), 0),
      egresosHoy: movementsToday.filter(m => m.type === 'EXPENSE').reduce((acc, m) => acc + (Number(m.amount) || 0), 0),
      ingresosMes: movementsThisMonth.filter(m => m.type === 'INCOME').reduce((acc, m) => acc + (Number(m.amount) || 0), 0),
      egresosMes: movementsThisMonth.filter(m => m.type === 'EXPENSE').reduce((acc, m) => acc + (Number(m.amount) || 0), 0)
    };
  }, [activeMovements]);

  // --- MOVIMIENTOS CON CUENTA RESUELTA ---
  const resolvedMovements = useMemo(() => {
    if (!activeAccounts.length) return activeMovements.map(m => ({ ...m, resolvedAccountId: m.accountId || '' }));

    const cashFallback = activeAccounts.find(a => a.tipo === 'EFECTIVO');
    const bankFallback = activeAccounts.find(a => a.tipo === 'BANCO' || a.tipo === 'BILLETERA_VIRTUAL');

    return activeMovements.map(mov => {
      let resolvedAccountId = mov.accountId;
      if (!resolvedAccountId) {
        const isBanco = isBancoMovement(mov.description || '', mov.category || '');
        resolvedAccountId = isBanco ? (bankFallback?.id || '') : (cashFallback?.id || '');
      }
      return { ...mov, resolvedAccountId };
    });
  }, [activeMovements, activeAccounts]);

  return {
    movements: activeMovements,
    resolvedMovements,
    accounts: activeAccounts,
    loading,
    addMovement,
    annulMovement,
    updateMovement,
    deleteMovementFisico,
    transferFunds,
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
