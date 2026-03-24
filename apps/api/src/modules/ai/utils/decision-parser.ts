/**
 * JSON 鲁棒解析器 — 多层回退解析 AI 决策输出
 *
 * 6 层回退解析 + 中文标点修复 + 决策验证 + 安全兜底。
 * 降低 AI 输出解析失败率，减少 token 浪费。
 *
 * 仅供产品 B（ai_strategy 自动交易）使用。
 */

import { Logger } from '@nestjs/common';
import type { AiAction, AiTradeDecision } from '../types/ai.types';
import { AI_SAFETY_DEFAULTS } from '../constants/safety-defaults';

const logger = new Logger('DecisionParser');

// ========================= 正则预编译 =========================

/** <decision>...</decision> 标签 */
const RE_DECISION_TAG = /(?:[\s\S]*?)<decision>([\s\S]*?)<\/decision>/i;

/** <final_vote>...</final_vote> 标签（辩论模式回退） */
const RE_FINAL_VOTE_TAG = /(?:[\s\S]*?)<final_vote>([\s\S]*?)<\/final_vote>/i;

/** ```json [...] ``` 代码围栏 */
const RE_JSON_FENCE = /```json\s*([\s\S]*?)\s*```/i;

/** 裸 JSON 数组 [{...}] */
const RE_JSON_ARRAY = /\[\s*\{[\s\S]*?\}\s*\]/;

/** 裸单个 JSON 对象 {...} (含 "action" 字段) */
const RE_JSON_OBJECT = /\{[^{}]*"action"\s*:\s*"[^"]+?"[^{}]*\}/;

