'use client';

import { Zap, Check, Clock } from 'lucide-react';
import { ACTION_CONFIG } from '@/constants/debate';
import { TruncatedText } from './truncated-text';
import type { TimelineSoloLog } from '@/types/ai';
import { useTranslations } from '@/i18n/provider';

type TFunc = (key: string, params?: Record<string, string | number>) => string;

function formatTimeAgo(dateStr: string, t: TFunc): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('common.justNow');
  if (mins < 60) return t('common.minutesAgo', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('common.hoursAgo', { count: hrs });
  return t('common.daysAgo', { count: Math.floor(hrs / 24) });
}

interface SoloLogCardProps {
  entry: TimelineSoloLog;
}

export function SoloLogCard({ entry }: SoloLogCardProps) {
  const t = useTranslations('ai');
  const { log, strategy } = entry;
  const d = log.decision;
  const actionCfg = ACTION_CONFIG[d.action] || ACTION_CONFIG['wait'];

  return (
    <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4 space-y-3">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B]">
            <Zap className="w-3 h-3" />
            {t('modes.solo')}
          </span>
          <span className="text-[#9090A0]">{strategy.name}</span>
          <span className="text-[#F8F8FC] font-medium">{log.symbol}</span>
        </div>
        <span className="text-[10px] text-[#606070]">{formatTimeAgo(log.createdAt, t as TFunc)}</span>
      </div>

      {/* 决策行 */}
      <div className="flex items-center gap-3">
        <span
          className="px-2.5 py-1 rounded-md text-xs font-semibold"
          style={{ color: actionCfg.color, backgroundColor: actionCfg.bg }}
        >
          {actionCfg.icon} {actionCfg.labelZh}
        </span>
        {d.confidence != null && (
          <span className="text-xs text-[#9090A0]">
            {t('research.confidence')} <span className="text-[#F8F8FC] font-mono">{d.confidence}%</span>
          </span>
        )}
        {d.leverage != null && (
          <span className="text-xs text-[#9090A0]">
            {t('research.leverage')} <span className="text-[#F8F8FC] font-mono">{d.leverage}x</span>
          </span>
        )}
        {d.positionSizePercent != null && (
          <span className="text-xs text-[#9090A0]">
            {t('research.position')} <span className="text-[#F8F8FC] font-mono">{d.positionSizePercent}%</span>
          </span>
        )}
      </div>

      {/* 推理文本 */}
      {d.reasoning && (
        <TruncatedText text={d.reasoning} maxLines={3} />
      )}

      {/* SL/TP 行 */}
      {(d.stopLoss != null || d.takeProfit != null) && (
        <div className="flex items-center gap-4 text-xs">
          {d.stopLoss != null && (
            <span className="text-[#F43F5E]">
              SL: <span className="font-mono">${d.stopLoss.toLocaleString()}</span>
            </span>
          )}
          {d.takeProfit != null && (
            <span className="text-[#10B981]">
              TP: <span className="font-mono">${d.takeProfit.toLocaleString()}</span>
            </span>
          )}
        </div>
      )}

      {/* 执行状态 */}
      <div className="flex items-center gap-1.5 text-[10px]">
        {log.executed ? (
          <span className="flex items-center gap-1 text-[#10B981]">
            <Check className="w-3 h-3" /> {t('timeline.executed')}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[#606070]">
            <Clock className="w-3 h-3" /> {t('timeline.notExecuted')}
          </span>
        )}
      </div>
    </div>
  );
}
