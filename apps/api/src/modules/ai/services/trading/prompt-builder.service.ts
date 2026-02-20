/**
 * Prompt 构建器 — 移植自 NoFx kernel/engine.go BuildSystemPrompt + BuildUserPrompt
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
 * User Prompt 9 个动态段落（对齐 NoFx BuildUserPrompt）
 */

import { Injectable } from '@nestjs/common';
import { getSchemaPrompt, SCHEMA_VERSION } from '../../constants/schema-dictionary';
import { AI_SAFETY_DEFAULTS } from '../../constants/safety-defaults';

// ========================= 配置接口 =========================

export interface PromptConfig {
  /** 用户可自定义的 prompt 段落（来自 strategy.promptSections） */
  promptSections?: {
    role?: string; // 自定义角色定义
    mode?: 'aggressive' | 'conservative' | 'scalping'; // 交易模式
    custom?: string; // 用户自定义提示词（映射为决策流程段）
    tradingFrequency?: string; // 交易频率指导
    entryStandards?: string; // 入场标准
  };
  /** 风控参数（来自 strategy.riskControlConfig） */
  riskControl?: {
    maxPositions?: number;
    maxLeverage?: number;
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
  /** 最近平仓记录 — 对齐 NoFx RecentOrder 9字段 */
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
  /** 交易统计 — 对齐 NoFx TradingStats 8字段 */
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
  /** 辩论上下文 */
  debateContext?: string;
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

    // Section 0: Data Dictionary
    sections.push(getSchemaPrompt({ lang: 'en-US', includeRules: true, includeOI: true, includeMistakes: true }));

    // Section 1: Role Definition
    sections.push(this.buildRoleSection(ps.role));

    // Section 2: Trading Mode
    sections.push(this.buildModeSection(ps.mode));

    // Section 3: Hard Constraints (CODE ENFORCED)
    sections.push(this.buildHardConstraints(rc));

    // Section 4: AI Guidance (recommended)
    sections.push(this.buildAIGuidance());

    // Section 5: Position Sizing Guidance
    sections.push(this.buildPositionSizing());

    // Section 6: Trading Frequency Awareness
    sections.push(this.buildFrequencyAwareness(config.intervalMinutes, config.todayTrades));

    // Section 7: Output Format
    sections.push(this.buildOutputFormat());

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
      lines.push(`Equity: $${ctx.equity.toFixed(2)}`);
      if (ctx.balance !== undefined) {
        const pnlPct = ctx.equity > 0 && ctx.balance > 0
          ? ((ctx.equity - ctx.balance) / ctx.balance * 100)
          : 0;
        lines.push(`Balance: $${ctx.balance.toFixed(2)} (PnL: ${pnlPct > 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`);
      }
      if (ctx.marginUsage !== undefined) lines.push(`Margin Usage: ${ctx.marginUsage.toFixed(1)}%`);
      if (ctx.positionCount !== undefined) lines.push(`Open Positions: ${ctx.positionCount}`);
    }

    // [3] Recent Trades — 对齐 NoFx RecentOrder 格式
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

