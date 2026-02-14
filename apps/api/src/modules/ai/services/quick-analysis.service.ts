import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LLMService, UserApiKeys } from './llm.service';
import { IndicatorsService, OHLCV, IndicatorsResult } from './indicators.service';
import { MarketDataService } from './market-data.service';
import { AiMemoryService } from './memory.service';
import { EvolutionService } from './evolution.service';
import { TradeHistoryService } from './trade-history.service';
import { AiTradeDecision } from '../types/ai.types';
import {
  QUICK_MODE_SYSTEM_PROMPT,
  EVOLUTION_TIER_PROMPTS,
  formatMarketDataPrompt,
  formatMemoryPrompt,
} from '../constants/prompts';

/**
 * 快速分析配置
 */
export interface QuickAnalysisConfig {
  userId: string;
  symbol: string;
  timeframe: string; // 主时间框架
  secondaryTimeframe?: string; // 副时间框架
  modelId: string; // LLM 模型
  apiKeys: UserApiKeys;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 快速分析结果
 */
export interface QuickAnalysisResult {
  decision: AiTradeDecision;
  rawResponse: string;
  cost: number;
  latencyMs: number;
  sceneText: string; // BM25 场景文本（用于后续记忆存储）
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
    private readonly memory: AiMemoryService,
    private readonly evolution: EvolutionService,
    private readonly tradeHistory: TradeHistoryService,
  ) {}

  /**
   * 执行快速分析（Solo 模式单次 LLM）
   */
  async analyze(config: QuickAnalysisConfig): Promise<QuickAnalysisResult> {
    const startTime = Date.now();

    this.logger.log(
      `[快速分析] 开始: ${config.symbol} @ ${config.timeframe}, 模型: ${config.modelId}`,
    );

    // 1. 获取市场数据
    const { ohlcv, currentPrice, openInterest, fundingRate } =
      await this.fetchMarketData(config);

    // 2. 计算技术指标
    const indicatorResult = this.indicators.calculateAll(ohlcv);

    // 3. 获取 BM25 记忆
    const sceneText = this.memory.buildSceneText({
      symbol: config.symbol,
      timeframe: config.timeframe,
      rsi: indicatorResult.rsi,
      macdTrend: this.getMacdTrend(indicatorResult),
      emaTrend: this.getEmaTrend(indicatorResult, currentPrice),
      atr: indicatorResult.atr,
      volumeTrend: undefined, // 从 OHLCV 计算
      fundingRate,
    });

    const memories = await this.memory.retrieveSimilar(
      sceneText,
      config.userId,
      5, // topK
    );

    // 4. 获取交易历史
    const tradeHistoryPrompt = await this.tradeHistory.formatTradeHistoryForPrompt(
      config.userId,
    );

    // 5. 获取进化 Tier
    const evolutionState = await this.evolution.getEvolutionState(config.userId);
    const evolutionPrompt = EVOLUTION_TIER_PROMPTS[evolutionState.tier] || '';
    const resolvedEvolutionPrompt = evolutionPrompt.replace(
      '{sharpe}',
      evolutionState.sharpe?.toFixed(2) ?? 'N/A',
    );

    // 6. 获取现有持仓
    const existingPositions = await this.getExistingPositions(
      config.userId,
      config.symbol,
    );

    // 7. 构建系统提示
    const memoryPrompt =
      memories.length > 0
        ? formatMemoryPrompt(
            memories.map((m) => ({
              sceneText: m.sceneText,
              action: m.action,
              pnl: m.pnl ?? 0,
              isWin: m.isWin ?? false,
              lesson: m.lesson || undefined,
            })),
          )
        : '';

    const systemPrompt = QUICK_MODE_SYSTEM_PROMPT
      .replace('{EVOLUTION_CONTEXT}', resolvedEvolutionPrompt)
      .replace('{MEMORY_CONTEXT}', memoryPrompt);

    // 8. 构建用户消息（市场数据 + 指标）
    const userMessage = this.buildUserMessage(
      config,
      currentPrice,
      indicatorResult,
      openInterest,
      fundingRate,
      existingPositions,
      tradeHistoryPrompt,
    );

    // 9. LLM 调用
    const response = await this.llm.chat(
      config.modelId,
      systemPrompt,
      userMessage,
      config.apiKeys,
      {
        temperature: config.temperature ?? 0.5,
        maxTokens: config.maxTokens ?? 800,
      },
    );

    // 10. 解析 JSON 结果
    const decision = this.parseDecision(response.content, currentPrice);

    // 11. 应用进化 Tier 调整
    this.applyEvolutionAdjustments(decision, evolutionState.tier);

    const latencyMs = Date.now() - startTime;

    this.logger.log(
      `[快速分析] 完成: ${config.symbol} → ${decision.action} (confidence=${decision.confidence}), ` +
        `耗时 ${latencyMs}ms, 成本 $${response.cost.toFixed(6)}`,
    );

    return {
      decision,
      rawResponse: response.content,
      cost: response.cost,
      latencyMs,
      sceneText,
    };
  }

