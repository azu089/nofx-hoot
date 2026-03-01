'use client';

import { useState } from 'react';
import { translateErrorForDisplay } from '@/lib/error-translator';
import {
  FlaskConical,
  ChevronDown,
  ChevronUp,
  Loader2,
  ScanSearch,
  Swords,
  FileText,
  ShieldCheck,
  Scale,
  Check,
  Clock,
  Shield,
  Pause,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { ACTION_CONFIG, MODEL_DISPLAY } from '@/constants/debate';
import { TruncatedText } from './truncated-text';
import { useResearchStages } from '@/hooks/useAi';
import type { TimelineResearch, ResearchStage, ResearchStageResult } from '@/types/ai';
import { useTranslations } from '@/i18n/provider';

type TFunc = (key: string, params?: Record<string, string | number>) => string;

// ─── 阶段配置（Lucide 图标替代 Emoji）─────────────────────
const STAGE_CONFIG: Array<{ key: string; labelKey: string; icon: LucideIcon }> = [
  { key: 'analysts', labelKey: 'research.stageAnalysts', icon: ScanSearch },
  { key: 'debate', labelKey: 'research.stageDebate', icon: Swords },
  { key: 'trader', labelKey: 'research.stageTrader', icon: FileText },
  { key: 'risk', labelKey: 'research.stageRisk', icon: ShieldCheck },
  { key: 'judge', labelKey: 'research.stageDecision', icon: Scale },
];

// 阶段名 → 配置映射（兼容中英文后端返回）
const STAGE_NAME_MAP: Record<string, number> = {
  analysts: 0, debate: 1, trader: 2, risk: 3, decision: 4, judge: 4,
  '分析师研究': 0, '投资辩论': 1, '交易员提案': 2, '风控辩论': 3, '最终决策': 4,
};

// 运行中阶段的提示文案 — i18n key 映射
const STAGE_THINKING_KEYS: Record<string, string> = {
  analysts: 'research.stageThinkingAnalysts',
  debate: 'research.stageThinkingDebate',
  trader: 'research.stageThinkingTrader',
  risk: 'research.stageThinkingRisk',
  judge: 'research.stageThinkingJudge',
};

const ACTION_I18N: Record<string, string> = {
  open_long: 'detail.actionOpenLong', open_short: 'detail.actionOpenShort',
  close_long: 'detail.actionCloseLong', close_short: 'detail.actionCloseShort',
  hold: 'detail.actionHold', wait: 'detail.actionWait',
};

/** 辩论角色名翻译 */
const DEBATE_ROLE_I18N: Record<string, string> = {
  bull: 'timeline.roleBull', bear: 'timeline.roleBear',
  analyst: 'timeline.roleAnalyst', contrarian: 'timeline.roleContrarian',
  risk_manager: 'timeline.roleRiskManager',
  invest_judge: 'timeline.roleJudge', judge: 'timeline.roleJudge',
};

/** 翻译 action 枚举值: wait → 等待, open_long → 开多 */
function trAction(val: unknown, t: TFunc): string {
  const s = String(val);
  const key = ACTION_I18N[s];
  return key ? t(key) : s;
}

/** 翻译 direction / bias 枚举值: bullish → 看多 */
function trDirection(val: unknown, t: TFunc): string {
  const s = String(val).toLowerCase();
  const map: Record<string, string> = {
    bullish: 'timeline.bullish', bearish: 'timeline.bearish',
    neutral: 'timeline.neutral',
    // action 格式也兼容
    open_long: 'detail.actionOpenLong', open_short: 'detail.actionOpenShort',
    close_long: 'detail.actionCloseLong', close_short: 'detail.actionCloseShort',
    hold: 'detail.actionHold', wait: 'detail.actionWait',
  };
  const key = map[s];
  return key ? t(key) : String(val);
}

/** 翻译 riskRating 枚举值: high → 高, extreme → 极端 */
function trRiskRating(val: unknown, t: TFunc): string {
  const s = String(val).toLowerCase().replace(/[\s_]+/g, '_');
  const map: Record<string, string> = {
    extreme: 'timeline.riskExtreme', very_high: 'timeline.riskVeryHigh',
    high: 'timeline.riskHigh', medium: 'timeline.riskMedium',
    low: 'timeline.riskLow', critical: 'timeline.riskCritical',
  };
  const key = map[s];
  return key ? t(key) : String(val);
}

/** 清理后端存储的标签为用户可读文本 */
function cleanBackendTags(text: string, t: TFunc): string {
  let s = text;
  // [RISK REJECTED] / [RISK APPROVED]
  s = s.replace(/\[RISK REJECTED\]/gi, `[${t('timeline.rejected')}]`);
  s = s.replace(/\[RISK APPROVED\]/gi, `[${t('timeline.approved')}]`);
  // Rating: EXTREME/HIGH/MEDIUM/LOW
  s = s.replace(/Rating:\s*(EXTREME|VERY[_ ]HIGH|HIGH|MEDIUM|LOW|CRITICAL)/gi, (_, lv) => {
    return `${t('timeline.riskLevel')}: ${trRiskRating(lv, t)}`;
  });
  // 回退动作: hold/wait/...
  s = s.replace(/回退动作:\s*(hold|wait|open_long|open_short|close_long|close_short)/gi, (_, act) => {
    const k = ACTION_I18N[act.toLowerCase()];
    return `${t('timeline.fallbackAction')}: ${k ? t(k) : act}`;
  });
  return s;
}

/**
 * 从完整 reasoning 提取简短等待/持仓原因（1-2行）。
 * 完整 reasoning 已在上方「最终决策」阶段展示，此处只需简述。
 */
function briefWaitReason(text: string, t: TFunc): string {
  // 1. 风控拒绝 → 提取评级作为摘要
  const riskMatch = text.match(/\[RISK REJECTED\]\s*Rating:\s*(\w+)/i);
  if (riskMatch) {
    const rating = trRiskRating(riskMatch[1], t);
    return `${t('timeline.riskRejected')}: ${t('timeline.riskLevel')} ${rating}`;
  }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // 2. 优先找结论/建议行
  const conclusionLine = lines.find(l =>
    /^(结论|建议|总结|综合|判断)[：:]/i.test(l) ||
    /conclusion|summary/i.test(l),
  );
  if (conclusionLine) {
    const cleaned = cleanBackendTags(conclusionLine.replace(/^(结论|建议|总结|综合|判断)[：:]\s*/i, ''), t);
    return cleaned.length > 80 ? cleaned.slice(0, 80) + '…' : cleaned;
  }

  // 3. 找包含明确信号词的行
  const signalLine = lines.find(l =>
    /(不建议|不适合|建议等待|观望|风险较|暂不|缺乏信号|等待确认|震荡|趋势不明|信号不足)/i.test(l)
    && !/^[^\u4e00-\u9fff]*[：:]\s*$/i.test(l),
  );
  if (signalLine) {
    const cleaned = cleanBackendTags(signalLine, t);
    return cleaned.length > 80 ? cleaned.slice(0, 80) + '…' : cleaned;
  }

  // 4. 跳过章节标题（"xxx分析：" / "xxx：" 格式），取第一个有内容的行
  const contentLine = lines.find(l =>
    !/^[\w\u4e00-\u9fff]{1,8}[：:]\s*$/.test(l)
    && l.length > 4,
  );
  if (contentLine) {
    const cleaned = cleanBackendTags(contentLine, t);
    return cleaned.length > 80 ? cleaned.slice(0, 80) + '…' : cleaned;
  }

  return cleanBackendTags(text, t).slice(0, 80);
}

function formatTimeAgo(dateStr: string, t: TFunc): string {
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('common.justNow');
  if (mins < 60) return t('common.minutesAgo', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('common.hoursAgo', { count: hrs });
  return t('common.daysAgo', { count: Math.floor(hrs / 24) });
}

// ─── 主组件 ───────────────────────────────────────────────
interface ResearchLogCardProps {
  entry: TimelineResearch;
}

export function ResearchLogCard({ entry }: ResearchLogCardProps) {
  const t = useTranslations('ai');
  const te = useTranslations('errors');
  const { session } = entry;
  const decision = session.finalDecision;
  const actionCfg = decision?.action ? (ACTION_CONFIG[decision.action] || ACTION_CONFIG['wait']) : null;

  const isCompleted = session.status === 'completed';
  const isFailed = session.status === 'failed';
  const isRunning = session.status === 'running';

  // 完成态或运行中 加载阶段详情
  const shouldLoadStages = isCompleted || isRunning;
  const { data: stagesData, isLoading: stagesLoading } = useResearchStages(
    shouldLoadStages ? session.id : null,
  );

  const depthLabel = (() => {
    switch (session.depth) {
      case 'quick': return t('research.quick');
      case 'standard': return t('research.standard');
      case 'deep': return t('research.deep');
      default: return session.depth;
    }
  })();

  return (
    <div className="glass-border-glow glass-card p-4 space-y-3">
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

      {/* 运行态：自动显示思考链 */}
      {isRunning && (
        <RunningChain stages={stagesData?.stages} t={t as TFunc} />
      )}

      {/* 最终决策 — 仅交易动作(开/平仓)时显示，wait/hold 由底部状态栏表达 */}
      {actionCfg && decision
        && (decision.action === 'open_long' || decision.action === 'open_short'
          || decision.action === 'close_long' || decision.action === 'close_short')
        && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span
              className="px-2.5 py-1 rounded-md text-xs font-semibold"
              style={{ color: actionCfg.color, backgroundColor: actionCfg.bg }}
            >
              {ACTION_I18N[decision.action] ? t(ACTION_I18N[decision.action]) : actionCfg.label}
            </span>
            {decision.confidence != null && (
              <span className="text-xs text-[#9090A0]">
                {t('research.confidence')} <span className={`font-mono ${decision.confidence > 0 ? 'text-[#F8F8FC]' : 'text-[#F43F5E]'}`}>{decision.confidence}%</span>
              </span>
            )}
            {decision.leverage != null && decision.leverage > 1 && (
              <span className="text-xs text-[#9090A0]">
                {t('research.leverage')} <span className="text-[#F8F8FC] font-mono">{decision.leverage}x</span>
              </span>
            )}
            {decision.positionSizePercent != null && decision.positionSizePercent > 0 && (
              <span className="text-xs text-[#9090A0]">
                {t('timeline.positionSize')} <span className="text-[#F8F8FC] font-mono">{decision.positionSizePercent}%</span>
              </span>
            )}
          </div>
          {(decision.stopLoss != null || decision.takeProfit != null) && (() => {
            const ep = (decision.stopLoss && decision.takeProfit)
              ? (decision.stopLoss + decision.takeProfit) / 2 : 0;
            const rr = (decision.stopLoss && decision.takeProfit && ep)
              ? Math.abs(decision.takeProfit - ep) / Math.abs(ep - decision.stopLoss) : null;
            const rrCol = rr != null ? (rr >= 2 ? '#22C55E' : rr >= 1 ? '#F59E0B' : '#F43F5E') : '';
            return (
              <div className="flex items-start gap-4 text-xs">
                {decision.stopLoss != null && (
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] text-[#606070]">{t('timeline.slLabel')}:</span>
                      <span className="text-[#F43F5E] font-mono">${Number(decision.stopLoss).toLocaleString()}</span>
                    </div>
                    {ep > 0 && (
                      <span className="text-[#F43F5E] opacity-70 text-[10px]">{((decision.stopLoss - ep) / ep * 100).toFixed(1)}%</span>
                    )}
                  </div>
                )}
                {decision.takeProfit != null && (
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] text-[#606070]">{t('timeline.tpLabel')}:</span>
                      <span className="text-[#10B981] font-mono">${Number(decision.takeProfit).toLocaleString()}</span>
                    </div>
                    {ep > 0 && (
                      <span className="text-[#10B981] opacity-70 text-[10px]">+{((decision.takeProfit - ep) / ep * 100).toFixed(1)}%</span>
                    )}
                  </div>
                )}
                {rr != null && (
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] text-[#606070]">{t('timeline.rrLabel')}:</span>
                      <span className="font-mono font-semibold" style={{ color: rrCol }}>1:{rr.toFixed(1)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* 运行中无决策 + 无阶段数据时 */}
      {!decision && isRunning && !stagesData?.stages?.length && (
        <div className="flex items-center gap-2 text-xs text-[#06B6D4]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {t('timeline.analysisRunning')}
        </div>
      )}

      {/* 失败 */}
      {!decision && isFailed && (
        <div className="text-xs text-[#F43F5E]">
          {t('research.researchFailed')}{session.errorMessage ? `: ${translateErrorForDisplay(session.errorMessage, te)}` : ''}
        </div>
      )}

      {/* 参与模型头像组 — 完成态从辩论阶段提取，无需展开即可见 */}
      {isCompleted && stagesData?.stages && (() => {
        const debateStage = stagesData.stages.find(
          (s: ResearchStage) => STAGE_NAME_MAP[s.name] === 1,
        );
        const entries = (debateStage?.result as Record<string, unknown> | undefined)?.entries;
        if (!Array.isArray(entries) || entries.length === 0) return null;
        const uniqueModels = [...new Set(
          (entries as Array<Record<string, unknown>>)
            .map((e) => e.model as string)
            .filter(Boolean),
        )];
        if (uniqueModels.length === 0) return null;
        return (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#606070]">{t('research.stageDebate')}:</span>
            <div className="flex items-center -space-x-1">
              {uniqueModels.slice(0, 4).map((modelId, i) => {
                const info = MODEL_DISPLAY[modelId];
                const name = info?.name || modelId;
                const color = info?.color || '#9090A0';
                return (
                  <span key={i}
                    className="w-5 h-5 rounded-full border border-[#12121A] flex items-center justify-center text-[8px] font-bold text-white"
                    style={{ backgroundColor: color }} title={name}>
                    {name.charAt(0).toUpperCase()}
                  </span>
                );
              })}
            </div>
            {uniqueModels.length > 4 && (
              <span className="text-[10px] text-[#606070]">+{uniqueModels.length - 4}</span>
            )}
          </div>
        );
      })()}

      {/* 思考链 — 完成态默认展开 */}
      {isCompleted && (
        <div className="pt-1">
          {stagesLoading ? (
            <div className="flex items-center gap-2 text-xs text-[#606070] py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : stagesData?.stages && stagesData.stages.length > 0 ? (
            <ThinkingChain stages={stagesData.stages} t={t as TFunc} />
          ) : (
            <div className="text-xs text-[#606070] text-center py-2">{t('timeline.noStageData')}</div>
          )}
        </div>
      )}

      {/* 执行状态栏 */}
      <div className="border-t border-[#1E1E2E] pt-2 mt-1">
        {isRunning ? (() => {
          const doneCount = stagesData?.stages?.filter((s: ResearchStage) => s.status === 'completed').length || 0;
          const curCfg = STAGE_CONFIG[doneCount];
          const thinkKey = curCfg ? STAGE_THINKING_KEYS[curCfg.key] : null;
          return (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#06B6D4]/5 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#06B6D4]" />
              <span className="text-[#06B6D4]">{thinkKey ? t(thinkKey) : t('timeline.analysisRunning')}</span>
            </div>
          );
        })() : session.executedTradeId ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#10B981]/5 text-xs">
            <Check className="w-3.5 h-3.5 text-[#10B981]" />
            <span className="text-[#10B981] font-medium">
              {decision?.action && ACTION_I18N[decision.action] ? t(ACTION_I18N[decision.action]) : t('timeline.executed')}
            </span>
            {decision?.capitalUSD != null && (
              <span className="text-[#9090A0] font-mono">${decision.capitalUSD}</span>
            )}
            {decision?.positionSizePercent != null && (
              <span className="text-[#9090A0] font-mono">{decision.positionSizePercent}%</span>
            )}
            {decision?.leverage != null && decision.leverage > 1 && (
              <span className="text-[#9090A0] font-mono">{decision.leverage}x</span>
            )}
          </div>
        ) : session.errorMessage && !isRunning ? (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#F43F5E]/5 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F43F5E] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[#F43F5E] font-medium">{t('common.failed')}</span>
              <span className="text-[#606070]"> · {translateErrorForDisplay(session.errorMessage, te)}</span>
            </div>
          </div>
        ) : decision?.action === 'wait' ? (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#94A3B8]/5 text-xs">
            <Clock className="w-3.5 h-3.5 text-[#94A3B8] flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-[#94A3B8] font-medium">{t('timeline.waitingSignal')}</span>
              {decision.reasoning && (
                <p className="text-[#9090A0] text-xs mt-0.5 leading-relaxed">{briefWaitReason(decision.reasoning, t as TFunc)}</p>
              )}
            </div>
          </div>
        ) : decision?.action === 'hold' ? (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#64748B]/5 text-xs">
            <Pause className="w-3.5 h-3.5 text-[#64748B] flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-[#64748B] font-medium">{t('timeline.holdingPosition')}</span>
              {decision.reasoning && (
                <p className="text-[#9090A0] text-xs mt-0.5 leading-relaxed">{briefWaitReason(decision.reasoning, t as TFunc)}</p>
              )}
            </div>
          </div>
        ) : decision && !session.executedTradeId ? (() => {
          // 有决策但未执行：从 stage5 result / decision 提取真实原因
          const stage5 = stagesData?.stages?.find((s: ResearchStage) => s.stage === 5 || s.name === '最终决策' || s.name === 'decision');
          const r5 = stage5?.result as Record<string, unknown> | undefined;
          let reason = '';
          if (r5?.safetyPassed === false) {
            reason = t('timeline.blockedBySafety');
          } else if (r5?.riskApproved === false) {
            reason = t('timeline.blockedByRisk');
          } else if (decision.confidence === 0) {
            // AI 解析失败回退，置信度为 0
            reason = t('timeline.lowConfidence');
          } else if (decision.reasoning) {
            // 从 reasoning 提取简短原因
            reason = briefWaitReason(decision.reasoning, t as TFunc);
          } else {
            reason = t('timeline.execSkipped');
          }
          return (
            <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#F59E0B]/5 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[#F59E0B] font-medium">{t('timeline.notExecuted')}</span>
                <p className="text-[#9090A0] text-xs mt-0.5">{reason}</p>
              </div>
            </div>
          );
        })() : !decision && isCompleted ? (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#606070]/5 text-xs">
            <Clock className="w-3.5 h-3.5 text-[#606070] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[#606070] font-medium">{t('timeline.noDecision')}</span>
              <p className="text-[#9090A0] text-xs mt-0.5">{t('timeline.noDecisionReason')}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#606070]/5 text-xs">
            <Clock className="w-3.5 h-3.5 text-[#606070] flex-shrink-0 mt-0.5" />
            <span className="text-[#606070]">{t('timeline.notExecuted')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 运行态思考链（自动显示）──────────────────────────────
function RunningChain({ stages, t }: { stages?: ResearchStage[]; t: TFunc }) {
  const completedCount = stages?.filter((s: ResearchStage) => s.status === 'completed').length || 0;

  return (
    <div className="border-l border-[#1E1E2E] ml-1 pl-3">
      {STAGE_CONFIG.map((cfg, idx) => {
        const isDone = idx < completedCount;
        const isCurrent = idx === completedCount;
        const stage = stages?.[idx];
        const summary = isDone && stage ? getStageSummary(cfg.key, stage, t) : '';
        const duration = isDone && stage?.durationMs
          ? `${(stage.durationMs / 1000).toFixed(1)}s` : '';
        const Icon = cfg.icon;

        return (
          <div key={cfg.key} className="relative">
            {/* 左侧圆点 */}
            <div className={`absolute -left-[13px] top-[9px] w-1.5 h-1.5 rounded-full ${
              isDone ? 'bg-[#10B981]' : isCurrent ? 'bg-[#06B6D4] animate-pulse' : 'bg-[#2A2A3A]'
            }`} />

            <div className="flex items-center gap-2 py-1.5 text-xs">
              <Icon className={`w-3 h-3 flex-shrink-0 ${
                isDone ? 'text-[#10B981]' : isCurrent ? 'text-[#06B6D4]' : 'text-[#606070]'
              }`} />
              <span className={
                isDone ? 'text-[#F8F8FC]' : isCurrent ? 'text-[#06B6D4]' : 'text-[#606070]'
              }>
                {t(cfg.labelKey)}
              </span>
              {isDone && summary && (
                <span className="text-[#606070] truncate flex-1 text-left">· {summary}</span>
              )}
              {isCurrent && (
                <Loader2 className="w-3 h-3 text-[#06B6D4] animate-spin flex-shrink-0" />
              )}
              {isDone && duration && (
                <span className="text-[10px] text-[#606070] flex-shrink-0">{duration}</span>
              )}
            </div>

            {/* 当前阶段提示 */}
            {isCurrent && (
              <div className="pl-5 pb-1 text-[10px] text-[#606070] animate-pulse">
                {STAGE_THINKING_KEYS[cfg.key] ? t(STAGE_THINKING_KEYS[cfg.key]) : '...'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 完成态思考链（手风琴）──────────────────────────────
function ThinkingChain({ stages, t }: { stages: ResearchStage[]; t: TFunc }) {
  if (!stages || !Array.isArray(stages)) return null;

  const totalDuration = stages.reduce((sum, s) => sum + (s.durationMs || 0), 0);

  return (
    <div>
      <div className="border-l border-[#1E1E2E] ml-1 pl-3">
        {stages.map((stage: ResearchStage, idx: number) => {
          const cfgIdx = STAGE_NAME_MAP[stage.name] ?? idx;
          const cfg = STAGE_CONFIG[cfgIdx] || STAGE_CONFIG[idx];
          const stageKey = cfg?.key || stage.name || '';
          const stageLabel = cfg ? t(cfg.labelKey) : `Stage ${idx + 1}`;
          const Icon = cfg?.icon || ScanSearch;
          const summary = getStageSummary(stageKey, stage, t);
          const duration = stage.durationMs ? `${(stage.durationMs / 1000).toFixed(1)}s` : '';

          return (
            <StageAccordion
              key={idx}
              stageKey={stageKey}
              label={stageLabel}
              icon={Icon}
              summary={summary}
              duration={duration}
              stage={stage}
              t={t}
            />
          );
        })}
      </div>

      {/* 底部统计 */}
      {totalDuration > 0 && (
        <div className="ml-1 pl-3 pt-1 text-[10px] text-[#606070] flex items-center gap-1.5">
          <span>{(totalDuration / 1000).toFixed(1)}s</span>
        </div>
      )}
    </div>
  );
}

// ─── 单阶段手风琴 ────────────────────────────────────────
const INITIAL_VISIBLE = 5; // 分析师报告默认全部显示
const LOAD_MORE_STEP = 5; // 每次加载更多条数

function StageAccordion({
  stageKey, label, icon: Icon, summary, duration, stage, t,
}: {
  stageKey: string; label: string; icon: LucideIcon; summary: string;
  duration: string; stage: ResearchStage; t: TFunc;
}) {
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const content = extractStageContent(stageKey, stage, t);
  const isDone = stage.status === 'completed';
  const isFail = stage.status === 'failed';

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!content) return;
    if (open) {
      setOpen(false);
      setVisibleCount(INITIAL_VISIBLE); // 收起时重置
    } else {
      setOpen(true);
    }
  };

  const visibleItems = content ? content.slice(0, visibleCount) : [];
  const hasMore = content ? visibleCount < content.length : false;

  return (
    <div className="relative">
      {/* 左侧圆点 */}
      <div className={`absolute -left-[13px] top-[11px] w-1.5 h-1.5 rounded-full ${
        isDone ? 'bg-[#10B981]' : isFail ? 'bg-[#F43F5E]' : 'bg-[#2A2A3A]'
      }`} />

      {/* 行标题（点击展开/收起）*/}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center gap-2 py-2 text-xs group"
        disabled={!content}
      >
        <Icon className={`w-3 h-3 flex-shrink-0 ${
          isDone ? 'text-[#10B981]' : isFail ? 'text-[#F43F5E]' : 'text-[#606070]'
        }`} />
        <span className="text-[#F8F8FC] font-medium whitespace-nowrap">{label}</span>
        {summary && (
          <span className="text-[#606070] truncate flex-1 text-left">· {summary}</span>
        )}
        {stageKey === 'debate' && (() => {
          const entries = (stage.result as Record<string, unknown>)?.entries;
          if (!Array.isArray(entries) || entries.length === 0) return null;
          const uniqueModels = [...new Set(
            (entries as Array<Record<string, unknown>>)
              .map((e) => e.model as string)
              .filter(Boolean),
          )];
          if (uniqueModels.length === 0) return null;
          return (
            <div className="flex items-center -space-x-1 flex-shrink-0">
              {uniqueModels.slice(0, 4).map((modelId, i) => {
                const info = MODEL_DISPLAY[modelId];
                const name = info?.name || modelId;
                const color = info?.color || '#9090A0';
                return (
                  <span key={i}
                    className="w-4 h-4 rounded-full border border-[#12121A] flex items-center justify-center text-[7px] font-bold text-white"
                    style={{ backgroundColor: color }} title={name}>
                    {name.charAt(0).toUpperCase()}
                  </span>
                );
              })}
            </div>
          );
        })()}
        {duration && (
          <span className="text-[10px] text-[#606070] flex-shrink-0">{duration}</span>
        )}
        {content && (
          open
            ? <ChevronUp className="w-3 h-3 text-[#606070] flex-shrink-0" />
            : <ChevronDown className="w-3 h-3 text-[#606070] flex-shrink-0 group-hover:text-[#06B6D4] transition-colors" />
        )}
      </button>

      {/* 展开内容 — 渐进加载，整体滚动 */}
      {open && content && (
        <div className="pl-5 pb-3">
          {/* 内容区域 — 整体限高可滚动 */}
          <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
            {visibleItems.map((item, i) => (
              <div key={i}>
                {item.label && (
                  <div className="text-[10px] text-[#06B6D4] mb-0.5 font-medium">{item.label}</div>
                )}
                {item.modelId && (() => {
                  const info = MODEL_DISPLAY[item.modelId!];
                  const name = info?.name || item.modelId!;
                  const color = info?.color || '#9090A0';
                  return (
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: color }}>
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <span className="text-[10px]" style={{ color }}>{name}</span>
                    </div>
                  );
                })()}
                <div className="text-[#9090A0] text-xs leading-relaxed break-words">
                  <FormattedReport text={item.text} />
                </div>
              </div>
            ))}
          </div>

          {/* 加载更多 / 已全部加载 */}
          <div className="flex justify-center pt-2">
            {hasMore ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setVisibleCount((c) => c + LOAD_MORE_STEP); }}
                className="text-[10px] text-[#06B6D4] hover:text-[#0891B2] transition-colors flex items-center gap-0.5"
              >
                {t('common.loadMore')} ({visibleCount}/{content.length})
                <ChevronDown className="w-3 h-3" />
              </button>
            ) : content.length > INITIAL_VISIBLE ? (
              <span className="text-[10px] text-[#606070]">
                {t('timeline.loadedAll')} ({content.length}/{content.length})
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 一行摘要生成 ─────────────────────────────────────────
function getStageSummary(stageKey: string, stage: ResearchStage, t: TFunc): string {
  const data = stage.result as ResearchStageResult & Record<string, unknown>;
  if (!data) return '';

  switch (stageKey) {
    case 'analysts': {
      const reports = data.reports || data;
      if (typeof reports === 'object' && !Array.isArray(reports)) {
        const count = Object.keys(reports).filter(
          k => !['cost', 'context', 'latencyMs', 'totalCost', 'totalLatencyMs', 'errors', 'tokenUsage'].includes(k),
        ).length;
        return count > 0 ? t('research.reportCountShort', { count }) : '';
      }
      return '';
    }
    case 'debate': {
      const c = data.consensus as Record<string, unknown> | undefined;
      if (!c) return '';
      const dir = c.direction || c.action || '';
      const dirLabel = dir ? trDirection(dir, t) : '';
      const conf = c.confidence;
      return conf != null ? `${dirLabel} ${conf}%` : dirLabel;
    }
    case 'trader': {
      let p = data.proposal;
      if (typeof p === 'string') {
        try { p = JSON.parse(p.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()); } catch { return ''; }
      }
      if (typeof p === 'object' && p) {
        const pp = p as Record<string, unknown>;
        const parts = [
          pp.action && trAction(pp.action, t),
          pp.leverage && `${pp.leverage}x`,
          pp.positionSizePercent && `${pp.positionSizePercent}%`,
        ].filter(Boolean);
        return parts.join(' ');
      }
      return '';
    }
    case 'risk': {
      const approved = data.riskApproved ?? data.approved;
      const rating = data.riskRating || '';
      if (approved == null) return '';
      return `${approved ? t('timeline.approved') : t('timeline.rejected')}${rating ? ` · ${trRiskRating(rating, t)}` : ''}`;
    }
    case 'judge':
    case 'decision': {
      const safety = data.safetyPassed;
      const risk = data.riskApproved ?? data.approved;
      const parts: string[] = [];
      if (safety != null) parts.push(`${t('research.safetyShort')}${safety ? '✓' : '✗'}`);
      if (risk != null) parts.push(`${t('research.riskControlShort')}${risk ? '✓' : '✗'}`);
      return parts.join(' ');
    }
    default:
      return '';
  }
}

// ─── 完整内容提取 ─────────────────────────────────────────
function extractStageContent(
  stageKey: string,
  stage: ResearchStage,
  t: TFunc,
): Array<{ label?: string; text: string; modelId?: string }> | null {
  if (!stage) return null;
  const data = stage.result as ResearchStageResult & Record<string, unknown>;
  if (!data) return null;

  // ─── 分析师阶段 ───────────────────────────────────
  if (stageKey === 'analysts') {
    const reports = data.reports || data;
    if (typeof reports === 'object' && !Array.isArray(reports)) {
      const reportEntries = Object.entries(reports).filter(
        ([k]) => !['cost', 'context', 'latencyMs', 'totalCost', 'totalLatencyMs', 'errors', 'tokenUsage'].includes(k),
      );
      if (reportEntries.length > 0) {
        return reportEntries.map(([key, val]: [string, unknown]) => {
          // 统一将值转为对象（后端可能存 JSON 字符串或对象）
          let v: Record<string, unknown> | null = null;
          if (typeof val === 'string') {
            // 尝试 JSON 解析；纯文本报告直接使用
            try {
              const parsed = JSON.parse(val);
              if (typeof parsed === 'object' && parsed !== null) {
                v = parsed;
              } else {
                return { label: analystLabelMap(key, t), text: val };
              }
            } catch {
              return { label: analystLabelMap(key, t), text: val };
            }
          } else {
            v = val as Record<string, unknown> | null;
          }

          // 从结构化字段提取可读文本
          const parts: string[] = [];

          // 维度评分标签（跟随 locale）
          const dimLabels: Record<string, string> = {
            trend: t('research.dimTrend'),
            momentum: t('research.dimMomentum'),
            volatility: t('research.dimVolatility'),
            volume: t('research.dimVolume'),
          };
          const signalLabels: Record<string, string> = {
            BULLISH: t('research.sigBullish'),
            BEARISH: t('research.sigBearish'),
            NEUTRAL: t('research.sigNeutral'),
            STRONG: t('research.sigStrong'),
            MODERATE: t('research.sigModerate'),
            WEAK: t('research.sigWeak'),
            CONFLICTING: t('research.sigConflicting'),
          };
          const trSignal = (s: string) => signalLabels[s?.toUpperCase()] || s;

          // 格式化 dimensionScores 对象为可读文本
          const formatDimScores = (obj: Record<string, unknown>): string | null => {
            const o = obj as Record<string, unknown>;
            if (!o.dimensionScores || typeof o.dimensionScores !== 'object') return null;
            const ds = o.dimensionScores as Record<string, string>;
            const lines: string[] = [];
            lines.push(`${t('research.dimScores')}:`);
            for (const [dk, dv] of Object.entries(ds)) {
              lines.push(`  • ${dimLabels[dk] || dk}: ${trSignal(dv)}`);
            }
            if (typeof o.crossValidationResult === 'string') {
              lines.push('', `${t('research.crossValidation')}: ${trSignal(o.crossValidationResult)}`);
            }
            if (typeof o.reasoning === 'string') {
              lines.push('', o.reasoning);
            }
            return lines.join('\n');
          };

          // 安全提取字符串值（防止 [object Object]）
          const safeStr = (x: unknown): string | null => {
            if (typeof x === 'string') return x;
            if (x && typeof x === 'object') {
              const o = x as Record<string, unknown>;
              // 1) dimensionScores 结构检测（技术分析师输出）— 优先级最高
              const dimResult = formatDimScores(o);
              if (dimResult) return dimResult;
              // 2) 嵌套 analysis 对象
              if (o.analysis && typeof o.analysis === 'object') {
                const nested = formatDimScores(o.analysis as Record<string, unknown>);
                if (nested) return nested;
              }
              // 3) 提取顶层字符串字段
              for (const k of ['report', 'reasoning', 'summary', 'content', 'text', 'message']) {
                if (typeof o[k] === 'string') return o[k] as string;
              }
              // 4) 兜底：提取所有较长字符串值拼接
              const strs: string[] = [];
              for (const [, sv] of Object.entries(o)) {
                if (typeof sv === 'string' && sv.length > 10) strs.push(sv);
              }
              if (strs.length > 0) return strs.join('\n\n');
              return JSON.stringify(x, null, 2);
            }
            return null;
          };

          const reportVal = safeStr(v?.report);
          if (reportVal && !reportVal.startsWith('{')) {
            parts.push(reportVal);
          } else {
            // 依次尝试 reasoning / summary / analysis
            for (const field of ['reasoning', 'summary', 'analysis'] as const) {
              const s = safeStr(v?.[field]);
              if (s && !s.startsWith('{')) { parts.push(s); break; }
            }
          }
          if (Array.isArray(v?.keyPoints) && v.keyPoints.length > 0) {
            if (parts.length > 0) parts.push('');
            for (const kp of v.keyPoints) {
              if (typeof kp === 'string') parts.push(`• ${kp}`);
              else if (kp && typeof kp === 'object') {
                const s = safeStr(kp);
                if (s && !s.startsWith('{')) parts.push(`• ${s}`);
              }
            }
          }
          const text = parts.length > 0 ? parts.join('\n') : (typeof val === 'string' ? val : JSON.stringify(val, null, 2));
          const biasStr = typeof v?.bias === 'string' ? v.bias : null;
          return {
            label: `${analystLabelMap(key, t)}${biasStr ? ` [${trDirection(biasStr, t)}]` : ''}`,
            text,
          };
        });
      }
    }
  }

  // ─── 辩论阶段 ─────────────────────────────────────
  if (stageKey === 'debate' && data.entries) {
    const debateEntries = Array.isArray(data.entries) ? data.entries : [];
    const items = debateEntries.map((e: Record<string, unknown>) => {
      const args = e.arguments as Record<string, unknown> | undefined;
      let text = '';
      if (typeof e.content === 'string') {
        text = e.content;
      } else if (typeof e.message === 'string') {
        text = e.message;
      } else if (args) {
        const parts: string[] = [];
        if (args.vote || args.action) parts.push(`${t('detail.voteDirection')}: ${trDirection(args.vote || args.action, t)}`);
        if (typeof args.reasoning === 'string') parts.push(args.reasoning);
        if (Array.isArray(args.keyPoints)) {
          for (const kp of args.keyPoints) {
            if (typeof kp === 'string') parts.push(`• ${kp}`);
          }
        }
        text = parts.length > 0 ? parts.join('\n') : JSON.stringify(args, null, 2);
      } else {
        // 兜底：尝试提取可读字段
        const parts: string[] = [];
        if (typeof e.reasoning === 'string') parts.push(e.reasoning as string);
        if (typeof e.vote === 'string') parts.push(`${t('detail.voteDirection')}: ${trDirection(e.vote, t)}`);
        text = parts.length > 0 ? parts.join('\n') : JSON.stringify(e, null, 2);
      }

      const roleLower = e.role ? String(e.role).toLowerCase() : '';
      const roleKey = DEBATE_ROLE_I18N[roleLower];
      const roleLabel = roleKey ? t(roleKey) : (e.role ? String(e.role) : t('timeline.debater'));
      const roundNum = Number(e.round);
      const roundLabel = roundNum === -1
        ? t('timeline.finalVote')
        : t('timeline.roundN', { n: isNaN(roundNum) ? '?' : roundNum });
      const confVal = e.confidence ?? (args as Record<string, unknown> | undefined)?.confidence;
      const conf = confVal != null ? ` · ${confVal}%` : '';
      const modelId = String(e.model || '') || undefined;

      return { label: `${roleLabel} ${roundLabel}${conf}`, text, modelId };
    });

    // 共识结果
    if (data.consensus && typeof data.consensus === 'object') {
      const c = data.consensus as Record<string, unknown>;
      const conParts = [
        c.action && `${t('timeline.decision')}: ${trAction(c.action, t)}`,
        c.direction && `${t('detail.voteDirection')}: ${trDirection(c.direction, t)}`,
        c.confidence != null && `${t('research.confidence')}: ${c.confidence}%`,
        typeof c.reasoning === 'string' && c.reasoning,
      ].filter(Boolean);
      if (conParts.length > 0) {
        items.push({ label: `→ ${t('timeline.consensus')}`, text: conParts.join('\n'), modelId: undefined });
      }
    }

    return items.length > 0 ? items : null;
  }

  // ─── 交易员阶段 ───────────────────────────────────
  if (stageKey === 'trader' && data.proposal != null) {
    const rawP = data.proposal;
    if (typeof rawP === 'string') {
      const cleaned = rawP.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      try {
        const parsed = JSON.parse(cleaned);
        return formatTraderProposal(parsed, t);
      } catch {
        return [{ text: cleaned }];
      }
    }
    return formatTraderProposal(rawP as Record<string, unknown>, t);
  }

  // ─── 风控阶段 ─────────────────────────────────────
  if (stageKey === 'risk') {
    const approved = data.riskApproved ?? data.approved;
    const parts = [
      approved != null && `${t('timeline.approval')}: ${approved ? `✅ ${t('timeline.approved')}` : `❌ ${t('timeline.rejected')}`}`,
      data.riskRating && `${t('timeline.riskLevel')}: ${trRiskRating(data.riskRating, t)}`,
      data.adjustedLeverage && `${t('research.leverage')}: ${data.adjustedLeverage}x`,
      typeof data.reasoning === 'string' && data.reasoning,
    ].filter(Boolean);
    if (parts.length > 0) return [{ text: parts.join('\n') }];
  }

  // ─── 决策阶段 ─────────────────────────────────────
  if (stageKey === 'judge' || stageKey === 'decision' || data.decision || data.action) {
    const dec = data.decision;
    const action = dec?.action || data.action;
    const confidence = dec?.confidence ?? data.confidence;
    const leverage = dec?.leverage || data.leverage;
    const direction = dec?.direction || data.direction;
    const positionSizePercent = dec?.positionSizePercent || data.positionSizePercent;
    const stopLoss = dec?.stopLoss || data.stopLoss;
    const takeProfit = dec?.takeProfit || data.takeProfit;
    const reasoning = dec?.reasoning || data.reasoning;

    // 翻译 reasoning 中的后端标签
    const cleanReasoning = reasoning ? cleanBackendTags(String(reasoning), t) : '';
    // 检测 AI 解析失败回退
    const isFallback = cleanReasoning.includes('未输出有效决策格式') || cleanReasoning.includes('回退动作') || confidence === 0;

    const parts = [
      data.safetyPassed != null && `${t('research.safetyShort')}: ${data.safetyPassed ? '✅' : '❌'}`,
      (data.riskApproved ?? data.approved) != null && `${t('timeline.approval')}: ${(data.riskApproved ?? data.approved) ? '✅' : '❌'}`,
      action && `${t('timeline.decision')}: ${trAction(action, t)}`,
      confidence != null && `${t('research.confidence')}: ${confidence}%`,
      leverage && `${t('research.leverage')}: ${leverage}x`,
      positionSizePercent && `${t('timeline.positionSize')}: ${positionSizePercent}%`,
      direction && `${t('detail.voteDirection')}: ${trDirection(direction, t)}`,
      stopLoss && `${t('timeline.slLabel')}: $${Number(stopLoss).toLocaleString()}`,
      takeProfit && `${t('timeline.tpLabel')}: $${Number(takeProfit).toLocaleString()}`,
      isFallback && t('timeline.aiFallbackWarning'),
      cleanReasoning,
    ].filter(Boolean);
    if (parts.length > 0) return [{ text: parts.join('\n') }];
  }

  // ─── 兜底 ─────────────────────────────────────────
  if (typeof data === 'object') {
    const filtered: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (!['cost', 'context', 'latencyMs', 'tokenUsage',
          'systemPrompt', 'userPrompt', 'chainOfThought',
          'debateHistory', 'totalCost', 'totalLatencyMs', 'errors'].includes(k)) {
        filtered[k] = v;
      }
    }
    const str = JSON.stringify(filtered, null, 2);
    if (str.length > 10) return [{ text: str }];
  }

  return null;
}

// ─── 格式化交易员提案 ────────────────────────────────────
function formatTraderProposal(
  p: Record<string, unknown>,
  t: TFunc,
): Array<{ label?: string; text: string }> {
  const reasonStr = typeof p.reasoning === 'string' ? cleanBackendTags(p.reasoning, t) : '';
  const parts = [
    p.action && `${t('timeline.decision')}: ${trAction(p.action, t)}`,
    p.leverage && `${t('research.leverage')}: ${p.leverage}x`,
    p.positionSizePercent && `${t('timeline.positionSize')}: ${p.positionSizePercent}%`,
    p.stopLoss && `${t('timeline.slLabel')}: $${Number(p.stopLoss).toLocaleString()}`,
    p.takeProfit && `${t('timeline.tpLabel')}: $${Number(p.takeProfit).toLocaleString()}`,
    p.confidence != null && `${t('research.confidence')}: ${p.confidence}%`,
    reasonStr,
  ].filter(Boolean);
  return [{ text: parts.join('\n') }];
}

function analystLabelMap(key: string, t: TFunc): string {
  switch (key) {
    case 'market': case 'marketReport': return t('research.analystMarket');
    case 'technical': case 'technicalReport': return t('research.analystTechnical');
    case 'fundamental': case 'fundamentalsReport': return t('research.analystFundamental');
    case 'news': case 'newsReport': return t('research.analystNews');
    case 'sentiment': case 'sentimentReport': return t('research.analystSentiment');
    default: return key;
  }
}

// ─── 智能分段：LLM 输出常无换行，检测逻辑断点插入换行 ─────────
function smartSplit(raw: string): string[] {
  let text = raw;

  // ── 1. 编号列表前插入换行 ──
  // 标点（句末 + 逗号 + 分号 + 冒号）后跟编号 → 编号前换行
  // 不会误拆 EMA(12)，因为 EMA 不是标点
  const pun = '。！？\\.\\?\\!，,；;：:';
  text = text.replace(new RegExp(`([${pun}])\\s*(\\d{1,3}[）\\)])`, 'g'), '$1\n$2');
  text = text.replace(new RegExp(`([${pun}])\\s*(（\\d{1,3}）)`, 'g'), '$1\n$2');
  text = text.replace(new RegExp(`([${pun}])\\s*(\\(\\d{1,3}\\))`, 'g'), '$1\n$2');

  // ── 2. 列表标记前换行 ──
  text = text.replace(/([^\n])([•·])\s/g, '$1\n$2 ');
  text = text.replace(/([^\n\s])([-–]\s)/g, '$1\n$2');

  // ── 3. **标题** 前换行 ──
  text = text.replace(/([^\n])(\*\*[^*]+\*\*)/g, '$1\n$2');

  // ── 4. 分隔符 ──
  text = text.replace(/\s*[-=]{3,}\s*/g, '\n\n');
  text = text.replace(/===\s*(.+?)\s*===/g, '\n**$1**\n');

  // ── 5. 分行 + 长行拆分 ──
  const lines = text.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { result.push(''); continue; }
    // 超长行（>200字无编号/列表头）在句末标点后拆分
    if (trimmed.length > 200 && !/^[\d•·\-（(]/.test(trimmed)) {
      result.push(...trimmed.split(/(?<=[。！？])/).map(s => s.trim()).filter(Boolean));
    } else {
      result.push(trimmed);
    }
  }

  // ── 6. 合并孤立编号行 ──
  // 如果某行只有编号（"(1)" "1）" "（2）"），合并到下一行
  const merged: string[] = [];
  for (let i = 0; i < result.length; i++) {
    const t = result[i].trim();
    if (/^[（(]?\d{1,3}[）\)、.\s]*$/.test(t) && t.length <= 6) {
      if (i + 1 < result.length && result[i + 1].trim()) {
        merged.push(t + (t.endsWith(' ') ? '' : '') + result[i + 1].trim());
        i++;
      } else {
        merged.push(result[i]);
      }
    } else {
      merged.push(result[i]);
    }
  }

  return merged.filter(l => l.trim());
}

// ─── 格式化报告文本（智能分段 + 标题 + 列表 + 指标） ────────────
function FormattedReport({ text }: { text: string }) {
  if (!text) return null;
  const lines = smartSplit(text);

  return (
    <div className="space-y-0.5">
      {lines.map((line, li) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={li} className="h-1.5" />;

        // **粗体标题**
        if (/^\*\*.*\*\*[：:]*\s*$/.test(trimmed)) {
          return <div key={li} className="font-medium text-[#c0c0d0] mt-2 mb-0.5">{trimmed.replace(/\*\*/g, '')}</div>;
        }
        // 编号项: 1）2）(1) 1. 1、
        if (/^[\d]+[）\)、.]\s*/.test(trimmed) || /^[（(]\d+[）)]/.test(trimmed)) {
          const num = trimmed.match(/^[\d（(]+[）\)、.]/)?.[0] || '';
          return (
            <div key={li} className="pl-1 mt-1">
              <span className="text-[#06B6D4] font-mono text-[10px] mr-1">{num}</span>
              <span>{trimmed.replace(/^[\d（(]+[）\)、.\s]+/, '')}</span>
            </div>
          );
        }
        // • · - 列表项
        if (/^[•·\-–]\s/.test(trimmed)) {
          return (
            <div key={li} className="pl-3 relative mt-0.5">
              <span className="absolute left-0 text-[#06B6D4]">•</span>
              <span>{trimmed.replace(/^[•·\-–]\s*/, '')}</span>
            </div>
          );
        }
        // 维度评分行
        if (/^\s*(趋势|动量|波动率|成交量|Trend|Momentum|Volatility|Volume)\s*[:：]/i.test(trimmed)) {
          return (
            <div key={li} className="pl-3 relative mt-0.5">
              <span className="absolute left-0 text-[#06B6D4]">•</span>
              <span>{trimmed}</span>
            </div>
          );
        }
        // 关键指标行（Key: Value 格式，短行）
        if (/^[A-Z][A-Za-z\s&]+[:：]/.test(trimmed) && trimmed.length < 120) {
          const idx = trimmed.search(/[:：]/);
          return (
            <div key={li} className="mt-0.5">
              <span className="text-[#8080A0]">{trimmed.slice(0, idx + 1)}</span>
              <span className="text-[#F8F8FC] ml-1">{trimmed.slice(idx + 1).trim()}</span>
            </div>
          );
        }
        // → 箭头说明行
        if (/^→\s/.test(trimmed)) {
          return <div key={li} className="pl-4 text-[#8080A0] italic mt-0.5">{trimmed}</div>;
        }
        // 普通文本
        return <div key={li} className="mt-1 leading-relaxed">{trimmed}</div>;
      })}
    </div>
  );
}
