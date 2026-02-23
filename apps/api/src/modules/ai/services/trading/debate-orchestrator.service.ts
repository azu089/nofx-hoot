import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { DebateService, DebateConfig, MarketContext, DebateResult } from '../research/debate.service';
import { RiskDebateService, RiskDebateConfig, RiskDebateInput, RiskDebateResult } from '../research/risk-debate.service';
import { ConsensusService, ConsensusConfig, ConsensusResult } from './consensus.service';
import { MarketDataService } from '../market-data.service';
import { IndicatorsService, OHLCV } from '../indicators.service';
import { AiMemoryService } from '../memory.service';
import { TradeHistoryService } from '../trade-history.service';
import { TradingGateway } from '../../../../gateways/trading.gateway';
import { UserApiKeys } from '../llm.service';
import { AiTradeDecision, AiAction } from '../../types/ai.types';
import { AI_MODELS, formatMarketDataPrompt } from '../../constants/prompts';
import { PromptConfig } from './prompt-builder.service';

// ========================= 接口定义 =========================

/**
 * 编排器输入配置
 */
export interface OrchestratorConfig {
  userId: string;
  strategyId: string;
  symbol: string;
  timeframe: string;
  secondaryTimeframe?: string;
  models: string[];       // 用户配置的 LLM 模型列表
  apiKeys: UserApiKeys;
  maxRounds?: number;     // 投资辩论轮数 (默认 3)
  riskRounds?: number;    // 风控辩论轮数 (默认 3)
  temperature?: number;   // LLM 温度 (默认 0.7)
}

/**
 * 编排器输出结果
 */
export interface OrchestratorResult {
  decision: AiTradeDecision;      // 最终交易决策
  votes: ConsensusResult['votes']; // 各模型投票详情
  consensusScore: number;          // Safety L2 用
  sceneText: string;               // BM25 场景文本
  totalCost: number;
  totalLatencyMs: number;
  sessionId: string;               // AiDebateSession ID

  // 中间结果 (供前端展示)
  investDebateResult: DebateResult;
  riskDebateResult: RiskDebateResult;
}

/**
 * 多币种编排器配置 (Phase 9.0 T4)
 */
export interface MultiCoinOrchestratorConfig {
  userId: string;
  strategyId: string;
  symbols: string[];       // 所有候选币种
  timeframe: string;
  secondaryTimeframe?: string;
  models: string[];
  apiKeys: UserApiKeys;
  maxRounds?: number;
  riskRounds?: number;
  temperature?: number;
  promptConfig?: PromptConfig;
  maxPositionPct?: number; // R4: 仓位百分比上限（默认 20）
  accountInfo?: ConsensusConfig['accountInfo'];
}

/**
 * 多币种编排器结果 (Phase 9.0 T4)
 */
export interface MultiCoinOrchestratorResult {
  /** 逐币种决策 */
  decisions: Record<string, AiTradeDecision>;
  /** 逐币种共识分数 (Safety L2 用) */
  consensusScores: Record<string, number>;
  /** 逐币种场景文本 (BM25 用) */
  sceneTexts: Record<string, string>;
  /** 逐币种投票详情 */
  perSymbolVotes: Record<string, ConsensusResult['votes']>;
  totalCost: number;
  totalLatencyMs: number;
  sessionId: string;
  investDebateResult: DebateResult;
  riskDebateResult: RiskDebateResult;
  /** 逐币种市场数据快照（供 auto-trader 安全检查 L3/L8/L9 使用） */
  marketDataSnapshots: Record<string, {
    currentPrice: number;
    fundingRate?: number;
    volume24h?: number;
    indicators: { rsi: number | null; atr3: number | null; atr14: number | null };
  }>;
}

/**
 * 4阶段辩论编排器
 *
 * 对齐 NoFx 完整决策流水线:
 *   Stage 2: 投资辩论 — DebateService.runDebate()
 *     Bull vs Bear vs Analyst vs Contrarian vs RiskManager
 *     多轮辩论 + 收敛检测 → 投资方向共识
 *
 *   Stage 3: 风控辩论 — RiskDebateService.runRiskDebate()
 *     Aggressive vs Conservative vs Neutral + Risk Judge
 *     3方辩论 → 风控评审 → 杠杆/仓位/止损调整
 *
 *   Stage 4: 多模型共识投票 — ConsensusService.runConsensus()
 *     N个模型各自独立投票 (携带辩论摘要作为上下文)
 *     加权聚合最终决策
 *
 * Stage 1 (分析师数据收集) 不在此编排器内，
 * 因为 DebateService + ConsensusService 内部通过
 * MarketDataService + IndicatorsService 自行获取数据。
 */
