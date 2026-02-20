import { Injectable, Logger } from '@nestjs/common';
import { QuickAnalysisService, QuickAnalysisConfig, QuickAnalysisResult } from './quick-analysis.service';
import { AiTradeDecision, AiAction, AiCamp } from '../../types/ai.types';
import { UserApiKeys } from '../llm.service';
import { PromptConfig } from './prompt-builder.service';

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
  debateContext?: string; // Q5: Stage 2+3 辩论摘要，注入到每个投票模型的用户消息中
  /** Phase 9.0 T4: 多币种模式 */
  symbols?: string[]; // 多币种候选列表
  precomputedMarketData?: string; // 预构建的多币种市场数据 prompt
  promptConfig?: PromptConfig; // PromptBuilder 配置
}

/**
 * 单模型投票结果
 */
export interface ModelVote {
  modelId: string;
  decision: AiTradeDecision;
  weight: number; // 等权投票 (对齐 NoFx 扁平设计)
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
 * 多模型共识投票服务（产品 B Debate 模式，对齐 NoFx 扁平等权设计）
 *
 * 工作流程:
 * 1. 遍历配置的模型列表（如 deepseek-chat, gpt-4o-mini 等）
 * 2. 每个模型独立调用 QuickAnalysisService
 * 3. 收集 6-action 投票
 * 4. 阵营归类: BULLISH(open_long+close_short) / BEARISH(open_short+close_long) / NEUTRAL(hold+wait)
 * 5. 等权投票聚合（所有模型 weight=1.0，对齐 NoFx 无学习系统设计）
 * 6. 胜出阵营内再选具体 action
 */
@Injectable()
export class ConsensusService {
  private readonly logger = new Logger(ConsensusService.name);

