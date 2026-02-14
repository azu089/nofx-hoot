import { Injectable, Logger } from '@nestjs/common';
import { LLMService, UserApiKeys, LLMResponse } from './llm.service';
import { IndicatorsService, OHLCV, IndicatorsResult } from './indicators.service';
import { MarketDataService } from './market-data.service';
import { formatMarketDataPrompt } from '../constants/prompts';
import { AnalystReports } from '../types/ai.types';

/**
 * 单个分析师结果
 */
interface AnalystResult {
  report: string;
  cost: number;
  latencyMs: number;
  tokenUsage: number;
}

/**
 * 全部分析师结果
 */
export interface AllAnalystResults {
  reports: AnalystReports;
  totalCost: number;
  totalLatencyMs: number;
  errors: string[];
}

/**
 * 分析师输入上下文
 */
export interface AnalystContext {
  symbol: string;
  currentPrice: number;
  ohlcv: OHLCV[];
  indicators: IndicatorsResult;
  openInterest?: number;
  fundingRate?: number;
  existingPositions?: Array<{
    side: string;
    entryPrice: number;
    size: number;
    pnlPercent: number;
  }>;
}

/**
 * 加密货币分析师服务
 *
 * 对应 TradingAgents 第 1 阶段: 4-5 位专业分析师并行研究
 * 每位分析师 = 1 次 LLM 调用，使用 quick_think 模型
 *
 * 5 位分析师:
 * 1. Market Analyst — OHLCV + 价格结构分析
 * 2. Technical Analyst — 4 维技术指标深度分析
 * 3. Fundamentals Analyst — OI/资金费率/衍生品数据
 * 4. News Analyst — 市场新闻和事件分析
 * 5. Sentiment Analyst — 情绪指标和逆向信号
 */
@Injectable()
export class CryptoAnalystsService {
  private readonly logger = new Logger(CryptoAnalystsService.name);

  constructor(
    private readonly llm: LLMService,
    private readonly indicatorsService: IndicatorsService,
    private readonly marketData: MarketDataService,
  ) {}

  /**
   * 并行执行所有分析师
   *
   * @param context 分析上下文（已包含 OHLCV 和指标数据）
   * @param modelId LLM 模型 ID (quick_think)
   * @param apiKeys 用户 API Keys
   * @param skipAnalysts 跳过的分析师（quick 深度模式用）
   */
  async runAllAnalysts(
    context: AnalystContext,
    modelId: string,
    apiKeys: UserApiKeys,
    skipAnalysts?: string[],
  ): Promise<AllAnalystResults> {
    const skip = new Set(skipAnalysts || []);

    // 构建分析任务列表
    const tasks: Array<{ name: string; fn: () => Promise<AnalystResult> }> = [];

    if (!skip.has('market')) {
      tasks.push({
        name: 'market',
        fn: () => this.analyzeMarket(context, modelId, apiKeys),
      });
    }
    if (!skip.has('technical')) {
      tasks.push({
        name: 'technical',
        fn: () => this.analyzeTechnical(context, modelId, apiKeys),
      });
    }
    if (!skip.has('fundamentals')) {
      tasks.push({
        name: 'fundamentals',
        fn: () => this.analyzeFundamentals(context, modelId, apiKeys),
      });
    }
    if (!skip.has('news')) {
      tasks.push({
        name: 'news',
        fn: () => this.analyzeNews(context, modelId, apiKeys),
      });
    }
    if (!skip.has('sentiment')) {
      tasks.push({
        name: 'sentiment',
        fn: () => this.analyzeSentiment(context, modelId, apiKeys),
      });
    }

    this.logger.log(
      `[分析师] 启动 ${tasks.length} 位分析师: ${tasks.map((t) => t.name).join(', ')}`,
    );

    const startTime = Date.now();

    // 并行执行所有分析师
    const results = await Promise.allSettled(tasks.map((t) => t.fn()));

    const reports: AnalystReports = {};
    let totalCost = 0;
    const errors: string[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const taskName = tasks[i].name;
      const result = results[i];

      if (result.status === 'fulfilled') {
        const { report, cost } = result.value;
        totalCost += cost;

        switch (taskName) {
          case 'market':
            reports.marketReport = report;
            break;
          case 'technical':
            reports.technicalReport = report;
            break;
          case 'fundamentals':
            reports.fundamentalsReport = report;
            break;
          case 'news':
            reports.newsReport = report;
            break;
          case 'sentiment':
            reports.sentimentReport = report;
            break;
        }

        this.logger.log(
          `[分析师] ${taskName} 完成: ${result.value.tokenUsage} tokens, $${cost.toFixed(6)}`,
        );
      } else {
        const errMsg = result.reason?.message || '未知错误';
        errors.push(`${taskName}: ${errMsg}`);
        this.logger.error(`[分析师] ${taskName} 失败: ${errMsg}`);
      }
    }

    const totalLatencyMs = Date.now() - startTime;

    this.logger.log(
      `[分析师] 全部完成: ${tasks.length - errors.length}/${tasks.length} 成功, ` +
        `总耗时 ${totalLatencyMs}ms, 总成本 $${totalCost.toFixed(6)}`,
    );

    return { reports, totalCost, totalLatencyMs, errors };
  }