@Injectable()
export class DebateOrchestratorService {
  private readonly logger = new Logger(DebateOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly debate: DebateService,
    private readonly riskDebate: RiskDebateService,
    private readonly consensus: ConsensusService,
    private readonly marketData: MarketDataService,
    private readonly indicators: IndicatorsService,
    private readonly memory: AiMemoryService,
    private readonly tradeHistory: TradeHistoryService,
    private readonly gateway: TradingGateway,
  ) {}

  /**
   * 运行完整4阶段辩论流水线
   */
  async runFullDebate(config: OrchestratorConfig): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const { userId, strategyId, symbol, timeframe } = config;

    this.logger.log(
      `[辩论编排] 开始: ${symbol}, ${config.models.length} 模型, ` +
      `辩论${config.maxRounds || 3}轮, 风控${config.riskRounds || 3}轮`,
    );

    // 创建 DB 会话记录
    const session = await this.createSession(config);

    try {
      // ============ 准备市场数据 ============
      this.emitEvent(userId, session.id, strategyId, symbol, 'stage_start', 'invest_debate');

      const ohlcvRaw = await this.marketData.fetchOHLCV(symbol, timeframe, 100);
      const ohlcv: OHLCV[] = ohlcvRaw.map((c) => ({
        timestamp: c[0],
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5],
      }));

      const indicatorsResult = this.indicators.calculateAll(ohlcv);
      const currentPrice = ohlcv.length > 0 ? ohlcv[ohlcv.length - 1].close : 0;

      // 获取 24h 价格变化
      let priceChange24h: number | undefined;
      if (ohlcv.length >= 24) {
        const old = ohlcv[ohlcv.length - 24].close;
        priceChange24h = old > 0 ? ((currentPrice - old) / old) * 100 : undefined;
      }

      // 获取交易历史 + BM25 记忆
      const tradeHistoryPrompt = await this.tradeHistory.formatTradeHistoryForPrompt(userId);

      const sceneText = this.memory.buildSceneText({
        symbol,
        timeframe,
        rsi: indicatorsResult.rsi,
        macdTrend: indicatorsResult.macd.histogram != null
          ? (indicatorsResult.macd.histogram > 0 ? 'bullish' : 'bearish')
          : undefined,
        emaTrend: indicatorsResult.ema.ema12 != null && indicatorsResult.ema.ema26 != null
          ? (indicatorsResult.ema.ema12 > indicatorsResult.ema.ema26 ? 'above' : 'below')
          : undefined,
        atr: indicatorsResult.atr,
      });

      const memories = await this.memory.retrieveSimilar(sceneText, userId, 3);
      let memoryPrompt = '';
      if (memories.length > 0) {
        memoryPrompt = '\n\n=== PAST EXPERIENCES ===\n';
        for (const m of memories) {
          memoryPrompt += `${m.symbol} ${m.action}: ${m.isWin ? 'WIN' : 'LOSS'} ${m.pnlPercent ?? 0}%`;
          if (m.lesson) memoryPrompt += ` — ${m.lesson}`;
          memoryPrompt += '\n';
        }
      }

      // ============ Stage 2: 投资辩论 ============
      this.logger.log(`[辩论编排] Stage 2: 投资辩论 ${symbol}`);

      const debateContext: MarketContext = {
        symbol,
        currentPrice,
        timeframe,
        indicators: indicatorsResult,
        priceChange24h,
      };

      const debateConfig: DebateConfig = {
        apiKeys: config.apiKeys,
        maxRounds: config.maxRounds || 3,
        temperature: config.temperature || 0.7,
        tradeHistoryPrompt: tradeHistoryPrompt || undefined,
        memoryPrompt: memoryPrompt || undefined,
        locale: (config as any).locale,
      };

      const debateResult = await this.debate.runDebate(debateContext, debateConfig);

      // 更新 DB: 投资辩论结果
      await this.updateSession(session.id, {
        status: 'risk_review',
        investDebate: debateResult as any,
      });

      this.emitEvent(userId, session.id, strategyId, symbol, 'stage_end', 'invest_debate', {
        consensus: debateResult.consensus,
        rounds: debateResult.entries.length,
        cost: debateResult.totalCost,
      });

      // ============ Stage 3: 风控辩论 ============
      this.logger.log(`[辩论编排] Stage 3: 风控辩论 ${symbol}`);
      this.emitEvent(userId, session.id, strategyId, symbol, 'stage_start', 'risk_debate');

      // 从投资辩论共识构建 trader plan
      const traderPlan = this.buildTraderPlan(debateResult, currentPrice);

