'use client';

import { useState } from 'react';
import { Zap, Check, Clock, Shield, Pause, Grid3X3, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { ACTION_CONFIG, MODEL_DISPLAY } from '@/constants/debate';
import { TruncatedText } from './truncated-text';
import { translateExchangeOrderError } from '@/lib/error-translator';
import type { TimelineSoloLog } from '@/types/ai';
import { useTranslations } from '@/i18n/provider';

type TFunc = (key: string, params?: Record<string, string | number>) => string;

/** 系统日志 action 类型（非 AI 生成，需 i18n 渲染） */
const SYSTEM_ACTIONS = new Set([
  'direction_change', 'daily_loss_pause', 'auto_disabled_failure',
  'circuit_breaker', 'grid_idle', 'grid_exec_failed', 'grid_initialized',
]);

const DIR_KEY: Record<string, string> = {
  neutral: 'dirNeutral', long: 'dirLong', short: 'dirShort',
  long_bias: 'dirLongBias', short_bias: 'dirShortBias',
};
const BREAKOUT_KEY: Record<string, string> = {
  none: 'breakoutNone', short: 'breakoutShort', mid: 'breakoutMid', long: 'breakoutLong',
};

/**
 * 将系统日志 decision 字段转换为 i18n 文本，返回 null 则降级显示 reasoning 原文
 */
function getSystemLogText(d: any, t: TFunc): string | null {
  switch (d.action) {
    case 'direction_change':
      if (d.from != null && d.to != null) {
        const from = t(`timeline.${DIR_KEY[d.from] ?? 'dirNeutral'}`);
        const to   = t(`timeline.${DIR_KEY[d.to]   ?? 'dirNeutral'}`);
        return t('timeline.sysDirectionChange', { from, to });
      }
      return null;
    case 'daily_loss_pause':
      if (d.limitPct != null)
        return t('timeline.sysDailyLossPause', {
          actualPct: Number(d.actualPct).toFixed(1),
          limitPct: d.limitPct,
        });
      return null;
    case 'auto_disabled_failure':
      return t('timeline.sysApiKeyInvalid');
    case 'circuit_breaker':
      if (d.totalDailyPnl != null)
        return t('timeline.sysCircuitBreaker', {
          pnl: Math.abs(Number(d.totalDailyPnl)).toFixed(2),
          limit: d.maxDailyDrawdown ?? '?',
        });
      return null;
    case 'grid_idle': {
      const reasons = [...(d.skipReasons ?? []), ...(d.categories ?? [])].join(', ');
      if (reasons)
        return t('timeline.sysGridIdle', { reasons });
      return null;
    }
    case 'grid_exec_failed': {
      const cats = (d.categories ?? []).join(', ');
      return t('timeline.sysGridExecFailed', {
        count: d.attempted ?? 0,
        categories: cats || '—',
      });
    }
    case 'grid_initialized':
      if (d.gridCount != null)
        return t('timeline.sysGridInitialized', {
          gridCount: d.gridCount,
          lower: Number(d.lower).toFixed(2),
          upper: Number(d.upper).toFixed(2),
        });
      return null;
    default:
      // minConfidence 过滤（action=wait + minConfFilter=true）
      if (d.action === 'wait' && d.minConfFilter)
        return t('timeline.sysMinConfFiltered', {
          actual: d.actual ?? d.confidence ?? 0,
          required: d.required ?? 0,
        });
      return null;
  }
}

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
  hold: { key: 'detail.actionHold', color: '#64748B' },
  cancel_all_orders: { key: 'timeline.gridExitAll', color: '#F43F5E' },
  grid_initialized: { key: 'timeline.gridInitialized', color: '#06B6D4' },
  rebalance: { key: 'timeline.gridRebalance', color: '#8B5CF6' },
  emergency_exit: { key: 'timeline.gridEmergencyExit', color: '#F43F5E' },
};

/** blockedBy 代码 → i18n key 映射 */
const BLOCKED_BY_I18N: Record<string, string> = {
  L1: 'timeline.blockedByL1',
  L2: 'timeline.blockedByL2',
  L4: 'timeline.blockedByL4',
  L5: 'timeline.blockedByL5',
  L6: 'timeline.blockedByL6',
  L8: 'timeline.blockedByL8',
  L9: 'timeline.blockedByL9',
  E4: 'timeline.blockedByE4',
  R4: 'timeline.blockedByR4',
  safety: 'timeline.blockedBySafety',
  risk_debate: 'timeline.blockedByRisk',
  has_position: 'timeline.blockedByHasPosition',
};

