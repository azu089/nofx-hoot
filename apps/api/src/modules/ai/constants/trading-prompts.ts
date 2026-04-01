/**
 * 交易模式 — AI 提示词与格式化工具
 *
 * 包含:
 * - 市场数据格式化 (formatMarketDataPrompt)
 * - 安全警告格式化 (formatSafetyWarnings)
 * - 进化 Tier 提示 (EVOLUTION_TIER_PROMPTS)
 * - 网格交易 AI 提示词 (GRID_SYSTEM_PROMPT, buildGridUserPrompt)
 *
 * 注意: 极速策略的系统提示由 PromptBuilderService 8-section 构建
 * 辩论/投票相关提示词在 research-prompts.ts
 */

import { AIRole, AI_ROLES, ANALYSIS_OUTPUT_FORMAT, buildAnalysisOutputFormat } from './models';
import { buildLanguageInstruction, buildUserMessageLanguageReminder } from './locale-instructions';
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
  existingPositions?: Array<{ side: string; entryPrice: number; quantity: number; pnlPercent: number; peakPnlPercent?: number }>;
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
  // 动态精度：低价币（如 1000PEPE $0.003）需要更多小数位
  const price = data.currentPrice;
  const priceDp = price >= 1 ? 2 : price >= 0.01 ? 4 : price >= 0.0001 ? 6 : 8; // 价格小数位
  const indDp = price >= 1 ? 2 : price >= 0.01 ? 4 : price >= 0.0001 ? 6 : 8;   // 指标小数位（EMA/Donchian 与价格同量级）
  const atrDp = price >= 1 ? 4 : price >= 0.01 ? 6 : 8;                          // ATR 通常更小
  const fp = (v: number, dp: number) => v.toFixed(dp);                            // format helper

  const lines: string[] = [
    `=== MARKET DATA: ${data.symbol} ===`,
    `Current Price: ${fp(price, priceDp)}`,
  ];

  if (data.change24h !== undefined) {
    lines.push(`24h Change: ${data.change24h > 0 ? '+' : ''}${data.change24h.toFixed(2)}%`);
  }
  if (data.volume24h !== undefined && data.currentPrice) {
    // OHLCV volume 是基础资产数量（如 BTC），需乘以当前价格转换为 USDT 计价
    const vol = data.volume24h * data.currentPrice;
    const volDisplay = vol >= 1e9 ? `$${(vol / 1e9).toFixed(2)}B` : vol >= 1e6 ? `$${(vol / 1e6).toFixed(0)}M` : `$${vol.toFixed(0)}`;
    lines.push(`24h Volume: ${volDisplay} USDT`);
  }

  // 技术指标
  if (data.indicators) {
    lines.push('', '--- Technical Indicators ---');
    const ind = data.indicators;
    if (ind.rsi7 !== undefined) lines.push(`RSI(7): ${ind.rsi7.toFixed(1)}`);
    if (ind.rsi14 !== undefined) lines.push(`RSI(14): ${ind.rsi14.toFixed(1)}`);
    if (ind.macd !== undefined) {
      lines.push(`MACD Line: ${fp(ind.macd, atrDp)}`);
      if (ind.macdSignal !== undefined) lines.push(`MACD Signal: ${fp(ind.macdSignal, atrDp)}`);
      if (ind.macdHistogram !== undefined) lines.push(`MACD Histogram: ${fp(ind.macdHistogram, atrDp)}`);
    }
    if (ind.ema7 !== undefined) lines.push(`EMA(7): ${fp(ind.ema7, indDp)}`);
    if (ind.ema25 !== undefined) lines.push(`EMA(25): ${fp(ind.ema25, indDp)}`);
    if (ind.ema99 !== undefined) lines.push(`EMA(99): ${fp(ind.ema99, indDp)}`);
    if (ind.atr3 !== undefined) lines.push(`ATR(3): ${fp(ind.atr3, atrDp)}`);
    if (ind.atr14 !== undefined) lines.push(`ATR(14): ${fp(ind.atr14, atrDp)}`);
    if (ind.atr3 !== undefined && ind.atr14 !== undefined && ind.atr14 > 0) {
      const ratio = ind.atr3 / ind.atr14;
      lines.push(`ATR Ratio (3/14): ${ratio.toFixed(2)} ${ratio > 2.0 ? '⚠ HIGH VOLATILITY' : ratio > 1.5 ? '⚡ ELEVATED' : '✓ NORMAL'}`);
    }
    if (ind.donchianUpper !== undefined) {
      lines.push(`唐奇安上轨(Donchian Upper): ${fp(ind.donchianUpper, indDp)}`);
      lines.push(`唐奇安中轨(Donchian Mid): ${ind.donchianMid != null ? fp(ind.donchianMid, indDp) : 'N/A'}`);
      lines.push(`唐奇安下轨(Donchian Lower): ${ind.donchianLower != null ? fp(ind.donchianLower, indDp) : 'N/A'}`);
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
      // openInterest 是合约张数（contracts），schema 定义单位是 USDT
      // 用合约量 × 当前价格换算 USD，保持与 OI Trend 段（USD 计价）一致
      const oiUsd = data.openInterest * price;
      const oiDisplay = oiUsd >= 1e9 ? `$${(oiUsd / 1e9).toFixed(2)}B` : oiUsd >= 1e6 ? `$${(oiUsd / 1e6).toFixed(0)}M` : `$${oiUsd.toFixed(0)}`;
      lines.push(`Open Interest: ${oiDisplay} (${data.openInterest.toFixed(0)} contracts)`);
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
    // OI 排名（openInterest 已统一为 USD 计价，动态显示 B/M）
    if (r.topOI && r.topOI.length > 0) {
      lines.push('Top OI: ' + r.topOI
        .map(o => {
          const v = o.openInterest;
          const display = v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` : `$${v.toFixed(0)}`;
          return `${o.symbol.split('/')[0]} ${display}`;
        })
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
      lines.push(`Max Pain: $${opt.maxPainPrice.toLocaleString()} | IV: ${opt.impliedVolatility.toFixed(1)}%`);
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

    // 宏观经济（仅显示有效值，0 表示获取失败）
    if (enh.macroData) {
      const m = enh.macroData;
      const parts: string[] = [];
      if (m.fedFundsRate > 0) parts.push(`Fed Rate: ${m.fedFundsRate.toFixed(2)}%`);
      if (m.cpiYoY > 0) parts.push(`CPI: ${m.cpiYoY.toFixed(1)}%`);
      if (m.yieldCurveSpread !== 0) parts.push(`10Y-2Y: ${m.yieldCurveSpread > 0 ? '+' : ''}${m.yieldCurveSpread.toFixed(2)}%`);
      if (m.vix > 0) parts.push(`VIX: ${m.vix.toFixed(1)}`);
      if (parts.length > 0) {
        lines.push('', '--- Macro Context ---');
        lines.push(parts.join(' | '));
      }
    }

    // CFTC COT
    if (enh.cotReport) {
      const cot = enh.cotReport;
      lines.push('', '--- Institutional (COT) ---');
      lines.push(`BTC CME Net Speculative: ${cot.btcNetSpeculative > 0 ? '+' : ''}${cot.btcNetSpeculative.toLocaleString()} contracts (${cot.reportDate})`);
    }
  }

  // 现有持仓已在 prompt-builder.service.ts [5] Current Positions 段统一展示
  // 此处不再重复，避免 "No open positions" 与 Current Positions 矛盾误导 AI

  // K-line 分析摘要：预计算关键形态，替代原始 OHLCV 表格（LLM 无法从数字表中识别形态）
  if (data.ohlcv && data.ohlcv.length > 0) {
    const summary = computeKlineSummary(data.ohlcv.slice(-30), priceDp);
    if (summary) {
      lines.push('', summary);
    }
  }

  return lines.join('\n');
}

// ==================== K-line 摘要预计算 ====================

/**
 * 从 K-line 原始数据预计算关键形态摘要（替代原始 OHLCV 数字表格）
 *
 * LLM 无法从 30 行数字中识别价格形态，但可以理解文字描述的：
 * - 支撑/阻力位
 * - 连续涨跌趋势
 * - 成交量异常
 * - 关键K线形态（锤子线/十字星/吞没）
 * - 波动范围
 */
export function computeKlineSummary(
  candles: Array<{ open: number; high: number; low: number; close: number; volume: number }>,
  priceDp: number = 2,
): string | null {
  if (!candles || candles.length < 5) return null;
  const fp = (v: number) => v.toFixed(priceDp);
  const lines: string[] = [`--- K-line Analysis (${candles.length} bars) ---`];

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume || 0);
  const latest = candles[candles.length - 1];

  // 1. 价格范围 & 当前位置
  const rangeHigh = Math.max(...highs);
  const rangeLow = Math.min(...lows);
  const rangeWidth = rangeHigh - rangeLow;
  const posInRange = rangeWidth > 0 ? ((latest.close - rangeLow) / rangeWidth * 100).toFixed(0) : '50';
  lines.push(`Range: ${fp(rangeLow)} — ${fp(rangeHigh)} | Current at ${posInRange}% of range`);

  // 2. 支撑/阻力位（简化：近期高低点聚集区）
  // 取最近 10 根 K 线的低点作为支撑参考，高点作为阻力参考
  const recent10 = candles.slice(-10);
  const recentLows = recent10.map(c => c.low).sort((a, b) => a - b);
  const recentHighs = recent10.map(c => c.high).sort((a, b) => b - a);
  // 支撑：最近低点的中位数
  const support = recentLows[Math.floor(recentLows.length / 3)]; // 下 1/3 位
  // 阻力：最近高点的中位数
  const resistance = recentHighs[Math.floor(recentHighs.length / 3)]; // 上 1/3 位
  lines.push(`Support zone: ~${fp(support)} | Resistance zone: ~${fp(resistance)}`);

  // 3. 连续涨跌趋势
  let streak = 0;
  const lastDir = latest.close >= latest.open ? 'bullish' : 'bearish';
  for (let i = candles.length - 1; i >= 0; i--) {
    const c = candles[i];
    const isBull = c.close >= c.open;
    if ((lastDir === 'bullish' && isBull) || (lastDir === 'bearish' && !isBull)) {
      streak++;
    } else break;
  }
  if (streak >= 3) {
    lines.push(`Trend: ${streak} consecutive ${lastDir} bars`);
  }

  // 4. 成交量异常检测
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const lastVol = volumes[volumes.length - 1];
  const prevVol = volumes.length >= 2 ? volumes[volumes.length - 2] : avgVol;
  if (avgVol > 0) {
    const volRatio = lastVol / avgVol;
    if (volRatio > 2.0) {
      lines.push(`Volume: SPIKE ${volRatio.toFixed(1)}x average (${lastVol > prevVol ? 'increasing' : 'decreasing'} price action)`);
    } else if (volRatio > 1.5) {
      lines.push(`Volume: Above average ${volRatio.toFixed(1)}x`);
    } else if (volRatio < 0.5) {
      lines.push(`Volume: LOW ${volRatio.toFixed(1)}x average (weak conviction)`);
    }
  }

  // 5. 最近 3 根 K 线形态
  const patterns: string[] = [];
  for (let i = Math.max(0, candles.length - 3); i < candles.length; i++) {
    const c = candles[i];
    const body = Math.abs(c.close - c.open);
    const fullRange = c.high - c.low;
    if (fullRange === 0) continue;
    const bodyRatio = body / fullRange;
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    // 十字星：body < 10% of range
    if (bodyRatio < 0.1) {
      patterns.push('Doji (indecision)');
    }
    // 锤子线：下影线 > 2x body，上影线小
    else if (lowerWick > body * 2 && upperWick < body * 0.5) {
      patterns.push(c.close > c.open ? 'Hammer (bullish reversal)' : 'Hanging Man (bearish warning)');
    }
    // 射击之星：上影线 > 2x body，下影线小
    else if (upperWick > body * 2 && lowerWick < body * 0.5) {
      patterns.push('Shooting Star (bearish reversal)');
    }
    // 大阳线/大阴线：body > 70% of range
    else if (bodyRatio > 0.7) {
      patterns.push(c.close > c.open ? 'Strong bullish bar' : 'Strong bearish bar');
    }
  }

  // 吞没形态：最后两根
  if (candles.length >= 2) {
    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];
    if (prev.close < prev.open && curr.close > curr.open && curr.close > prev.open && curr.open < prev.close) {
      patterns.push('Bullish Engulfing');
    } else if (prev.close > prev.open && curr.close < curr.open && curr.close < prev.open && curr.open > prev.close) {
      patterns.push('Bearish Engulfing');
    }
  }

  if (patterns.length > 0) {
    lines.push(`Patterns: ${[...new Set(patterns)].join(', ')}`);
  }

  // 6. 价格动量（最近 5 根 vs 前 5 根平均价）
  if (candles.length >= 10) {
    const recent5Avg = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const prev5Avg = closes.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;
    if (prev5Avg > 0) {
      const momentum = ((recent5Avg - prev5Avg) / prev5Avg * 100);
      const dir = momentum > 0 ? 'accelerating up' : 'decelerating down';
      lines.push(`Momentum (5-bar): ${momentum > 0 ? '+' : ''}${momentum.toFixed(2)}% (${dir})`);
    }
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

// QUICK_MODE_SYSTEM_PROMPT 已删除（极速策略由 PromptBuilderService 8-section 构建）

// ==================== 进化 Tier 提示模板 ====================

export const EVOLUTION_TIER_PROMPTS: Record<number, string> = {
  0: '', // Tier 0: 暂停，不应运行
  1: '=== EVOLUTION CONTEXT ===\nRecent trading performance is POOR (Sharpe Ratio: {sharpe}). Trade CONSERVATIVELY:\n- Prefer "hold" or "wait" unless signals are extremely clear\n- Require confidence ≥ 80 for any open action\n- Reduce suggested position sizes by 50%\n- Prioritize capital preservation over profit',
  2: '=== EVOLUTION CONTEXT ===\nTrading performance is NORMAL (Sharpe Ratio: {sharpe}). Trade with standard parameters.\n- Follow standard confidence thresholds\n- Standard position sizing applies',
  3: '=== EVOLUTION CONTEXT ===\nRecent trading performance is EXCELLENT (Sharpe Ratio: {sharpe}). You may trade more aggressively:\n- Accept setups with confidence ≥ 55 (normally ≥ 65)\n- Allow slightly larger position sizes (up to 8% of portfolio)\n- Consider taking additional setups you would normally skip',
};

// 辩论角色提示词和投票格式已移至 research-prompts.ts

// 投票输出格式、投票 Prompt 构建已移至 research-prompts.ts

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
  marginUsedPct: number;       // 保证金使用率%（仅参考，位置价值比才是硬约束）
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
1. 判断当前市场状态（震荡/趋势）
2. 决定是否需要调整网格或暂停交易
3. 管理每个网格层级的订单（优先锁定持仓盈利）

## 网格配置
- 交易对: ${symbol}
- 网格层数: ${gridCount}
- 总投资: ${totalInvestment} USDT
- 杠杆: ${leverage}x
- 价格分布: ${distribution}

## 决策规则

### 市场状态判断
- **震荡市场** (适合网格): 布林带宽度 < 3%, EMA20/50 距离 < 1%, 价格在布林带中轨附近
- **趋势市场** (暂停网格): 布林带宽度 > 4%, EMA20/50 距离 > 2%, 价格持续突破布林带
- **高波动市场** (谨慎): ATR异常放大, 价格剧烈波动

### 可执行的操作
- place_buy_limit: 在指定价格下买入限价单
- place_sell_limit: 在指定价格下卖出限价单
- close_long: 平多仓
- close_short: 平空仓
- cancel_order: 取消指定订单
- cancel_all_orders: 取消所有订单
- pause_grid: 暂停网格交易（趋势市场时）
- resume_grid: 恢复网格交易（震荡市场时）
- adjust_grid: 调整网格边界
- hold: 保持当前状态不操作

### 暂停模式（isPaused=true）
暂停期间只能: close_long/close_short、cancel_order、resume_grid、adjust_grid、hold。
不可挂新单（place_buy/sell_limit）。

## 输出格式
输出JSON数组，每个决策包含:
- symbol: 交易对
- action: 操作类型
- price: 价格（限价单用）
- quantity: 数量
- level_index: 网格层级索引
- order_id: 订单ID（取消订单用）
- confidence: 置信度 0-100
- reasoning: 决策理由

示例:
[
  {"symbol": "${symbol}", "action": "place_buy_limit", "price": 94000, "quantity": 0.01, "level_index": 2, "confidence": 85, "reasoning": "第2层价格接近，下买单"},
  {"symbol": "${symbol}", "action": "hold", "confidence": 90, "reasoning": "市场震荡，保持当前网格"}
]
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
1. Assess current market state (ranging/trending)
2. Decide whether to adjust grid or pause trading
3. Manage orders at each grid level (prioritize locking in profits)

## Grid Configuration
- Symbol: ${symbol}
- Grid Levels: ${gridCount}
- Total Investment: ${totalInvestment} USDT
- Leverage: ${leverage}x
- Distribution: ${distribution}

## Decision Rules

### Market Regime Assessment
- **Ranging Market** (ideal for grid): Bollinger width < 3%, EMA20/50 distance < 1%, price near middle band
- **Trending Market** (pause grid): Bollinger width > 4%, EMA20/50 distance > 2%, price breaking bands
- **High Volatility** (caution): ATR spike, erratic price movement

### Available Actions
- place_buy_limit: Place buy limit order at specified price
- place_sell_limit: Place sell limit order at specified price
- close_long: Close long position
- close_short: Close short position
- cancel_order: Cancel specific order
- cancel_all_orders: Cancel all orders
- pause_grid: Pause grid trading (in trending market)
- resume_grid: Resume grid trading (in ranging market)
- adjust_grid: Adjust grid boundaries
- hold: Maintain current state

### Pause Mode (isPaused=true)
While paused, only: close_long/close_short, cancel_order, resume_grid, adjust_grid, hold.
Do NOT place new orders (place_buy/sell_limit).

## Output Format
Output JSON array, each decision contains:
- symbol: Trading pair
- action: Action type
- price: Price (for limit orders)
- quantity: Quantity
- level_index: Grid level index
- order_id: Order ID (for cancel)
- confidence: Confidence 0-100
- reasoning: Decision reason

Example:
[
  {"symbol": "${symbol}", "action": "place_buy_limit", "price": 94000, "quantity": 0.01, "level_index": 2, "confidence": 85, "reasoning": "Level 2 price approaching, place buy order"},
  {"symbol": "${symbol}", "action": "hold", "confidence": 90, "reasoning": "Market ranging, maintain current grid"}
]

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

/** 构建层级表行 — 对齐 nofx: | 层级 | 价格 | 状态 | 方向 | 订单数量 | 持仓数量 | 未实现盈亏 | */
function buildLevelRow(l: GridContext['levels'][0], i: number, ctx: GridContext, isEn: boolean): string {
  const pnl = l.profit ?? 0;
  return `| ${i + 1} | $${l.price.toFixed(2)} | ${l.state} | ${l.side} | ${l.quantity.toFixed(4)} | ${(l.positionSize ?? 0).toFixed(4)} | $${pnl.toFixed(2)} |`;
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

  // 对齐 nofx buildGridUserPromptZh（grid_engine.go:216-324）
  // 网格 AI 只看 nofx 定义的字段，极速策略专用数据不传入

  // Section 1: 市场数据
  lines.push(`## 当前时间: ${ctx.currentTime}`);
  lines.push('');
  lines.push('## 市场数据');
  lines.push(`- 当前价格: $${ctx.currentPrice}`);
  lines.push(`- 1小时涨跌: ${ctx.priceChange1h > 0 ? '+' : ''}${ctx.priceChange1h.toFixed(2)}%`);
  const p4h = ctx.priceChange4hReal ?? ctx.priceChange4h;
  lines.push(`- 4小时涨跌: ${p4h > 0 ? '+' : ''}${p4h.toFixed(2)}%`);
  lines.push(`- ATR14: $${ctx.atr14.toFixed(2)} (${(ctx.atr14 / ctx.currentPrice * 100).toFixed(2)}%)`);
  lines.push(`- 布林带: 上轨 $${ctx.bollingerUpper.toFixed(2)}, 中轨 $${ctx.bollingerMiddle.toFixed(2)}, 下轨 $${ctx.bollingerLower.toFixed(2)}`);
  lines.push(`- 布林带宽度: ${ctx.bollingerWidth.toFixed(2)}%`);
  lines.push(`- EMA20: $${ctx.ema20.toFixed(2)}, EMA50: $${ctx.ema50.toFixed(2)}, 距离: ${ctx.emaDistance.toFixed(2)}%`);
  lines.push(`- RSI14: ${ctx.rsi14.toFixed(1)}`);
  lines.push(`- MACD: ${ctx.macd.toFixed(4)}, Signal: ${ctx.macdSignal.toFixed(4)}, Histogram: ${ctx.macdHistogram.toFixed(4)}`);
  lines.push(`- 资金费率: ${(ctx.fundingRate * 100).toFixed(4)}%`);
  lines.push('');

  // Section 2: 箱体指标
  if (ctx.boxData) {
    lines.push('## 箱体指标 (唐奇安通道)');
    lines.push('');
    lines.push('| 箱体级别 | 上轨 | 下轨 |');
    lines.push('|----------|------|------|');
    lines.push(`| 短期 (3天) | ${ctx.boxData.shortUpper.toFixed(2)} | ${ctx.boxData.shortLower.toFixed(2)} |`);
    lines.push(`| 中期 (10天) | ${ctx.boxData.midUpper.toFixed(2)} | ${ctx.boxData.midLower.toFixed(2)} |`);
    lines.push(`| 长期 (21天) | ${ctx.boxData.longUpper.toFixed(2)} | ${ctx.boxData.longLower.toFixed(2)} |`);
    lines.push('');
    if (ctx.currentPrice > ctx.boxData.longUpper || ctx.currentPrice < ctx.boxData.longLower) {
      lines.push('⚠️ 突破: 价格突破长期箱体!');
    } else if (ctx.currentPrice > ctx.boxData.midUpper || ctx.currentPrice < ctx.boxData.midLower) {
      lines.push('⚠️ 警告: 价格接近长期箱体边界');
    }
    lines.push('');
  }

  // Section 3: 账户状态
  lines.push('## 账户状态');
  lines.push(`- 总权益: $${ctx.totalEquity.toFixed(2)}`);
  lines.push(`- 可用余额: $${ctx.availableBalance.toFixed(2)}`);
  lines.push(`- 当前持仓: ${ctx.currentPosition.toFixed(4)} (净头寸)`);
  lines.push(`- 未实现盈亏: $${ctx.unrealizedPnl.toFixed(2)}`);
  lines.push('');

  // Section 4: 网格状态
  lines.push('## 网格状态');
  lines.push(`- 网格范围: $${ctx.lowerPrice.toFixed(2)} - $${ctx.upperPrice.toFixed(2)}`);
  lines.push(`- 网格间距: $${ctx.gridSpacing.toFixed(2)}`);
  lines.push(`- 活跃订单数: ${ctx.activeOrderCount}`);
  lines.push(`- 已成交层数: ${ctx.filledLevelCount}`);
  lines.push(`- 网格已暂停: ${ctx.isPaused}`);
  if (ctx.currentDirection) {
    const dirExplain: Record<string, string> = {
      neutral: '中性 (50%买+50%卖)', long_bias: '偏多 (70%买+30%卖)',
      short_bias: '偏空 (30%买+70%卖)', long: '做多 (100%买)', short: '做空 (100%卖)',
    };
    lines.push(`- 网格方向: ${dirExplain[ctx.currentDirection] ?? ctx.currentDirection}`);
  }
  lines.push('');

  // Section 5: 网格层级详情
  lines.push('## 网格层级详情');
  lines.push('| 层级 | 价格 | 状态 | 方向 | 订单数量 | 持仓数量 | 未实现盈亏 |');
  lines.push('|------|------|------|------|----------|----------|------------|');
  for (let i = 0; i < ctx.levels.length; i++) {
    lines.push(buildLevelRow(ctx.levels[i], i, ctx, false));
  }
  lines.push('');

  // Section 6: 绩效统计
  lines.push('## 绩效统计');
  lines.push(`- 总利润: $${ctx.totalProfit.toFixed(2)}`);
  lines.push(`- 总交易次数: ${ctx.totalTrades}`);
  const winRate = ctx.totalTrades > 0 ? ((ctx.winningTrades / ctx.totalTrades) * 100).toFixed(1) : '0.0';
  lines.push(`- 胜率: ${winRate}%`);
  lines.push(`- 最大回撤: ${ctx.maxDrawdown.toFixed(2)}%`);
  lines.push(`- 今日盈亏: $${ctx.dailyPnl.toFixed(2)}`);
  lines.push('');

  lines.push('## 请分析以上数据，做出网格交易决策');
  lines.push('输出JSON数组格式的决策列表。');
  return lines.join('\n');
}

// ========== 英文版 User Prompt（对齐 nofx buildGridUserPromptEn） ==========

function buildGridUserPromptEn(ctx: GridContext): string {
  const lines: string[] = [];

  // 对齐 nofx buildGridUserPromptEn（grid_engine.go:327-434）
  // 网格 AI 只看 nofx 定义的字段，极速策略专用数据不传入

  // Section 1: Market Data
  lines.push(`## Current Time: ${ctx.currentTime}`);
  lines.push('');
  lines.push('## Market Data');
  lines.push(`- Current Price: $${ctx.currentPrice}`);
  const p4hEn = ctx.priceChange4hReal ?? ctx.priceChange4h;
  lines.push(`- 1h Change: ${ctx.priceChange1h > 0 ? '+' : ''}${ctx.priceChange1h.toFixed(2)}%`);
  lines.push(`- 4h Change: ${p4hEn > 0 ? '+' : ''}${p4hEn.toFixed(2)}%`);
  lines.push(`- ATR14: $${ctx.atr14.toFixed(2)} (${(ctx.atr14 / ctx.currentPrice * 100).toFixed(2)}%)`);
  lines.push(`- Bollinger Bands: Upper $${ctx.bollingerUpper.toFixed(2)}, Middle $${ctx.bollingerMiddle.toFixed(2)}, Lower $${ctx.bollingerLower.toFixed(2)}`);
  lines.push(`- Bollinger Width: ${ctx.bollingerWidth.toFixed(2)}%`);
  lines.push(`- EMA20: $${ctx.ema20.toFixed(2)}, EMA50: $${ctx.ema50.toFixed(2)}, Distance: ${ctx.emaDistance.toFixed(2)}%`);
  lines.push(`- RSI14: ${ctx.rsi14.toFixed(1)}`);
  lines.push(`- MACD: ${ctx.macd.toFixed(4)}, Signal: ${ctx.macdSignal.toFixed(4)}, Histogram: ${ctx.macdHistogram.toFixed(4)}`);
  lines.push(`- Funding Rate: ${(ctx.fundingRate * 100).toFixed(4)}%`);
  lines.push('');

  // Section 2: Box Indicators
  if (ctx.boxData) {
    lines.push('## Box Indicators (Donchian Channels)');
    lines.push('');
    lines.push('| Box Level | Upper | Lower |');
    lines.push('|-----------|-------|-------|');
    lines.push(`| Short (3d) | ${ctx.boxData.shortUpper.toFixed(2)} | ${ctx.boxData.shortLower.toFixed(2)} |`);
    lines.push(`| Mid (10d) | ${ctx.boxData.midUpper.toFixed(2)} | ${ctx.boxData.midLower.toFixed(2)} |`);
    lines.push(`| Long (21d) | ${ctx.boxData.longUpper.toFixed(2)} | ${ctx.boxData.longLower.toFixed(2)} |`);
    lines.push('');
    if (ctx.currentPrice > ctx.boxData.longUpper || ctx.currentPrice < ctx.boxData.longLower) {
      lines.push('⚠️ BREAKOUT: Price outside long-term box!');
    } else if (ctx.currentPrice > ctx.boxData.midUpper || ctx.currentPrice < ctx.boxData.midLower) {
      lines.push('⚠️ WARNING: Price near long-term box boundary');
    }
    lines.push('');
  }

  // Section 3: Account Status
  lines.push('## Account Status');
  lines.push(`- Total Equity: $${ctx.totalEquity.toFixed(2)}`);
  lines.push(`- Available Balance: $${ctx.availableBalance.toFixed(2)}`);
  lines.push(`- Current Position: ${ctx.currentPosition.toFixed(4)} (net)`);
  lines.push(`- Unrealized PnL: $${ctx.unrealizedPnl.toFixed(2)}`);
  lines.push('');

  // Section 4: Grid Status
  lines.push('## Grid Status');
  lines.push(`- Grid Range: $${ctx.lowerPrice.toFixed(2)} - $${ctx.upperPrice.toFixed(2)}`);
  lines.push(`- Grid Spacing: $${ctx.gridSpacing.toFixed(2)}`);
  lines.push(`- Active Orders: ${ctx.activeOrderCount}`);
  lines.push(`- Filled Levels: ${ctx.filledLevelCount}`);
  lines.push(`- Grid Paused: ${ctx.isPaused}`);
  if (ctx.currentDirection) {
    const dirExplainEn: Record<string, string> = {
      neutral: 'Neutral (50% buy + 50% sell)', long_bias: 'Long Bias (70% buy + 30% sell)',
      short_bias: 'Short Bias (30% buy + 70% sell)', long: 'Long (100% buy)', short: 'Short (100% sell)',
    };
    lines.push(`- Grid Direction: ${dirExplainEn[ctx.currentDirection] ?? ctx.currentDirection}`);
  }
  lines.push('');

  // Section 5: Grid Levels Detail
  lines.push('## Grid Levels Detail');
  lines.push('| Level | Price | State | Side | Order Qty | Position | Unrealized PnL |');
  lines.push('|-------|-------|-------|------|-----------|----------|----------------|');
  for (let i = 0; i < ctx.levels.length; i++) {
    lines.push(buildLevelRow(ctx.levels[i], i, ctx, true));
  }
  lines.push('');

  // Section 6: Performance
  lines.push('## Performance');
  lines.push(`- Total Profit: $${ctx.totalProfit.toFixed(2)}`);
  lines.push(`- Total Trades: ${ctx.totalTrades}`);
  const winRateEn = ctx.totalTrades > 0 ? ((ctx.winningTrades / ctx.totalTrades) * 100).toFixed(1) : '0.0';
  lines.push(`- Win Rate: ${winRateEn}%`);
  lines.push(`- Max Drawdown: ${ctx.maxDrawdown.toFixed(2)}%`);
  lines.push(`- Daily PnL: $${ctx.dailyPnl.toFixed(2)}`);
  lines.push('');

  lines.push('## Analyze the data above and output your grid trading decisions');
  lines.push('Output JSON array format.');

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
1. R:R RATIO: take_profit / stop_loss must be ≥ 2.0 (e.g. TP=0.06 / SL=0.03 = 2.0). R:R < 2.0 → output wait.
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

// ============================================================================
// 备用路径 — 对齐 nofx kernel/prompt_builder.go
// ============================================================================
// nofx 有两套 prompt 构建：
//   主路径: engine.go BuildSystemPrompt() — 策略引擎配置驱动，当前生产使用
//   备用路径: prompt_builder.go buildSystemPromptZH/EN() — 独立 PromptBuilder，包含详细决策原则
//
// HOOT 主路径 = prompt-builder.service.ts（当前生产使用）
// HOOT 备用路径 = 以下常量（保留但不注入主路径，与 nofx 架构对齐）
//
// ⚠️ 这些规则曾被混入主路径，导致 AI 用"保护资本""控制风险"滥用平仓
//    历史教训：2026-03-23 确认并移除，只保留在备用路径中
// ============================================================================

/**
 * 备用路径：决策原则（对齐 nofx prompt_builder.go L56-76）
 * 当前不使用，保留供未来独立 PromptBuilder 模式使用
 */
export const BACKUP_DECISION_PRINCIPLES_ZH = `
## 决策原则

### 风险优先
- 保证金使用率不得超过30%
- 单个持仓亏损达到-5%必须止损
- 优先保护资本，再考虑盈利

### 跟踪止盈
- 当持仓盈亏从峰值回撤30%时，考虑部分或全部止盈
- 例如：Peak PnL +5%，Current PnL +3.5% → 回撤了30%，应该止盈

### 顺势交易
- 只在多个时间框架趋势一致时进场
- 结合持仓量(OI)变化判断资金流向真实性
- OI增加+价格上涨 = 强多头趋势
- OI减少+价格上涨 = 空头平仓（可能反转）

### 分批操作
- 分批建仓：第一次开仓不超过目标仓位的50%
- 分批止盈：盈利3%平33%，盈利5%平50%，盈利8%全平
- 只在盈利仓位上加仓，永远不要追亏损
`;

/**
 * 备用路径：平仓规则（对齐 nofx prompt_builder.go 备用路径）
 * 当前不使用，保留供未来独立 PromptBuilder 模式使用
 */
export const BACKUP_EXIT_RULES_ZH = `
### 平仓规则 (有持仓时)
- 当前 PnL% 与 PeakPnL% 的关系（利润是否在回撤）
- PeakPnL 较高但正在快速回撤时，考虑保护利润
- 趋势明确反转（多指标确认）时，考虑平仓
- 单个持仓亏损达到 -5% 时必须止损，优先保护资本

**Trailing Stop（跟踪止盈）:**
- 持仓 PnL 从峰值回撤 ≥ 30% 时，考虑部分或全部止盈
  示例: PeakPnL=+5%, 当前 PnL=+3.5% → 回撤 30% → 应止盈

**分批止盈 (Scale-out):**
- 盈利 +3%: 平仓 33%
- 盈利 +5%: 平仓至原仓 50%
- 盈利 +8%: 全部平仓
`;