      const riskInput: RiskDebateInput = {
        symbol,
        currentPrice,
        traderPlan,
        analystReports: tradeHistoryPrompt || 'No trade history data available',
        investmentDecision: debateResult.consensus.reasoning,
      };

      const riskConfig: RiskDebateConfig = {
        maxRounds: config.riskRounds || 3,
        deepThinkModel: AI_MODELS.DEEPSEEK.name,   // 法官用 deep_think
        quickThinkModel: AI_MODELS.DEEPSEEK.name,   // 辩论者用 quick_think
        apiKeys: config.apiKeys,
        temperature: 0.6,
        userId,         // Q3: BM25 记忆检索
        sceneText,      // Q3: 市场场景文本
      };

      const riskResult = await this.riskDebate.runRiskDebate(riskInput, riskConfig);

      // 更新 DB: 风控辩论结果
      await this.updateSession(session.id, {
        status: 'voting',
        riskDebate: riskResult as any,
      });

      this.emitEvent(userId, session.id, strategyId, symbol, 'stage_end', 'risk_debate', {
        approved: riskResult.approved,
        riskRating: riskResult.riskRating,
        adjustedLeverage: riskResult.adjustedLeverage,
      });

      // 如果风控否决，直接返回 hold
      if (!riskResult.approved) {
        this.logger.log(`[辩论编排] 风控否决: ${symbol}, rating=${riskResult.riskRating}`);

        const holdDecision: AiTradeDecision = {
          action: 'hold',
          confidence: 0,
          leverage: 1,
          positionSizePercent: 0,
          stopLoss: null,
          takeProfit: null,
          reasoning: `Risk rejected (${riskResult.riskRating}): ${riskResult.reasoning}`,
        };

        const totalCost = debateResult.totalCost + riskResult.totalCost;
        const totalLatencyMs = Date.now() - startTime;

        await this.updateSession(session.id, {
          status: 'completed',
          consensus: holdDecision as any,
          totalCost,
          totalLatencyMs,
          completedAt: new Date(),
        });

        return {
          decision: holdDecision,
          votes: [],
          consensusScore: 0,
          sceneText,
          totalCost,
          totalLatencyMs,
          sessionId: session.id,
          investDebateResult: debateResult,
          riskDebateResult: riskResult,
        };
      }

      // ============ Stage 4: 多模型共识投票 ============
      this.logger.log(`[辩论编排] Stage 4: 共识投票 ${symbol}, ${config.models.length} 模型`);
      this.emitEvent(userId, session.id, strategyId, symbol, 'stage_start', 'consensus_vote');

      // 构建辩论上下文（注入到每个投票模型的消息中）
      const debateContextStr = this.buildDebateContext(debateResult, riskResult, currentPrice);

      const consensusConfig: ConsensusConfig = {
        userId,
        symbol,
        timeframe,
        secondaryTimeframe: config.secondaryTimeframe,
        models: config.models,
        apiKeys: config.apiKeys,
        debateContext: debateContextStr, // Q5: 注入辩论上下文
      };

      const consensusResult = await this.consensus.runConsensus(consensusConfig);

      // ============ 汇总最终决策 ============
      const totalCost = debateResult.totalCost + riskResult.totalCost + consensusResult.totalCost;
      const totalLatencyMs = Date.now() - startTime;

      // 应用风控调整到最终决策
      const isLong = consensusResult.consensusAction === 'open_long' || consensusResult.consensusAction === 'close_short';
      const isShort = consensusResult.consensusAction === 'open_short' || consensusResult.consensusAction === 'close_long';
      const isOpening = consensusResult.consensusAction === 'open_long' || consensusResult.consensusAction === 'open_short';

      let finalSL = riskResult.adjustedStopLoss ?? consensusResult.avgStopLoss;
      let finalTP = riskResult.adjustedTakeProfit ?? consensusResult.avgTakeProfit;

      // Q4: 默认 SL=3%, TP=6% 兜底（仅对开仓 action）
      // R3: 同时记录百分比，执行时用最新价格重算
      let finalSLPct: number | undefined;
      let finalTPPct: number | undefined;
      if (isOpening && currentPrice > 0) {
        if (finalSL == null) {
          finalSLPct = 0.03;
          finalSL = isLong
            ? Math.round(currentPrice * 0.97 * 100) / 100  // long: 下方 3%
            : Math.round(currentPrice * 1.03 * 100) / 100; // short: 上方 3%
        } else {
          // 从绝对值反算百分比
          finalSLPct = currentPrice > 0 ? Math.abs(finalSL - currentPrice) / currentPrice : undefined;
        }
        if (finalTP == null) {
          finalTPPct = 0.06;
          finalTP = isLong
            ? Math.round(currentPrice * 1.06 * 100) / 100  // long: 上方 6%
            : Math.round(currentPrice * 0.94 * 100) / 100; // short: 下方 6%
        } else {
          finalTPPct = currentPrice > 0 ? Math.abs(finalTP - currentPrice) / currentPrice : undefined;
        }
      }

