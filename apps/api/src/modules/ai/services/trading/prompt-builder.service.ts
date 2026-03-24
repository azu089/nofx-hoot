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
// TRADING_PHILOSOPHY 已从极速策略 prompt 移除（对齐 nofx），文件保留供其他策略使用

// ========================= 配置接口 =========================

export interface PromptConfig {
  /** 用户可自定义的 prompt 段落（来自 strategy.promptSections） */
  promptSections?: {
    role?: string; // 自定义角色定义
    mode?: string; // 交易风格：aggressive / conservative / scalping（对齐 nofx variant）
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
    btcEthMaxPositionValueRatio?: number;   // BTC/ETH 仓位价值比例（CODE ENFORCED）
    altcoinMaxPositionValueRatio?: number;  // 山寨币仓位价值比例（CODE ENFORCED）
    maxDailyDrawdown?: number;
    allocatedCapital?: number;
    maxDailyTrades?: number;   // 每日最大交易次数（L5 强制）
    cooldownMinutes?: number;  // 冷却期分钟数（L6 强制）
    circuitBreaker?: number;   // 连续亏损熔断阈值（L5 强制）
    minCloseConfidence?: number; // 平仓最低置信度（低于此值的 close 被拦截为 hold）
  };
  /** 策略运行间隔（分钟） */
  intervalMinutes?: number;
  /** 今日已交易次数 */
  todayTrades?: number;
  /** 策略运行时长（小时） */
  runningHours?: number;
  /** AI 输出语言 locale (e.g. "zh-CN", "en", "ko") */
  locale?: string;
  /** 指标配置（对齐 nofx writeAvailableIndicators 动态生成） */
  indicators?: {
    primaryTimeframe?: string;   // e.g. '1h'
    longerTimeframe?: string;    // e.g. '4h'
    enableEMA?: boolean;
    emaPeriods?: number[];
    enableMACD?: boolean;
    enableRSI?: boolean;
    rsiPeriods?: number[];
    enableATR?: boolean;
    atrPeriods?: number[];
    enableBOLL?: boolean;
    enableOI?: boolean;
  };
}

