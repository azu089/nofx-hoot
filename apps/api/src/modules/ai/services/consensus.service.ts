import { Injectable, Logger } from '@nestjs/common';
import { QuickAnalysisService, QuickAnalysisConfig, QuickAnalysisResult } from './quick-analysis.service';
import { EvolutionService } from './evolution.service';
import { AiTradeDecision, AiAction, AiCamp } from '../types/ai.types';
import { UserApiKeys } from './llm.service';

/**
 * 共识投票配置
 */
export interface ConsensusConfig {
  userId: string;
  symbol: string;
  timeframe: string;
  secondaryTimeframe?: string;
  models: string[]; // 参与投票的模型列表
  apiKeys: UserApiKeys;
}

/**
 * 单模型投票结果
 */
export interface ModelVote {
  modelId: string;
  decision: AiTradeDecision;
  weight: number; // 基于 Evolution Tier 的权重
  cost: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}

/**
 * 共识投票结果
 */
export interface ConsensusResult {
  symbol: string;
  consensusAction: AiAction;
  consensusCamp: AiCamp;
  avgConfidence: number;
  avgLeverage: number;
  avgPositionSizePercent: number;
  avgStopLoss: number | null;
  avgTakeProfit: number | null;
  reasoning: string;
  votes: ModelVote[];
  totalCost: number;
  totalLatencyMs: number;
  sceneText: string; // BM25 场景文本
  consensusScore: number; // 有效票数（供 Safety L2 检查）
}

/**
 * 多模型共识投票服务（产品 B Debate 模式）
 *
 * 工作流程:
 * 1. 遍历配置的模型列表（如 deepseek-chat, gpt-4o-mini 等）
 * 2. 每个模型独立调用 QuickAnalysisService
 * 3. 收集 6-action 投票
 * 4. 阵营归类: BULLISH(open_long+close_short) / BEARISH(open_short+close_long) / NEUTRAL(hold+wait)
 * 5. 加权投票（高 Tier 模型权重高 — EvolutionService）
 * 6. 胜出阵营内再选具体 action
 *
 * 权重计算参考:
 *   Tier 3: weight = 1.5
 *   Tier 2: weight = 1.0
 *   Tier 1: weight = 0.5
 *   Tier 0: 不参与投票
 */
@Injectable()
export class ConsensusService {
  private readonly logger = new Logger(ConsensusService.name);

  constructor(
    private readonly quickAnalysis: QuickAnalysisService,
    private readonly evolution: EvolutionService,
  ) {}

  /**
   * 运行多模型共识投票
   */
  async runConsensus(config: ConsensusConfig): Promise<ConsensusResult> {
    const startTime = Date.now();
    const { models } = config;

    if (models.length === 0) {
      throw new Error('至少需要一个模型参与投票');
    }

    this.logger.log(
      `[共识] 开始: ${config.symbol}, ${models.length} 个模型参与`,
    );

    // 获取用户进化状态（用于权重计算）
    const evolutionState = await this.evolution.getEvolutionState(config.userId);
    const baseWeight = this.tierToWeight(evolutionState.tier);

    // 并行调用所有模型
    const votePromises = models.map((modelId) =>
      this.getModelVote(modelId, config, baseWeight).catch((error) => ({
        modelId,
        decision: {
          action: 'hold' as AiAction,
          confidence: 0,
          leverage: 1,
          positionSizePercent: 0,
          stopLoss: null,
          takeProfit: null,
          reasoning: `模型调用失败: ${error.message}`,
        },
        weight: 0,
        cost: 0,
        latencyMs: 0,
        success: false,
        error: error.message || String(error),
      })),
    );

    const votes = await Promise.all(votePromises);

    // 过滤成功的投票
    const validVotes = votes.filter((v) => v.success && v.weight > 0);

    if (validVotes.length === 0) {
      this.logger.warn('[共识] 所有模型投票失败，默认 hold');
      return this.buildDefaultResult(config.symbol, votes, Date.now() - startTime);
    }

    // 阵营归类 + 加权计算
    const result = this.calculateConsensus(config.symbol, validVotes, votes);

    const totalLatencyMs = Date.now() - startTime;
    result.totalLatencyMs = totalLatencyMs;

    this.logger.log(
      `[共识] 完成: ${config.symbol}, action=${result.consensusAction}, ` +
        `camp=${result.consensusCamp}, confidence=${result.avgConfidence.toFixed(1)}%, ` +
        `${validVotes.length}/${models.length} 有效票, ` +
        `总耗时 ${totalLatencyMs}ms, 总成本 $${result.totalCost.toFixed(6)}`,
    );

    return result;
  }

