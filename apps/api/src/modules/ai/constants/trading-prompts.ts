/**
 * 快速交易模式 — AI 提示词与格式化工具
 *
 * 包含:
 * - 快速模式系统提示 (QUICK_MODE_SYSTEM_PROMPT)
 * - 市场数据格式化 (formatMarketDataPrompt)
 * - 安全警告格式化 (formatSafetyWarnings)
 * - 进化 Tier 提示 (EVOLUTION_TIER_PROMPTS)
 */

import { AIRole, AI_ROLES, ANALYSIS_OUTPUT_FORMAT, buildAnalysisOutputFormat } from './models';
import { buildLanguageInstruction, buildReasoningLanguageHint, buildUserMessageLanguageReminder } from './locale-instructions';
import type { EnhancedMarketData } from '../types/ai.types';

// ==================== 市场数据格式化模板 ====================

export function formatMarketDataPrompt(data: {
  symbol: string;
  currentPrice: number;
  change24h?: number;
  volume24h?: number;
  ohlcv?: Array<{ open: number; high: number; low: number; close: number; volume: number }>;
  indicators?: Record<string, any>;
  openInterest?: number;
  fundingRate?: number;
  existingPositions?: Array<{ side: string; entryPrice: number; size: number; pnlPercent: number; peakPnlPercent?: number }>;
  marketRanking?: {
    topGainers?: Array<{ symbol: string; change24h: number }>;
    topLosers?: Array<{ symbol: string; change24h: number }>;
    topVolume?: Array<{ symbol: string; volume24h: number }>;
    topOI?: Array<{ symbol: string; openInterest: number }>;
    targetRank?: { priceRank: number; volumeRank: number };
    totalCoins?: number;
  };
  enhanced?: EnhancedMarketData;
}): string {
  const lines: string[] = [
    `=== MARKET DATA: ${data.symbol} ===`,
    `Current Price: ${data.currentPrice}`,
  ];

  if (data.change24h !== undefined) {
    lines.push(`24h Change: ${data.change24h > 0 ? '+' : ''}${data.change24h.toFixed(2)}%`);
  }
  if (data.volume24h !== undefined) {
    lines.push(`24h Volume: ${data.volume24h.toLocaleString()}`);
  }

  // 技术指标
  if (data.indicators) {
    lines.push('', '--- Technical Indicators ---');
    const ind = data.indicators;
    if (ind.rsi7 !== undefined) lines.push(`RSI(7): ${ind.rsi7.toFixed(1)}`);
    if (ind.rsi14 !== undefined) lines.push(`RSI(14): ${ind.rsi14.toFixed(1)}`);
    if (ind.macd !== undefined) {
      lines.push(`MACD Line: ${ind.macd.toFixed(4)}`);
      if (ind.macdSignal !== undefined) lines.push(`MACD Signal: ${ind.macdSignal.toFixed(4)}`);
      if (ind.macdHistogram !== undefined) lines.push(`MACD Histogram: ${ind.macdHistogram.toFixed(4)}`);
    }
    if (ind.ema7 !== undefined) lines.push(`EMA(7): ${ind.ema7.toFixed(2)}`);
    if (ind.ema25 !== undefined) lines.push(`EMA(25): ${ind.ema25.toFixed(2)}`);
    if (ind.ema99 !== undefined) lines.push(`EMA(99): ${ind.ema99.toFixed(2)}`);
    if (ind.atr3 !== undefined) lines.push(`ATR(3): ${ind.atr3.toFixed(4)}`);
    if (ind.atr14 !== undefined) lines.push(`ATR(14): ${ind.atr14.toFixed(4)}`);
    if (ind.atr3 !== undefined && ind.atr14 !== undefined && ind.atr14 > 0) {
      const ratio = ind.atr3 / ind.atr14;
      lines.push(`ATR Ratio (3/14): ${ratio.toFixed(2)} ${ratio > 2.0 ? '⚠ HIGH VOLATILITY' : ratio > 1.5 ? '⚡ ELEVATED' : '✓ NORMAL'}`);
    }
    if (ind.donchianUpper !== undefined) {
      lines.push(`唐奇安上轨(Donchian Upper): ${ind.donchianUpper.toFixed(2)}`);
      lines.push(`唐奇安中轨(Donchian Mid): ${ind.donchianMid?.toFixed(2) || 'N/A'}`);
      lines.push(`唐奇安下轨(Donchian Lower): ${ind.donchianLower?.toFixed(2) || 'N/A'}`);
    }
    // 指标趋势序列（时间序列数组，让 AI 感知动量方向）
    if (ind.rsiSeries && ind.rsiSeries.length > 0) {
      lines.push(`RSI(14) trend [${ind.rsiSeries.length} bars, oldest→latest]: ${ind.rsiSeries.join(', ')}`);
    }
    if (ind.macdHistSeries && ind.macdHistSeries.length > 0) {
      const first = ind.macdHistSeries[0];
      const last = ind.macdHistSeries[ind.macdHistSeries.length - 1];
      const trend = last > first ? '↑ expanding' : last < first ? '↓ contracting' : '→ flat';
      lines.push(`MACD Hist trend [${ind.macdHistSeries.length} bars]: ${ind.macdHistSeries.join(', ')} (${trend})`);
    }
  }

  // 合约数据
  if (data.openInterest !== undefined || data.fundingRate !== undefined) {
    lines.push('', '--- Derivatives Data ---');
    if (data.openInterest !== undefined) {
      lines.push(`Open Interest: ${data.openInterest.toLocaleString()}`);
    }
    if (data.fundingRate !== undefined) {
      const fr = data.fundingRate;
      const frLabel = Math.abs(fr) > 0.001 ? '⚠ EXTREME' : Math.abs(fr) > 0.0005 ? '⚡ HIGH' : '✓ NORMAL';
      const frDirection = fr > 0 ? '(Longs pay Shorts → bearish bias)' : fr < 0 ? '(Shorts pay Longs → bullish bias)' : '(Neutral)';
      lines.push(`Funding Rate (8h): ${(fr * 100).toFixed(4)}% ${frLabel} ${frDirection}`);
    }
  }

  // 市场排名（币种市场排名数据）
  if (data.marketRanking) {
    const r = data.marketRanking;
    lines.push('', '--- Market Ranking ---');
    if (r.topGainers && r.topGainers.length > 0) {
      lines.push('Top Gainers (24h): ' + r.topGainers.map((g) => `${g.symbol.split('/')[0]} ${g.change24h > 0 ? '+' : ''}${g.change24h}%`).join(', '));
    }
    if (r.topLosers && r.topLosers.length > 0) {
      lines.push('Top Losers (24h): ' + r.topLosers.map((l) => `${l.symbol.split('/')[0]} ${l.change24h}%`).join(', '));
    }
    if (r.targetRank && r.totalCoins) {
      if (r.targetRank.priceRank > 0) {
        lines.push(`Target Price Rank: #${r.targetRank.priceRank}/${r.totalCoins}`);
      }
      if (r.targetRank.volumeRank > 0) {
        lines.push(`Target Volume Rank: #${r.targetRank.volumeRank}/${r.totalCoins}`);
      }
    }
    // OI 排名（OI 持仓量排名）
    if (r.topOI && r.topOI.length > 0) {
      lines.push('Top OI: ' + r.topOI
        .map(o => `${o.symbol.split('/')[0]} $${(o.openInterest / 1e9).toFixed(2)}B`)
        .join(', '));
    }
  }

  // ==================== 增强市场数据（Phase 11） ====================
  const enh = data.enhanced;
  if (enh) {
    // 多空账户比 + Taker 买卖比
    if (enh.longShortRatio || enh.takerFlow) {
      lines.push('', '--- Long/Short Positioning ---');
      if (enh.longShortRatio) {
        const ls = enh.longShortRatio;
        const longPct = (ls.longAccount * 100).toFixed(1);
        const shortPct = (ls.shortAccount * 100).toFixed(1);
        lines.push(`L/S Account Ratio: ${ls.longShortRatio.toFixed(2)} (${longPct}% Long / ${shortPct}% Short)`);
      }
      if (enh.takerFlow) {
        const tf = enh.takerFlow;
        const label = tf.buySellRatio > 1 ? 'buyers more aggressive' : tf.buySellRatio < 1 ? 'sellers more aggressive' : 'balanced';
        lines.push(`Taker Buy/Sell: ${tf.buySellRatio.toFixed(2)} (${label})`);
      }
    }

    // OI 历史趋势
    if (enh.oiHistory && enh.oiHistory.length >= 2) {
      const latest = enh.oiHistory[enh.oiHistory.length - 1];
      const earliest = enh.oiHistory[0];
      const oiChangeVal = latest.sumOpenInterestValue - earliest.sumOpenInterestValue;
      const oiChangePct = earliest.sumOpenInterestValue > 0 ? (oiChangeVal / earliest.sumOpenInterestValue * 100) : 0;
      const dir = oiChangeVal > 0 ? 'increasing' : oiChangeVal < 0 ? 'decreasing' : 'flat';
      lines.push(`OI Trend (${enh.oiHistory.length}h): ${dir} (${oiChangePct > 0 ? '+' : ''}${oiChangePct.toFixed(1)}%, $${(oiChangeVal / 1e6).toFixed(1)}M)`);
    }

    // 清算热力图
    if (enh.liquidationHeatmap) {
      const liq = enh.liquidationHeatmap;
      lines.push('', '--- Liquidation Context ---');
      lines.push(`24h Total: $${(liq.total24hLiquidation / 1e6).toFixed(1)}M (Long: $${(liq.longLiquidation24h / 1e6).toFixed(1)}M / Short: $${(liq.shortLiquidation24h / 1e6).toFixed(1)}M)`);
      if (liq.nearestUpLiqZone > 0) lines.push(`Nearest Up Liq Zone: $${liq.nearestUpLiqZone.toLocaleString()}`);
      if (liq.nearestDownLiqZone > 0) lines.push(`Nearest Down Liq Zone: $${liq.nearestDownLiqZone.toLocaleString()}`);
    }

    // 期权数据
    if (enh.optionsData) {
      const opt = enh.optionsData;
      const pcLabel = opt.putCallRatio < 0.7 ? 'bullish' : opt.putCallRatio > 1.3 ? 'bearish' : 'neutral';
      lines.push('', '--- Options Market (Deribit) ---');
      lines.push(`Put/Call Ratio: ${opt.putCallRatio.toFixed(2)} (${pcLabel})`);
      lines.push(`Max Pain: $${opt.maxPainPrice.toLocaleString()} | IV: ${(opt.impliedVolatility * 100).toFixed(1)}%`);
    }

    // 资金流（稳定币 + ETF）
    if (enh.stablecoinFlows || enh.etfFlows) {
      lines.push('', '--- Fund Flows ---');
      if (enh.stablecoinFlows) {
        const sc = enh.stablecoinFlows;
        const dir = sc.netMinted24h > 0 ? 'minted (capital entering)' : sc.netMinted24h < 0 ? 'burned (capital exiting)' : 'flat';
        lines.push(`Stablecoin 24h Net: ${sc.netMinted24h > 0 ? '+' : ''}$${(sc.netMinted24h / 1e6).toFixed(0)}M ${dir}`);
        lines.push(`Total Stablecoin MCap: $${(sc.totalMarketCap / 1e9).toFixed(1)}B (7d: ${sc.change7d > 0 ? '+' : ''}${sc.change7d.toFixed(1)}%)`);
      }
      if (enh.etfFlows) {
        const etf = enh.etfFlows;
        lines.push(`BTC ETF 24h: ${etf.btcEtfNetFlow24h > 0 ? '+' : ''}$${(etf.btcEtfNetFlow24h / 1e6).toFixed(0)}M ${etf.btcEtfNetFlow24h > 0 ? 'inflow' : 'outflow'}`);
        lines.push(`ETH ETF 24h: ${etf.ethEtfNetFlow24h > 0 ? '+' : ''}$${(etf.ethEtfNetFlow24h / 1e6).toFixed(0)}M ${etf.ethEtfNetFlow24h > 0 ? 'inflow' : 'outflow'}`);
      }
    }

    // 宏观经济
    if (enh.macroData) {
      const m = enh.macroData;
      lines.push('', '--- Macro Context ---');
      lines.push(`Fed Rate: ${m.fedFundsRate.toFixed(2)}% | CPI: ${m.cpiYoY.toFixed(1)}% | 10Y-2Y: ${m.yieldCurveSpread > 0 ? '+' : ''}${m.yieldCurveSpread.toFixed(2)}% | VIX: ${m.vix.toFixed(1)}`);
    }

    // CFTC COT
    if (enh.cotReport) {
      const cot = enh.cotReport;
      lines.push('', '--- Institutional (COT) ---');
      lines.push(`BTC CME Net Speculative: ${cot.btcNetSpeculative > 0 ? '+' : ''}${cot.btcNetSpeculative.toLocaleString()} contracts (${cot.reportDate})`);
    }
  }

  // 现有持仓
  if (data.existingPositions && data.existingPositions.length > 0) {
    lines.push('', '--- Existing Positions ---');
    for (const pos of data.existingPositions) {
      const peakPart = pos.peakPnlPercent !== undefined ? ` | PeakPnL: +${pos.peakPnlPercent.toFixed(2)}%` : '';
      lines.push(`  ${pos.side.toUpperCase()} @ ${pos.entryPrice} | Size: ${pos.size} | PnL: ${pos.pnlPercent > 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%${peakPart}`);
    }
  } else {
    lines.push('', '--- Existing Positions ---');
    lines.push('  No open positions');
  }

  return lines.join('\n');
}