  // ==================== 数据获取 ====================

  private async fetchMarketData(config: QuickAnalysisConfig): Promise<{
    ohlcv: OHLCV[];
    currentPrice: number;
    openInterest: number | undefined;
    fundingRate: number | undefined;
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

    return {
      ohlcv,
      currentPrice,
      openInterest: oiData?.openInterest,
      fundingRate: frData?.fundingRate,
    };
  }

  // ==================== 消息构建 ====================

  private buildUserMessage(
    config: QuickAnalysisConfig,
    currentPrice: number,
    indicators: IndicatorsResult,
    openInterest: number | undefined,
    fundingRate: number | undefined,
    existingPositions: Array<{
      side: string;
      entryPrice: number;
      size: number;
      pnlPercent: number;
    }>,
    tradeHistoryPrompt: string,
  ): string {
    const marketDataPrompt = formatMarketDataPrompt({
      symbol: config.symbol,
      currentPrice,
      indicators: this.flattenIndicators(indicators),
      openInterest,
      fundingRate,
      existingPositions,
    });

    const lines = [marketDataPrompt];

    if (tradeHistoryPrompt) {
      lines.push('', '--- Recent Trade History ---');
      lines.push(tradeHistoryPrompt);
    }

    lines.push('', `Analyze ${config.symbol} on ${config.timeframe} timeframe and provide your decision.`);

    return lines.join('\n');
  }

  // ==================== JSON 解析 ====================

  private parseDecision(content: string, currentPrice: number): AiTradeDecision {
    try {
      // 从 markdown code block 中提取 JSON
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);

      const action = this.normalizeAction(parsed.action || parsed.vote);

      return {
        action,
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        leverage: parsed.leverage || 1,
        positionSizePercent: parsed.positionSizePercent || parsed.positionSize || 3,
        stopLoss: parsed.stopLoss ?? null,
        takeProfit: parsed.targetPrice ?? parsed.takeProfit ?? null,
        reasoning: parsed.reasoning || '无法解析分析理由',
      };
    } catch {
      this.logger.warn('[快速分析] JSON 解析失败，返回保守默认值');
      return {
        action: 'wait',
        confidence: 0,
        leverage: 1,
        positionSizePercent: 0,
        stopLoss: null,
        takeProfit: null,
        reasoning: `JSON 解析失败。原始响应: ${content.slice(0, 300)}`,
      };
    }
  }

  private normalizeAction(
    raw: string,
  ): AiTradeDecision['action'] {
    const lower = (raw || '').toLowerCase().replace(/[^a-z_]/g, '');
    const valid = [
      'open_long',
      'open_short',
      'close_long',
      'close_short',
      'hold',
      'wait',
    ];
    if (valid.includes(lower)) return lower as AiTradeDecision['action'];

    // 兼容旧格式
    if (lower === 'buy' || lower === 'long') return 'open_long';
    if (lower === 'sell' || lower === 'short') return 'open_short';
    return 'wait';
  }

  // ==================== 进化调整 ====================

  /**
   * 根据进化 Tier 调整决策参数
   *
   * Tier 0: 暂停（不应到这里）
   * Tier 1: 保守 — confidence ≥ 80 才执行，仓位减半
   * Tier 2: 标准 — 不调整
   * Tier 3: 积极 — confidence ≥ 55 可执行，仓位最高 8%
   */
  private applyEvolutionAdjustments(
    decision: AiTradeDecision,
    tier: number,
  ): void {
    if (tier === 1) {
      // 保守模式: 低于 80 confidence 的开仓行为降级为 hold
      if (
        decision.confidence < 80 &&
        (decision.action === 'open_long' || decision.action === 'open_short')
      ) {
        this.logger.log(
          `[进化调整] Tier1 保守: ${decision.action} confidence=${decision.confidence} < 80, 降级为 hold`,
        );
        decision.action = 'hold';
      }
      // 仓位减半
      decision.positionSizePercent = Math.max(
        1,
        Math.round(decision.positionSizePercent / 2),
      );
    } else if (tier === 3) {
      // 积极模式: 允许仓位最高 8%
      if (decision.positionSizePercent < 8) {
        decision.positionSizePercent = Math.min(
          8,
          decision.positionSizePercent * 1.3,
        );
      }
    }
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
      ema7: ind.ema?.ema12, // 最接近的 EMA
      ema25: ind.ema?.ema26,
      ema99: ind.ema?.ema50, // 使用 ema50 近似
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
    Array<{ side: string; entryPrice: number; size: number; pnlPercent: number }>
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
        },
      });

      return positions.map((p) => ({
        side: p.side,
        entryPrice: Number(p.entryPrice),
        size: Number(p.amount),
        pnlPercent: Number(p.unrealizedPnl || 0),
      }));
    } catch {
      return [];
    }
  }
}
