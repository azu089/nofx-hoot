'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { userApi } from '@/lib/api';
import {
  ArrowLeft,
  Megaphone,
  Gift,
  Info,
  AlertTriangle,
  Bell,
  Clock,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh';

interface Announcement {
  id: string;
  type: 'activity' | 'system' | 'update' | 'important' | 'info' | 'warning' | 'success';
  title: string;
  content: string;
  publishedAt: string;
  isRead: boolean;
}

const typeConfig: Record<string, { icon: typeof Gift; color: string; bg: string; label: string }> = {
  activity: { icon: Gift, color: 'text-success', bg: 'bg-success/10', label: '活动' },
  system: { icon: Info, color: 'text-brand-primary', bg: 'bg-brand-primary/10', label: '系统' },
  update: { icon: Bell, color: 'text-warning', bg: 'bg-warning/10', label: '更新' },
  important: { icon: AlertTriangle, color: 'text-danger', bg: 'bg-danger/10', label: '重要' },
  info: { icon: Info, color: 'text-brand-primary', bg: 'bg-brand-primary/10', label: '通知' },
  warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', label: '警告' },
  success: { icon: Gift, color: 'text-success', bg: 'bg-success/10', label: '喜讯' },
};

export default function TgAnnouncementsPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [filter, setFilter] = useState<'all' | 'activity' | 'system' | 'update'>('all');

  const fetchData = async () => {
    try {
      const res = await userApi.getAnnouncements();
      setAnnouncements((res.data || []).map((item: any) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        content: item.content,
        publishedAt: item.publishedAt || item.createdAt,
        isRead: true,
      })));
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      haptic('impact_light');
      await fetchData();
      haptic('notification_success');
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const filteredAnnouncements = announcements.filter((item) => {
    if (filter === 'all') return true;
    return item.type === filter;
  });

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-bg-tertiary/50 rounded-lg w-32" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 w-16 bg-bg-tertiary/50 rounded-lg" />
          ))}
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 bg-bg-tertiary/50 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="space-y-4 pb-24">
        {/* 顶部 */}
        <button
          onClick={() => { haptic('selection'); router.back(); }}
          className="flex items-center gap-2 text-text-secondary"
        >
          <ArrowLeft size={20} />
          <span className="text-lg font-medium text-white">公告中心</span>
        </button>

        {/* 筛选标签 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { key: 'all', label: '全部' },
            { key: 'activity', label: '活动' },
            { key: 'system', label: '系统' },
            { key: 'update', label: '更新' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => { setFilter(item.key as any); haptic('selection'); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                filter === item.key
                  ? 'bg-brand-primary text-white'
                  : 'bg-bg-secondary text-text-secondary'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 公告列表 */}
        {filteredAnnouncements.length === 0 ? (
          <div className="py-16 text-center">
            <Megaphone className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
            <p className="text-text-secondary">暂无公告</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAnnouncements.map((announcement) => {
              const config = typeConfig[announcement.type] || typeConfig.info;
              const Icon = config.icon;

              return (
                <button
                  key={announcement.id}
                  onClick={() => { setSelectedAnnouncement(announcement); haptic('selection'); }}
                  className="w-full bg-bg-secondary border border-border-primary rounded-xl p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                      <Icon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                      </div>
                      <h3 className="text-sm font-medium text-white mb-1 truncate">
                        {announcement.title}
                      </h3>
                      <p className="text-xs text-text-tertiary line-clamp-2">
                        {announcement.content}
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-text-tertiary">
                        <Clock className="w-3 h-3" />
                        {new Date(announcement.publishedAt).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-tertiary flex-shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 公告详情弹窗 */}
      {selectedAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div
            className="w-full max-h-[80vh] overflow-y-auto bg-bg-secondary rounded-t-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="sticky top-0 bg-bg-secondary p-4 border-b border-border-primary">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(() => {
                    const config = typeConfig[selectedAnnouncement.type] || typeConfig.info;
                    const Icon = config.icon;
                    return (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bg}`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                    );
                  })()}
                  <div>
                    <h3 className="text-white font-bold">{selectedAnnouncement.title}</h3>
                    <p className="text-text-tertiary text-xs mt-0.5">
                      {new Date(selectedAnnouncement.publishedAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedAnnouncement(null); haptic('selection'); }}
                  className="p-1 text-text-secondary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 弹窗内容 */}
            <div className="p-4">
              <p className="text-text-secondary leading-relaxed whitespace-pre-wrap">
                {selectedAnnouncement.content}
              </p>
            </div>

            {/* 弹窗底部 */}
            <div className="p-4 pb-10 border-t border-border-primary">
              <button
                onClick={() => { setSelectedAnnouncement(null); haptic('selection'); }}
                className="w-full py-3 bg-brand-primary text-white font-medium rounded-xl flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