// ==================== 安全提示注入 ====================

export function formatSafetyWarnings(warnings: string[]): string {
  if (!warnings || warnings.length === 0) return '';

  const lines = [
    '',
    '=== SAFETY WARNINGS ===',
    'The risk management system has flagged the following concerns:',
    '',
  ];

  for (const w of warnings) {
    lines.push(`  ⚠ ${w}`);
  }

  lines.push('');
  lines.push('Consider these warnings in your analysis. If a hard limit is reached, your open actions may be blocked.');

  return lines.join('\n');
}

// ==================== 快速模式系统提示 ====================

/**
 * 快速模式系统提示（已被 PromptBuilder 8-section 替代，保留做 fallback）
 * @deprecated 使用 PromptBuilderService.buildSystemPrompt() 替代
 */
export const QUICK_MODE_SYSTEM_PROMPT = `你是一个专业的量化交易AI助手，负责分析市场数据并做出交易决策。

## Section 0: 第零原则 — 不确定时不动
如果你对市场方向没有把握（confidence < 50），output action="wait"。
不交易是正确的决策。patience generates alpha，overtrading destroys it。

## Section 1: 市场状态识别 (Market Regime)
入场前必须先判定当前市场 Regime:
- **dead** (ATR14/Price < 0.3%): 极低波动，使用小仓位+宽止损，仍可交易，R:R ≥ 2.0
- **ranging** (0.3-1.5%): 震荡区间，mean-reversion，R:R ≥ 2.0
- **trending** (1.5-3.5%): 趋势跟随，breakout入场，R:R ≥ 2.0
- **volatile** (> 3.5%): 极度谨慎，减仓，仅高信心交易，R:R ≥ 3.0

重要: 低波动不等于不交易。BTC/ETH 在平静期 ATR14/Price 通常在 0.3-1.0%，属于 ranging 状态，仍应积极寻找交易机会。

## Section 2: 账户与持仓评估
1. 保证金使用率：**不得超过 30%**；超过此限制时优先平仓而非继续开仓，优先保护资本
2. 当前持仓 PnL% = (unrealizedPnl / margin) × 100（不要混淆美元值和百分比）
3. PeakPnL% = 历史最高未实现盈亏百分比（由系统追踪）
4. 杠杆放大效应: 3x 杠杆下，价格涨1% → 持仓盈亏约3%

## Section 3: 市场数据四维分析

### 3.1 趋势 (Trend)
- EMA排列: EMA(7) > EMA(25) > EMA(99) 为多头排列，反之为空头
- Donchian Channel: 价格触及上轨（强势），下轨（弱势），中轨（中性）

### 3.2 动量 (Momentum)
- RSI(7): < 30 超卖，> 70 超买；关注与价格的背离
- MACD: 金叉(MACD上穿Signal)做多确认，死叉做空确认

### 3.3 波动率 (Volatility)
- ATR(3)/ATR(14): > 2.0 高波动（谨慎），> 3.0 极端（禁止入场）
- 波动率影响止损距离: SL = max(1.5×ATR14/price, baseRisk/leverage)

### 3.4 资金流 (Fund Flow)
- **资金费率方向**:
  - 正 FR: 多头付费给空头 → 多头拥挤，看跌信号
  - 负 FR: 空头付费给多头 → 空头拥挤，看涨信号
  - |FR| > 0.05% 为拥挤交易警告
- **OI 变化四象限**:
  - OI增 + 价涨 = 强多头（新多单入场）
  - OI增 + 价跌 = 强空头（新空单入场）
  - OI减 + 价涨 = 空头平仓（可能反转）
  - OI减 + 价跌 = 多头平仓（可能反转）

## Section 4: 决策规则

### 4.1 开仓规则 (无持仓时)
可选: open_long / open_short / wait
- **最低信心度**: confidence < 75 → 必须输出 wait（不确定时不开新仓，patience generates alpha）
- 开仓条件: ≥ 3 个维度信号一致 + confidence ≥ 75
- 仓位大小 (positionSizePercent: 1-20 整数):
  - confidence 85-100 → 15-20%
  - confidence 75-85 → 8-15%
  - confidence < 75 → wait
- 止损: SL distance = max(1.5 × ATR14 / price, 0.5%) / leverage
  - 多仓: stop_loss = entryPrice × (1 - SL_distance)
  - 空仓: stop_loss = entryPrice × (1 + SL_distance)
- 止盈目标: take_profit 对应 +3-8% 盈利区间（系统代码在 +3%/+5%/+8% 自动分批平仓）
- **分批建仓 (Scale-in)**: 首次开仓不超过目标仓位的 50%；只在盈利仓位上加仓，永远不追亏损

### 4.2 平仓规则 (有持仓时)
可选: close_long / close_short / hold

**你需要综合以下因素自主决策，没有固定公式:**

- 当前 PnL% 与 PeakPnL% 的关系（利润是否在回撤）
- 趋势指标是否仍支持持仓方向（EMA排列、MACD方向、RSI水平）
- 波动率变化（ATR(3)/ATR(14) 是否异常放大）
- 止损/止盈目标是否已触及
- 持仓时间与市场结构变化

**参考因素（非强制，根据具体情况灵活运用）:**
- PeakPnL 较高但正在快速回撤时，考虑保护利润
- 趋势明确反转（多指标确认）时，考虑平仓
- **单个持仓亏损达到 -5% 时必须止损**，优先保护资本，再考虑盈利

**Trailing Stop（跟踪止盈）:**
- 持仓 PnL 从峰值回撤 ≥ 30% 时，考虑部分或全部止盈
  示例: PeakPnL=+5%, 当前 PnL=+3.5% → 回撤 30% → 应止盈
  示例: PeakPnL=+8%, 当前 PnL=+5.6% → 回撤 30% → 应止盈

**分批止盈 (Scale-out，系统代码自动执行):**
- 盈利 +3%: 平仓 33%
- 盈利 +5%: 平仓至原仓 50%
- 盈利 +8%: 全部平仓

平仓时不需要设置 stop_loss/take_profit（可填 null）

## Section 5: 代码层规则

### 代码强制拦截 [CODE ENFORCED — 违反会被自动拒绝]:
- ATR(3)/ATR(14) > 3.0 → 全面暂停交易 [CODE ENFORCED]
- Risk/Reward < 2.0:1 → 拒绝交易 [CODE ENFORCED]
- 未设置 stop_loss → 拒绝交易 [CODE ENFORCED]
- 杠杆超限 → 拒绝交易 [CODE ENFORCED]
- 同币种反向仓位冲突 → 拒绝交易 [CODE ENFORCED]
- 平仓决策优先于开仓（每轮先执行所有平仓再执行开仓）[CODE ENFORCED]

### 代码软警告 (Soft Warnings — 你会看到警告但可以自主决策):
- RSI > 80 或 < 20 → 系统警告但不阻止，由你判断
- ATR(3)/ATR(14) > 2.0 → 波动率升高警告
- 某持仓亏损 > 30% → 风险敞口提醒
- 资金费率 > 0.05%/8h → 持仓成本提醒

## Section 6: 风险意识提醒
以下由代码层强制执行（你无需担心违反，系统会自动拦截）:
- 同币种反向仓位冲突 → 代码拦截
- 每日交易次数/冷却期 → 代码拦截
- 连续亏损熔断 → 代码拦截

以下是交易经验参考（非强制，由你自主判断）:
- PnL% 是 unrealizedPnl/margin（已含杠杆），不要与价格变动百分比混淆

{EVOLUTION_CONTEXT}

{MEMORY_CONTEXT}

## Section 7: 输出格式
你必须输出 <reasoning> 和 <decision> 两个标签:

<reasoning>
详细分析 (200-500字)，必须包含以下四部分:
1. Market Regime 判定（trending/ranging/volatile，依据是什么具体指标数值）
2. 四维度信号分析（每个维度必须含具体数值）:
   - 趋势: EMA(7)=xxx vs EMA(25)=xxx vs EMA(99)=xxx → 多头/空头排列
   - 动量: RSI(14)=xx.x（超买/正常/超卖），MACD 状态（金叉/死叉/上升/下降）
   - 波动率: ATR(3)/ATR(14)=x.xx → low/normal/high
   - 资金流: 资金费率=x.xxx%（正负方向对当前仓位的影响），OI 变化四象限判断
3. 风险评估（止损位依据、R:R 比例计算）
4. 决策依据（必填）:
   - confidence X% 原因: 支持信号 vs 反对信号
   - 若 confidence < 75 → 输出 wait，说明哪些信号不足
</reasoning>
<decision>
[{
  "symbol": "BTC/USDT:USDT",
  "action": "open_long|open_short|close_long|close_short|hold|wait",
  "confidence": 0-100,
  "leverage": 1-20,
  "positionSizePercent": 1-20,
  "stop_loss": <绝对价格>,
  "take_profit": <绝对价格>,
  "reasoning": "一句话摘要（必须含≥2个具体指标数值，格式：RSI(62.3)超买+EMA多头排列+MACD金叉，趋势/动量看多，判断开多）"
}]
</decision>

注意:
- positionSizePercent: 1-20 的整数（占可用余额百分比）
- stop_loss / take_profit: 绝对价格（不是百分比）
- 多仓: stop_loss < 当前价 < take_profit
- 空仓: take_profit < 当前价 < stop_loss
- R:R ≥ 2.0:1
`;

