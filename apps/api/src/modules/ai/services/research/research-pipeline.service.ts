import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { LLMService, UserApiKeys } from '../llm.service';
import { CryptoAnalystsService, AnalystContext } from './crypto-analysts.service';
import { RiskDebateService, RiskDebateConfig } from './risk-debate.service';
import { DebateService, DebateConfig, MarketContext as DebateMarketContext } from './debate.service';
import { IndicatorsService, OHLCV, IndicatorsResult } from '../indicators.service';
import { MarketDataService } from '../market-data.service';
import { AiMemoryService } from '../memory.service';
import { SafetyService, SafetyCheckInput } from '../safety.service';
import { AiExecutionService } from '../ai-execution.service';
import {
  ResearchDepth,
  ResearchResult,
  ResearchStage,
  AiTradeDecision,
  AnalystReports,
} from '../../types/ai.types';
import { QUICK_MODE_SYSTEM_PROMPT, ANALYSIS_OUTPUT_FORMAT, formatMemoryPrompt, formatMarketDataPrompt } from '../../constants/prompts';
import { TradingGateway } from '../../../../gateways/trading.gateway';

/**
 * 研究配置
 */
export interface ResearchConfig {
  userId: string;
  symbol: string;
  depth: ResearchDepth;
  autoExecute: boolean;
  apiKeyId?: string; // 执行交易使用的 API Key ID
  llmApiKeys: UserApiKeys;
  quickThinkModel?: string;
  deepThinkModel?: string;
  sessionId?: string; // 外部传入的会话 ID（避免重复创建）
  riskControlConfig?: {
    maxPositions?: number;
    maxLeverage?: number;
    maxDailyDrawdown?: number;
    allocatedCapital?: number;
    maxDailyTrades?: number;
    cooldownMinutes?: number;
    circuitBreaker?: number;
  };
}

/**
 * 深度模式参数映射
 */
const DEPTH_CONFIG: Record<ResearchDepth, {
  skipAnalysts: string[];
  investDebateRounds: number;
  riskDebateRounds: number;
  maxTokens: number;
}> = {
  quick: {
    skipAnalysts: ['news', 'sentiment', 'fundamentals'], // 仅 market + technical
    investDebateRounds: 0, // 跳过投资辩论
    riskDebateRounds: 0, // 简化风控
    maxTokens: 600,
  },
  standard: {
    skipAnalysts: [], // 全部 5 分析师
    investDebateRounds: 1, // 1 轮 → 2 条消息
    riskDebateRounds: 1, // 1 轮 → 3 条消息
    maxTokens: 800,
  },
  deep: {
    skipAnalysts: [], // 全部 5 分析师
    investDebateRounds: 2, // 2 轮 → 4 条消息
    riskDebateRounds: 2, // 2 轮 → 6 条消息
    maxTokens: 1200,
  },
};

/**
 * 研究流水线服务（产品 A 核心）
 *
 * 对应 TradingAgents 5 阶段流水线:
 *
 * Stage 1: 分析师并行研究（4-5 个分析师）
 * Stage 2: 投资辩论（Bull vs Bear，Research Manager 裁决）
 * Stage 3: 交易员生成提案
 * Stage 4: 风控三方辩论（Aggressive / Conservative / Neutral + Judge）
 * Stage 5: 信号提取 + 安全检查 + 最终决策
 *
 * 不同深度模式:
 * - quick: Stage 1 仅 2 分析师 + 跳过 Stage 2/4
 * - standard: 完整 5 阶段，各 1 轮辩论
 * - deep: 完整 5 阶段，各 2 轮辩论 + 更多 tokens
 */
@Injectable()
export class ResearchPipelineService {
  private readonly logger = new Logger(ResearchPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LLMService,
    private readonly analysts: CryptoAnalystsService,
    private readonly riskDebate: RiskDebateService,
    private readonly debate: DebateService,
    private readonly indicators: IndicatorsService,
    private readonly marketData: MarketDataService,
    private readonly memory: AiMemoryService,
    private readonly safety: SafetyService,
    private readonly execution: AiExecutionService,
    private readonly gateway: TradingGateway,
  ) {}

