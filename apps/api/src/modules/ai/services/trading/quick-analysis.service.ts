import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LLMService, UserApiKeys } from '../llm.service';
import { IndicatorsService, OHLCV, IndicatorsResult } from '../indicators.service';
import { MarketDataService } from '../market-data.service';
import { TradeHistoryService } from '../trade-history.service';
import { AiTradeDecision } from '../../types/ai.types';
import { formatMarketDataPrompt } from '../../constants/prompts';
import { PromptBuilderService, PromptConfig, UserPromptContext } from './prompt-builder.service';
import { parseDecisions, extractReasoning } from '../../utils/decision-parser';
import { NofxosRankingService } from '../nofxos-ranking.service';
import { AiMemoryService } from '../memory.service';
import { LunarCrushService } from '../lunarcrush.service';

/**
 * 最近交易记录（替代 BM25 记忆，轻量上下文）
 * 近期交易记录：9 字段
 */
export interface RecentTrade {
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;       // realizedPnL
  pnlPercent: number; // pnlPct
  entryTime: string;
  closedAt: string;   // exitTime
  holdDuration: string; // 持仓时长 e.g. "2h30m"
}

/**
 * 交易统计（聚合数据）
 * 交易统计：8 字段
 */
export interface TradingStats {
  totalTrades: number;
  winRate: number;
  profitFactor: number;  // 盈利总和 / 亏损总和
  sharpeRatio: number;   // 年化夏普率 (√365)
  totalPnl: number;
  avgWin: number;        // 平均盈利
  avgLoss: number;       // 平均亏损
  maxDrawdownPct: number; // 最大回撤百分比
}

export interface QuickAnalysisConfig {
  userId: string;
  symbol: string;
  timeframe: string; // 主时间框架
  secondaryTimeframe?: string; // 副时间框架
  modelId: string; // LLM 模型
  apiKeys: UserApiKeys;
  temperature?: number;
  maxTokens?: number;
  debateContext?: string; // Q5: 辩论摘要上下文，注入到用户消息中
  recentTrades?: RecentTrade[]; // 产品 B: 替代 BM25 的轻量上下文
  tradingStats?: TradingStats; // 产品 B: 交易统计聚合
  /** Phase 9.0: PromptBuilder 配置 */
  promptConfig?: PromptConfig;
  /** Phase 9.0 T4: 预构建的市场数据 prompt（多币种模式，跳过内部 fetch） */
  precomputedMarketData?: string;
  /** Phase 1: 流动性数据（订单簿深度+滑点预估，AI 决策参考） */
  liquidityData?: Array<{
    symbol: string;
    depthUSD: number;
    estimatedSlippage: number;
    referenceSizeUSD: number;
    canFill: boolean;
    spread: number;
  }>;
  /** 账户上下文（auto-trader 预计算，注入 Prompt 让 LLM 看到真实余额/持仓） */
  accountInfo?: {
    exchangeTotalEquity: number;
    exchangeAvailableBalance: number;
    allocatedCapital: number;
    strategyMarginUsed: number;
    strategyUnrealizedPnl: number;
    strategyPositions: Array<{
      symbol: string;
      side: string;
      entryPrice: number;
      size: number;
      leverage: number;
      pnlPercent: number;
      peakPnlPercent?: number;
      margin: number;
    }>;
    otherStrategiesCount: number;
    otherStrategiesMargin: number;
  };
  /** 上轮 AI 决策摘要（注入 prompt 提供决策连续性） */
  lastDecisions?: Array<{
    symbol: string;
    action: string;
    confidence: number;
    reasoning: string;
    timestamp: string;
  }>;
  /** 币种来源模式 */
  coinSourceMode?: string;
  /** 所有候选币列表 */
  candidateSymbols?: string[];
  /** 策略周期计数（对齐 nofx: Period #N） */
  cycleCount?: number;
  /** 策略运行时长（分钟，对齐 nofx: Runtime Nmin） */
  runtimeMinutes?: number;
}

/**
 * 快速分析结果
 */
export interface QuickAnalysisResult {
  decision: AiTradeDecision;
  allDecisions: AiTradeDecision[]; // Phase 9.0 T4: 所有解析出的决策（多币种模式）
  rawResponse: string;
  cost: number;
  latencyMs: number;
  /** 技术指标快照，供 safety.service 风控层使用（结构对齐 SafetyCheckInput.indicators） */
  indicators?: {
    rsi: number | null;
    atr3?: number | null;
    atr14?: number | null;
  };
  /** 资金费率，供 safety.service L8 检查 */
  fundingRate?: number;
  /** 当前价格，用于 SL/TP 百分比计算 */
  currentPrice?: number;
  /** 24h 成交量 USD，供 safety.service L10 流动性检查 */
  volume24h?: number;
  /** 发给 AI 的系统提示词（日志透明化用） */
  systemPrompt?: string;
  /** 发给 AI 的用户消息（含账户状态 + 市场数据 + K线，日志透明化用） */
  userPrompt?: string;
  /** DeepSeek-Reasoner reasoning_content（日志透明化用） */
  aiThinking?: string;
  /** 市场数据快照（前端日志卡片展示，对齐 Grid 的 gridSnapshot） */
  marketSnapshot?: MarketSnapshot;
}

/** Solo 策略市场数据快照（存入 decision JSON，前端展示） */
export interface MarketSnapshot {
  price: number;
  rsi7?: number | null;
  rsi14?: number | null;
  macdHist?: number | null;
  atr14?: number | null;
  fundingRate?: number | null;
  longShortRatio?: number | null;
  longPct?: number | null;
  oiChange?: string | null;
  oiQuadrant?: string | null;
  institutionFlow?: number | null;
  emaTrend?: string | null;         // EMA 趋势：↑多头 / ↓空头 / →震荡
  stablecoinNet?: number | null;    // 稳定币24h净流入（百万美元）
  dataSources: {
    oi: boolean;
    fr: boolean;
    ranking: boolean;
    enhanced: boolean;
    oiRanking: boolean;
    netFlow: boolean;
    priceRanking: boolean;
  };
}