      const finalDecision: AiTradeDecision = {
        action: consensusResult.consensusAction,
        confidence: consensusResult.avgConfidence,
        leverage: riskResult.adjustedLeverage ?? consensusResult.avgLeverage,
        positionSizePercent: riskResult.adjustedPositionSizePercent ?? consensusResult.avgPositionSizePercent,
        stopLoss: finalSL,
        takeProfit: finalTP,
        reasoning: consensusResult.reasoning,
        // R3: 保存百分比供执行时重算
        stopLossPct: finalSLPct,
        takeProfitPct: finalTPPct,
      };

      // 更新 DB: 最终结果
      await this.updateSession(session.id, {
        status: 'completed',
        votes: consensusResult.votes as any,
        consensus: finalDecision as any,
        totalCost,
        totalLatencyMs,
        completedAt: new Date(),
      });

      this.emitEvent(userId, session.id, strategyId, symbol, 'consensus', 'consensus_vote', {
        action: finalDecision.action,
        confidence: finalDecision.confidence,
        consensusScore: consensusResult.consensusScore,
      });

      this.logger.log(
        `[辩论编排] 完成: ${symbol}, action=${finalDecision.action}, ` +
        `confidence=${finalDecision.confidence}%, cost=$${totalCost.toFixed(4)}, ` +
        `耗时 ${totalLatencyMs}ms`,
      );