// ==================== 进化 Tier 提示模板 ====================

export const EVOLUTION_TIER_PROMPTS: Record<number, string> = {
  0: '', // Tier 0: 暂停，不应运行
  1: '=== EVOLUTION CONTEXT ===\nRecent trading performance is POOR (Sharpe Ratio: {sharpe}). Trade CONSERVATIVELY:\n- Prefer "hold" or "wait" unless signals are extremely clear\n- Require confidence ≥ 80 for any open action\n- Reduce suggested position sizes by 50%\n- Prioritize capital preservation over profit',
  2: '=== EVOLUTION CONTEXT ===\nTrading performance is NORMAL (Sharpe Ratio: {sharpe}). Trade with standard parameters.\n- Follow standard confidence thresholds\n- Standard position sizing applies',
  3: '=== EVOLUTION CONTEXT ===\nRecent trading performance is EXCELLENT (Sharpe Ratio: {sharpe}). You may trade more aggressively:\n- Accept setups with confidence ≥ 55 (normally ≥ 65)\n- Allow slightly larger position sizes (up to 8% of portfolio)\n- Consider taking additional setups you would normally skip',
};

// ==================== 短角色提示词（快速模式辩论专用） ====================
// 
// Product B 已有 8-section PromptBuilder 提供完整交易上下文，
// 角色提示只需定义性格倾向 (~3 行)。

export const TRADING_ROLE_PROMPTS: Record<AIRole, string> = {
  [AI_ROLES.BULL]: 'Aggressive Bull - You are optimistic and look for long opportunities. You believe in upward momentum and trend continuation. Focus on bullish signals and support levels.',
  [AI_ROLES.BEAR]: 'Cautious Bear - You are skeptical and focus on risks. You look for short opportunities and warning signs. Question bullish narratives and highlight resistance levels.',
  [AI_ROLES.ANALYST]: 'Data Analyst - You are neutral and purely data-driven. Present technical analysis without bias. Let the indicators speak for themselves.',
  [AI_ROLES.CONTRARIAN]: 'Contrarian - You challenge majority opinions and look for overlooked opportunities. Question consensus views and find alternative interpretations of the data.',
  [AI_ROLES.RISK_MANAGER]: 'Risk Manager - You focus on position sizing, stop losses, and capital preservation. Evaluate risk/reward ratios and warn about potential downsides.',
};

export const PERSONALITY_EMOJIS: Record<AIRole, string> = {
  [AI_ROLES.BULL]: '🐂',
  [AI_ROLES.BEAR]: '🐻',
  [AI_ROLES.ANALYST]: '📊',
  [AI_ROLES.CONTRARIAN]: '🔄',
  [AI_ROLES.RISK_MANAGER]: '🛡️',
};

// ==================== 投票阶段输出格式 ====================

/**
 * 构建投票输出格式（支持动态语言）
 */
export function buildVotingOutputFormat(locale?: string): string {
  const reasoningHint = buildReasoningLanguageHint(locale);
  return `
### CRITICAL: Output your votes in STRICT JSON ARRAY format (one vote per coin):
<final_vote>
[
  {"symbol": "BTC/USDT:USDT", "action": "open_long", "confidence": 75, "leverage": 5, "positionSizePercent": 20, "stop_loss": 0.02, "take_profit": 0.04, "reasoning": "EMA(7)>EMA(25)>EMA(99) bullish alignment confirmed. RSI at 42 bouncing from oversold, MACD histogram turning positive. OI increasing 8% with positive funding rate suggests long bias. Key support at 94500 held on 3 retests. R:R = 1:2.3 with SL below support, TP at previous resistance."},
  {"symbol": "ETH/USDT:USDT", "action": "wait", "confidence": 35, "leverage": 1, "positionSizePercent": 0, "stop_loss": 0, "take_profit": 0, "reasoning": "Mixed signals: EMA crossing but no volume confirmation. RSI neutral at 52. Bollinger bands narrowing suggests imminent breakout but direction unclear. Funding rate negative while OI rising indicates potential short squeeze. Wait for clear breakout above 3350 or breakdown below 3200 before entry."}
]
</final_vote>

### IMPORTANT: action field MUST be exactly one of:
- "open_long" (Open a new LONG position)
- "open_short" (Open a new SHORT position)
- "close_long" (Close an existing LONG position)
- "close_short" (Close an existing SHORT position)
- "hold" (Keep current positions unchanged)
- "wait" (Not enough clarity, wait for better setup)

### Fields:
- symbol: Trading pair, use the EXACT symbol from the market data above (e.g. "BTC/USDT:USDT")
- action: One of the 6 actions above
- confidence: 0-100 (how confident you are)
- leverage: 1-20 (recommended leverage, default 5)
- positionSizePercent: 1-20 (integer, % of available balance, default 10)
- stop_loss: 0.01-0.10 (stop loss as decimal percentage, e.g. 0.03 = 3%)
- take_profit: 0.01-0.20 (take profit as decimal percentage, e.g. 0.06 = 6%)
- reasoning: Detailed analysis (100-300 chars): include key indicators, signal interpretation, support/resistance levels, and risk assessment ${reasoningHint}
`;
}

/** 默认投票输出格式（向后兼容，使用 zh-CN） */
export const VOTING_OUTPUT_FORMAT = buildVotingOutputFormat('zh-CN');

// ==================== 投票阶段 Prompt 构建 ====================

/**
 * 构建投票阶段系统提示词
 * 
 *
 * @param role AI 角色
 * @param basePrompt 基础 prompt（PromptBuilder 8-section 输出）
 * @param locale 用户 locale（控制 reasoning 语言）
 */
export function buildVotingSystemPrompt(
  role: AIRole,
  basePrompt: string,
  locale?: string,
): string {
  const personality = TRADING_ROLE_PROMPTS[role] || 'Market Analyst - Provide balanced technical analysis.';
  const emoji = PERSONALITY_EMOJIS[role] || '📈';
  const votingFormat = buildVotingOutputFormat(locale);
  const langInstruction = buildLanguageInstruction(locale);

  return `## FINAL VOTE

You are ${emoji} ${role}. The debate has concluded.

Your personality: ${personality}

Review all the arguments presented and cast your final vote for ALL coins discussed.

Consider:
- The strength of technical arguments
- Data-driven evidence presented
- Risk/reward analysis
- Market timing considerations

You may vote differently from your earlier position if convinced by others' arguments.

${langInstruction}

${votingFormat}

---

${basePrompt}`;
}

/**
 * 构建投票阶段用户提示词（辩论摘要）
 * 
 */
export function buildVotingUserPrompt(
  allEntries: Array<{
    role: string;
    round: number;
    direction: string;
    confidence: number;
    arguments?: any;
  }>,
): string {
  const lines: string[] = ['## Debate Summary\n'];

  // 按角色分组
  const byRole: Record<string, typeof allEntries> = {};
  for (const entry of allEntries) {
    if (!byRole[entry.role]) byRole[entry.role] = [];
    byRole[entry.role].push(entry);
  }

  for (const [role, entries] of Object.entries(byRole)) {
    if (entries.length === 0) continue;
    const emoji = PERSONALITY_EMOJIS[role as AIRole] || '📈';
    lines.push(`### ${emoji} ${role}:`);
    for (const e of entries) {
      lines.push(`- Round ${e.round}: ${e.direction} (Confidence: ${e.confidence}%)`);
    }
    lines.push('');
  }

  lines.push('Cast your final vote based on the debate above.');
  return lines.join('\n');
}

// ==================== 网格交易 AI 提示词 ====================

/**
 * 网格交易 AI 上下文类型
 * 
 */
