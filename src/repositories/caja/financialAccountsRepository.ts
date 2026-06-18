import { getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db, COLLECTIONS } from '../../lib/firebase';
import type { FinancialAccount } from '../../types/domain';

export const financialAccountsRepository = {
  async fetchAccounts(): Promise<FinancialAccount[]> {
    const snapshot = await getDocs(COLLECTIONS.FINANCIAL_ACCOUNTS);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FinancialAccount));
  },

  async saveAccount(account: Partial<FinancialAccount>): Promise<string> {
    const dataToSave = {
      ...account,
      activa: account.activa !== false,
      updatedAt: Date.now()
    };

    if (account.id) {
      await updateDoc(doc(db, 'financial_accounts', account.id), dataToSave);
      return account.id;
    } else {
      const docRef = await addDoc(COLLECTIONS.FINANCIAL_ACCOUNTS, {
        ...dataToSave,
        createdAt: Date.now()
      });
      return docRef.id;
    }
  },

  async toggleAccountStatus(id: string, currentStatus: boolean): Promise<void> {
    await updateDoc(doc(db, 'financial_accounts', id), {
      activa: !currentStatus,
      updatedAt: Date.now()
    });
  }
};