/**
 * 快速分析服务（产品 B Solo 模式核心）
 *
 * v2-dev 中 quick-analysis.service.ts 不存在但被 ai.service.ts 引用，必须新建。
 *
 * Solo 模式 = 单次 LLM 综合分析（不走多角色辩论）
 * 参考 v2-dev prompts.ts 中的 QUICK_MODE_SYSTEM_PROMPT
 *
 * 流程:
 * 1. 获取市场数据（双时间框架）
 * 2. 计算技术指标
 * 3. 获取 BM25 记忆 + 交易历史
 * 4. 获取进化 Tier 上下文
 * 5. 构建综合 prompt（5 维度: 趋势/动量/波动率/成交量/逆向）
 * 6. 单次 LLM 调用
 * 7. 解析 6-action JSON 结果
 * 8. 应用进化 Tier 调整（Tier 1-3）
 */
@Injectable()
export class QuickAnalysisService {
  private readonly logger = new Logger(QuickAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LLMService,
    private readonly indicators: IndicatorsService,
    private readonly marketData: MarketDataService,
    private readonly tradeHistory: TradeHistoryService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly nofxosRanking: NofxosRankingService,
    private readonly memoryService: AiMemoryService,
    private readonly lunarCrush: LunarCrushService,
  ) {}

