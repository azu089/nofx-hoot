import { Injectable, Logger } from '@nestjs/common';
import { LLMService, UserApiKeys } from './llm.service';
import {
  AI_ROLES,
  AI_MODELS,
  DEFAULT_ROLE_PROMPTS,
  SYSTEM_PROMPT_BASE,
  AIRole,
  AIAction,
  AI_ACTIONS,
} from '../constants/prompts';
import { IndicatorsResult } from './indicators.service';

/**
 * 辩论配置
 */
export interface DebateConfig {
  models?: Partial<Record<string, string>>; // 角色 → 模型 ID 覆盖
  rolePrompts?: Partial<Record<string, string>>; // 角色 → 自定义提示词覆盖
  temperature?: number; // 温度参数 (默认 0.7)
  apiKeys: UserApiKeys; // 用户提供的 API Keys
  maxRounds?: number; // 最大辩论轮数 (默认 5, 最小 3, 最大 10)
  tradeHistoryPrompt?: string; // 最近交易表现提示词 (用于 prompt 注入)
  memoryPrompt?: string; // BM25 相似历史场景提示词
}

/**
 * 市场上下文
 */
export interface MarketContext {
  symbol: string; // 交易对
  currentPrice: number; // 当前价格
  timeframe: string; // 时间周期
  indicators: IndicatorsResult; // 技术指标
  priceChange24h?: number; // 24h 价格变化
  volume24h?: number; // 24h 成交量
}

/**
 * 辩论条目（单个角色的单轮发言）
 */
export interface DebateEntry {
  role: string; // 角色名称
  model: string; // 使用的模型
  round: number; // 轮次 (1-maxRounds)
  direction: string; // 方向 LONG, SHORT, NEUTRAL
  confidence: number; // 信心值 (0-100)
  arguments: any; // LLM 解析后的 JSON 响应
  chainOfThought?: any; // 思维链（如果有）
  tokenUsage: number; // Token 消耗
  latencyMs: number; // 延迟（毫秒）
  cost: number; // 成本（美元）
}

/**
 * 辩论结果
 */
export interface DebateResult {
  entries: DebateEntry[]; // 所有辩论条目
  consensus: {
    direction: string; // buy, sell, hold (向后兼容)
    action: string; // 具体 6-action: open_long, open_short, close_long, close_short, hold, wait
    confidence: number; // 0-100
    score: number; // 共识得分（多少角色同意）
    reasoning: string; // 综合推理
  };
  totalCost: number; // 总成本
  totalTokens: number; // 总 Token 消耗
  totalLatencyMs: number; // 总延迟
}

/**
 * AI 辩论服务
 *
 * 协调 5 个角色进行可配置轮数的辩论：
 * 1. Round 1: 初步分析 - 各角色独立分析市场数据
 * 2. Round 2+: 反驳与深度讨论 - 各角色回应其他角色的观点
 * 3. Round N (最终轮): 最终投票 - 各角色给出最终立场和投票
 *
 * 支持提前收敛：如果 Round >= 3 且满足收敛条件，辩论提前结束
 */
@Injectable()
export class DebateService {
  private readonly logger = new Logger(DebateService.name);

  // 默认角色 → 模型映射
  private readonly defaultRoleModels: Record<string, string> = {
    [AI_ROLES.BULL]: AI_MODELS.DEEPSEEK.name,
    [AI_ROLES.BEAR]: AI_MODELS.GPT4O_MINI.name,
    [AI_ROLES.ANALYST]: AI_MODELS.DEEPSEEK.name,
    [AI_ROLES.CONTRARIAN]: AI_MODELS.GPT4O_MINI.name,
    [AI_ROLES.RISK_MANAGER]: AI_MODELS.DEEPSEEK.name,
  };

  constructor(private readonly llmService: LLMService) {}

