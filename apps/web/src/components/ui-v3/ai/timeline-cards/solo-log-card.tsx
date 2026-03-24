'use client';

import { useState } from 'react';
import { Zap, Check, Clock, Shield, Pause, Grid3X3, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { ACTION_CONFIG, MODEL_DISPLAY } from '@/constants/debate';
import { TruncatedText } from './truncated-text';
import { translateExchangeOrderError } from '@/lib/error-translator';
import type { TimelineSoloLog } from '@/types/ai';
import { useTranslations } from '@/i18n/provider';

type TFunc = (key: string, params?: Record<string, string | number>) => string;

/** 安全翻译：如果 t() 返回了 key 本身（含 '.'），使用 fallback */
const tSafe = (t: TFunc, key: string, fallback: string) => {
  const v = t(key);
  return v && !v.includes('.') ? v : fallback;
};

/** 系统日志 action 类型（非 AI 生成，需 i18n 渲染） */
const SYSTEM_ACTIONS = new Set([
  'direction_change', 'daily_loss_pause', 'auto_disabled_failure',
  'circuit_breaker', 'grid_idle', 'grid_exec_failed', 'grid_initialized',
]);

const DIR_KEY: Record<string, string> = {
  neutral: 'dirNeutral', long: 'dirLong', short: 'dirShort',
  long_bias: 'dirLongBias', short_bias: 'dirShortBias',
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
      if (d.action === 'wait' && d.minConfFilter) {
        // 平仓拦截（originalAction 是 close_long/close_short）
        if (d.originalAction === 'close_long' || d.originalAction === 'close_short')
          return t('timeline.sysCloseConfFiltered', {
            actual: d.actual ?? d.confidence ?? 0,
            required: d.required ?? 0,
          });
        // 开仓拦截
        return t('timeline.sysMinConfFiltered', {
          actual: d.actual ?? d.confidence ?? 0,
          required: d.required ?? 0,
        });
      }
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
  cancel_order: { key: 'timeline.gridCancel', color: '#F59E0B' },
  adjust_grid: { key: 'timeline.gridAdjust', color: '#8B5CF6' },
  pause_grid: { key: 'timeline.gridPause', color: '#F59E0B' },
  exit_all: { key: 'timeline.gridExitAll', color: '#F43F5E' },
  reduce_exposure: { key: 'timeline.gridReduce', color: '#F59E0B' },
  hold: { key: 'detail.actionHold', color: '#64748B' },
  cancel_all_orders: { key: 'timeline.gridExitAll', color: '#F43F5E' },
  grid_initialized: { key: 'timeline.gridInitialized', color: '#06B6D4' },
  rebalance: { key: 'timeline.gridRebalance', color: '#8B5CF6' },
  emergency_exit: { key: 'timeline.gridEmergencyExit', color: '#F43F5E' },
  close_long: { key: 'timeline.gridCloseLong', color: '#F59E0B' },
  close_short: { key: 'timeline.gridCloseShort', color: '#06B6D4' },
  resume_grid: { key: 'timeline.gridResume', color: '#10B981' },
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
  ultra_narrow: 'timeline.regimeUltraNarrow',
  narrow: 'timeline.regimeNarrow', standard: 'timeline.regimeStandard',
  wide: 'timeline.regimeWide', volatile: 'timeline.regimeVolatile',
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

/**
 * 计算 R:R 比（对齐 nofx engine.go L2055-2075 唯一公式）
 * 入场价估算: SL + (TP-SL) × 0.2（开多），SL - (SL-TP) × 0.2（开空）
 */
function calcRiskReward(sl: number, tp: number, isLong: boolean): number | null {
  if (!sl || !tp || sl <= 0 || tp <= 0) return null;
  const entry = isLong
    ? sl + (tp - sl) * 0.2
    : sl - (sl - tp) * 0.2;
  if (entry <= 0) return null;
  const riskPct = isLong
    ? (entry - sl) / entry * 100
    : (sl - entry) / entry * 100;
  const rewardPct = isLong
    ? (tp - entry) / entry * 100
    : (entry - tp) / entry * 100;
  if (riskPct <= 0) return null;
  return rewardPct / riskPct;
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

  // ── 收起：统一 2 行截断（不分有无标题） ──
  if (!expanded) {
    return (
      <div>
        {modelHeader}
        <p className="text-xs text-[#9090A0] leading-relaxed line-clamp-2">{cleaned}</p>
        {needsExpand && <div className="flex justify-center mt-1"><ToggleBtn /></div>}
      </div>
    );
  }

  // ── 展开：有标题 → 彩色分段；无标题 → 按段落 ──
  if (hasHeaders) {
    return (
      <div className="space-y-1.5">
        {modelHeader}
        {sections.map((sec, i) => {
          const color = sec.title ? getSectionColor(sec.title) : '#6B7280';
          return (
            <div key={i} className="pl-2 border-l-2" style={{ borderColor: `${color}50` }}>
              {sec.title && (
                <span className="text-[10px] font-semibold" style={{ color }}>{sec.title}</span>
              )}
              {sec.content && (
                <div className="space-y-1 mt-0.5">
                  {sec.content.split('\n').filter(l => l.trim()).map((line, li) => (
                    <p key={li} className="text-xs text-[#9090A0] leading-relaxed">{line.trim()}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className="flex justify-center"><ToggleBtn /></div>
      </div>
    );
  }

  const paras = toParas(cleaned);
  return (
    <div className="space-y-2">
      {modelHeader}
      {paras.map((para, i) => (
        <p key={i} className="text-xs text-[#9090A0] leading-relaxed">{para}</p>
      ))}
      <div className="flex justify-center"><ToggleBtn /></div>
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

/** 每币 reasoning（默认2行截断 + ∨ 展开全文） */
function CoinReasoning({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const cleaned = cleanReasoning(text);
  if (!cleaned || cleaned.length < 5) return null;
  const needsExpand = cleaned.length > 80;
  return (
    <div className="mt-0.5">
      <p className={`text-[10px] text-[#606070] leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>💡 {cleaned}</p>
      {needsExpand && (
        <div className="flex justify-center mt-0.5">
          <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }} className="text-[#4A4A6A] hover:text-[#9090A0] transition-colors">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      )}
    </div>
  );
}

/** AI 思考链（默认2行 + ∨ 展开，展开后左边线纯文本 + ∧ 收起） */
function AiThinkingSection({ text, modelId }: { text: string; modelId?: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const cleaned = cleanReasoning(text);
  if (!cleaned || cleaned.length < 10) return null;

  const info = modelId ? MODEL_DISPLAY[modelId] : null;
  const modelName = info?.name || modelId || '';

  return (
    <div className="border-t border-[#1E1E2E]/60 pt-2 mt-1">
      {/* 模型标识 */}
      {modelName && (
        <div className="flex items-center gap-1.5 mb-1">
          {info?.logo ? (
            <img src={info.logo} alt={modelName} className="w-4 h-4 rounded-full flex-shrink-0" />
          ) : (
            <span className="w-4 h-4 rounded-full bg-[#1E1E2E] flex items-center justify-center text-[8px] font-bold flex-shrink-0" style={{ color: info?.color || '#9090A0' }}>
              {modelName.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="text-[10px]" style={{ color: info?.color || '#9090A0' }}>{modelName}</span>
        </div>
      )}
      {/* 文本内容 */}
      {expanded ? (
        <div className="text-xs text-[#9090A0] leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
          {cleaned}
        </div>
      ) : (
        <p className="text-xs text-[#9090A0] leading-relaxed line-clamp-2">{cleaned}</p>
      )}
      {/* ∨/∧ 居中 */}
      <div className="flex justify-center mt-1">
        <button type="button" onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }} className="text-[#4A4A6A] hover:text-[#9090A0] transition-colors">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
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
  const erRaw = log.executionResult;
  // 全局分析模式: executionResult={allExecutions:[{blocked,reason,blockedBy},...]}
  // 需要提取 blocked 项到顶层，让后续渲染逻辑正常工作
  const allExecs = (erRaw as any)?.allExecutions as Array<{blocked?: boolean; skipped?: boolean; reason?: string; blockedBy?: string; symbol?: string}> | undefined;
  const blockedExec = allExecs?.find(e => e.blocked);
  const skippedExec = allExecs?.find(e => e.skipped);
  const er = blockedExec
    ? { ...erRaw, blocked: true, blockedBy: blockedExec.blockedBy, reason: blockedExec.reason }
    : skippedExec && !erRaw?.blocked
      ? { ...erRaw, skipped: true, reason: skippedExec.reason }
      : erRaw;

  // 检测 Grid 网格日志格式: decision.decisions 数组 或 entryType
  const gridDecisions: any[] = Array.isArray(d.decisions) ? d.decisions : [];
  const isGridEntry = gridDecisions.length > 0 || (entry as any).entryType === 'grid_log' || d.action === 'grid_cycle';
  // grid_cycle 时 decisions 可能为空（AI 只返回 analysis 无 actions），但 gridSnapshot 仍存在
  const isGridLog = gridDecisions.length > 0 || d.action === 'grid_cycle' || !!d.gridSnapshot;
  // 检测自动禁用日志
  const isAutoDisabled = d.action === 'auto_disabled_failure';

  // 多币种合并日志（对齐 nofx: 一轮一条记录）
  const allDecisions = d.allDecisions;
  const isMultiCoin = Array.isArray(allDecisions) && allDecisions.length > 0;

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
  // reasoning = AI 分析全文（后端已统一：<reasoning>标签 > thinking > JSON摘要）
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

  // R:R — 对齐 nofx 唯一公式（估算入场价 = SL + (TP-SL) × 0.2）
  const isLongAction = action === 'open_long';
  const rr = (d.stopLoss && d.takeProfit)
    ? calcRiskReward(d.stopLoss, d.takeProfit, isLongAction)
    : null;

  // Grid: 折叠状态
  const [showGridOps, setShowGridOps] = useState(false);


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
          <span className="text-[#F8F8FC] font-medium">
            {isMultiCoin
              ? allDecisions.map(ad => (ad.symbol || '').replace(/\/USDT.*$/, '')).filter(Boolean).join(' + ')
              : ((!log.symbol || log.symbol === 'ALL') ? strategy.name : log.symbol.replace(/:USDT$/, ''))
            }
          </span>
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

      {/* === 多币种合并日志（对齐 nofx: 一轮一条） === */}
      {isMultiCoin && !isGridLog && (
        <div className="space-y-1">
          {allDecisions.map((ad, idx) => {
            const adAction = ad.action || 'wait';
            const adCfg = ACTION_CONFIG[adAction] || ACTION_CONFIG['wait'];
            const adEr = ad.executionResult;
            const adEntryPrice = adEr?.price || 0;
            const adAmt = adEr?.amount;
            const adPvl = adEr?.positionValueLimit || 0;
            const adAiReq = adEr?.aiRequestedUSD || (ad as any).positionSizeUSD || 0;
            const adNotional = adEr?.actualNotional || (adEntryPrice > 0 && adAmt ? adEntryPrice * Number(adAmt) : 0);
            const adMargin = adEr?.actualMargin || (adNotional && ad.leverage ? adNotional / ad.leverage : 0);
            const adTruncated = adEr?.wasTruncated || false;
            const adPct = adPvl > 0 && adAiReq > 0 ? Math.round(adAiReq / adPvl * 100) : (ad.positionSizePercent || 0);
            const adSymbol = (ad.symbol || '').replace(/\/USDT.*$/, '');
            const isOpen = adAction === 'open_long' || adAction === 'open_short';
            const isClose = adAction === 'close_long' || adAction === 'close_short';
            return (
              <div key={idx} className={`${idx > 0 ? 'pt-1.5 border-t border-[#1E1E2E]/50' : ''}`}>
                {/* 行1: 币种 + 动作 + 参数 */}
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-[#06B6D4] font-sans font-medium min-w-[32px]">{adSymbol}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold font-sans shrink-0" style={{ color: adCfg.color, backgroundColor: adCfg.bg }}>
                    {ACTION_I18N[adAction] ? t(ACTION_I18N[adAction]) : adCfg.label}
                  </span>
                  {isOpen && ad.leverage != null && ad.leverage > 1 && <span className="text-[#9090A0]">{ad.leverage}x</span>}
                  {isOpen && adMargin > 0 && <span className="text-[#10B981]">${adMargin.toFixed(2)}</span>}
                  {(isOpen || isClose) && adEntryPrice > 0 && <span className="text-[#F8F8FC]">${adEntryPrice.toFixed(2)}</span>}
                  {(isOpen || isClose) && adAmt && <span className="text-[#F8F8FC]">×{adAmt}</span>}
                  <span className="ml-auto font-semibold shrink-0" style={{ color: (ad.confidence ?? 0) >= 80 ? '#22C55E' : (ad.confidence ?? 0) >= 60 ? '#F59E0B' : '#F43F5E' }}>{ad.confidence ?? 0}%</span>
                </div>
                {/* 行2: 上限 + 百分比 + 名义（仅开仓） */}
                {isOpen && (adPvl > 0 || adNotional > 0) && (
                  <div className="text-[10px] text-[#606070] font-mono ml-[40px] mt-0.5">
                    {adPvl > 0 && <>{t('timeline.limitLabel')}${adPvl.toFixed(0)} </>}
                    {adPct > 0 && <span className="text-[#06B6D4]">{adPct}%</span>}
                    {adPct > 0 && <> </>}
                    {adNotional > 0 && (
                      adTruncated
                        ? <>{t('timeline.notionalLabel')} <span className="text-[#F59E0B]">${Number(adAiReq).toFixed(0)}→${adNotional.toFixed(0)}</span></>
                        : <>{t('timeline.notionalLabel')} ${adNotional.toFixed(0)}</>
                    )}
                  </div>
                )}
                {/* 行3: SL/TP + R:R（仅开仓） */}
                {isOpen && (ad.stopLoss != null || ad.takeProfit != null) && (
                  <div className="flex items-center gap-3 text-[10px] font-mono ml-[40px] mt-0.5">
                    {ad.stopLoss != null && (
                      <span className="text-[#F43F5E]">
                        ↓${Number(ad.stopLoss).toLocaleString()}
                        {adEntryPrice > 0 && <span className="opacity-60"> ({((ad.stopLoss - adEntryPrice) / adEntryPrice * 100).toFixed(1)}%)</span>}
                      </span>
                    )}
                    {ad.takeProfit != null && (
                      <span className="text-[#10B981]">
                        ↑${Number(ad.takeProfit).toLocaleString()}
                        {adEntryPrice > 0 && <span className="opacity-60"> (+{((ad.takeProfit - adEntryPrice) / adEntryPrice * 100).toFixed(1)}%)</span>}
                      </span>
                    )}
                    {ad.stopLoss != null && ad.takeProfit != null && (() => {
                      const adIsLong = adAction === 'open_long';
                      const rrVal = calcRiskReward(ad.stopLoss, ad.takeProfit, adIsLong);
                      return rrVal && rrVal > 0 ? <span className={`ml-auto font-semibold ${rrVal >= 2 ? 'text-[#10B981]' : rrVal >= 1.5 ? 'text-[#F59E0B]' : 'text-[#F43F5E]'}`}>1:{rrVal.toFixed(1)}</span> : null;
                    })()}
                  </div>
                )}
                {/* 拦截原因 */}
                {adEr?.blocked && (
                  <div className="text-[10px] text-[#F59E0B] ml-[40px] mt-0.5">{adEr.reason || adEr.blockedBy}</div>
                )}
                {/* 每币reasoning（对齐nofx: 短信号摘要，不重复整体分析） */}
                {ad.reasoning && !adEr?.blocked && (() => {
                  const r = String(ad.reasoning);
                  // 跳过：与整体分析相同 或 包含全局账户信息（非该币独立分析）
                  if (r === reasoning) return null;
                  if (r.length > 200 && (r.includes('账户') || r.includes('保证金使用率') || r.includes('策略权益'))) return null;
                  return <CoinReasoning text={r} />;
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* 多币种合并日志的共享 AI 分析 + 市场数据 */}
      {isMultiCoin && (
        <div className="mt-1.5">
          {/* 市场数据快照 — 多币种模式隐藏（指标已包含在每币reasoning中）
              恢复方法：取消下方注释即可
          {(() => {
            const snapshotDecision = allDecisions?.find(ad => ad.marketSnapshot);
            const ms = snapshotDecision?.marketSnapshot || d.marketSnapshot;
            if (!ms) return null;
            const atrPct = ms.atr14 && ms.price ? (ms.atr14 / ms.price * 100) : null;
            return (
              <div className="text-[11px] font-mono space-y-0.5 mb-2">
                <div className="grid grid-cols-4 text-[#9090A0]">
                  <span className="text-[#F8F8FC]">${ms.price?.toFixed(2) || '—'}</span>
                  <span>RSI {ms.rsi14?.toFixed(1) ?? '—'}</span>
                  <span>{ms.macdHist != null ? `MACD ${ms.macdHist.toFixed(3)}` : ''}</span>
                  <span className="text-right">{atrPct != null ? `ATR ${atrPct.toFixed(2)}%` : ''}</span>
                </div>
                <div className="grid grid-cols-4 text-[#9090A0]">
                  <span>{ms.fundingRate != null ? `FR ${(ms.fundingRate * 100).toFixed(4)}%` : ''}</span>
                  <span>{ms.longPct != null ? `${Math.round(ms.longPct)}/${Math.round(100 - ms.longPct)}` : ''}</span>
                  <span>{ms.oiChange != null ? `OI ${ms.oiChange}` : ''}</span>
                  <span className="text-right">{ms.emaTrend && <span className={ms.emaTrend.includes('多') ? 'text-[#10B981]' : ms.emaTrend.includes('空') ? 'text-[#F43F5E]' : ''}>EMA {ms.emaTrend}</span>}</span>
                </div>
                <div className="flex items-center justify-between">
                  {ms.dataSources && Object.entries(ms.dataSources).map(([k, v]) => (
                    <span key={k} className={`text-[10px] ${v ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {k === 'oi' ? 'OI' : k === 'fr' ? 'FR' : k === 'ranking' ? '排名' : k === 'enhanced' ? '增强' : k === 'oiRanking' ? 'OI榜' : k === 'netFlow' ? '资金流' : '涨跌'}{v ? '✓' : '✗'}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
          */}
          {/* AI 整体市场分析（来自 analysis 字段，存入 d.reasoning） */}
          {reasoning && (
            <AiThinkingSection text={reasoning} modelId={d.modelId || (Array.isArray(strategy.models) ? strategy.models[0] : undefined)} />
          )}
        </div>
      )}

      {/* === 普通 Solo: 极简决策卡片 === */}
      {!isGridLog && !isAutoDisabled && !isMultiCoin && !(isGridEntry && !isGridLog) && (
        <div className="space-y-1.5">
          {/* 行1-2: 开仓 — 决策参数 + 仓位计算链 */}
          {(action === 'open_long' || action === 'open_short') && (() => {
            const amt = er?.amount ?? (d as any).quantity;
            // 优先用后端存的计算链数据，回退到前端计算
            const pvl = er?.positionValueLimit || 0;
            const aiReq = er?.aiRequestedUSD || (d as any).positionSizeUSD || 0;
            const notional = er?.actualNotional || (entryPrice > 0 && amt ? entryPrice * Number(amt) : 0);
            const margin = er?.actualMargin || (notional && d.leverage ? notional / d.leverage : 0);
            const truncated = er?.wasTruncated || false;
            // 反算 AI 选择的仓位百分比
            const aiPct = pvl > 0 && aiReq > 0 ? Math.round(aiReq / pvl * 100) : (d.positionSizePercent || 0);
            return (
              <>
                {/* 行1: [开多] 3x  $113保证金  $633.14  ×0.54  75% */}
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="px-2 py-0.5 rounded-md font-semibold font-sans" style={{ color: actionCfg.color, backgroundColor: actionCfg.bg }}>
                    {ACTION_I18N[action] ? t(ACTION_I18N[action]) : actionCfg.label}
                  </span>
                  {d.leverage != null && d.leverage > 1 && <span className="text-[#9090A0]">{d.leverage}x</span>}
                  {margin > 0 && <span className="text-[#10B981]">${margin.toFixed(2)}</span>}
                  {entryPrice > 0 && <span className="text-[#F8F8FC]">${entryPrice.toFixed(2)}</span>}
                  {amt && <span className="text-[#F8F8FC]">×{amt}</span>}
                  {d.confidence != null && <span className="font-semibold" style={{ color: d.confidence >= 80 ? '#22C55E' : d.confidence >= 60 ? '#F59E0B' : '#F43F5E' }}>{d.confidence}%</span>}
                </div>
                {/* 行2: 上限$720  60%  名义 $342 */}
                <div className="text-[10px] text-[#606070] font-mono pl-1">
                  {pvl > 0 && <>{t('timeline.limitLabel') || '上限'}${pvl.toFixed(0)} </>}
                  {aiPct > 0 && <span className="text-[#06B6D4]">{aiPct}%</span>}
                  {aiPct > 0 && <> </>}
                  {notional > 0 && (
                    truncated
                      ? <>{t('timeline.notionalLabel')} <span className="text-[#F59E0B]">${Number(aiReq).toFixed(0)}→${notional.toFixed(0)}</span> ({t('timeline.truncated')})</>
                      : <>{t('timeline.notionalLabel')} ${notional.toFixed(0)}</>
                  )}
                </div>
              </>
            );
          })()}

          {/* 平仓 — 各参数独立元素 justify-between */}
          {(action === 'close_long' || action === 'close_short') && (
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="px-2 py-0.5 rounded-md font-semibold font-sans" style={{ color: actionCfg.color, backgroundColor: actionCfg.bg }}>
                {ACTION_I18N[action] ? t(ACTION_I18N[action]) : actionCfg.label}
              </span>
              <span className="text-[#F8F8FC]">${entryPrice > 0 ? entryPrice.toFixed(2) : '-'}</span>
              <span className="text-[#606070]">→</span>
              <span className="text-[#F8F8FC]">{er?.price ? `$${Number(er.price).toFixed(2)}` : '-'}</span>
              {(er?.amount || (d as any).quantity) && <span className="text-[#F8F8FC]">×{er?.amount ?? (d as any).quantity}</span>}
              {d.confidence != null && <span className="font-semibold" style={{ color: d.confidence >= 80 ? '#22C55E' : d.confidence >= 60 ? '#F59E0B' : '#F43F5E' }}>{d.confidence}%</span>}
            </div>
          )}

          {/* 观望/持仓 */}
          {(action === 'wait' || action === 'hold') && (
            <div className="flex items-center justify-between text-xs">
              <span className="px-2 py-0.5 rounded-md font-semibold bg-[#64748B]/10 text-[#94A3B8]">
                {ACTION_I18N[action] ? t(ACTION_I18N[action]) : (action === 'hold' ? '持仓' : '观望')}
              </span>
              {d.confidence != null && (
                <span className="font-mono font-semibold" style={{
                  color: d.confidence >= 80 ? '#22C55E' : d.confidence >= 60 ? '#F59E0B' : '#F43F5E',
                }}>{d.confidence}%</span>
              )}
            </div>
          )}

          {/* 行2: 止损/止盈/盈亏比 — 3列网格 */}
          {!isCloseAction && (d.stopLoss != null || d.takeProfit != null) && (
            <div className="grid grid-cols-3 text-[11px] font-mono">
              <span className="text-[#F43F5E]">
                {d.stopLoss != null && <>↓${Number(d.stopLoss).toLocaleString()} <span className="opacity-50 text-[10px]">({d.stopLossPct ? `-${(d.stopLossPct * 100).toFixed(1)}%` : entryPrice > 0 ? calcPct(entryPrice, d.stopLoss) : ''})</span></>}
              </span>
              <span className="text-[#10B981]">
                {d.takeProfit != null && <>↑${Number(d.takeProfit).toLocaleString()} <span className="opacity-50 text-[10px]">({d.takeProfitPct ? `+${(d.takeProfitPct * 100).toFixed(1)}%` : entryPrice > 0 ? calcPct(entryPrice, d.takeProfit) : ''})</span></>}
              </span>
              <span className="font-semibold text-right" style={{ color: rr != null ? rrColor(rr) : '#606070' }}>
                {rr != null && <>1:{rr.toFixed(1)}</>}
              </span>
            </div>
          )}

          {/* 市场数据 — 3行均衡布局 */}
          {d.marketSnapshot && (() => {
            const ms = d.marketSnapshot;
            const atrPct = ms.atr14 && ms.price > 0 ? (ms.atr14 / ms.price * 100) : null;
            return (
              <div className="text-[11px] font-mono space-y-0.5">
                {/* 行1: 价格 RSI MACD ATR — grid-cols-4 */}
                <div className="grid grid-cols-4 text-[#9090A0]">
                  <span className="text-[#F8F8FC]">{ms.price != null ? `$${ms.price.toFixed(2)}` : '—'}</span>
                  <span>RSI {ms.rsi14?.toFixed(1) ?? '—'}</span>
                  <span>{ms.macdHist != null ? `MACD ${ms.macdHist.toFixed(3)}` : ''}</span>
                  <span className="text-right">{atrPct != null ? `ATR ${atrPct.toFixed(2)}%` : ''}</span>
                </div>
                {/* 行2: FR 多空比 OI+四象限 EMA趋势 — grid-cols-4 */}
                <div className="grid grid-cols-4 text-[#9090A0]">
                  <span>{ms.fundingRate != null ? `FR ${(ms.fundingRate * 100).toFixed(4)}%` : ''}</span>
                  <span>{ms.longPct != null ? `${Math.round(ms.longPct)}/${Math.round(100 - ms.longPct)}` : ''}</span>
                  <span>{ms.oiChange != null ? `OI ${ms.oiChange}` : ''}</span>
                  <span className="text-right">{ms.emaTrend && <span className={ms.emaTrend.includes('多') ? 'text-[#10B981]' : ms.emaTrend.includes('空') ? 'text-[#F43F5E]' : ''}>EMA {ms.emaTrend}</span>}</span>
                </div>
                {/* 行3: 机构流+数据源标记 — flex justify-between */}
                <div className="flex items-center justify-between">
                  {ms.institutionFlow != null && ms.institutionFlow !== 0 && (
                    <span className={`${ms.institutionFlow > 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}`}>
                      {ms.institutionFlow > 0 ? '+' : ''}{(ms.institutionFlow / 1e6).toFixed(1)}M
                    </span>
                  )}
                  {ms.stablecoinNet != null && ms.stablecoinNet !== 0 && (
                    <span className={ms.stablecoinNet > 0 ? 'text-[#10B981]' : 'text-[#F43F5E]'}>
                      {ms.stablecoinNet > 0 ? '+' : ''}${(ms.stablecoinNet / 1e6).toFixed(0)}M
                    </span>
                  )}
                  {ms.dataSources && Object.entries(ms.dataSources).map(([k, v]) => (
                    <span key={k} className={`text-[10px] ${v ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {k === 'oi' ? 'OI' : k === 'fr' ? 'FR' : k === 'ranking' ? '排名' : k === 'enhanced' ? '增强' : k === 'oiRanking' ? 'OI榜' : k === 'netFlow' ? '资金流' : '涨跌'}{v ? '✓' : '✗'}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* AI 思考过程（对齐 nofx: 默认折叠，展开纯文本） */}
          {d.aiThinking && (
            <AiThinkingSection text={d.aiThinking as string} modelId={d.modelId || (Array.isArray(strategy.models) ? strategy.models[0] : undefined)} />
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
                close_long: 'timeline.gridCloseLongShort',
                close_short: 'timeline.gridCloseShortShort',
                resume_grid: 'timeline.gridResumeShort',
              };
              const parts = Object.entries(counts).map(([act, n]) => {
                const key = SHORT_KEYS[act];
                const label = key ? t(key) : t('timeline.gridHoldShort');
                return `${n}${label}`;
              });
              return parts.join('/') || d.gridSummary || t('timeline.gridOpsCount', { count: gridDecisions.length });
            })()}
          </span>

          {/* 网格状态快照 — 只展示卡片上没有的信息 */}
          {d.gridSnapshot && (
            <div className="space-y-1 text-[11px]">
              {/* 行1：价格区间 + 格间距 */}
              <div className="grid grid-cols-2 gap-x-4">
                <div className="flex justify-between">
                  <span className="text-[#606070]">{t('timeline.gridRange')}</span>
                  <span className="font-mono text-[#F8F8FC]">${Number(d.gridSnapshot.lowerPrice).toFixed(2)}~${Number(d.gridSnapshot.upperPrice).toFixed(2)}</span>
                </div>
                {d.gridSnapshot.gridSpacing != null && (
                  <div className="flex justify-between">
                    <span className="text-[#606070]">{t('timeline.gridSpacingLabel')}</span>
                    <span className="font-mono text-[#F8F8FC]">${d.gridSnapshot.gridSpacing.toFixed(4)}</span>
                  </div>
                )}
              </div>
              {/* 行2：持仓格数 + 挂单格数 */}
              <div className="grid grid-cols-2 gap-x-4">
                <div className="flex justify-between">
                  <span className="text-[#606070]">{t('timeline.gridFilledLevels')}</span>
                  <span className={`font-mono ${(d.gridSnapshot.filledLevels ?? 0) > 0 ? 'text-[#06B6D4]' : 'text-[#9090A0]'}`}>
                    {d.gridSnapshot.filledLevels ?? 0}/{d.gridSnapshot.totalLevels}
                  </span>
                </div>
                {d.gridSnapshot.pendingLevels != null && (
                  <div className="flex justify-between">
                    <span className="text-[#606070]">{t('timeline.gridPendingLevels')}</span>
                    <span className="text-[#F8F8FC]">{d.gridSnapshot.pendingLevels}</span>
                  </div>
                )}
              </div>
              {/* 行3：持仓浮盈（左）+ 最大回撤（右） */}
              {(d.gridSnapshot.unrealizedPnl != null || d.gridSnapshot.maxDrawdown != null) && (
                <div className="grid grid-cols-2 gap-x-4">
                  {d.gridSnapshot.unrealizedPnl != null ? (
                    <div className="flex justify-between">
                      <span className="text-[#606070]">{t('timeline.gridPositionPnl')}</span>
                      <span className={`font-mono ${d.gridSnapshot.unrealizedPnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {d.gridSnapshot.unrealizedPnl >= 0 ? '+' : ''}{d.gridSnapshot.unrealizedPnl.toFixed(2)}
                      </span>
                    </div>
                  ) : <div />}
                  {d.gridSnapshot.maxDrawdown != null && (
                    <div className="flex justify-between">
                      <span className="text-[#606070]">{t('timeline.gridMaxDrawdown')}</span>
                      <span className="font-mono text-[#EF4444]">{d.gridSnapshot.maxDrawdown.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              )}
              {/* 行4：杠杆（左）+ 方向 · 市场形态（右，内联） */}
              {(d.gridSnapshot.leverage != null || d.gridSnapshot.direction || d.gridSnapshot.regime) && (
                <div className="grid grid-cols-2 gap-x-4">
                  {d.gridSnapshot.leverage != null ? (
                    <div className="flex justify-between">
                      <span className="text-[#606070]">{t('timeline.gridLeverage')}</span>
                      <span className="font-mono text-[#F8F8FC]">
                        {d.gridSnapshot.leverage}x
                        {!d.gridSnapshot.userFixedLeverage && (
                          <span className="text-[#06B6D4] ml-1 text-[10px]">AI</span>
                        )}
                      </span>
                    </div>
                  ) : <div />}
                  {(d.gridSnapshot.direction || d.gridSnapshot.regime) && (
                    <div className="flex justify-between gap-1 flex-wrap">
                      {d.gridSnapshot.direction && (
                        <span className="text-[#9090A0]">
                          <span className="text-[#606070]">{t('timeline.gridDirection')} </span>
                          {GRID_DIR_I18N[d.gridSnapshot.direction] ? t(GRID_DIR_I18N[d.gridSnapshot.direction]) : d.gridSnapshot.direction}
                        </span>
                      )}
                      {d.gridSnapshot.direction && d.gridSnapshot.regime && (
                        <span className="text-[#444]">·</span>
                      )}
                      {d.gridSnapshot.regime && (
                        <span className="text-[#9090A0]">
                          <span className="text-[#606070]">{t('timeline.gridRegime')} </span>
                          {GRID_REGIME_I18N[d.gridSnapshot.regime] ? t(GRID_REGIME_I18N[d.gridSnapshot.regime]) : d.gridSnapshot.regime}
                        </span>
                      )}
                    </div>
                  )}
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
            <div className="space-y-1 max-h-[400px] overflow-y-auto px-1">
              {/* 层级状态表：持仓/挂单/空格，供用户核对交易所 */}
              {d.gridSnapshot?.gridLines && Array.isArray(d.gridSnapshot.gridLines) && d.gridSnapshot.gridLines.length > 0 && (
                <div className="mb-2 pb-2 border-b border-[#1E1E2E]">
                  <div className="text-[9px] text-[#606070] mb-1 px-0.5">{t('timeline.gridLayerState')}</div>
                  <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                    {d.gridSnapshot.gridLines.map((gl: any) => {
                      const isFilled = gl.st === 'filled';
                      const isPending = gl.st === 'pending';
                      const color = isFilled ? '#06B6D4' : isPending ? '#9090A0' : '#3A3A4A';
                      const textColor = isFilled ? '#06B6D4' : isPending ? '#9090A0' : '#505060';
                      return (
                        <div
                          key={gl.lv}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px]"
                          style={{ backgroundColor: `${color}12` }}
                        >
                          <span className="font-mono" style={{ color: textColor }}>L{gl.lv}</span>
                          <span style={{ color: gl.s === 'buy' ? '#10B981' : '#F23645', fontSize: '8px' }}>
                            {gl.s === 'buy' ? '买' : '卖'}
                          </span>
                          <span className="font-mono" style={{ color: isFilled ? '#06B6D4' : '#9090A0' }}>{Number(gl.p).toFixed(2)}</span>
                          {(isFilled || isPending) && gl.qty > 0 && (
                            <span className="font-mono" style={{ color: textColor }}>×{gl.qty}</span>
                          )}
                          {isFilled && gl.ep && (
                            <span className="font-mono" style={{ color: '#06B6D4' }}>@{Number(gl.ep).toFixed(2)}</span>
                          )}
                          {!isFilled && !isPending && (
                            <span className="text-[#404050]">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* 交易所真实持仓（与 AI 文案数据源一致） */}
                  {d.gridSnapshot?.exchPos && (
                    <div className="flex flex-wrap gap-2 mt-1 px-0.5">
                      {d.gridSnapshot.exchPos.long && (
                        <span className="text-[9px] text-[#10B981]">
                          {t('timeline.exchLong', { fallback: '交易所多头' })}: {d.gridSnapshot.exchPos.long.qty} @ ${Number(d.gridSnapshot.exchPos.long.ep).toFixed(2)} ({d.gridSnapshot.exchPos.long.pnl >= 0 ? '+' : ''}{d.gridSnapshot.exchPos.long.pnl})
                        </span>
                      )}
                      {d.gridSnapshot.exchPos.short && (
                        <span className="text-[9px] text-[#F23645]">
                          {t('timeline.exchShort', { fallback: '交易所空头' })}: {d.gridSnapshot.exchPos.short.qty} @ ${Number(d.gridSnapshot.exchPos.short.ep).toFixed(2)} ({d.gridSnapshot.exchPos.short.pnl >= 0 ? '+' : ''}{d.gridSnapshot.exchPos.short.pnl})
                        </span>
                      )}
                      {!d.gridSnapshot.exchPos.long && !d.gridSnapshot.exchPos.short && (
                        <span className="text-[9px] text-[#505060]">{t('timeline.exchNoPos', { fallback: '交易所无持仓' })}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              {gridDecisions.map((op: any, idx: number) => {
                const opCfg = GRID_ACTION_I18N[op.action];
                const opColor = op.action === 'cancel_order'
                  ? (op.cancelSide === 'buy' ? '#10B981' : op.cancelSide === 'sell' ? '#F43F5E' : opCfg?.color || '#9090A0')
                  : (opCfg?.color || '#9090A0');
                const opLabel = op.action === 'cancel_order' && op.cancelSide
                  ? (op.cancelSide === 'buy' ? t('timeline.gridCancelBuy', { fallback: '撤买单' }) : t('timeline.gridCancelSell', { fallback: '撤卖单' }))
                  : (opCfg ? t(opCfg.key) : op.action);
                const OP_HINT: Record<string, string> = {
                  adjust_grid: '撤单后以当前价重建网格',
                  exit_all: '撤销全部挂单（持仓不变）',
                  cancel_all_orders: '撤销全部挂单（持仓不变）',
                  pause_grid: '暂停挂单，持仓保留',
                };
                // 匹配执行结果：按 level 匹配（优先），兜底按 index 匹配
                const opLevel = op.level_index ?? op.level;
                const erAny = er as any;
                const errMatch = erAny?.errors?.find?.((e: any) =>
                  e.action === op.action && (e.level != null ? e.level === opLevel : false)
                );
                const skipMatch = erAny?.skipped?.find?.((s: any) =>
                  s.action === op.action && (s.level != null ? s.level === opLevel : false)
                );
                const isFailed = !!errMatch;
                const isSkipped = !!skipMatch;
                const isSuccess = er && !isFailed && !isSkipped;
                return (
                  <div key={idx} className="flex items-start gap-2 py-1.5 border-t border-[#1E1E2E]/30 first:border-t-0">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
                      style={{ color: opColor, backgroundColor: `${opColor}15` }}
                    >
                      {opLabel}
                    </span>
                    <div className="flex-1 min-w-0 text-[10px] flex flex-wrap items-center gap-1.5">
                      {OP_HINT[op.action] && (
                        <span className="text-[9px] text-[#606070]">{OP_HINT[op.action]}</span>
                      )}
                      {(() => {
                        // cancel_order 专用：通过 orderId 末8位从快照反查层/价/量
                        const cancelOid = op.action === 'cancel_order'
                          ? (String(op.orderId ?? op.order_id ?? '').slice(-8) || undefined)
                          : undefined;
                        const cancelMatch = cancelOid && d.gridSnapshot?.gridLines
                          ? (d.gridSnapshot.gridLines as any[]).find((gl: any) => gl.oid === cancelOid)
                          : undefined;

                        // 层号：优先用 AI 决策 level 字段，兜底通过 orderId 或价格从快照反查
                        const directLevel = op.level_index ?? op.level;
                        const inferredLevel = directLevel == null
                          ? (cancelMatch?.lv ?? (op.price && d.gridSnapshot?.gridLines
                              ? (() => {
                                  const price = Number(op.price);
                                  const match = (d.gridSnapshot.gridLines as any[]).find(
                                    (gl: any) => Math.abs(Number(gl.p) - price) < 0.001
                                  );
                                  return match ? match.lv : null;
                                })()
                              : null))
                          : null;
                        const displayLevel = directLevel ?? inferredLevel;

                        // 价格/数量：优先 op 自带，否则从 cancel 快照补
                        const displayPrice = op.price || cancelMatch?.p;
                        const displayQty = op.quantity || cancelMatch?.qty;

                        return (
                          <>
                            {displayLevel != null && (
                              <span
                                className="px-1 py-0.5 rounded text-[9px] font-mono font-semibold flex-shrink-0"
                                style={{ color: opColor, backgroundColor: `${opColor}20` }}
                              >
                                L{displayLevel}
                              </span>
                            )}
                            {displayPrice ? (
                              <span className="font-mono text-[#F8F8FC]">${Number(displayPrice).toFixed(2)}</span>
                            ) : null}
                            {displayQty ? (
                              <span className="font-mono text-[#9090A0]">×{parseFloat(Number(displayQty).toFixed(6))}</span>
                            ) : null}
                          </>
                        );
                      })()}
                      {/* 执行状态标记 */}
                      {isFailed && <span className="text-[#EF4444] font-medium">✗</span>}
                      {isSkipped && <span className="text-[#F59E0B] font-medium">⊘</span>}
                      {isSuccess && <span className="text-[#10B981] font-medium">✓</span>}
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
              {er.blockedBy && <span className="text-[#606070]"> ({BLOCKED_BY_I18N[er.blockedBy] ? t(BLOCKED_BY_I18N[er.blockedBy]) : er.blockedBy})</span>}
              {er.reason && <span className="text-[#606070]"> · {er.reason}</span>}
            </div>
          </div>
        ) : isGridLog && log.executed && (er as any)?.skipped?.some((s: any) => s.action?.startsWith('place_')) ? (
          // 网格挂单被跳过（仓位超限 / 数量不足 等），displayed as amber warning
          (() => {
            const skippedOps: Array<{ action: string; reason?: string }> = (er as any)?.skipped || [];
            const skippedPlaces = skippedOps.filter(s => s.action?.startsWith('place_'));
            const firstReason = skippedPlaces[0]?.reason ?? '';
            // 截取核心原因（去掉详细数字，避免太长）
            const reasonShort = firstReason.includes('总仓位已满') ? t('timeline.gridSkipCapFull')
              : firstReason.includes('数量不足') ? t('timeline.gridSkipMinQty')
              : firstReason.includes('spread') ? t('timeline.gridSkipSpread')
              : firstReason ? firstReason.slice(0, 30) : t('timeline.gridSkipped');
            return (
              <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-md bg-[#F59E0B]/5 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-[#F59E0B] font-medium">{t('timeline.gridSkipped')}</span>
                  {skippedPlaces.length > 0 && (
                    <span className="text-[#606070]"> · {reasonShort}</span>
                  )}
                </div>
              </div>
            );
          })()
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
            <span className="text-[#10B981] font-medium">{t('timeline.executed')}</span>
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
            const isCapExceeded = firstErrRaw.includes('总仓位已满');
            const isMinQtySkip  = firstErrRaw.includes('数量不足最小');
            let reasonText: string;
            let hintText: string | null = null;
            if (isMarginErr) {
              reasonText = t('detail.gridErrMargin');
              hintText   = activeOrders > 0
                ? t('detail.gridErrMarginHintActive', { count: activeOrders })
                : t('detail.gridErrMarginHintWait');
            } else if (isCapExceeded) {
              // 系统仓位上限（$投资额 × 杠杆）
              reasonText = t('timeline.gridSkipCapFull');
              hintText   = t('detail.gridErrCapHint');
            } else if (isMinQtySkip) {
              reasonText = t('timeline.gridSkipMinQty');
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
        ) : isGridLog && gridDecisions.length > 0 ? (
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