  /**
   * 执行快速分析（Solo 模式单次 LLM）
   */
  async analyze(config: QuickAnalysisConfig): Promise<QuickAnalysisResult> {
    const startTime = Date.now();

    this.logger.log(
      `[快速分析] 开始: ${config.symbol} @ ${config.timeframe}, 模型: ${config.modelId}`,
    );

    // Phase 9.0 T4: 多币种模式 — 使用预构建的市场数据，跳过 fetch
    let marketDataPrompt: string;
    let existingPositions: Array<{ side: string; entryPrice: number; size: number; pnlPercent: number; peakPnlPercent?: number; leverage?: number }> = [];
    // 风控数据: 提升到外层作用域，供 safety.service 使用
    let safetyIndicators: { rsi: number | null; atr3?: number | null; atr14?: number | null } | undefined;
    let safetyFundingRate: number | undefined;
    let safetyCurrentPrice: number | undefined;
    let safetyVolume24h: number | undefined;
    let snapshot: MarketSnapshot | undefined;
    // 极速策略增强数据（提升到外层，供后续格式化使用）
    let newsItems: any[] = [];
    let fearGreed: { value: number; classification: string } | null = null;
    let lunarCrushData: any = null;

    if (config.precomputedMarketData) {
      // 多币种模式: 市场数据已由调用方预构建
      marketDataPrompt = config.precomputedMarketData;
      // 构建 marketSnapshot 供前端日志卡片展示（轻量获取，不影响 AI prompt）
      try {
        const [md, lsr] = await Promise.all([
          this.fetchMarketData(config),
          this.marketData.fetchLongShortRatio(config.symbol).catch(() => null),
        ]);
        if (md) {
          safetyCurrentPrice = md.currentPrice;
          safetyFundingRate = md.fundingRate ?? undefined;
          // 计算指标
          const ohlcv = md.ohlcv;
          const ind = ohlcv.length >= 14 ? this.indicators.calculateAll(ohlcv) : null;
          safetyIndicators = ind ?? undefined;
          snapshot = {
            price: md.currentPrice,
            rsi7: ind?.rsi7 ?? null,
            rsi14: ind?.rsi ?? null,
            macdHist: ind?.macd?.histogram ?? null,
            atr14: ind?.atr ?? null,
            fundingRate: md.fundingRate ?? null,
            longShortRatio: lsr?.longShortRatio ?? null,
            longPct: lsr ? (lsr.longAccount / (lsr.longAccount + lsr.shortAccount)) * 100 : null,
            oiChange: null,
            oiQuadrant: null,
            institutionFlow: null,
            emaTrend: (() => {
              const e7 = ind?.ema?.ema12 ?? 0, e25 = ind?.ema?.ema26 ?? 0, e99 = ind?.ema?.ema50 ?? 0;
              if (e7 && e25 && e99) return e7 > e25 && e25 > e99 ? '↑多头' : (e7 < e25 && e25 < e99 ? '↓空头' : '→震荡');
              return null;
            })(),
            stablecoinNet: null,
            dataSources: { oi: md.openInterest != null, fr: md.fundingRate != null, ranking: false, enhanced: false, oiRanking: false, netFlow: false, priceRanking: false },
          };
        }
      } catch (e) {
        this.logger.debug(`[多币种] marketSnapshot 构建失败（不影响决策）: ${(e as Error).message}`);
      }
    } else {
      // 1. 获取市场数据 + 市场排名 + 增强数据 + NofxOS 排名（并行，对齐 nofx 数据获取日志规范）
      const [marketData, marketRanking, enhancedData, oiRanking, netFlowRanking, priceRanking, _newsItems, _fearGreed, _lunarCrushData] = await Promise.all([
        this.fetchMarketData(config),
        this.marketData.fetchMarketRanking(config.symbol).catch((e: any) => {
          this.logger.warn(`[数据获取] marketRanking 失败: ${e.message}`);
          return null;
        }),
        this.marketData.fetchEnhancedMarketData(config.symbol).catch((e: any) => {
          this.logger.warn(`[数据获取] enhancedData 失败: ${e.message}`);
          return null;
        }),
        // NofxOS 排名数据（对齐 nofx buildTradingContext: FetchOIRankingData/FetchNetFlowRankingData/FetchPriceRankingData）
        this.nofxosRanking.fetchOIRanking().catch((e: any) => {
          this.logger.warn(`[数据获取] OI排名 失败: ${e.message}`);
          return null;
        }),
        this.nofxosRanking.fetchNetFlowRanking().catch((e: any) => {
          this.logger.warn(`[数据获取] 资金流排名 失败: ${e.message}`);
          return null;
        }),
        this.nofxosRanking.fetchPriceRanking().catch((e: any) => {
          this.logger.warn(`[数据获取] 涨跌幅排名 失败: ${e.message}`);
          return null;
        }),
        // Task 1: CryptoPanic 新闻
        this.marketData.fetchCryptoNews(config.symbol, 5).catch((e: any) => {
          this.logger.warn(`[数据获取] 新闻 失败: ${e.message}`);
          return [] as any[];
        }),
        // Task 2: Fear & Greed Index
        this.marketData.fetchFearGreedIndex().catch(() => null),
        // Task 4: LunarCrush 社媒情绪
        this.lunarCrush.fetchSocialMetrics(config.symbol).catch(() => null),
      ]);
      const { ohlcv, currentPrice, openInterest, fundingRate, volume24h } = marketData;
      safetyVolume24h = volume24h;
      // 赋值到外层作用域（供后续格式化使用）
      newsItems = _newsItems as any[] || [];
      fearGreed = _fearGreed as any;
      lunarCrushData = _lunarCrushData;

      // 数据获取摘要日志（对齐 nofx buildTradingContext 日志规范）
      this.logger.log(
        `📋 [${config.symbol}] 数据摘要: K线=${ohlcv.length}条@${config.timeframe} | 价格=$${currentPrice} | ` +
        `OI=${openInterest != null ? '✅' : '❌'} | FR=${fundingRate != null ? '✅' : '❌'} | ` +
        `排名=${marketRanking ? '✅' : '❌'} | 增强=${enhancedData ? '✅' : '❌'}\n` +
        `  📊 OI排名=${oiRanking ? `✅(${oiRanking.topPositions.length}top/${oiRanking.lowPositions.length}low)` : '❌'} | ` +
        `💰 资金流=${netFlowRanking ? '✅' : '❌'} | ` +
        `📈 涨跌榜=${priceRanking ? `✅(${Object.keys(priceRanking.durations).length}时段)` : '❌'}`,
      );

      // 2. 计算技术指标
      const indicatorResult = this.indicators.calculateAll(ohlcv);

      // 保存风控关键数据供 safety.service 使用（字段名对齐 SafetyCheckInput.indicators）
      safetyIndicators = {
        rsi: indicatorResult.rsi ?? null, // RSI(14) 用于 L3 超买/超卖检查
        atr3: indicatorResult.atr3,
        atr14: indicatorResult.atr,
      };
      safetyFundingRate = fundingRate;
      safetyCurrentPrice = currentPrice;

      // 构建市场数据快照（前端日志卡片展示用，对齐 Grid 的 gridSnapshot）
      {
        const enh = enhancedData as Record<string, any> | null;
        const lsr = enh?.longShortRatio;
        const oiHist = enh?.oiHistory;
        let oiChangeStr: string | null = null;
        let oiQuadrant: string | null = null;
        if (Array.isArray(oiHist) && oiHist.length >= 2) {
          const latest = oiHist[oiHist.length - 1]?.sumOpenInterest ?? 0;
          const prev = oiHist[0]?.sumOpenInterest ?? 0;
          if (prev > 0) {
            const pct = ((latest - prev) / prev) * 100;
            oiChangeStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
            const lastClose = ohlcv[ohlcv.length - 1]?.[4] ?? 0;
            const prevClose = ohlcv[ohlcv.length - 2]?.[4] ?? lastClose;
            const priceUp = lastClose >= prevClose;
            const oiUp = pct >= 0;
            if (oiUp && priceUp) oiQuadrant = '多头主导';
            else if (oiUp && !priceUp) oiQuadrant = '空头主导';
            else if (!oiUp && priceUp) oiQuadrant = '空头平仓';
            else oiQuadrant = '多头清算';
          }
        }
        let instFlow: number | null = null;
        if (netFlowRanking) {
          const sym = config.symbol.replace(/\/USDT:USDT$/, 'USDT');
          const found = netFlowRanking.institutionFutureTop.find(p => p.symbol === sym)
            || netFlowRanking.institutionFutureLow.find(p => p.symbol === sym);
          if (found) instFlow = found.amount;
        }
        // EMA 趋势判断
        const ema7 = indicatorResult.ema?.ema12 ?? 0;
        const ema25 = indicatorResult.ema?.ema26 ?? 0;
        const ema99 = indicatorResult.ema?.ema50 ?? 0;
        let emaTrend: string | null = null;
        if (ema7 && ema25 && ema99) {
          if (ema7 > ema25 && ema25 > ema99) emaTrend = '↑多头';
          else if (ema7 < ema25 && ema25 < ema99) emaTrend = '↓空头';
          else emaTrend = '→震荡';
        }
        // 稳定币净流
        const stableFlows = enh?.stablecoinFlows as Record<string, any> | undefined;
        const stablecoinNet = stableFlows?.net24h ?? stableFlows?.totalMcapChange7d ?? null;
        snapshot = {
          price: currentPrice,
          rsi7: indicatorResult.rsi7 ?? null,
          rsi14: indicatorResult.rsi ?? null,
          macdHist: indicatorResult.macd?.histogram ?? null,
          atr14: indicatorResult.atr ?? null,
          fundingRate: fundingRate ?? null,
          longShortRatio: lsr?.longShortRatio ?? null,
          longPct: lsr ? (lsr.longAccount / (lsr.longAccount + lsr.shortAccount)) * 100 : null,
          oiChange: oiChangeStr,
          oiQuadrant,
          institutionFlow: instFlow,
          emaTrend,
          stablecoinNet: typeof stablecoinNet === 'number' ? stablecoinNet : null,
          dataSources: {
            oi: openInterest != null,
            fr: fundingRate != null,
            ranking: marketRanking != null,
            enhanced: enhancedData != null,
            oiRanking: oiRanking != null,
            netFlow: netFlowRanking != null,
            priceRanking: priceRanking != null,
          },
        };
      }

      // 3. 最近交易上下文 + 历史（通过 userPromptCtx 传入 PromptBuilder，此处无需额外格式化）

      // 5. 获取现有持仓（扁平等权设计，无动态权重）
      existingPositions = await this.getExistingPositions(config.userId, config.symbol);

      // 追加指标趋势序列（供 AI 感知 RSI/MACD 动量方向）
      const indicatorSeries = this.indicators.calculateSeries(ohlcv);
      const flatIndicators = {
        ...this.flattenIndicators(indicatorResult),
        rsiSeries: indicatorSeries.rsiSeries,
        macdHistSeries: indicatorSeries.macdHistSeries,
      };

      marketDataPrompt = formatMarketDataPrompt({
        symbol: config.symbol,
        currentPrice,
        indicators: flatIndicators,
        openInterest,
        fundingRate,
        existingPositions,
        marketRanking: marketRanking || undefined,
        enhanced: enhancedData || undefined,
      });

      // 追加 NofxOS 排名数据到 Prompt（对齐 nofx FormatXXXForAI）
      const rankingSections = [
        this.nofxosRanking.formatOIRankingForAI(oiRanking),
        this.nofxosRanking.formatNetFlowRankingForAI(netFlowRanking),
        this.nofxosRanking.formatPriceRankingForAI(priceRanking),
      ].filter(Boolean).join('\n');
      if (rankingSections) {
        marketDataPrompt += '\n\n' + rankingSections;
      }
    }

    // === 极速策略增强: 格式化 4 个新数据源 ===

    // Task 1: CryptoPanic 新闻格式化
    let newsPrompt = '';
    if (Array.isArray(newsItems) && newsItems.length > 0) {
      const newsLines = newsItems.slice(0, 5).map((n: any) => {
        const tag = n.sentiment === 'positive' ? '[+]' : n.sentiment === 'negative' ? '[-]' : '[·]';
        return `  ${tag} ${n.title} (${n.source})`;
      });
      newsPrompt = `=== Recent News Events ===\n${newsLines.join('\n')}`;
    }

    // Task 2: Fear & Greed Index 格式化
    let fearGreedPrompt = '';
    if (fearGreed) {
      fearGreedPrompt = `=== Market Sentiment ===\nFear & Greed Index: ${fearGreed.value}/100 (${fearGreed.classification})\nNOTE: Extreme Fear often = buying opportunity; Extreme Greed often = caution.`;
    }

    // Task 4: LunarCrush 社媒情绪格式化
    let socialSentimentPrompt = '';
    if (lunarCrushData) {
      socialSentimentPrompt = this.lunarCrush.formatForAI(lunarCrushData);
    }

    // Task 3: BM25 记忆检索 — 当前市场场景匹配历史教训
    let memoryPrompt = '';
    try {
      // 只有非预构建模式才能拿到指标，预构建模式跳过记忆
      if (!config.precomputedMarketData && safetyIndicators) {
        const sceneText = this.memoryService.buildSceneText({
          symbol: config.symbol,
          timeframe: config.timeframe,
          rsi: safetyIndicators.rsi ?? undefined,
          macdTrend: snapshot?.macdHist != null ? (snapshot.macdHist > 0 ? 'bullish' : 'bearish') : undefined,
          atr: safetyIndicators.atr14 ?? undefined,
          fundingRate: safetyFundingRate ?? undefined,
        });
        const memories = await this.memoryService.retrieveSimilar(sceneText, config.userId, 3);
        if (memories.length > 0) {
          const memLines = memories.map((m, i) => {
            const result = m.isWin ? `Win +${m.pnlPercent?.toFixed(1)}%` : `Loss ${m.pnlPercent?.toFixed(1)}%`;
            const lesson = m.lesson ? ` | Lesson: ${m.lesson}` : '';
            return `  ${i + 1}. [${m.symbol}] ${m.action} → ${result}${lesson}`;
          });
          memoryPrompt = `=== Past Trading Experiences ===\nSimilar market conditions in the past:\n${memLines.join('\n')}`;
        }
      }
    } catch (e) {
      this.logger.warn(`[记忆检索] 失败: ${(e as Error).message}`);
    }

    // 6. 构建系统提示（Phase 9.0: 8-section 结构化 Prompt，替代扁平 QUICK_MODE_SYSTEM_PROMPT）
    const systemPrompt = this.promptBuilder.buildSystemPrompt(config.promptConfig);

    // 7. 构建用户消息（Phase 9.0: 结构化 User Prompt，注入账户/交易/持仓上下文）
    const ai = config.accountInfo;
    const userPromptCtx: UserPromptContext = {
      now: new Date(),
      cycleCount: config.cycleCount,
      runtimeMinutes: config.runtimeMinutes,
      // 账户信息: 有 accountInfo 时用真实数据，否则不传（prompt-builder 跳过该段）
      equity: ai ? (ai.allocatedCapital + ai.strategyUnrealizedPnl) : undefined,
      balance: ai?.allocatedCapital,
      marginUsage: ai && ai.allocatedCapital > 0 ? (ai.strategyMarginUsed / ai.allocatedCapital * 100) : undefined,
      positionCount: ai?.strategyPositions.length,
      exchangeEquity: ai?.exchangeTotalEquity,
      otherStrategiesCount: ai?.otherStrategiesCount,
      otherStrategiesMargin: ai?.otherStrategiesMargin,
      recentTrades: config.recentTrades?.map(t => ({
        symbol: t.symbol,
        side: t.side,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        pnl: t.pnl,
        pnlPercent: t.pnlPercent,
        holdDuration: t.holdDuration,
        closedAt: t.closedAt,
      })),
      tradingStats: config.tradingStats ? {
        totalTrades: config.tradingStats.totalTrades,
        winRate: config.tradingStats.winRate,
        profitFactor: config.tradingStats.profitFactor,
        sharpeRatio: config.tradingStats.sharpeRatio,
        totalPnl: config.tradingStats.totalPnl,
        avgWin: config.tradingStats.avgWin,
        avgLoss: config.tradingStats.avgLoss,
        maxDrawdownPct: config.tradingStats.maxDrawdownPct,
      } : undefined,
      // 持仓: 有 accountInfo 时用全策略持仓（全币种），否则降级到单币种查询
      positions: ai ? ai.strategyPositions.map(p => ({
        symbol: p.symbol,
        side: p.side,
        entryPrice: p.entryPrice,
        size: p.size,
        leverage: p.leverage,
        pnlPercent: p.pnlPercent,
        peakPnlPercent: p.peakPnlPercent,
        margin: p.margin,
        holdMinutes: (p as any).holdMinutes,
        liqPrice: (p as any).liqPrice,
      })) : existingPositions.map(p => ({
        symbol: config.symbol,
        side: p.side,
        entryPrice: p.entryPrice,
        size: p.size,
        leverage: p.leverage ?? 1,
        pnlPercent: p.pnlPercent,
        peakPnlPercent: p.peakPnlPercent,
      })),
      marketDataPrompt,
      // 极速策略增强 Task 1-4: 新闻/情绪/记忆/社媒
      newsPrompt: newsPrompt || undefined,
      fearGreedPrompt: fearGreedPrompt || undefined,
      memoryPrompt: memoryPrompt || undefined,
      socialSentimentPrompt: socialSentimentPrompt || undefined,
      liquidityData: config.liquidityData,
      debateContext: config.debateContext,
      locale: config.promptConfig?.locale,
      lastDecisions: config.lastDecisions,
      coinSourceMode: config.coinSourceMode as any,
      candidateSymbols: config.candidateSymbols,
      currentSymbol: config.symbol,
    };

    const userMessage = this.promptBuilder.buildUserPrompt(userPromptCtx);

    // 8. LLM 调用
    const response = await this.llm.chat(
      config.modelId,
      systemPrompt,
      userMessage,
      config.apiKeys,
      {
        temperature: config.temperature ?? 0.5,
        maxTokens: config.maxTokens ?? 1500,
      },
    );

    // 9. 解析 JSON 结果（Phase 9.0: 6 层鲁棒解析器，替代简单 JSON.parse）
    // P0 修复：deepseek-reasoner thinking tokens 占比过大时，content 中 <decision> JSON 可能被截断
    // 检测 content 是否包含完整 <decision>，若不完整但 thinking 有内容，合并后重新解析
    let parseInput = response.content;
    if (response.thinking && !response.content.includes('</decision>')) {
      this.logger.warn(
        `[解析修复] content 缺少完整 <decision> 标签 (${response.content.length}字符)，合并 thinking (${response.thinking.length}字符) 重试`,
      );
      parseInput = response.thinking + '\n' + response.content;
    }
    const allDecisions = parseDecisions(parseInput, config.symbol);
    const decision = allDecisions[0]; // Solo 模式取第一个决策

    // 提取 <reasoning> CoT trace（如有）— 分发给所有 decisions
    const reasoningTrace = extractReasoning(response.content);
    if (reasoningTrace) {
      // 对所有 decision: 只要 <reasoning> 内容比 JSON reasoning 更长就替换
      // 这样每个币种都能获得完整的 AI 思考过程（含账户分析+多币种市场分析）
      for (const d of allDecisions) {
        if (reasoningTrace.length > (d.reasoning?.length || 0)) {
          d.reasoning = reasoningTrace;
        }
      }
    }

    const latencyMs = Date.now() - startTime;

    // 详细日志: 决策参数 Banner + 完整思考（对齐 nofx 日志规范）
    const fullReasoning = decision.reasoning || response.content || '';
    this.logger.log(
      `[快速分析] ======== 分析完成 ========\n` +
      `  ${config.symbol} @ ${config.timeframe} (模型: ${config.modelId})\n` +
      `  决策: ${decision.action} (confidence=${decision.confidence}%)\n` +
      `  leverage=${decision.leverage}x posPct=${decision.positionSizePercent}%\n` +
      `  SL=${decision.stopLoss ?? 'none'} TP=${decision.takeProfit ?? 'none'}\n` +
      `  tokens=${response.tokenUsage || 'N/A'} 耗时=${latencyMs}ms 成本=$${response.cost.toFixed(6)}\n` +
      `  💭 AI 完整分析:\n` +
      `  ----------------------------------------------------------------------\n` +
      `  ${fullReasoning}\n` +
      `  ----------------------------------------------------------------------\n` +
      `  ================================`,
    );

    return {
      decision,
      allDecisions, // Phase 9.0 T4: 返回所有解析出的决策（多币种模式使用）
      rawResponse: response.content,
      cost: response.cost,
      latencyMs,
      indicators: safetyIndicators,
      fundingRate: safetyFundingRate,
      currentPrice: safetyCurrentPrice,
      volume24h: safetyVolume24h,
      systemPrompt,
      userPrompt: userMessage,
      aiThinking: response.thinking,
      marketSnapshot: snapshot,
    };
  }

