/**
 * AI 交易提示词构建器 — 8-section 结构化提示词系统
 *
 * 替代 QUICK_MODE_SYSTEM_PROMPT 扁平 Prompt，实现 8-section 结构化系统:
 *
 * Section 0: Data Dictionary (schema-dictionary)
 * Section 1: Role Definition (可通过 strategy.promptSections.role 自定义)
 * Section 2: Trading Mode (aggressive / conservative / scalping)
 * Section 3: Hard Constraints — CODE ENFORCED
 * Section 4: AI Guidance — 推荐但不强制
 * Section 5: Position Sizing Guidance（3 级信心→仓位映射）
 * Section 6: Trading Frequency Awareness
 * Section 7: Entry Standards + Output Format
 * + Custom Prompt (strategy.promptSections.custom)
 *
 * User Prompt 9 个动态段落
 */

import { Injectable } from '@nestjs/common';
import { getSchemaPrompt, SCHEMA_VERSION, SchemaLang } from '../../constants/schema-dictionary';
import { AI_SAFETY_DEFAULTS } from '../../constants/safety-defaults';
import { buildLanguageInstruction, buildUserMessageLanguageReminder } from '../../constants/locale-instructions';
import { TRADING_PHILOSOPHY, calculateRegime, MarketRegime } from '../../constants/trading-philosophy';

// ========================= 配置接口 =========================

export interface PromptConfig {
  /** 用户可自定义的 prompt 段落（来自 strategy.promptSections） */
  promptSections?: {
    role?: string; // 自定义角色定义
    mode?: string; // [已弃用] 交易风格由 riskControl 参数控制，此字段保留兼容但不注入 prompt
    custom?: string; // 用户自定义提示词（映射为决策流程段）
    tradingFrequency?: string; // 交易频率指导
    entryStandards?: string; // 入场标准
  };
  /** 风控参数（来自 strategy.riskControlConfig） */
  riskControl?: {
    maxPositions?: number;
    maxLeverage?: number;
    btcEthMaxLeverage?: number;      // BTC/ETH 杠杆上限（AI GUIDED）
    altcoinMaxLeverage?: number;     // 山寨币杠杆上限（AI GUIDED）
    minRiskRewardRatio?: number;     // 最低风险收益比（AI GUIDED）
    minConfidence?: number;          // 最低信心度（AI GUIDED）
    minPositionSize?: number;        // 最小仓位（CODE ENFORCED）
    maxDailyDrawdown?: number;
    allocatedCapital?: number;
    maxDailyTrades?: number;   // 每日最大交易次数（L5 强制）
    cooldownMinutes?: number;  // 冷却期分钟数（L6 强制）
    circuitBreaker?: number;   // 连续亏损熔断阈值（L5 强制）
  };
  /** 策略运行间隔（分钟） */
  intervalMinutes?: number;
  /** 今日已交易次数 */
  todayTrades?: number;
  /** 策略运行时长（小时） */
  runningHours?: number;
  /** 连续 wait/hold 周期数（≥3 时注入降低门槛提示） */
  consecutiveWaits?: number;
  /** AI 输出语言 locale (e.g. "zh-CN", "en", "ko") */
  locale?: string;
}

