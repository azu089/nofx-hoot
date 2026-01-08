/**
 * 统一导出所有类型定义
 */

export * from './api';

// 前端状态类型
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface WalletState {
  balance: WalletBalance | null;
  transactions: Transaction[];
  isLoading: boolean;
}

export interface TradingState {
  activeInstance: TradingInstance | null;
  trades: Trade[];
  isRunning: boolean;
}

export interface GameFiState {
  stakingRecords: StakingRecord[];
  pointsBalance: string;
  totalStaked: string;
}

// UI 状态类型
export interface UiState {
  theme: 'dark' | 'light';
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
}

// 导入需要重新导出的类型
import type {
  User,
  WalletBalance,
  Transaction,
  TradingInstance,
  Trade,
  StakingRecord,
} from './api';
