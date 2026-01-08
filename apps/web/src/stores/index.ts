/**
 * 统一导出所有 Store
 */

export { useAuthStore } from './auth.store';
export { useWalletStore } from './wallet.store';
export { useTradingStore } from './trading.store';
export { useEcosystemStore } from './ecosystem.store';
export { useUiStore } from './ui.store';

// 向后兼容导出（保留 useGameFiStore）
export { useEcosystemStore as useGameFiStore } from './ecosystem.store';
