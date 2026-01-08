import { create } from 'zustand';
import type { TradingInstance, Trade } from '@/types';

interface TradingStore {
  // 状态
  activeInstance: TradingInstance | null;
  trades: Trade[];
  isRunning: boolean;
  logs: Array<{
    id: string;
    level: 'info' | 'warn' | 'error';
    message: string;
    timestamp: string;
  }>;
  isLoading: boolean;
  error: string | null;

  // 操作
  setActiveInstance: (instance: TradingInstance | null) => void;
  setTrades: (trades: Trade[]) => void;
  addTrade: (trade: Trade) => void;
  setRunning: (isRunning: boolean) => void;
  addLog: (log: {
    level: 'info' | 'warn' | 'error';
    message: string;
    timestamp: string;
  }) => void;
  clearLogs: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  activeInstance: null,
  trades: [],
  isRunning: false,
  logs: [],
  isLoading: false,
  error: null,
};

export const useTradingStore = create<TradingStore>((set, get) => ({
  ...initialState,

  setActiveInstance: (instance) => set({ activeInstance: instance }),

  setTrades: (trades) => set({ trades }),

  addTrade: (trade) => set({ trades: [trade, ...get().trades] }),

  setRunning: (isRunning) => set({ isRunning }),

  addLog: (log) => {
    const newLog = {
      id: `${Date.now()}-${Math.random()}`,
      ...log,
    };
    // 保留最近 500 条日志
    const logs = [newLog, ...get().logs].slice(0, 500);
    set({ logs });
  },

  clearLogs: () => set({ logs: [] }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