  // ==================== 5 位分析师实现 ====================

  /**
   * 1. Market Analyst — 市场结构与价格行为分析
   *
   * 对应 TradingAgents market_analyst.py
   * 关注: 趋势方向、价格结构、K 线形态、关键价位
   */
  private async analyzeMarket(
    context: AnalystContext,
    modelId: string,
    apiKeys: UserApiKeys,
  ): Promise<AnalystResult> {
    const systemPrompt = `You are a CRYPTO MARKET ANALYST specializing in price action and market structure analysis for cryptocurrency futures.

## Your Focus Areas
1. **Price Structure**: Higher highs/higher lows vs lower highs/lower lows
2. **Key Price Levels**: Identify critical support and resistance levels from recent OHLCV data
3. **Candlestick Patterns**: Look for significant reversal or continuation patterns in recent candles
4. **Volume-Price Relationship**: Does volume confirm the current price move?
5. **Trend Assessment**: Is the market trending, ranging, or at a potential reversal point?

## Analysis Requirements
- Identify the primary trend direction based on price structure
- Highlight the 2-3 most important support/resistance levels
- Note any significant candlestick patterns in the last 5-10 candles
- Assess whether volume is confirming or diverging from price action
- Provide a concise market outlook

## Output Format
Write a structured analysis report (200-500 words) with clear sections. Use specific price levels and percentages. End with a directional bias: BULLISH / BEARISH / NEUTRAL with brief justification.`;

    const userMessage = this.buildMarketDataMessage(context);

    const response = await this.llm.chat(modelId, systemPrompt, userMessage, apiKeys, {
      temperature: 0.3,
      maxTokens: 800,
    });

    return this.toAnalystResult(response);
  }