/** 必须以 [{ 开头 */
const RE_ARRAY_HEAD = /^\[\s*\{/;

/** 零宽字符 */
const RE_INVISIBLE = /[\u200B\u200C\u200D\uFEFF]/g;

/** <reasoning>...</reasoning> 标签 */
const RE_REASONING_TAG = /(?:[\s\S]*?)<reasoning>([\s\S]*?)<\/reasoning>/i;

// ========================= 合法 Action =========================

const VALID_ACTIONS: Set<string> = new Set([
  'open_long',
  'open_short',
  'close_long',
  'close_short',
  'hold',
  'wait',
]);

/** Action 别名映射（标准化动作名称） */
const ACTION_ALIASES: Record<string, AiAction> = {
  long: 'open_long',
  openlong: 'open_long',
  buy: 'open_long',
  short: 'open_short',
  openshort: 'open_short',
  sell: 'open_short',
  closelong: 'close_long',
  closeshort: 'close_short',
};

// ========================= 中文标点修复 =========================

/**
 * 修复中文全角标点 → ASCII 等价物（15 种替换）
 */
function fixChinesePunctuation(s: string): string {
  return s
    // Unicode curly quotes
    .replace(/\u201c/g, '"') // "
    .replace(/\u201d/g, '"') // "
    .replace(/\u2018/g, "'") // '
    .replace(/\u2019/g, "'") // '
    // Chinese full-width brackets
    .replace(/\uff3b/g, '[') // ［
    .replace(/\uff3d/g, ']') // ］
    .replace(/\uff5b/g, '{') // ｛
    .replace(/\uff5d/g, '}') // ｝
    .replace(/\uff1a/g, ':') // ：
    .replace(/\uff0c/g, ',') // ，
    // Alternative Chinese brackets
    .replace(/\u3010/g, '[') // 【
    .replace(/\u3011/g, ']') // 】
    .replace(/\u3014/g, '[') // 〔
    .replace(/\u3015/g, ']') // 〕
    .replace(/\u3001/g, ',') // 、
    // Chinese full-width space
    .replace(/\u3000/g, ' '); //
}

/**
 * 移除零宽不可见字符
 */
function removeInvisible(s: string): string {
  return s.replace(RE_INVISIBLE, '');
}

// ========================= 格式校验 =========================

/**
 * 验证 JSON 格式
 *
 * 规则:
 * 1. 必须以 [{ 开头
 * 2. 不含 ~ (区间符号)
 * 3. 不含千位分隔符 (如 12,500)
 */
function validateJSONFormat(jsonStr: string): string | null {
  const trimmed = jsonStr.trim();

  // Check 1: 以 [{ 开头
  if (!RE_ARRAY_HEAD.test(trimmed)) {
    return `JSON must start with [{ (whitespace allowed), actual: ${trimmed.slice(0, 20)}`;
  }

  // Check 2: 不含区间符号 ~
  if (jsonStr.includes('~')) {
    return 'JSON cannot contain range symbol ~, all numbers must be precise single values';
  }

  // Check 3: 不含千位分隔符
  for (let i = 0; i < jsonStr.length - 4; i++) {
    const c0 = jsonStr.charCodeAt(i);
    const c1 = jsonStr.charAt(i + 1);
    const c2 = jsonStr.charCodeAt(i + 2);
    const c3 = jsonStr.charCodeAt(i + 3);
    const c4 = jsonStr.charCodeAt(i + 4);
    if (
      c0 >= 48 && c0 <= 57 && // 0-9
      c1 === ',' &&
      c2 >= 48 && c2 <= 57 &&
      c3 >= 48 && c3 <= 57 &&
      c4 >= 48 && c4 <= 57
    ) {
      return `JSON numbers cannot contain thousand separator comma, found: ${jsonStr.slice(i, i + 10)}`;
    }
  }

  return null; // 通过
}

// ========================= Action 规范化 =========================

/**
 * 规范化 action 名称
 */
function normalizeAction(action: string): AiAction {
  const normalized = action.toLowerCase().trim().replace(/[\s-]/g, '_');
  if (VALID_ACTIONS.has(normalized)) return normalized as AiAction;
  const alias = ACTION_ALIASES[normalized.replace(/_/g, '')];
  if (alias) return alias;
  return 'wait'; // 无法识别 → 安全回退
}

// ========================= 原始决策接口 =========================

/** AI 原始 JSON 输出格式（兼容 kernel + debate 两套字段名） */
interface RawDecision {
  symbol?: string;
  action?: string;
  confidence?: number;
  leverage?: number;
  // Kernel 模式: 绝对值
  position_size_usd?: number;
  positionSizePercent?: number;
  stop_loss?: number;
  take_profit?: number;
  // Debate 模式: 百分比
  position_pct?: number;
  stop_loss_pct?: number;
  take_profit_pct?: number;
  // 通用
  reasoning?: string;
  risk_usd?: number;
}

// ========================= 核心解析函数 =========================

/**
 * 解析 AI 原始输出 → AiTradeDecision[]
 *
 * 6 层回退管线（递进式解析）:
 *   L1: <decision> XML 标签
 *   L2: ```json 代码围栏
 *   L3: 裸 JSON 数组 [...]
 *   L4: 中文标点修复 + 格式校验
 *   L5: JSON.parse
 *   L6: 安全回退（返回 wait）
 *
 * @param raw AI 完整原始输出
 * @param defaultSymbol 默认币种（单币模式时使用）
 */
export function parseDecisions(
  raw: string,
  defaultSymbol?: string,
): AiTradeDecision[] {
  if (!raw || !raw.trim()) {
    logger.warn('[SafeFallback] AI 输出为空，进入安全等待模式');
    return [buildWaitDecision('AI 模型输出为空，进入安全等待', defaultSymbol)];
  }

  // 预处理
  let s = removeInvisible(raw);
  s = s.trim();
  s = fixChinesePunctuation(s);

  // ── L1: <decision> 或 <final_vote> 标签 ──
  let jsonPart: string | null = null;

  const decisionMatch = RE_DECISION_TAG.exec(s);
  if (decisionMatch?.[1]) {
    jsonPart = decisionMatch[1].trim();
    logger.log('Extracted JSON using <decision> tag');
  } else {
    const voteMatch = RE_FINAL_VOTE_TAG.exec(s);
    if (voteMatch?.[1]) {
      jsonPart = voteMatch[1].trim();
      logger.log('Extracted JSON using <final_vote> tag');
    }
  }

  // 如果标签内找到了内容，尝试解析
  if (jsonPart) {
    const result = tryParseJSON(jsonPart, defaultSymbol);
    if (result) return result;
    // 标签内容解析失败 → 继续搜索全文
    logger.warn('<decision> tag content parsing failed, searching full text');
  }

  // ── L2: ```json 代码围栏 ──
  const fenceMatch = RE_JSON_FENCE.exec(s);
  if (fenceMatch?.[1]) {
    const fenceContent = fixChinesePunctuation(fenceMatch[1].trim());
    const result = tryParseJSON(fenceContent, defaultSymbol);
    if (result) {
      logger.log('Extracted JSON from code fence');
      return result;
    }
  }

  // ── L3: 裸 JSON 数组 ──
  const arrayMatch = RE_JSON_ARRAY.exec(jsonPart ?? s);
  if (arrayMatch?.[0]) {
    const arrayContent = fixChinesePunctuation(arrayMatch[0]);
    const result = tryParseJSON(arrayContent, defaultSymbol);
    if (result) {
      logger.log('Extracted JSON from raw array');
      return result;
    }
  }

  // ── L3.5: 裸单个 JSON 对象 {"action": ...} ──
  const objectMatch = RE_JSON_OBJECT.exec(jsonPart ?? s);
  if (objectMatch?.[0]) {
    const objectContent = fixChinesePunctuation(objectMatch[0]);
    try {
      const single: RawDecision = JSON.parse(objectContent);
      if (single && single.action) {
        const d = convertRawDecision(single, defaultSymbol);
        if (d) {
          logger.log('Extracted JSON from single object');
          return [d];
        }
      }
    } catch {
      // 继续回退
    }
  }

  // ── L6: 安全回退 ──
  logger.warn('[SafeFallback] AI 未输出结构化 JSON 决策，进入安全等待模式');
  const action = fallbackParseAction(s);

  // 尝试提取 <reasoning> 标签内容作为推理文本（即使 <decision> 缺失）
  const reasoningMatch = RE_REASONING_TAG.exec(s);
  const reasoningText = reasoningMatch?.[1]?.trim() || '';
  const fallbackReasoning = reasoningText || `AI 未输出有效决策格式，回退动作: ${action}`;

  return [buildWaitDecision(fallbackReasoning, defaultSymbol, action)];
}

/**
 * 解析带 analysis 的决策（对齐网格 {analysis, decisions} 格式）
 *
 * 优先解析 {analysis, decisions} 对象格式；
 * 降级到 <reasoning>+<decision> XML 格式；
 * 最终降级到 parseDecisions() 兜底。
 */
export function parseDecisionsWithAnalysis(
  raw: string,
  defaultSymbol?: string,
): { decisions: AiTradeDecision[]; analysis?: string } {
  if (!raw || !raw.trim()) {
    return { decisions: [buildWaitDecision('AI 模型输出为空', defaultSymbol)] };
  }

  let s = removeInvisible(raw).trim();
  s = fixChinesePunctuation(s);

  // 1. 提取 <reasoning> 标签内容作为 analysis（给用户看的市场分析）
  //    XML 格式天然分离分析和决策，DeepSeek 不会混入格式废话
  const analysis = extractReasoning(s) || undefined;

  // 2. 解析决策 JSON（支持 <decision> 标签 / {analysis,decisions} 对象 / 裸数组）
  const decisions = parseDecisions(s, defaultSymbol);

  if (analysis) {
    logger.log(`Parsed <reasoning> analysis: ${analysis.length}chars, ${decisions.length} decisions`);
  }

  return { decisions, analysis };
}


/**
 * 尝试 JSON 解析（L4-L5: 格式校验 + JSON.parse）
 */
function tryParseJSON(
  content: string,
  defaultSymbol?: string,
): AiTradeDecision[] | null {
  let cleaned = content.trim();

  // 压缩 [ { → [{
  cleaned = cleaned.replace(/^\[\s+\{/, '[{');

  // 再次修复标点
  cleaned = fixChinesePunctuation(cleaned);

  // 尝试解析为数组
  if (RE_ARRAY_HEAD.test(cleaned)) {
    const formatErr = validateJSONFormat(cleaned);
    if (formatErr) {
      logger.warn(`JSON format validation failed: ${formatErr}`);
      return null;
    }

    try {
      const rawArr: RawDecision[] = JSON.parse(cleaned);
      if (Array.isArray(rawArr) && rawArr.length > 0) {
        return rawArr
          .map((r) => convertRawDecision(r, defaultSymbol))
          .filter((d) => d !== null) as AiTradeDecision[];
      }
    } catch (e) {
      logger.warn(`JSON.parse array failed: ${(e as Error).message}`);
    }
  }

  // 尝试解析为单个对象
  try {
    const single: RawDecision = JSON.parse(cleaned);
    if (single && typeof single === 'object' && single.action) {
      const d = convertRawDecision(single, defaultSymbol);
      if (d) return [d];
    }
  } catch {
    // 继续回退
  }

  // 在内容中搜索 JSON 数组
  const innerMatch = RE_JSON_ARRAY.exec(cleaned);
  if (innerMatch?.[0] && innerMatch[0] !== cleaned) {
    try {
      const rawArr: RawDecision[] = JSON.parse(innerMatch[0]);
      if (Array.isArray(rawArr) && rawArr.length > 0) {
        return rawArr
          .map((r) => convertRawDecision(r, defaultSymbol))
          .filter((d) => d !== null) as AiTradeDecision[];
      }
    } catch {
      // 最终回退
    }
  }

  return null;
}

/**
 * 将 AI 原始 JSON 对象转换为 AiTradeDecision
 */
function convertRawDecision(
  r: RawDecision,
  defaultSymbol?: string,
): AiTradeDecision | null {
  if (!r || !r.action) return null;

  const action = normalizeAction(r.action);

  // SL/TP: 优先使用明确字段，回退到 _pct
  let stopLoss = r.stop_loss ?? r.stop_loss_pct ?? null;
  let takeProfit = r.take_profit ?? r.take_profit_pct ?? null;

  // 对齐 nofx：优先使用 position_size_usd（美元绝对值）
  let positionSizeUSD: number | undefined;
  let positionSizePercent: number;

  if (r.position_size_usd && r.position_size_usd > 0) {
    // nofx 模式：AI 直接输出美元值
    positionSizeUSD = r.position_size_usd;
    positionSizePercent = 0;
  } else {
    // 回退到百分比模式（兼容 debate 等场景）
    positionSizePercent =
      r.positionSizePercent ??
      (r.position_pct !== undefined && r.position_pct !== null
        ? r.position_pct * 100
        : null) ??
      10;
    if (positionSizePercent > 0 && positionSizePercent <= 1) {
      positionSizePercent = positionSizePercent * 100;
    }
    positionSizePercent = clamp(positionSizePercent, 1, 100);
  }

  return {
    action,
    confidence: clamp(r.confidence ?? 50, 0, 100),
    leverage: r.leverage && r.leverage > 0 ? r.leverage : 5,
    positionSizePercent,
    positionSizeUSD,
    stopLoss: stopLoss && stopLoss > 0 ? stopLoss : null,
    takeProfit: takeProfit && takeProfit > 0 ? takeProfit : null,
    reasoning: r.reasoning ?? '',
    ...(r.symbol ? { symbol: r.symbol } : {}),
  };
}

// ========================= 决策验证 =========================

/** 验证结果 */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  /** 如果 leverage 被 clamp，返回修正后的决策 */
  clamped?: AiTradeDecision;
}

/**
 * 验证单个决策
 *
 * 规则:
 * - action 合法性
 * - leverage: BTC/ETH ≤ 20x, 其他 ≤ 10x（超限自动 clamp）
 * - 仓位最小值: BTC/ETH ≥ $60, 其他 ≥ $12
 * - SL/TP 方向: long SL < TP, short SL > TP
 * - R/R ≥ 3.0:1
 *
 * @param d 决策
 * @param equity 账户权益（用于计算最大仓位）
 * @param symbol 币种
 * @param currentPrice 当前价格（用于 R/R 计算）
 */
export function validateDecision(
  d: AiTradeDecision,
  equity: number,
  symbol: string,
  currentPrice?: number,
): ValidationResult {
  // 非交易 action 无需验证
  if (d.action === 'hold' || d.action === 'wait') {
    return { valid: true };
  }

  // 平仓 action 只需检查 action 合法性
  if (d.action === 'close_long' || d.action === 'close_short') {
    return { valid: true };
  }

  // 以下验证仅针对 open_long / open_short
  const isBtcEth = /^(BTC|ETH)/i.test(symbol);
  let clamped: AiTradeDecision | undefined;

  // ── 1. Leverage ──
  const maxLeverage = isBtcEth ? 20 : 10;
  if (d.leverage <= 0) {
    return { valid: false, reason: `leverage must be > 0: ${d.leverage}` };
  }
  if (d.leverage > maxLeverage) {
    logger.warn(`[Leverage Clamp] ${symbol} ${d.leverage}x > ${maxLeverage}x, auto-adjusting`);
    clamped = { ...d, leverage: maxLeverage };
  }

  // ── 2. SL & TP 存在性 ──
  const effectiveD = clamped ?? d;
  if (effectiveD.stopLoss === null || effectiveD.stopLoss === undefined || effectiveD.stopLoss <= 0) {
    return { valid: false, reason: 'stop_loss must be > 0' };
  }
  if (effectiveD.takeProfit === null || effectiveD.takeProfit === undefined || effectiveD.takeProfit <= 0) {
    return { valid: false, reason: 'take_profit must be > 0' };
  }

  // ── 3. SL/TP 方向 ──
  if (d.action === 'open_long') {
    if (effectiveD.stopLoss! >= effectiveD.takeProfit!) {
      return {
        valid: false,
        reason: `long: stop_loss (${effectiveD.stopLoss}) must be < take_profit (${effectiveD.takeProfit})`,
      };
    }
  } else {
    // open_short
    if (effectiveD.stopLoss! <= effectiveD.takeProfit!) {
      return {
        valid: false,
        reason: `short: stop_loss (${effectiveD.stopLoss}) must be > take_profit (${effectiveD.takeProfit})`,
      };
    }
  }

  // ── 4. R/R ≥ 3.0 ──
  if (currentPrice && currentPrice > 0) {
    const sl = effectiveD.stopLoss!;
    const tp = effectiveD.takeProfit!;

    let riskPercent: number;
    let rewardPercent: number;

    if (d.action === 'open_long') {
      riskPercent = (currentPrice - sl) / currentPrice * 100;
      rewardPercent = (tp - currentPrice) / currentPrice * 100;
    } else {
      riskPercent = (sl - currentPrice) / currentPrice * 100;
      rewardPercent = (currentPrice - tp) / currentPrice * 100;
    }

    if (riskPercent > 0) {
      const rr = rewardPercent / riskPercent;
      const minRR = AI_SAFETY_DEFAULTS.minRiskRewardRatio;
      if (rr < minRR) {
        return {
          valid: false,
          reason: `R/R ratio too low (${rr.toFixed(2)}:1), must be >= ${minRR}:1 [risk: ${riskPercent.toFixed(2)}% reward: ${rewardPercent.toFixed(2)}%] [SL: ${sl} TP: ${tp}]`,
        };
      }
    }
  }

  return { valid: true, clamped };
}

// ========================= 辅助函数 =========================

/**
 * 提取 AI 推理链（对齐 nofx extractCoTTrace，4层降级）
 * 1. <reasoning>标签内容
 * 2. <decision>标签前的所有文本
 * 3. JSON数组 [ 前的所有文本
 * 4. 全文（兜底）
 */
export function extractReasoning(raw: string): string | null {
  if (!raw || !raw.trim()) return null;

  // 1. <reasoning> 标签
  const match = RE_REASONING_TAG.exec(raw);
  if (match?.[1]?.trim()) return match[1].trim();

  // 2. <decision> 标签前的文本
  const decisionIdx = raw.indexOf('<decision>');
  if (decisionIdx > 0) {
    const before = raw.slice(0, decisionIdx).trim();
    if (before.length > 10) return before;
  }

  // 3. JSON 数组 [ 前的文本
  const jsonStart = raw.indexOf('[');
  if (jsonStart > 0) {
    const before = raw.slice(0, jsonStart).trim();
    if (before.length > 10) return before;
  }

  // 4. 全文兜底（仅当有足够内容时）
  const trimmed = raw.trim();
  if (trimmed.length > 20) return trimmed;

  return null;
}

/**
 * 构建安全等待决策
 */
function buildWaitDecision(
  reasoning: string,
  symbol?: string,
  action?: AiAction,
): AiTradeDecision {
  // confidence=0 时强制非交易动作，避免 "开多 + 置信度0%" 的困惑组合
  const safeAction =
    action && (action === 'wait' || action === 'hold') ? action : 'wait';
  return {
    action: safeAction,
    confidence: 0,
    leverage: 1,
    positionSizePercent: 0,
    stopLoss: null,
    takeProfit: null,
    reasoning,
  };
}

/**
 * 回退解析 — 统计 action 关键词出现频率
 */
function fallbackParseAction(response: string): AiAction {
  const lower = response.toLowerCase();

  const counts: Record<AiAction, number> = {
    open_long: 0,
    open_short: 0,
    close_long: 0,
    close_short: 0,
    hold: 0,
    wait: 0,
  };

  // 统计 3 种常见 action 模式
  const patterns = [
    '"action": "ACTION"',
    '"action":"ACTION"',
    'action: ACTION',
  ];

  for (const action of Object.keys(counts) as AiAction[]) {
    for (const pattern of patterns) {
      const search = pattern.replace('ACTION', action);
      let idx = -1;
      while ((idx = lower.indexOf(search, idx + 1)) !== -1) {
        counts[action]++;
      }
    }
  }

  logger.log(
    `[Fallback] action counts: long=${counts.open_long} short=${counts.open_short} ` +
    `hold=${counts.hold} wait=${counts.wait}`,
  );

  // 取最高频
  let maxCount = 0;
  let bestAction: AiAction = 'wait';
  for (const [action, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      bestAction = action as AiAction;
    }
  }

  return bestAction;
}

/**
 * 数值 clamp
 */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}
