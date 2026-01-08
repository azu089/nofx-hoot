import { create } from 'zustand';
import type { WalletBalance, Transaction } from '@/types';

interface WalletStore {
  // 状态
  balance: WalletBalance | null;
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;

  // 操作
  setBalance: (balance: WalletBalance | null) => void;
  setTransactions: (transactions: Transaction[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  balance: null,
  transactions: [],
  isLoading: false,
  error: null,
};

export const useWalletStore = create<WalletStore>((set) => ({
  ...initialState,

  setBalance: (balance) => set({ balance }),

  setTransactions: (transactions) => set({ transactions }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
