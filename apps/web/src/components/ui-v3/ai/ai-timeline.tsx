'use client';

import { useState, useCallback } from 'react';
import { Loader2, Clock, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useAiTimeline } from '@/hooks/useAi';
import type { TimelineEntry } from '@/types/ai';
import { SoloLogCard } from './timeline-cards/solo-log-card';
import { DebateLogCard } from './timeline-cards/debate-log-card';
import { ResearchLogCard } from './timeline-cards/research-log-card';
import { useTranslations } from '@/i18n/provider';

interface AiTimelineProps {
  filter: 'all' | 'research' | 'solo' | 'debate' | 'grid';
}

export function AiTimeline({ filter }: AiTimelineProps) {
  const t = useTranslations('ai');
  const [page, setPage] = useState(1);
  const [allEntries, setAllEntries] = useState<TimelineEntry[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [actionsOnly, setActionsOnly] = useState(true);

  // 映射 filter → API type 参数
  const typeParam = filter === 'all' ? 'all' : filter;

  const { data, isLoading, error, refetch } = useAiTimeline(page, 10, typeParam, actionsOnly);

  // 当数据到达时，追加到已有列表
  const entries = (() => {
    if (!data) return allEntries;
    if (page === 1) return data.data;
    // 合并新页数据（去重）
    const existingIds = new Set(allEntries.map(getEntryId));
    const newEntries = data.data.filter((e) => !existingIds.has(getEntryId(e)));
    return [...allEntries, ...newEntries];
  })();

  const handleLoadMore = useCallback(() => {
    if (data && data.pagination.page < data.pagination.totalPages) {
      setAllEntries(entries);
      setPage((p) => p + 1);
      setHasMore(true);
    } else {
      setHasMore(false);
    }
  }, [data, entries]);

  // 切换 actionsOnly 时重置分页
  const handleToggleActionsOnly = useCallback(() => {
    setActionsOnly((prev) => !prev);
    setPage(1);
    setAllEntries([]);
    setHasMore(true);
  }, []);

  if (isLoading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#06B6D4]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#606070] gap-3">
        <AlertTriangle className="w-8 h-8 text-[#F43F5E]/50" />
        <div className="text-xs">{t('timeline.loadFailed')}</div>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-5 py-2 bg-[#06B6D4] text-[#F8F8FC] rounded-lg text-xs font-medium hover:bg-[#0891B2] transition-colors"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  const canLoadMore = data && data.pagination.page < data.pagination.totalPages;
  const skippedCount = data?.skippedCount || 0;

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#606070]">
        <Clock className="w-8 h-8 mb-3 text-[#606070]/30" />
        <div className="text-xs">{t('timeline.noLogs')}</div>
        <div className="text-[10px] text-[#606070]/60 mt-1">
          {t('timeline.noLogsDesc')}
        </div>
        {/* 有被过滤的 wait/hold 日志时，提示用户 */}
        {skippedCount > 0 && actionsOnly && (
          <button
            type="button"
            onClick={handleToggleActionsOnly}
            className="mt-4 flex items-center gap-1 px-4 py-2 rounded-lg bg-[#1A1A24]/60 border border-[#2A2A3A]/50 text-[11px] text-[#06B6D4] hover:text-[#0891B2] transition-colors"
          >
            <Eye className="w-3 h-3" />
            {t('timeline.skippedWaitHold', { count: skippedCount })} · {t('timeline.showAllLogs')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 过滤摘要 + 切换按钮 */}
      {skippedCount > 0 && actionsOnly && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#1A1A24]/60 border border-[#2A2A3A]/50">
          <span className="text-[11px] text-[#808090]">
            {t('timeline.skippedWaitHold', { count: skippedCount })}
          </span>
          <button
            type="button"
            onClick={handleToggleActionsOnly}
            className="flex items-center gap-1 text-[11px] text-[#06B6D4] hover:text-[#0891B2] transition-colors"
          >
            <Eye className="w-3 h-3" />
            {t('timeline.showAllLogs')}
          </button>
        </div>
      )}

      {!actionsOnly && (
        <div className="flex justify-end px-1">
          <button
            type="button"
            onClick={handleToggleActionsOnly}
            className="flex items-center gap-1 text-[11px] text-[#06B6D4] hover:text-[#0891B2] transition-colors"
          >
            <EyeOff className="w-3 h-3" />
            {t('timeline.showActionsOnly')}
          </button>
        </div>
      )}

      {entries.map((entry, idx) => (
        <TimelineEntryCard key={`${getEntryId(entry)}-${idx}`} entry={entry} />
      ))}

      {/* 加载更多 */}
      {canLoadMore && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={isLoading}
          className="w-full py-3 text-xs text-[#06B6D4] hover:text-[#0891B2] glass-border-glow glass-card hover:border-[#06B6D4]/30 transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t('common.loading')}
            </>
          ) : (
            t('timeline.loadMore')
          )}
        </button>
      )}

      {!canLoadMore && entries.length > 0 && (
        <div className="text-center text-[10px] text-[#606070] py-2">
          — {t('timeline.loadedAll')} —
        </div>
      )}
    </div>
  );
}

/** 根据 entryType 分发渲染 */
function TimelineEntryCard({ entry }: { entry: TimelineEntry }) {
  switch (entry.entryType) {
    case 'solo_log':
      return <SoloLogCard entry={entry} />;
    case 'debate_log':
      return <DebateLogCard entry={entry} />;
    case 'grid_log':
      return <SoloLogCard entry={entry as any} />;
    case 'research':
      return <ResearchLogCard entry={entry} />;
    default:
      return null;
  }
}

/** 获取条目的唯一 ID */
function getEntryId(entry: TimelineEntry): string {
  if (entry.entryType === 'research') {
    return `research-${entry.session.id}`;
  }
  return `log-${entry.log.id}`;
}