export interface UserPromptContext {
  /** 当前时间 */
  now?: Date;
  /** BTC 参考数据 */
  btcPrice?: number;
  btcChange1h?: number;
  btcChange4h?: number;
  btcRsi?: number;
  /** 账户信息 */
  equity?: number;
  balance?: number;
  marginUsage?: number;
  positionCount?: number;
  /** 最近平仓记录：9 字段 */
  recentTrades?: Array<{
    symbol: string;
    side: string;
    entryPrice?: number;
    exitPrice?: number;
    pnl: number;
    pnlPercent: number;
    holdDuration?: string;
    closedAt: string;
  }>;
  /** 交易统计：8 字段 */
  tradingStats?: {
    totalTrades: number;
    winRate: number;
    profitFactor?: number;
    sharpeRatio?: number;
    totalPnl: number;
    avgWin?: number;
    avgLoss?: number;
    maxDrawdownPct?: number;
  };
  /** 现有持仓 */
  positions?: Array<{
    symbol: string;
    side: string;
    entryPrice: number;
    size: number;
    leverage: number;
    pnlPercent: number;
    peakPnlPercent?: number;
    holdMinutes?: number;
    margin?: number;
    liqPrice?: number;
  }>;
  /** 候选币数据（市场数据由 formatMarketDataPrompt 已有的逻辑注入） */
  marketDataPrompt?: string;
  /** 市场排名 */
  marketRankingPrompt?: string;
  /** 流动性数据（订单簿深度 + 滑点预估） */
  liquidityData?: Array<{
    symbol: string;
    depthUSD: number;
    estimatedSlippage: number; // 参考金额预估滑点百分比
    referenceSizeUSD: number;  // 参考金额
    canFill: boolean;
    spread: number; // 买卖价差百分比
  }>;
  /** 增强市场数据（Phase 11: 多空比/清算/期权/稳定币/ETF/宏观/COT） */
  enhancedDataPrompt?: string;
  /** 辩论上下文 */
  debateContext?: string;
  /** AI 输出语言 locale */
  locale?: string;
  /** 交易所总权益（区别于策略权益） */
  exchangeEquity?: number;
  /** 其他策略持仓数 */
  otherStrategiesCount?: number;
  /** 其他策略总保证金 */
  otherStrategiesMargin?: number;
}

// ========================= Service =========================

@Injectable()
export class PromptBuilderService {

  // ── System Prompt ──

  /**
   * 构建 8-section 结构化 System Prompt
   */
  buildSystemPrompt(config: PromptConfig = {}): string {
    const sections: string[] = [];
    const ps = config.promptSections || {};
    const rc = config.riskControl || {};
    const locale = config.locale || 'zh-CN';

    // Section 0: Data Dictionary (use locale for bilingual schema)
    const schemaLang: SchemaLang = locale.startsWith('zh') ? 'zh-CN' : 'en-US';
    sections.push(getSchemaPrompt({ lang: schemaLang, includeRules: true, includeOI: true, includeMistakes: true }));

    // Section 1: Role Definition
    sections.push(this.buildRoleSection(ps.role));

    // Section 2: Hard Constraints (CODE ENFORCED) — 含仓位计算指南（对齐 nofx）
    const isCN = locale.startsWith('zh');
    sections.push(this.buildHardConstraints(rc, isCN));

    // Section 3: AI Guidance (recommended)
    sections.push(this.buildAIGuidance(isCN));

    // Section 4: Trading Frequency Awareness
    sections.push(this.buildFrequencyAwareness(config.intervalMinutes, config.todayTrades, config.consecutiveWaits));

    // Section 5: Output Format
    sections.push(this.buildOutputFormat());

    // Section 6: Language Instruction
    sections.push(buildLanguageInstruction(locale));

    // Section 7: Trading Philosophy (17 core rules, incl. OI四象限/Donchian/PVR)
    sections.push(TRADING_PHILOSOPHY);

    // Custom Sections: Trading Frequency / Entry Standards / Decision Process
    if (ps.tradingFrequency) {
      sections.push(`\n## Trading Frequency Guidance (User)\n${ps.tradingFrequency}`);
    }
    if (ps.entryStandards) {
      sections.push(`\n## Entry Standards (User)\n${ps.entryStandards}`);
    }
    if (ps.custom) {
      sections.push(`\n## Decision Process / Custom Instructions\n${ps.custom}`);
    }

    return sections.join('\n\n');
  }

  // ── User Prompt ──

