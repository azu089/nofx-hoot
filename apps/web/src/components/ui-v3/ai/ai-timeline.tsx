'use client';

import { useState, useCallback } from 'react';
import { Loader2, Clock, AlertTriangle } from 'lucide-react';
import { useAiTimeline } from '@/hooks/useAi';
import type { TimelineEntry } from '@/types/ai';
import { SoloLogCard } from './timeline-cards/solo-log-card';
import { DebateLogCard } from './timeline-cards/debate-log-card';
import { ResearchLogCard } from './timeline-cards/research-log-card';
import { useTranslations } from '@/i18n/provider';

interface AiTimelineProps {
  filter: 'all' | 'research' | 'solo' | 'debate';
}

export function AiTimeline({ filter }: AiTimelineProps) {
  const t = useTranslations('ai');
  const [page, setPage] = useState(1);
  const [allEntries, setAllEntries] = useState<TimelineEntry[]>([]);
  const [hasMore, setHasMore] = useState(true);

  // 映射 filter → API type 参数
  const typeParam = filter === 'all' ? 'all' : filter;

  const { data, isLoading, error } = useAiTimeline(page, 10, typeParam);

  // 当数据到达时，追加到已有列表
  // 使用 useMemo/useEffect 来合并分页数据
  const entries = (() => {
    if (!data) return allEntries;
    if (page === 1) return data.data;
    // 合并新页数据（去重）
    const existingIds = new Set(allEntries.map(getEntryId));
    const newEntries = data.data.filter((e) => !existingIds.has(getEntryId(e)));
    return [...allEntries, ...newEntries];
  })();

  // 更新状态
  if (data && entries !== allEntries) {
    // 不在 render 中 setState，改用 callback 方式
  }

  const handleLoadMore = useCallback(() => {
    if (data && data.pagination.page < data.pagination.totalPages) {
      setAllEntries(entries);
      setPage((p) => p + 1);
      setHasMore(true);
    } else {
      setHasMore(false);
    }
  }, [data, entries]);

  // filter 变化时重置
  const handleFilterReset = useCallback(() => {
    setPage(1);
    setAllEntries([]);
    setHasMore(true);
  }, []);

  // 检测 filter 变化 — 用 key 机制在父组件中重置

  if (isLoading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#06B6D4]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#606070]">
        <AlertTriangle className="w-8 h-8 mb-3 text-[#F43F5E]/50" />
        <div className="text-xs">{t('timeline.loadFailed')}</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[#606070]">
        <Clock className="w-8 h-8 mb-3 text-[#606070]/30" />
        <div className="text-xs">{t('timeline.noLogs')}</div>
        <div className="text-[10px] text-[#606070]/60 mt-1">
          {t('timeline.noLogsDesc')}
        </div>
      </div>
    );
  }

  const canLoadMore = data && data.pagination.page < data.pagination.totalPages;

  return (
    <div className="space-y-3">
      {entries.map((entry, idx) => (
        <TimelineEntryCard key={`${getEntryId(entry)}-${idx}`} entry={entry} />
      ))}

      {/* 加载更多 */}
      {canLoadMore && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={isLoading}
          className="w-full py-3 text-xs text-[#06B6D4] hover:text-[#0891B2] bg-[#12121A] rounded-xl border border-[#1E1E2E] hover:border-[#06B6D4]/30 transition-all flex items-center justify-center gap-2"
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