  /**
   * 2. Technical Analyst — 4 维技术指标深度分析
   *
   * 对应 TradingAgents 中 technical 维度 + v2-dev ANALYST 角色
   * 关注: 趋势/动量/波动率/成交量 4 维度交叉验证
   */
  private async analyzeTechnical(
    context: AnalystContext,
    modelId: string,
    apiKeys: UserApiKeys,
  ): Promise<AnalystResult> {
    const systemPrompt = `You are an EXPERT CRYPTO TECHNICAL ANALYST performing a 4-dimensional indicator analysis.

## 4-Dimensional Analysis Framework

### Dimension 1: Trend
- EMA alignment: EMA(12) vs EMA(20) vs EMA(50) relationship
- Donchian Channel position: Price near upper (bullish) / lower (bearish) / mid (neutral)
- Are EMAs expanding (trending) or converging (consolidating)?

### Dimension 2: Momentum
- RSI(7): Short-term momentum (< 30 oversold, > 70 overbought)
- RSI(14): Medium-term momentum confirmation
- MACD: Line vs Signal position, Histogram direction and magnitude
- Check for divergences between price and momentum indicators

### Dimension 3: Volatility
- ATR(3) vs ATR(14): Short vs long-term volatility ratio
  - Ratio > 2.0 = HIGH volatility (caution for entries)
  - Ratio > 3.0 = EXTREME (avoid new entries)
  - Ratio < 0.7 = LOW (potential breakout setup)
- Bollinger Band width as secondary volatility gauge

### Dimension 4: Volume & OBV
- OBV trend direction: Confirming or diverging from price?
- Volume profile in recent candles: Rising or declining?

## Cross-Validation
- STRONG signal: ≥3 dimensions agree
- MODERATE signal: 2 dimensions agree
- WEAK signal: Only 1 dimension supports
- CONFLICTING: Dimensions disagree → recommend WAIT

## Output Format
Write a structured report (200-500 words). Score each dimension (BULLISH / NEUTRAL / BEARISH). State the cross-validation result. Reference specific indicator values. End with directional bias and confidence level.`;

    const userMessage = this.buildTechnicalMessage(context);

    const response = await this.llm.chat(modelId, systemPrompt, userMessage, apiKeys, {
      temperature: 0.2,
      maxTokens: 800,
    });

    return this.toAnalystResult(response);
  }

  /**
   * 3. Fundamentals Analyst — 衍生品与链上数据分析
   *
   * 对应 TradingAgents fundamentals_analyst.py（加密货币改版）
   * 关注: OI 变化、资金费率、合约数据、清算风险
   */
  private async analyzeFundamentals(
    context: AnalystContext,
    modelId: string,
    apiKeys: UserApiKeys,
  ): Promise<AnalystResult> {
    const systemPrompt = `You are a CRYPTO DERIVATIVES & ON-CHAIN ANALYST specializing in futures market fundamentals.

## Your Focus Areas (Crypto-Specific Fundamentals)

1. **Open Interest (OI) Analysis**
   - Rising OI + Rising Price = New longs entering (bullish)
   - Rising OI + Falling Price = New shorts entering (bearish)
   - Falling OI + Rising Price = Short covering (weak bullish)
   - Falling OI + Falling Price = Long liquidation (bearish)

2. **Funding Rate Analysis**
   - Positive funding: Longs pay shorts (bullish positioning, but crowded → risk)
   - Negative funding: Shorts pay longs (bearish positioning, but oversold → opportunity)
   - |Funding| > 0.05%/8h: Significant, indicates crowded trade
   - |Funding| > 0.1%/8h: Extreme, high probability of mean reversion

3. **Liquidation Risk Assessment**
   - High OI + High Positive Funding = Long squeeze risk
   - High OI + High Negative Funding = Short squeeze risk
   - Estimate liquidation zones based on leverage distribution

4. **Market Structure**
   - Is this a trending or mean-reverting environment?
   - Are derivatives leading or lagging spot price?
   - Cash-and-carry basis spread (if observable)

## Output Format
Write a structured analysis (200-400 words) with specific numbers and interpretations. Rate the derivatives positioning: BULLISH / BEARISH / NEUTRAL with confidence.`;

    const userMessage = this.buildFundamentalsMessage(context);

    const response = await this.llm.chat(modelId, systemPrompt, userMessage, apiKeys, {
      temperature: 0.3,
      maxTokens: 600,
    });

    return this.toAnalystResult(response);
  }