export interface UserPromptContext {
  /** 当前时间 */
  now?: Date;
  /** 策略周期计数（对齐 nofx: Period #N） */
  cycleCount?: number;
  /** 策略运行时长（分钟，对齐 nofx: Runtime Nmin） */
  runtimeMinutes?: number;
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
    markPrice?: number;      // 对齐 nofx: 当前标记价格
    pnlAmount?: number;      // 对齐 nofx: 绝对盈亏金额 (USDT)
  }>;
  /** 候选币数据（市场数据由 formatMarketDataPrompt 已有的逻辑注入） */
  marketDataPrompt?: string;
  /** 每个持仓币的独立市场数据（对齐 nofx: 紧跟持仓后展示） */
  positionMarketDataMap?: Record<string, string>;
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
  /** Task 1: CryptoPanic 新闻事件（极速策略增强） */
  newsPrompt?: string;
  /** Task 2: Fear & Greed 指数（极速策略增强） */
  fearGreedPrompt?: string;
  /** Task 3: BM25 历史教训（极速策略增强） */
  memoryPrompt?: string;
  /** Task 4: LunarCrush 社媒情绪（极速策略增强） */
  socialSentimentPrompt?: string;
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
  /** 上轮 AI 决策摘要（避免重复分析，提供决策连续性） */
  lastDecisions?: Array<{
    symbol: string;
    action: string;
    confidence: number;
    reasoning: string;
    timestamp: string;
  }>;
  /** 币种来源模式 + 配置的候选币列表 */
  coinSourceMode?: 'static' | 'manual' | 'ai' | 'oi_top' | 'oi_low' | 'mixed';
  candidateSymbols?: string[];
  /** 当前正在分析的币种 */
  currentSymbol?: string;
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
    // 对齐 nofx: 注入字段说明 + OI解读 + 常见错误警示，不注入交易规则（给AI完全自由度）
    sections.push(getSchemaPrompt({ lang: schemaLang, includeRules: false, includeOI: true, includeMistakes: true }));

    // Section 1: Role Definition
    sections.push(this.buildRoleSection(ps.role));

    // Section 1.5: Trading Mode Variant（对齐 nofx engine.go L1051-1059）
    if (ps.mode) {
      const variant = ps.mode.toLowerCase().trim();
      if (variant === 'aggressive') {
        sections.push(`## Mode: Aggressive\n- Prioritize capturing trend breakouts, can build positions in batches when confidence ≥ ${rc.minConfidence ?? 75}\n- Allow higher positions, but must strictly set stop-loss and explain risk-reward ratio`);
      } else if (variant === 'conservative') {
        sections.push(`## Mode: Conservative\n- Only open positions when multiple signals resonate\n- Prioritize cash preservation, must pause for multiple periods after consecutive losses`);
      } else if (variant === 'scalping') {
        sections.push(`## Mode: Scalping\n- Focus on short-term momentum, smaller profit targets but require quick action\n- If price doesn't move as expected within two bars, immediately reduce position or stop-loss`);
      }
    }

    // Section 2: Hard Constraints (CODE ENFORCED) — 含仓位计算指南（对齐 nofx）
    const isCN = locale.startsWith('zh');
    sections.push(this.buildHardConstraints(rc, isCN));

    // Section 3: 删除。对齐 nofx engine.go BuildSystemPrompt 主路径：
    // nofx 主路径没有"决策原则"段（风险优先/保护资本/跟踪止盈/分批操作）
    // 这些规则来自 prompt_builder.go 备用路径，导致 AI 用"保护资本"滥用平仓
    // 跟踪止盈和分批止盈由持仓格式中的 ⚠️ 提示 + drawdown-monitor 代码层负责

    // Section 4: Trading Frequency Awareness
    sections.push(this.buildFrequencyAwareness(config.intervalMinutes, config.todayTrades, rc.minConfidence, config.indicators));

    // Section 5: Output Format (动态示例，对齐 nofx engine.go L1143-1155)
    sections.push(this.buildOutputFormat(rc));

    // Section 6: Language Instruction
    sections.push(buildLanguageInstruction(locale));

    // Section 7: Trading Philosophy — 已移除（对齐 nofx：不注入独立哲学规则文档）
    // 核心原则已在 Section 3 (AI Guidance) 中覆盖：风险优先/跟踪止盈/顺势交易/OI四象限
    // TRADING_PHILOSOPHY 文件保留但不注入极速策略 prompt，避免 ~120 行重复约束稀释核心信息

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

    // [1] System Status（对齐 nofx: Time + Period + Runtime）
    const now = ctx.now || new Date();
    lines.push(`=== System Status ===`);
    const periodStr = ctx.cycleCount ? ` | Period: #${ctx.cycleCount}` : '';
    const runtimeStr = ctx.runtimeMinutes ? ` | Runtime: ${ctx.runtimeMinutes}min` : '';
    lines.push(`Time: ${now.toISOString()}${periodStr}${runtimeStr}`);
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
      if (ctx.marginUsage !== undefined) {
        // 对齐 nofx engine.go L1256: 只展示数字，不加 ⚠️ 提示
        // nofx: "Account: Equity X | Balance X | Margin X% | Positions N"
        // 误导提示会导致 AI 用"margin usage 高"作为平仓理由
        lines.push(`Strategy Margin Usage: ${ctx.marginUsage.toFixed(1)}%`);
      }
      if (ctx.positionCount !== undefined) lines.push(`Open Positions (this strategy): ${ctx.positionCount}`);
    }

    // [2.5] Coin Source Configuration
    if (ctx.coinSourceMode || ctx.candidateSymbols) {
      lines.push('');
      lines.push('=== Strategy Coin Configuration ===');
      const modeLabels: Record<string, string> = {
        static: 'User-selected coins (fixed)',
        manual: 'User-selected coins (fixed)',
        ai: 'AI auto-select from market',
        oi_top: 'Auto-select by OI ranking (top)',
        oi_low: 'Auto-select by OI ranking (low)',
        mixed: 'Mixed (user + auto)',
      };
      const modeLabel = modeLabels[ctx.coinSourceMode || ''] || ctx.coinSourceMode || 'unknown';
      lines.push(`Coin Source: ${modeLabel}`);
      if (ctx.candidateSymbols && ctx.candidateSymbols.length > 0) {
        lines.push(`Candidate Coins: ${ctx.candidateSymbols.join(', ')}`);
        lines.push(`Currently Analyzing: ${ctx.currentSymbol || 'N/A'}`);
      }
      if (ctx.coinSourceMode === 'static' || ctx.coinSourceMode === 'manual') {
        lines.push(`NOTE: User has specifically selected these coins. Your <decision> symbol MUST be one of the candidate coins above. You may reference other coins in <reasoning> for market context, but do NOT output trading actions for coins outside the candidate list.`);
      }
    }

    // [3] Recent Trades
    if (ctx.recentTrades && ctx.recentTrades.length > 0) {
      lines.push('');
      lines.push('=== Recent Closed Trades (last 10) ===');
      for (const t of ctx.recentTrades.slice(0, 10)) {
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
      if (s.profitFactor !== undefined) {
        const wlRatio = (s.avgWin && s.avgLoss && s.avgLoss !== 0) ? (Math.abs(s.avgWin) / Math.abs(s.avgLoss)).toFixed(2) : 'N/A';
        lines.push(`Profit Factor: ${s.profitFactor} | Avg Win: $${s.avgWin?.toFixed(2) ?? 'N/A'} | Avg Loss: $${s.avgLoss?.toFixed(2) ?? 'N/A'} | Win/Loss Ratio: ${wlRatio}`);
      }
      if (s.sharpeRatio !== undefined) lines.push(`Sharpe Ratio: ${s.sharpeRatio}`);
      if (s.maxDrawdownPct !== undefined) lines.push(`Max Drawdown: ${s.maxDrawdownPct.toFixed(1)}%`);
      // 对齐 nofx engine.go L1306-1337: 简单状态描述，不给行动建议
      if (s.totalTrades < 10) {
        lines.push('Note: Sample size < 10, limited reference value.');
      }
      // 对齐 nofx engine.go L1329-1337: Performance hints（完整措辞，不缩写）
      if (s.profitFactor !== undefined && s.sharpeRatio !== undefined) {
        if (s.profitFactor >= 1.5 && s.sharpeRatio >= 1) {
          lines.push('Performance: GOOD - maintain current strategy');
        } else if (s.profitFactor < 1) {
          lines.push('Performance: NEEDS IMPROVEMENT - improve win/loss ratio, optimize TP/SL');
        } else if (s.maxDrawdownPct !== undefined && s.maxDrawdownPct > 30) {
          lines.push('Performance: HIGH RISK - reduce position size, control drawdown');
        } else {
          lines.push('Performance: NORMAL - room for optimization');
        }
      }
    }

    // [5] Current Positions（对齐 nofx engine.go:1415-1452 formatPositionInfo）
    // 关键设计: 持仓信息 + 该币市场数据紧跟在一起，AI 一目了然
    if (ctx.positions && ctx.positions.length > 0) {
      lines.push('');
      lines.push('=== Current Positions ===');
      for (let i = 0; i < ctx.positions.length; i++) {
        const p = ctx.positions[i];
        const currentPrice = p.markPrice ? `Current $${p.markPrice.toFixed(4)} | ` : '';
        const qty = p.size ? `Qty: ${p.size} | ` : '';
        const posValue = (p.size && (p.markPrice || p.entryPrice)) ? `Value: $${(p.size * (p.markPrice || p.entryPrice)).toFixed(2)} | ` : '';
        const marginStr = p.margin ? `Margin: $${p.margin.toFixed(2)} | ` : '';
        const pnlAmt = p.pnlAmount !== undefined ? ` | PnL Amount: ${p.pnlAmount >= 0 ? '+' : ''}${p.pnlAmount.toFixed(2)} USDT` : '';
        const peak = p.peakPnlPercent !== undefined ? ` | Peak PnL: ${p.peakPnlPercent > 0 ? '+' : ''}${p.peakPnlPercent.toFixed(2)}%` : '';
        const liq = p.liqPrice ? ` | Liq Price: $${p.liqPrice.toFixed(4)}` : '';
        // 持仓时长格式化（对齐 nofx: "Holding Duration 2h 30m"）
        let holdStr = '';
        if (p.holdMinutes) {
          if (p.holdMinutes >= 60) {
            const h = Math.floor(p.holdMinutes / 60);
            const m = p.holdMinutes % 60;
            holdStr = ` | Holding Duration: ${h}h ${m}m`;
          } else {
            holdStr = ` | Holding Duration: ${p.holdMinutes}min`;
          }
        }

        lines.push(`  ${i + 1}. ${p.symbol} ${p.side.toUpperCase()} | Entry $${p.entryPrice.toFixed(4)} ${currentPrice}${qty}${posValue}${marginStr}PnL: ${p.pnlPercent > 0 ? '+' : ''}${p.pnlPercent.toFixed(2)}%${pnlAmt}${peak} | ${p.leverage}x${liq}${holdStr}`);

        // 对齐 nofx formatPositionInfo: 只展示纯数据，不注入提示性文字
        // nofx 的 SL/TP 由交易所条件单执行，AI 不需要提示

        // 对齐 nofx: 持仓币的市场数据紧跟持仓后（AI 不需要跳跃式阅读）
        if (ctx.positionMarketDataMap && ctx.positionMarketDataMap[p.symbol]) {
          lines.push('');
          lines.push(`  --- ${p.symbol} Market Data (for position management) ---`);
          lines.push(ctx.positionMarketDataMap[p.symbol]);
        }
      }
    } else {
      lines.push('');
      lines.push('=== Current Positions ===');
      lines.push('  No open positions');
    }

    // [5.3] Last Cycle Decisions（上轮 AI 决策摘要，避免重复分析）
    if (ctx.lastDecisions && ctx.lastDecisions.length > 0) {
      lines.push('');
      lines.push('=== Previous Cycle Decisions ===');
      lines.push('Your analysis from the previous cycle (avoid repeating identical reasoning):');
      for (const d of ctx.lastDecisions) {
        lines.push(`  ${d.symbol} → ${d.action} (confidence=${d.confidence}%) @ ${d.timestamp}`);
        if (d.reasoning) {
          // 截取前200字，避免prompt过长
          const shortReason = d.reasoning.length > 200 ? d.reasoning.slice(0, 200) + '...' : d.reasoning;
          lines.push(`    Reason: ${shortReason}`);
        }
      }
      lines.push('  NOTE: If market conditions have NOT changed significantly, reference your prior analysis rather than re-deriving the same conclusion. Focus on what CHANGED since last cycle.');
    }

    // [5.5] Other Strategies Exposure（同账户其他策略的持仓概览）
    if (ctx.otherStrategiesCount && ctx.otherStrategiesCount > 0) {
      lines.push('');
      lines.push('=== Other Strategies Exposure (same exchange account) ===');
      lines.push(`  ${ctx.otherStrategiesCount} other positions using $${ctx.otherStrategiesMargin?.toFixed(2) ?? '0'} margin.`);
      lines.push('  NOTE: Factor total account exposure when sizing your positions.');
    }

    // [6] Market Data
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

    // [7.6] News Events (Task 1: CryptoPanic)
    if (ctx.newsPrompt) {
      lines.push('');
      lines.push(ctx.newsPrompt);
    }

    // [7.7] Social Sentiment (Task 4: LunarCrush)
    if (ctx.socialSentimentPrompt) {
      lines.push('');
      lines.push(ctx.socialSentimentPrompt);
    }

    // [7.8] Fear & Greed Index (Task 2)
    if (ctx.fearGreedPrompt) {
      lines.push('');
      lines.push(ctx.fearGreedPrompt);
    }

    // [7.9] Past Trading Experiences (Task 3: BM25 Memory)
    if (ctx.memoryPrompt) {
      lines.push('');
      lines.push(ctx.memoryPrompt);
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
    // 对齐 nofx engine.go L1410: 简洁收尾
    lines.push(`\n---\n\nNow please analyze and output your decision (Chain of Thought + JSON)`);

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
You are a professional cryptocurrency trading AI.
Your task is to make trading decisions based on provided market data.`;
  }

  /**
   * 对齐 nofx engine.go L1061-1095
   * 只告诉 AI 代码无法自动执行的约束 + AI 需要自主决定的参数
   * 代码已强制的规则（ATR/回撤/冷却/熔断/同币种）不写入 prompt，避免过度约束
   */
  private buildHardConstraints(rc: PromptConfig['riskControl'] = {}, _isCN = false): string {
    const btcLev = rc.btcEthMaxLeverage ?? rc.maxLeverage ?? 5;
    const altLev = rc.altcoinMaxLeverage ?? rc.maxLeverage ?? 5;
    const maxPos = rc.maxPositions ?? 3;
    const equity = rc.allocatedCapital ?? 1000;
    const btcEthPVR = rc.btcEthMaxPositionValueRatio ?? 5.0;
    const altPVR = rc.altcoinMaxPositionValueRatio ?? 1.0;
    const minRR = rc.minRiskRewardRatio ?? AI_SAFETY_DEFAULTS.minRiskRewardRatio;
    const minConf = rc.minConfidence ?? 60;
    const minPosSize = rc.minPositionSize ?? AI_SAFETY_DEFAULTS.minPositionSizeAlt;

    // 对齐 nofx: CODE ENFORCED（代码验证，AI 需要知道边界）+ AI GUIDED（推荐，AI 自主决定）
    return `# Hard Constraints (Risk Control)

## CODE ENFORCED (Backend validation, cannot be bypassed):
- Max Positions: ${maxPos} coins simultaneously
- Position Value Limit (Altcoins): max ${(equity * altPVR).toFixed(0)} USDT (= equity ${equity.toFixed(0)} × ${altPVR}x)
- Position Value Limit (BTC/ETH): max ${(equity * btcEthPVR).toFixed(0)} USDT (= equity ${equity.toFixed(0)} × ${btcEthPVR}x)
- Min Position Size: >= ${minPosSize} USDT

## AI GUIDED (Recommended, you should follow):
- Trading Leverage: Altcoins max ${altLev}x | BTC/ETH max ${btcLev}x
- Risk-Reward Ratio: >= 1:${minRR} (take_profit / stop_loss)
- Min Confidence to OPEN: >= ${minConf}
${(rc.minCloseConfidence && rc.minCloseConfidence > 0) ? `- Min Confidence to CLOSE: >= ${rc.minCloseConfidence} (low confidence closes will be held, let SL/TP execute)` : ''}

## Position Sizing Guidance
Calculate position_size_usd based on your confidence and the Position Value Limits above:
- High confidence (>=85): Use 80-100% of max position value limit
- Medium confidence (70-84): Use 50-80% of max position value limit
- Low confidence (60-69): Use 30-50% of max position value limit
- Example: With equity ${equity.toFixed(0)} and BTC/ETH ratio ${btcEthPVR}x, max is ${(equity * btcEthPVR).toFixed(0)} USDT
- **DO NOT** just use available_balance as position_size_usd. Use the Position Value Limits!`;
  }

  // buildAIGuidance 已删除（对齐 nofx engine.go 主路径：不注入"决策原则"段）
  // 跟踪止盈/分批止盈由持仓格式 ⚠️ 提示 + drawdown-monitor 代码层负责
  // OI 四象限已在 Schema 数据字典中定义

  /**
   * 对齐 nofx engine.go L1097-1131
   * 简洁告知频率+可用指标+决策流程，不限制 AI 的分析方法
   */
  private buildFrequencyAwareness(_intervalMinutes?: number, _todayTrades?: number, minConf?: number, indicators?: PromptConfig['indicators']): string {
    const conf = minConf ?? 60;
    const ind = indicators || {};

    // 对齐 nofx writeAvailableIndicators: 从 config 动态生成指标列表
    const indicatorLines: string[] = [];
    indicatorLines.push(`- ${ind.primaryTimeframe || '1h'} price series${ind.longerTimeframe ? ` + ${ind.longerTimeframe} K-line series` : ''}`);
    if (ind.enableEMA !== false) indicatorLines.push(`- EMA indicators${ind.emaPeriods?.length ? ` (periods: ${ind.emaPeriods.join(', ')})` : ''}`);
    if (ind.enableMACD !== false) indicatorLines.push(`- MACD indicators`);
    if (ind.enableRSI !== false) indicatorLines.push(`- RSI indicators${ind.rsiPeriods?.length ? ` (periods: ${ind.rsiPeriods.join(', ')})` : ''}`);
    if (ind.enableATR !== false) indicatorLines.push(`- ATR indicators${ind.atrPeriods?.length ? ` (periods: ${ind.atrPeriods.join(', ')})` : ''}`);
    if (ind.enableBOLL !== false) indicatorLines.push(`- Bollinger Bands + Donchian Channel`);
    if (ind.enableOI !== false) indicatorLines.push(`- Open Interest (OI) + Funding Rate`);
    indicatorLines.push(`- Long/Short Ratio + Taker Buy/Sell`);
    indicatorLines.push(`- Institutional / Retail fund flow (if available)`);

    return `# ⏱️ Trading Frequency Awareness

- Excellent traders: 2-4 trades/day ≈ 0.1-0.2 trades/hour
- >2 trades/hour = Overtrading
- Single position hold time ≥ 30-60 minutes
If you find yourself trading every period → standards too low; if closing positions < 30 minutes → too impatient.

# 🎯 Entry Standards (Strict)

Only open positions when multiple signals resonate. You have:
${indicatorLines.join('\n')}

Feel free to use any effective analysis method, but **confidence ≥ ${conf}** required to open positions; avoid low-quality behaviors such as single indicators, contradictory signals, sideways consolidation, reopening immediately after closing, etc.

# 📋 Decision Process

1. Check positions → Should we take profit/stop-loss
2. Scan candidate coins + multi-timeframe → Are there strong signals
3. Write chain of thought first, then output structured JSON`;
  }

  /**
   * 对齐 nofx engine.go L1133-1155
   */
  private buildOutputFormat(rc: PromptConfig['riskControl'] = {}): string {
    const equity = rc.allocatedCapital ?? 1000;
    const minConf = rc.minConfidence ?? 60;
    const examplePosSize = Math.round(equity * (rc.btcEthMaxPositionValueRatio ?? 5));
    const exampleLev = rc.btcEthMaxLeverage ?? rc.maxLeverage ?? 5;

    return `# Output Format (Strictly Follow)

**Must use XML tags <reasoning> and <decision> to separate chain of thought and decision JSON, avoiding parsing errors**

## Format Requirements

<reasoning>
Write your analysis and end with your final decision in first person.
</reasoning>

<decision>
Step 2: JSON decision array

\`\`\`json
[
  {"symbol": "BTC/USDT:USDT", "action": "open_short", "leverage": ${exampleLev}, "position_size_usd": ${examplePosSize}, "stop_loss": 97000, "take_profit": 91000, "confidence": 85, "risk_usd": 300, "reasoning": "EMA空头+OI↑Price↓空头主导"},
  {"symbol": "ETH/USDT:USDT", "action": "close_long", "reasoning": "论点失效，止损"}
]
\`\`\`
</decision>

## Field Description

- \`action\`: open_long | open_short | close_long | close_short | hold | wait
- \`confidence\`: 0-100 (opening ≥ ${minConf}${(rc.minCloseConfidence && rc.minCloseConfidence > 0) ? `, closing ≥ ${rc.minCloseConfidence}` : ''} required)
- Required when opening: leverage, position_size_usd, stop_loss, take_profit, confidence, risk_usd
- **IMPORTANT**: All numeric values must be calculated numbers, NOT formulas/expressions (e.g., use \`27.76\` not \`3000 * 0.01\`)`;
  }
}