  /**
   * 运行 AI 辩论
   *
   * @param context 市场上下文
   * @param config 辩论配置
   * @returns 辩论结果
   */
  async runDebate(
    context: MarketContext,
    config: DebateConfig,
  ): Promise<DebateResult> {
    const startTime = Date.now();
    this.logger.log(`开始 AI 辩论: ${context.symbol} @ ${context.currentPrice}`);

    // 确定最大轮数 (默认 5, 最小 3, 最大 10)
    const maxRounds = config.maxRounds || 5;
    const effectiveMaxRounds = Math.max(3, Math.min(maxRounds, 10));

    // 合并配置
    const finalConfig: DebateConfig = {
      models: { ...this.defaultRoleModels, ...(config?.models || {}) },
      rolePrompts: { ...DEFAULT_ROLE_PROMPTS, ...(config?.rolePrompts || {}) },
      temperature: config?.temperature ?? 0.7,
      apiKeys: config.apiKeys,
      maxRounds: effectiveMaxRounds,
      tradeHistoryPrompt: config.tradeHistoryPrompt,
      memoryPrompt: config.memoryPrompt,
    };

    // 存储所有辩论条目
    const allEntries: DebateEntry[] = [];
    let lastRound = effectiveMaxRounds; // 记录实际最后一轮

    // 动态轮数循环
    for (let round = 1; round <= effectiveMaxRounds; round++) {
      const roundDescription = this.getRoundDescription(round, effectiveMaxRounds);
      this.logger.log(`Round ${round}/${effectiveMaxRounds}: ${roundDescription}`);

      // 运行当前轮次
      const roundEntries = await this.runRound(round, effectiveMaxRounds, context, allEntries, finalConfig);
      allEntries.push(...roundEntries);

      // 收敛检测 (仅在至少完成 3 轮后)
      if (round >= 3 && this.checkConvergence(allEntries, round)) {
        this.logger.log(`辩论在 Round ${round} 提前收敛`);
        lastRound = round;
        break;
      }

      lastRound = round;
    }

    // 使用最后一轮的投票计算共识
    const lastRoundEntries = allEntries.filter((e) => e.round === lastRound);
    const consensus = this.calculateConsensus(lastRoundEntries);

    // 统计总计
    const totalCost = allEntries.reduce((sum, e) => sum + e.cost, 0);
    const totalTokens = allEntries.reduce((sum, e) => sum + e.tokenUsage, 0);
    const totalLatencyMs = Date.now() - startTime;

    this.logger.log(
      `辩论完成: 共识=${consensus.direction}, 信心=${consensus.confidence}%, ` +
        `轮数=${lastRound}/${effectiveMaxRounds}, 成本=$${totalCost.toFixed(6)}, 耗时=${totalLatencyMs}ms`,
    );

    return {
      entries: allEntries,
      consensus,
      totalCost,
      totalTokens,
      totalLatencyMs,
    };
  }

  /**
   * 检查是否收敛
   *
   * 收敛条件:
   * 1. 当前轮所有角色一致同意同一方向 (至少 4 个角色)
   * 2. 连续两轮投票结果相同且不是 NEUTRAL
   *
   * @param allEntries 所有辩论条目
   * @param currentRound 当前轮次
   * @returns 是否收敛
   */
  private checkConvergence(allEntries: DebateEntry[], currentRound: number): boolean {
    if (currentRound < 3) return false;

    // 获取最近两轮的条目
    const prevRoundEntries = allEntries.filter((e) => e.round === currentRound - 1);
    const currRoundEntries = allEntries.filter((e) => e.round === currentRound);

    if (prevRoundEntries.length === 0 || currRoundEntries.length === 0) return false;

    // 检查条件 1: 当前轮所有角色一致 (至少 4 个角色)
    const currDirections = currRoundEntries.map((e) => e.direction.toUpperCase());
    const allSameDirection = currDirections.every((d) => d === currDirections[0]);
    if (allSameDirection && currRoundEntries.length >= 4) {
      this.logger.log(`收敛检测: 当前轮 ${currRoundEntries.length} 个角色一致同意 ${currDirections[0]}`);
      return true;
    }

    // 检查条件 2: 连续两轮阵营投票结果相同且不是 NEUTRAL
    const prevVote = this.getVoteResult(prevRoundEntries);
    const currVote = this.getVoteResult(currRoundEntries);
    if (prevVote === currVote && prevVote !== 'NEUTRAL') {
      this.logger.log(`收敛检测: 连续两轮阵营投票结果相同 (${prevVote})`);
      return true;
    }

    return false;
  }

