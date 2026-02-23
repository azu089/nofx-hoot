import { Injectable, Logger } from '@nestjs/common';
import { QuickAnalysisService, QuickAnalysisConfig, QuickAnalysisResult } from './quick-analysis.service';
import { AiTradeDecision, AiAction, AiCamp } from '../../types/ai.types';
import { UserApiKeys } from '../llm.service';
import { PromptConfig } from './prompt-builder.service';
import { translateExchangeError } from '../../utils/error-translator';
import { AI_MODELS } from '../../constants/models';

/**
 * 多模型共识分析配置
 */
export interface ConsensusConfig {
  userId: string;
  symbol: string;
  timeframe: string;
  secondaryTimeframe?: string;
  models: string[]; // 参与分析的模型列表
  apiKeys: UserApiKeys;
  debateContext?: string; // Q5: Stage 2+3 辩论摘要，注入到每个模型的用户消息中
  /** Phase 9.0 T4: 多币种模式 */
  symbols?: string[]; // 多币种候选列表
  precomputedMarketData?: string; // 预构建的多币种市场数据 prompt
  promptConfig?: PromptConfig; // PromptBuilder 配置
  /** 账户上下文（透传到 QuickAnalysis Prompt） */
  accountInfo?: QuickAnalysisConfig['accountInfo'];
}

/**
 * 单模型分析结果
 */
export interface ModelVote {
  modelId: string;
  decision: AiTradeDecision;
  weight: number; // 等权 (对齐 NoFx 扁平设计)
  cost: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}

/**
 * 多模型共识结果
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
  consensusScore: number; // 胜出 action 的模型数（供 Safety L2 检查）
  actionScores?: Record<string, number>; // 行动得分映射（前端展示用）
}

/**
 * 多模型共识分析服务（共识策略，对齐 NoFx 扁平等权设计）
 *
 * 工作流程（对齐 NoFx determineMultiCoinConsensus）:
 * 1. 遍历配置的模型列表（如 deepseek-chat, gpt-4o-mini 等）
 * 2. 每个模型独立调用 QuickAnalysisService 进行分析
 * 3. 收集每个模型的 action 判断
 * 4. 按 action 累积加权得分，最高分胜出（无门槛）
 * 5. 等权聚合（所有模型 weight=1.0，对齐 NoFx 无学习系统设计）
 */
@Injectable()
export class ConsensusService {
  private readonly logger = new Logger(ConsensusService.name);

  constructor(
    private readonly quickAnalysis: QuickAnalysisService,
  ) {}