export interface GridContext {
  locale?: string;          // 用户语言（控制 AI reasoning 输出语言）
  symbol: string;
  currentTime: string;
  currentPrice: number;
  gridCount: number;
  totalInvestment: number;
  leverage: number;
  upperPrice: number;
  lowerPrice: number;
  gridSpacing: number;
  distribution: string;
  levels: Array<{
    price: number;
    side: 'buy' | 'sell';
    quantity: number;
    positionSize?: number;    // 实际持仓量（filled 层有效，供 close_long/close_short 使用）
    state: 'pending' | 'filled' | 'cancelled' | 'empty';
    orderId?: string;
    fillPrice?: number;
    profit?: number;
  }>;
  activeOrderCount: number;
  filledLevelCount: number;
  isPaused: boolean;
  pauseSource?: 'ai' | 'risk_control' | 'trend' | 'breakout'; // 暂停来源
  pauseReason?: string;  // 暂停原因文字描述
  // 技术指标
  atr14: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  bollingerWidth: number;
  ema20: number;
  ema50: number;
  emaDistance: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  fundingRate: number;
  volume24h: number;
  priceChange1h: number;
  priceChange4h: number;
  // 补充技术指标（已计算但此前未传给 AI）
  rsi7?: number;           // RSI(7) 短期动量
  atr3?: number;           // ATR(3) 短期波动率
  atrHourly?: number;      // ATR(14) 基于 1h 数据，趋势可靠性更高
  // 4h 指标（中期趋势判断，三周期 5m+1h+4h 并行设计）
  rsi4h?: number;          // RSI(14) 4h 周期
  macd4h?: number;         // MACD 4h 周期
  macdSignal4h?: number;   // MACD Signal 4h 周期
  atr4h?: number;          // ATR(14) 4h 周期
  ema20_4h?: number;       // EMA(20) 4h 周期
  ema50_4h?: number;       // EMA(50) 4h 周期
  priceChange4hReal?: number; // 真实 4h 蜡烛价格变化%（非1h近似）
  // 价格区间（从 1h 数据计算，反映真实 24h 支撑阻力）
  high24h?: number;        // 近 24h 最高价
  low24h?: number;         // 近 24h 最低价
  // 账户
  totalEquity: number;
  availableBalance: number;
  currentPosition: number;
  unrealizedPnl: number;
  // 持仓详情（双向持仓分别展示）
  positionLong?: {
    quantity: number;
    entryPrice: number;
    unrealizedPnl: number;
    liquidationPrice?: number;
  };
  positionShort?: {
    quantity: number;
    entryPrice: number;
    unrealizedPnl: number;
    liquidationPrice?: number;
  };
  // 绩效
  totalProfit: number;
  totalTrades: number;
  winningTrades: number;
  maxDrawdown: number;
  dailyPnl: number;
  // 箱体数据
  boxData?: {
    shortUpper: number;
    shortLower: number;
    midUpper: number;
    midLower: number;
    longUpper: number;
    longLower: number;
  };
  currentDirection: string;
  enableDirectionAdjust: boolean;  // 是否启用方向自适应（true=后端自动偏转，false=突破时 pause/reduce）
  startEquity: number;          // 策略启动时权益
  currentProfitPct: number;    // 当前盈利%（相对启动权益）
  marginUsedPct: number;       // 保证金使用率%（>30% 警惕，>50% 危险，>70% 严重）
  oiChange1h?: number;         // 持仓量相对上周期变化%（正=新多头建仓，负=平仓）
  rsiDivergenceType?: 'bullish' | 'bearish' | 'none';  // RSI 背离信号（Phase 12）
  // K线历史
  ohlcv?: Array<{ open: number; high: number; low: number; close: number; volume: number }>;   // 最近30根1h蜡烛
  ohlcv5m?: Array<{ open: number; high: number; low: number; close: number; volume: number }>; // 最近10根5m蜡烛（为RSI/MACD信号提供短期价格背景）
  // 范围锁定：用户明确填写了上下界 → true（AI 禁止 adjust_grid），用户填 0 让 AI 自决 → false
  userLockedRange?: boolean;
  upperBoundPct?: number;  // 用户配置的上界百分比（如 1 表示 +1%），adjust_grid 将以此为准；undefined=ATR自动计算
  lowerBoundPct?: number;  // 用户配置的下界百分比（如 1 表示 -1%），adjust_grid 将以此为准；undefined=ATR自动计算
  stopLossPct?: number;        // 单格止损阈值%（0或undefined=未启用）
  profitTargetPct?: number;    // 策略止盈目标%（0或undefined=未设置，AI自主决策）
  gridSkewLevel?: 'none' | 'light' | 'severe';
  gridSkewBuyFilled?: number;   // 持多头格线数（side='buy'，买单成交未平仓）
  gridSkewSellFilled?: number;  // 持空头格线数（side='sell'，卖单成交未平仓）
  autoAdjustThreshold?: number; // 后端自动重建阈值（小数，默认 0.2 = 20%）
  // 后端检测的市场形态（供参考，AI 可结合指标自行判断）
  currentRegime?: 'ultra_narrow' | 'narrow' | 'standard' | 'wide' | 'volatile';
  // 交易所实时委托单（供 AI 对比内存状态）
  exchangeOpenOrders?: Array<{orderId: string; side: string; price: number; quantity: number}>;
  // 近期已平仓记录（供 AI 分析最近成交历史）
  recentClosedPnl?: Array<{symbol: string; side: string; quantity: number; entryPrice: number; exitPrice: number; realizedPnl: number; closedAt: string}>;
  // 突破恢复中：下单量缩减比例（50=每层最多用50%仓位预算，0=正常）
  positionReductionPct?: number;
  // 上轮 AI 决策摘要（防止决策震荡）
  lastCycleActions?: string[];
  // 未映射到网格层的交易所挂单（方向不匹配等原因），AI 应主动撤销
  unmappedOrderIds?: string[];
  // 仓位容量（totalInvestment × leverage 的使用率）
  capTotal?: number;       // 仓位上限 = totalInvestment × leverage
  capUsed?: number;        // 已用 = 交易所持仓市值 + 挂单名义值
  capUsedPct?: number;     // 使用率% = capUsed / capTotal × 100
  capRemaining?: number;   // 剩余 = capTotal - capUsed
}

/**
 * 网格交易系统提示词（路由：按 locale 选择中/英文版）
 */
export function GRID_SYSTEM_PROMPT(
  symbol: string,
  gridCount: number,
  totalInvestment: number,
  leverage: number,
  distribution: string,
  currentPrice: number,
  locale?: string,
): string {
  if (!locale || locale.startsWith('zh')) {
    return gridSystemPromptZh(symbol, gridCount, totalInvestment, leverage, distribution, currentPrice);
  }
  return gridSystemPromptEn(symbol, gridCount, totalInvestment, leverage, distribution, currentPrice, locale);
}

/** 中文版 system prompt */
function gridSystemPromptZh(
  symbol: string, gridCount: number, totalInvestment: number,
  leverage: number, distribution: string, currentPrice: number,
): string {
  return `# 你是一个专业的网格交易AI

## 角色定义
你是一个经验丰富的网格交易专家，负责管理 ${symbol} 的网格交易策略。你的任务是：
1. 判断当前市场状态（震荡/趋势/高波动）
2. 决定是否需要调整网格或暂停交易
3. 管理每个网格层级的订单

## 网格配置
- 交易对: ${symbol}
- 网格层数: ${gridCount}
- 总投资: ${totalInvestment} USDT
- 杠杆: ${leverage}x
- 价格分布: ${distribution}
- 参考价: ${currentPrice.toFixed(4)}

## 决策规则

### 市场状态判断
- **震荡市场**（适合网格）: 布林带宽度 < 3%, EMA20/50 距离 < 1%, 价格在布林带中轨附近
- **趋势市场**（暂停网格）: 布林带宽度 > 4%, EMA20/50 距离 > 2%, 价格持续突破布林带
- **高波动市场**（谨慎）: ATR异常放大, 价格剧烈波动

### 层状态
- **filled**：已成交持仓
- **pending**：已挂单，等待成交
- **empty**：可操作

### 可执行的操作
- place_buy_limit: 挂买单（fields: level, price, quantity）
- place_sell_limit: 挂卖单（fields: level, price, quantity）
- close_long（fields: level, quantity）：平多仓（side=buy 的 filled 层）
- close_short（fields: level, quantity）：平空仓（side=sell 的 filled 层）
- cancel_order: 取消指定挂单（field: orderId）
- cancel_all_orders: 取消所有挂单
- pause_grid: 暂停网格交易（趋势市场时）
- resume_grid: 恢复网格交易（震荡市场时）
- adjust_grid: 以当前价重建网格
- hold: 保持当前状态不操作

技术约束：
- close_long 对应 side=buy 的 filled 层，close_short 对应 side=sell；混用会被交易所拒绝
- 每个挂单都会冻结保证金。保证金不足时可先 cancel_order 撤远处挂单释放保证金

## 暂停模式（isPaused=true）
挂单已撤销，AI 继续管理持仓。可用：close_long/close_short/cancel_order/cancel_all_orders/resume_grid/adjust_grid/hold。
place_buy/sell_limit 暂停期间不可用，需先 resume_grid 或 adjust_grid 恢复。

pauseSource：
- breakout/ai/trend → resume_grid 或 adjust_grid 均可解除
- risk_control → 仅 resume_grid 可解除（adjust_grid 被拦截）

## 输出格式

\`\`\`json
{
  "analysis": "分析市场状态、持仓风险、决策理由",
  "actions": [
    {"action":"place_buy_limit","level":5,"price":82.50,"quantity":0.012,"confidence":85,"reasoning":"理由"},
    {"action":"close_short","level":3,"quantity":0.33,"confidence":90,"reasoning":"理由"}
  ]
}
\`\`\`
`;
}

/** 英文版 system prompt */
function gridSystemPromptEn(
  symbol: string, gridCount: number, totalInvestment: number,
  leverage: number, distribution: string, currentPrice: number, locale: string,
): string {
  return `# You are a Professional Grid Trading AI

## Role Definition
You are an experienced grid trading expert managing a grid strategy for ${symbol}. Your tasks are:
1. Assess current market regime (ranging/trending/volatile)
2. Decide whether to adjust grid or pause trading
3. Manage orders at each grid level

## Grid Configuration
- Symbol: ${symbol}
- Grid Levels: ${gridCount}
- Total Investment: ${totalInvestment} USDT
- Leverage: ${leverage}x
- Distribution: ${distribution}
- Reference Price: ${currentPrice.toFixed(4)}

## Decision Rules

### Market Regime Assessment
- **Ranging Market** (ideal for grid): Bollinger width < 3%, EMA20/50 distance < 1%, price near middle band
- **Trending Market** (pause grid): Bollinger width > 4%, EMA20/50 distance > 2%, price breaking bands
- **High Volatility** (caution): ATR spike, erratic price movement

### Level States
- **filled**: Position held
- **pending**: Order placed, awaiting fill
- **empty**: Available for orders

### Available Actions
- place_buy_limit: Place buy limit order (fields: level, price, quantity)
- place_sell_limit: Place sell limit order (fields: level, price, quantity)
- close_long (fields: level, quantity): Close long (filled, side=buy)
- close_short (fields: level, quantity): Close short (filled, side=sell)
- cancel_order: Cancel specific order (field: orderId)
- cancel_all_orders: Cancel all orders
- pause_grid: Pause grid trading (in trending market)
- resume_grid: Resume grid trading (in ranging market)
- adjust_grid: Rebuild grid at current price
- hold: Maintain current state

Technical constraints:
- close_long for side=buy filled; close_short for side=sell — mixing causes rejection
- Every pending order freezes margin. Cancel far orders to free margin if needed

## Pause Mode (isPaused=true)
Orders cancelled. AI manages positions. Available: close_long/close_short/cancel_order/cancel_all_orders/resume_grid/adjust_grid/hold.
place_buy/sell_limit not available while paused — resume_grid or adjust_grid first.

pauseSource:
- breakout/ai/trend → resume_grid or adjust_grid to unpause
- risk_control → only resume_grid works (adjust_grid blocked)

## Output Format

\`\`\`json
{
  "analysis": "Brief market analysis and decision reasoning",
  "actions": [
    {"action":"place_buy_limit","level":5,"price":82.50,"quantity":0.012,"confidence":85,"reasoning":"empty level, price below avgEntry, long profitable direction"},
    {"action":"close_short","level":8,"quantity":0.012,"confidence":80,"reasoning":"short position, price dropped significantly, taking profit"}
  ]
}
\`\`\`

${buildLanguageInstruction(locale)}
`;
}