      return {
        decision: finalDecision,
        votes: consensusResult.votes,
        consensusScore: consensusResult.consensusScore,
        sceneText: consensusResult.sceneText || sceneText,
        totalCost,
        totalLatencyMs,
        sessionId: session.id,
        investDebateResult: debateResult,
        riskDebateResult: riskResult,
      };
    } catch (error) {
      this.logger.error(`[辩论编排] 失败: ${symbol}, ${error.message}`, error.stack);

      await this.updateSession(session.id, {
        status: 'failed',
        completedAt: new Date(),
      });

      throw error;
    }
  }

  // ========================= 多币种辩论 (Phase 9.0 T4) =========================

  /**
   * 运行多币种4阶段辩论流水线
   *
   * 对齐 NoFx debate/engine.go: 一次辩论覆盖所有候选币，节省 80% LLM 调用
   * 5 币种: 旧=5×28=140次, 新=1×28=28次
   *
   * 共识策略: N 模型独立投票（NoFx-aligned 扁平等权设计）
   * 每个模型独立分析所有币种，投出 1 票
   * 选 N 模型 = N 票，无固定角色
   */
  async runMultiCoinDebate(
    config: MultiCoinOrchestratorConfig,
  ): Promise<MultiCoinOrchestratorResult> {
    const startTime = Date.now();
    const { userId, strategyId, symbols, timeframe } = config;

    if (symbols.length === 0) {
      throw new Error('At least one candidate symbol is required');
    }

    // 限制单次辩论最多 5 个币种（防 prompt 超长）
    const effectiveSymbols = symbols.slice(0, 5);
    const primarySymbol = effectiveSymbols[0];

    this.logger.log(
      `[共识投票] 开始: ${effectiveSymbols.length} 币种 [${effectiveSymbols.join(', ')}], ` +
        `${config.models.length} 模型独立投票`,
    );

    // 创建 DB 会话记录（使用主币种）
    const session = await this.createSession({
      ...config,
      symbol: primarySymbol,
    } as OrchestratorConfig);

    try {
      // ============ 并行获取所有币种的市场数据 ============
      this.emitEvent(userId, session.id, strategyId, primarySymbol, 'stage_start', 'data_fetch');

      const symbolDataMap = await this.fetchAllSymbolsData(effectiveSymbols, timeframe);

      // 构建所有币种的综合市场数据 prompt（传给 consensus.service）
      const combinedMarketDataPrompt = this.buildCombinedMarketDataPrompt(
        effectiveSymbols,
        symbolDataMap,
      );

      this.emitEvent(userId, session.id, strategyId, primarySymbol, 'stage_end', 'data_fetch');

      // 构建 BM25 场景文本（用于记忆检索）
      const sceneTexts: Record<string, string> = {};

      for (const sym of effectiveSymbols) {
        const data = symbolDataMap.get(sym);
        if (data) {
          sceneTexts[sym] = this.memory.buildSceneText({
            symbol: sym,
            timeframe,
            rsi: data.indicators.rsi,
            macdTrend: data.indicators.macd?.histogram != null
              ? (data.indicators.macd.histogram > 0 ? 'bullish' : 'bearish')
              : undefined,
            emaTrend: data.indicators.ema?.ema12 != null && data.indicators.ema?.ema26 != null
              ? (data.indicators.ema.ema12 > data.indicators.ema.ema26 ? 'above' : 'below')
              : undefined,
            atr: data.indicators.atr,
          });
        }
      }

      // ============ 多模型独立投票 (NoFx-aligned 扁平等权) ============
      // 共识策略: N 个模型各独立投 1 票 = N 票（无固定角色）
      // 区别于深研策略的 5 角色辩论
      this.logger.log(
        `[共识投票] 开始: ${effectiveSymbols.length} 币种, ${config.models.length} 模型独立投票`,
      );
      this.emitEvent(userId, session.id, strategyId, primarySymbol, 'stage_start', 'consensus_vote');

      const consensusConfig: ConsensusConfig = {
        userId,
        symbol: primarySymbol,
        timeframe,
        secondaryTimeframe: config.secondaryTimeframe,
        models: config.models,
        apiKeys: config.apiKeys,
        symbols: effectiveSymbols,
        precomputedMarketData: combinedMarketDataPrompt,
        promptConfig: config.promptConfig,
        accountInfo: config.accountInfo,
      };

      const multiCoinResults = await this.consensus.runMultiCoinConsensus(consensusConfig);

      this.emitEvent(userId, session.id, strategyId, primarySymbol, 'stage_end', 'consensus_vote', {
        symbols: effectiveSymbols,
        modelCount: config.models.length,
      });

      // ============ 构建决策（从 ConsensusResult 映射） ============
      this.logger.log(`[共识投票] 构建决策 [${effectiveSymbols.join(', ')}]`);
      this.emitEvent(userId, session.id, strategyId, primarySymbol, 'stage_start', 'voting');

      const decisions: Record<string, AiTradeDecision> = {};
      const consensusScores: Record<string, number> = {};
      const perSymbolVotes: Record<string, any[]> = {};

      for (const sym of effectiveSymbols) {
        const cr = multiCoinResults[sym];
        if (!cr) {
          decisions[sym] = {
            action: 'hold',
            confidence: 0,
            leverage: 1,
            positionSizePercent: 0,
            stopLoss: null,
            takeProfit: null,
            reasoning: 'Consensus vote: no result',
          };
          consensusScores[sym] = 0;
          perSymbolVotes[sym] = [];
          continue;
        }

        const symData = symbolDataMap.get(sym);
        const symPrice = symData?.currentPrice || 0;

        // SL/TP: consensus.service 已计算绝对价格；若为 null 则默认 3%/6%
        const isLong = cr.consensusAction === 'open_long' || cr.consensusAction === 'close_short';
        const isOpening = cr.consensusAction === 'open_long' || cr.consensusAction === 'open_short';

        let finalSL = cr.avgStopLoss;
        let finalTP = cr.avgTakeProfit;
        let slPct: number | undefined;
        let tpPct: number | undefined;

        if (isOpening && symPrice > 0) {
          if (finalSL == null) {
            slPct = 0.03;
            finalSL = isLong
              ? Math.round(symPrice * 0.97 * 100) / 100
              : Math.round(symPrice * 1.03 * 100) / 100;
          } else {
            slPct = Math.abs(finalSL - symPrice) / symPrice;
          }
          if (finalTP == null) {
            tpPct = 0.06;
            finalTP = isLong
              ? Math.round(symPrice * 1.06 * 100) / 100
              : Math.round(symPrice * 0.94 * 100) / 100;
          } else {
            tpPct = Math.abs(finalTP - symPrice) / symPrice;
          }
        }

        // 仓位上限
        const maxPct = config.maxPositionPct ?? 20;
        const posPct = Math.min(cr.avgPositionSizePercent, maxPct);

        decisions[sym] = {
          action: cr.consensusAction,
          confidence: cr.avgConfidence,
          leverage: cr.avgLeverage,
          positionSizePercent: posPct,
          stopLoss: finalSL,
          takeProfit: finalTP,
          reasoning: cr.reasoning,
          stopLossPct: slPct,
          takeProfitPct: tpPct,
        };
        consensusScores[sym] = cr.consensusScore;
        perSymbolVotes[sym] = cr.votes;
      }

      // 逐币共识日志
      for (const sym of effectiveSymbols) {
        const d = decisions[sym];
        this.logger.log(
          `[共识投票] ${sym} → ${d.action} (confidence=${d.confidence}%, leverage=${d.leverage}x, posPct=${d.positionSizePercent}%, SL=${d.stopLoss ?? 'none'}, TP=${d.takeProfit ?? 'none'})`,
        );
      }

      // 空的辩论/风控结果占位（共识策略无辩论阶段）
      const debateResult: DebateResult = {
        entries: [],
        consensus: {
          direction: decisions[primarySymbol]?.action?.includes('long') ? 'buy' : decisions[primarySymbol]?.action?.includes('short') ? 'sell' : 'hold',
          action: decisions[primarySymbol]?.action || 'hold',
          confidence: decisions[primarySymbol]?.confidence || 0,
          score: consensusScores[primarySymbol] || 0,
          reasoning: decisions[primarySymbol]?.reasoning || '',
        },
        totalCost: Object.values(multiCoinResults).reduce((s, r) => s + r.totalCost, 0),
        totalTokens: 0,
        totalLatencyMs: Object.values(multiCoinResults).reduce((s, r) => s + r.totalLatencyMs, 0),
      };

      const riskResult: RiskDebateResult = {
        adjustedLeverage: null,
        adjustedPositionSizePercent: null,
        adjustedStopLoss: null,
        adjustedTakeProfit: null,
        riskRating: 'LOW',
        approved: true,
        reasoning: 'Consensus strategy: no independent risk debate stage',
        fullDebateHistory: '',
        totalCost: 0,
        totalLatencyMs: 0,
      };

      const totalCost = debateResult.totalCost;
      const totalLatencyMs = Date.now() - startTime;

      await this.updateSession(session.id, {
        status: 'completed',
        consensus: decisions as any,
        totalCost,
        totalLatencyMs,
        completedAt: new Date(),
      });

      this.emitEvent(userId, session.id, strategyId, primarySymbol, 'consensus', 'voting', {
        symbols: effectiveSymbols,
        decisions: Object.fromEntries(
          Object.entries(decisions).map(([s, d]) => [s, { action: d.action, confidence: d.confidence }]),
        ),
      });

      this.logger.log(
        `[共识投票] 完成: ${effectiveSymbols.length} 币种, ${config.models.length} 模型, ` +
          `cost=$${totalCost.toFixed(4)}, 耗时 ${totalLatencyMs}ms`,
      );

      // 构建市场数据快照（供 auto-trader 安全检查 L3/L8/L9 使用）
      const marketDataSnapshots: MultiCoinOrchestratorResult['marketDataSnapshots'] = {};
      for (const sym of effectiveSymbols) {
        const data = symbolDataMap.get(sym);
        if (data) {
          marketDataSnapshots[sym] = {
            currentPrice: data.currentPrice,
            fundingRate: data.fundingRate,
            volume24h: data.volume24h,
            indicators: {
              rsi: data.indicators.rsi ?? null,
              atr3: data.indicators.atr3 ?? null,
              atr14: data.indicators.atr ?? null, // calculateAll() 中 atr = ATR(14)
            },
          };
        }
      }

      return {
        decisions,
        consensusScores,
        sceneTexts,
        perSymbolVotes,
        totalCost,
        totalLatencyMs,
        sessionId: session.id,
        investDebateResult: debateResult,
        riskDebateResult: riskResult,
        marketDataSnapshots,
      };
    } catch (error) {
      this.logger.error(`[多币种辩论] 失败: ${error.message}`, error.stack);
      await this.updateSession(session.id, {
        status: 'failed',
        completedAt: new Date(),
      });
      throw error;
    }
  }

  // ========================= 多币种数据获取 =========================

  /**
   * 并行获取所有币种的市场数据 + 指标
   */
  private async fetchAllSymbolsData(
    symbols: string[],
    timeframe: string,
  ): Promise<Map<string, {
    ohlcv: OHLCV[];
    currentPrice: number;
    indicators: ReturnType<IndicatorsService['calculateAll']>;
    priceChange24h?: number;
    fundingRate?: number;
    volume24h?: number;
  }>> {
    const results = new Map();

    const fetchPromises = symbols.map(async (symbol) => {
      try {
        // OHLCV 和 fundingRate 并行获取（fundingRate 供安全检查 L8 使用）
        const [ohlcvRaw, frData] = await Promise.all([
          this.marketData.fetchOHLCV(symbol, timeframe, 100),
          this.marketData.fetchFundingRate(symbol).catch(() => null),
        ]);
        const ohlcv: OHLCV[] = ohlcvRaw.map((c) => ({
          timestamp: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5],
        }));

        const indicatorsResult = this.indicators.calculateAll(ohlcv);
        const currentPrice = ohlcv.length > 0 ? ohlcv[ohlcv.length - 1].close : 0;

        let priceChange24h: number | undefined;
        if (ohlcv.length >= 24) {
          const old = ohlcv[ohlcv.length - 24].close;
          priceChange24h = old > 0 ? ((currentPrice - old) / old) * 100 : undefined;
        }

        // 从 OHLCV 聚合 24h 成交量（L10 流动性检查用）
        const barsFor24h = timeframe === '4h' ? 6 : timeframe === '1h' ? 24 : 6;
        const volume24h = ohlcv.slice(-barsFor24h).reduce((sum, bar) => sum + (bar.volume || 0), 0);

        return { symbol, ohlcv, currentPrice, indicators: indicatorsResult, priceChange24h, fundingRate: frData?.fundingRate, volume24h };
      } catch (error) {
        this.logger.warn(`[多币种辩论] ${symbol} 数据获取失败: ${error.message}`);
        return null;
      }
    });

    const all = await Promise.all(fetchPromises);
    for (const item of all) {
      if (item) results.set(item.symbol, item);
    }

    return results;
  }

  /**
   * 构建额外币种的市场数据文本（注入 Stage 2 辩论）
   */
  private buildAdditionalMarketData(
    symbols: string[],
    dataMap: Map<string, any>,
    timeframe: string,
  ): string {
    if (symbols.length === 0) return '';

    const lines: string[] = ['=== Additional Candidate Coins ==='];

    for (const sym of symbols) {
      const data = dataMap.get(sym);
      if (!data) continue;

      const ind = data.indicators;
      lines.push('');
      lines.push(`--- ${sym} @ $${data.currentPrice.toFixed(2)} ---`);
      if (data.priceChange24h !== undefined) {
        lines.push(`24h Change: ${data.priceChange24h > 0 ? '+' : ''}${data.priceChange24h.toFixed(2)}%`);
      }
      if (ind.rsi !== null) lines.push(`RSI(14): ${ind.rsi.toFixed(2)}`);
      if (ind.macd?.histogram !== null && ind.macd?.histogram !== undefined) {
        lines.push(`MACD Histogram: ${ind.macd.histogram.toFixed(4)} (${ind.macd.histogram > 0 ? 'bullish' : 'bearish'})`);
      }
      if (ind.atr !== null) lines.push(`ATR(14): ${ind.atr.toFixed(4)}`);
      if (ind.ema?.ema12 !== null && ind.ema?.ema26 !== null) {
        lines.push(`EMA: 12=${ind.ema.ema12?.toFixed(2)} | 26=${ind.ema.ema26?.toFixed(2)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 构建所有币种的综合市场数据 prompt（供 Stage 4 共识用）
   */
  private buildCombinedMarketDataPrompt(
    symbols: string[],
    dataMap: Map<string, any>,
  ): string {
    const sections: string[] = [];

    for (const sym of symbols) {
      const data = dataMap.get(sym);
      if (!data) continue;

      const ind = data.indicators;
      const lines: string[] = [
        `=== ${sym} @ $${data.currentPrice.toFixed(2)} ===`,
      ];

      if (data.priceChange24h !== undefined) {
        lines.push(`24h Change: ${data.priceChange24h > 0 ? '+' : ''}${data.priceChange24h.toFixed(2)}%`);
      }
      if (ind.rsi !== null) lines.push(`RSI(14): ${ind.rsi.toFixed(2)}`);
      if (ind.rsi7 !== null && ind.rsi7 !== undefined) lines.push(`RSI(7): ${ind.rsi7.toFixed(2)}`);
      if (ind.macd?.macd !== null && ind.macd?.macd !== undefined) {
        lines.push(`MACD: ${ind.macd.macd.toFixed(4)} | Signal: ${ind.macd.signal?.toFixed(4)} | Hist: ${ind.macd.histogram?.toFixed(4)}`);
      }
      if (ind.atr !== null) lines.push(`ATR(14): ${ind.atr.toFixed(4)}`);
      if (ind.atr3 !== null && ind.atr3 !== undefined) lines.push(`ATR(3): ${ind.atr3.toFixed(4)}`);
      if (ind.ema?.ema12 !== null) {
        lines.push(`EMA: 12=${ind.ema.ema12?.toFixed(2)} | 26=${ind.ema.ema26?.toFixed(2)} | 50=${ind.ema.ema50?.toFixed(2)}`);
      }
      if (ind.bollingerBands?.upper !== null && ind.bollingerBands?.upper !== undefined) {
        lines.push(`BB: Upper=${ind.bollingerBands.upper.toFixed(2)} | Mid=${ind.bollingerBands.middle?.toFixed(2)} | Lower=${ind.bollingerBands.lower?.toFixed(2)}`);
      }

      sections.push(lines.join('\n'));
    }

    return sections.join('\n\n');
  }

  // ========================= 辅助方法 =========================

  /**
   * 构建辩论摘要（供 Stage 4 投票模型参考）
   *
   * 格式化为简洁文本 (~500字) 注入到 ConsensusService
   */
  private buildDebateContext(
    debateResult: DebateResult,
    riskResult: RiskDebateResult,
    currentPrice: number,
  ): string {
    const lines: string[] = [
      '=== DEBATE RESULTS (for your reference) ===',
      '',
      `Investment Debate Consensus: ${debateResult.consensus.action.toUpperCase()} ` +
        `(${debateResult.consensus.confidence}% confidence, ${debateResult.consensus.score}/5 agree)`,
    ];

    // 提取关键论点
    const lastRoundEntries = debateResult.entries.filter(
      (e) => e.round === Math.max(...debateResult.entries.map((x) => x.round)),
    );

    if (lastRoundEntries.length > 0) {
      lines.push('Key Arguments:');
      for (const entry of lastRoundEntries.slice(0, 3)) {
        const reasoning = entry.arguments?.reasoning || entry.arguments?.keyPoints?.[0] || '';
        if (reasoning) {
          lines.push(`  - [${entry.role}] ${String(reasoning).slice(0, 150)}`);
        }
      }
    }

    lines.push('');
    lines.push(
      `Risk Assessment: ${riskResult.riskRating} risk, ${riskResult.approved ? 'APPROVED' : 'REJECTED'}`,
    );

    if (riskResult.adjustedLeverage != null) {
      lines.push(`  - Adjusted leverage: ${riskResult.adjustedLeverage}x`);
    }
    if (riskResult.adjustedStopLoss != null) {
      const slPct = Math.abs((riskResult.adjustedStopLoss - currentPrice) / currentPrice * 100);
      lines.push(`  - Adjusted SL: $${riskResult.adjustedStopLoss.toFixed(2)} (${slPct.toFixed(1)}%)`);
    }
    if (riskResult.adjustedTakeProfit != null) {
      const tpPct = Math.abs((riskResult.adjustedTakeProfit - currentPrice) / currentPrice * 100);
      lines.push(`  - Adjusted TP: $${riskResult.adjustedTakeProfit.toFixed(2)} (${tpPct.toFixed(1)}%)`);
    }

    lines.push('');
    lines.push('Make your OWN independent decision. The debate results are for reference only.');
    lines.push('=== END DEBATE RESULTS ===');

    return lines.join('\n');
  }

  /**
   * 从投资辩论共识构建 trader plan（供风控辩论输入）
   */
  private buildTraderPlan(debateResult: DebateResult, currentPrice: number): string {
    const c = debateResult.consensus;
    return `Trade Proposal based on Investment Debate:
Action: ${c.action}
Direction: ${c.direction}
Confidence: ${c.confidence}%
Agreement: ${c.score}/5 analysts
Current Price: $${currentPrice}
Reasoning: ${c.reasoning}`;
  }

  // ========================= DB 操作 =========================

  private async createSession(config: OrchestratorConfig) {
    return this.prisma.aiDebateSession.create({
      data: {
        strategyId: config.strategyId,
        userId: config.userId,
        symbol: config.symbol,
        status: 'debating',
        startedAt: new Date(),
      },
    });
  }

  private async updateSession(
    id: string,
    data: {
      status?: string;
      investDebate?: any;
      riskDebate?: any;
      votes?: any;
      consensus?: any;
      totalCost?: number;
      totalLatencyMs?: number;
      completedAt?: Date;
    },
  ): Promise<void> {
    await this.prisma.aiDebateSession.update({
      where: { id },
      data: {
        ...data,
        totalCost: data.totalCost != null ? data.totalCost : undefined,
        totalLatencyMs: data.totalLatencyMs != null ? data.totalLatencyMs : undefined,
      },
    });
  }

  // ========================= WebSocket =========================

  private emitEvent(
    userId: string,
    sessionId: string,
    strategyId: string,
    symbol: string,
    type: string,
    stage: string,
    data?: any,
  ): void {
    try {
      this.gateway.sendAiDebateEvent(userId, {
        sessionId,
        strategyId,
        symbol,
        type: type as any,
        stage: stage as any,
        data,
      });
    } catch {
      // WS 推送失败不影响核心流程
    }
  }
}
