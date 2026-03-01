'use client';

import { useState } from 'react';
import { MessageSquare, Check, Clock, Shield, Pause, ChevronDown, ChevronUp, DollarSign } from 'lucide-react';
import {
  ACTION_CONFIG,
  MODEL_DISPLAY,
} from '@/constants/debate';
import { translateExchangeOrderError } from '@/lib/error-translator';
import type { TimelineDebateLog, StrategyLogVote } from '@/types/ai';
import { useTranslations } from '@/i18n/provider';

type TFunc = (key: string, params?: Record<string, string | number>) => string;

const ACTION_I18N: Record<string, string> = {
  open_long: 'detail.actionOpenLong', open_short: 'detail.actionOpenShort',
  close_long: 'detail.actionCloseLong', close_short: 'detail.actionCloseShort',
  hold: 'detail.actionHold', wait: 'detail.actionWait',
};

/** 清理后端标签为用户可读文本 */
function cleanBackendTags(text: string, t: TFunc): string {
  let s = text;
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
  // 0. 共识策略格式：[共识] N 个模型独立分析 · Model1: 观望...
  // 提取 "N模型XXX，得分Y" 行 + "→ 执行XXX" 行，拼成判断结果摘要
  if (text.includes('[共识]') && text.includes('得分')) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const scoreLine = lines.find(l => /\d+模型.+得分\s*[\d.]+/.test(l));
    const execLine = lines.find(l => /^→\s+/.test(l));
    if (scoreLine || execLine) {
      // 得分后注释计算方式：得分 = Σ(各模型置信度/100)
      const scoreWithNote = scoreLine?.replace(/(得分\s*)([\d.]+)/, '$1$2 (=Σ置信度÷100)');
      // 将 "执行观望" → "继续等待信号"，"执行持有" → "维持持仓"
      const execText = execLine
        ?.replace(/^→\s*/, '')
        .replace(/执行观望/, '继续等待信号')
        .replace(/执行持有/, '维持持仓');
      const parts = [scoreWithNote, execText].filter(Boolean);
      const combined = parts.join('，');
      return combined.length > 100 ? combined.slice(0, 100) + '…' : combined;
    }
  }

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
    && !/^[^\u4e00-\u9fff]*[：:]\s*$/i.test(l),
  );
  if (signalLine) {
    const cleaned = cleanBackendTags(signalLine, t);
    return cleaned.length > 80 ? cleaned.slice(0, 80) + '…' : cleaned;
  }

  // 4. 跳过章节标题，取第一个有内容的行
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

/**
 * 智能格式化推理文本
 * DeepSeek 原生输出含 \n，直接透传；
 * GPT/Gemini 输出连续文本，按中英文句末标点 + 编号 + 章节标题断行
 */
function formatReasoning(text: string): string {
  if (!text) return text;

  // 已有足够换行（DeepSeek / Claude 风格）→ 直接透传，不破坏原有格式
  const newlineCount = (text.match(/\n/g) || []).length;
  if (newlineCount >= 3) return text;

  let s = text;

  // 1. 中文章节标题前断行：句末标点后出现 "xx分析："、"结论：" 等
  s = s.replace(/([。！？.!?])\s*([\u4e00-\u9fff]{2,8}[：:])/g, '$1\n$2');

  // 2. 中文句末标点后断行（后跟非空白内容）
  s = s.replace(/([。！？])(?=[^\n\s])/g, '$1\n');

  // 3. 英文句末断行（句点/问号/感叹号后跟空格再跟大写字母）
  //    (?<!\d) 保护小数点，避免拆分 "72.5 USD"、"$100.5 BTC" 这类小数+大写组合
  s = s.replace(/(?<!\d)([.!?])\s+(?=[A-Z])/g, '$1\n');

  // 4. 数字编号列表断行：" 1. " / " 2) "
  s = s.replace(/\s+(\d+[.)]\s+)/g, '\n$1');

  // 5. 项目符号断行
  s = s.replace(/\s+([·•\-]\s)/g, '\n$1');

  // 清理多余空行
  s = s.replace(/\n{3,}/g, '\n\n');

  return s.trim();
}

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