  /**
   * 获取一轮的投票结果（按阵营分组）
   *
   * 6-action 分组:
   * - BULLISH: open_long, close_short
   * - BEARISH: open_short, close_long
   * - NEUTRAL: hold, wait
   *
   * 向后兼容: LONG → BULLISH, SHORT → BEARISH, NEUTRAL → NEUTRAL
   *
   * @param entries 单轮的辩论条目
   * @returns 多数阵营 BULLISH, BEARISH, NEUTRAL
   */
  private getVoteResult(entries: DebateEntry[]): string {
    const camps: Record<string, number> = { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 };

    entries.forEach((e) => {
      const vote = (e.arguments?.vote || e.arguments?.action || e.direction || 'hold').toLowerCase();
      const camp = this.actionToCamp(vote);
      camps[camp]++;
    });

    if (camps.BULLISH > camps.BEARISH && camps.BULLISH > camps.NEUTRAL) return 'BULLISH';
    if (camps.BEARISH > camps.BULLISH && camps.BEARISH > camps.NEUTRAL) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * 将 action 映射到阵营
   */
  private actionToCamp(action: string): string {
    const normalized = action.toLowerCase().trim();
    // 6-action 格式
    if (normalized === 'open_long' || normalized === 'close_short') return 'BULLISH';
    if (normalized === 'open_short' || normalized === 'close_long') return 'BEARISH';
    if (normalized === 'hold' || normalized === 'wait') return 'NEUTRAL';
    // 向后兼容旧格式
    if (normalized === 'long') return 'BULLISH';
    if (normalized === 'short') return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * 从解析后的响应中提取 direction
   * 优先使用 action 字段，兼容 position 字段
   */
  private extractDirection(parsedArgs: any): string {
    // 优先使用 action 字段 (6-action 格式)
    if (parsedArgs.action) {
      const action = parsedArgs.action.toLowerCase();
      const validActions = ['open_long', 'open_short', 'close_long', 'close_short', 'hold', 'wait'];
      if (validActions.includes(action)) {
        return action;
      }
    }
    // 兼容旧 position 字段
    if (parsedArgs.position) {
      const pos = parsedArgs.position.toUpperCase();
      if (pos === 'LONG') return 'open_long';
      if (pos === 'SHORT') return 'open_short';
      return 'hold';
    }
    return 'hold';
  }

  /**
   * 获取轮次描述
   *
   * @param round 当前轮次
   * @param maxRounds 最大轮数
   * @returns 轮次描述
   */
  private getRoundDescription(round: number, maxRounds: number): string {
    if (round === 1) return '初步分析 - 各角色独立分析市场数据';
    if (round === maxRounds) return '最终投票 - 各角色给出最终立场';
    if (round === 2) return '反驳 - 各角色回应其他角色的观点';
    return `深度讨论 (Round ${round}) - 继续讨论并修正观点`;
  }

  /**
   * 运行单轮辩论
   *
   * @param round 轮次 (1-maxRounds)
   * @param maxRounds 最大轮数
   * @param context 市场上下文
   * @param previousEntries 之前的辩论条目
   * @param config 辩论配置
   * @returns 当前轮次的辩论条目
   */
  private async runRound(
    round: number,
    maxRounds: number,
    context: MarketContext,
    previousEntries: DebateEntry[],
    config: DebateConfig,
  ): Promise<DebateEntry[]> {
    const roundStartTime = Date.now();

    // 获取所有角色
    const roles = Object.values(AI_ROLES);

    // 并行调用所有角色的 LLM（使用 allSettled 避免一个失败影响其他）
    const promises = roles.map(async (role) => {
      try {
        // 获取角色对应的模型和提示词
        const modelId = config.models?.[role] || this.defaultRoleModels[role];
        let systemPrompt =
          SYSTEM_PROMPT_BASE + '\n\n' + (config.rolePrompts?.[role] || DEFAULT_ROLE_PROMPTS[role]);

        // 如果提供了交易历史提示词，注入到系统提示中
        if (config.tradeHistoryPrompt) {
          systemPrompt += '\n\n' + config.tradeHistoryPrompt;
        }

        // 如果提供了 BM25 记忆提示词，注入到系统提示中
        if (config.memoryPrompt) {
          systemPrompt += '\n\n' + config.memoryPrompt;
        }

        // 构建用户消息
        const userMessage = this.buildUserMessage(context, round, maxRounds, previousEntries);

        // 调用 LLM（传入用户 API Keys）
        const response = await this.llmService.chat(modelId, systemPrompt, userMessage, config.apiKeys, {
          temperature: config.temperature,
          maxTokens: 1000,
        });

        // 解析响应
        const parsedArgs = this.parseResponse(response.content, role);

        // 从 action 或 position 字段提取方向
        const direction = this.extractDirection(parsedArgs);

        // 构建辩论条目
        const entry: DebateEntry = {
          role,
          model: modelId,
          round,
          direction,
          confidence: parsedArgs.confidence || 50,
          arguments: parsedArgs,
          tokenUsage: response.tokenUsage,
          latencyMs: response.latencyMs,
          cost: response.cost,
        };

        this.logger.log(
          `${role} (Round ${round}): ${entry.direction} @ ${entry.confidence}% - ${entry.model}`,
        );

        return entry;
      } catch (error) {
        this.logger.warn(`${role} (Round ${round}) 调用失败: ${error.message}`);
        // 返回 null，稍后过滤掉
        return null;
      }
    });

    // 等待所有调用完成
    const results = await Promise.allSettled(promises);

    // 提取成功的条目
    const entries: DebateEntry[] = results
      .filter((r) => r.status === 'fulfilled' && r.value !== null)
      .map((r) => (r as PromiseFulfilledResult<DebateEntry>).value);

    const roundLatency = Date.now() - roundStartTime;
    this.logger.log(`Round ${round} 完成: ${entries.length}/${roles.length} 角色成功, 耗时=${roundLatency}ms`);

    return entries;
  }

  /**
   * 构建用户消息
   *
   * @param context 市场上下文
   * @param round 当前轮次
   * @param maxRounds 最大轮数
   * @param previousEntries 之前的辩论条目
   * @returns 用户消息字符串
   */
  private buildUserMessage(
    context: MarketContext,
    round: number,
    maxRounds: number,
    previousEntries: DebateEntry[],
  ): string {
    // 轮次描述 (使用动态描述)
    const roundDescription = this.getRoundDescription(round, maxRounds);
    let message = `${roundDescription}\n\n`;

    // 基础市场数据
    message += `=== Market Context ===\n`;
    message += `Symbol: ${context.symbol}\n`;
    message += `Current Price: $${context.currentPrice}\n`;
    message += `Timeframe: ${context.timeframe}\n`;

    if (context.priceChange24h !== undefined) {
      message += `24h Change: ${context.priceChange24h > 0 ? '+' : ''}${context.priceChange24h.toFixed(2)}%\n`;
    }

    if (context.volume24h !== undefined) {
      message += `24h Volume: $${context.volume24h.toLocaleString()}\n`;
    }

    // 技术指标
    message += `\n=== Technical Indicators ===\n`;
    const ind = context.indicators;

    // RSI (14)
    if (ind.rsi !== null) {
      message += `RSI(14): ${ind.rsi.toFixed(2)}\n`;
    }

    // RSI (7) - 新增
    if (ind.rsi7 !== null && ind.rsi7 !== undefined) {
      message += `RSI(7): ${ind.rsi7.toFixed(2)}\n`;
    }

    // MACD
    if (ind.macd.macd !== null) {
      message += `MACD: ${ind.macd.macd.toFixed(4)} | Signal: ${ind.macd.signal?.toFixed(4)} | Histogram: ${ind.macd.histogram?.toFixed(4)}\n`;
    }

    // Bollinger Bands
    if (ind.bollingerBands.upper !== null) {
      message += `Bollinger Bands: Upper=${ind.bollingerBands.upper.toFixed(2)} | Middle=${ind.bollingerBands.middle?.toFixed(2)} | Lower=${ind.bollingerBands.lower?.toFixed(2)}\n`;
    }

    // EMA (包含 EMA20)
    if (ind.ema.ema12 !== null) {
      let emaLine = `EMA: 12=${ind.ema.ema12.toFixed(2)} | 26=${ind.ema.ema26?.toFixed(2)} | 50=${ind.ema.ema50?.toFixed(2)}`;
      if (ind.ema.ema20 !== null && ind.ema.ema20 !== undefined) {
        emaLine += ` | 20=${ind.ema.ema20.toFixed(2)}`;
      }
      message += emaLine + '\n';
    }

    // ATR (14)
    if (ind.atr !== null) {
      message += `ATR(14): ${ind.atr.toFixed(4)}\n`;
    }

    // ATR (3) - 新增
    if (ind.atr3 !== null && ind.atr3 !== undefined) {
      message += `ATR(3): ${ind.atr3.toFixed(4)}\n`;
    }

    // Donchian Channel - 新增
    if (ind.donchian && ind.donchian.upper !== null) {
      message += `Donchian Channel: Upper=${ind.donchian.upper.toFixed(2)} | Middle=${ind.donchian.middle?.toFixed(2)} | Lower=${ind.donchian.lower?.toFixed(2)}\n`;
    }

    // OBV
    if (ind.obv !== null) {
      message += `OBV: ${ind.obv.toFixed(0)}\n`;
    }

    // 如果是 Round 2 或更高，附加之前轮次的结果
    if (round > 1 && previousEntries.length > 0) {
      // 获取上一轮的结果
      const lastRound = round - 1;
      const lastRoundEntries = previousEntries.filter((e) => e.round === lastRound);

      if (lastRoundEntries.length > 0) {
        message += `\n=== Round ${lastRound} Results ===\n`;

        lastRoundEntries.forEach((entry) => {
          message += `\n[${entry.role.toUpperCase()}] - ${entry.direction} @ ${entry.confidence}%\n`;

          if (entry.arguments?.reasoning) {
            message += `Reasoning: ${entry.arguments.reasoning}\n`;
          }

          if (entry.arguments?.keyPoints && Array.isArray(entry.arguments.keyPoints)) {
            message += `Key Points:\n`;
            entry.arguments.keyPoints.forEach((point: string, i: number) => {
              message += `  ${i + 1}. ${point}\n`;
            });
          }
        });
      }
    }

    // 如果是最后一轮 (maxRounds)，提醒投票
    if (round === maxRounds) {
      message += `\n=== Final Vote ===\n`;
      message += `This is your FINAL VOTE. Please give your conclusive position.\n`;
      message += `Your vote will be counted towards the consensus signal.\n`;
    }

    return message;
  }

  /**
   * 解析 LLM 响应
   *
   * @param raw 原始响应字符串
   * @param role 角色名称（用于日志）
   * @returns 解析后的对象
   */
  private parseResponse(raw: string, role: string): any {
    try {
      // 尝试直接解析 JSON
      return JSON.parse(raw);
    } catch (e1) {
      // 失败：尝试提取 Markdown 代码块中的 JSON
      try {
        const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          return JSON.parse(jsonMatch[1]);
        }

        // 尝试提取 { ... } 包裹的 JSON
        const braceMatch = raw.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          return JSON.parse(braceMatch[0]);
        }

        // 都失败了
        this.logger.warn(`${role} 响应无法解析为 JSON，返回原始文本`);
        return {
          action: 'hold',
          confidence: 50,
          reasoning: raw.slice(0, 300),
          keyPoints: ['解析失败，原始响应'],
          vote: 'hold',
        };
      } catch (e2) {
        // 最后的兜底
        this.logger.error(`${role} 响应完全无法解析: ${e2.message}`);
        return {
          action: 'hold',
          confidence: 50,
          reasoning: 'JSON 解析失败',
          keyPoints: [],
          vote: 'hold',
        };
      }
    }
  }

