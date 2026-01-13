'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, Button, MobileHeader } from '@/components/ui';
import {
  Megaphone,
  Bell,
  Gift,
  AlertTriangle,
  Info,
  ChevronRight,
  Clock,
  Check,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { userApi } from '@/lib/api';

/**
 * 公告中心页面
 *
 * 功能：
 * - 平台公告列表
 * - 公告分类（全部、活动、系统、更新）
 * - 公告详情展示
 */

interface Announcement {
  id: string;
  type: 'activity' | 'system' | 'update' | 'important' | 'info' | 'warning' | 'success';
  title: string;
  summary: string;
  content?: string;
  time: string;
  isRead: boolean;
}

type FilterType = 'all' | 'activity' | 'system' | 'update';

const typeConfig: Record<string, { icon: typeof Gift; color: string; bg: string; label: string }> = {
  activity: {
    icon: Gift,
    color: 'text-success',
    bg: 'bg-success/10',
    label: '活动',
  },
  system: {
    icon: Info,
    color: 'text-brand-primary',
    bg: 'bg-brand-primary/10',
    label: '系统',
  },
  update: {
    icon: Bell,
    color: 'text-warning',
    bg: 'bg-warning/10',
    label: '更新',
  },
  important: {
    icon: AlertTriangle,
    color: 'text-danger',
    bg: 'bg-danger/10',
    label: '重要',
  },
  // 兼容 API 返回的类型
  info: {
    icon: Info,
    color: 'text-brand-primary',
    bg: 'bg-brand-primary/10',
    label: '通知',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-warning',
    bg: 'bg-warning/10',
    label: '警告',
  },
  success: {
    icon: Gift,
    color: 'text-success',
    bg: 'bg-success/10',
    label: '喜讯',
  },
};

export default function AnnouncementsPage() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  // 获取公告数据
  const { data: announcementsRes, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => userApi.getAnnouncements(),
  });

  // 映射 API 数据到组件需要的格式
  const announcements: Announcement[] = (announcementsRes?.data || []).map((item) => ({
    id: item.id,
    type: item.type as Announcement['type'],
    title: item.title,
    summary: item.content,
    content: item.content,
    time: item.publishedAt || item.createdAt || '',
    isRead: true, // API 暂无已读状态，默认已读
  }));

  const filteredAnnouncements = announcements.filter((item) => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  const unreadCount = announcements.filter((item) => !item.isRead).length;

  return (
    <div className="space-y-4 lg:space-y-6 pb-20 lg:pb-6">
      <MobileHeader
        title="公告中心"
        subtitle="平台公告、活动通知"
        rightAction={
          unreadCount > 0 ? (
            <span className="px-3 py-1 text-sm font-medium bg-danger/10 text-danger rounded-full">
              {unreadCount} 条未读
            </span>
          ) : null
        }
      />

      {/* 筛选标签 - 移动端极简风格 */}
      <div className="lg:hidden flex items-center gap-2 overflow-x-auto px-4 pb-2">
        {[
          { key: 'all', label: '全部' },
          { key: 'activity', label: '活动' },
          { key: 'system', label: '系统' },
          { key: 'update', label: '更新' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key as FilterType)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
              filter === item.key
                ? 'bg-brand-primary text-white'
                : 'bg-bg-secondary text-text-secondary'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* 桌面端筛选标签 */}
      <div className="hidden lg:flex items-center gap-2 overflow-x-auto pb-2">
        {[
          { key: 'all', label: '全部' },
          { key: 'activity', label: '活动' },
          { key: 'system', label: '系统' },
          { key: 'update', label: '更新' },
        ].map((item) => (
          <Button
            key={item.key}
            variant={filter === item.key ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setFilter(item.key as FilterType)}
            className={cn(
              'whitespace-nowrap',
              filter === item.key ? '' : 'text-text-secondary'
            )}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {/* 加载状态 */}
      {isLoading && (
        <div className="py-12 text-center">
          <Loader2 className="w-8 h-8 text-brand-primary mx-auto animate-spin" />
          <p className="text-text-secondary mt-2">加载中...</p>
        </div>
      )}

      {/* 公告列表 - 移动端极简风格 */}
      {!isLoading && (
      <div className="lg:hidden">
        {filteredAnnouncements.length === 0 ? (
          <div className="py-12 text-center px-4">
            <Megaphone className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
            <p className="text-text-secondary">暂无公告</p>
          </div>
        ) : (
          filteredAnnouncements.map((announcement, index) => {
            const config = typeConfig[announcement.type] || typeConfig.info;
            const Icon = config.icon;

            return (
              <div
                key={announcement.id}
                className={cn(
                  'px-4 py-4 cursor-pointer transition-colors',
                  index % 2 === 1 ? 'bg-bg-secondary' : '',
                  !announcement.isRead && 'border-l-2 border-l-brand-primary'
                )}
                onClick={() => setSelectedAnnouncement(announcement)}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                    config.bg
                  )}>
                    <Icon className={cn('w-5 h-5', config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        'px-2 py-0.5 text-xs font-medium rounded',
                        config.bg, config.color
                      )}>
                        {config.label}
                      </span>
                      {!announcement.isRead && (
                        <span className="w-2 h-2 rounded-full bg-danger" />
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-text-primary mb-1 truncate">
                      {announcement.title}
                    </h3>
                    <p className="text-xs text-text-tertiary line-clamp-2">
                      {announcement.summary}
                    </p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-text-tertiary">
                      <Clock className="w-3 h-3" />
                      {announcement.time}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-text-tertiary flex-shrink-0 mt-1" />
                </div>
              </div>
            );
          })
        )}
      </div>
      )}

      {/* 桌面端公告列表 */}
      {!isLoading && (
      <div className="hidden lg:block space-y-3">
        {filteredAnnouncements.length === 0 ? (
          <Card variant="glass">
            <CardContent className="py-12 text-center">
              <Megaphone className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
              <p className="text-text-secondary">暂无公告</p>
            </CardContent>
          </Card>
        ) : (
          filteredAnnouncements.map((announcement) => {
            const config = typeConfig[announcement.type] || typeConfig.info;
            const Icon = config.icon;

            return (
              <Card
                key={announcement.id}
                variant="glass"
                className={cn(
                  'cursor-pointer transition-all hover:border-brand-primary/30',
                  !announcement.isRead && 'border-l-2 border-l-brand-primary'
                )}
                onClick={() => setSelectedAnnouncement(announcement)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                      config.bg
                    )}>
                      <Icon className={cn('w-5 h-5', config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'px-2 py-0.5 text-xs font-medium rounded',
                          config.bg, config.color
                        )}>
                          {config.label}
                        </span>
                        {!announcement.isRead && (
                          <span className="w-2 h-2 rounded-full bg-danger" />
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-text-primary mb-1 truncate">
                        {announcement.title}
                      </h3>
                      <p className="text-xs text-text-tertiary line-clamp-2">
                        {announcement.summary}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-text-tertiary">
                        <Clock className="w-3 h-3" />
                        {announcement.time}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      )}

      {/* 公告详情弹窗 - 统一样式 */}
      {selectedAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            className="w-full max-w-sm sm:max-w-lg max-h-[80vh] overflow-y-auto bg-bg-secondary rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="p-4 border-b border-border-primary/30">
              <div className="flex items-center gap-3">
                {(() => {
                  const config = typeConfig[selectedAnnouncement.type] || typeConfig.info;
                  const Icon = config.icon;
                  return (
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', config.bg)}>
                      <Icon className={cn('w-5 h-5', config.color)} />
                    </div>
                  );
                })()}
                <div>
                  <h3 className="text-lg font-bold text-text-primary">{selectedAnnouncement.title}</h3>
                  <p className="text-xs text-text-tertiary mt-1">{selectedAnnouncement.time}</p>
                </div>
              </div>
            </div>

            {/* 弹窗内容 */}
            <div className="p-4">
              <p className="text-text-secondary leading-relaxed">
                {selectedAnnouncement.summary}
              </p>
              {selectedAnnouncement.content && (
                <div className="mt-4 pt-4 border-t border-border-primary/30">
                  <p className="text-text-secondary leading-relaxed">
                    {selectedAnnouncement.content}
                  </p>
                </div>
              )}
            </div>

            {/* 弹窗底部 */}
            <div className="p-4 border-t border-border-primary/30">
              <Button
                variant="primary"
                className="w-full"
                onClick={() => setSelectedAnnouncement(null)}
              >
                <Check className="w-4 h-4 mr-2" />
                我知道了
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