  /**
   * 4. News Analyst — 市场新闻与事件影响分析
   *
   * 对应 TradingAgents news_analyst.py
   * 数据源: CryptoPanic API (免费, 结构化新闻 + 情绪标签)
   * 降级: API 不可用时 fallback 到 LLM 内置知识（标注 [stale data]）
   */
  private async analyzeNews(
    context: AnalystContext,
    modelId: string,
    apiKeys: UserApiKeys,
  ): Promise<AnalystResult> {
    // 获取真实新闻数据
    const newsItems = await this.marketData.fetchCryptoNews(context.symbol, 10);
    const hasRealNews = newsItems.length > 0;

    const newsDataSection = hasRealNews
      ? this.formatNewsForPrompt(newsItems)
      : '[NO REAL-TIME NEWS AVAILABLE - Using training knowledge only. Findings may be outdated.]';

    const systemPrompt = `You are a CRYPTO NEWS & EVENTS ANALYST who assesses how recent events and upcoming catalysts might affect trading.

## Your Analysis Areas

1. **Market-Moving Events**
   - Major protocol upgrades, hard forks, or network changes
   - Regulatory developments (SEC, CFTC, global regulations)
   - Exchange-related news (listings, delistings, outages, hacks)
   - Macro events (FOMC, CPI, employment data) that affect crypto

2. **Token-Specific Catalysts**
   - For the given symbol, identify upcoming events (token unlocks, partnerships, launches)
   - Historical pattern around such events
   - Supply changes (halvings, burns, emissions schedule)

3. **Risk Events**
   - Potential black swan indicators
   - Stablecoin de-peg risks
   - Major position unwinds by known entities
   - Geopolitical risks affecting crypto markets

## Data Source
${hasRealNews ? 'You have REAL-TIME news data below. Prioritize analyzing these actual headlines.' : 'No real-time news available. Use your training knowledge but clearly note that your information may be outdated.'}

## Output Format
Write a concise analysis (150-300 words). State key events or patterns relevant to the symbol. Rate news sentiment: POSITIVE / NEGATIVE / NEUTRAL. Flag any significant risk events.`;

    const userMessage = `Analyze the news and event landscape for ${context.symbol} futures trading.

Current price: ${context.currentPrice}
Market context: This is a cryptocurrency perpetual futures contract.

=== NEWS DATA ===
${newsDataSection}

Based on the above${hasRealNews ? ' real-time news' : ' (limited to your training knowledge)'}, what are the most relevant news factors, upcoming events, and risk scenarios that could affect ${context.symbol} in the near term?`;

    const response = await this.llm.chat(modelId, systemPrompt, userMessage, apiKeys, {
      temperature: 0.5,
      maxTokens: 500,
    });

    return this.toAnalystResult(response);
  }

  /**
   * 格式化 CryptoPanic 新闻为 prompt 文本
   */
  private formatNewsForPrompt(
    newsItems: import('./market-data.service').CryptoNewsItem[],
  ): string {
    const lines: string[] = ['Recent headlines (from CryptoPanic, most recent first):', ''];
    for (const item of newsItems) {
      const sentimentTag = item.sentiment === 'positive' ? '[+]' : item.sentiment === 'negative' ? '[-]' : '[~]';
      const date = item.publishedAt ? new Date(item.publishedAt).toISOString().split('T')[0] : 'unknown';
      const votes = `(+${item.votes.positive}/-${item.votes.negative})`;
      lines.push(`${sentimentTag} ${date} | ${item.title} ${votes} [${item.source}]`);
    }
    return lines.join('\n');
  }