  /**
   * 计算共识 (6-Action 版本)
   *
   * 投票分两步:
   * 1. 按阵营分组: BULLISH(open_long+close_short), BEARISH(open_short+close_long), NEUTRAL(hold+wait)
   * 2. 在胜出阵营中，找出得票最多的具体 action
   *
   * @param entries 最后一轮的辩论条目
   * @returns 共识结果
   */
  private calculateConsensus(entries: DebateEntry[]): DebateResult['consensus'] {
    if (entries.length === 0) {
      return {
        direction: 'hold',
        action: 'hold',
        confidence: 0,
        score: 0,
        reasoning: '无有效投票',
      };
    }

    // 统计阵营投票和具体 action 投票
    const campVotes: Record<string, number> = { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 };
    const actionVotes: Record<string, number> = {};
    const campDetails: Record<string, { confidences: number[]; keyPoints: string[] }> = {
      BULLISH: { confidences: [], keyPoints: [] },
      BEARISH: { confidences: [], keyPoints: [] },
      NEUTRAL: { confidences: [], keyPoints: [] },
    };

    entries.forEach((entry) => {
      const vote = (entry.arguments?.vote || entry.arguments?.action || entry.direction || 'hold').toLowerCase();
      const camp = this.actionToCamp(vote);

      campVotes[camp]++;
      campDetails[camp].confidences.push(entry.confidence);

      // 统计具体 action 投票
      const normalizedAction = this.normalizeAction(vote);
      actionVotes[normalizedAction] = (actionVotes[normalizedAction] || 0) + 1;

      // 收集关键点
      if (entry.arguments?.keyPoints && Array.isArray(entry.arguments.keyPoints)) {
        campDetails[camp].keyPoints.push(...entry.arguments.keyPoints);
      }
    });

    // 找出多数阵营
    const maxCampVotes = Math.max(campVotes.BULLISH, campVotes.BEARISH, campVotes.NEUTRAL);
    let winningCamp: string;

    if (campVotes.BULLISH === maxCampVotes && campVotes.BULLISH > campVotes.BEARISH) {
      winningCamp = 'BULLISH';
    } else if (campVotes.BEARISH === maxCampVotes) {
      winningCamp = 'BEARISH';
    } else {
      winningCamp = 'NEUTRAL';
    }

    // 映射阵营到 direction (向后兼容)
    const directionMap: Record<string, string> = {
      BULLISH: 'buy',
      BEARISH: 'sell',
      NEUTRAL: 'hold',
    };
    const majorityDirection = directionMap[winningCamp];

    // 检查是否有明确多数（≥3 票）
    if (maxCampVotes < 3) {
      return {
        direction: 'hold',
        action: 'hold',
        confidence: 50,
        score: maxCampVotes,
        reasoning: '辩论未达成明确共识（无过半投票），建议观望',
      };
    }

    // 在胜出阵营内找具体 action
    const campActions: Record<string, string[]> = {
      BULLISH: ['open_long', 'close_short'],
      BEARISH: ['open_short', 'close_long'],
      NEUTRAL: ['hold', 'wait'],
    };
    const possibleActions = campActions[winningCamp];
    let winningAction = possibleActions[0]; // 默认
    let maxActionVotes = 0;
    for (const act of possibleActions) {
      if ((actionVotes[act] || 0) > maxActionVotes) {
        maxActionVotes = actionVotes[act] || 0;
        winningAction = act;
      }
    }

    // 计算平均信心值
    const majorityConfidences = campDetails[winningCamp].confidences;
    const avgConfidence =
      majorityConfidences.length > 0
        ? majorityConfidences.reduce((sum, c) => sum + c, 0) / majorityConfidences.length
        : 50;

    // 组合推理
    const keyPoints = campDetails[winningCamp].keyPoints.slice(0, 5);
    const reasoning = `共识: ${winningAction} (${winningCamp})\n阵营得票: ${campVotes.BULLISH} BULLISH | ${campVotes.BEARISH} BEARISH | ${campVotes.NEUTRAL} NEUTRAL\n关键理由:\n${keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;

    return {
      direction: majorityDirection,
      action: winningAction,
      confidence: Math.round(avgConfidence),
      score: maxCampVotes,
      reasoning,
    };
  }

  /**
   * 将 vote/action 标准化为 6-action 格式
   */
  private normalizeAction(vote: string): string {
    const v = vote.toLowerCase().trim();
    // 6-action 格式
    if (['open_long', 'open_short', 'close_long', 'close_short', 'hold', 'wait'].includes(v)) return v;
    // 向后兼容旧格式
    if (v === 'long') return 'open_long';
    if (v === 'short') return 'open_short';
    if (v === 'neutral') return 'hold';
    return 'hold';
  }
}