/**
 * 构建网格交易用户提示词（路由：按 locale 选择中/英文版）
 */
export function buildGridUserPrompt(ctx: GridContext): string {
  if (!ctx.locale || ctx.locale.startsWith('zh')) return buildGridUserPromptZh(ctx);
  return buildGridUserPromptEn(ctx);
}

// ========== 网格 User Prompt 共用辅助函数 ==========

/** 计算 filled 层合计持仓量 */
function calcFilledQty(levels: GridContext['levels'], side: string): number {
  return levels.filter(l => l.state === 'filled' && l.side === side).reduce((s, l) => s + (l.positionSize ?? 0), 0);
}

/** 构建层级表行 */
function buildLevelRow(l: GridContext['levels'][0], i: number, ctx: GridContext, isEn: boolean): string {
  const profitStr = l.profit !== undefined ? `${l.profit > 0 ? '+' : ''}${l.profit.toFixed(4)}` : '-';
  const dirStr = l.state === 'filled'
    ? (l.side === 'buy' ? (isEn ? 'Long' : '持多') : (isEn ? 'Short' : '持空'))
    : l.state === 'pending'
      ? (l.side === 'buy' ? (isEn ? 'Bid' : '挂买') : (isEn ? 'Ask' : '挂卖'))
      : (l.side === 'buy' ? (isEn ? 'buy' : '买') : (isEn ? 'sell' : '卖'));
  const stateStr = l.state === 'pending' ? (isEn ? 'Pending' : '待成交') : l.state === 'filled' ? (isEn ? 'Filled' : '持仓') : (isEn ? 'Empty' : '空格');
  const orderIdStr = l.state === 'pending' && l.orderId ? l.orderId : '-';
  const posSizeStr = l.state === 'filled' && l.positionSize && l.positionSize > 0 ? l.positionSize.toFixed(4) : '-';
  const lossStr = (l.state === 'filled' && l.fillPrice && l.fillPrice > 0 && ctx.currentPrice > 0)
    ? (() => {
        const pct = Math.abs(ctx.currentPrice - l.fillPrice) / l.fillPrice * 100;
        const isLoss = l.side === 'buy' ? ctx.currentPrice < l.fillPrice : ctx.currentPrice > l.fillPrice;
        const threshLabel = isEn ? '/thresh' : '/阈';
        // 对齐 nofx：盈亏都显示，亏损时附带止损阈值
        if (isLoss) {
          const lossLabel = isEn ? 'loss' : '亏';
          return ` [${lossLabel}${pct.toFixed(1)}%${ctx.stopLossPct ? `${threshLabel}${ctx.stopLossPct}%` : ''}]`;
        } else {
          const profitLabel = isEn ? 'profit' : '盈';
          return ` [${profitLabel}${pct.toFixed(1)}%]`;
        }
      })()
    : '';
  // filled 层：显示入场价（@entry），quantity=0 表示禁止在此层下单
  const entryStr = (l.state === 'filled' && l.fillPrice && l.fillPrice > 0)
    ? ` @${l.fillPrice.toFixed(4)}`
    : '';
  return `${String(i + 1).padStart(3)} | ${l.price.toFixed(4)}${entryStr} | ${dirStr} | ${l.quantity.toFixed(4)} | ${posSizeStr} | ${stateStr}${lossStr} | ${profitStr} | ${orderIdStr}`;
}

/** 构建持仓行 */
function buildPositionLine(pos: {quantity: number; entryPrice: number; unrealizedPnl: number; liquidationPrice?: number}, label: string, isEn: boolean): string {
  const liqStr = pos.liquidationPrice ? ` | ${isEn ? 'liq' : '强平价'}=${pos.liquidationPrice.toFixed(2)}` : '';
  const entryLabel = isEn ? 'entry' : '入场价';
  const upnlLabel = isEn ? 'uPnL' : '未实现';
  return `${label}: ${pos.quantity.toFixed(4)} @ ${entryLabel}=${pos.entryPrice.toFixed(4)} | ${upnlLabel}=${pos.unrealizedPnl > 0 ? '+' : ''}${pos.unrealizedPnl.toFixed(2)}${liqStr}`;
}

/** 构建 OHLCV 表 */
function buildOhlcvSection(ctx: GridContext, isEn: boolean): string[] {
  const lines: string[] = [];
  // 5m K线（为 RSI/MACD[5m] 信号提供短期价格背景）
  if (ctx.ohlcv5m && ctx.ohlcv5m.length > 0) {
    lines.push('');
    const header5m = isEn
      ? `--- 5m Candles (×${ctx.ohlcv5m.length}, oldest→newest, context for RSI/MACD[5m]) ---`
      : `--- 5m K线 (×${ctx.ohlcv5m.length}，最旧→最新，RSI/MACD[5m]的价格背景) ---`;
    lines.push(header5m);
    const colHeader = isEn ? '# Open     High     Low      Close    Volume' : '# 开      高      低      收      量';
    lines.push(colHeader);
    ctx.ohlcv5m.forEach((c, i) => {
      const idx = String(i + 1).padStart(2, ' ');
      lines.push(
        `${idx} ${c.open.toFixed(2).padStart(8)} ${c.high.toFixed(2).padStart(8)} ` +
        `${c.low.toFixed(2).padStart(8)} ${c.close.toFixed(2).padStart(8)} ` +
        `${c.volume.toFixed(1).padStart(10)}`,
      );
    });
  }
  // 1h K线（趋势/支撑阻力）
  if (ctx.ohlcv && ctx.ohlcv.length > 0) {
    lines.push('');
    const header = isEn
      ? `--- 1h Candles (×${ctx.ohlcv.length}, oldest→newest) ---`
      : `--- 1h K线 (×${ctx.ohlcv.length}，最旧→最新) ---`;
    lines.push(header);
    const colHeader = isEn ? '# Open     High     Low      Close    Volume' : '# 开      高      低      收      量';
    lines.push(colHeader);
    ctx.ohlcv.forEach((c, i) => {
      const idx = String(i + 1).padStart(2, ' ');
      lines.push(
        `${idx} ${c.open.toFixed(2).padStart(8)} ${c.high.toFixed(2).padStart(8)} ` +
        `${c.low.toFixed(2).padStart(8)} ${c.close.toFixed(2).padStart(8)} ` +
        `${c.volume.toFixed(1).padStart(10)}`,
      );
    });
  }
  return lines;
}

/** 构建交易所委托单 + 已平仓 section */
function buildOrdersSection(ctx: GridContext, isEn: boolean): string[] {
  const lines: string[] = [];
  if (ctx.exchangeOpenOrders && ctx.exchangeOpenOrders.length > 0) {
    lines.push('');
    lines.push(`--- ${isEn ? 'Exchange Open Orders' : '交易所委托单'}(${ctx.exchangeOpenOrders.length}) ---`);
    // 溢出时显示全部挂单（AI 需要看到所有 orderId 以便撤销多余的）
    const orderDisplayLimit = ctx.exchangeOpenOrders.length > (ctx.levels?.length ?? 20) ? ctx.exchangeOpenOrders.length : 15;
    for (const o of ctx.exchangeOpenOrders.slice(0, orderDisplayLimit)) {
      const priceLabel = isEn ? 'price' : '价格';
      const qtyLabel = isEn ? 'qty' : '数量';
      lines.push(`${o.orderId} | ${o.side} | ${priceLabel}=${o.price.toFixed(4)} | ${qtyLabel}=${o.quantity.toFixed(4)}`);
    }
  } else if (ctx.exchangeOpenOrders) {
    lines.push('');
    lines.push(`--- ${isEn ? 'Exchange Open Orders: None' : '交易所委托单: 无'} ---`);
  }
  if (ctx.recentClosedPnl && ctx.recentClosedPnl.length > 0) {
    lines.push('');
    const label = isEn ? `Recent Closed Trades(${ctx.recentClosedPnl.length}, 24h)` : `近期已平仓(${ctx.recentClosedPnl.length}笔,24h内)`;
    lines.push(`--- ${label} ---`);
    for (const r of ctx.recentClosedPnl.slice(0, 10)) {
      const pnlStr = r.realizedPnl >= 0 ? `+${r.realizedPnl.toFixed(4)}` : r.realizedPnl.toFixed(4);
      const entryL = isEn ? 'entry' : '入';
      const exitL = isEn ? 'exit' : '出';
      lines.push(`${r.side} ${r.quantity.toFixed(4)} | ${entryL}=${r.entryPrice.toFixed(4)} ${exitL}=${r.exitPrice.toFixed(4)} | PnL=${pnlStr}`);
    }
  }
  return lines;
}

// ========== 中文版 User Prompt ==========