  /**
   * 5. Sentiment Analyst — 市场情绪与逆向信号分析
   *
   * 对应 TradingAgents social_media_analyst.py（加密货币改版）
   * 关注: 恐惧贪婪指数推断、极端情绪检测、逆向机会
   */
  private async analyzeSentiment(
    context: AnalystContext,
    modelId: string,
    apiKeys: UserApiKeys,
  ): Promise<AnalystResult> {
    const systemPrompt = `You are a CRYPTO SENTIMENT & CONTRARIAN ANALYST who specializes in detecting market sentiment extremes and contrarian opportunities.

## Your Analytical Framework

1. **Sentiment Inference from Market Data**
   - Funding rate as a sentiment proxy: High positive = greedy longs, High negative = fearful shorts
   - RSI extremes: > 75 suggests greed/euphoria, < 25 suggests fear/capitulation
   - Volume spikes: Panic selling (high volume + sharp drop) or FOMO buying (high volume + sharp rise)
   - ATR expansion: Fear-driven volatility vs calm complacency

2. **Crowd Positioning Detection**
   - Is the market one-sided? (Funding + OI + RSI all pointing same direction)
   - Estimated crowd position: If everyone is long → contrarian risk. If everyone is short → squeeze potential
   - Historical: Extreme sentiment usually precedes reversals

3. **Fear & Greed Assessment**
   - Use the REAL Fear & Greed Index if provided (0-100 scale from alternative.me)
   - Cross-reference with on-chain/market indicators:
     - RSI > 70 + Positive Funding + Rising OI = Extreme Greed
     - RSI < 30 + Negative Funding + Falling OI = Extreme Fear
   - Mean reversion probability at each extreme

4. **Contrarian Signals**
   - When should you fade the crowd? (Look for exhaustion + divergence)
   - When should you follow the crowd? (Early trend, not yet crowded)
   - Timing: Contrarian entries need confirmation (reversal candle, divergence)

## Output Format
Write a structured analysis (200-400 words). Estimate the current sentiment (EXTREME GREED / GREED / NEUTRAL / FEAR / EXTREME FEAR). Identify any contrarian opportunities. Rate sentiment bias: BULLISH (contrarian long) / BEARISH (contrarian short) / NEUTRAL.`;

    const userMessage = await this.buildSentimentMessage(context);

    const response = await this.llm.chat(modelId, systemPrompt, userMessage, apiKeys, {
      temperature: 0.4,
      maxTokens: 600,
    });

    return this.toAnalystResult(response);
  }

  // ==================== 消息构建辅助方法 ====================

