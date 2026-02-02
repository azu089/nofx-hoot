'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useLocale } from '@/i18n/provider';

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
  image?: string; // 新闻配图
}

// 公告类型（API 返回已翻译的内容）
export interface Announcement {
  id: string;
  title: string;           // 已翻译的标题
  content?: string;        // 已翻译的内容
  type: 'info' | 'warning' | 'success' | 'promo' | string;
  link?: string;
  coverImage?: string;
  createdAt: string;
}

// 跑马灯类型（API 返回已翻译的内容）
export interface MarqueeItem {
  id: string;
  content: string;         // 已翻译的内容
  link?: string;
  bgColor?: string;
  textColor?: string;
}

// 跑马灯配置
export interface MarqueeConfig {
  scrollSpeed: number;      // 滚动速度（像素/秒）
  pauseOnHover: boolean;    // 鼠标悬停时暂停
  displayDuration: number;  // 每条消息显示时长（秒）
}

/**
 * 获取公告标题（直接返回，API 已处理翻译）
 */
export function getAnnouncementTitle(announcement: Announcement, _locale?: string): string {
  return announcement.title;
}

/**
 * 获取公告内容（直接返回，API 已处理翻译）
 */
export function getAnnouncementContent(announcement: Announcement, _locale?: string): string | undefined {
  return announcement.content;
}

// 首页聚合数据类型
export interface HomepageData {
  prices: CoinPrice[];
  news: CryptoNews[];
  announcements: Announcement[];
  marquees: MarqueeItem[];
  marqueeConfig: MarqueeConfig;
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
 * 获取平台公告（包含当前语言）
 */
export function useAnnouncements() {
  const { locale } = useLocale();

  return useQuery({
    queryKey: ['market', 'announcements', locale], // 包含 locale
    queryFn: async () => {
      const response = await api.get<Announcement[]>('/market/announcements');
      return response.data;
    },
    staleTime: 60000, // 1分钟内认为数据新鲜
  });
}

/**
 * 获取首页聚合数据（一次请求获取所有数据）
 * 包含当前语言，语言切换时自动重新获取
 */
export function useHomepageData() {
  const { locale } = useLocale();

  return useQuery({
    queryKey: ['market', 'homepage', locale], // 包含 locale，语言变化时重新获取
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