function buildGridUserPromptZh(ctx: GridContext): string {
  const lines: string[] = [];

  // Section 1: 市场数据
  lines.push(`=== 市场数据: ${ctx.symbol} ===`);
  lines.push(`当前价格: ${ctx.currentPrice}`);
  lines.push(`时间: ${ctx.currentTime}`);
  lines.push(`1H变化: ${ctx.priceChange1h > 0 ? '+' : ''}${ctx.priceChange1h.toFixed(2)}%`);
  const p4h = ctx.priceChange4hReal ?? ctx.priceChange4h;
  lines.push(`4H变化: ${p4h > 0 ? '+' : ''}${p4h.toFixed(2)}%`);
  if (ctx.high24h !== undefined && ctx.low24h !== undefined && ctx.high24h > 0) {
    lines.push(`24h高: ${ctx.high24h} | 24h低: ${ctx.low24h}`);
  }
  lines.push(`24h 成交量: ${ctx.volume24h.toLocaleString()}`);
  lines.push(`资金费率: ${(ctx.fundingRate * 100).toFixed(4)}%`);

  // Section 2: 技术指标
  lines.push('');
  lines.push('--- 技术指标 ---');
  lines.push(`RSI(14)[5m]: ${ctx.rsi14.toFixed(1)}${ctx.rsi7 !== undefined ? ` | RSI(7)[5m]: ${ctx.rsi7.toFixed(1)}` : ''}`);
  lines.push(`MACD[5m]: ${ctx.macd.toFixed(4)} | Signal: ${ctx.macdSignal.toFixed(4)} | Histogram: ${ctx.macdHistogram.toFixed(4)}`);
  lines.push(`EMA(20)[1h]: ${ctx.ema20.toFixed(2)} | EMA(50)[1h]: ${ctx.ema50.toFixed(2)} | 距离: ${ctx.emaDistance.toFixed(2)}%`);
  lines.push(`ATR(14)[5m]: ${ctx.atr14.toFixed(4)}${ctx.atrHourly !== undefined ? ` | ATR(14)[1h]: ${ctx.atrHourly.toFixed(4)}` : ''}${ctx.atr4h !== undefined ? ` | ATR(14)[4h]: ${ctx.atr4h.toFixed(4)}` : ''}${ctx.atr3 !== undefined ? ` | ATR(3)[5m]: ${ctx.atr3.toFixed(4)}` : ''}`);
  if (ctx.rsi4h !== undefined) {
    lines.push(`4h 指标: RSI=${ctx.rsi4h.toFixed(1)}${ctx.macd4h !== undefined ? ` | MACD=${ctx.macd4h.toFixed(4)}` : ''}${ctx.ema20_4h !== undefined ? ` | EMA20=${ctx.ema20_4h.toFixed(2)}` : ''}${ctx.ema50_4h !== undefined ? ` | EMA50=${ctx.ema50_4h.toFixed(2)}` : ''}`);
  }
  lines.push(`Bollinger[1h]: ${ctx.bollingerLower.toFixed(2)} / ${ctx.bollingerMiddle.toFixed(2)} / ${ctx.bollingerUpper.toFixed(2)} (宽度: ${ctx.bollingerWidth.toFixed(2)}%)`);
  if (ctx.rsiDivergenceType && ctx.rsiDivergenceType !== 'none') {
    lines.push(`RSI背离: ${ctx.rsiDivergenceType === 'bullish' ? '底背离' : '顶背离'}`);
  }
  if (ctx.currentRegime) {
    const regimeLabel: Record<string, string> = { ultra_narrow: '极窄幅震荡', narrow: '窄幅震荡', standard: '标准', wide: '宽幅', volatile: '高波动' };
    lines.push(`市场形态: ${regimeLabel[ctx.currentRegime] ?? ctx.currentRegime}`);
  }
  lines.push(`保证金使用率: ${ctx.marginUsedPct.toFixed(1)}%`);

  // Section 3: 箱体数据
  if (ctx.boxData) {
    lines.push('');
    lines.push('--- 唐奇安通道(Donchian)箱体 ---');
    lines.push(`短期(3d): ${ctx.boxData.shortLower.toFixed(2)} ~ ${ctx.boxData.shortUpper.toFixed(2)}`);
    lines.push(`中期(10d): ${ctx.boxData.midLower.toFixed(2)} ~ ${ctx.boxData.midUpper.toFixed(2)}`);
    lines.push(`长期(21d): ${ctx.boxData.longLower.toFixed(2)} ~ ${ctx.boxData.longUpper.toFixed(2)}`);
    if (ctx.currentPrice > ctx.boxData.longUpper || ctx.currentPrice < ctx.boxData.longLower) {
      lines.push('⚠️ 突破: 价格突破长期箱体!');
    } else if (ctx.currentPrice > ctx.boxData.midUpper || ctx.currentPrice < ctx.boxData.midLower) {
      lines.push('⚠️ 注意: 价格已突破中期箱体（在中期~长期区间内）');
    }
  }

  // Section 4: 网格状态
  lines.push('');
  lines.push('--- 网格状态 ---');
  lines.push(`范围: ${ctx.lowerPrice.toFixed(2)} ~ ${ctx.upperPrice.toFixed(2)} | 间距: ${ctx.gridSpacing.toFixed(4)}`);
  const dirExplain: Record<string, string> = {
    neutral:    '中性 (50%买+50%卖)',
    long_bias:  '偏多 (70%买+30%卖)',
    short_bias: '偏空 (30%买+70%卖)',
    long:       '做多 (100%买)',
    short:      '做空 (100%卖)',
  };
  const dirNote = dirExplain[ctx.currentDirection] ?? ctx.currentDirection;
  lines.push(`分布: ${ctx.distribution} | 方向: ${ctx.currentDirection}（${dirNote}）`);
  lines.push(`方向自适应: ${ctx.enableDirectionAdjust ? '已启用（箱体突破→自动偏转）' : '未启用（突破→pause/reduce）'}`);
  const _exchOrderCount = ctx.exchangeOpenOrders?.length ?? 0;
  const _mappedOrderCount = ctx.activeOrderCount;
  const _unmappedCount = ctx.unmappedOrderIds?.length ?? 0;
  const pauseStr = ctx.isPaused
    ? `是 [来源:${ctx.pauseSource ?? '未知'}${ctx.pauseReason ? ` | 原因:${ctx.pauseReason}` : ''}]`
    : '否';
  lines.push(`交易所挂单: ${_exchOrderCount} | 已映射: ${_mappedOrderCount} | 持仓格: ${ctx.filledLevelCount} | 暂停: ${pauseStr}`);
  // 额外挂单（不在网格层映射中）
  if (_unmappedCount > 0) {
    lines.push(`ℹ️ ${_unmappedCount} 个额外挂单（不在网格层中）：`);
    for (const oid of ctx.unmappedOrderIds!) {
      const matchOrder = ctx.exchangeOpenOrders?.find(o => o.orderId === oid);
      if (matchOrder) {
        lines.push(`  - orderId: ${oid} (${matchOrder.side} @${matchOrder.price.toFixed(2)} x${matchOrder.quantity})`);
      } else {
        lines.push(`  - orderId: ${oid}`);
      }
    }
  }
  if (ctx.positionReductionPct && ctx.positionReductionPct > 0) {
    lines.push(`⚠️ 仓位缩减: 每层下单量限制为正常的${100 - ctx.positionReductionPct}%。adjust_grid 可立即解除。`);
  }
  const _exchLong = ctx.positionLong?.quantity ?? 0;
  const _exchShort = ctx.positionShort?.quantity ?? 0;
  lines.push(`交易所持仓: 多头 ${_exchLong.toFixed(4)} | 空头 ${_exchShort.toFixed(4)}`);
  lines.push(`userLockedRange: ${ctx.userLockedRange ? 'true（adjust_grid将沿用用户配置的百分比边界）' : 'false'}`);
  if (ctx.upperBoundPct && ctx.lowerBoundPct) {
    lines.push(`⚙️ 用户网格边界配置: 上+${ctx.upperBoundPct}% / 下-${ctx.lowerBoundPct}%（adjust_grid 重建时将按此百分比计算，不使用ATR）`);
  } else {
    lines.push(`⚙️ 用户网格边界配置: 未设置（adjust_grid 重建时将用ATR自动计算边界）`);
  }
  if (ctx.stopLossPct !== undefined && ctx.stopLossPct > 0) {
    lines.push(`逐层止损阈值: ${ctx.stopLossPct}%`);
  }
  if (ctx.profitTargetPct !== undefined && ctx.profitTargetPct > 0) {
    lines.push(`止盈目标: ${ctx.profitTargetPct}%`);
  }
  // Section 5: 网格层级表
  lines.push('');
  lines.push('--- 网格层级 ---');
  lines.push('层号 | 价格 | 方向 | 数量 | 持仓量 | 状态 | 盈亏 | 订单ID');
  for (let i = 0; i < ctx.levels.length; i++) {
    lines.push(buildLevelRow(ctx.levels[i], i, ctx, false));
  }
  // 层状态摘要
  const emptyLevels = ctx.levels.map((l, i) => ({ l, i })).filter(({ l }) => l.state === 'empty').map(({ i }) => `L${i + 1}`);
  const filledLevels = ctx.levels.map((l, i) => ({ l, i })).filter(({ l }) => l.state === 'filled').map(({ l, i }) => `L${i + 1}(${l.side === 'buy' ? '多' : '空'})`);
  const pendingLevels = ctx.levels.map((l, i) => ({ l, i })).filter(({ l }) => l.state === 'pending').map(({ i }) => `L${i + 1}`);
  lines.push(`空层: ${emptyLevels.length > 0 ? emptyLevels.join(', ') : '无'}`);
  lines.push(`持仓层: ${filledLevels.length > 0 ? filledLevels.join(', ') : '无'}`);
  lines.push(`挂单层: ${pendingLevels.length > 0 ? pendingLevels.join(', ') : '无'}`);

  // Section 6: 账户状态
  lines.push('');
  lines.push('--- 账户状态 ---');
  lines.push(`总权益: ${ctx.totalEquity.toFixed(2)} USDT`);
  lines.push(`可用保证金: ${ctx.availableBalance.toFixed(2)} USDT`);
  if (ctx.positionLong || ctx.positionShort) {
    lines.push(ctx.positionLong ? buildPositionLine(ctx.positionLong, '多仓', false) : '多仓: 无');
    lines.push(ctx.positionShort ? buildPositionLine(ctx.positionShort, '空仓', false) : '空仓: 无');
    // avgEntry 摘要：filled 层均显示此价格，是网格层映射的参考基准
    if (ctx.positionLong) lines.push(`avgEntry(多头均价): ${ctx.positionLong.entryPrice.toFixed(4)} — filled层均以此为入场参考`);
    if (ctx.positionShort) lines.push(`avgEntry(空头均价): ${ctx.positionShort.entryPrice.toFixed(4)} — filled层均以此为入场参考`);
  } else {
    lines.push(`当前持仓: ${ctx.currentPosition > 0 ? '+' : ''}${ctx.currentPosition.toFixed(4)}`);
  }
  lines.push(`未实现盈亏: ${ctx.unrealizedPnl > 0 ? '+' : ''}${ctx.unrealizedPnl.toFixed(2)} USDT`);

  // Section 7: 绩效统计
  lines.push('');
  lines.push('--- 绩效 ---');
  lines.push(`累计盈亏: ${ctx.totalProfit > 0 ? '+' : ''}${ctx.totalProfit.toFixed(2)} USDT`);
  lines.push(`今日盈亏: ${ctx.dailyPnl > 0 ? '+' : ''}${ctx.dailyPnl.toFixed(2)} USDT`);
  const winRate = ctx.totalTrades > 0 ? ((ctx.winningTrades / ctx.totalTrades) * 100).toFixed(1) : '0.0';
  lines.push(`交易次数: ${ctx.totalTrades} | 胜率: ${winRate}%`);
  lines.push(`最大回撤: ${ctx.maxDrawdown.toFixed(2)}%`);

  // Section 8: 策略盈利状态
  lines.push('');
  lines.push('--- 策略盈利状态 ---');
  lines.push(`启动权益: ${ctx.startEquity.toFixed(2)} USDT`);
  lines.push(`当前盈利: ${ctx.currentProfitPct >= 0 ? '+' : ''}${ctx.currentProfitPct.toFixed(2)}%`);
  if (ctx.oiChange1h !== undefined && ctx.oiChange1h !== 0) {
    lines.push(`持仓量变化(1H): ${ctx.oiChange1h >= 0 ? '+' : ''}${ctx.oiChange1h.toFixed(2)}%`);
  }
  // Section 9-11: K线 + 委托单 + 已平仓
  lines.push(...buildOhlcvSection(ctx, false));
  lines.push(...buildOrdersSection(ctx, false));

  // 上轮操作摘要（防止 AI 决策震荡）
  if (ctx.lastCycleActions && ctx.lastCycleActions.length > 0) {
    lines.push('');
    lines.push('--- 上轮操作 ---');
    for (const a of ctx.lastCycleActions) {
      lines.push(`- ${a}`);
    }
  }

  lines.push('');
  lines.push('请根据以上数据输出你的网格操作决策（JSON 数组）。');
  return lines.join('\n');
}