  // ========================= 单模型投票 =========================

  private async getModelVote(
    modelId: string,
    config: ConsensusConfig,
    weight: number,
  ): Promise<ModelVote & { sceneText?: string }> {
    const startTime = Date.now();

    const analysisConfig: QuickAnalysisConfig = {
      userId: config.userId,
      symbol: config.symbol,
      timeframe: config.timeframe,
      secondaryTimeframe: config.secondaryTimeframe,
      modelId,
      apiKeys: config.apiKeys,
      temperature: 0.4, // 略高温度增加模型间差异性
    };

    const result: QuickAnalysisResult =
      await this.quickAnalysis.analyze(analysisConfig);

    return {
      modelId,
      decision: result.decision,
      weight,
      cost: result.cost,
      latencyMs: Date.now() - startTime,
      success: true,
      sceneText: result.sceneText,
    };
  }

  // ========================= 共识计算 =========================

  /**
   * 加权投票计算共识
   *
   * 阵营归类（与 v2-dev debate.service 一致）:
   * - BULLISH: open_long + close_short
   * - BEARISH: open_short + close_long
   * - NEUTRAL: hold + wait
   *
   * 胜出阵营内再选权重最高的具体 action
   */
  private calculateConsensus(
    symbol: string,
    validVotes: ModelVote[],
    allVotes: ModelVote[],
  ): ConsensusResult {
    // 1. 阵营统计
    const campWeights: Record<AiCamp, number> = {
      BULLISH: 0,
      BEARISH: 0,
      NEUTRAL: 0,
    };

    const campVotes: Record<AiCamp, ModelVote[]> = {
      BULLISH: [],
      BEARISH: [],
      NEUTRAL: [],
    };

    for (const vote of validVotes) {
      const camp = this.actionToCamp(vote.decision.action);
      campWeights[camp] += vote.weight * (vote.decision.confidence / 100);
      campVotes[camp].push(vote);
    }

    // 2. 找出胜出阵营
    let winningCamp: AiCamp = 'NEUTRAL';
    let maxWeight = 0;

    for (const camp of Object.keys(campWeights) as AiCamp[]) {
      if (campWeights[camp] > maxWeight) {
        maxWeight = campWeights[camp];
        winningCamp = camp;
      }
    }

    // 3. 从胜出阵营中选择具体 action（按 confidence × weight 排序取最高）
    const winningVotes = campVotes[winningCamp];
    let bestAction: AiAction = 'hold';

    if (winningVotes.length > 0) {
      // 统计同阵营内各 action 的权重
      const actionWeights: Record<string, number> = {};
      for (const vote of winningVotes) {
        const action = vote.decision.action;
        actionWeights[action] =
          (actionWeights[action] || 0) + vote.weight * vote.decision.confidence;
      }

      // 取权重最高的 action
      let maxActionWeight = 0;
      for (const [action, weight] of Object.entries(actionWeights)) {
        if (weight > maxActionWeight) {
          maxActionWeight = weight;
          bestAction = action as AiAction;
        }
      }
    }

    // 4. 计算共识参数（加权平均）
    const totalWeight = validVotes.reduce((sum, v) => sum + v.weight, 0);

    const avgConfidence =
      validVotes.reduce((sum, v) => sum + v.decision.confidence * v.weight, 0) / totalWeight;
    const avgLeverage =
      validVotes.reduce((sum, v) => sum + v.decision.leverage * v.weight, 0) / totalWeight;
    const avgPositionSize =
      validVotes.reduce((sum, v) => sum + v.decision.positionSizePercent * v.weight, 0) / totalWeight;

    // SL/TP: 只从胜出阵营中取平均
    const slVotes = winningVotes.filter((v) => v.decision.stopLoss != null);
    const tpVotes = winningVotes.filter((v) => v.decision.takeProfit != null);

    const avgStopLoss =
      slVotes.length > 0
        ? slVotes.reduce((sum, v) => sum + (v.decision.stopLoss || 0), 0) / slVotes.length
        : null;
    const avgTakeProfit =
      tpVotes.length > 0
        ? tpVotes.reduce((sum, v) => sum + (v.decision.takeProfit || 0), 0) / tpVotes.length
        : null;

    // 5. 汇总 reasoning
    const reasoning = this.buildConsensusReasoning(
      winningCamp,
      bestAction,
      campWeights,
      validVotes,
    );

    const totalCost = allVotes.reduce((sum, v) => sum + v.cost, 0);

    // 从第一个成功票取 sceneText（用于 BM25 记忆存储）
    const firstSuccess = allVotes.find((v) => v.success) as (ModelVote & { sceneText?: string }) | undefined;
    const sceneText = firstSuccess?.sceneText || `consensus:${symbol}`;

    return {
      symbol,
      consensusAction: bestAction,
      consensusCamp: winningCamp,
      avgConfidence: Math.round(avgConfidence * 10) / 10,
      avgLeverage: Math.round(avgLeverage * 10) / 10,
      avgPositionSizePercent: Math.round(avgPositionSize * 10) / 10,
      avgStopLoss: avgStopLoss ? Math.round(avgStopLoss * 100) / 100 : null,
      avgTakeProfit: avgTakeProfit ? Math.round(avgTakeProfit * 100) / 100 : null,
      reasoning,
      votes: allVotes,
      totalCost,
      totalLatencyMs: 0, // 由调用者填充
      sceneText,
      consensusScore: validVotes.length,
    };
  }