  /**
   * 构建市场分析师的数据消息
   */
  private buildMarketDataMessage(ctx: AnalystContext): string {
    const lines: string[] = [
      `=== MARKET DATA: ${ctx.symbol} ===`,
      `Current Price: ${ctx.currentPrice}`,
      '',
    ];

    // 最近 20 根 K 线摘要
    if (ctx.ohlcv.length > 0) {
      lines.push('--- Recent OHLCV Candles (most recent last) ---');
      const recent = ctx.ohlcv.slice(-20);
      for (const candle of recent) {
        const change = ((candle.close - candle.open) / candle.open * 100).toFixed(2);
        const dir = candle.close >= candle.open ? 'UP' : 'DN';
        lines.push(
          `  O:${candle.open.toPrecision(6)} H:${candle.high.toPrecision(6)} ` +
            `L:${candle.low.toPrecision(6)} C:${candle.close.toPrecision(6)} ` +
            `V:${candle.volume.toFixed(0)} [${dir} ${change}%]`,
        );
      }
    }

    // 关键指标摘要
    lines.push('', '--- Key Indicators ---');
    const ind = ctx.indicators;
    if (ind.ema?.ema12 != null) lines.push(`EMA(12): ${ind.ema.ema12.toPrecision(6)}`);
    if (ind.ema?.ema50 != null) lines.push(`EMA(50): ${ind.ema.ema50.toPrecision(6)}`);
    if (ind.donchian?.upper != null) {
      lines.push(`Donchian: Upper=${ind.donchian.upper.toPrecision(6)} Mid=${ind.donchian.middle?.toPrecision(6)} Lower=${ind.donchian.lower?.toPrecision(6)}`);
    }

    // 持仓信息
    if (ctx.existingPositions && ctx.existingPositions.length > 0) {
      lines.push('', '--- Existing Positions ---');
      for (const pos of ctx.existingPositions) {
        lines.push(`  ${pos.side.toUpperCase()} @ ${pos.entryPrice} | Size: ${pos.size} | PnL: ${pos.pnlPercent.toFixed(2)}%`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 构建技术分析师的数据消息
   */
  private buildTechnicalMessage(ctx: AnalystContext): string {
    const ind = ctx.indicators;
    const lines: string[] = [
      `=== TECHNICAL DATA: ${ctx.symbol} @ ${ctx.currentPrice} ===`,
      '',
      '--- Dimension 1: Trend ---',
    ];

    if (ind.ema?.ema12 != null) lines.push(`EMA(12): ${ind.ema.ema12.toPrecision(6)}`);
    if (ind.ema?.ema20 != null) lines.push(`EMA(20): ${ind.ema.ema20.toPrecision(6)}`);
    if (ind.ema?.ema26 != null) lines.push(`EMA(26): ${ind.ema.ema26.toPrecision(6)}`);
    if (ind.ema?.ema50 != null) lines.push(`EMA(50): ${ind.ema.ema50.toPrecision(6)}`);
    if (ind.donchian?.upper != null) {
      lines.push(`Donchian Upper: ${ind.donchian.upper.toPrecision(6)}`);
      lines.push(`Donchian Mid: ${ind.donchian.middle?.toPrecision(6) || 'N/A'}`);
      lines.push(`Donchian Lower: ${ind.donchian.lower?.toPrecision(6) || 'N/A'}`);
    }

    lines.push('', '--- Dimension 2: Momentum ---');
    if (ind.rsi7 != null) lines.push(`RSI(7): ${ind.rsi7.toFixed(1)}`);
    if (ind.rsi != null) lines.push(`RSI(14): ${ind.rsi.toFixed(1)}`);
    if (ind.macd?.macd != null) {
      lines.push(`MACD Line: ${ind.macd.macd.toFixed(4)}`);
      lines.push(`MACD Signal: ${ind.macd.signal?.toFixed(4) || 'N/A'}`);
      lines.push(`MACD Histogram: ${ind.macd.histogram?.toFixed(4) || 'N/A'}`);
    }

    lines.push('', '--- Dimension 3: Volatility ---');
    if (ind.atr != null) lines.push(`ATR(14): ${ind.atr.toFixed(4)}`);
    if (ind.atr3 != null) lines.push(`ATR(3): ${ind.atr3.toFixed(4)}`);
    if (ind.atr3 != null && ind.atr != null && ind.atr > 0) {
      const ratio = ind.atr3 / ind.atr;
      const label = ratio > 3.0 ? 'EXTREME' : ratio > 2.0 ? 'HIGH' : ratio > 1.5 ? 'ELEVATED' : ratio < 0.7 ? 'LOW (compression)' : 'NORMAL';
      lines.push(`ATR Ratio (3/14): ${ratio.toFixed(2)} [${label}]`);
    }
    if (ind.bollingerBands?.upper != null) {
      lines.push(`Bollinger Upper: ${ind.bollingerBands.upper.toPrecision(6)}`);
      lines.push(`Bollinger Mid: ${ind.bollingerBands.middle?.toPrecision(6) || 'N/A'}`);
      lines.push(`Bollinger Lower: ${ind.bollingerBands.lower?.toPrecision(6) || 'N/A'}`);
    }

    lines.push('', '--- Dimension 4: Volume ---');
    if (ind.obv != null) lines.push(`OBV: ${ind.obv.toFixed(0)}`);

    // 最近 5 根 K 线的成交量趋势
    if (ctx.ohlcv.length >= 5) {
      const recentVolumes = ctx.ohlcv.slice(-5).map((c) => c.volume);
      const avgVol = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
      const latestVol = recentVolumes[recentVolumes.length - 1];
      const volRatio = latestVol / avgVol;
      lines.push(`Recent 5-candle avg volume: ${avgVol.toFixed(0)}`);
      lines.push(`Latest volume: ${latestVol.toFixed(0)} (${volRatio.toFixed(2)}x average)`);
    }

    // 衍生品数据
    if (ctx.openInterest !== undefined || ctx.fundingRate !== undefined) {
      lines.push('', '--- Derivatives Context ---');
      if (ctx.openInterest !== undefined) lines.push(`Open Interest: ${ctx.openInterest.toLocaleString()}`);
      if (ctx.fundingRate !== undefined) lines.push(`Funding Rate (8h): ${(ctx.fundingRate * 100).toFixed(4)}%`);
    }

    return lines.join('\n');
  }

  /**
   * 构建基本面分析师的数据消息
   */
  private buildFundamentalsMessage(ctx: AnalystContext): string {
    const lines: string[] = [
      `=== DERIVATIVES FUNDAMENTALS: ${ctx.symbol} @ ${ctx.currentPrice} ===`,
      '',
    ];

    if (ctx.openInterest !== undefined) {
      lines.push(`Open Interest: ${ctx.openInterest.toLocaleString()}`);
    } else {
      lines.push('Open Interest: Not available');
    }

    if (ctx.fundingRate !== undefined) {
      const fr = ctx.fundingRate;
      const frPercent = (fr * 100).toFixed(4);
      let frLabel = 'NORMAL';
      if (Math.abs(fr) > 0.001) frLabel = 'EXTREME';
      else if (Math.abs(fr) > 0.0005) frLabel = 'HIGH';
      else if (Math.abs(fr) > 0.0003) frLabel = 'ELEVATED';
      lines.push(`Funding Rate (8h): ${frPercent}% [${frLabel}]`);
      lines.push(`Annualized Funding: ${(fr * 3 * 365 * 100).toFixed(2)}%`);

      if (fr > 0) {
        lines.push('Interpretation: Longs paying shorts → market positioned long');
      } else if (fr < 0) {
        lines.push('Interpretation: Shorts paying longs → market positioned short');
      }
    } else {
      lines.push('Funding Rate: Not available');
    }

    // 价格走势摘要（供基本面分析师理解上下文）
    if (ctx.ohlcv.length >= 10) {
      const recent = ctx.ohlcv.slice(-10);
      const priceChange = ((recent[recent.length - 1].close - recent[0].open) / recent[0].open * 100).toFixed(2);
      lines.push('');
      lines.push(`Price change (last 10 candles): ${priceChange}%`);
    }

    // RSI 作为情绪参考
    if (ctx.indicators.rsi != null) {
      lines.push(`RSI(14): ${ctx.indicators.rsi.toFixed(1)} (sentiment context)`);
    }

    return lines.join('\n');
  }

  /**
   * 获取加密货币恐惧贪婪指数（免费 API，无需 Key）
   * 数据源: alternative.me/crypto/fear-and-greed-index/
   * 返回: { value: 0-100, classification: 'Extreme Fear'|'Fear'|'Neutral'|'Greed'|'Extreme Greed' }
   */
  private async fetchFearGreedIndex(): Promise<{ value: number; classification: string } | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('https://api.alternative.me/fng/?limit=1', {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.data?.[0]) {
        return {
          value: parseInt(data.data[0].value, 10),
          classification: data.data[0].value_classification,
        };
      }
      return null;
    } catch (error) {
      this.logger.warn(`[Sentiment] Fear & Greed API 请求失败: ${error?.message || error}`);
      return null; // 网络失败不阻塞分析
    }
  }

  /**
   * 构建情绪分析师的数据消息
   */
  private async buildSentimentMessage(ctx: AnalystContext): Promise<string> {
    const ind = ctx.indicators;
    const lines: string[] = [
      `=== SENTIMENT DATA: ${ctx.symbol} @ ${ctx.currentPrice} ===`,
      '',
      '--- Sentiment Indicators ---',
    ];

    // 恐惧贪婪指数（外部数据源）
    const fng = await this.fetchFearGreedIndex();
    if (fng) {
      lines.push(`Fear & Greed Index: ${fng.value}/100 [${fng.classification}]`);
      if (fng.value <= 20) lines.push('  → Market is in EXTREME FEAR — potential buying opportunity');
      else if (fng.value >= 80) lines.push('  → Market is in EXTREME GREED — potential selling opportunity');
    } else {
      lines.push('Fear & Greed Index: Not available (derive from other indicators)');
    }

    // RSI 极值判断
    if (ind.rsi7 != null) {
      let rsiLabel = 'NEUTRAL';
      if (ind.rsi7 > 75) rsiLabel = 'EXTREME GREED';
      else if (ind.rsi7 > 65) rsiLabel = 'GREED';
      else if (ind.rsi7 < 25) rsiLabel = 'EXTREME FEAR';
      else if (ind.rsi7 < 35) rsiLabel = 'FEAR';
      lines.push(`RSI(7): ${ind.rsi7.toFixed(1)} [${rsiLabel}]`);
    }
    if (ind.rsi != null) {
      lines.push(`RSI(14): ${ind.rsi.toFixed(1)}`);
    }

    // 资金费率作为情绪代理
    if (ctx.fundingRate !== undefined) {
      const fr = ctx.fundingRate;
      let frSentiment = 'NEUTRAL';
      if (fr > 0.001) frSentiment = 'EXTREMELY BULLISH POSITIONING';
      else if (fr > 0.0005) frSentiment = 'BULLISH POSITIONING';
      else if (fr < -0.001) frSentiment = 'EXTREMELY BEARISH POSITIONING';
      else if (fr < -0.0005) frSentiment = 'BEARISH POSITIONING';
      lines.push(`Funding Rate: ${(fr * 100).toFixed(4)}% [${frSentiment}]`);
    }

    // OI 作为参与度指标
    if (ctx.openInterest !== undefined) {
      lines.push(`Open Interest: ${ctx.openInterest.toLocaleString()}`);
    }

    // ATR 波动率（恐惧指标）
    if (ind.atr3 != null && ind.atr != null && ind.atr > 0) {
      const ratio = ind.atr3 / ind.atr;
      let volSentiment = 'CALM';
      if (ratio > 3.0) volSentiment = 'PANIC';
      else if (ratio > 2.0) volSentiment = 'FEARFUL';
      else if (ratio > 1.5) volSentiment = 'ANXIOUS';
      else if (ratio < 0.7) volSentiment = 'COMPLACENT';
      lines.push(`ATR Ratio (3/14): ${ratio.toFixed(2)} [${volSentiment}]`);
    }

    // 成交量异常检测
    if (ctx.ohlcv.length >= 20) {
      const volumes = ctx.ohlcv.slice(-20).map((c) => c.volume);
      const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
      const latestVol = volumes[volumes.length - 1];
      const volSpike = latestVol / avgVol;
      if (volSpike > 2.0) {
        lines.push(`Volume Spike: ${volSpike.toFixed(1)}x average [POTENTIAL PANIC/FOMO]`);
      } else if (volSpike < 0.5) {
        lines.push(`Volume Dry-up: ${volSpike.toFixed(2)}x average [LOW PARTICIPATION]`);
      } else {
        lines.push(`Volume: ${volSpike.toFixed(2)}x average [NORMAL]`);
      }
    }

    return lines.join('\n');
  }

  // ==================== 工具方法 ====================

  /**
   * 将 LLM 响应转为分析师结果
   */
  private toAnalystResult(response: LLMResponse): AnalystResult {
    return {
      report: response.content,
      cost: response.cost,
      latencyMs: response.latencyMs,
      tokenUsage: response.tokenUsage,
    };
  }
}