  /**
   * 运行完整研究流程
   */
  async runResearch(config: ResearchConfig): Promise<ResearchResult> {
    const { userId, symbol, depth, autoExecute } = config;
    const depthCfg = DEPTH_CONFIG[depth];
    const quickModel = config.quickThinkModel || 'deepseek-chat';
    const deepModel = config.deepThinkModel || 'deepseek-chat';

    this.logger.log(`[研究] 开始: ${symbol}, 深度=${depth}, 自动执行=${autoExecute}`);

    const db = this.prisma;

    // 使用外部传入的 sessionId（控制器已预创建），否则自行创建
    let session: { id: string };
    if (config.sessionId) {
      session = { id: config.sessionId };
      await db.aiResearchSession.update({
        where: { id: config.sessionId },
        data: { status: 'running' },
      });
    } else {
      session = await db.aiResearchSession.create({
        data: {
          userId,
          symbol,
          depth,
          autoExecute,
          status: 'running',
          stages: [],
        },
      });
    }

    const stages: ResearchStage[] = [];
    let totalCost = 0;
    const startTime = Date.now();
    let finalDecision: AiTradeDecision | null = null;

    // Stage 1 产出的上下文（后续阶段使用）
    let marketCtx: {
      currentPrice: number;
      ohlcv: OHLCV[];
      indicators: IndicatorsResult;
      openInterest?: number;
      fundingRate?: number;
    } | null = null;

    try {
      // ==================== Stage 1: 分析师并行研究 ====================
      const stage1 = await this.runStage(1, '分析师研究', async () => {
        // 获取市场数据
        const ohlcvRaw = await this.marketData.fetchOHLCV(symbol, '1h', 100);
        const currentPrice = await this.marketData.fetchCurrentPrice(symbol);

        // 转换 OHLCV 格式
        const ohlcv: OHLCV[] = ohlcvRaw.map((c) => ({
          timestamp: c[0] as number,
          open: c[1] as number,
          high: c[2] as number,
          low: c[3] as number,
          close: c[4] as number,
          volume: c[5] as number,
        }));

        // 计算指标
        const indicators = this.indicators.calculateAll(ohlcv);

        // 获取衍生品数据
        const futuresSymbol = `${symbol}:USDT`;
        let openInterest: number | undefined;
        let fundingRate: number | undefined;

        try {
          const oiData = await this.marketData.fetchOpenInterest(futuresSymbol);
          openInterest = oiData?.openInterest;
        } catch {}

        try {
          const frData = await this.marketData.fetchFundingRate(futuresSymbol);
          fundingRate = frData?.fundingRate;
        } catch {}

        // 构建分析师上下文
        const analystCtx: AnalystContext = {
          symbol,
          currentPrice,
          ohlcv,
          indicators,
          openInterest,
          fundingRate,
        };

        // 运行所有分析师
        const result = await this.analysts.runAllAnalysts(
          analystCtx,
          quickModel,
          config.llmApiKeys,
          depthCfg.skipAnalysts,
        );

        return {
          reports: result.reports,
          cost: result.totalCost,
          context: { currentPrice, ohlcv, indicators, openInterest, fundingRate },
        };
      });

      stages.push(stage1.stage);
      totalCost += stage1.result?.cost || 0;
      await this.updateSession(session.id, stages);
      this.pushProgress(userId, session.id, 1, '分析师研究', 'completed');

      const reports: AnalystReports = stage1.result?.reports || {};
      marketCtx = stage1.result?.context || null;

      if (!marketCtx) {
        throw new Error('Stage 1 未能获取市场上下文');
      }

      // ==================== Stage 2: 投资辩论 ====================
      let investmentDecision = '';

      if (depthCfg.investDebateRounds > 0) {
        const stage2 = await this.runStage(2, '投资辩论', async () => {
          // 获取 BM25 记忆
          const reportsConcat = Object.values(reports).filter(Boolean).join('\n\n');
          const memories = await this.memory.retrieveSimilar(reportsConcat, userId, 2);
          const memoryPrompt = formatMemoryPrompt(
            memories.map((m) => ({
              sceneText: m.sceneText,
              action: m.action,
              pnl: m.pnlPercent || 0,
              isWin: m.isWin || false,
              lesson: m.lesson || undefined,
            })),
          );

          // 构建辩论市场上下文
          const debateCtx: DebateMarketContext = {
            symbol,
            currentPrice: marketCtx!.currentPrice,
            timeframe: '1h',
            indicators: marketCtx!.indicators,
          };

          const debateConfig: DebateConfig = {
            apiKeys: config.llmApiKeys,
            maxRounds: depthCfg.investDebateRounds, // 1轮辩论 + Judge裁决（对齐 TradingAgents）
            memoryPrompt,
            // G1-G3: 对齐 TradingAgents 配置
            analystReports: reportsConcat,   // G1: 分析师报告注入辩论
            userId,                          // G2: 角色专属 BM25 记忆
            sceneText: reportsConcat,        // G2: BM25 查询文本
            judgeModel: deepModel,           // G3: Judge 使用深度思考模型
          };

          const result = await this.debate.runDebate(debateCtx, debateConfig);
          investmentDecision = `Investment Decision: ${result.consensus.action} (confidence: ${result.consensus.confidence}, score: ${result.consensus.score}/5)\nReasoning: ${result.consensus.reasoning}`;

          return {
            consensus: result.consensus,
            cost: result.totalCost,
            entries: result.entries, // 存储完整辩论记录（role+content+model）
          };
        });

        stages.push(stage2.stage);
        totalCost += stage2.result?.cost || 0;
      } else {
        // quick 模式: 跳过辩论，用简单分析代替
        stages.push(this.createSkippedStage(2, '投资辩论（已跳过）'));
        investmentDecision = 'No investment debate (quick mode)';
      }

      await this.updateSession(session.id, stages);
      this.pushProgress(userId, session.id, 2, '投资辩论', 'completed');

      // ==================== Stage 3: 交易员提案 ====================
      const stage3 = await this.runStage(3, '交易员提案', async () => {
        const reportsText = this.formatReportsForTrader(reports);

        // GAP-A: 对齐 TradingAgents trader.py — Trader 有独立 BM25 记忆
        let traderMemoryPrompt = '';
        try {
          const traderMemories = await this.memory.retrieveSimilar(
            Object.values(reports).filter(Boolean).join('\n\n'),
            userId, 2, 'trader',
          );
          if (traderMemories.length > 0) {
            traderMemoryPrompt = formatMemoryPrompt(
              traderMemories.map((m) => ({
                sceneText: m.sceneText,
                action: m.action,
                pnl: m.pnlPercent || 0,
                isWin: m.isWin || false,
                lesson: m.lesson || undefined,
              })),
            );
          }
        } catch (err) {
          this.logger.warn(`[Stage 3] Trader BM25 记忆检索失败: ${err.message}`);
        }

        const systemPrompt = `You are an EXPERT CRYPTO FUTURES TRADER. Based on the analyst reports and investment debate decision below, generate a FINAL TRANSACTION PROPOSAL.

You MUST respond ONLY with a valid JSON object following this exact schema:

{
  "action": "open_long" | "open_short" | "close_long" | "close_short" | "hold" | "wait",
  "confidence": 0-100 (integer),
  "reasoning": "Your detailed analysis (150-400 words)",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "leverage": 1-20 (integer, recommended leverage),
  "positionSizePercent": 1-10 (integer, position size as % of portfolio),
  "stopLoss": number | null (stop loss price),
  "takeProfit": number | null (take profit price),
  "timeframe": "1h" | "4h" | "1d" | "1w"
}

DO NOT include any text outside the JSON object.
${traderMemoryPrompt}`;

        const userMessage = `=== ANALYST REPORTS ===
${reportsText}

=== INVESTMENT DECISION ===
${investmentDecision}

=== CURRENT MARKET ===
Symbol: ${symbol}
Price: ${marketCtx!.currentPrice}
${marketCtx!.fundingRate !== undefined ? `Funding Rate: ${(marketCtx!.fundingRate * 100).toFixed(4)}%` : ''}

Generate your final transaction proposal.`;

        const response = await this.llm.chat(
          quickModel,
          systemPrompt,
          userMessage,
          config.llmApiKeys,
          { temperature: 0.4, maxTokens: depthCfg.maxTokens },
        );

        return {
          proposal: response.content,
          cost: response.cost,
        };
      });

      stages.push(stage3.stage);
      totalCost += stage3.result?.cost || 0;
      await this.updateSession(session.id, stages);
      this.pushProgress(userId, session.id, 3, '交易员提案', 'completed');

      const traderPlan = stage3.result?.proposal || '';

      // ==================== Stage 4: 风控辩论 ====================
      let riskResult: {
        approved: boolean;
        riskRating: string;
        adjustedLeverage?: number | null;
        adjustedPositionSizePercent?: number | null;
        adjustedStopLoss?: number | null;
        adjustedTakeProfit?: number | null;
        reasoning?: string;
      } = { approved: true, riskRating: 'MEDIUM' };

      if (depthCfg.riskDebateRounds > 0) {
        const stage4 = await this.runStage(4, '风控辩论', async () => {
          const reportsText = this.formatReportsForTrader(reports);

          const riskConfig: RiskDebateConfig = {
            maxRounds: depthCfg.riskDebateRounds,
            deepThinkModel: deepModel,
            quickThinkModel: quickModel,
            apiKeys: config.llmApiKeys,
            userId,                          // BM25 记忆检索（补全 Q3 调用方传参）
            sceneText: reportsText,          // BM25 查询文本
          };

          const result = await this.riskDebate.runRiskDebate(
            {
              symbol,
              currentPrice: marketCtx!.currentPrice,
              traderPlan,
              analystReports: reportsText,
              investmentDecision,
            },
            riskConfig,
          );

          riskResult = result;

          return {
            approved: result.approved,
            riskRating: result.riskRating,
            adjustedLeverage: result.adjustedLeverage,
            reasoning: result.reasoning || null,
            debateHistory: result.fullDebateHistory || [],
            cost: result.totalCost,
          };
        });

        stages.push(stage4.stage);
        totalCost += stage4.result?.cost || 0;
      } else {
        stages.push(this.createSkippedStage(4, '风控辩论（已跳过）'));
      }

      await this.updateSession(session.id, stages);
      this.pushProgress(userId, session.id, 4, '风控辩论', 'completed');

      // ==================== Stage 5: 最终决策 ====================
      const stage5 = await this.runStage(5, '最终决策', async () => {
        // 从交易员提案中提取决策
        const decision = this.parseTraderDecision(traderPlan, riskResult);

        // 安全检查
        const safetyInput: SafetyCheckInput = {
          userId,
          symbol,
          direction: this.actionToDirection(decision.action),
          action: decision.action,
          confidence: decision.confidence,
          consensusScore: 3, // 研究模式默认共识分
          positionSize: decision.positionSizePercent,
          leverage: decision.leverage,
          indicators: {
            rsi: marketCtx!.indicators.rsi,
            macd: marketCtx!.indicators.macd,
            bollingerBands: marketCtx!.indicators.bollingerBands,
            atr: marketCtx!.indicators.atr,
            atr3: marketCtx!.indicators.atr3,
            atr14: marketCtx!.indicators.atr,
            obv: marketCtx!.indicators.obv,
            ema: {
              ema12: marketCtx!.indicators.ema?.ema12 ?? null,
              ema26: marketCtx!.indicators.ema?.ema26 ?? null,
              ema50: marketCtx!.indicators.ema?.ema50 ?? null,
            },
          },
          fundingRate: marketCtx!.fundingRate,
          mode: depth === 'quick' ? 'quick' : undefined,
          // 传入策略级风控参数（用户在深研创建时配置）
          strategyRiskConfig: config.riskControlConfig ? {
            maxLeverage: config.riskControlConfig.maxLeverage,
            maxPositions: config.riskControlConfig.maxPositions,
            maxDailyTrades: config.riskControlConfig.maxDailyTrades,
            cooldownMinutes: config.riskControlConfig.cooldownMinutes,
            maxDailyDrawdown: config.riskControlConfig.maxDailyDrawdown,
            circuitBreaker: config.riskControlConfig.circuitBreaker !== undefined
              ? { maxConsecutiveLosses: config.riskControlConfig.circuitBreaker }
              : undefined,
          } : undefined,
        };

        const safetyResult = await this.safety.checkAll(safetyInput);

        // 如果风控不通过，降级为 hold/wait
        if (!safetyResult.passed) {
          this.logger.warn(
            `[研究] 安全检查未通过: ${safetyResult.blockedBy} - ${safetyResult.blockedReason}`,
          );
          decision.action = 'wait';
          decision.reasoning += `\n\n[SAFETY BLOCKED] ${safetyResult.blockedBy}: ${safetyResult.blockedReason}`;
        }

        // 如果风控辩论不通过
        if (!riskResult.approved) {
          this.logger.warn(`[研究] 风控辩论拒绝: ${riskResult.riskRating}`);
          decision.action = 'wait';
          decision.reasoning += `\n\n[RISK REJECTED] Rating: ${riskResult.riskRating}. ${riskResult.reasoning || ''}`;
        }

        finalDecision = decision;

        // 自动执行
        let executedTradeId: string | null = null;
        if (autoExecute && config.apiKeyId && this.isActionable(decision.action)) {
          try {
            const execResult = await this.execution.executeDecision(
              userId,
              config.apiKeyId,
              {
                symbol,
                action: decision.action,
                confidence: decision.confidence,
                leverage: decision.leverage,
                positionSizeUSD: undefined, // 由 execution 层从 aiConfig.amountPerTrade 读取
                stopLoss: decision.stopLoss,
                takeProfit: decision.takeProfit,
              },
              'ai_research',
            );

            if (execResult.success) {
              executedTradeId = execResult.positionId || null;
              this.logger.log(`[研究] 自动执行成功: ${execResult.orderId}`);
            }
          } catch (error) {
            this.logger.error(`[研究] 自动执行失败: ${error.message}`);
          }
        }

        return {
          decision,
          safetyPassed: safetyResult.passed,
          riskApproved: riskResult.approved,
          executedTradeId,
          cost: 0,
        };
      });

      stages.push(stage5.stage);
      await this.updateSession(session.id, stages);
      this.pushProgress(userId, session.id, 5, '最终决策', 'completed');

      // 更新会话最终状态
      await db.aiResearchSession.update({
        where: { id: session.id },
        data: {
          status: 'completed',
          stages: JSON.parse(JSON.stringify(stages)),
          finalDecision: JSON.parse(JSON.stringify(finalDecision)),
          totalCost: totalCost,
          executedTradeId: stage5.result?.executedTradeId || null,
        },
      });

      // 累加 LLM 费用到 aiConfig.currentSpend
      if (totalCost > 0) {
        await this.incrementSpend(userId, totalCost);
      }
    } catch (error) {
      this.logger.error(`[研究] 失败: ${error.message}`, error.stack);

      await db.aiResearchSession.update({
        where: { id: session.id },
        data: {
          status: 'failed',
          stages: JSON.parse(JSON.stringify(stages)),
          errorMessage: error.message,
          totalCost: totalCost,
        },
      });

      // 即使失败也累加已产生的费用
      if (totalCost > 0) {
        await this.incrementSpend(userId, totalCost);
      }
    }

    const totalLatencyMs = Date.now() - startTime;

    this.logger.log(
      `[研究] 完成: ${symbol}, ${stages.length} 阶段, 总耗时 ${totalLatencyMs}ms, 总成本 $${totalCost.toFixed(4)}`,
    );

    return {
      sessionId: session.id,
      stages,
      finalDecision,
      totalCost,
      totalLatencyMs,
    };
  }