  /**
   * 运行多模型共识分析
   */
  async runConsensus(config: ConsensusConfig): Promise<ConsensusResult> {
    const startTime = Date.now();
    const { models } = config;

    if (models.length === 0) {
      throw new Error('At least one model is required for voting');
    }

    this.logger.log(
      `[共识] 开始: ${config.symbol}, ${models.length} 个模型参与`,
    );

    // 等权: 所有模型 weight=1.0 (对齐 NoFx 扁平设计，无 Evolution Tier)
    const flatWeight = 1.0;

    // 错开调用所有模型（每个模型间隔 500ms，避免同时触发 rate limit）
    const votePromises = models.map((modelId, idx) => {
      const delay = idx * 500;
      const run = delay > 0
        ? new Promise<void>((r) => setTimeout(r, delay)).then(() =>
            this.getModelVote(modelId, config, flatWeight))
        : this.getModelVote(modelId, config, flatWeight);
      return run.catch((error) => ({
        modelId,
        decision: {
          action: 'hold' as AiAction,
          confidence: 0,
          leverage: 1,
          positionSizePercent: 0,
          stopLoss: null,
          takeProfit: null,
          reasoning: `模型调用失败: ${translateExchangeError(error.message)}`,
        },
        weight: 0,
        cost: 0,
        latencyMs: 0,
        success: false,
        error: error.message || String(error),
      }));
    });

    const votes = await Promise.all(votePromises);

    // 过滤成功的分析结果（confidence < 50 的视为无效，不计入共识）
    const validVotes = votes.filter(
      (v) => v.success && v.weight > 0 && v.decision.confidence >= 50,
    );

    // NoFx-aligned: 逐模型分析详情日志
    for (const vote of votes) {
      if (vote.success) {
        const isValid = vote.decision.confidence >= 50;
        this.logger.log(
          `[共识] 分析: ${vote.modelId} → ${vote.decision.action} (confidence=${vote.decision.confidence}%${isValid ? '' : ' ⚠️无效<50%'}, leverage=${vote.decision.leverage}x, posPct=${vote.decision.positionSizePercent}%)`,
        );
      } else {
        this.logger.warn(`[共识] 分析失败: ${vote.modelId} - ${vote.error}`);
      }
    }

    if (validVotes.length === 0) {
      this.logger.warn('[共识] 所有模型分析失败，默认 hold');
      return this.buildDefaultResult(config.symbol, votes, Date.now() - startTime);
    }

    // 阵营归类 + 加权计算
    const result = this.calculateConsensus(config.symbol, validVotes, votes);

    const totalLatencyMs = Date.now() - startTime;
    result.totalLatencyMs = totalLatencyMs;

    this.logger.log(
      `[共识] 完成: ${config.symbol}, action=${result.consensusAction}, ` +
        `camp=${result.consensusCamp}, confidence=${result.avgConfidence.toFixed(1)}%, ` +
        `同方向=${result.consensusScore}/${models.length} (有效票${validVotes.length}/${models.length}), ` +
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
      throw new Error('Multi-coin consensus requires at least one symbol');
    }
    if (models.length === 0) {
      throw new Error('At least one model is required for voting');
    }

    this.logger.log(
      `[多币种共识] 开始: ${symbols.length} 币种, ${models.length} 模型`,
    );

    const flatWeight = 1.0;

    // 错峰调用所有模型（每个模型分析所有币种，间隔 500ms 减少 rate limit）
    const votePromises = models.map((modelId, idx) => {
      const delay = idx * 500;
      const run = delay > 0
        ? new Promise<void>((r) => setTimeout(r, delay)).then(() =>
            this.getMultiCoinModelVote(modelId, config, flatWeight))
        : this.getMultiCoinModelVote(modelId, config, flatWeight);
      return run.catch((error) => ({
        modelId,
        allDecisions: symbols.map((s) => ({
          action: 'hold' as AiAction,
          confidence: 0,
          leverage: 1,
          positionSizePercent: 0,
          stopLoss: null,
          takeProfit: null,
          reasoning: `模型调用失败: ${translateExchangeError(error.message)}`,
          symbol: s,
        })),
        weight: 0,
        cost: 0,
        latencyMs: 0,
        success: false,
        error: error.message || String(error),
      }));
    });

    const votes = await Promise.all(votePromises);

    // 逐币种聚合
    const results: Record<string, ConsensusResult> = {};

    for (const symbol of symbols) {
      // 为每个币种提取各模型的投票（使用 normalizeSymbol 防止跨币串扰）
      const symbolVotes: ModelVote[] = votes.map((v) => {
        // 1. 用 normalizeSymbol 匹配 LLM 输出的 symbol 字段
        let symbolDecision = v.allDecisions.find((d: any) => {
          if (!d.symbol) return false;
          return this.normalizeSymbol(d.symbol, symbols) === symbol;
        });

        // 2. 回退: 按位置索引匹配（LLM 通常按 prompt 中的 symbol 顺序输出）
        if (!symbolDecision) {
          const idx = symbols.indexOf(symbol);
          if (idx >= 0 && idx < v.allDecisions.length) {
            symbolDecision = v.allDecisions[idx];
          }
        }

        // 3. 最终回退: hold 占位（绝不使用其他币的决策）
        if (!symbolDecision) {
          this.logger.warn(
            `[多币种共识] 模型 ${v.modelId} 未返回 ${symbol} 的决策，标记为 hold`,
          );
        }

        const dec = symbolDecision || {
          action: 'hold' as AiAction,
          confidence: 0,
          leverage: 1,
          positionSizePercent: 0,
          stopLoss: null,
          takeProfit: null,
          reasoning: `模型未返回 ${symbol} 的决策`,
        };

        return {
          modelId: v.modelId,
          decision: {
            action: dec.action || ('hold' as AiAction),
            confidence: dec.confidence || 0,
            leverage: dec.leverage || 1,
            positionSizePercent: dec.positionSizePercent || 0,
            stopLoss: dec.stopLoss ?? null,
            takeProfit: dec.takeProfit ?? null,
            reasoning: dec.reasoning || '',
          },
          weight: v.success && symbolDecision ? flatWeight : 0,
          cost: v.cost / symbols.length,
          latencyMs: v.latencyMs,
          success: v.success !== false && !!symbolDecision,
          error: v.error,
        };
      });

      const validVotes = symbolVotes.filter(
        (v) => v.success && v.weight > 0 && v.decision.confidence >= 50,
      );

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

    // NoFx-aligned: 逐币种共识日志
    for (const symbol of symbols) {
      const r = results[symbol];
      this.logger.log(
        `[多币种共识] ${symbol}: ${r.consensusAction} (camp=${r.consensusCamp}, conf=${r.avgConfidence}%, score=${r.consensusScore})`,
      );
    }

    this.logger.log(
      `[多币种共识] 完成: ${symbols.length} 币种, ${models.length} 模型, ` +
        `总耗时 ${totalLatencyMs}ms, 总成本 $${totalCost.toFixed(6)}`,
    );

    return results;
  }

  /**
   * 标准化 symbol: LLM 可能返回 "BTCUSDT" 但输入是 "BTC/USDT:USDT"
   * 复用 debate.service.ts normalizeSymbol 逻辑
   */
  private normalizeSymbol(raw: string, symbols: string[]): string {
    // 1) 精确匹配
    if (symbols.includes(raw)) return raw;
    // 2) 去掉 "/" 和 ":" 后匹配
    const stripped = raw.replace(/[/:]/g, '');
    for (const s of symbols) {
      if (s.replace(/[/:]/g, '') === stripped) return s;
    }
    // 3) CCXT 期货后缀兼容: "ETH/USDT" → "ETH/USDT:USDT"
    for (const s of symbols) {
      const basePair = s.split(':')[0];
      if (basePair === raw || basePair.replace(/[/:]/g, '') === stripped) return s;
    }
    // 4) 大小写不敏感
    const rawUpper = raw.toUpperCase();
    for (const s of symbols) {
      if (s.toUpperCase() === rawUpper) return s;
      if (s.replace(/[/:]/g, '').toUpperCase() === stripped.toUpperCase()) return s;
      const basePair = s.split(':')[0];
      if (basePair.toUpperCase() === rawUpper) return s;
    }
    // 5) 无法匹配
    return raw;
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
      accountInfo: config.accountInfo,
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
      accountInfo: config.accountInfo,
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
    // 对齐 NoFx determineMultiCoinConsensus: 按 action 直接分组（非阵营）
    // NoFx 行为: score = sum(confidence/100), 最高 score 的 action 胜出
    const actionData: Record<string, {
      score: number;
      votes: ModelVote[];
      totalConf: number;
      totalLeverage: number;
      totalPosPct: number;
      totalSL: number;
      totalTP: number;
      slCount: number;
      tpCount: number;
    }> = {};

    for (const vote of validVotes) {
      const action = vote.decision.action;
      if (!actionData[action]) {
        actionData[action] = {
          score: 0, votes: [], totalConf: 0, totalLeverage: 0,
          totalPosPct: 0, totalSL: 0, totalTP: 0, slCount: 0, tpCount: 0,
        };
      }
      const ad = actionData[action];
      // 权重 = confidence/100（对齐 NoFx debate/engine.go L803）
      ad.score += vote.weight * (vote.decision.confidence / 100);
      ad.votes.push(vote);
      ad.totalConf += vote.decision.confidence;
      ad.totalLeverage += vote.decision.leverage > 0 ? vote.decision.leverage : 5;
      ad.totalPosPct += vote.decision.positionSizePercent;
      if (vote.decision.stopLoss != null && vote.decision.stopLoss > 0) {
        ad.totalSL += vote.decision.stopLoss;
        ad.slCount++;
      }
      if (vote.decision.takeProfit != null && vote.decision.takeProfit > 0) {
        ad.totalTP += vote.decision.takeProfit;
        ad.tpCount++;
      }
    }

    // 找出得分最高的 action（对齐 NoFx: 无阵营分组，直接 maxScore 胜出）
    let bestAction: AiAction = 'hold';
    let maxScore = 0;
    for (const [action, ad] of Object.entries(actionData)) {
      if (ad.score > maxScore) {
        maxScore = ad.score;
        bestAction = action as AiAction;
      }
    }

    // 从胜出 action 的投票中计算参数（对齐 NoFx 简单平均 totalXxx / count）
    const winData = actionData[bestAction];
    const winCount = winData?.votes.length || 1;
    const winningVotes = winData?.votes || [];

    const avgConfidence = winData ? winData.totalConf / winCount : 0;
    let avgLeverage = winData ? winData.totalLeverage / winCount : 5;
    // NoFx clamp: leverage [1, 20]
    avgLeverage = Math.max(1, Math.min(20, avgLeverage));
    const avgPositionSize = winData ? winData.totalPosPct / winCount : 0;
    const avgStopLoss = winData && winData.slCount > 0 ? winData.totalSL / winData.slCount : null;
    const avgTakeProfit = winData && winData.tpCount > 0 ? winData.totalTP / winData.tpCount : null;

    // 推导阵营（从胜出 action 映射，保持 ConsensusResult 接口兼容）
    const winningCamp = this.actionToCamp(bestAction);

    // 构建 action 得分映射（用于日志和前端展示）
    const actionScores: Record<string, number> = {};
    for (const [action, ad] of Object.entries(actionData)) {
      actionScores[action] = Math.round(ad.score * 100) / 100;
    }

    const reasoning = this.buildConsensusReasoning(
      bestAction, maxScore, actionScores, validVotes, validVotes.length,
    );

    const totalCost = allVotes.reduce((sum, v) => sum + v.cost, 0);
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
      totalLatencyMs: 0,
      sceneText,
      // consensusScore = 胜出 action 的投票数（对齐 NoFx winning action count）
      consensusScore: winningVotes.length,
      actionScores,
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
   * 构建共识推理文本（分析风格，无投票文案）
   */
  private buildConsensusReasoning(
    bestAction: AiAction,
    bestScore: number,
    actionScores: Record<string, number>,
    validVotes: ModelVote[],
    totalValidCount: number,
  ): string {
    const ACT_CN: Record<string, string> = {
      open_long: '做多', open_short: '做空',
      close_long: '平多', close_short: '平空',
      hold: '持有', wait: '观望',
    };

    // 模型 ID → 显示名
    const modelName = (id: string): string => {
      const found = Object.values(AI_MODELS).find(m => m.name === id);
      return found?.displayName || id;
    };

    const lines: string[] = [
      `[共识] ${validVotes.length} 个模型独立分析`,
    ];

    // 每个模型的判断
    for (const vote of validVotes) {
      const d = vote.decision;
      const actCn = ACT_CN[d.action] || d.action;
      const isOpen = d.action === 'open_long' || d.action === 'open_short';
      let detail = `置信度 ${d.confidence}%`;
      if (isOpen) {
        detail += `, 杠杆 ${d.leverage}x, 仓位 ${d.positionSizePercent}%`;
      }
      lines.push(`· ${modelName(vote.modelId)}: ${actCn} (${detail})`);
    }

    // 各阵营投票分布（按得分降序）
    const sortedActions = Object.entries(actionScores)
      .filter(([, score]) => score > 0)
      .sort(([, a], [, b]) => b - a);

    for (const [act, score] of sortedActions) {
      const actCn = ACT_CN[act] || act;
      const count = validVotes.filter(v => v.decision.action === act).length;
      lines.push(`${count}模型${actCn}，得分 ${score.toFixed(2)}`);
    }

    // 最终决策
    const bestActCn = ACT_CN[bestAction] || bestAction;
    const isOpenAction = bestAction === 'open_long' || bestAction === 'open_short';
    const winningVotes = validVotes.filter(v => v.decision.action === bestAction);
    const winCount = winningVotes.length || 1;
    let summary = `→ 执行${bestActCn}`;

    if (isOpenAction && winningVotes.length > 0) {
      const avgLev = Math.round(winningVotes.reduce((s, v) => s + (v.decision.leverage || 5), 0) / winCount * 10) / 10;
      const avgPos = Math.round(winningVotes.reduce((s, v) => s + (v.decision.positionSizePercent || 0), 0) / winCount * 10) / 10;
      summary += `，杠杆 ${avgLev}x，仓位 ${avgPos}%`;
    }

    lines.push(summary);
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
      reasoning: '所有模型调用失败，默认持有',
      votes: allVotes,
      totalCost: allVotes.reduce((sum, v) => sum + v.cost, 0),
      totalLatencyMs,
      sceneText: `consensus:${symbol}:failed`,
      consensusScore: 0,
    };
  }
}
