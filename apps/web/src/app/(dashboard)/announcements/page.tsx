'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  type: 'activity' | 'system' | 'update' | 'important';
  title: string;
  summary: string;
  content?: string;
  time: string;
  isRead: boolean;
}

const mockAnnouncements: Announcement[] = [
  {
    id: '1',
    type: 'activity',
    title: '新年活动：质押翻倍积分',
    summary: '2024年1月1日至1月31日，质押即可获得双倍积分奖励！',
    time: '2024-01-21 10:00',
    isRead: false,
  },
  {
    id: '2',
    type: 'update',
    title: '策略市场 V2.0 上线',
    summary: '支持社区策略上传、收益分成，更多策略等你发现',
    time: '2024-01-20 14:00',
    isRead: false,
  },
  {
    id: '3',
    type: 'system',
    title: '系统维护通知',
    summary: '2024年1月25日 02:00-04:00 进行系统维护，届时服务将暂停',
    time: '2024-01-19 18:00',
    isRead: true,
  },
  {
    id: '4',
    type: 'important',
    title: '安全提醒：请勿泄露 API Key',
    summary: '请妥善保管您的 API Key，切勿分享给他人',
    time: '2024-01-15 09:00',
    isRead: true,
  },
  {
    id: '5',
    type: 'activity',
    title: '邀请返佣活动升级',
    summary: '邀请返佣比例提升至 15%，赶快邀请好友吧！',
    time: '2024-01-10 12:00',
    isRead: true,
  },
];

type FilterType = 'all' | 'activity' | 'system' | 'update';

const typeConfig = {
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
};

export default function AnnouncementsPage() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const filteredAnnouncements = mockAnnouncements.filter((item) => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  const unreadCount = mockAnnouncements.filter((item) => !item.isRead).length;

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
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

      {/* 筛选标签 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
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

      {/* 公告列表 */}
      <div className="space-y-3">
        {filteredAnnouncements.length === 0 ? (
          <Card variant="glass">
            <CardContent className="py-12 text-center">
              <Megaphone className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
              <p className="text-text-secondary">暂无公告</p>
            </CardContent>
          </Card>
        ) : (
          filteredAnnouncements.map((announcement) => {
            const config = typeConfig[announcement.type];
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

      {/* 公告详情弹窗（简化版，可以后续改为独立页面） */}
      {selectedAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <Card
            variant="glass"
            className="w-full max-w-sm sm:max-w-lg max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="border-b border-border-primary/30">
              <div className="flex items-center gap-3">
                {(() => {
                  const config = typeConfig[selectedAnnouncement.type];
                  const Icon = config.icon;
                  return (
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', config.bg)}>
                      <Icon className={cn('w-5 h-5', config.color)} />
                    </div>
                  );
                })()}
                <div>
                  <CardTitle className="text-lg">{selectedAnnouncement.title}</CardTitle>
                  <p className="text-xs text-text-tertiary mt-1">{selectedAnnouncement.time}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="py-6">
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
            </CardContent>
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
          </Card>
        </div>
      )}
    </div>
  );
}