  // ==================== 阶段辅助方法 ====================

  /**
   * 运行单个阶段并捕获结果
   */
  private async runStage<T>(
    stageNum: number,
    name: string,
    fn: () => Promise<T>,
  ): Promise<{ stage: ResearchStage; result: T | null }> {
    const stage: ResearchStage = {
      stage: stageNum,
      name,
      status: 'running',
      startedAt: new Date().toISOString(),
    };

    try {
      const result = await fn();
      stage.status = 'completed';
      stage.completedAt = new Date().toISOString();
      stage.result = result as any;
      return { stage, result };
    } catch (error) {
      stage.status = 'failed';
      stage.completedAt = new Date().toISOString();
      stage.error = error.message;
      throw error;
    }
  }

  private createSkippedStage(stageNum: number, name: string): ResearchStage {
    return {
      stage: stageNum,
      name,
      status: 'completed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      result: { skipped: true },
    };
  }

  /**
   * 推送研究进度到前端（WebSocket）
   */
  private pushProgress(
    userId: string,
    sessionId: string,
    stage: number,
    stageName: string,
    status: 'running' | 'completed' | 'failed',
  ): void {
    try {
      this.gateway.sendAiResearchProgress(userId, {
        sessionId,
        stage,
        stageName,
        status,
        totalStages: 5,
      });
    } catch (error) {
      this.logger.warn(`[研究] WebSocket 推送失败: ${error.message}`);
    }
  }