  /**
   * 构建动态 User Prompt（9 段注入）
   */
  buildUserPrompt(ctx: UserPromptContext): string {
    const lines: string[] = [];

    // [1] System Status
    const now = ctx.now || new Date();
    lines.push(`=== System Status ===`);
    lines.push(`Time: ${now.toISOString()}`);
    if (ctx.btcPrice) {
      lines.push('');
      lines.push('=== BTC Reference ===');
      lines.push(`BTC Price: $${ctx.btcPrice.toFixed(2)}`);
      if (ctx.btcChange1h !== undefined) lines.push(`BTC 1h Change: ${ctx.btcChange1h > 0 ? '+' : ''}${ctx.btcChange1h.toFixed(2)}%`);
      if (ctx.btcChange4h !== undefined) lines.push(`BTC 4h Change: ${ctx.btcChange4h > 0 ? '+' : ''}${ctx.btcChange4h.toFixed(2)}%`);
      if (ctx.btcRsi !== undefined) lines.push(`BTC RSI(14): ${ctx.btcRsi.toFixed(1)}`);
    }

    // [2] Account Info
    if (ctx.equity !== undefined) {
      lines.push('');
      lines.push('=== Account Info ===');
      if (ctx.balance !== undefined) lines.push(`Strategy Budget: $${ctx.balance.toFixed(2)}`);
      if (ctx.exchangeEquity !== undefined) lines.push(`Exchange Total Equity: $${ctx.exchangeEquity.toFixed(2)}`);
      lines.push(`Strategy Equity: $${ctx.equity.toFixed(2)}`);
      if (ctx.balance !== undefined) {
        const pnlPct = ctx.equity > 0 && ctx.balance > 0
          ? ((ctx.equity - ctx.balance) / ctx.balance * 100)
          : 0;
        lines.push(`Unrealized PnL: ${pnlPct > 0 ? '+' : ''}${pnlPct.toFixed(2)}%`);
      }
      if (ctx.marginUsage !== undefined) lines.push(`Strategy Margin Usage: ${ctx.marginUsage.toFixed(1)}%`);
      if (ctx.positionCount !== undefined) lines.push(`Open Positions (this strategy): ${ctx.positionCount}`);
    }

    // [3] Recent Trades
    if (ctx.recentTrades && ctx.recentTrades.length > 0) {
      lines.push('');
      lines.push('=== Recent Closed Trades (last 5) ===');
      for (const t of ctx.recentTrades.slice(0, 5)) {
        const emoji = t.pnl >= 0 ? 'WIN' : 'LOSS';
        const hold = t.holdDuration ? ` | Hold: ${t.holdDuration}` : '';
        const prices = t.entryPrice && t.exitPrice
          ? ` | Entry: $${t.entryPrice} → Exit: $${t.exitPrice}`
          : '';
        lines.push(`  ${emoji} ${t.symbol} ${t.side}${prices} | PnL: $${t.pnl.toFixed(2)} (${t.pnlPercent > 0 ? '+' : ''}${t.pnlPercent.toFixed(1)}%)${hold} | ${t.closedAt}`);
      }
    }

    // [4] Trading Stats
    if (ctx.tradingStats && ctx.tradingStats.totalTrades > 0) {
      const s = ctx.tradingStats;
      lines.push('');
      lines.push('=== Trading Statistics ===');
      lines.push(`Total Trades: ${s.totalTrades} | Win Rate: ${(s.winRate * 100).toFixed(1)}% | Total PnL: $${s.totalPnl.toFixed(2)}`);
      if (s.profitFactor !== undefined) lines.push(`Profit Factor: ${s.profitFactor} | Avg Win: $${s.avgWin?.toFixed(2) ?? 'N/A'} | Avg Loss: $${s.avgLoss?.toFixed(2) ?? 'N/A'}`);
      if (s.sharpeRatio !== undefined) lines.push(`Sharpe Ratio: ${s.sharpeRatio}`);
      if (s.maxDrawdownPct !== undefined) lines.push(`历史最大回撤(峰值统计,非当前): ${s.maxDrawdownPct.toFixed(1)}%`);
    }

    // [5] Current Positions
    if (ctx.positions && ctx.positions.length > 0) {
      lines.push('');
      lines.push('=== Current Positions ===');
      for (const p of ctx.positions) {
        const peak = p.peakPnlPercent !== undefined ? ` | PeakPnL: ${p.peakPnlPercent > 0 ? '+' : ''}${p.peakPnlPercent.toFixed(2)}%` : '';
        const hold = p.holdMinutes ? ` | Hold: ${p.holdMinutes}min` : '';
        const liq = p.liqPrice ? ` | LiqPrice: $${p.liqPrice.toFixed(2)}` : '';
        lines.push(`  ${p.symbol} ${p.side.toUpperCase()} @ $${p.entryPrice.toFixed(4)} | ${p.leverage}x | PnL: ${p.pnlPercent > 0 ? '+' : ''}${p.pnlPercent.toFixed(2)}%${peak}${hold}${liq}`);
      }
    } else {
      lines.push('');
      lines.push('=== Current Positions ===');
      lines.push('  No open positions');
    }

    // [5.5] Other Strategies Exposure（同账户其他策略的持仓概览）
    if (ctx.otherStrategiesCount && ctx.otherStrategiesCount > 0) {
      lines.push('');
      lines.push('=== Other Strategies Exposure (same exchange account) ===');
      lines.push(`  ${ctx.otherStrategiesCount} other positions using $${ctx.otherStrategiesMargin?.toFixed(2) ?? '0'} margin.`);
      lines.push('  NOTE: Factor total account exposure when sizing your positions.');
    }

    // [6] Market Data (已格式化)
    if (ctx.marketDataPrompt) {
      lines.push('');
      lines.push(ctx.marketDataPrompt);
    }

    // [7] Market Rankings
    if (ctx.marketRankingPrompt) {
      lines.push('');
      lines.push(ctx.marketRankingPrompt);
    }

    // [7.5] Enhanced Market Data (Phase 11: 多空比/清算/期权/稳定币/ETF/宏观/COT)
    if (ctx.enhancedDataPrompt) {
      lines.push('');
      lines.push(ctx.enhancedDataPrompt);
    }

    // [8] Liquidity & Order Book
    if (ctx.liquidityData && ctx.liquidityData.length > 0) {
      lines.push('');
      lines.push('=== Liquidity & Order Book ===');
      for (const liq of ctx.liquidityData) {
        const fillWarning = !liq.canFill ? ' ⚠ INSUFFICIENT DEPTH' : '';
        lines.push(
          `  ${liq.symbol}: Depth: $${liq.depthUSD.toLocaleString()} | Spread: ${liq.spread.toFixed(3)}% | ` +
          `Est.Slippage(@$${liq.referenceSizeUSD.toLocaleString()}): ${liq.estimatedSlippage.toFixed(4)}%${fillWarning}`,
        );
      }
      lines.push('NOTE: Factor liquidity into your position sizing. High slippage = reduce size or skip.');
    }

    // [9] Debate Context
    if (ctx.debateContext) {
      lines.push('');
      lines.push(ctx.debateContext);
    }

    // [9] Instruction — 多币种模式强调每币独立分析
    lines.push('');
    const coinMatches = ctx.marketDataPrompt?.match(/===\s+(\S+\/\S+)\s/g) || [];
    if (coinMatches.length > 1) {
      const coinList = coinMatches.map(m => m.replace(/===\s+/, '').trim()).join(', ');
      lines.push(`⚠️ MULTI-COIN MODE (${coinMatches.length} coins: ${coinList}):`);
      lines.push(`1. You MUST return exactly ${coinMatches.length} decision objects in the JSON array, one per coin.`);
      lines.push('2. Each coin MUST have INDEPENDENT, DETAILED reasoning (≥3 sentences). Do NOT say "similar to BTC" or "same as above".');
      lines.push('3. Analyze each coin\'s own indicators (RSI, MACD, EMA, volume, funding rate) separately.');
      lines.push('4. Missing any coin or giving lazy cross-references = INVALID output.');
      lines.push(`5. Return the array in the EXACT same order as listed above: ${coinList}. Index 0 = first coin, do NOT reorder.`);
    }
    lines.push('Analyze the above data and output your trading decision.');

    // [10] 语言提醒（防止英文上下文淹没 system prompt 的语言指令）
    const langReminder = buildUserMessageLanguageReminder(ctx.locale);
    if (langReminder) lines.push(langReminder);

    return lines.join('\n');
  }