/** Grid 方向 — i18n key 映射 */
const GRID_DIR_I18N: Record<string, string> = {
  neutral: 'timeline.dirNeutral', long: 'timeline.dirLong', short: 'timeline.dirShort',
  long_bias: 'timeline.dirLongBias', short_bias: 'timeline.dirShortBias',
};
/** Grid 市场形态 — i18n key 映射 */
const GRID_REGIME_I18N: Record<string, string> = {
  narrow: 'timeline.regimeNarrow', standard: 'timeline.regimeStandard',
  wide: 'timeline.regimeWide', volatile: 'timeline.regimeVolatile',
};
/** Grid 突破级别 — i18n key 映射 */
const GRID_BREAKOUT_I18N: Record<string, string> = {
  none: 'timeline.breakoutNone', short: 'timeline.breakoutShort',
  mid: 'timeline.breakoutMid', long: 'timeline.breakoutLong',
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

/** AI 推理分段数据 */
interface ReasoningSection {
  title?: string;
  content: string;
}

/** 解析 AI 推理文本为结构化分段 */
function parseReasoningSections(text: string): ReasoningSection[] {
  if (!text) return [];
  const lines = text.split('\n');
  const sections: ReasoningSection[] = [];
  let currentTitle: string | undefined;
  let currentLines: string[] = [];

  const extractHeader = (line: string): string | null => {
    const t = line.trim();
    // **Header：** 或 **Header:**
    const m1 = t.match(/^\*\*([^*]{2,12})[：:]\*\*/);
    if (m1) return m1[1];
    // ### Header / ## Header
    const m2 = t.match(/^#{1,3}\s+([\u4e00-\u9fffA-Za-z0-9 ]{2,15})[\s：:]*$/);
    if (m2) return m2[1].trim();
    // 中文短标题行：2-8汉字 + 冒号，行尾无内容
    const m3 = t.match(/^([\u4e00-\u9fff]{2,8})[：:]\s*$/);
    if (m3) return m3[1];
    return null;
  };

  for (const line of lines) {
    const header = extractHeader(line);
    if (header) {
      const pending = currentLines.join('\n').trim();
      if (pending || currentTitle) sections.push({ title: currentTitle, content: pending });
      currentTitle = header;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  const pending = currentLines.join('\n').trim();
  if (pending || currentTitle) sections.push({ title: currentTitle, content: pending });

  // 没有找到任何标题 → 返回纯文本块
  if (!sections.some(s => s.title)) return [{ content: text.trim() }];
  return sections.filter(s => s.content.length > 0 || s.title);
}

/** 根据标题关键词返回主题色 */
const SECTION_COLOR_MAP: Array<{ keywords: string[]; color: string }> = [
  { keywords: ['技术', '指标', 'RSI', 'MACD', 'KDJ', '均线', '价格', '支撑', '压力'], color: '#06B6D4' },
  { keywords: ['趋势', '行情', '走势', '方向'], color: '#3B82F6' },
  { keywords: ['基本', '消息', '新闻', '事件', '宏观'], color: '#8B5CF6' },
  { keywords: ['情绪', '市场', '资金', '多空', '仓位'], color: '#F59E0B' },
  { keywords: ['风险', '止损', '止盈', '安全', '危险'], color: '#F43F5E' },
  { keywords: ['结论', '建议', '总结', '综合', '判断', '决策', '操作'], color: '#10B981' },
  { keywords: ['量能', '成交量', '换手', '流动'], color: '#A78BFA' },
];

function getSectionColor(title: string): string {
  for (const { keywords, color } of SECTION_COLOR_MAP) {
    if (keywords.some(k => title.includes(k))) return color;
  }
  return '#6B7280';
}

/** 按中文/英文句号将长段落拆成视觉小段（每2句一组，语义关键词额外断段） */
function toParas(raw: string): string[] {
  // 只在中文句末标点后断句；英文 !? 要求前面非数字，避免拆分小数（如 576.61）
  const sentences = raw.split(/(?<=[。！？])\s*|(?<=(?<!\d)[!?])\s+/).map(s => s.trim()).filter(s => s.length > 1);
  if (sentences.length <= 1) return [raw.trim()];

  // 结论/转折类关键词出现在句首时，无论当前组是否满 2 句都先断段
  const TOPIC_BREAK = /^(因此|综上|总结|结论|建议|操作建议|风险提示|注意|综合来看|总的来说|仓位管理|网格方向|Therefore|In summary|Overall|Risk)/;

  const paras: string[] = [];
  let group: string[] = [];

  for (const s of sentences) {
    if (group.length > 0 && TOPIC_BREAK.test(s)) {
      paras.push(group.join(''));
      group = [s];
    } else {
      group.push(s);
      if (group.length >= 2) {
        paras.push(group.join(''));
        group = [];
      }
    }
  }
  if (group.length > 0) paras.push(group.join(''));
  return paras;
}

/** 推理展示组件：收起=2行，展开=分段；可传 modelId 在文字上方显示模型 Logo */
function SectionedReasoning({ text, modelId }: { text: string; modelId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const cleaned = cleanReasoning(text);
  if (!cleaned) return null;

  const needsExpand = cleaned.length > 60;

  // 模型标识头（在对话框内部顶部）
  const modelHeader = modelId ? (() => {
    const info = MODEL_DISPLAY[modelId];
    const name = info?.name || modelId;
    const color = info?.color || '#9090A0';
    return (
      <div className="flex items-center gap-1.5 mb-1.5">
        {info?.logo ? (
          <img src={info.logo} alt={name} title={name} className="w-4 h-4 rounded-full flex-shrink-0" />
        ) : (
          <span className="w-4 h-4 rounded-full bg-[#1E1E2E] flex items-center justify-center text-[8px] font-bold flex-shrink-0"
            style={{ color }}>
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="text-[10px]" style={{ color }}>{name}</span>
      </div>
    );
  })() : null;

  const ToggleBtn = ({ cls }: { cls?: string }) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
      className={`text-[#4A4A6A] hover:text-[#9090A0] transition-colors flex-shrink-0 ${cls ?? ''}`}
    >
      {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
    </button>
  );

  const sections = parseReasoningSections(cleaned);
  const hasHeaders = sections.some(s => s.title);

  // ── 有标题结构：彩色左边框分段 ──
  if (hasHeaders) {
    const PREVIEW = 2;
    const visible = expanded ? sections : sections.slice(0, PREVIEW);
    const hasMore = sections.length > PREVIEW;
    return (
      <div className="space-y-1.5">
        {modelHeader}
        {visible.map((sec, i) => {
          const color = sec.title ? getSectionColor(sec.title) : '#6B7280';
          return (
            <div key={i} className="pl-2 border-l-2" style={{ borderColor: `${color}50` }}>
              {sec.title && (
                <span className="text-[10px] font-semibold" style={{ color }}>{sec.title}</span>
              )}
              {sec.content && (
                expanded ? (
                  // 展开：按 \n 分行渲染，避免所有内容挤在一起
                  <div className="space-y-1 mt-0.5">
                    {sec.content.split('\n').filter(l => l.trim()).map((line, li) => (
                      <p key={li} className="text-xs text-[#9090A0] leading-relaxed">{line.trim()}</p>
                    ))}
                  </div>
                ) : (
                  // 收起：单行截断
                  <p className={`text-xs text-[#9090A0] leading-relaxed mt-0.5${i === visible.length - 1 ? ' line-clamp-2' : ''}`}>
                    {sec.content}
                  </p>
                )
              )}
            </div>
          );
        })}
        {(hasMore || expanded) && (
          <div className="flex justify-end"><ToggleBtn /></div>
        )}
      </div>
    );
  }

  // ── 无标题结构 ──
  if (!expanded) {
    // 收起：2 行截断 + 右侧展开按钮
    return (
      <div>
        {modelHeader}
        <div className="flex items-start gap-1">
          <p className="flex-1 text-xs text-[#9090A0] leading-relaxed line-clamp-2">{cleaned}</p>
          {needsExpand && <ToggleBtn />}
        </div>
      </div>
    );
  }

  // 展开：按句号分段显示
  const paras = toParas(cleaned);
  return (
    <div className="space-y-2">
      {modelHeader}
      {paras.map((para, i) => (
        <p key={i} className="text-xs text-[#9090A0] leading-relaxed">{para}</p>
      ))}
      <div className="flex justify-end"><ToggleBtn /></div>
    </div>
  );
}

/** AI 推理链展开区块（DeepSeek 扩展思考 / 链式推理） */
function GridThinkingChain({ text, t }: { text: string; t: TFunc }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const preview = text.slice(0, 60).replace(/\n/g, ' ');
  return (
    <div className="border-t border-[#1E1E2E]/60 pt-2 mt-1">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
        className="w-full flex items-center gap-1.5 text-[10px] text-[#606070] hover:text-[#9090A0] transition-colors"
      >
        <span className="w-3 h-3 rounded-sm bg-[#1E1E2E] flex items-center justify-center text-[7px] font-bold text-[#8B5CF6] flex-shrink-0">λ</span>
        <span className="text-[#4A5568] font-medium">{t('timeline.gridThinking')}</span>
        <span className="flex-1 text-left truncate text-[#3A3A5A]">{!expanded ? preview + '…' : ''}</span>
        {expanded ? <ChevronUp className="w-3 h-3 flex-shrink-0" /> : <ChevronDown className="w-3 h-3 flex-shrink-0" />}
      </button>
      {expanded && (
        <div className="mt-2 pl-3 border-l-2 border-[#2E2E4E] space-y-1.5 max-h-[200px] overflow-y-auto">
          {text.split('\n').filter(l => l.trim()).map((line, i) => (
            <p key={i} className="text-xs text-[#7070A0] leading-relaxed">{line.trim()}</p>
          ))}
        </div>
      )}
    </div>
  );
}

interface SoloLogCardProps {
  entry: TimelineSoloLog;
}

export function SoloLogCard({ entry }: SoloLogCardProps) {
  const t = useTranslations('ai');
  const te = useTranslations('errors');
  const { log, strategy } = entry;
  const d = log.decision;
  const er = log.executionResult;

  // 检测 Grid 网格日志格式: decision.decisions 数组 或 entryType
  const gridDecisions: any[] = Array.isArray(d.decisions) ? d.decisions : [];
  const isGridEntry = gridDecisions.length > 0 || (entry as any).entryType === 'grid_log' || d.action === 'grid_cycle';
  // grid_cycle 时 decisions 可能为空（AI 只返回 analysis 无 actions），但 gridSnapshot 仍存在
  const isGridLog = gridDecisions.length > 0 || d.action === 'grid_cycle' || !!d.gridSnapshot;
  // 检测自动禁用日志
  const isAutoDisabled = d.action === 'auto_disabled_failure';

  // Grid: 整体市场分析 — 优先使用后端存储的 analysis 字段（d.reasoning），避免与操作级 reasoning 重复
  const gridAnalysisText = isGridLog
    ? (() => {
        // 1. 优先使用整体 analysis（后端已将 AI 的 analysis 字段存为 d.reasoning）
        if (d.reasoning && typeof d.reasoning === 'string' && d.reasoning.length > 10) return d.reasoning;
        // 2. 降级：从 actions 中提取（兼容旧日志）
        const adjustR = gridDecisions.find((op: any) => op.action === 'adjust_grid' && op.reasoning)?.reasoning;
        if (adjustR) return adjustR;
        const holdR = gridDecisions.find((op: any) => op.action === 'hold' && op.reasoning)?.reasoning;
        if (holdR) return holdR;
        return '';
      })()
    : '';
  // 系统日志优先用 i18n 渲染；AI 生成的 reasoning 保留原文
  const systemText = SYSTEM_ACTIONS.has(d.action ?? '') ? getSystemLogText(d, t as TFunc) : null;
  const reasoning = systemText ?? (isGridLog
    ? gridAnalysisText
    : (d.reasoning || d.reason || ''));

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

  // 日志透明化：折叠状态
  const [showUserPrompt, setShowUserPrompt] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  return (
    <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-4 space-y-3">
      {/* === 标题行 === */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          {isGridEntry ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#10B981]/20 text-[#10B981] font-semibold text-xs">
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
          <span className="text-[#F8F8FC] font-medium">{(!log.symbol || log.symbol === 'ALL') ? strategy.name : log.symbol.replace(/:USDT$/, '')}</span>
        </div>
        <span className="text-[10px] text-[#606070]">{formatTimeAgo(log.createdAt, t as TFunc)}</span>
      </div>

      {/* === 内容区 — 限高可滚动 === */}
      <div className="max-h-[400px] overflow-y-auto space-y-3">
      {/* === 自动禁用 — 错误信息 === */}
      {isAutoDisabled && (
        <div className="text-xs text-[#F59E0B]">
          {t('timeline.sysApiKeyInvalid') || d.reason || t('timeline.autoPaused')}
          {d.lastError && (
            <div className="mt-1">
              <TruncatedText text={d.lastError} maxLines={2} />
            </div>
          )}
        </div>
      )}

      {/* === 网格执行失败 / 空转 — 专属展示（不走 AI 对话框路径） === */}
      {isGridEntry && !isGridLog && !isAutoDisabled && (() => {
        // 优先使用结构化参数；旧日志降级到解析 reasoning 字符串
        const raw = d.reasoning || d.reason || '';
        const categoryFromStruct = d.isExecFailed
          ? (d.categories ?? []).join('、')
          : (d.skipReasons ?? []).join('、');
        const categoryFromRaw = (() => {
          const m = raw.match(/失败原因[:：]\s*(.+?)(\s*$|,|，)/);
          return m?.[1]?.trim() || '';
        })();
        const category = categoryFromStruct || categoryFromRaw;
        const isMarginInsufficient = category.includes('保证金不足') || raw.includes('保证金不足') || raw.includes('insufficient');
        const pendingCount = d.gridSnapshot?.pendingLevels ?? 0;
        const isIdle = d.action === 'grid_idle';

        return (
          <div className="space-y-2">
            {/* 核心原因标签 */}
            <div className="flex items-center gap-2">
              {isIdle ? (
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#94A3B8]/10 text-[#94A3B8]">
                  {t('timeline.gridIdle')}
                </span>
              ) : isMarginInsufficient ? (
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#F59E0B]/10 text-[#F59E0B]">
                  {t('timeline.marginInsufficient') || '保证金不足'}
                </span>
              ) : category ? (
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#EF4444]/10 text-[#EF4444]">
                  {category}
                </span>
              ) : null}
            </div>
            {/* 简短说明：优先 i18n 渲染，降级显示 raw */}
            {(systemText || raw) && (
              <p className="text-xs text-[#606070] leading-relaxed">
                {systemText || raw.split('|')[0].trim()}
              </p>
            )}
            {/* 保证金不足时：补充提示 */}
            {isMarginInsufficient && pendingCount > 0 && (
              <p className="text-xs text-[#505060] leading-relaxed">
                {pendingCount} {t('timeline.pendingOrdersHint') || `个活跃挂单正在占用保证金，等待成交后自动补挂`}
              </p>
            )}
          </div>
        );
      })()}

      {/* === 普通 Solo: 决策 + 参数（wait/hold 由底部状态栏表达，此处不重复） === */}
      {!isGridLog && !isAutoDisabled && !(isGridEntry && !isGridLog) && (
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
              </div>

            </>
          )}

          {/* 推理文本 — 分段显示，模型 Logo 在对话框内部顶端 */}
          {reasoning && (
            <SectionedReasoning text={reasoning} modelId={d.modelId} />
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
          <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-semibold bg-[#10B981]/15 text-[#10B981]">
            {(() => {
              const counts: Record<string, number> = {};
              for (const op of gridDecisions) counts[op.action] = (counts[op.action] || 0) + 1;
              const SHORT_KEYS: Record<string, string> = {
                place_buy_limit: 'timeline.gridBuyShort',
                place_sell_limit: 'timeline.gridSellShort',
                cancel_order: 'timeline.gridCancelShort',
                cancel_all_orders: 'timeline.gridExitShort',
                adjust_grid: 'timeline.gridAdjustShort',
                pause_grid: 'timeline.gridPauseShort',
                exit_all: 'timeline.gridExitShort',
                reduce_exposure: 'timeline.gridReduceShort',
                hold: 'timeline.gridHoldShort',
              };
              const parts = Object.entries(counts).map(([act, n]) => {
                const key = SHORT_KEYS[act];
                const label = key ? t(key) : t('timeline.gridHoldShort');
                return `${n}${label}`;
              });
              return parts.join('/') || t('timeline.gridOpsCount', { count: gridDecisions.length });
            })()}
          </span>

          {/* 网格状态快照（后端 gridSnapshot 字段） */}
          {d.gridSnapshot && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#606070]">{t('timeline.gridRange')}</span>
                <span className="font-mono text-[#F8F8FC]">${Number(d.gridSnapshot.lowerPrice).toFixed(2)}~${Number(d.gridSnapshot.upperPrice).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#606070]">{t('timeline.gridLevels')}</span>
                <span className="text-[#F8F8FC]">{d.gridSnapshot.totalTrades ?? 0}/{d.gridSnapshot.totalLevels}</span>
              </div>
              {d.gridSnapshot.totalProfit != null && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">{t('timeline.gridOrderProfit')}</span>
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
                  <span className="text-[#606070]">{t('timeline.gridPendingLevels')}</span>
                  <span className="text-[#F8F8FC]">{d.gridSnapshot.pendingLevels}</span>
                </div>
              )}
              {d.gridSnapshot.unrealizedPnl != null && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">{t('timeline.gridPositionPnl')}</span>
                  <span className={`font-mono ${d.gridSnapshot.unrealizedPnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    {d.gridSnapshot.unrealizedPnl >= 0 ? '+' : ''}{d.gridSnapshot.unrealizedPnl.toFixed(2)}
                  </span>
                </div>
              )}
              {d.gridSnapshot.maxDrawdown != null && d.gridSnapshot.maxDrawdown > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">{t('timeline.gridMaxDrawdown')}</span>
                  <span className="font-mono text-[#EF4444]">{d.gridSnapshot.maxDrawdown.toFixed(1)}%</span>
                </div>
              )}
              {d.gridSnapshot.direction && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">{t('timeline.gridDirection')}</span>
                  <span className="text-[#F8F8FC]">{GRID_DIR_I18N[d.gridSnapshot.direction] ? t(GRID_DIR_I18N[d.gridSnapshot.direction]) : d.gridSnapshot.direction}</span>
                </div>
              )}
              {d.gridSnapshot.regime && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">{t('timeline.gridRegime')}</span>
                  <span className="text-[#F8F8FC]">{GRID_REGIME_I18N[d.gridSnapshot.regime] ? t(GRID_REGIME_I18N[d.gridSnapshot.regime]) : d.gridSnapshot.regime}</span>
                </div>
              )}
              {d.gridSnapshot.breakoutLevel && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">{t('timeline.gridBreakoutLevel')}</span>
                  <span className="text-[#F8F8FC]">{GRID_BREAKOUT_I18N[d.gridSnapshot.breakoutLevel] ? t(GRID_BREAKOUT_I18N[d.gridSnapshot.breakoutLevel]) : d.gridSnapshot.breakoutLevel}</span>
                </div>
              )}
              {d.gridSnapshot.gridSpacing != null && (
                <div className="flex justify-between">
                  <span className="text-[#606070]">{t('timeline.gridSpacingLabel')}</span>
                  <span className="font-mono text-[#F8F8FC]">${d.gridSnapshot.gridSpacing.toFixed(4)}</span>
                </div>
              )}
            </div>
          )}

          {/* AI 市场分析 — 复用 SectionedReasoning 自动分段（带 AI logo） */}
          {(gridAnalysisText || (!gridAnalysisText && d.aiThinking)) && (
            <SectionedReasoning
              text={gridAnalysisText || (d.aiThinking as string)}
              modelId={d.modelId || (Array.isArray(strategy.models) ? strategy.models[0] : undefined)}
            />
          )}

          {/* AI 推理链（DeepSeek-Reasoner 扩展思考）— 在分析下方可展开 */}
          {d.aiThinking && gridAnalysisText && (
            <GridThinkingChain text={d.aiThinking as string} t={t} />
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
                        <span className="font-mono text-[#F8F8FC]">${Number(op.price).toFixed(2)}</span>
                      )}
                      {op.quantity && (
                        <span className="font-mono text-[#9090A0]">x{parseFloat(Number(op.quantity).toFixed(6))}</span>
                      )}
                      {op.level_index != null && (
                        <span className="text-[#606070]">{t('timeline.gridLayer', { layer: op.level_index })}</span>
                      )}
                      {op.reasoning && !gridAnalysisText?.includes(op.reasoning) && (
                        <span className="w-full text-[#606070] text-[9px] leading-relaxed mt-0.5">
                          {String(op.reasoning).slice(0, 30)}
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

      {/* === 日志透明化：判断依据 / AI思考 / 系统提示词 === */}
      {(log.userPrompt || d.aiThinking || log.systemPrompt) && (
        <div className="space-y-1 border-t border-[#1E1E2E] pt-2">

          {/* 📥 判断依据 (userPrompt) */}
          {log.userPrompt && (
            <div>
              <button
                onClick={() => setShowUserPrompt(!showUserPrompt)}
                className="flex w-full items-center justify-between p-2 rounded hover:bg-white/5 text-xs"
              >
                <span style={{ color: '#60A5FA' }}>📥 {t('timeline.inputPromptLabel')}</span>
                <span className="text-[#606070]">{showUserPrompt ? t('common.collapse') : t('common.expand')}</span>
              </button>
              {showUserPrompt && (
                <div
                  className="mt-1 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto"
                  style={{ background: '#0A0A0F', border: '1px solid #1E1E2E', color: '#EAECEF' }}
                >
                  {log.userPrompt}
                </div>
              )}
            </div>
          )}

          {/* 🧠 AI 思考过程 (aiThinking) */}
          {d.aiThinking && (
            <div>
              <button
                onClick={() => setShowThinking(!showThinking)}
                className="flex w-full items-center justify-between p-2 rounded hover:bg-white/5 text-xs"
              >
                <span style={{ color: '#F0B90B' }}>🧠 {t('timeline.aiThinkingLabel')}</span>
                <span className="text-[#606070]">{showThinking ? t('common.collapse') : t('common.expand')}</span>
              </button>
              {showThinking && (
                <div
                  className="mt-1 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto"
                  style={{ background: '#0A0A0F', border: '1px solid #1E1E2E', color: '#EAECEF' }}
                >
                  {d.aiThinking}
                </div>
              )}
            </div>
          )}

          {/* ⚙️ 系统提示词 (systemPrompt) */}
          {log.systemPrompt && (
            <div>
              <button
                onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                className="flex w-full items-center justify-between p-2 rounded hover:bg-white/5 text-xs"
              >
                <span style={{ color: '#A78BFA' }}>⚙️ {t('timeline.systemPromptLabel')}</span>
                <span className="text-[#606070]">{showSystemPrompt ? t('common.collapse') : t('common.expand')}</span>
              </button>
              {showSystemPrompt && (
                <div
                  className="mt-1 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto"
                  style={{ background: '#0A0A0F', border: '1px solid #1E1E2E', color: '#EAECEF' }}
                >
                  {log.systemPrompt}
                </div>
              )}
            </div>
          )}
        </div>
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
              {er.blockedBy && <span className="text-[#606070]"> ({BLOCKED_BY_I18N[er.blockedBy] ? t(BLOCKED_BY_I18N[er.blockedBy]) : er.blockedBy})</span>}
              {er.reason && <span className="text-[#606070]"> · {er.reason}</span>}
            </div>
          </div>
        ) : log.executed && isCloseAction ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#06B6D4]/5 text-xs">
            <Check className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span className="text-[#06B6D4] font-medium">{t('timeline.positionClosed')}</span>
            {er?.price && er?.amount && (
              <span className="text-[#9090A0] font-mono">
                ${Number(er.price).toFixed(2)} × {er.amount}
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
            {er?.price && <span className="text-[#9090A0] font-mono">${Number(er.price).toFixed(2)}</span>}
            {er?.amount && <span className="text-[#606070] font-mono">×{er.amount}</span>}
            {er?.positionId && (
              <span className="text-[#606070] font-mono">#{er.positionId.slice(-8)}</span>
            )}
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
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#94A3B8]/5 text-xs">
            <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span className="text-[#94A3B8] font-medium">{t('timeline.waitingSignal')}</span>
          </div>
        ) : isHoldPos ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#64748B]/5 text-xs">
            <Pause className="w-3.5 h-3.5 text-[#64748B]" />
            <span className="text-[#64748B] font-medium">{t('timeline.holdingPosition')}</span>
          </div>
        ) : er?.skipped ? (
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#94A3B8]/5 text-xs">
            <Pause className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span className="text-[#94A3B8] font-medium">{t('timeline.holdingPosition')}</span>
            {er.reason && <span className="text-[#606070]"> · {er.reason}</span>}
          </div>
        ) : isGridLog && !log.executed && (er as any)?.errors?.length > 0 ? (
          // 网格执行失败 — 区分"部分失败"(部分成功)与"全部失败"，让用户看懂原因
          (() => {
            const gridErrors: Array<{ action: string; error: string }> = (er as any)?.errors || [];
            const failedBuy    = gridErrors.filter(e => e.action === 'place_buy_limit').length;
            const failedSell   = gridErrors.filter(e => e.action === 'place_sell_limit').length;
            const failedCancel = gridErrors.filter(e => e.action === 'cancel_order').length;
            const failedOther  = gridErrors.length - failedBuy - failedSell - failedCancel;
            const failedPlaces = failedBuy + failedSell;

            // 计划下单数（AI decisions 中的挂单操作）
            const plannedPlaces = gridDecisions.filter(
              (op: any) => op.action === 'place_buy_limit' || op.action === 'place_sell_limit'
            ).length;
            // 跳过数（regime 限制 / minQty 不足导致的跳过，非失败也非成功）
            const skippedOps: Array<{ action: string }> = (er as any)?.skipped || [];
            const skippedPlaces = skippedOps.filter(
              s => s.action === 'place_buy_limit' || s.action === 'place_sell_limit'
            ).length;
            const succeededPlaces = Math.max(0, plannedPlaces - failedPlaces - skippedPlaces);
            // 部分失败：有成功的单，也有失败的单
            const isPartialFailure = succeededPlaces > 0 && failedPlaces > 0;

            const firstErrRaw = gridErrors[0]?.error || '';
            const codeMatch   = firstErrRaw.match(/"code":(-?\d+)/);
            const errCode     = codeMatch ? parseInt(codeMatch[1]) : null;
            const isMarginErr = errCode === -2019;

            const activeOrders    = d.gridSnapshot?.activeOrders ?? 0;
            const totalLevels     = d.gridSnapshot?.totalLevels ?? 0;
            const totalInvestment = (d.gridSnapshot as any)?.totalInvestment as number | undefined;
            const perLevelCost    = totalInvestment && totalLevels > 0
              ? totalInvestment / totalLevels : undefined;

            // 失败类型文案（i18n）
            const failedParts: string[] = [];
            if (failedBuy > 0)    failedParts.push(t('detail.gridErrFailBuy', { count: failedBuy }));
            if (failedSell > 0)   failedParts.push(t('detail.gridErrFailSell', { count: failedSell }));
            if (failedCancel > 0) failedParts.push(t('detail.gridErrFailCancel', { count: failedCancel }));
            if (failedOther > 0)  failedParts.push(t('detail.gridErrFailOther', { count: failedOther }));

            // 错误原因（i18n）
            let reasonText: string;
            let hintText: string | null = null;
            if (isMarginErr) {
              reasonText = t('detail.gridErrMargin');
              hintText   = activeOrders > 0
                ? t('detail.gridErrMarginHintActive', { count: activeOrders })
                : t('detail.gridErrMarginHintWait');
            } else {
              // 使用统一交易所错误翻译
              reasonText = translateExchangeOrderError(firstErrRaw, te);
            }

            // 颜色方案：部分失败 → amber 警告；全部失败 → red 错误
            const containerCls = isPartialFailure
              ? 'bg-[#F59E0B]/5 border-[#F59E0B]/15'
              : 'bg-[#EF4444]/5 border-[#EF4444]/15';
            const iconCls      = isPartialFailure ? 'text-[#F59E0B]' : 'text-[#EF4444]';
            const titleCls     = isPartialFailure ? 'text-[#F59E0B]' : 'text-[#EF4444]';
            const reasonCls    = isPartialFailure ? 'text-[#D97706]' : 'text-[#DC2626]';

            // 标题文案区分三种情况（i18n）
            const titleText = isPartialFailure
              ? t('detail.gridErrPartial', { ok: succeededPlaces, fail: failedPlaces })
              : failedPlaces > 0
                ? t('detail.gridErrAllFail', { count: failedPlaces })
                : t('detail.gridErrOpsFail', { count: gridErrors.length });

            return (
              <div className={`flex items-start gap-1.5 px-2 py-2 rounded-md border text-xs ${containerCls}`}>
                <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${iconCls}`} />
                <div className="min-w-0 flex-1 space-y-1">
                  {/* 标题行：成功/失败层数 · 原因 */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className={`font-medium ${titleCls}`}>{titleText}</span>
                    <span className="text-[#606070]">·</span>
                    <span className={reasonCls}>{reasonText}</span>
                  </div>
                  {/* 详情行：失败类型 + 每层成本估算 */}
                  {(failedParts.length > 0 || perLevelCost) && (
                    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[#707080]">
                      {failedParts.length > 0 && (
                        <span>{failedParts.join('  ')}</span>
                      )}
                      {isMarginErr && perLevelCost != null && perLevelCost > 0 && (
                        <span className="text-[#505060]">{t('timeline.gridPerLevelCost', { cost: perLevelCost.toFixed(1) })}</span>
                      )}
                    </div>
                  )}
                  {/* 提示行 */}
                  {hintText && (
                    <p className="text-[#505060] leading-relaxed">{hintText}</p>
                  )}
                </div>
              </div>
            );
          })()
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
              if (counts['exit_all'] || counts['cancel_all_orders']) details.push(t('timeline.gridExecExit'));
              if (counts['reduce_exposure']) details.push(t('timeline.gridExecReduce', { count: counts['reduce_exposure'] }));
              if (counts['hold']) details.push(t('timeline.gridHoldShort'));
              return details.length > 0
                ? <span className="text-[#9090A0]"> · {details.join(', ')}</span>
                : d.gridSummary ? <span className="text-[#9090A0]"> · {d.gridSummary}</span> : null;
            })()}
          </div>
        ) : isGridEntry && d.action === 'grid_exec_failed' ? (
          // 网格执行失败日志（全部下单被交易所拒绝）— 状态栏仅显示标签，详情已在主区域展示，不重复
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#EF4444]/5 border border-[#EF4444]/15 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444] flex-shrink-0" />
            <span className="text-[#EF4444] font-medium">{t('common.failed')}</span>
          </div>
        ) : isGridEntry && d.action === 'grid_idle' ? (
          // 网格空转日志（被内部规则拦截，未到达交易所）— 状态栏仅显示标签，详情已在主区域展示
          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-[#94A3B8]/5 text-xs">
            <Pause className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span className="text-[#94A3B8] font-medium">{t('timeline.gridIdle')}</span>
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
