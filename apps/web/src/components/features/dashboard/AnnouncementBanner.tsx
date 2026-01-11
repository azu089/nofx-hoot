'use client';

import { Volume2 } from 'lucide-react';

interface Announcement {
  id: string;
  content: string;
  type: 'info' | 'warning' | 'success';
}

export interface AnnouncementBannerProps {
  announcements?: Announcement[];
}

// 默认公告（后续可从 API 获取）
const defaultAnnouncements: Announcement[] = [
  {
    id: '1',
    content: '欢迎使用 QuantFi 量化交易平台，新用户注册即送 100 积分！',
    type: 'success',
  },
  {
    id: '2',
    content: '系统将于本周六 02:00-04:00 进行维护升级，届时服务可能短暂中断',
    type: 'warning',
  },
  {
    id: '3',
    content: 'RSI 反转策略本月收益率达 18.5%，立即查看',
    type: 'info',
  },
];

export function AnnouncementBanner({
  announcements = defaultAnnouncements,
}: AnnouncementBannerProps) {
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
