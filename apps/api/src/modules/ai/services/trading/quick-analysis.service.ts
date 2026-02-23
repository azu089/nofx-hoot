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

/**
 * 最近交易记录（替代 BM25 记忆，轻量上下文）
 * 对齐 NoFx RecentOrder (kernel/engine.go L94-105): 9 字段
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
 * 对齐 NoFx TradingStats (kernel/engine.go L83-92): 8 字段
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

    if (config.precomputedMarketData) {
      // 多币种模式: 市场数据已由调用方预构建
      marketDataPrompt = config.precomputedMarketData;
    } else {
      // 1. 获取市场数据 + 市场排名 + 增强数据（并行，对齐 NoFx RankingDataType）
      const [marketData, marketRanking, enhancedData] = await Promise.all([
        this.fetchMarketData(config),
        this.marketData.fetchMarketRanking(config.symbol).catch(() => null),
        this.marketData.fetchEnhancedMarketData(config.symbol).catch(() => null),
      ]);
      const { ohlcv, currentPrice, openInterest, fundingRate, volume24h } = marketData;
      safetyVolume24h = volume24h;

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

      // 3. 构建最近交易上下文（替代 BM25 记忆，NoFx 轻量设计）
      this.formatRecentTrades(config.recentTrades, config.tradingStats);

      // 4. 获取交易历史
      await this.tradeHistory.formatTradeHistoryForPrompt(config.userId);

      // 5. 获取现有持仓（对齐 NoFx: 无 Evolution Tier，扁平等权设计）
      existingPositions = await this.getExistingPositions(config.userId, config.symbol);

      marketDataPrompt = formatMarketDataPrompt({
        symbol: config.symbol,
        currentPrice,
        indicators: this.flattenIndicators(indicatorResult),
        openInterest,
        fundingRate,
        existingPositions,
        marketRanking: marketRanking || undefined,
        enhanced: enhancedData || undefined,
      });
    }

    // 6. 构建系统提示（Phase 9.0: 8-section 结构化 Prompt，替代扁平 QUICK_MODE_SYSTEM_PROMPT）
    const systemPrompt = this.promptBuilder.buildSystemPrompt(config.promptConfig);

    // 7. 构建用户消息（Phase 9.0: 结构化 User Prompt，注入账户/交易/持仓上下文）
    const ai = config.accountInfo;
    const userPromptCtx: UserPromptContext = {
      now: new Date(),
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
      liquidityData: config.liquidityData,
      debateContext: config.debateContext,
      locale: config.promptConfig?.locale,
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
    const allDecisions = parseDecisions(response.content, config.symbol);
    const decision = allDecisions[0]; // Solo 模式取第一个决策

    // 提取 <reasoning> CoT trace（如有）— 优先使用更详细的版本
    const reasoningTrace = extractReasoning(response.content);
    if (reasoningTrace && reasoningTrace.length > (decision.reasoning?.length || 0)) {
      decision.reasoning = reasoningTrace;
    }

    const latencyMs = Date.now() - startTime;

    // 详细日志: LLM 原始思考预览 + 决策参数 Banner
    const thinkingPreview = (decision.reasoning || response.content || '').slice(0, 300);
    this.logger.log(
      `[快速分析] ======== 分析完成 ========\n` +
      `  ${config.symbol} @ ${config.timeframe} (模型: ${config.modelId})\n` +
      `  决策: ${decision.action} (confidence=${decision.confidence}%)\n` +
      `  leverage=${decision.leverage}x posPct=${decision.positionSizePercent}%\n` +
      `  SL=${decision.stopLoss ?? 'none'} TP=${decision.takeProfit ?? 'none'}\n` +
      `  tokens=${response.tokenUsage || 'N/A'} 耗时=${latencyMs}ms 成本=$${response.cost.toFixed(6)}\n` +
      `  思考: ${thinkingPreview}${thinkingPreview.length >= 300 ? '...' : ''}\n` +
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
    };
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
      this.marketData.fetchOpenInterest(config.symbol).catch(() => null),
      this.marketData.fetchFundingRate(config.symbol).catch(() => null),
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
    const barsFor24h = config.timeframe === '4h' ? 6 : config.timeframe === '1h' ? 24 : 6;
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
   * 参考 NoFx formatRecentTradesZH 设计
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
          highWaterMark: true, // 对齐 NoFx PeakPnLPct
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
