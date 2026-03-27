import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LLMService, UserApiKeys } from '../llm.service';
import { IndicatorsService, OHLCV, IndicatorsResult } from '../indicators.service';
import { MarketDataService } from '../market-data.service';
import { TradeHistoryService } from '../trade-history.service';
import { AiTradeDecision } from '../../types/ai.types';
import { formatMarketDataPrompt } from '../../constants/prompts';
import { PromptBuilderService, PromptConfig, UserPromptContext } from './prompt-builder.service';
import { parseDecisions, parseDecisionsWithAnalysis } from '../../utils/decision-parser';
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
  closeReason?: string;   // 平仓原因：peak_drawdown / ai_decision / not_found_on_exchange / manual 等
  peakPnlPct?: number;    // 持仓期间峰值盈利%（peak_drawdown 时有值）
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
      quantity: number;
      leverage: number;
      pnlPercent: number;
      peakPnlPercent?: number;
      margin: number;
    }>;
    otherStrategiesCount: number;
    otherStrategiesMargin: number;
    /** 交易所活跃条件单（SL/TP），按持仓 symbol 过滤后传入 */
    stopOrders?: Array<{
      symbol: string;
      type: 'stop_loss' | 'take_profit' | 'trailing_stop' | 'other';
      triggerPrice: number;
      side: string;
      quantity: number;
      orderId: string;
    }>;
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
  /** AI 整体市场分析（对齐网格 analysis 字段，给用户看） */
  analysis?: string;
  /** DeepSeek-Reasoner 思考链（仅 DeepSeek 有，可展开查看） */
  aiThinking?: string;
  /** 市场数据快照（前端日志卡片展示，对齐 Grid 的 gridSnapshot） */
  marketSnapshot?: MarketSnapshot;
  /** 全局增强数据快照（多币种共享，新闻/恐贪/社媒/BTC参考，前端日志展示） */
  globalSnapshot?: {
    newsItems?: Array<{ title: string; source: string; sentiment: string }>;
    fearGreed?: { value: number; classification: string } | null;
    socialSentiment?: string | null;
    btcRef?: { price: number; change1h: number; change4h: number; rsi?: number } | null;
  };
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
  fearGreed?: number | null;        // 恐惧贪婪指数 0-100
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
    let existingPositions: Array<{ side: string; entryPrice: number; quantity: number; pnlPercent: number; peakPnlPercent?: number; leverage?: number }> = [];
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
    let _btcRef: { price: number; change1h: number; change4h: number; rsi?: number } | null = null;

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
      const [marketData, marketRanking, enhancedData, oiRanking, netFlowRanking, priceRanking, __btcRef] = await Promise.all([
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
        // BTC 参考数据（对齐 nofx BuildUserPrompt: BTC price + 1h/4h change + RSI）
        (async () => {
          try {
            const btcSymbol = 'BTC/USDT:USDT';
            if (config.symbol === btcSymbol) return null; // 当前币就是 BTC 则跳过
            const btcRaw = await this.marketData.fetchOHLCV(btcSymbol, '1h', 50);
            if (!btcRaw || btcRaw.length < 14) return null;
            const btcOhlcv = btcRaw.map((c: any) => ({ timestamp: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] }));
            const btcInd = this.indicators.calculateAll(btcOhlcv);
            const btcPrice = btcOhlcv[btcOhlcv.length - 1]?.close ?? 0;
            const btcPrice1hAgo = btcOhlcv[btcOhlcv.length - 2]?.close ?? btcPrice;
            const btcPrice4hAgo = btcOhlcv[btcOhlcv.length - 5]?.close ?? btcPrice;
            return {
              price: btcPrice,
              change1h: btcPrice1hAgo > 0 ? ((btcPrice - btcPrice1hAgo) / btcPrice1hAgo) * 100 : 0,
              change4h: btcPrice4hAgo > 0 ? ((btcPrice - btcPrice4hAgo) / btcPrice4hAgo) * 100 : 0,
              rsi: btcInd.rsi7 ?? btcInd.rsi ?? undefined,
            };
          } catch { return null; }
        })(),
      ]);
      const { ohlcv, currentPrice, openInterest, fundingRate, volume24h } = marketData;
      safetyVolume24h = volume24h;
      _btcRef = __btcRef as any;

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
          fearGreed: null,
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
        volume24h,
        // 对齐 nofx: 注入最近 30 根原始 K 线（让 AI 看到价格形态）
        ohlcv: ohlcv.slice(-30).map(c => ({ open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
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

    // Task 1: CryptoPanic 新闻 — 暂停注入（API 404，备用数据质量低，避免误导 AI 决策）
    const newsPrompt = '';

    // Task 2: Fear & Greed Index — 暂停注入（nofx 无此数据源，guidance 文案存在方向偏差误导风险）
    const fearGreedPrompt = '';

    // Task 4: LunarCrush 社媒情绪 — 暂停注入（数据源不稳定，降级后质量低）
    const socialSentimentPrompt = '';

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
    // BTC 参考数据注入（对齐 nofx BuildUserPrompt: BTC market snapshot）

    const userPromptCtx: UserPromptContext = {
      now: new Date(),
      cycleCount: config.cycleCount,
      runtimeMinutes: config.runtimeMinutes,
      // BTC 参考（对齐 nofx: BTC price + 1h/4h change + RSI）
      btcPrice: _btcRef?.price,
      btcChange1h: _btcRef?.change1h,
      btcChange4h: _btcRef?.change4h,
      btcRsi: _btcRef?.rsi,
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
        closeReason: t.closeReason,
        peakPnlPct: t.peakPnlPct,
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
      positions: ai ? ai.strategyPositions.map(p => {
        const mp = (p as any).markPrice ?? p.entryPrice;
        const unrealPnl = p.margin > 0 ? (p.pnlPercent / 100) * p.margin : 0;
        return {
          symbol: p.symbol,
          side: p.side,
          entryPrice: p.entryPrice,
          quantity: p.quantity,
          leverage: p.leverage,
          pnlPercent: p.pnlPercent,
          peakPnlPercent: p.peakPnlPercent,
          margin: p.margin,
          holdMinutes: (p as any).holdMinutes,
          liqPrice: (p as any).liqPrice,
          markPrice: mp || undefined,
          pnlAmount: unrealPnl,
        };
      }) : existingPositions.map(p => ({
        symbol: config.symbol,
        side: p.side,
        entryPrice: p.entryPrice,
        quantity: p.quantity,
        leverage: p.leverage ?? 1,
        pnlPercent: p.pnlPercent,
        peakPnlPercent: p.peakPnlPercent,
      })),
      marketDataPrompt,
      // 对齐 nofx: 持仓币市场数据紧跟持仓后（从 marketDataPrompt 复用，不额外调 API）
      positionMarketDataMap: (() => {
        const positions = ai?.strategyPositions || [];
        if (positions.length === 0) return undefined;
        const map: Record<string, string> = {};
        // 当前币如果在持仓中，把它的 marketDataPrompt 放入 map
        const currentSymbolInPos = positions.some(p => p.symbol === config.symbol);
        if (currentSymbolInPos && marketDataPrompt) {
          map[config.symbol] = marketDataPrompt;
        }
        return Object.keys(map).length > 0 ? map : undefined;
      })(),
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
      // 交易所活跃条件单（SL/TP）— 让 AI 感知已有保护，避免重复下单
      stopOrders: config.accountInfo?.stopOrders,
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

    // 9. 解析 JSON 结果（对齐网格: 优先 {analysis, decisions} 格式，降级到 XML 标签）
    let parseInput = response.content;
    if (response.thinking && !response.content.includes('}') && !response.content.includes('</decision>')) {
      this.logger.warn(
        `[解析修复] content 不完整 (${response.content.length}字符)，合并 thinking (${response.thinking.length}字符) 重试`,
      );
      parseInput = response.thinking + '\n' + response.content;
    }
    const { decisions: allDecisions, analysis: marketAnalysis } = parseDecisionsWithAnalysis(parseInput, config.symbol);
    const decision = allDecisions[0];

    const latencyMs = Date.now() - startTime;
    this.logger.log(
      `[快速分析] ${config.symbol} → ${decision.action} (${decision.confidence}%) ` +
      `lev=${decision.leverage}x 耗时=${latencyMs}ms analysis=${marketAnalysis ? marketAnalysis.length + '字' : 'none'}`,
    );

    // 对齐 nofx CoTTrace 统一策略：用户只看一个 analysis 字段
    // 优先级：<reasoning>标签内容 → thinking（DeepSeek-Reasoner）→ 空
    // 当 <reasoning> 太短（<50字）但 thinking 有完整推理时，用 thinking 替代
    const MIN_ANALYSIS_LENGTH = 50;
    let unifiedAnalysis = marketAnalysis;
    if (response.thinking && (!unifiedAnalysis || unifiedAnalysis.length < MIN_ANALYSIS_LENGTH)) {
      unifiedAnalysis = response.thinking;
      this.logger.log(
        `[CoTTrace统一] <reasoning>内容过短(${marketAnalysis?.length ?? 0}字)，使用 thinking(${response.thinking.length}字) 作为用户可见分析`,
      );
    }

    // 清理 markdown 格式 + 智能分段（DeepSeek R1 thinking 模式顽固输出密集文本）
    if (unifiedAnalysis) {
      unifiedAnalysis = unifiedAnalysis
        .replace(/\*\*/g, '')                     // 去掉 **bold**
        .replace(/^#{1,4}\s+/gm, '')              // 去掉 ## 标题
        .replace(/^\d+\.\s+/gm, '')               // 去掉 "1. " 编号开头
        .replace(/^\s*[a-e]\.\s+/gm, '')          // 去掉 "a. " 子编号
        .replace(/^[-*]\s+/gm, '')                 // 去掉 "- " 列表项
        .replace(/\n{3,}/g, '\n\n');               // 多余空行压缩

      // 智能分段：只在关键位置断段，避免过度分段
      unifiedAnalysis = unifiedAnalysis
        // 币种切换处断段
        .replace(/(。\s*)(接着分析|再看|接下来|对于|最后分析|然后是|其次|Now let|Next|Finally|Looking at|For )/g, '$1\n\n$2')
        // "我决定"/"I decide" 之后断段
        .replace(/(我决定[^。]*。|I decide[^.]*\.)\s*(?!\n)/g, '$1\n\n')
        .replace(/\n{3,}/g, '\n\n');
    }

    // 后端补偿：如果 JSON reasoning 太短（<50字），从整体分析中提取该币段落填充
    // 解决 DeepSeek-Reasoner content 极短、小模型忽略指令的问题
    const MIN_REASONING_LENGTH = 50;
    for (const d of allDecisions) {
      if (!d.reasoning || d.reasoning.length < MIN_REASONING_LENGTH) {
        const sym = (d.symbol || config.symbol).replace(/\/USDT.*$/, '').toUpperCase();
        // 从整体分析中提取该币种相关段落
        if (unifiedAnalysis) {
          const lines = unifiedAnalysis.split('\n');
          const coinLines = lines.filter(l => {
            const upper = l.toUpperCase();
            return upper.includes(sym) || upper.includes(`**${sym}`) || upper.startsWith(sym);
          });
          if (coinLines.length > 0) {
            d.reasoning = coinLines.join(' ').trim();
            continue;
          }
        }
        // 最终兜底：用 marketSnapshot 构建简要描述
        if (snapshot) {
          const parts: string[] = [];
          if (snapshot.rsi14 != null) parts.push(`RSI(14)=${snapshot.rsi14.toFixed(1)}`);
          if (snapshot.emaTrend) parts.push(`EMA ${snapshot.emaTrend}`);
          if (snapshot.oiQuadrant) parts.push(`OI: ${snapshot.oiQuadrant}`);
          if (snapshot.fundingRate != null) parts.push(`FR=${(snapshot.fundingRate * 100).toFixed(3)}%`);
          if (parts.length > 0) {
            d.reasoning = `${sym}: ${parts.join(', ')}. ${d.reasoning || ''}`.trim();
          }
        }
      }
    }

    // 清理每个 decision 的 reasoning 中的 markdown 格式
    for (const d of allDecisions) {
      if (d.reasoning) {
        d.reasoning = d.reasoning
          .replace(/\*\*/g, '')
          .replace(/^#{1,4}\s+/gm, '')
          .replace(/^\d+\.\s+/gm, '')
          .replace(/^[-*]\s+/gm, '')
          .trim();
      }
    }

    return {
      decision: allDecisions[0] || decision, // 补偿后的决策
      allDecisions,
      rawResponse: response.content,
      cost: response.cost,
      latencyMs,
      indicators: safetyIndicators,
      fundingRate: safetyFundingRate,
      currentPrice: safetyCurrentPrice,
      volume24h: safetyVolume24h,
      systemPrompt,
      userPrompt: userMessage,
      // 对齐 nofx: analysis = 用户看到的唯一分析（CoTTrace），所有模型统一
      analysis: unifiedAnalysis,
      // aiThinking 保留为调试字段（仅 DeepSeek-Reasoner/Claude 有）
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
              ohlcv: ohlcv.slice(-30).map(c => ({ open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })),
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
                // EMA 值（供 marketSnapshot emaTrend 计算）
                ema12: indicatorResult.ema?.ema12 ?? null,
                ema26: indicatorResult.ema?.ema26 ?? null,
                ema50: indicatorResult.ema?.ema50 ?? null,
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

      // 2.5 极速策略增强: 获取全局增强数据（BTC/News/F&G/Social，多币种共享）
      // 新闻/F&G/社媒 fetch 已移除（nofx 无这些数据源，guidance 存在方向偏差，数据源不稳定）
      const [mcBtcRef] = await Promise.all([
        // BTC 参考（对齐 nofx: 候选币包含 BTC 时跳过，避免 MARKET DATA 重复）
        (async () => {
          try {
            const hasBtcCandidate = configs.some(c => c.symbol === 'BTC/USDT:USDT');
            if (hasBtcCandidate) return null; // BTC 已是候选币，MARKET DATA 段已有完整数据
            const btcRaw = await this.marketData.fetchOHLCV('BTC/USDT:USDT', '1h', 50);
            if (!btcRaw || btcRaw.length < 14) return null;
            const btcOhlcv = btcRaw.map((c: any) => ({ timestamp: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] }));
            const btcInd = this.indicators.calculateAll(btcOhlcv);
            const btcPrice = btcOhlcv[btcOhlcv.length - 1]?.close ?? 0;
            const btcPrice1hAgo = btcOhlcv[btcOhlcv.length - 2]?.close ?? btcPrice;
            const btcPrice4hAgo = btcOhlcv[btcOhlcv.length - 5]?.close ?? btcPrice;
            return {
              price: btcPrice,
              change1h: btcPrice1hAgo > 0 ? ((btcPrice - btcPrice1hAgo) / btcPrice1hAgo) * 100 : 0,
              change4h: btcPrice4hAgo > 0 ? ((btcPrice - btcPrice4hAgo) / btcPrice4hAgo) * 100 : 0,
              rsi: btcInd.rsi7 ?? btcInd.rsi ?? undefined,
            };
          } catch { return null; }
        })(),
      ]);
      const mcNewsPrompt = '';
      const mcFearGreedPrompt = '';
      const mcSocialPrompt = '';

      // 3. 使用第一个 config 的共享参数构建 prompt
      const refConfig = configs[0];
      const systemPrompt = this.promptBuilder.buildSystemPrompt(refConfig.promptConfig);

      const ai = refConfig.accountInfo;
      const mcBtc = mcBtcRef as { price: number; change1h: number; change4h: number; rsi?: number } | null;
      const userPromptCtx: UserPromptContext = {
        now: new Date(),
        cycleCount: refConfig.cycleCount,
        runtimeMinutes: refConfig.runtimeMinutes,
        btcPrice: mcBtc?.price,
        btcChange1h: mcBtc?.change1h,
        btcChange4h: mcBtc?.change4h,
        btcRsi: mcBtc?.rsi,
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
          closeReason: t.closeReason, peakPnlPct: t.peakPnlPct,
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
          quantity: p.quantity, leverage: p.leverage, pnlPercent: p.pnlPercent,
          peakPnlPercent: p.peakPnlPercent, margin: p.margin,
          holdMinutes: (p as any).holdMinutes, liqPrice: (p as any).liqPrice,
        })) : [],
        marketDataPrompt: combinedMarketData,
        // 极速策略增强 Task 1-4（多币种模式）
        newsPrompt: mcNewsPrompt || undefined,
        fearGreedPrompt: mcFearGreedPrompt || undefined,
        socialSentimentPrompt: mcSocialPrompt || undefined,
        // 多币种模式跳过 BM25 记忆（无单币指标上下文，无法匹配场景）
        liquidityData: configs.flatMap(c => c.liquidityData || []),
        locale: refConfig.promptConfig?.locale,
        // 上轮 AI 决策（提供决策连续性，避免重复分析）
        lastDecisions: refConfig.lastDecisions,
        // 币种来源配置
        coinSourceMode: refConfig.coinSourceMode as any,
        candidateSymbols: refConfig.candidateSymbols,
        // 交易所活跃条件单（SL/TP）— 让 AI 感知已有保护，避免重复下单
        stopOrders: refConfig.accountInfo?.stopOrders,
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

      // 5. 解析所有决策（对齐网格: 优先 {analysis, decisions} 格式）
      const { decisions: allDecisions, analysis: marketAnalysis } = parseDecisionsWithAnalysis(response.content);

      // 对齐 nofx CoTTrace 统一：<reasoning> 太短时用 thinking 替代
      let mcUnifiedAnalysis = marketAnalysis;
      if (response.thinking && (!mcUnifiedAnalysis || mcUnifiedAnalysis.length < 50)) {
        mcUnifiedAnalysis = response.thinking;
      }

      const latencyMs = Date.now() - startTime;
      const costPerCoin = response.cost / validResults.length;

      // 5.5 后端补偿：多币种模式下 JSON reasoning 太短时，从整体分析提取该币段落
      for (const d of allDecisions) {
        if (!d.reasoning || d.reasoning.length < 50) {
          const sym = (d.symbol || '').replace(/\/USDT.*$/, '').toUpperCase();
          if (mcUnifiedAnalysis && sym) {
            const lines = mcUnifiedAnalysis.split('\n');
            const coinLines = lines.filter(l => {
              const upper = l.toUpperCase();
              return upper.includes(sym) || upper.includes(`**${sym}`) || upper.startsWith(sym);
            });
            if (coinLines.length > 0) {
              d.reasoning = coinLines.join(' ').trim();
            }
          }
        }
      }

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
          // EMA 趋势（和单币模式同逻辑，来自 indicatorResult.ema）
          const _ema7 = mr.indicators?.ema12 ?? 0;
          const _ema25 = mr.indicators?.ema26 ?? 0;
          const _ema99 = mr.indicators?.ema50 ?? 0;
          let mcEmaTrend: string | null = null;
          if (_ema7 && _ema25 && _ema99) {
            if (_ema7 > _ema25 && _ema25 > _ema99) mcEmaTrend = '↑多头';
            else if (_ema7 < _ema25 && _ema25 < _ema99) mcEmaTrend = '↓空头';
            else mcEmaTrend = '→震荡';
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
            emaTrend: mcEmaTrend,
            fearGreed: null,
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
            systemPrompt, userPrompt: userMessage,
            analysis: mcUnifiedAnalysis,
            aiThinking: response.thinking,
            marketSnapshot: mcSnapshot,
            globalSnapshot: {
              newsItems: undefined,
              fearGreed: null,
              socialSentiment: null,
              btcRef: mcBtc as any,
            },
          });
        } else {
          // 对齐 nofx: AI 未输出该币决策 = 隐含 wait（无持仓）或 hold（有持仓）
          // 禁止降级逐币分析（会导致 reasoning 和 decision 来自不同 LLM 调用，前端展示与执行不一致）
          const hasPosition = userPromptCtx.positions?.some(p => p.symbol === mr.symbol);
          const fallbackAction = hasPosition ? 'hold' : 'wait';
          this.logger.warn(
            `[多币种分析] ${mr.symbol} 未在 AI 响应中找到决策，对齐 nofx 设为 ${fallbackAction}（不降级逐币）`,
          );
          const fallbackDecision: AiTradeDecision = {
            symbol: mr.symbol,
            action: fallbackAction as any,
            confidence: 0,
            reasoning: `AI 多币种分析中未输出该币决策，默认 ${fallbackAction}`,
            leverage: 0,
            positionSizePercent: 0,
            stopLoss: 0,
            takeProfit: 0,
          };
          resultMap.set(mr.symbol, {
            decision: fallbackDecision,
            allDecisions: [...allDecisions, fallbackDecision],
            rawResponse: response.content,
            cost: costPerCoin, latencyMs,
            indicators: mr.indicators, fundingRate: mr.fundingRate,
            currentPrice: mr.currentPrice, volume24h: mr.volume24h,
            systemPrompt, userPrompt: userMessage,
            analysis: mcUnifiedAnalysis,
            aiThinking: response.thinking,
            globalSnapshot: {
              newsItems: undefined,
              fearGreed: null,
              socialSentiment: null,
              btcRef: mcBtc as any,
            },
          });
        }
      }

      this.logger.log(
        `[多币种分析] 完成: ${resultMap.size}/${validResults.length} 个币种成功, ` +
        `耗时=${latencyMs}ms, 成本=$${response.cost.toFixed(6)}`,
      );

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
        const reasonMap: Record<string, string> = {
          'peak_drawdown': t.peakPnlPct != null ? `峰值回撤止盈(峰+${t.peakPnlPct.toFixed(1)}%)` : '峰值回撤止盈',
          'ai_decision': 'AI主动平仓',
          'not_found_on_exchange': '条件单/强平',
          'stop_loss': '止损',
          'take_profit': '止盈',
          'manual': '手动平仓',
          'grid_stop_condition': '网格止损',
        };
        const reasonLabel = t.closeReason ? ` | 原因:${reasonMap[t.closeReason] ?? t.closeReason}` : '';
        lines.push(`${emoji} ${t.symbol} ${t.side}${prices} | PnL: $${t.pnl.toFixed(2)} (${t.pnlPercent.toFixed(1)}%)${hold}${reasonLabel} | ${t.closedAt}`);
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
    Array<{ side: string; entryPrice: number; quantity: number; pnlPercent: number; peakPnlPercent?: number; leverage?: number }>
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
        quantity: Number(p.amount),
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