  private async updateSession(sessionId: string, stages: ResearchStage[]): Promise<void> {
    const db = this.prisma;
    await db.aiResearchSession.update({
      where: { id: sessionId },
      data: { stages: JSON.parse(JSON.stringify(stages)) },
    });
  }

  // ==================== 解析辅助方法 ====================

  /**
   * 从交易员提案文本中解析结构化决策
   */
  private parseTraderDecision(
    proposal: string,
    riskAdjustments: {
      adjustedLeverage?: number | null;
      adjustedPositionSizePercent?: number | null;
      adjustedStopLoss?: number | null;
      adjustedTakeProfit?: number | null;
    },
  ): AiTradeDecision {
    const defaults: AiTradeDecision = {
      action: 'wait',
      confidence: 0,
      leverage: 1,
      positionSizePercent: 2,
      stopLoss: null,
      takeProfit: null,
      reasoning: proposal,
    };

    try {
      // 尝试从 proposal 中提取 JSON
      let jsonStr = proposal;
      const jsonMatch = proposal.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      // 尝试找到 JSON 对象
      const jsonObjMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonObjMatch) {
        jsonStr = jsonObjMatch[0];
      }

      const parsed = JSON.parse(jsonStr);

      const decision: AiTradeDecision = {
        action: parsed.action || parsed.vote || 'wait',
        confidence: Math.min(100, Math.max(0, parsed.confidence || 0)),
        leverage: parsed.leverage || 1,
        positionSizePercent: parsed.positionSizePercent || parsed.positionSize || 2,
        stopLoss: parsed.stopLoss || null,
        takeProfit: parsed.targetPrice || parsed.takeProfit || null,
        reasoning: parsed.reasoning || proposal.slice(0, 1000),
      };

      // 应用风控调整
      if (riskAdjustments.adjustedLeverage != null) {
        decision.leverage = riskAdjustments.adjustedLeverage;
      }
      if (riskAdjustments.adjustedPositionSizePercent != null) {
        decision.positionSizePercent = riskAdjustments.adjustedPositionSizePercent;
      }
      if (riskAdjustments.adjustedStopLoss != null) {
        decision.stopLoss = riskAdjustments.adjustedStopLoss;
      }
      if (riskAdjustments.adjustedTakeProfit != null) {
        decision.takeProfit = riskAdjustments.adjustedTakeProfit;
      }

      return decision;
    } catch {
      this.logger.warn('[研究] 交易员提案 JSON 解析失败，使用 wait 默认值');
      return defaults;
    }
  }

  /**
   * 格式化分析师报告供交易员使用
   */
  private formatReportsForTrader(reports: AnalystReports): string {
    const parts: string[] = [];

    if (reports.marketReport) {
      parts.push(`=== MARKET ANALYSIS ===\n${reports.marketReport}`);
    }
    if (reports.technicalReport) {
      parts.push(`=== TECHNICAL ANALYSIS ===\n${reports.technicalReport}`);
    }
    if (reports.fundamentalsReport) {
      parts.push(`=== FUNDAMENTALS ANALYSIS ===\n${reports.fundamentalsReport}`);
    }
    if (reports.newsReport) {
      parts.push(`=== NEWS ANALYSIS ===\n${reports.newsReport}`);
    }
    if (reports.sentimentReport) {
      parts.push(`=== SENTIMENT ANALYSIS ===\n${reports.sentimentReport}`);
    }

    return parts.join('\n\n') || 'No analyst reports available.';
  }

  /**
   * 6-action → direction 映射
   */
  private actionToDirection(action: string): string {
    switch (action) {
      case 'open_long':
      case 'close_short':
        return 'buy';
      case 'open_short':
      case 'close_long':
        return 'sell';
      default:
        return 'hold';
    }
  }

  /**
   * 判断 action 是否可执行（非 hold/wait）
   */
  private isActionable(action: string): boolean {
    return ['open_long', 'open_short', 'close_long', 'close_short'].includes(action);
  }

  /**
   * 累加 LLM 费用到 aiConfig.currentSpend
   */
  private async incrementSpend(userId: string, cost: number): Promise<void> {
    try {
      const config = await this.prisma.aiConfig.findUnique({ where: { userId } });
      if (!config) return;
      const newSpend = Number(config.currentSpend) + cost;
      await this.prisma.aiConfig.update({
        where: { userId },
        data: { currentSpend: newSpend },
      });
    } catch (error) {
      this.logger.warn(`[研究] 更新费用失败: ${error.message}`);
    }
  }
}
