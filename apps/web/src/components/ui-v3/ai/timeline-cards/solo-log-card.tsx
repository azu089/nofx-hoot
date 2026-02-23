'use client';

import { useState } from 'react';
import { Zap, Check, Clock, Shield, Pause, Grid3X3, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { ACTION_CONFIG, MODEL_DISPLAY } from '@/constants/debate';
import { TruncatedText } from './truncated-text';
import type { TimelineSoloLog } from '@/types/ai';
import { useTranslations } from '@/i18n/provider';

type TFunc = (key: string, params?: Record<string, string | number>) => string;

/** 清理旧版英文回退前缀，提取 <reasoning> 标签中的实际内容 */
function cleanReasoning(raw: string | undefined): string {
  if (!raw) return '';
  const prefixMatch = raw.match(/^Model .*?;\s*summary:\s*<reasoning>\s*([\s\S]*)$/);
  if (prefixMatch) {
    return prefixMatch[1].replace(/<\/reasoning>\s*$/, '').trim();
  }
  return raw;
}

const ACTION_I18N: Record<string, string> = {
  open_long: 'detail.actionOpenLong', open_short: 'detail.actionOpenShort',
  close_long: 'detail.actionCloseLong', close_short: 'detail.actionCloseShort',
  hold: 'detail.actionHold', wait: 'detail.actionWait',
};

/** 清理后端标签为用户可读文本 */
function cleanBackendTags(text: string, t: TFunc): string {
  let s = cleanReasoning(text);
  s = s.replace(/\[RISK REJECTED\]/gi, `[${t('timeline.rejected')}]`);
  s = s.replace(/\[RISK APPROVED\]/gi, `[${t('timeline.approved')}]`);
  s = s.replace(/Rating:\s*(EXTREME|VERY[_ ]HIGH|HIGH|MEDIUM|LOW|CRITICAL)/gi, (_, lv) => {
    const rMap: Record<string, string> = {
      extreme: 'timeline.riskExtreme', very_high: 'timeline.riskVeryHigh',
      high: 'timeline.riskHigh', medium: 'timeline.riskMedium',
      low: 'timeline.riskLow', critical: 'timeline.riskCritical',
    };
    const k = rMap[lv.toLowerCase().replace(/[\s]+/g, '_')];
    return `${t('timeline.riskLevel')}: ${k ? t(k) : lv}`;
  });
  s = s.replace(/回退动作:\s*(hold|wait|open_long|open_short|close_long|close_short)/gi, (_, act) => {
    const k = ACTION_I18N[act.toLowerCase()];
    return `${t('timeline.fallbackAction')}: ${k ? t(k) : act}`;
  });
  return s;
}

/** 从完整 reasoning 提取简短等待/持仓原因（1行） */
function briefWaitReason(text: string, t: TFunc): string {
  // 1. 风控拒绝 → 提取评级
  const riskMatch = text.match(/\[RISK REJECTED\]\s*Rating:\s*(\w+)/i);
  if (riskMatch) {
    const rMap: Record<string, string> = {
      extreme: 'timeline.riskExtreme', very_high: 'timeline.riskVeryHigh',
      high: 'timeline.riskHigh', medium: 'timeline.riskMedium',
      low: 'timeline.riskLow', critical: 'timeline.riskCritical',
    };
    const k = rMap[riskMatch[1].toLowerCase().replace(/[\s]+/g, '_')];
    const rating = k ? t(k) : riskMatch[1];
    return `${t('detail.riskRejected')}: ${t('timeline.riskLevel')} ${rating}`;
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
    && !/^[^\u4e00-\u9fff]*[：:]\s*$/i.test(l), // 排除纯标题
  );
  if (signalLine) {
    const cleaned = cleanBackendTags(signalLine, t);
    return cleaned.length > 80 ? cleaned.slice(0, 80) + '…' : cleaned;
  }

  // 4. 跳过章节标题（"xxx分析：" / "xxx：" 格式），取第一个有内容的行
  const contentLine = lines.find(l =>
    !/^[\w\u4e00-\u9fff]{1,8}[：:]\s*$/.test(l) // 排除纯标题行
    && l.length > 4, // 排除过短行
  );
  if (contentLine) {
    const cleaned = cleanBackendTags(contentLine, t);
    return cleaned.length > 80 ? cleaned.slice(0, 80) + '…' : cleaned;
  }

  return cleanBackendTags(text, t).slice(0, 80);
}

/** Grid 操作标签 — i18n key 映射 */
const GRID_ACTION_I18N: Record<string, { key: string; color: string }> = {
  place_buy_limit: { key: 'timeline.gridPlaceBuy', color: '#10B981' },
  place_sell_limit: { key: 'timeline.gridPlaceSell', color: '#F43F5E' },
  cancel_order: { key: 'timeline.gridCancel', color: '#94A3B8' },
  adjust_grid: { key: 'timeline.gridAdjust', color: '#8B5CF6' },
  pause_grid: { key: 'timeline.gridPause', color: '#F59E0B' },
  exit_all: { key: 'timeline.gridExitAll', color: '#F43F5E' },
  reduce_exposure: { key: 'timeline.gridReduce', color: '#F59E0B' },
};

function formatTimeAgo(dateStr: string, t: TFunc): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('common.justNow');
  if (mins < 60) return t('common.minutesAgo', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('common.hoursAgo', { count: hrs });
  return t('common.daysAgo', { count: Math.floor(hrs / 24) });
}

/** 计算 SL/TP 百分比 */
function calcPct(entry: number, target: number): string {
  if (!entry || !target) return '';
  const pct = ((target - entry) / entry) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/** 计算 R:R 比 */
function calcRiskReward(entry: number, sl: number, tp: number): number | null {
  if (!entry || !sl || !tp) return null;
  const risk = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (risk === 0) return null;
  return reward / risk;
}

/** 优先用百分比算 R:R（与后端 safety.service L9 一致） */
function calcRiskRewardFromPct(slPct?: number, tpPct?: number): number | null {
  if (!slPct || !tpPct || slPct <= 0) return null;
  return tpPct / slPct;
}

/** R:R 评级颜色 */
function rrColor(rr: number): string {
  if (rr >= 2) return '#22C55E';
  if (rr >= 1) return '#F59E0B';
  return '#F43F5E';
}

interface SoloLogCardProps {
  entry: TimelineSoloLog;
}

export function SoloLogCard({ entry }: SoloLogCardProps) {
  const t = useTranslations('ai');
  const { log, strategy } = entry;
  const d = log.decision;
  const er = log.executionResult;

  // 检测 Grid 网格日志格式: decision.decisions 数组
  const gridDecisions: any[] = Array.isArray(d.decisions) ? d.decisions : [];
  const isGridLog = gridDecisions.length > 0;
  // 检测自动禁用日志
  const isAutoDisabled = d.action === 'auto_disabled_failure';

  // Grid: 提取整体市场分析（adjust_grid 推理最详细），与下方操作详情不重复
  const gridAnalysisText = isGridLog
    ? (() => {
        // 优先取 adjust_grid 的推理（包含市场分析）
        const adjustReasonings = gridDecisions
          .filter((op: any) => op.action === 'adjust_grid' && op.reasoning)
          .map((op: any) => op.reasoning);
        if (adjustReasonings.length > 0) return adjustReasonings.join('\n\n');
        // 降级：取最长的推理作为整体分析
        const allR = gridDecisions.map((op: any) => op.reasoning).filter(Boolean);
        return allR.sort((a: string, b: string) => b.length - a.length)[0] || '';
      })()
    : '';
  const reasoning = isGridLog
    ? gridAnalysisText
    : (d.reasoning || d.reason || '');

  const action = isAutoDisabled ? 'hold' : (d.action || (isGridLog ? gridDecisions[0]?.action : 'hold') || 'hold');
  const actionCfg = ACTION_CONFIG[action] || ACTION_CONFIG['wait'];
  const isWait = !isGridLog && !isAutoDisabled && action === 'wait';
  const isHoldPos = !isGridLog && !isAutoDisabled && action === 'hold';
  const isCloseAction = action === 'close_long' || action === 'close_short';

  // 估算入场价
  const entryPrice = er?.price || (d.stopLoss && d.takeProfit
    ? ((d.stopLoss || 0) + (d.takeProfit || 0)) / 2
    : 0);

  // R:R — 优先用百分比（与后端 L9 safety check 一致），fallback 用价格
  const rr = calcRiskRewardFromPct(d.stopLossPct, d.takeProfitPct)
    ?? (d.stopLoss && d.takeProfit && entryPrice
      ? calcRiskReward(entryPrice, d.stopLoss, d.takeProfit)
      : null);

  // Grid: 折叠状态
  const [showGridOps, setShowGridOps] = useState(false);

  return (
    <div className="glass-border-glow glass-card p-4 space-y-3">
      {/* === 标题行 === */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          {isGridLog ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F59E0B]/20 text-[#F59E0B] font-semibold text-xs">
              <Grid3X3 className="w-3.5 h-3.5" />
              {t('modes.grid')}
            </span>
          ) : isAutoDisabled ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B]">
              <AlertTriangle className="w-3 h-3" />
              {t('modes.solo')}
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B]">
              <Zap className="w-3 h-3" />
              {t('modes.solo')}
            </span>
          )}
          <span className="text-[#F8F8FC] font-medium">{log.symbol || strategy.name}</span>
        </div>
        <span className="text-[10px] text-[#606070]">{formatTimeAgo(log.createdAt, t as TFunc)}</span>
      </div>

      {/* === 内容区 — 限高可滚动 === */}
      <div className="max-h-[400px] overflow-y-auto space-y-3">
      {/* === 自动禁用 — 错误信息 === */}
      {isAutoDisabled && (
        <div className="text-xs text-[#F59E0B]">
          {d.reason || t('timeline.autoPaused')}
          {d.lastError && (
            <div className="mt-1">
              <TruncatedText text={d.lastError} maxLines={2} />
            </div>
          )}
        </div>
      )}

      {/* === 普通 Solo: 决策 + 参数（wait/hold 由底部状态栏表达，此处不重复） === */}
      {!isGridLog && !isAutoDisabled && (
        <div className="space-y-2">
          {(action === 'open_long' || action === 'open_short'
            || action === 'close_long' || action === 'close_short') && (
            <>
              <div className="flex items-center gap-3">
                <span
                  className="px-2.5 py-1 rounded-md text-xs font-semibold"
                  style={{ color: actionCfg.color, backgroundColor: actionCfg.bg }}
                >
                  {ACTION_I18N[action] ? t(ACTION_I18N[action]) : actionCfg.label}
                </span>
                {d.confidence != null && (
                  <span className="text-xs text-[#9090A0]">
                    {t('research.confidence')} <span className={`font-mono ${d.confidence > 0 ? 'text-[#F8F8FC]' : 'text-[#F43F5E]'}`}>{d.confidence}%</span>
                  </span>
                )}
                {d.leverage != null && d.leverage > 1 && (
                  <span className="text-xs text-[#9090A0]">
                    {t('research.leverage')} <span className="text-[#F8F8FC] font-mono">{d.leverage}x</span>
                  </span>
                )}
                {d.positionSizePercent != null && (
                  <span className="text-xs text-[#9090A0]">
                    {t('research.position') || '仓位'} <span className="text-[#F8F8FC] font-mono">{d.positionSizePercent}%</span>
                  </span>
                )}
                {d.modelId && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1A1A2E] text-[#4A4A6A]">
                    {d.modelId}
                  </span>
                )}
              </div>

            </>
          )}

          {/* 推理文本 — 始终显示（即使 wait/hold 也有分析价值） */}
          {reasoning && (
            <div className="text-xs text-[#9090A0] leading-relaxed">
              <TruncatedText text={cleanReasoning(reasoning)} maxLines={3} />
            </div>
          )}

          {/* SL/TP + R:R (放在推理之后) */}
          {(d.stopLoss != null || d.takeProfit != null) && (
            <div className="flex items-center gap-4 text-xs">
              {d.stopLoss != null && (
                <span className="text-[#F43F5E]">
                  {t('timeline.slLabel')}: <span className="font-mono">${Number(d.stopLoss).toLocaleString()}</span>
                  <span className="opacity-70 ml-1">
                    ({d.stopLossPct ? `-${(d.stopLossPct * 100).toFixed(1)}%` : entryPrice > 0 ? calcPct(entryPrice, d.stopLoss) : ''})
                  </span>
                </span>
              )}
              {d.takeProfit != null && (
                <span className="text-[#10B981]">
                  {t('timeline.tpLabel')}: <span className="font-mono">${Number(d.takeProfit).toLocaleString()}</span>
                  <span className="opacity-70 ml-1">
                    ({d.takeProfitPct ? `+${(d.takeProfitPct * 100).toFixed(1)}%` : entryPrice > 0 ? calcPct(entryPrice, d.takeProfit) : ''})
                  </span>
                </span>
              )}
              {rr != null && (
                <span className="flex items-center gap-1">
                  <span className="text-[10px] text-[#606070]">{t('timeline.rrLabel')}</span>
                  <span className="font-mono font-semibold" style={{ color: rrColor(rr) }}>
                    1:{rr.toFixed(1)}
                  </span>
                  <div className="w-12 h-1.5 bg-[#1E1E2E] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.min(100, (rr / 3) * 100)}%`, backgroundColor: rrColor(rr) }}
                    />
                  </div>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* === Grid 网格内容 === */}
      {isGridLog && (
        <div className="space-y-3">
          {/* 操作摘要 */}
          <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-semibold bg-[#06B6D4]/15 text-[#06B6D4]">
            {(() => {
              const counts: Record<string, number> = {};
              for (const op of gridDecisions) counts[op.action] = (counts[op.action] || 0) + 1;
              const SHORT_KEYS: Record<string, string> = {
                place_buy_limit: 'timeline.gridBuyShort',
                place_sell_limit: 'timeline.gridSellShort',
                cancel_order: 'timeline.gridCancelShort',
                adjust_grid: 'timeline.gridAdjustShort',
                pause_grid: 'timeline.gridPauseShort',
                exit_all: 'timeline.gridExitShort',
                reduce_exposure: 'timeline.gridReduceShort',
              };
              const parts = Object.entries(counts).map(([act, n]) => {
                const key = SHORT_KEYS[act];
                const label = key ? t(key) : act;
                return `${n}${label}`;
              });
              return parts.join('/') || `${gridDecisions.length} ops`;
            })()}
          </span>

          {/* 网格状态快照（后端 gridSnapshot 字段） */}
          {d.gridSnapshot && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#606070]">{t('timeline.gridRange')}</span>
                <span className="font-mono text-[#F8F8FC]">${d.gridSnapshot.lowerPrice}~${d.gridSnapshot.upperPrice}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#606070]">{t('timeline.gridLevels')}</span>
                <span className="text-[#F8F8FC]">{d.gridSnapshot.filledLevels}/{d.gridSnapshot.totalLevels}</span>
              </div>
              {d.gridSnapshot.totalProfit != null && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">{t('timeline.gridProfit')}</span>
                  <span className={`font-mono ${d.gridSnapshot.totalProfit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {d.gridSnapshot.totalProfit >= 0 ? '+' : ''}{d.gridSnapshot.totalProfit.toFixed(2)}
                  </span>
                </div>
              )}
              {d.gridSnapshot.winRate != null && d.gridSnapshot.totalTrades > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">{t('timeline.gridWinRate')}</span>
                  <span className="text-[#F8F8FC]">{d.gridSnapshot.winRate}% ({d.gridSnapshot.totalTrades})</span>
                </div>
              )}
              {d.gridSnapshot.pendingLevels != null && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">挂单层</span>
                  <span className="text-[#F8F8FC]">{d.gridSnapshot.pendingLevels}</span>
                </div>
              )}
              {d.gridSnapshot.activeOrders != null && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">活跃订单</span>
                  <span className="text-[#F8F8FC]">{d.gridSnapshot.activeOrders}</span>
                </div>
              )}
              {d.gridSnapshot.dailyPnl != null && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">日内盈亏</span>
                  <span className={`font-mono ${d.gridSnapshot.dailyPnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {d.gridSnapshot.dailyPnl >= 0 ? '+' : ''}{d.gridSnapshot.dailyPnl.toFixed(2)}
                  </span>
                </div>
              )}
              {d.gridSnapshot.maxDrawdown != null && d.gridSnapshot.maxDrawdown > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">最大回撤</span>
                  <span className="font-mono text-[#EF4444]">{d.gridSnapshot.maxDrawdown.toFixed(1)}%</span>
                </div>
              )}
              {d.gridSnapshot.direction && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">方向</span>
                  <span className="text-[#F8F8FC]">{d.gridSnapshot.direction}</span>
                </div>
              )}
              {d.gridSnapshot.regime && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">市场形态</span>
                  <span className="text-[#F8F8FC]">{d.gridSnapshot.regime}</span>
                </div>
              )}
              {d.gridSnapshot.breakoutLevel && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">突破级别</span>
                  <span className="text-[#F8F8FC]">{d.gridSnapshot.breakoutLevel}</span>
                </div>
              )}
              {d.gridSnapshot.gridSpacing != null && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">格线间距</span>
                  <span className="font-mono text-[#F8F8FC]">${d.gridSnapshot.gridSpacing.toFixed(4)}</span>
                </div>
              )}
            </div>
          )}

          {/* AI 思考链（DeepSeek-Reasoner / Claude 扩展思考） */}
          {d.aiThinking && (
            <div className="text-[10px] text-[#606070] leading-relaxed border-l-2 border-[#2E2E3E] pl-2">
              <span className="text-[#4A4A5A] text-[9px]">思考链 · </span>
              <TruncatedText text={d.aiThinking as string} maxLines={3} />
            </div>
          )}

          {/* AI 市场分析 — 只显示整体分析，不显示逐条操作推理 */}
          {gridAnalysisText && (
            <div className="text-xs text-[#9090A0] leading-relaxed">
              <TruncatedText text={cleanReasoning(gridAnalysisText)} maxLines={1} />
            </div>
          )}

        </div>
      )}
      </div>{/* 关闭滚动容器 */}

      {/* === 网格展开按钮 + 操作详情（在滚动容器外，始终可见） === */}
      {isGridLog && gridDecisions.length > 0 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowGridOps(!showGridOps); }}
            className="w-full flex items-center justify-center gap-1.5 py-2 border-t border-[#1E1E2E] text-[11px] text-[#606070] hover:text-[#9090A0] transition-colors"
          >
            {t('timeline.gridOpsCount', { count: gridDecisions.length })}
            {showGridOps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showGridOps && (
            <div className="space-y-1 max-h-[300px] overflow-y-auto px-1">
              {gridDecisions.map((op: any, idx: number) => {
                const opCfg = GRID_ACTION_I18N[op.action];
                const opColor = opCfg?.color || '#9090A0';
                const opLabel = opCfg ? t(opCfg.key) : op.action;
                return (
                  <div key={idx} className="flex items-start gap-2 py-1.5 border-t border-[#1E1E2E]/30 first:border-t-0">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
                      style={{ color: opColor, backgroundColor: `${opColor}15` }}
                    >
                      {opLabel}
                    </span>
                    <div className="flex-1 min-w-0 text-[10px] flex flex-wrap items-center gap-1.5">
                      {op.price && (
                        <span className="font-mono text-[#F8F8FC]">${Number(op.price).toLocaleString()}</span>
                      )}
                      {op.quantity && (
                        <span className="font-mono text-[#9090A0]">x{op.quantity}</span>
                      )}
                      {op.level_index != null && (
                        <span className="text-[#606070]">L{op.level_index}</span>
                      )}
                      {op.reasoning && (
                        <span className="w-full text-[#606070] text-[9px] leading-tight mt-0.5 line-clamp-2">
                          {op.reasoning}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* === 执行状态 === */}
      <div className="border-t border-[#1E1E2E] pt-2">
        {isAutoDisabled ? (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#F59E0B]/5 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[#F59E0B] font-medium">{t('timeline.autoPaused')}</span>
              {d.reason && <span className="text-[#606070]"> · {d.reason}</span>}
            </div>
          </div>
        ) : er?.blocked ? (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#F59E0B]/5 text-xs">
            <Shield className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[#F59E0B] font-medium">{t('timeline.blocked')}</span>
              {er.blockedBy && <span className="text-[#606070]"> ({er.blockedBy})</span>}
              {er.reason && <span className="text-[#606070]"> · {er.reason}</span>}
            </div>
          </div>
        ) : log.executed && isCloseAction ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#06B6D4]/5 text-xs">
            <Check className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span className="text-[#06B6D4] font-medium">{t('timeline.positionClosed')}</span>
            {er?.price && er?.amount && (
              <span className="text-[#9090A0] font-mono">
                ${er.price.toLocaleString()} × {er.amount}
              </span>
            )}
            {er?.orderId && (
              <span className="text-[#606070] font-mono">#{er.orderId.slice(-6)}</span>
            )}
          </div>
        ) : log.executed ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#10B981]/5 text-xs">
            <Check className="w-3.5 h-3.5 text-[#10B981]" />
            <span className="text-[#10B981] font-medium">
              {ACTION_I18N[action] ? t(ACTION_I18N[action]) : t('timeline.executed')}
            </span>
            {d.capitalUSD != null && (
              <span className="text-[#9090A0] font-mono">${d.capitalUSD}</span>
            )}
            {d.positionSizePercent != null && (
              <span className="text-[#9090A0] font-mono">{d.positionSizePercent}%</span>
            )}
            {d.leverage != null && d.leverage > 1 && (
              <span className="text-[#9090A0] font-mono">{d.leverage}x</span>
            )}
            {er?.price && <span className="text-[#9090A0] font-mono">${er.price.toLocaleString()}</span>}
            {er?.amount && <span className="text-[#606070] font-mono">×{er.amount}</span>}
            {er?.positionId && (
              <span className="text-[#606070] font-mono">#{er.positionId.slice(-8)}</span>
            )}
            {d.cost != null && d.cost > 0 && (
              <span className="text-[#3A3A5A] ml-auto">·${d.cost < 0.01 ? d.cost.toFixed(4) : d.cost.toFixed(3)}</span>
            )}
          </div>
        ) : er?.error ? (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#F43F5E]/5 text-xs">
            <Shield className="w-3.5 h-3.5 text-[#F43F5E] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[#F43F5E] font-medium">{t('common.failed')}</span>
              <span className="text-[#606070]"> · {er.error}</span>
            </div>
          </div>
        ) : isWait ? (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#94A3B8]/5 text-xs">
            <Clock className="w-3.5 h-3.5 text-[#94A3B8] flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-[#94A3B8] font-medium">{t('timeline.waitingSignal')}</span>
              {reasoning && (
                <div className="text-[#9090A0] text-xs mt-0.5 leading-relaxed">
                  <TruncatedText text={cleanReasoning(reasoning)} maxLines={2} />
                </div>
              )}
            </div>
          </div>
        ) : isHoldPos ? (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#64748B]/5 text-xs">
            <Pause className="w-3.5 h-3.5 text-[#64748B] flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-[#64748B] font-medium">{t('timeline.holdingPosition')}</span>
              {reasoning && (
                <div className="text-[#9090A0] text-xs mt-0.5 leading-relaxed">
                  <TruncatedText text={cleanReasoning(reasoning)} maxLines={2} />
                </div>
              )}
            </div>
          </div>
        ) : er?.skipped ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#94A3B8]/5 text-xs">
            <Pause className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span className="text-[#94A3B8] font-medium">{t('timeline.holdingPosition')}</span>
            {er.reason && <span className="text-[#606070]"> · {er.reason}</span>}
          </div>
        ) : isGridLog ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#10B981]/5 text-xs flex-wrap">
            <Check className="w-3.5 h-3.5 text-[#10B981]" />
            <span className="text-[#10B981] font-medium">{t('timeline.executed')}</span>
            {(() => {
              const counts: Record<string, number> = {};
              for (const op of gridDecisions) counts[op.action] = (counts[op.action] || 0) + 1;
              const details: string[] = [];
              if (counts['place_buy_limit']) details.push(t('timeline.gridExecBuy', { count: counts['place_buy_limit'] }));
              if (counts['place_sell_limit']) details.push(t('timeline.gridExecSell', { count: counts['place_sell_limit'] }));
              if (counts['cancel_order']) details.push(t('timeline.gridExecCancel', { count: counts['cancel_order'] }));
              if (counts['adjust_grid']) details.push(t('timeline.gridExecAdjust', { count: counts['adjust_grid'] }));
              if (counts['pause_grid']) details.push(t('timeline.gridExecPause'));
              if (counts['exit_all']) details.push(t('timeline.gridExecExit'));
              if (counts['reduce_exposure']) details.push(t('timeline.gridExecReduce', { count: counts['reduce_exposure'] }));
              return details.length > 0
                ? <span className="text-[#9090A0]"> · {details.join(', ')}</span>
                : d.gridSummary ? <span className="text-[#9090A0]"> · {d.gridSummary}</span> : null;
            })()}
          </div>
        ) : (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#606070]/5 text-xs">
            <Clock className="w-3.5 h-3.5 text-[#606070] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[#606070] font-medium">{t('timeline.notExecuted')}</span>
              {reasoning && (
                <p className="text-[#9090A0] text-xs mt-0.5">{briefWaitReason(reasoning, t as TFunc)}</p>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