  /**
   * 多币种批量分析（对齐 nofx GetFullDecisionWithStrategy）
   *
   * 一次 LLM 调用分析所有候选币，返回每个币种的决策。
   * 失败时降级到逐币 analyze() 调用。
   *
   * @param configs 各币种的分析配置（共享 accountInfo/recentTrades/tradingStats/promptConfig）
   * @returns 按 symbol 映射的分析结果
   */
  async analyzeMultiCoin(
    configs: QuickAnalysisConfig[],
  ): Promise<Map<string, QuickAnalysisResult>> {
    if (configs.length === 0) return new Map();
    if (configs.length === 1) {
      const result = await this.analyze(configs[0]);
      return new Map([[configs[0].symbol, result]]);
    }

    const startTime = Date.now();
    const symbols = configs.map(c => c.symbol);
    this.logger.log(`[多币种分析] 开始批量分析 ${symbols.length} 个币种: ${symbols.join(', ')}`);

    try {
      // 0. 获取 NofxOS 全局排名数据（所有币种共享，并行获取）
      const [mcOiRanking, mcNetFlowRanking, mcPriceRanking] = await Promise.all([
        this.nofxosRanking.fetchOIRanking().catch((e: any) => {
          this.logger.warn(`[数据获取] OI排名(多币种) 失败: ${e.message}`);
          return null;
        }),
        this.nofxosRanking.fetchNetFlowRanking().catch((e: any) => {
          this.logger.warn(`[数据获取] 资金流排名(多币种) 失败: ${e.message}`);
          return null;
        }),
        this.nofxosRanking.fetchPriceRanking().catch((e: any) => {
          this.logger.warn(`[数据获取] 涨跌幅排名(多币种) 失败: ${e.message}`);
          return null;
        }),
      ]);
      this.logger.log(
        `📊 [多币种] 排名数据: OI=${mcOiRanking ? '✅' : '❌'} | 资金流=${mcNetFlowRanking ? '✅' : '❌'} | 涨跌榜=${mcPriceRanking ? '✅' : '❌'}`,
      );
      const mcRankingSections = [
        this.nofxosRanking.formatOIRankingForAI(mcOiRanking),
        this.nofxosRanking.formatNetFlowRankingForAI(mcNetFlowRanking),
        this.nofxosRanking.formatPriceRankingForAI(mcPriceRanking),
      ].filter(Boolean).join('\n');

      // 1. 并行获取所有币种的市场数据
      const marketDataResults = await Promise.all(
        configs.map(async (config) => {
          try {
            const [marketData, marketRanking, enhancedData] = await Promise.all([
              this.fetchMarketData(config),
              this.marketData.fetchMarketRanking(config.symbol).catch((e: any) => {
                this.logger.warn(`[数据获取] ${config.symbol} marketRanking 失败: ${e.message}`);
                return null;
              }),
              this.marketData.fetchEnhancedMarketData(config.symbol).catch((e: any) => {
                this.logger.warn(`[数据获取] ${config.symbol} enhancedData 失败: ${e.message}`);
                return null;
              }),
            ]);
            const { ohlcv, currentPrice, openInterest, fundingRate, volume24h } = marketData;
            this.logger.log(
              `📋 [${config.symbol}] 数据摘要: K线=${ohlcv.length}条 | 价格=$${currentPrice} | ` +
              `OI=${openInterest != null ? '✅' : '❌'} | FR=${fundingRate != null ? '✅' : '❌'} | ` +
              `排名=${marketRanking ? '✅' : '❌'} | 增强=${enhancedData ? '✅' : '❌'}`,
            );
            const indicatorResult = this.indicators.calculateAll(ohlcv);
            const indicatorSeries = this.indicators.calculateSeries(ohlcv);
            const flatIndicators = {
              ...this.flattenIndicators(indicatorResult),
              rsiSeries: indicatorSeries.rsiSeries,
              macdHistSeries: indicatorSeries.macdHistSeries,
            };

            let coinPrompt = formatMarketDataPrompt({
              symbol: config.symbol,
              currentPrice,
              indicators: flatIndicators,
              openInterest,
              fundingRate,
              marketRanking: marketRanking || undefined,
              enhanced: enhancedData || undefined,
            });
            if (mcRankingSections) {
              coinPrompt += '\n\n' + mcRankingSections;
            }

            return {
              symbol: config.symbol,
              prompt: coinPrompt,
              indicators: {
                rsi: indicatorResult.rsi ?? null,
                rsi7: indicatorResult.rsi7 ?? null,
                atr3: indicatorResult.atr3,
                atr14: indicatorResult.atr,
                macdHist: indicatorResult.macd?.histogram ?? null,
              },
              fundingRate,
              currentPrice,
              volume24h,
              openInterest,
              enhancedData,
              ohlcv,
            };
          } catch (e: any) {
            this.logger.warn(`[多币种分析] ${config.symbol} 数据获取失败: ${e.message}`);
            return null;
          }
        }),
      );

      const validResults = marketDataResults.filter(Boolean) as NonNullable<typeof marketDataResults[0]>[];
      if (validResults.length === 0) {
        throw new Error('所有币种数据获取失败');
      }

      // 2. 合并所有币种数据为单一 prompt
      const combinedMarketData = validResults.map(r => r.prompt).join('\n\n');

      // 2.5 极速策略增强: 获取全局增强数据（News/F&G/Social，多币种共享）
      const [mcNews, mcFearGreed, mcSocial] = await Promise.all([
        this.marketData.fetchCryptoNews(configs[0].symbol, 5).catch(() => [] as any[]),
        this.marketData.fetchFearGreedIndex().catch(() => null),
        this.lunarCrush.fetchSocialMetrics(configs[0].symbol).catch(() => null),
      ]);
      let mcNewsPrompt = '';
      if (Array.isArray(mcNews) && mcNews.length > 0) {
        const newsLines = mcNews.slice(0, 5).map((n: any) => {
          const tag = n.sentiment === 'positive' ? '[+]' : n.sentiment === 'negative' ? '[-]' : '[·]';
          return `  ${tag} ${n.title} (${n.source})`;
        });
        mcNewsPrompt = `=== Recent News Events ===\n${newsLines.join('\n')}`;
      }
      let mcFearGreedPrompt = '';
      if (mcFearGreed) {
        mcFearGreedPrompt = `=== Market Sentiment ===\nFear & Greed Index: ${mcFearGreed.value}/100 (${mcFearGreed.classification})\nNOTE: Extreme Fear often = buying opportunity; Extreme Greed often = caution.`;
      }
      let mcSocialPrompt = '';
      if (mcSocial) {
        mcSocialPrompt = this.lunarCrush.formatForAI(mcSocial);
      }

      // 3. 使用第一个 config 的共享参数构建 prompt
      const refConfig = configs[0];
      const systemPrompt = this.promptBuilder.buildSystemPrompt(refConfig.promptConfig);

      const ai = refConfig.accountInfo;
      const userPromptCtx: UserPromptContext = {
        now: new Date(),
        cycleCount: refConfig.cycleCount,
        runtimeMinutes: refConfig.runtimeMinutes,
        equity: ai ? (ai.allocatedCapital + ai.strategyUnrealizedPnl) : undefined,
        balance: ai?.allocatedCapital,
        marginUsage: ai && ai.allocatedCapital > 0 ? (ai.strategyMarginUsed / ai.allocatedCapital * 100) : undefined,
        positionCount: ai?.strategyPositions.length,
        exchangeEquity: ai?.exchangeTotalEquity,
        otherStrategiesCount: ai?.otherStrategiesCount,
        otherStrategiesMargin: ai?.otherStrategiesMargin,
        recentTrades: refConfig.recentTrades?.map(t => ({
          symbol: t.symbol, side: t.side, entryPrice: t.entryPrice,
          exitPrice: t.exitPrice, pnl: t.pnl, pnlPercent: t.pnlPercent,
          holdDuration: t.holdDuration, closedAt: t.closedAt,
        })),
        tradingStats: refConfig.tradingStats ? {
          totalTrades: refConfig.tradingStats.totalTrades,
          winRate: refConfig.tradingStats.winRate,
          profitFactor: refConfig.tradingStats.profitFactor,
          sharpeRatio: refConfig.tradingStats.sharpeRatio,
          totalPnl: refConfig.tradingStats.totalPnl,
          avgWin: refConfig.tradingStats.avgWin,
          avgLoss: refConfig.tradingStats.avgLoss,
          maxDrawdownPct: refConfig.tradingStats.maxDrawdownPct,
        } : undefined,
        positions: ai ? ai.strategyPositions.map(p => ({
          symbol: p.symbol, side: p.side, entryPrice: p.entryPrice,
          size: p.size, leverage: p.leverage, pnlPercent: p.pnlPercent,
          peakPnlPercent: p.peakPnlPercent, margin: p.margin,
          holdMinutes: (p as any).holdMinutes, liqPrice: (p as any).liqPrice,
        })) : [],
        marketDataPrompt: combinedMarketData,
        // 极速策略增强 Task 1-4（多币种模式）
        newsPrompt: mcNewsPrompt || undefined,
        fearGreedPrompt: mcFearGreedPrompt || undefined,
        socialSentimentPrompt: mcSocialPrompt || undefined,
        // 多币种模式跳过 BM25 记忆（无单币指标上下文）
        liquidityData: configs.flatMap(c => c.liquidityData || []),
        locale: refConfig.promptConfig?.locale,
      };

      const userMessage = this.promptBuilder.buildUserPrompt(userPromptCtx);

      // 4. 单次 LLM 调用（增加 maxTokens 以容纳多决策输出）
      const response = await this.llm.chat(
        refConfig.modelId, systemPrompt, userMessage, refConfig.apiKeys,
        {
          temperature: refConfig.temperature ?? 0.5,
          maxTokens: Math.min((refConfig.maxTokens ?? 2000) * validResults.length, 12000),
        },
      );

      // 5. 解析所有决策
      const allDecisions = parseDecisions(response.content);
      const reasoningTrace = extractReasoning(response.content);
      if (reasoningTrace) {
        for (const d of allDecisions) {
          if (reasoningTrace.length > (d.reasoning?.length || 0)) d.reasoning = reasoningTrace;
        }
      }

      const latencyMs = Date.now() - startTime;
      const costPerCoin = response.cost / validResults.length;

      // 6. 按 symbol 映射结果（symbol 归一化：去除 /USDT 后缀，大写比较）
      const normalizeSymbol = (s?: string) => (s || '').replace(/\/USDT$/i, '').replace(/USDT$/i, '').toUpperCase();
      const resultMap = new Map<string, QuickAnalysisResult>();
      for (const mr of validResults) {
        const mrNorm = normalizeSymbol(mr.symbol);
        const decision = allDecisions.find(d => normalizeSymbol(d.symbol) === mrNorm);
        if (decision) {
          // 构建市场快照（多币种模式，前端日志卡片展示用）
          const enh = mr.enhancedData as Record<string, any> | null;
          const lsr = enh?.longShortRatio;
          const oiHist = enh?.oiHistory;
          let oiChangeStr: string | null = null;
          let oiQuadrant: string | null = null;
          if (Array.isArray(oiHist) && oiHist.length >= 2) {
            const latest = oiHist[oiHist.length - 1]?.sumOpenInterest ?? 0;
            const prev = oiHist[0]?.sumOpenInterest ?? 0;
            if (prev > 0) {
              const pct = ((latest - prev) / prev) * 100;
              oiChangeStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
              const ohlcvArr = mr.ohlcv;
              const lastClose = ohlcvArr?.[ohlcvArr.length - 1]?.[4] ?? 0;
              const prevClose = ohlcvArr?.[ohlcvArr.length - 2]?.[4] ?? lastClose;
              const priceUp = lastClose >= prevClose;
              const oiUp = pct >= 0;
              if (oiUp && priceUp) oiQuadrant = '多头主导';
              else if (oiUp && !priceUp) oiQuadrant = '空头主导';
              else if (!oiUp && priceUp) oiQuadrant = '空头平仓';
              else oiQuadrant = '多头清算';
            }
          }
          const mcSnapshot = {
            price: mr.currentPrice,
            rsi7: mr.indicators?.rsi7 ?? null,
            rsi14: mr.indicators?.rsi ?? null,
            macdHist: mr.indicators?.macdHist ?? null,
            atr14: mr.indicators?.atr14 ?? null,
            fundingRate: mr.fundingRate ?? null,
            longShortRatio: lsr?.longShortRatio ?? null,
            longPct: lsr ? (lsr.longAccount / (lsr.longAccount + lsr.shortAccount)) * 100 : null,
            oiChange: oiChangeStr,
            oiQuadrant,
            institutionFlow: null as number | null,
            dataSources: {
              oi: mr.openInterest != null, fr: mr.fundingRate != null,
              ranking: !!mcRankingSections, enhanced: enh != null,
              oiRanking: false, netFlow: false, priceRanking: false,
            },
          };
          resultMap.set(mr.symbol, {
            decision, allDecisions, rawResponse: response.content,
            cost: costPerCoin, latencyMs,
            indicators: mr.indicators, fundingRate: mr.fundingRate,
            currentPrice: mr.currentPrice, volume24h: mr.volume24h,
            systemPrompt, userPrompt: userMessage, aiThinking: response.thinking,
            marketSnapshot: mcSnapshot,
          });
        } else {
          this.logger.warn(`[多币种分析] ${mr.symbol} 未在 AI 响应中找到决策，降级逐币分析`);
        }
      }

      this.logger.log(
        `[多币种分析] 完成: ${resultMap.size}/${validResults.length} 个币种成功, ` +
        `耗时=${latencyMs}ms, 成本=$${response.cost.toFixed(6)}`,
      );

      // 7. 对未匹配的币种降级到逐币分析
      for (const config of configs) {
        if (!resultMap.has(config.symbol)) {
          try {
            resultMap.set(config.symbol, await this.analyze(config));
          } catch (e: any) {
            this.logger.warn(`[多币种分析] ${config.symbol} 降级分析也失败: ${e.message}`);
          }
        }
      }

      return resultMap;
    } catch (error: any) {
      // 全局 fallback: 批量失败时逐币分析
      this.logger.warn(`[多币种分析] 批量分析失败(${error.message})，降级逐币分析`);
      const resultMap = new Map<string, QuickAnalysisResult>();
      for (const config of configs) {
        try {
          resultMap.set(config.symbol, await this.analyze(config));
        } catch (e: any) {
          this.logger.warn(`[多币种分析] ${config.symbol} 逐币分析失败: ${e.message}`);
        }
      }
      return resultMap;
    }
  }