  // ========================= 辅助方法 =========================

  /**
   * 6-action → 3 阵营映射
   */
  private actionToCamp(action: AiAction): AiCamp {
    switch (action) {
      case 'open_long':
      case 'close_short':
        return 'BULLISH';
      case 'open_short':
      case 'close_long':
        return 'BEARISH';
      case 'hold':
      case 'wait':
      default:
        return 'NEUTRAL';
    }
  }

  /**
   * Evolution Tier → 投票权重
   */
  private tierToWeight(tier: number): number {
    switch (tier) {
      case 3:
        return 1.5;
      case 2:
        return 1.0;
      case 1:
        return 0.5;
      case 0:
      default:
        return 0;
    }
  }

  /**
   * 构建共识推理文本
   */
  private buildConsensusReasoning(
    winningCamp: AiCamp,
    bestAction: AiAction,
    campWeights: Record<AiCamp, number>,
    validVotes: ModelVote[],
  ): string {
    const campLabels: Record<AiCamp, string> = {
      BULLISH: '看涨',
      BEARISH: '看跌',
      NEUTRAL: '中性',
    };

    const lines: string[] = [
      `[多模型共识] ${validVotes.length} 个模型投票`,
      `阵营得分: 看涨=${campWeights.BULLISH.toFixed(2)}, 看跌=${campWeights.BEARISH.toFixed(2)}, 中性=${campWeights.NEUTRAL.toFixed(2)}`,
      `胜出: ${campLabels[winningCamp]} → ${bestAction}`,
      '',
      '各模型投票:',
    ];

    for (const vote of validVotes) {
      lines.push(
        `  - ${vote.modelId}: ${vote.decision.action} (信心 ${vote.decision.confidence}%, 权重 ${vote.weight})`,
      );
    }

    return lines.join('\n');
  }

  /**
   * 默认结果（所有模型失败时）
   */
  private buildDefaultResult(
    symbol: string,
    allVotes: ModelVote[],
    totalLatencyMs: number,
  ): ConsensusResult {
    return {
      symbol,
      consensusAction: 'hold',
      consensusCamp: 'NEUTRAL',
      avgConfidence: 0,
      avgLeverage: 1,
      avgPositionSizePercent: 0,
      avgStopLoss: null,
      avgTakeProfit: null,
      reasoning: '所有模型投票失败，默认 hold',
      votes: allVotes,
      totalCost: allVotes.reduce((sum, v) => sum + v.cost, 0),
      totalLatencyMs,
      sceneText: `consensus:${symbol}:failed`,
      consensusScore: 0,
    };
  }
}
