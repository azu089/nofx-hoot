'use client';

import { useState } from 'react';
import { FlaskConical, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { ACTION_CONFIG } from '@/constants/debate';
import { TruncatedText } from './truncated-text';
import { useResearchStages } from '@/hooks/useAi';
import type { TimelineResearch } from '@/types/ai';
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

// 5阶段定义（key 用于逻辑，label 由 t() 动态获取）
const STAGES = [
  { key: 'analysts', labelKey: 'research.stageAnalysts' },
  { key: 'debate', labelKey: 'research.stageDebate' },
  { key: 'trader', labelKey: 'research.stageTrader' },
  { key: 'risk', labelKey: 'research.stageRisk' },
  { key: 'judge', labelKey: 'research.stageDecision' },
];

interface ResearchLogCardProps {
  entry: TimelineResearch;
}

export function ResearchLogCard({ entry }: ResearchLogCardProps) {
  const t = useTranslations('ai');
  const { session } = entry;
  const [expanded, setExpanded] = useState(false);
  const decision = session.finalDecision as any;
  const actionCfg = decision?.action ? (ACTION_CONFIG[decision.action] || ACTION_CONFIG['wait']) : null;

  // 懒加载阶段详情
  const { data: stagesData, isLoading: stagesLoading } = useResearchStages(
    expanded ? session.id : null,
  );

  // 推断阶段进度
  const isCompleted = session.status === 'completed';
  const isFailed = session.status === 'failed';
  const isRunning = session.status === 'running';

  const depthLabel = (() => {
    switch (session.depth) {
      case 'quick': return t('research.quick');
      case 'standard': return t('research.standard');
      case 'deep': return t('research.deep');
      default: return session.depth;
    }
  })();

  return (
    <div className="bg-[#12121A] rounded-xl border border-[#1E1E2E] p-4 space-y-3">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#06B6D4]/15 text-[#06B6D4]">
            <FlaskConical className="w-3 h-3" />
            {t('modes.research')}
          </span>
          <span className="text-[#F8F8FC] font-medium">{session.symbol}</span>
          <span className="text-[#606070]">{depthLabel}</span>
        </div>
        <span className="text-[10px] text-[#606070]">{formatTimeAgo(session.createdAt, t as TFunc)}</span>
      </div>

      {/* 5阶段进度条 */}
      <StageProgress status={session.status} stages={stagesData?.stages} t={t as TFunc} />

      {/* 最终决策 */}
      {actionCfg && decision && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span
              className="px-2.5 py-1 rounded-md text-xs font-semibold"
              style={{ color: actionCfg.color, backgroundColor: actionCfg.bg }}
            >
              {actionCfg.icon} {actionCfg.labelZh}
            </span>
            {decision.confidence != null && (
              <span className="text-xs text-[#9090A0]">
                {t('research.confidence')} <span className="text-[#F8F8FC] font-mono">{decision.confidence}%</span>
              </span>
            )}
            {decision.leverage != null && (
              <span className="text-xs text-[#9090A0]">
                {t('research.leverage')} <span className="text-[#F8F8FC] font-mono">{decision.leverage}x</span>
              </span>
            )}
          </div>

          {/* SL/TP */}
          {(decision.stopLoss != null || decision.takeProfit != null) && (
            <div className="flex items-center gap-4 text-xs">
              {decision.stopLoss != null && (
                <span className="text-[#F43F5E]">
                  SL: <span className="font-mono">${Number(decision.stopLoss).toLocaleString()}</span>
                </span>
              )}
              {decision.takeProfit != null && (
                <span className="text-[#10B981]">
                  TP: <span className="font-mono">${Number(decision.takeProfit).toLocaleString()}</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 无决策时 (running / failed) */}
      {!decision && isRunning && (
        <div className="flex items-center gap-2 text-xs text-[#06B6D4]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {t('common.analyzing')}
        </div>
      )}
      {!decision && isFailed && (
        <div className="text-xs text-[#F43F5E]">
          {t('research.researchFailed')}{session.errorMessage ? `: ${session.errorMessage}` : ''}
        </div>
      )}

      {/* 展开/折叠 — 阶段详情 */}
      {isCompleted && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="flex items-center gap-1 text-[10px] text-[#06B6D4] hover:text-[#0891B2] transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? t('timeline.collapseDetail') : t('timeline.expandDetail')}
        </button>
      )}

      {/* 展开的阶段详情 */}
      {expanded && (
        <div className="space-y-2 pt-1">
          {stagesLoading ? (
            <div className="flex items-center gap-2 text-xs text-[#606070] py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : stagesData?.stages ? (
            <StageDetails stages={stagesData.stages} t={t as TFunc} />
          ) : (
            <div className="text-xs text-[#606070] text-center py-2">{t('timeline.noStageData')}</div>
          )}
        </div>
      )}
    </div>
  );
}

/** 5阶段进度指示器 */
function StageProgress({ status, stages, t }: { status: string; stages?: any; t: TFunc }) {
  // 根据 stages 数据推断完成了几个阶段
  let completedCount = 0;
  if (status === 'completed') {
    completedCount = 5;
  } else if (stages && Array.isArray(stages)) {
    completedCount = stages.filter((s: any) => s.status === 'completed').length;
  }

  return (
    <div className="flex items-center gap-1">
      {STAGES.map((stage, idx) => {
        const isDone = idx < completedCount;
        const isCurrent = status === 'running' && idx === completedCount;
        const isFail = status === 'failed' && idx === completedCount;

        return (
          <div key={stage.key} className="flex items-center">
            {/* 圆点 */}
            <div className="flex flex-col items-center">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  isDone
                    ? 'bg-[#10B981]'
                    : isCurrent
                      ? 'bg-[#06B6D4] animate-pulse'
                      : isFail
                        ? 'bg-[#F43F5E]'
                        : 'bg-[#2A2A3A]'
                }`}
              />
              <span className={`text-[8px] mt-0.5 ${
                isDone ? 'text-[#10B981]' : isCurrent ? 'text-[#06B6D4]' : 'text-[#606070]'
              }`}>
                {t(stage.labelKey)}
              </span>
            </div>
            {/* 连接线 */}
            {idx < STAGES.length - 1 && (
              <div
                className={`w-4 h-px mx-0.5 ${
                  idx < completedCount ? 'bg-[#10B981]' : 'bg-[#2A2A3A]'
                }`}
              />
            )}
          </div>
        );
      })}
      <span className="ml-2 text-[10px] text-[#606070]">
        {status === 'completed'
          ? t('timeline.stagesComplete', { done: 5, total: 5 })
          : status === 'running'
            ? t('timeline.stagesComplete', { done: completedCount, total: 5 })
            : ''}
      </span>
    </div>
  );
}

/** 展开后的阶段详情内容 */
function StageDetails({ stages, t }: { stages: any; t: TFunc }) {
  if (!stages || !Array.isArray(stages)) return null;

  // stage name → STAGES 配置映射（label 通过 t() 获取）
  const stageNameMap: Record<string, { key: string; labelKey: string }> = {
    analysts: { key: 'analysts', labelKey: 'research.stageAnalysts' },
    debate: { key: 'debate', labelKey: 'research.stageDebate' },
    trader: { key: 'trader', labelKey: 'research.stageTrader' },
    risk: { key: 'risk', labelKey: 'research.stageRisk' },
    decision: { key: 'judge', labelKey: 'research.stageDecision' },
  };

  return (
    <div className="space-y-2">
      {stages.map((stage: any, idx: number) => {
        const mapped = stageNameMap[stage.name] || STAGES[idx];
        const stageKey = stage.name || mapped?.key || '';
        const stageLabel = mapped ? t(mapped.labelKey) : `Stage ${idx + 1}`;

        return (
          <StageBlock key={idx} stageKey={stageKey} label={stageLabel} stage={stage} t={t} />
        );
      })}
    </div>
  );
}

/** 单个阶段区块 */
function StageBlock({ stageKey, label, stage, t }: { stageKey: string; label: string; stage: any; t: TFunc }) {
  const [open, setOpen] = useState(false);

  // 提取该阶段的文本内容
  const content = extractStageContent(stageKey, stage, t);
  if (!content) return null;

  const stageIcons: Record<string, string> = {
    analysts: '📊',
    debate: '💬',
    trader: '📋',
    risk: '🛡️',
    judge: '🎯',
    decision: '🎯',
  };

  return (
    <div className="bg-[#0A0A0F] rounded-lg border border-[#1E1E2E] overflow-hidden">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="w-full flex items-center justify-between p-2.5 text-xs hover:bg-[#1E1E2E]/50 transition-colors"
      >
        <span className="flex items-center gap-1.5 text-[#9090A0]">
          <span>{stageIcons[stageKey] || '📄'}</span>
          <span className="text-[#F8F8FC]">{label}</span>
        </span>
        {open ? <ChevronUp className="w-3 h-3 text-[#606070]" /> : <ChevronDown className="w-3 h-3 text-[#606070]" />}
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 space-y-1.5">
          {content.map((item, i) => (
            <div key={i}>
              {item.label && (
                <div className="text-[10px] text-[#606070] mb-0.5">{item.label}</div>
              )}
              <TruncatedText text={item.text} maxLines={4} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 从 stage 数据中提取可读文本
 *  API 返回结构: { name, result, status }
 *  result 内部结构因阶段而异
 */
function extractStageContent(
  stageKey: string,
  stage: any,
  t: TFunc,
): Array<{ label?: string; text: string }> | null {
  if (!stage) return null;

  // API 返回 {name, result, status}，取 result 作为实际数据
  const data = stage.result ?? stage;
  if (!data) return null;

  // 分析师阶段 — result: { news: {bias, report}, market: {bias, report}, ... }
  if (stageKey === 'analysts' && typeof data === 'object' && !Array.isArray(data)) {
    const entries = Object.entries(data);
    if (entries.length > 0 && entries.every(([, v]) => typeof v === 'object')) {
      return entries.map(([key, val]: [string, any]) => ({
        label: `${analystLabelMap(key, t)}${val?.bias ? ` [${val.bias}]` : ''}`,
        text: val?.report || (typeof val === 'string' ? val : JSON.stringify(val, null, 2)),
      }));
    }
  }

  // 辩论阶段 — result: { entries: [{role, model, round, content, arguments}], consensus }
  if (stageKey === 'debate' && data.entries) {
    const debateEntries = Array.isArray(data.entries) ? data.entries : [];
    return debateEntries.map((e: any) => ({
      label: `${e.role || e.personality || t('timeline.debater')}${e.model ? ` (${e.model})` : ''} ${e.round === -1 ? t('timeline.finalVote') : t('timeline.roundN', { n: e.round ?? '?' })}`,
      text: e.content || e.message || e.arguments?.reasoning || JSON.stringify(e),
    }));
  }

  // 交易员阶段 — result: { proposal: {action, leverage, ...} }
  if (stageKey === 'trader' && data.proposal) {
    const p = data.proposal;
    const parts = [
      p.action && `${t('timeline.decision')}: ${p.action}`,
      p.leverage && `${t('research.leverage')}: ${p.leverage}x`,
      p.positionSizePercent && `${t('research.position')}: ${p.positionSizePercent}%`,
      p.stopLoss && `SL: $${Number(p.stopLoss).toLocaleString()}`,
      p.takeProfit && `TP: $${Number(p.takeProfit).toLocaleString()}`,
      p.reasoning,
    ].filter(Boolean);
    return [{ text: parts.join('\n') }];
  }

  // 风控阶段 — result: { reasoning, riskRating, riskApproved }
  if (stageKey === 'risk') {
    const parts = [
      data.riskApproved != null && `${t('timeline.approval')}: ${data.riskApproved ? `✅ ${t('timeline.approved')}` : `❌ ${t('timeline.rejected')}`}`,
      data.riskRating && `${t('timeline.riskLevel')}: ${data.riskRating}`,
      data.reasoning,
    ].filter(Boolean);
    if (parts.length > 0) return [{ text: parts.join('\n') }];
  }

  // 决策阶段 — result: { action, confidence, leverage, reasoning, ... }
  if (stageKey === 'decision' || data.action) {
    const parts = [
      data.action && `${t('timeline.decision')}: ${data.action}`,
      data.confidence != null && `${t('research.confidence')}: ${data.confidence}%`,
      data.leverage && `${t('research.leverage')}: ${data.leverage}x`,
      data.direction && `${t('detail.voteDirection')}: ${data.direction}`,
      data.positionSizePercent && `${t('research.position')}: ${data.positionSizePercent}%`,
      data.stopLoss && `SL: $${Number(data.stopLoss).toLocaleString()}`,
      data.takeProfit && `TP: $${Number(data.takeProfit).toLocaleString()}`,
      data.reasoning,
    ].filter(Boolean);
    if (parts.length > 0) return [{ text: parts.join('\n') }];
  }

  // 兜底：将 data 序列化
  if (typeof data === 'object') {
    const str = JSON.stringify(data, null, 2);
    if (str.length > 10) return [{ text: str }];
  }

  return null;
}

function analystLabelMap(key: string, t: TFunc): string {
  switch (key) {
    case 'market': return t('research.analystMarket');
    case 'technical': return t('research.analystTechnical');
    case 'fundamental': return t('research.analystFundamental');
    case 'news': return t('research.analystNews');
    case 'sentiment': return t('research.analystSentiment');
    default: return key;
  }
}