  // ==================== 数据获取 ====================

  private async fetchMarketData(config: QuickAnalysisConfig): Promise<{
    ohlcv: OHLCV[];
    currentPrice: number;
    openInterest: number | undefined;
    fundingRate: number | undefined;
    volume24h: number | undefined;
  }> {
    // 并行获取市场数据
    const [ohlcvRaw, currentPrice, oiData, frData] = await Promise.all([
      this.marketData.fetchOHLCV(config.symbol, config.timeframe, 100),
      this.marketData.fetchCurrentPrice(config.symbol),
      this.marketData.fetchOpenInterest(config.symbol).catch((e: any) => {
        this.logger.warn(`[数据获取] ${config.symbol} OI 获取失败: ${e.message}`);
        return null;
      }),
      this.marketData.fetchFundingRate(config.symbol).catch((e: any) => {
        this.logger.warn(`[数据获取] ${config.symbol} FR 获取失败: ${e.message}`);
        return null;
      }),
    ]);

    const ohlcv: OHLCV[] = ohlcvRaw.map((c) => ({
      timestamp: c[0],
      open: c[1],
      high: c[2],
      low: c[3],
      close: c[4],
      volume: c[5],
    }));

    // 从 OHLCV 聚合 24h 成交量（L10 流动性检查用）
    const barsFor24h = config.timeframe === '1h' ? 24
      : config.timeframe === '2h' ? 12
      : config.timeframe === '4h' ? 6
      : config.timeframe === '6h' ? 4
      : config.timeframe === '8h' ? 3
      : config.timeframe === '12h' ? 2
      : config.timeframe === '1d' ? 1
      : config.timeframe === '30m' ? 48
      : config.timeframe === '15m' ? 96
      : 6; // fallback
    const volume24h = ohlcv.length >= barsFor24h
      ? ohlcv.slice(-barsFor24h).reduce((sum, bar) => sum + (bar.volume || 0), 0)
      : undefined;

    return {
      ohlcv,
      currentPrice,
      openInterest: oiData?.openInterest,
      fundingRate: frData?.fundingRate,
      volume24h,
    };
  }