// ========== 英文版 User Prompt（对齐 nofx buildGridUserPromptEn） ==========

function buildGridUserPromptEn(ctx: GridContext): string {
  const lines: string[] = [];

  // Section 1: Market Data
  lines.push(`=== Market Data: ${ctx.symbol} ===`);
  lines.push(`Current Price: ${ctx.currentPrice}`);
  lines.push(`Time: ${ctx.currentTime}`);
  lines.push(`1H Change: ${ctx.priceChange1h > 0 ? '+' : ''}${ctx.priceChange1h.toFixed(2)}%`);
  const p4h = ctx.priceChange4hReal ?? ctx.priceChange4h;
  lines.push(`4H Change: ${p4h > 0 ? '+' : ''}${p4h.toFixed(2)}%`);
  if (ctx.high24h !== undefined && ctx.low24h !== undefined && ctx.high24h > 0) {
    lines.push(`24h High: ${ctx.high24h} | 24h Low: ${ctx.low24h}`);
  }
  lines.push(`24h Volume: ${ctx.volume24h.toLocaleString()}`);
  lines.push(`Funding Rate: ${(ctx.fundingRate * 100).toFixed(4)}%`);

  // Section 2: Technical Indicators
  lines.push('');
  lines.push('--- Technical Indicators ---');
  lines.push(`RSI(14)[5m]: ${ctx.rsi14.toFixed(1)}${ctx.rsi7 !== undefined ? ` | RSI(7)[5m]: ${ctx.rsi7.toFixed(1)}` : ''}`);
  lines.push(`MACD[5m]: ${ctx.macd.toFixed(4)} | Signal: ${ctx.macdSignal.toFixed(4)} | Histogram: ${ctx.macdHistogram.toFixed(4)}`);
  lines.push(`EMA(20)[1h]: ${ctx.ema20.toFixed(2)} | EMA(50)[1h]: ${ctx.ema50.toFixed(2)} | Distance: ${ctx.emaDistance.toFixed(2)}%`);
  lines.push(`ATR(14)[5m]: ${ctx.atr14.toFixed(4)}${ctx.atrHourly !== undefined ? ` | ATR(14)[1h]: ${ctx.atrHourly.toFixed(4)}` : ''}${ctx.atr4h !== undefined ? ` | ATR(14)[4h]: ${ctx.atr4h.toFixed(4)}` : ''}${ctx.atr3 !== undefined ? ` | ATR(3)[5m]: ${ctx.atr3.toFixed(4)}` : ''}`);
  if (ctx.rsi4h !== undefined) {
    lines.push(`4h Indicators: RSI=${ctx.rsi4h.toFixed(1)}${ctx.macd4h !== undefined ? ` | MACD=${ctx.macd4h.toFixed(4)}` : ''}${ctx.ema20_4h !== undefined ? ` | EMA20=${ctx.ema20_4h.toFixed(2)}` : ''}${ctx.ema50_4h !== undefined ? ` | EMA50=${ctx.ema50_4h.toFixed(2)}` : ''}`);
  }
  lines.push(`Bollinger[1h]: ${ctx.bollingerLower.toFixed(2)} / ${ctx.bollingerMiddle.toFixed(2)} / ${ctx.bollingerUpper.toFixed(2)} (Width: ${ctx.bollingerWidth.toFixed(2)}%)`);
  if (ctx.rsiDivergenceType && ctx.rsiDivergenceType !== 'none') {
    lines.push(`RSI Divergence: ${ctx.rsiDivergenceType === 'bullish' ? 'Bullish' : 'Bearish'}`);
  }
  if (ctx.currentRegime) {
    const regimeLabelEn: Record<string, string> = { ultra_narrow: 'ultra-narrow range', narrow: 'narrow range', standard: 'standard', wide: 'wide range', volatile: 'high volatility' };
    lines.push(`Market Regime: ${regimeLabelEn[ctx.currentRegime] ?? ctx.currentRegime}`);
  }
  lines.push(`Margin Used: ${ctx.marginUsedPct.toFixed(1)}%`);

  // Section 3: Box Data (Donchian Channels)
  if (ctx.boxData) {
    lines.push('');
    lines.push('--- Donchian Channel Boxes ---');
    lines.push(`Short (3d): ${ctx.boxData.shortLower.toFixed(2)} ~ ${ctx.boxData.shortUpper.toFixed(2)}`);
    lines.push(`Mid (10d): ${ctx.boxData.midLower.toFixed(2)} ~ ${ctx.boxData.midUpper.toFixed(2)}`);
    lines.push(`Long (21d): ${ctx.boxData.longLower.toFixed(2)} ~ ${ctx.boxData.longUpper.toFixed(2)}`);
    if (ctx.currentPrice > ctx.boxData.longUpper || ctx.currentPrice < ctx.boxData.longLower) {
      lines.push('⚠️ BREAKOUT: Price outside long-term box!');
    } else if (ctx.currentPrice > ctx.boxData.midUpper || ctx.currentPrice < ctx.boxData.midLower) {
      lines.push('⚠️ NOTICE: Price has broken mid-term box (between mid and long-term range)');
    }
  }

  // Section 4: Grid Status
  lines.push('');
  lines.push('--- Grid Status ---');
  lines.push(`Range: ${ctx.lowerPrice.toFixed(2)} ~ ${ctx.upperPrice.toFixed(2)} | Spacing: ${ctx.gridSpacing.toFixed(4)}`);
  const dirExplainEn: Record<string, string> = {
    neutral:    'Neutral (50% buy + 50% sell)',
    long_bias:  'Long Bias (70% buy + 30% sell)',
    short_bias: 'Short Bias (30% buy + 70% sell)',
    long:       'Long (100% buy)',
    short:      'Short (100% sell)',
  };
  const dirNoteEn = dirExplainEn[ctx.currentDirection] ?? ctx.currentDirection;
  lines.push(`Distribution: ${ctx.distribution} | Direction: ${ctx.currentDirection} (${dirNoteEn})`);
  lines.push(`DirAdjust: ${ctx.enableDirectionAdjust ? 'enabled (box breakout→auto-shift)' : 'disabled (breakout→pause/reduce)'}`);
  const _exchOrderCountEn = ctx.exchangeOpenOrders?.length ?? 0;
  const _mappedOrderCountEn = ctx.activeOrderCount;
  const _unmappedCountEn = ctx.unmappedOrderIds?.length ?? 0;
  const pauseStrEn = ctx.isPaused
    ? `Yes [source:${ctx.pauseSource ?? 'unknown'}${ctx.pauseReason ? ` | reason:${ctx.pauseReason}` : ''}]`
    : 'No';
  lines.push(`Exchange Orders: ${_exchOrderCountEn} | Mapped: ${_mappedOrderCountEn} | Filled: ${ctx.filledLevelCount} | Paused: ${pauseStrEn}`);
  if (_unmappedCountEn > 0) {
    lines.push(`⚠️ ${_unmappedCountEn} order(s) have no corresponding empty level in current mapping (may be due to position occupying that price):`);
    for (const oid of ctx.unmappedOrderIds!) {
      const matchOrder = ctx.exchangeOpenOrders?.find(o => o.orderId === oid);
      if (matchOrder) {
        lines.push(`  - orderId: ${oid} (${matchOrder.side} @${matchOrder.price.toFixed(2)} x${matchOrder.quantity})`);
      } else {
        lines.push(`  - orderId: ${oid}`);
      }
    }
  }
  if (ctx.positionReductionPct && ctx.positionReductionPct > 0) {
    lines.push(`⚠️ Position Reduction: each level capped at ${100 - ctx.positionReductionPct}% of normal qty. adjust_grid clears immediately.`);
  }
  const _exchLongEn = ctx.positionLong?.quantity ?? 0;
  const _exchShortEn = ctx.positionShort?.quantity ?? 0;
  lines.push(`Exchange Position: Long ${_exchLongEn.toFixed(4)} | Short ${_exchShortEn.toFixed(4)}`);
  lines.push(`userLockedRange: ${ctx.userLockedRange ? 'true (adjust_grid will use user-configured % bounds)' : 'false'}`);
  if (ctx.upperBoundPct && ctx.lowerBoundPct) {
    lines.push(`⚙️ User Grid Bounds Config: upper +${ctx.upperBoundPct}% / lower -${ctx.lowerBoundPct}% (adjust_grid will use this %, NOT ATR)`);
  } else {
    lines.push(`⚙️ User Grid Bounds Config: not set (adjust_grid will use ATR auto-calculation)`);
  }
  if (ctx.stopLossPct !== undefined && ctx.stopLossPct > 0) {
    lines.push(`Per-level Stop Loss: ${ctx.stopLossPct}%`);
  }
  if (ctx.profitTargetPct !== undefined && ctx.profitTargetPct > 0) {
    lines.push(`Profit Target: ${ctx.profitTargetPct}%`);
  }
  // Section 5: Grid Levels Table
  lines.push('');
  lines.push('--- Grid Levels ---');
  lines.push('Level | Price | Direction | Qty | Position | State | PnL | OrderID');
  for (let i = 0; i < ctx.levels.length; i++) {
    lines.push(buildLevelRow(ctx.levels[i], i, ctx, true));
  }
  // Level status summary
  const emptyLevelsEn = ctx.levels.map((l, i) => ({ l, i })).filter(({ l }) => l.state === 'empty').map(({ i }) => `L${i + 1}`);
  const filledLevelsEn = ctx.levels.map((l, i) => ({ l, i })).filter(({ l }) => l.state === 'filled').map(({ l, i }) => `L${i + 1}(${l.side === 'buy' ? 'long' : 'short'})`);
  const pendingLevelsEn = ctx.levels.map((l, i) => ({ l, i })).filter(({ l }) => l.state === 'pending').map(({ i }) => `L${i + 1}`);
  lines.push(`Empty: ${emptyLevelsEn.length > 0 ? emptyLevelsEn.join(', ') : 'None'}`);
  lines.push(`Filled: ${filledLevelsEn.length > 0 ? filledLevelsEn.join(', ') : 'None'}`);
  lines.push(`Pending: ${pendingLevelsEn.length > 0 ? pendingLevelsEn.join(', ') : 'None'}`);

  // Section 6: Account Status
  lines.push('');
  lines.push('--- Account Status ---');
  lines.push(`Total Equity: ${ctx.totalEquity.toFixed(2)} USDT`);
  lines.push(`Available Margin: ${ctx.availableBalance.toFixed(2)} USDT`);
  if (ctx.positionLong || ctx.positionShort) {
    lines.push(ctx.positionLong ? buildPositionLine(ctx.positionLong, 'Long', true) : 'Long: None');
    lines.push(ctx.positionShort ? buildPositionLine(ctx.positionShort, 'Short', true) : 'Short: None');
    if (ctx.positionLong) lines.push(`avgEntry (long avg price): ${ctx.positionLong.entryPrice.toFixed(4)} — all filled levels reference this entry`);
    if (ctx.positionShort) lines.push(`avgEntry (short avg price): ${ctx.positionShort.entryPrice.toFixed(4)} — all filled levels reference this entry`);
  } else {
    lines.push(`Current Position: ${ctx.currentPosition > 0 ? '+' : ''}${ctx.currentPosition.toFixed(4)}`);
  }
  lines.push(`Unrealized PnL: ${ctx.unrealizedPnl > 0 ? '+' : ''}${ctx.unrealizedPnl.toFixed(2)} USDT`);

  // Section 7: Performance
  lines.push('');
  lines.push('--- Performance ---');
  lines.push(`Total PnL: ${ctx.totalProfit > 0 ? '+' : ''}${ctx.totalProfit.toFixed(2)} USDT`);
  lines.push(`Daily PnL: ${ctx.dailyPnl > 0 ? '+' : ''}${ctx.dailyPnl.toFixed(2)} USDT`);
  const winRateEn = ctx.totalTrades > 0 ? ((ctx.winningTrades / ctx.totalTrades) * 100).toFixed(1) : '0.0';
  lines.push(`Trades: ${ctx.totalTrades} | Win Rate: ${winRateEn}%`);
  lines.push(`Max Drawdown: ${ctx.maxDrawdown.toFixed(2)}%`);

  // Section 8: Strategy Profit Status
  lines.push('');
  lines.push('--- Strategy Profit Status ---');
  lines.push(`Start Equity: ${ctx.startEquity.toFixed(2)} USDT`);
  lines.push(`Current Profit: ${ctx.currentProfitPct >= 0 ? '+' : ''}${ctx.currentProfitPct.toFixed(2)}%`);
  if (ctx.oiChange1h !== undefined && ctx.oiChange1h !== 0) {
    lines.push(`OI Change (1H): ${ctx.oiChange1h >= 0 ? '+' : ''}${ctx.oiChange1h.toFixed(2)}%`);
  }
  // Section 9-11: Candles + Orders + Closed Trades
  lines.push(...buildOhlcvSection(ctx, true));
  lines.push(...buildOrdersSection(ctx, true));

  // Last cycle actions summary (prevent AI decision oscillation)
  if (ctx.lastCycleActions && ctx.lastCycleActions.length > 0) {
    lines.push('');
    lines.push('--- Last Cycle Actions ---');
    for (const a of ctx.lastCycleActions) {
      lines.push(`- ${a}`);
    }
  }

  lines.push('');
  lines.push('Analyze the data above and output your grid trading decisions (JSON array).');

  const langReminder = buildUserMessageLanguageReminder(ctx.locale);
  if (langReminder) lines.push(langReminder);

  return lines.join('\n');
}

