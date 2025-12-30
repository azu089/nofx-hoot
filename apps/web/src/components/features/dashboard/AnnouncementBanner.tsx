'use client';

import { useState, useEffect } from 'react';
import { Volume2, X, ChevronRight } from 'lucide-react';

interface Announcement {
  id: string;
  content: string;
  type: 'info' | 'warning' | 'success';
  link?: string;
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
    link: '/strategies',
  },
];

export function AnnouncementBanner({
  announcements = defaultAnnouncements,
}: AnnouncementBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (announcements.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [announcements.length, isPaused]);

  if (!isVisible || announcements.length === 0) return null;

  const current = announcements[currentIndex];

  const typeStyles = {
    info: 'bg-primary-500/10 border-primary-500/20 text-primary-400',
    warning: 'bg-warning/10 border-warning/20 text-warning',
    success: 'bg-success-500/10 border-success-500/20 text-success-400',
  };

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 rounded-lg border ${typeStyles[current.type]}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Volume2 className="w-4 h-4 flex-shrink-0" />
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="text-sm truncate">{current.content}</span>
          {current.link && (
            <a
              href={current.link}
              className="flex items-center gap-1 text-xs opacity-80 hover:opacity-100 flex-shrink-0"
            >
              查看详情
              <ChevronRight className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
        {announcements.length > 1 && (
          <div className="flex gap-1">
            {announcements.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentIndex ? 'bg-current' : 'bg-current/30'
                }`}
              />
            ))}
          </div>
        )}
        <button
          onClick={() => setIsVisible(false)}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