    // [4] Trading Stats — 对齐 NoFx TradingStats 8字段
    if (ctx.tradingStats && ctx.tradingStats.totalTrades > 0) {
      const s = ctx.tradingStats;
      lines.push('');
      lines.push('=== Trading Statistics ===');
      lines.push(`Total Trades: ${s.totalTrades} | Win Rate: ${(s.winRate * 100).toFixed(1)}% | Total PnL: $${s.totalPnl.toFixed(2)}`);
      if (s.profitFactor !== undefined) lines.push(`Profit Factor: ${s.profitFactor} | Avg Win: $${s.avgWin?.toFixed(2) ?? 'N/A'} | Avg Loss: $${s.avgLoss?.toFixed(2) ?? 'N/A'}`);
      if (s.sharpeRatio !== undefined) lines.push(`Sharpe Ratio: ${s.sharpeRatio}`);
      if (s.maxDrawdownPct !== undefined) lines.push(`Max Drawdown: ${s.maxDrawdownPct}%`);
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

    // [8] Debate Context
    if (ctx.debateContext) {
      lines.push('');
      lines.push(ctx.debateContext);
    }

    // [9] Instruction
    lines.push('');
    lines.push('Analyze the above data and output your trading decision.');

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

  private buildModeSection(mode?: string): string {
    switch (mode) {
      case 'aggressive':
        return `## Trading Mode: AGGRESSIVE
- Accept setups with confidence >= 55
- Position size can be larger (up to 50% of available balance)
- Actively seek breakout and momentum trades
- Shorter holding periods preferred
- Still respect all hard constraints below`;

      case 'scalping':
        return `## Trading Mode: SCALPING
- Very short holding periods (target < 30 minutes)
- Tight stop losses (1-2% max)
- High win-rate trades preferred (>60% confidence)
- Focus on liquidity and tight spreads
- Avoid trading during low-volume periods
- Still respect all hard constraints below`;

      case 'conservative':
      default:
        return `## Trading Mode: CONSERVATIVE
- Only trade with high confidence (>= 70)
- Smaller position sizes (10-20% of available balance)
- Prefer trend-following over counter-trend
- Longer holding periods acceptable
- Prioritize capital preservation
- Still respect all hard constraints below`;
    }
  }

  private buildHardConstraints(rc: PromptConfig['riskControl'] = {}): string {
    const maxLev = rc.maxLeverage || 20;
    const maxPos = rc.maxPositions || 5;
    const maxDD = rc.maxDailyDrawdown || 100;
    const maxDailyTrades = rc.maxDailyTrades;
    const cooldown = rc.cooldownMinutes;
    const cbThreshold = rc.circuitBreaker;

    const dynamicLines = [
      maxDailyTrades ? `- **Max Daily Trades**: ${maxDailyTrades} — if today's count is reached, output action=wait` : '',
      cooldown ? `- **Cooldown Period**: ${cooldown} minutes between trades — if in cooldown, output action=wait` : '',
      cbThreshold ? `- **Circuit Breaker**: ${cbThreshold} consecutive losses triggers pause — output action=wait` : '',
    ].filter(Boolean).join('\n');

    return `## Hard Constraints (CODE ENFORCED — you cannot bypass these)
The following rules are enforced by code. Violations will be automatically rejected:

- **Max Leverage**: BTC/ETH <= ${Math.min(maxLev, 20)}x, Altcoins <= ${Math.min(maxLev, 10)}x
- **Min Position Size**: BTC/ETH >= $60, Altcoins >= $12
- **Risk/Reward Ratio**: Must be >= 3.0:1 (TP distance / SL distance)
- **RSI Hard Limits**: RSI > ${AI_SAFETY_DEFAULTS.rsiOverbought} = NO new longs, RSI < ${AI_SAFETY_DEFAULTS.rsiOversold} = NO new shorts
- **ATR Extreme**: ATR(3)/ATR(14) > ${AI_SAFETY_DEFAULTS.atrExtremeRatio} = ALL trading paused
- **Max Open Positions**: ${maxPos}
- **Max Daily Drawdown**: $${maxDD}
${dynamicLines ? dynamicLines + '\n' : ''}- **Stop Loss Required**: Every open_long/open_short MUST have stop_loss and take_profit

If your decision violates any of these, it WILL be blocked. Design your SL/TP to satisfy R/R >= 3.0.`;
  }

  private buildAIGuidance(): string {
    return `## AI Guidance (recommended but not enforced)
The following are best-practice recommendations:

- Margin usage <= 30% (reserve 70% for extreme conditions)
- Single position loss -5% → consider stop loss
- PeakPnL drawback 30% → consider take profit
- Scale-out: +3% close 33%, +5% close 50%, +8% close 100%
- Only add to winning positions, never average down losers
- Volume spike 2x average → potential entry signal
- OI change >2% in 1h → significant fund flow`;
  }

  private buildPositionSizing(): string {
    return `## Position Sizing Guidance
Map your confidence level to position size:

- **High confidence (80-100)**: positionSizePercent 30-50
- **Medium confidence (60-80)**: positionSizePercent 15-30
- **Low confidence (50-60)**: positionSizePercent 10-15
- **Below 50**: Recommend "wait" — insufficient conviction

positionSizePercent represents % of available balance (or allocatedCapital if set).
Example: positionSizePercent=20 with $1000 balance → $200 position value.`;
  }

  private buildFrequencyAwareness(intervalMinutes?: number, todayTrades?: number): string {
    const interval = intervalMinutes || 60;
    const trades = todayTrades ?? 0;

    return `## Trading Frequency Awareness
- Strategy cycle interval: ${interval} minutes
- Trades executed today: ${trades}
- Overtrading increases fees and slippage — be selective
- If you already traded recently, prefer "hold" or "wait" unless a strong signal appears
- Quality over quantity: fewer trades with higher conviction`;
  }

  private buildOutputFormat(): string {
    return `## Output Format
You MUST use this exact format:

<reasoning>
Your detailed analysis here (150-400 words):
- Account assessment
- Position management decisions
- Market analysis for each candidate coin
- Risk evaluation
</reasoning>
<decision>
[{
  "symbol": "BTC/USDT:USDT",
  "action": "open_long" | "open_short" | "close_long" | "close_short" | "hold" | "wait",
  "confidence": 0-100,
  "leverage": 1-20,
  "positionSizePercent": 1-50,
  "stop_loss": <price>,
  "take_profit": <price>,
  "reasoning": "One-line summary"
}]
</decision>

Rules:
- Output a JSON ARRAY inside <decision> tags (even for single decision)
- stop_loss and take_profit are ABSOLUTE PRICES (not percentages)
- For "hold" or "wait": set confidence to your conviction level, other fields can be 0/null
- For long: stop_loss < current_price < take_profit
- For short: take_profit < current_price < stop_loss
- Ensure R/R >= 3.0 (take_profit distance >= 3 × stop_loss distance from entry)`;
  }
}
