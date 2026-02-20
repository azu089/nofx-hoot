'use client';

import { useState } from 'react';
import { MessageSquare, Check, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import {
  ACTION_CONFIG,
  MODEL_DISPLAY,
  PERSONALITY_EMOJIS,
  CAMP_COLORS,
} from '@/constants/debate';
import { TruncatedText } from './truncated-text';
import type { TimelineDebateLog, StrategyLogVote } from '@/types/ai';
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

/** 根据 action 推断阵营 */
function getActionCamp(action: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  if (action === 'open_long' || action === 'close_short') return 'BULLISH';
  if (action === 'open_short' || action === 'close_long') return 'BEARISH';
  return 'NEUTRAL';
}

/** 信心条颜色 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return '#22C55E';
  if (confidence >= 60) return '#F59E0B';
  return '#606070';
}

interface DebateLogCardProps {
  entry: TimelineDebateLog;
}

export function DebateLogCard({ entry }: DebateLogCardProps) {
  const t = useTranslations('ai');
  const { log, strategy } = entry;
  const d = log.decision;
  const votes = d.votes || [];
  const actionCfg = ACTION_CONFIG[d.action] || ACTION_CONFIG['wait'];

  const [showVotes, setShowVotes] = useState(true);

  // 统计阵营
  const campCount = { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 };
  const consensusAction = d.action;
  for (const v of votes) {
    const camp = getActionCamp(v.action);
    campCount[camp]++;
  }

  return (
    <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4 space-y-3">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6]">
            <MessageSquare className="w-3 h-3" />
            {t('modes.debate')}
          </span>
          <span className="text-[#9090A0]">{strategy.name}</span>
          <span className="text-[#F8F8FC] font-medium">{log.symbol}</span>
        </div>
        <span className="text-[10px] text-[#606070]">{formatTimeAgo(log.createdAt, t as TFunc)}</span>
      </div>

      {/* 共识决策行 */}
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

      {/* 投票列表 */}
      {votes.length > 0 && (
        <div className="space-y-1.5">
          {/* 折叠切换 */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowVotes(!showVotes); }}
            className="flex items-center gap-1 text-[10px] text-[#606070] hover:text-[#9090A0] transition-colors"
          >
            {showVotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {t('timeline.modelVotes', { count: votes.length })}
          </button>

          {showVotes && (
            <div className="space-y-2">
              {votes.map((vote: StrategyLogVote, idx: number) => (
                <VoteRow key={idx} vote={vote} consensusAction={consensusAction} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 阵营汇总 */}
      <div className="flex items-center gap-3 text-[10px] text-[#9090A0]">
        {campCount.BULLISH > 0 && (
          <span style={{ color: CAMP_COLORS.BULLISH }}>
            {t('timeline.bullish')} {campCount.BULLISH}
          </span>
        )}
        {campCount.BEARISH > 0 && (
          <span style={{ color: CAMP_COLORS.BEARISH }}>
            {t('timeline.bearish')} {campCount.BEARISH}
          </span>
        )}
        {campCount.NEUTRAL > 0 && (
          <span style={{ color: CAMP_COLORS.NEUTRAL }}>
            {t('timeline.neutral')} {campCount.NEUTRAL}
          </span>
        )}
        {d.confidence != null && (
          <span className="text-[#606070]">{t('timeline.consensus')} {d.confidence}%</span>
        )}
      </div>

      {/* SL/TP */}
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

/** 单个模型投票行 */
function VoteRow({ vote, consensusAction }: { vote: StrategyLogVote; consensusAction: string }) {
  const modelInfo = MODEL_DISPLAY[vote.modelId];
  const modelName = modelInfo?.name || vote.modelId;
  const emoji = vote.personality ? (PERSONALITY_EMOJIS[vote.personality] || '') : '';
  const voteCfg = ACTION_CONFIG[vote.action] || ACTION_CONFIG['wait'];
  const agreed = getActionCamp(vote.action) === getActionCamp(consensusAction);
  const barColor = getConfidenceColor(vote.confidence);
  const barWidth = Math.min(100, Math.max(0, vote.confidence));

  return (
    <div className="bg-[#0A0A0F] rounded-lg p-2.5 space-y-1.5">
      {/* 模型信息行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {emoji && <span className="text-sm">{emoji}</span>}
          <span className="text-xs text-[#F8F8FC] font-medium">{modelName}</span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ color: voteCfg.color, backgroundColor: voteCfg.bg }}
          >
            {voteCfg.labelZh}
          </span>
          <span className="text-[10px] font-mono text-[#9090A0]">{vote.confidence}%</span>
        </div>
        <span className={`text-[10px] ${agreed ? 'text-[#10B981]' : 'text-[#606070]'}`}>
          {agreed ? '✓' : '✗'}
        </span>
      </div>

      {/* 信心条 */}
      <div className="h-1 bg-[#1E1E2E] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${barWidth}%`, backgroundColor: barColor }}
        />
      </div>

      {/* 推理首行 */}
      {vote.reasoning && (
        <TruncatedText text={vote.reasoning} maxLines={1} />
      )}
    </div>
  );
}