// ==================== 角色辩论提示词（共识策略专用） ====================
//
// 与 research-prompts.ts 的区别：
// - research-prompts：基于分析师报告（后处理），400-600字，研究员身份
// - 本处：直接分析原始 OHLCV+指标数据，150-200字，交易员身份

/**
 * 多头研究员 — 寻找涨势机会
 */
const BULL_TRADING_PROMPT = `You are 🐂 BULL RESEARCHER (多头研究员).

Your mandate: Find LONG opportunities from raw market data.

Signal framework (require ≥2 for conviction):
- Price holding support / EMA(7) > EMA(25) > EMA(99) bullish stack
- RSI recovering from oversold (30-55 range, momentum building upward)
- OI increasing + price increasing (new longs entering, genuine demand)
- Funding rate negative or neutral (shorts dominant = short squeeze fuel)

Decision rules:
- ≥2 signals confirmed → lean open_long with confidence 65-85
- Only 1 signal → caution, lower confidence or output wait
- 0 signals or contradicting → output wait (patience generates alpha)
- NEVER force a long if signals are absent

Always cite specific indicator values (e.g., EMA7=42150>EMA25=41800, RSI=38↑).
Output in JSON voting format as instructed.`;

/**
 * 空头研究员 — 寻找下行风险
 */
const BEAR_TRADING_PROMPT = `You are 🐻 BEAR RESEARCHER (空头研究员).

Your mandate: Identify DOWNSIDE risks and SHORT opportunities from raw market data.

Signal framework (require ≥2 for conviction):
- Price rejected at resistance / EMA(7) < EMA(25) < EMA(99) bearish stack
- RSI declining from overbought (70→55 range, exhaustion visible)
- OI increasing + price decreasing (new shorts entering, genuine selling)
- Funding rate extreme positive (longs crowded = liquidation cascade risk)

Decision rules:
- ≥2 signals confirmed → lean open_short with confidence 65-85
- Only 1 signal → caution, lower confidence or output wait
- 0 signals or contradicting → output wait (do not force a short)
- NEVER force a short if signals are absent

Always cite specific indicator values.
Output in JSON voting format as instructed.`;

/**
 * 技术分析师 — 中立四维分析
 */
const ANALYST_TRADING_PROMPT = `You are 📊 TECHNICAL ANALYST (技术分析师).

Your mandate: Neutral 4-dimension technical analysis of raw market data. No directional bias.

Analyze all 4 dimensions:
1. TREND: EMA alignment (7/25/99), Donchian channel position
2. MOMENTUM: RSI(14) level + direction, MACD histogram sign + slope
3. VOLATILITY: ATR(3)/ATR(14) ratio — >2.0 elevated, >3.0 extreme (forbid entry)
4. VOLUME/FLOW: OI trend + funding rate direction + taker flow

Convergence rules:
- ≥3 dimensions agree on direction → output that action, confidence 65-80
- 2 dimensions agree, 2 disagree → CONFLICTING signals, output wait confidence 30-50
- All 4 agree → high conviction, confidence 80-90

CRITICAL: ATR ratio >3.0 → output wait regardless of other signals (extreme volatility).
Always cite all 4 dimensions with specific numeric values.
Output in JSON voting format as instructed.`;

/**
 * 逆向分析师 — 挑战共识（有证据时）
 */
const CONTRARIAN_TRADING_PROMPT = `You are 🔄 CONTRARIAN ANALYST (逆向分析师).

Your mandate: Challenge consensus ONLY when 3 specific conditions are ALL met simultaneously. Otherwise support the consensus to avoid noise.

The 3-condition contrarian trigger (ALL must be true simultaneously):
1. EXTREME FUNDING RATE: |funding rate| > 0.1%/8h (extreme directional crowding)
2. EXTREME RSI: RSI > 78 (overbought extreme) OR RSI < 22 (oversold extreme)
3. OI DIVERGENCE: OI decreasing while price moves in consensus direction (smart money unwinding)

Decision rules:
- ALL 3 conditions met → output OPPOSITE of market consensus, confidence 60-75
- 2 conditions met → partial signal, reduce confidence, suggest smaller size
- <2 conditions → explicitly state "No contrarian edge" then output wait or support consensus

Anti-echo-chamber duty: Actively look for the crowded-trade trap. But NEVER invent contrarian signals—stick to the 3-condition framework only.
Output in JSON voting format as instructed.`;

/**
 * 风控管理员 — 资本保护 + 否决权
 */
const RISK_MANAGER_TRADING_PROMPT = `You are 🛡️ RISK MANAGER (风控管理员).

Your mandate: Capital protection and risk gate. Evaluate R:R ratio, sizing, and volatility before endorsing any trade.

Gate checklist (ANY failure → recommend wait or reduce):
1. R:R RATIO: (take_profit - entry) / (entry - stop_loss) must be ≥ 2.0. R:R < 2.0 → output wait.
2. ATR VOLATILITY: ATR(3)/ATR(14) > 3.0 → extreme volatility gate, output wait.
3. SL DIRECTION: Long SL must be BELOW entry. Short SL must be ABOVE entry.
4. FUNDING COST: |funding rate| > 0.15%/8h → dangerous holding cost, reduce position size.

Position sizing guidance by ATR ratio:
- ATR ratio 1.0-1.5: standard sizing (positionSizePercent 10-15%)
- ATR ratio 1.5-2.5: reduced sizing (positionSizePercent 5-10%)
- ATR ratio >2.5: minimal sizing (positionSizePercent 3-5%) or wait

Defaults when not specified: stop_loss = 0.03 (3%), take_profit = 0.06 (6%) → R:R = 2.0 minimum.

If all checks pass: endorse the trade with validated SL/TP/sizing parameters.
If ANY gate fails: output wait with specific reason and which gate failed.
Output in JSON voting format as instructed.`;

/**
 * 构建共识策略（角色辩论）专用提示词映射
 *
 * 直接分析原始 OHLCV + 指标数据，无需预研报告
 * 适合 skipJudge=true 的多轮投票辩论
 */
export function buildTradingRolePrompts(): Partial<Record<string, string>> {
  return {
    bull: BULL_TRADING_PROMPT,
    bear: BEAR_TRADING_PROMPT,
    analyst: ANALYST_TRADING_PROMPT,
    contrarian: CONTRARIAN_TRADING_PROMPT,
    risk_manager: RISK_MANAGER_TRADING_PROMPT,
  };
}