  // ==================== (旧 buildUserMessage/parseDecision 已由 PromptBuilderService + decision-parser 替代) ====================

  // ==================== 最近交易格式化（替代 BM25） ====================

  /**
   * 格式化最近交易记录为 prompt 文本
   * 将最近交易列表格式化为中文 prompt 文本
   */
  private formatRecentTrades(
    recentTrades?: RecentTrade[],
    tradingStats?: TradingStats,
  ): string {
    const lines: string[] = [];

    if (tradingStats && tradingStats.totalTrades > 0) {
      lines.push('--- 交易统计 ---');
      lines.push(`总交易: ${tradingStats.totalTrades}, 胜率: ${(tradingStats.winRate * 100).toFixed(1)}%, 总盈亏: $${tradingStats.totalPnl.toFixed(2)}`);
      if (tradingStats.profitFactor > 0) lines.push(`盈亏比: ${tradingStats.profitFactor}, 平均盈利: $${tradingStats.avgWin.toFixed(2)}, 平均亏损: $${tradingStats.avgLoss.toFixed(2)}`);
      if (tradingStats.sharpeRatio !== 0) lines.push(`夏普率: ${tradingStats.sharpeRatio}, 最大回撤: ${tradingStats.maxDrawdownPct.toFixed(1)}%`);
    }

    if (recentTrades && recentTrades.length > 0) {
      lines.push('--- 最近交易 ---');
      for (const t of recentTrades) {
        const emoji = t.pnl >= 0 ? '✅' : '❌';
        const prices = t.entryPrice && t.exitPrice ? ` Entry:$${t.entryPrice}→$${t.exitPrice}` : '';
        const hold = t.holdDuration && t.holdDuration !== 'N/A' ? ` Hold:${t.holdDuration}` : '';
        lines.push(`${emoji} ${t.symbol} ${t.side}${prices} | PnL: $${t.pnl.toFixed(2)} (${t.pnlPercent.toFixed(1)}%)${hold} | ${t.closedAt}`);
      }
    }

    return lines.length > 0 ? lines.join('\n') : '';
  }