function rrColor(rr: number): string {
  if (rr >= 2) return '#22C55E';
  if (rr >= 1) return '#F59E0B';
  return '#F43F5E';
}

interface DebateLogCardProps {
  entry: TimelineDebateLog;
}

export function DebateLogCard({ entry }: DebateLogCardProps) {
  const t = useTranslations('ai');
  const te = useTranslations('errors');
  const { log, strategy } = entry;
  const d = log.decision;
  const er = log.executionResult;
  const votes = d.votes || [];
  const action = d.action || 'hold';
  const actionCfg = ACTION_CONFIG[action] || ACTION_CONFIG['wait'];
  const isWait = action === 'wait';
  const isHoldPos = action === 'hold';
  const isCloseAction = action === 'close_long' || action === 'close_short';

  // 估算入场价
  const entryPrice = er?.price || (d.stopLoss && d.takeProfit
    ? (d.stopLoss + d.takeProfit) / 2
    : 0);


  // R:R — 优先用百分比（与后端 L9 safety check 一致），fallback 用价格
  const rr = calcRiskRewardFromPct(d.stopLossPct, d.takeProfitPct)
    ?? (d.stopLoss && d.takeProfit && entryPrice
      ? calcRiskReward(entryPrice, d.stopLoss, d.takeProfit)
      : null);

  return (
    <div className="glass-border-glow glass-card p-4 space-y-3">
      {/* === 标题行 — 和深研对齐 === */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6]">
            <MessageSquare className="w-3 h-3" />
            {t('modes.debate')}
          </span>
          <span className="text-[#9090A0]">{strategy.name}</span>
          <span className="text-[#F8F8FC] font-medium">{(!log.symbol || log.symbol === 'ALL') ? strategy.name : log.symbol.replace(/:USDT$/, '')}</span>
          {d.cost != null && d.cost > 0 && (
            <span className="flex items-center gap-0.5 text-[#606070]">
              <DollarSign className="w-2.5 h-2.5" />
              <span className="font-mono">{Number(d.cost).toFixed(4)}</span>
            </span>
          )}
        </div>
        <span className="text-[10px] text-[#606070]">{formatTimeAgo(log.createdAt, t as TFunc)}</span>
      </div>

      {/* === 决策 + SL/TP（对齐 Solo/Research，放在投票上方） === */}
      {!(isWait || isHoldPos) && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span
              className="px-2.5 py-1 rounded-md text-xs font-semibold"
              style={{ color: actionCfg.color, backgroundColor: actionCfg.bg }}
            >
              {ACTION_I18N[action] ? t(ACTION_I18N[action]) : actionCfg.label}
            </span>
            {d.confidence != null && (
              <span><span className="text-[#606070]">{t('timeline.labelConfidence')}</span> <span className="font-mono text-[#F8F8FC]">{d.confidence}%</span></span>
            )}
            {d.leverage != null && (
              <span><span className="text-[#606070]">{t('timeline.labelLeverage')}</span> <span className="font-mono text-[#F8F8FC]">{d.leverage}x</span></span>
            )}
            {d.positionSizePercent != null && (
              <span><span className="text-[#606070]">{t('timeline.labelPosition')}</span> <span className="font-mono text-[#F8F8FC]">{d.positionSizePercent}%</span></span>
            )}
          </div>
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
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (rr / 3) * 100)}%`, backgroundColor: rrColor(rr) }} />
                  </div>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* === 投票列表 — 手风琴式，类似深研思考链 === */}
      <div>
        <div className="flex items-center gap-1.5 text-[10px] text-[#606070] mb-1">
          <MessageSquare className="w-3 h-3" />
          <span>{t('timeline.aiThinkingChain')}</span>
        </div>
        {votes.length > 0 ? (
          <div className="border-l border-[#1E1E2E] ml-1 pl-3">
            {votes.map((vote: StrategyLogVote, idx: number) => (
              <VoteItem key={vote.modelId || idx} vote={vote} consensusAction={action} />
            ))}
          </div>
        ) : (
          <div className="border-l border-[#1E1E2E] ml-1 pl-3 py-1.5 flex items-center gap-1.5 text-xs text-[#F43F5E]/70">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span>LLM API {t('timeline.analysisFailed')} — {t('timeline.llmNoResponse')}</span>
          </div>
        )}
      </div>

      {/* === 执行状态 === */}
      <div className="border-t border-[#1E1E2E] pt-2">
        {er?.blocked ? (
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
            {er?.price && <span className="text-[#9090A0] font-mono">${er.price.toLocaleString()}</span>}
            {er?.amount && <span className="text-[#606070] font-mono">×{er.amount}</span>}
            {er?.orderId && <span className="text-[#606070] font-mono">#{String(er.orderId).slice(-6)}</span>}
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
          </div>
        ) : er?.error ? (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#F43F5E]/5 text-xs">
            <Shield className="w-3.5 h-3.5 text-[#F43F5E] flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[#F43F5E] font-medium">{t('common.failed')}</span>
              <span className="text-[#606070]"> · {translateExchangeOrderError(er.error, te)}</span>
            </div>
          </div>
        ) : isWait ? (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#94A3B8]/5 text-xs">
            <Clock className="w-3.5 h-3.5 text-[#94A3B8] flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 leading-relaxed">
              <span className="text-[#94A3B8] font-medium">{t('timeline.waitingSignal')}</span>
              {d.reasoning && (
                <span className="text-[#9090A0] ml-1">{briefWaitReason(d.reasoning, t as TFunc)}</span>
              )}
            </div>
          </div>
        ) : isHoldPos ? (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#64748B]/5 text-xs">
            <Pause className="w-3.5 h-3.5 text-[#64748B] flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1 leading-relaxed">
              <span className="text-[#64748B] font-medium">{t('timeline.holdingPosition')}</span>
              {d.reasoning && (
                <span className="text-[#9090A0] ml-1">{briefWaitReason(d.reasoning, t as TFunc)}</span>
              )}
            </div>
          </div>
        ) : er?.skipped ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#94A3B8]/5 text-xs">
            <Pause className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span className="text-[#94A3B8] font-medium">{t('timeline.holdingPosition')}</span>
            {er.reason && <span className="text-[#606070]"> · {er.reason}</span>}
          </div>
        ) : (
          <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#606070]/5 text-xs">
            <Clock className="w-3.5 h-3.5 text-[#606070] flex-shrink-0 mt-0.5" />
            <div className="min-w-0 leading-relaxed">
              <span className="text-[#606070] font-medium">{t('timeline.notExecuted')}</span>
              {d.reasoning && (
                <span className="text-[#9090A0] ml-1">{briefWaitReason(d.reasoning, t as TFunc)}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 单个模型分析 — 手风琴式，默认显示一行摘要，点击展开完整推理 */
function VoteItem({ vote, consensusAction }: { vote: StrategyLogVote; consensusAction: string }) {
  const t = useTranslations('ai');
  const [open, setOpen] = useState(false);
  const modelInfo = MODEL_DISPLAY[vote.modelId];
  const modelName = modelInfo?.name || vote.modelId;
  const modelColor = modelInfo?.color || '#9090A0';
  const voteCfg = ACTION_CONFIG[vote.action] || ACTION_CONFIG['wait'];
  const agreed = vote.action === consensusAction;

  // 提取一行摘要 — 跳过章节标题（"xxx分析：" 格式）
  const summary = vote.reasoning
    ? (() => {
        // 模型调用失败 → 友好文案，不暴露技术细节
        if (vote.success === false) {
          return t('timeline.modelFailed');
        }
        const lines = vote.reasoning.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const line = lines.find(l => !/^[\w\u4e00-\u9fff]{1,8}[：:]\s*$/.test(l) && !/^\*\*[^*]+\*\*$/.test(l) && l.length > 4)
          || lines[0] || '';
        return line.length > 60 ? line.slice(0, 60) + '...' : line;
      })()
    : '';

  return (
    <div className="relative">
      {/* 左侧圆点 */}
      <div className={`absolute -left-[13px] top-[11px] w-1.5 h-1.5 rounded-full ${
        agreed ? 'bg-[#10B981]' : 'bg-[#606070]'
      }`} />

      {/* 行标题 — 点击展开/收起（仅投票参数，logo 移到下方独立行） */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (vote.reasoning) setOpen(!open); }}
        className="w-full flex items-center gap-2 py-2 text-xs group"
        disabled={!vote.reasoning}
      >
        {/* 动作标签 */}
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
          style={{ color: voteCfg.color, backgroundColor: voteCfg.bg }}>
          {ACTION_I18N[vote.action] ? t(ACTION_I18N[vote.action]) : voteCfg.label}
        </span>
        {vote.confidence != null && (
          <span className="font-mono text-[10px] text-[#F8F8FC]">{vote.confidence}%</span>
        )}
        {vote.action !== 'wait' && vote.action !== 'hold' && vote.leverage != null && vote.leverage > 1 && (
          <span className="font-mono text-[10px] text-[#606070]">{vote.leverage}x</span>
        )}
        {vote.action !== 'wait' && vote.action !== 'hold' && vote.positionSizePercent != null && vote.positionSizePercent > 0 && (
          <span className="font-mono text-[10px] text-[#606070]">{vote.positionSizePercent}%</span>
        )}
        <span className={`text-[10px] ${agreed ? 'text-[#10B981]' : 'text-[#606070]'}`}>
          {agreed ? '✓' : '✗'}
        </span>
        {vote.success === false && (
          <span className="text-[10px] text-[#F43F5E]/70 truncate max-w-[100px]">
            {t('timeline.modelFailed')}
          </span>
        )}
        {vote.success !== false && vote.error?.startsWith('未覆盖') && (
          <span className="text-[10px] text-[#606070] truncate max-w-[100px]" title={vote.error}>
            {vote.error}
          </span>
        )}
        <span className="flex-1" />
        {/* 展开/收起箭头 */}
        {vote.reasoning && (
          open
            ? <ChevronUp className="w-3 h-3 text-[#606070] flex-shrink-0" />
            : <ChevronDown className="w-3 h-3 text-[#606070] flex-shrink-0 group-hover:text-[#06B6D4] transition-colors" />
        )}
      </button>

      {/* 推理文本区 — 模型 Logo 始终显示，即使 reasoning 为空 */}
      <div className="pb-2">
        {/* 模型标识行 */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
            style={{ backgroundColor: modelColor }}>
            {modelName.charAt(0).toUpperCase()}
          </span>
          <span className="text-[10px]" style={{ color: modelColor }}>{modelName}</span>
        </div>
        {vote.reasoning ? (
          open ? (
            vote.success === false ? (
              <p className="text-xs text-[#606070] leading-relaxed">
                {t('timeline.modelUnavailableMsg')}
              </p>
            ) : (
              <div className="text-xs text-[#9090A0] leading-relaxed whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
                {formatReasoning(vote.reasoning)}
              </div>
            )
          ) : (
            <p className="text-xs text-[#606070] truncate">{summary || '...'}</p>
          )
        ) : vote.success === false ? (
          /* reasoning 为空 + 调用失败：友好说明 */
          <p className="text-xs text-[#606070] leading-relaxed">
            {t('timeline.modelUnavailableMsg')}
          </p>
        ) : (
          /* reasoning 为空 + 无错误：提示用户 */
          <p className="text-xs text-[#606070]">—</p>
        )}
      </div>
      {/* Per-vote SL/TP（展开时，仅 open 动作） */}
      {open && vote.action !== 'wait' && vote.action !== 'hold' && (vote.stopLoss != null || vote.takeProfit != null) && (
        <div className="flex items-center gap-3 pb-2 text-[10px]">
          {vote.stopLoss != null && (
            <span className="text-[#F43F5E]">{t('timeline.slLabel')}: <span className="font-mono">${Number(vote.stopLoss).toLocaleString()}</span></span>
          )}
          {vote.takeProfit != null && (
            <span className="text-[#10B981]">{t('timeline.tpLabel')}: <span className="font-mono">${Number(vote.takeProfit).toLocaleString()}</span></span>
          )}
        </div>
      )}
    </div>
  );
}