  // ── Section Builders ──

  private buildRoleSection(customRole?: string): string {
    if (customRole) {
      return `## Role\n${customRole}`;
    }
    return `## Role
You are an experienced cryptocurrency futures trader AI.
Your job is to analyze market data, account status, and existing positions, then output precise trading decisions.
You think like a professional trader: risk-first, data-driven, no emotions.`;
  }

  private buildHardConstraints(rc: PromptConfig['riskControl'] = {}, isCN = false): string {
    const btcLev = rc.btcEthMaxLeverage ?? rc.maxLeverage ?? 5;
    const altLev = rc.altcoinMaxLeverage ?? rc.maxLeverage ?? 5;
    const maxPos = rc.maxPositions ?? 3;
    const equity = rc.allocatedCapital ?? 1000;
    const btcEthPVR = 5.0;   // BTC/ETH position value ratio
    const altPVR = 1.0;      // Altcoin position value ratio
    const minRR = rc.minRiskRewardRatio ?? AI_SAFETY_DEFAULTS.minRiskRewardRatio;
    const minConf = rc.minConfidence ?? 60;
    const minPosSize = rc.minPositionSize ?? AI_SAFETY_DEFAULTS.minPositionSizeAlt;
    const maxDD = rc.maxDailyDrawdown || 100;
    const maxDailyTrades = rc.maxDailyTrades;
    const cooldown = rc.cooldownMinutes;
    const cbThreshold = rc.circuitBreaker;

    if (isCN) {
      const dyn = [
        maxDailyTrades ? `- **每日最大交易次数**: ${maxDailyTrades}，达到上限时输出 action=wait` : '',
        cooldown ? `- **冷却期**: 每笔交易间隔 ${cooldown} 分钟，冷却中输出 action=wait` : '',
        cbThreshold ? `- **熔断器**: 连续亏损 ${cbThreshold} 次触发暂停，输出 action=wait` : '',
      ].filter(Boolean).join('\n');

      return `## 硬性约束（代码强制执行，违规自动拒绝）

- **最大杠杆**: BTC/ETH <= ${btcLev}x，山寨币 <= ${altLev}x
- **最小仓位**: ${minPosSize} USDT（BTC/ETH >= $${AI_SAFETY_DEFAULTS.minPositionSizeMajor}）
- **仓位价值上限**: BTC/ETH 最大 $${(equity * btcEthPVR).toFixed(0)}（权益$${equity.toFixed(0)} × ${btcEthPVR}x），山寨币最大 $${(equity * altPVR).toFixed(0)}（权益 × ${altPVR}x）
- **风险回报比**: 必须 >= ${minRR}:1
- **ATR极端波动**: ATR(3)/ATR(14) > ${AI_SAFETY_DEFAULTS.atrExtremeRatio} 时暂停所有交易
- **最大持仓数**: ${maxPos}
- **每日最大回撤**: $${maxDD}
- **同币种冲突**: 不能同时持有同一币种的多空仓位
${dyn ? dyn + '\n' : ''}- **止损止盈必填**: 每笔开仓必须设置止损价和止盈价

## 仓位计算指南（对齐 nofx）
根据置信度和仓位价值上限计算 positionSizePercent：
- **高置信度 (≥85)**: 使用仓位上限的 80-100%
- **中置信度 (70-84)**: 使用仓位上限的 50-80%
- **低置信度 (60-69)**: 使用仓位上限的 30-50%
- 示例: 策略预算$${equity.toFixed(0)}，山寨币仓位上限=$${(equity * altPVR).toFixed(0)}，置信度70% → 仓位=$${(equity * altPVR * 0.5).toFixed(0)}-${(equity * altPVR * 0.8).toFixed(0)} → positionSizePercent=${(altPVR * 0.5 * 100).toFixed(0)}-${(altPVR * 0.8 * 100).toFixed(0)}
- **禁止**直接用 available_balance 作为仓位，必须基于仓位价值上限计算
- 杠杆由你根据市场状态自主选择（不超过上限），杠杆越高止损越紧

## AI 建议（推荐遵循，非硬性强制）
- **最低置信度**: 置信度 >= ${minConf}% 才开仓
- **杠杆选择**: 用户配置的杠杆是上限，你应根据波动率和趋势强度自主选择合适倍数

## 软性警告（系统会提醒但不会拦截）
- **RSI极端**: RSI > ${AI_SAFETY_DEFAULTS.rsiOverbought} 或 < ${AI_SAFETY_DEFAULTS.rsiOversold}，是否操作由你决定
- **ATR偏高**: ATR(3)/ATR(14) > ${AI_SAFETY_DEFAULTS.atrAnomalyRatio}，波动率较大，谨慎考虑
- **持仓回撤**: 已有仓位亏损 > ${Math.abs(AI_SAFETY_DEFAULTS.drawdownBlockThreshold)}%，评估总风险敞口
- **资金费率偏高**: |资金费率| > 0.05%/8h，持仓成本较高

设计止损/止盈使风险回报比 >= ${minRR}:1。`;
    }

    // English (default for non-Chinese locales)
    const dyn = [
      maxDailyTrades ? `- **Max Daily Trades**: ${maxDailyTrades} — if reached, output action=wait` : '',
      cooldown ? `- **Cooldown Period**: ${cooldown} min between trades — if in cooldown, output action=wait` : '',
      cbThreshold ? `- **Circuit Breaker**: ${cbThreshold} consecutive losses triggers pause — output action=wait` : '',
    ].filter(Boolean).join('\n');

    return `## Hard Constraints (CODE ENFORCED — violations auto-rejected)

- **Max Leverage**: BTC/ETH <= ${btcLev}x, Altcoins <= ${altLev}x
- **Min Position Size**: ${minPosSize} USDT (BTC/ETH >= $${AI_SAFETY_DEFAULTS.minPositionSizeMajor})
- **Position Value Limit**: BTC/ETH max $${(equity * btcEthPVR).toFixed(0)} (equity $${equity.toFixed(0)} × ${btcEthPVR}x), Altcoins max $${(equity * altPVR).toFixed(0)} (equity × ${altPVR}x)
- **Risk/Reward Ratio**: Must be >= ${minRR}:1
- **ATR Extreme**: ATR(3)/ATR(14) > ${AI_SAFETY_DEFAULTS.atrExtremeRatio} = ALL trading paused
- **Max Open Positions**: ${maxPos}
- **Max Daily Drawdown**: $${maxDD}
- **Same-Symbol Conflict**: Cannot open opposite direction on same symbol
${dyn ? dyn + '\n' : ''}- **Stop Loss Required**: Every open MUST have stop_loss and take_profit

## Position Sizing Guide (aligned with nofx)
Calculate positionSizePercent based on your confidence and Position Value Limits:
- **High confidence (≥85)**: Use 80-100% of position value limit
- **Medium confidence (70-84)**: Use 50-80% of position value limit
- **Low confidence (60-69)**: Use 30-50% of position value limit
- Example: budget=$${equity.toFixed(0)}, altcoin limit=$${(equity * altPVR).toFixed(0)}, confidence=70% → position=$${(equity * altPVR * 0.5).toFixed(0)}-${(equity * altPVR * 0.8).toFixed(0)} → positionSizePercent=${(altPVR * 0.5 * 100).toFixed(0)}-${(altPVR * 0.8 * 100).toFixed(0)}
- **DO NOT** just use available_balance as position size. Use the Position Value Limits!
- Leverage is YOUR choice (up to the max), higher leverage = tighter stop-loss

## AI Guidance (recommended, not hard-enforced)
- **Min Confidence**: Only trade when confidence >= ${minConf}%
- **Leverage**: User-configured leverage is the max cap; choose based on volatility and trend strength

## Soft Warnings (system warns but does NOT block)
- **RSI Extreme**: RSI > ${AI_SAFETY_DEFAULTS.rsiOverbought} or < ${AI_SAFETY_DEFAULTS.rsiOversold}
- **ATR Elevated**: ATR(3)/ATR(14) > ${AI_SAFETY_DEFAULTS.atrAnomalyRatio} — high volatility
- **Position Drawdown**: Loss > ${Math.abs(AI_SAFETY_DEFAULTS.drawdownBlockThreshold)}% — evaluate risk
- **Funding Rate High**: |FR| > 0.05%/8h — significant holding cost

Design SL/TP to achieve R/R >= ${minRR}:1.`;
  }

