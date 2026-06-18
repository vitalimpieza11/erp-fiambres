import { create } from 'zustand';
import { financialAccountsRepository } from '../repositories/caja/financialAccountsRepository';
import type { FinancialAccount } from '../types/domain';

interface FinancialAccountsState {
  accounts: FinancialAccount[];
  loading: boolean;
  fetchAccounts: () => Promise<void>;
  saveAccount: (account: Partial<FinancialAccount>) => Promise<void>;
  toggleAccountStatus: (id: string, currentStatus: boolean) => Promise<void>;
}

export const useFinancialAccountsStore = create<FinancialAccountsState>((set, get) => ({
  accounts: [],
  loading: true,
  fetchAccounts: async () => {
    set({ loading: true });
    try {
      let data = await financialAccountsRepository.fetchAccounts();
      
      // Auto-seeding if empty
      if (data.length === 0) {
        console.log("No financial accounts found. Seeding default accounts...");
        const defaultCashId = await financialAccountsRepository.saveAccount({
          nombre: "Caja Principal",
          tipo: "EFECTIVO",
          activa: true
        });
        const defaultBankId = await financialAccountsRepository.saveAccount({
          nombre: "Banco Galicia",
          tipo: "BANCO",
          activa: true
        });
        console.log(`Seeded default accounts: ${defaultCashId}, ${defaultBankId}`);
        data = await financialAccountsRepository.fetchAccounts();
      }

      set({ accounts: data });
    } catch (error) {
      console.error("Error fetching financial accounts:", error);
    } finally {
      set({ loading: false });
    }
  },
  saveAccount: async (account) => {
    set({ loading: true });
    try {
      await financialAccountsRepository.saveAccount(account);
      const data = await financialAccountsRepository.fetchAccounts();
      set({ accounts: data });
    } catch (error) {
      console.error("Error saving financial account:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  },
  toggleAccountStatus: async (id, currentStatus) => {
    // Optimistic update: we don't set loading: true to avoid full screen spinner
    try {
      await financialAccountsRepository.toggleAccountStatus(id, currentStatus);
      const data = await financialAccountsRepository.fetchAccounts();
      set({ accounts: data });
    } catch (error) {
      console.error("Error toggling financial account status:", error);
      throw error;
    } finally {
      set({ loading: false });
    }
  }
}));
