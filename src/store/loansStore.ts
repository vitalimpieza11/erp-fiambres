import { create } from 'zustand';
import { loansRepository } from '../repositories/socios/loansRepository';
import type { ShareholderLoan } from '../types/domain';

interface LoansState {
  loans: ShareholderLoan[];
  loading: boolean;
  isSubscribed: boolean;
  unsubscribeRef: (() => void) | null;
  subscribeLoans: () => () => void;
  // FASE 5: Registra un préstamo del socio a la empresa (genera INCOME en caja)
  registerLoan: (data: {
    shareholderId: string;
    shareholderName: string;
    amount: number;
    description: string;
    accountId: string;
  }) => Promise<void>;
  registerPayment: (loanId: string, amount: number, description: string, accountId: string) => Promise<void>;
  registerCapitalization: (loanId: string, amount: number, description: string) => Promise<void>;
  annulPayment: (loanId: string, paymentId: string, reason: string) => Promise<void>;
}

export const useLoansStore = create<LoansState>((set, get) => ({
  loans: [],
  loading: true,
  isSubscribed: false,
  unsubscribeRef: null,
  subscribeLoans: () => {
    if (get().isSubscribed) {
      return () => {};
    }

    set({ isSubscribed: true, loading: get().loans.length === 0 });

    const unsub = loansRepository.subscribeLoans((loans) => {
      set({ loans, loading: false });
    });

    set({ unsubscribeRef: unsub });
    return () => {};
  },
  registerLoan: async (data) => {
    await loansRepository.registerLoan(data);
  },
  registerPayment: async (loanId, amount, description, accountId) => {
    await loansRepository.registerPayment(loanId, amount, description, accountId);
  },
  registerCapitalization: async (loanId, amount, description) => {
    await loansRepository.registerCapitalization(loanId, amount, description);
  },
  annulPayment: async (loanId, paymentId, reason) => {
    await loansRepository.annulPayment(loanId, paymentId, reason);
  }
}));