  // ==================== 辅助方法 ====================

  private getMacdTrend(ind: IndicatorsResult): string {
    if (!ind.macd || ind.macd.histogram == null) return 'neutral';
    if (ind.macd.histogram > 0) return 'bullish';
    if (ind.macd.histogram < 0) return 'bearish';
    return 'neutral';
  }

  private getEmaTrend(ind: IndicatorsResult, currentPrice: number): string {
    if (!ind.ema) return 'neutral';
    if (currentPrice > (ind.ema.ema50 || 0)) return 'above';
    return 'below';
  }

  /**
   * 将 IndicatorsResult 展开为 prompt 需要的 flat 格式
   */
  private flattenIndicators(ind: IndicatorsResult): Record<string, any> {
    return {
      rsi7: ind.rsi7,
      rsi14: ind.rsi,
      macd: ind.macd?.macd,
      macdSignal: ind.macd?.signal,
      macdHistogram: ind.macd?.histogram,
      ema7: ind.ema?.ema12, // 实际为 EMA(12)，标注为短期 EMA
      ema25: ind.ema?.ema26, // 实际为 EMA(26)，标注为中期 EMA
      ema99: ind.ema?.ema50, // 实际为 EMA(50)，标注为长期 EMA (无 EMA99 计算)
      atr3: ind.atr3,
      atr14: ind.atr,
      donchianUpper: ind.donchian?.upper,
      donchianMid: ind.donchian?.middle,
      donchianLower: ind.donchian?.lower,
      obv: ind.obv,
      bollingerUpper: ind.bollingerBands?.upper,
      bollingerMid: ind.bollingerBands?.middle,
      bollingerLower: ind.bollingerBands?.lower,
    };
  }