  private buildAIGuidance(isCN = false): string {
    if (isCN) {
      return `## AI 交易指南（推荐但不强制）

- 保证金使用率 <= 30%（预留 70% 应对极端行情）
- 止损距离: max(1.5 × ATR14 / 价格, 基础风险 / 杠杆) — 杠杆自适应
- 最高盈利回撤 30% 时考虑止盈（仅当最高盈利 >= 2% 时）
- ATR 阶梯止盈: +1.5×ATR 平 33%，+2.5×ATR 平 50%，+4×ATR 平 100%
- 只对盈利仓位加仓，禁止对亏损仓位补仓
- 成交量突增 2 倍均值 → 潜在入场信号
- 持仓量 1 小时变化 >2% → 大额资金流动
- 资金费率: 正=多头付费给空头(偏空), 负=空头付费给多头(偏多)

## 禁止行为
- 禁止对亏损仓位补仓（禁止摊薄成本）
- 禁止同一币种同时持有多空仓位
- 禁止亏损后立即报复性交易（等待明确信号）
- 禁止忽略最高盈利来决定是否平仓
- 禁止混淆已实现盈亏和未实现盈亏
- 禁止不写理由就输出操作`;
    }

    return `## AI Trading Guidance (recommended but not enforced)

- Margin usage <= 30% (reserve 70% for extreme conditions)
- Stop loss distance: max(1.5 × ATR14 / price, baseRisk / leverage) — adapts to leverage
- PeakPnL drawback 30% → consider take profit (only when PeakPnL >= 2%)
- Scale-out (ATR-based): +1.5×ATR close 33%, +2.5×ATR close 50%, +4×ATR close 100%
- Only add to winning positions, never average down losers
- Volume spike 2x average → potential entry signal
- OI change >2% in 1h → significant fund flow
- Funding Rate: positive = longs pay shorts (bearish), negative = shorts pay longs (bullish)

## NEVER-DO List
- NEVER add to a losing position (no averaging down)
- NEVER hold simultaneous long AND short on the same asset
- NEVER revenge-trade immediately after a loss (wait for clear setup)
- NEVER ignore PeakPnL when deciding whether to close a position
- NEVER mix realized and unrealized PnL in your calculations
- NEVER output action without reasoning — every decision must be justified`;
  }