  constructor(
    private readonly quickAnalysis: QuickAnalysisService,
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

    // 等权投票: 所有模型 weight=1.0 (对齐 NoFx 扁平设计，无 Evolution Tier)
    const flatWeight = 1.0;

    // 并行调用所有模型
    const votePromises = models.map((modelId) =>
      this.getModelVote(modelId, config, flatWeight).catch((error) => ({
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

  // ========================= 多币种共识投票 (Phase 9.0 T4) =========================

  /**
   * 运行多币种共识投票
   *
   * 每个模型收到所有候选币的市场数据，输出 JSON 数组（每币一个决策）。
   * 逐币加权聚合 → Record<symbol, ConsensusResult>
   *
   * 对齐 NoFx debate/engine.go L760-932 (determineMultiCoinConsensus)
   */
  async runMultiCoinConsensus(
    config: ConsensusConfig,
  ): Promise<Record<string, ConsensusResult>> {
    const startTime = Date.now();
    const { models, symbols } = config;

    if (!symbols || symbols.length === 0) {
      throw new Error('多币种共识需要至少一个 symbol');
    }
    if (models.length === 0) {
      throw new Error('至少需要一个模型参与投票');
    }

    this.logger.log(
      `[多币种共识] 开始: ${symbols.length} 币种, ${models.length} 模型`,
    );

    const flatWeight = 1.0;

    // 并行调用所有模型（每个模型分析所有币种）
    const votePromises = models.map((modelId) =>
      this.getMultiCoinModelVote(modelId, config, flatWeight).catch((error) => ({
        modelId,
        allDecisions: symbols.map((s) => ({
          action: 'hold' as AiAction,
          confidence: 0,
          leverage: 1,
          positionSizePercent: 0,
          stopLoss: null,
          takeProfit: null,
          reasoning: `模型调用失败: ${error.message}`,
          symbol: s,
        })),
        weight: 0,
        cost: 0,
        latencyMs: 0,
        success: false,
        error: error.message || String(error),
      })),
    );

    const votes = await Promise.all(votePromises);

    // 逐币种聚合
    const results: Record<string, ConsensusResult> = {};

    for (const symbol of symbols) {
      // 为每个币种提取各模型的投票
      const symbolVotes: ModelVote[] = votes.map((v) => {
        const symbolDecision = v.allDecisions.find(
          (d: any) => d.symbol === symbol || d.symbol?.includes(symbol.split('/')[0]),
        ) || v.allDecisions[0]; // fallback

        return {
          modelId: v.modelId,
          decision: {
            action: symbolDecision?.action || ('hold' as AiAction),
            confidence: symbolDecision?.confidence || 0,
            leverage: symbolDecision?.leverage || 1,
            positionSizePercent: symbolDecision?.positionSizePercent || 0,
            stopLoss: symbolDecision?.stopLoss ?? null,
            takeProfit: symbolDecision?.takeProfit ?? null,
            reasoning: symbolDecision?.reasoning || '',
          },
          weight: v.success ? flatWeight : 0,
          cost: v.cost / symbols.length, // 均摊成本
          latencyMs: v.latencyMs,
          success: v.success !== false,
          error: v.error,
        };
      });

      const validVotes = symbolVotes.filter((v) => v.success && v.weight > 0);

      if (validVotes.length === 0) {
        results[symbol] = this.buildDefaultResult(symbol, symbolVotes, 0);
      } else {
        results[symbol] = this.calculateConsensus(symbol, validVotes, symbolVotes);
      }
    }

    const totalLatencyMs = Date.now() - startTime;
    const totalCost = votes.reduce((sum, v) => sum + (v.cost || 0), 0);

    // 更新每个 result 的耗时和总成本
    for (const symbol of symbols) {
      results[symbol].totalLatencyMs = totalLatencyMs;
      results[symbol].totalCost = totalCost / symbols.length;
    }

    this.logger.log(
      `[多币种共识] 完成: ${symbols.length} 币种, ${models.length} 模型, ` +
        `总耗时 ${totalLatencyMs}ms, 总成本 $${totalCost.toFixed(6)}`,
    );

    return results;
  }

  /**
   * 多币种模型投票（一次 LLM 调用覆盖所有候选币）
   */
  private async getMultiCoinModelVote(
    modelId: string,
    config: ConsensusConfig,
    weight: number,
  ): Promise<{
    modelId: string;
    allDecisions: AiTradeDecision[];
    weight: number;
    cost: number;
    latencyMs: number;
    success: boolean;
    error?: string;
  }> {
    const startTime = Date.now();

    // 使用预构建的市场数据 + 多币种 prompt
    const analysisConfig: QuickAnalysisConfig = {
      userId: config.userId,
      symbol: config.symbols?.[0] || config.symbol, // 主币种
      timeframe: config.timeframe,
      secondaryTimeframe: config.secondaryTimeframe,
      modelId,
      apiKeys: config.apiKeys,
      temperature: 0.4,
      debateContext: config.debateContext,
      promptConfig: config.promptConfig,
      precomputedMarketData: config.precomputedMarketData,
    };

    const result: QuickAnalysisResult =
      await this.quickAnalysis.analyze(analysisConfig);

    return {
      modelId,
      allDecisions: result.allDecisions, // 所有币种的决策
      weight,
      cost: result.cost,
      latencyMs: Date.now() - startTime,
      success: true,
    };
  }

  // ========================= 单模型投票 =========================

  private async getModelVote(
    modelId: string,
    config: ConsensusConfig,
    weight: number,
  ): Promise<ModelVote> {
    const startTime = Date.now();

    const analysisConfig: QuickAnalysisConfig = {
      userId: config.userId,
      symbol: config.symbol,
      timeframe: config.timeframe,
      secondaryTimeframe: config.secondaryTimeframe,
      modelId,
      apiKeys: config.apiKeys,
      temperature: 0.4, // 略高温度增加模型间差异性
      debateContext: config.debateContext, // Q5: 传递辩论上下文
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

    // sceneText 默认值（debate-orchestrator 会用自己构建的 sceneText 覆盖）
    const sceneText = `consensus:${symbol}`;

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
