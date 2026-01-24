'use client';

import { Volume2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Announcement {
  id: string;
  content: string;
  type: 'info' | 'warning' | 'success';
  isPinned?: boolean;
}

export interface AnnouncementBannerProps {
  announcements?: Announcement[];
}

// 默认公告（API 无数据时显示）
const defaultAnnouncements: Announcement[] = [
  {
    id: 'default-1',
    content: '欢迎使用 QuantFi 量化交易平台',
    type: 'info',
  },
];

export function AnnouncementBanner({
  announcements: propAnnouncements,
}: AnnouncementBannerProps) {
  // 从 API 获取公告
  const { data: apiAnnouncements } = useQuery({
    queryKey: ['marquee-announcements'],
    queryFn: async () => {
      const response = await api.get('/configs/announcements');
      return response.data.data as Announcement[];
    },
    staleTime: 60 * 1000, // 1 分钟
    refetchOnWindowFocus: false,
  });

  // 优先使用 props，其次 API 数据，最后默认
  const announcements = propAnnouncements || apiAnnouncements || defaultAnnouncements;

  if (announcements.length === 0) return null;

  // 合并所有公告为一条滚动文本
  const marqueeText = announcements.map((a) => a.content).join('    ·    ');

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-warning/10 border border-warning/20 overflow-hidden">
      <Volume2 className="w-4 h-4 text-warning flex-shrink-0" />
      <div className="flex-1 overflow-hidden relative">
        <div className="animate-marquee whitespace-nowrap">
          <span className="text-sm text-warning">{marqueeText}</span>
          <span className="text-sm text-warning ml-16">{marqueeText}</span>
        </div>
      </div>
    </div>
  );
}