  private buildFrequencyAwareness(intervalMinutes?: number, todayTrades?: number, consecutiveWaits?: number): string {
    const interval = intervalMinutes || 60;
    const trades = todayTrades ?? 0;

    let section = `## Trading Frequency Awareness
- Strategy cycle interval: ${interval} minutes
- Trades executed today: ${trades}
- Overtrading increases fees and slippage — be selective
- If you already traded recently, prefer "hold" or "wait" unless a strong signal appears
- Quality over quantity: fewer trades with higher conviction`;

    if (consecutiveWaits && consecutiveWaits >= 3) {
      section += `\n\n⚠️ You have output "wait" for ${consecutiveWaits} consecutive cycles.
If ANY reasonable setup exists (confidence >= 55), consider entering with a smaller position (3-8%).
Doing nothing indefinitely is also a risk — you miss opportunities and waste analysis budget.`;
    }

    return section;
  }

  private buildOutputFormat(): string {
    return `## Output Format (MANDATORY — follow EXACTLY as shown)

Your response MUST contain BOTH tags below, in this order, with NO extra text before or after:

<reasoning>
3-5 sentences covering: overall trend, key indicator readings, risk assessment, why you chose this action.
</reasoning>
<decision>
[{"symbol":"COIN/USDT:USDT","action":"open_long","confidence":72,"leverage":3,"positionSizePercent":60,"stop_loss":95000,"take_profit":102000,"reasoning":"RSI(14) at 42 recovering from oversold, MACD histogram turning positive. Price bouncing from $96,000 key support with 1.5x volume. Funding rate neutral 0.01%."}]
</decision>

IMPORTANT: positionSizePercent should follow the Position Sizing Guide (50-80% for confidence 70-84). Do NOT default to small values like 10-15.

FORMAT RULES — violations cause parse failure:
1. BOTH <reasoning> and <decision> tags REQUIRED — even for hold/wait
2. <decision> MUST contain a raw JSON ARRAY — starts with [{ ends with }]
3. DO NOT use markdown code blocks (\`\`\`json\`\`\`) inside or outside the tags
4. DO NOT output any text AFTER </decision> — it corrupts the parser
5. stop_loss / take_profit = ABSOLUTE PRICE values (not percentages)
6. For long: stop_loss < current_price < take_profit
7. For short: take_profit < current_price < stop_loss
8. R/R ratio MUST be >= minimum in Hard Constraints
9. "reasoning" field: cite ≥2 specific indicators (e.g. "RSI(14) at 42", "MACD histogram negative", "$95,000 support")
10. MULTI-COIN: return ONE object per coin; each coin's reasoning MUST be independent (≥3 sentences, no "same as BTC")
11. confidence < 50 → use action="wait", leverage=1, positionSizePercent=0 (keep your actual confidence value, do NOT force it to 0)`;
  }
}