  /**
   * 获取现有持仓（用于 prompt 注入）
   */
  private async getExistingPositions(
    userId: string,
    symbol: string,
  ): Promise<
    Array<{ side: string; entryPrice: number; size: number; pnlPercent: number; peakPnlPercent?: number; leverage?: number }>
  > {
    try {
      const positions = await this.prisma.position.findMany({
        where: {
          userId,
          symbol: { contains: symbol.replace('/USDT', '').replace('USDT', '') },
          status: 'open',
        },
        select: {
          side: true,
          entryPrice: true,
          amount: true,
          unrealizedPnl: true,
          highWaterMark: true, // 利润峰值，用于回撤保护
          margin: true,
          leverage: true,
        },
      });

      return positions.map((p) => ({
        side: p.side,
        entryPrice: Number(p.entryPrice),
        size: Number(p.amount),
        // 盈亏百分比 = 未实现盈亏(美元) / 保证金(美元) × 100
        pnlPercent: Number(p.margin) > 0
          ? (Number(p.unrealizedPnl || 0) / Number(p.margin)) * 100
          : 0,
        // PeakPnL: highWaterMark 已由 drawdown-monitor 按百分比存储，直接使用
        peakPnlPercent: p.highWaterMark ? Number(p.highWaterMark) : undefined,
        leverage: p.leverage ?? 1,
      }));
    } catch {
      return [];
    }
  }
}
