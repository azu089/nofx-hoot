/**
 * 代理商后台 - 公共样式常量
 */
import type { CSSProperties } from 'react';

// 深色主题基础色板
export const colors = {
  // 背景色
  bgPrimary: '#0a0a0f',
  bgSecondary: '#12121a',
  bgTertiary: '#1a1a24',

  // 边框
  border: '#1e1e2e',

  // 品牌色
  primary: '#06b6d4',

  // 语义色
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  purple: '#8b5cf6',
  blue: '#3b82f6',
  pink: '#ec4899',

  // 文字
  textPrimary: '#fff',
  textSecondary: '#94a3b8',
  textTertiary: '#64748b',
} as const;

// 卡片基础样式
export const cardStyle: CSSProperties = {
  background: colors.bgSecondary,
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
};

export const cardHeadStyle: CSSProperties = {
  background: colors.bgSecondary,
  borderBottom: `1px solid ${colors.border}`,
  color: colors.textPrimary,
};

// 渐变卡片样式
export const gradientStyles = {
  primary: {
    background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    border: 'none',
    borderRadius: 12,
  },
  success: {
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    border: 'none',
    borderRadius: 12,
  },
  warning: {
    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    border: 'none',
    borderRadius: 12,
  },
  purple: {
    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    border: 'none',
    borderRadius: 12,
  },
  blue: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    border: 'none',
    borderRadius: 12,
  },
  pink: {
    background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
    border: 'none',
    borderRadius: 12,
  },
} as const;

// 代理等级配置
export const agentLevelConfig: Record<string, { color: string; label: string; icon: string }> = {
  bronze: { color: '#cd7f32', label: '青铜代理', icon: '🥉' },
  silver: { color: '#c0c0c0', label: '白银代理', icon: '🥈' },
  gold: { color: '#ffd700', label: '黄金代理', icon: '🥇' },
  platinum: { color: '#e5e4e2', label: '铂金代理', icon: '💎' },
  diamond: { color: '#b9f2ff', label: '钻石代理', icon: '👑' },
};

// 佣金类型配置
export const commissionTypeConfig: Record<string, { label: string; color: string }> = {
  subscription: { label: '订阅分成', color: 'blue' },
  gas_fee: { label: '燃油费分成', color: 'orange' },
  bonus: { label: '奖励', color: 'purple' },
};

// 状态配置
export const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: '待结算', color: 'gold' },
  settled: { label: '已结算', color: 'green' },
  cancelled: { label: '已取消', color: 'default' },
  processing: { label: '处理中', color: 'blue' },
  completed: { label: '已完成', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' },
};

// API 基础地址（从统一配置导入）
export { API_URL as API_BASE } from '../../../lib/config';
export const WEB_URL = import.meta.env.VITE_WEB_URL || 'https://hoot.ai';
