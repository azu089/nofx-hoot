'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// 币种价格类型
export interface CoinPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d?: number;
  marketCap?: number;
  volume24h?: number;
  image?: string;
}

// 新闻类型
export interface CryptoNews {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  tags?: string[];
}

// 公告类型
export interface Announcement {
  id: string;
  title: string;
  content?: string;
  type: 'info' | 'warning' | 'success' | 'promo';
  link?: string;
  createdAt: string;
}

// 首页聚合数据类型
export interface HomepageData {
  prices: CoinPrice[];
  news: CryptoNews[];
  announcements: Announcement[];
}

/**
 * 获取市场价格数据
 */
export function useMarketPrices() {
  return useQuery({
    queryKey: ['market', 'prices'],
    queryFn: async () => {
      const response = await api.get<CoinPrice[]>('/market/prices');
      return response.data;
    },
    refetchInterval: 30000, // 30秒刷新一次
    staleTime: 15000, // 15秒内认为数据新鲜
  });
}

/**
 * 获取行业新闻
 */
export function useMarketNews(limit = 10) {
  return useQuery({
    queryKey: ['market', 'news', limit],
    queryFn: async () => {
      const response = await api.get<CryptoNews[]>(`/market/news?limit=${limit}`);
      return response.data;
    },
    refetchInterval: 5 * 60 * 1000, // 5分钟刷新一次
    staleTime: 60000, // 1分钟内认为数据新鲜
  });
}

/**
 * 获取平台公告
 */
export function useAnnouncements() {
  return useQuery({
    queryKey: ['market', 'announcements'],
    queryFn: async () => {
      const response = await api.get<Announcement[]>('/market/announcements');
      return response.data;
    },
    staleTime: 60000, // 1分钟内认为数据新鲜
  });
}

/**
 * 获取首页聚合数据（一次请求获取所有数据）
 */
export function useHomepageData() {
  return useQuery({
    queryKey: ['market', 'homepage'],
    queryFn: async () => {
      const response = await api.get<HomepageData>('/market/homepage');
      return response.data;
    },
    refetchInterval: 30000, // 30秒刷新一次
    staleTime: 15000,
  });
}

/**
 * 格式化价格显示
 */
export function formatPrice(price: number): string {
  if (price >= 10000) {
    return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  } else if (price >= 1) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } else {
    return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  }
}

/**
 * 格式化涨跌幅
 */
export function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

/**
 * 格式化时间
 */
export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString('zh-CN');
}
