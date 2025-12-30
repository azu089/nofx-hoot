'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { publicApi } from '@/lib/api';

interface BannerData {
  id: string;
  position: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  link_target: string;
  button_text: string | null;
}

interface DynamicBannerProps {
  position: string;
  fallback?: React.ReactNode;
}

/**
 * 动态 Banner 组件
 * 从 CMS 获取指定位置的 Banner 内容
 */
export function DynamicBanner({ position, fallback }: DynamicBannerProps) {
  const { data: bannersRes, isLoading } = useQuery({
    queryKey: ['cms', 'banners', position],
    queryFn: () => publicApi.getBanners(position),
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
  });

  const banners = bannersRes?.data || [];

  // 加载中或无数据时显示 fallback
  if (isLoading || banners.length === 0) {
    return fallback || null;
  }

  // 只展示第一个 Banner（可扩展为轮播）
  const banner = banners[0];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-primary/20 to-brand-primary/20 border border-brand-primary/20">
      {/* 背景图 */}
      {banner.image_url && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${banner.image_url})` }}
        />
      )}

      <div className="relative z-10 p-8 md:p-12">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
          {banner.title}
        </h2>
        {banner.subtitle && (
          <p className="text-lg text-text-primary mb-6 max-w-2xl">
            {banner.subtitle}
          </p>
        )}
        {banner.link_url && banner.button_text && (
          <Link
            href={banner.link_url}
            target={banner.link_target}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary hover:bg-brand-secondary rounded-lg font-semibold transition-colors"
          >
            {banner.button_text}
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * 动态公告 Banner（顶部通知条）
 */
export function AnnouncementBanner() {
  const { data: bannersRes } = useQuery({
    queryKey: ['cms', 'banners', 'announcement'],
    queryFn: () => publicApi.getBanners('announcement'),
    staleTime: 5 * 60 * 1000,
  });

  const banners = bannersRes?.data || [];

  if (banners.length === 0) return null;

  const banner = banners[0];

  return (
    <div className="bg-gradient-to-r from-brand-primary to-brand-primary text-white py-2 px-4 text-center text-sm">
      <span>{banner.title}</span>
      {banner.link_url && (
        <Link
          href={banner.link_url}
          target={banner.link_target}
          className="ml-2 underline hover:no-underline"
        >
          {banner.button_text || '了解更多'}
        </Link>
      )}
    </div>
  );
}

export default DynamicBanner;
