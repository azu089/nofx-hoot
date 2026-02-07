'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useLocale } from '@/i18n/provider';

// 策略类型
export interface Strategy {
  id: string;
  name: string;
  description: string;
  freqtradeId: string;
  isActive: boolean;
  createdAt: string;
  subscriberCount: number;
  imageUrl?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  tags?: string[];
  return7d?: string;
  return30d?: string;
  return90d?: string;
  maxDrawdown?: string;
  winRate?: string;
  totalTrades?: number;
  isFeatured?: boolean;
}

/**
 * 获取所有策略
 */
export function useStrategies() {
  const { locale } = useLocale();
  return useQuery({
    queryKey: ['strategies', locale],
    queryFn: async () => {
      const response = await api.get<Strategy[]>('/strategies');
      return response.data;
    },
    staleTime: 60000, // 1分钟内认为数据新鲜
  });
}

/**
 * 获取首页推荐策略
 */
export function useFeaturedStrategies() {
  const { locale } = useLocale();
  return useQuery({
    queryKey: ['strategies', 'featured', locale],
    queryFn: async () => {
      const response = await api.get<Strategy[]>('/strategies/featured');
      return response.data;
    },
    staleTime: 60000,
  });
}

/**
 * 获取策略详情
 */
export function useStrategy(id: string) {
  const { locale } = useLocale();
  return useQuery({
    queryKey: ['strategies', id, locale],
    queryFn: async () => {
      const response = await api.get<Strategy>(`/strategies/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

/**
 * 格式化收益率
 */
export function formatReturn(value?: string): string {
  if (!value) return '--';
  const num = parseFloat(value);
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(1)}%`;
}

/**
 * 获取风险等级显示
 */
export function getRiskDisplay(level?: string): { label: string; color: string } {
  switch (level) {
    case 'low':
      return { label: '低', color: 'text-green-400' };
    case 'medium':
      return { label: '中', color: 'text-yellow-400' };
    case 'high':
      return { label: '高', color: 'text-red-400' };
    default:
      return { label: '中', color: 'text-yellow-400' };
  }
}
