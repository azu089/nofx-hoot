import { Injectable, Logger, Optional } from '@nestjs/common';
import { LLMService, UserApiKeys } from '../llm.service';
import { AiMemoryService } from '../memory.service';
import {
  AI_ROLES,
  AI_MODELS,
  DEFAULT_ROLE_PROMPTS,
  SYSTEM_PROMPT_BASE,
  ANALYSIS_OUTPUT_FORMAT,
  AIRole,
  AIAction,
  AI_ACTIONS,
  formatMemoryPrompt,
} from '../../constants/prompts';
import { IndicatorsResult } from '../indicators.service';
import {
  TRADING_ROLE_PROMPTS,
  buildVotingSystemPrompt,
  buildVotingUserPrompt,
} from '../../constants/trading-prompts';

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
  memoryPrompt?: string; // BM25 相似历史场景提示词 (统一注入，per-role BM25 不可用时的兜底)
  analystReports?: string; // G1: Stage 1 分析师报告注入辩论 (Round 1)
  userId?: string; // G2: 用于角色专属 BM25 记忆检索
  sceneText?: string; // G2: BM25 查询文本（通常为 reportsConcat）
  judgeModel?: string; // G3: Judge 使用的深度思考模型（默认用 risk_manager 模型）
  additionalMarketData?: string; // Phase 9.0 T4: 多币种辩论额外市场数据（注入所有候选币数据）
  skipJudge?: boolean; // Phase 9.1: true → 跳过 Judge, 用投票阶段 (Product B NoFx-aligned)
  useShortPrompts?: boolean; // Phase 9.1: true → 用 TRADING_ROLE_PROMPTS 短提示词
  votingSymbols?: string[]; // Phase 9.1: 多币种投票时的 symbol 列表
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
  votingEntries?: DebateEntry[]; // Phase 9.1: 投票阶段条目
  multiCoinConsensus?: Record<string, DebateResult['consensus']>; // Phase 9.1: 多币种共识
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

  constructor(
    private readonly llmService: LLMService,
    @Optional() private readonly memoryService?: AiMemoryService,
  ) {}

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

    // 确定最大轮数 (默认 1, 对齐 TradingAgents max_debate_rounds=1)
    const maxRounds = config.maxRounds || 1;
    const effectiveMaxRounds = Math.max(1, Math.min(maxRounds, 10));

    // 合并配置
    const finalConfig: DebateConfig = {
      models: { ...this.defaultRoleModels, ...(config?.models || {}) },
      rolePrompts: { ...DEFAULT_ROLE_PROMPTS, ...(config?.rolePrompts || {}) },
      temperature: config?.temperature ?? 0.7,
      apiKeys: config.apiKeys,
      maxRounds: effectiveMaxRounds,
      tradeHistoryPrompt: config.tradeHistoryPrompt,
      memoryPrompt: config.memoryPrompt,
      additionalMarketData: config.additionalMarketData,
      skipJudge: config.skipJudge,
      useShortPrompts: config.useShortPrompts,
      votingSymbols: config.votingSymbols,
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

    if (finalConfig.skipJudge) {
      // ★ Phase 9.1: Product B (NoFx-aligned) — 投票阶段 + 代码共识，无 Judge
      const votingEntries = await this.runVotingPhase(allEntries, context, finalConfig);
      const symbols = finalConfig.votingSymbols || [context.symbol];
      const multiConsensus = this.determineVotingConsensus(votingEntries, symbols);

      // 取主币种共识作为 DebateResult.consensus
      const primaryConsensus = multiConsensus[context.symbol] || {
        direction: 'hold', action: 'hold', confidence: 0, score: 0,
        reasoning: '投票阶段未产生有效共识',
      };

      const totalCost = [...allEntries, ...votingEntries].reduce((sum, e) => sum + e.cost, 0);
      const totalTokens = [...allEntries, ...votingEntries].reduce((sum, e) => sum + e.tokenUsage, 0);
      const totalLatencyMs = Date.now() - startTime;

      this.logger.log(
        `辩论完成(NoFx投票): action=${primaryConsensus.action}, 信心=${primaryConsensus.confidence}%, ` +
          `轮数=${lastRound}/${effectiveMaxRounds}, 投票=${votingEntries.length}, 成本=$${totalCost.toFixed(6)}, 耗时=${totalLatencyMs}ms`,
      );

      return {
        entries: allEntries,
        consensus: primaryConsensus,
        totalCost,
        totalTokens,
        totalLatencyMs,
        votingEntries,
        multiCoinConsensus: multiConsensus,
      };
    } else {
      // ★ Product A (TradingAgents) — Judge 裁决 (原有逻辑不变)
      const judgeResult = await this.runJudge(allEntries, context, finalConfig);

      const totalCost = allEntries.reduce((sum, e) => sum + e.cost, 0) + judgeResult.cost;
      const totalTokens = allEntries.reduce((sum, e) => sum + e.tokenUsage, 0) + judgeResult.tokens;
      const totalLatencyMs = Date.now() - startTime;

      this.logger.log(
        `辩论完成: Judge裁决=${judgeResult.consensus.action}, 信心=${judgeResult.consensus.confidence}%, ` +
          `轮数=${lastRound}/${effectiveMaxRounds}, 成本=$${totalCost.toFixed(6)}, 耗时=${totalLatencyMs}ms`,
      );

      return {
        entries: allEntries,
        consensus: judgeResult.consensus,
        totalCost,
        totalTokens,
        totalLatencyMs,
      };
    }
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

    // Product B (useShortPrompts=true): 顺序执行 (对齐 NoFx debate/engine.go L190-234)
    // Product A (useShortPrompts=false): 并行执行 (对齐 TradingAgents 效率优先)
    if (config.useShortPrompts) {
      return this.runRoundSequential(round, maxRounds, context, previousEntries, config, roles, roundStartTime);
    } else {
      return this.runRoundParallel(round, maxRounds, context, previousEntries, config, roles, roundStartTime);
    }
  }

  /**
   * 顺序执行单轮辩论 (Product B / NoFx-aligned)
   *
   * 对齐 NoFx debate/engine.go L190-234:
   * 同一轮内后面的参与者可以看到前面参与者同轮的发言，形成真正的"对话"。
   */
  private async runRoundSequential(
    round: number,
    maxRounds: number,
    context: MarketContext,
    previousEntries: DebateEntry[],
    config: DebateConfig,
    roles: string[],
    roundStartTime: number,
  ): Promise<DebateEntry[]> {
    const entries: DebateEntry[] = [];

    for (const role of roles) {
      try {
        // 合并 previousEntries + 本轮已完成的 entries，让后面角色看到前面角色同轮发言
        const allPrior = [...previousEntries, ...entries];
        const entry = await this.callSingleRole(role, round, maxRounds, context, allPrior, config);
        if (entry) entries.push(entry);
      } catch (error) {
        this.logger.warn(`${role} (Round ${round}) 调用失败: ${error.message}`);
      }
    }

    const roundLatency = Date.now() - roundStartTime;
    this.logger.log(`Round ${round} 完成(顺序): ${entries.length}/${roles.length} 角色成功, 耗时=${roundLatency}ms`);

    return entries;
  }

  /**
   * 并行执行单轮辩论 (Product A / TradingAgents)
   */
  private async runRoundParallel(
    round: number,
    maxRounds: number,
    context: MarketContext,
    previousEntries: DebateEntry[],
    config: DebateConfig,
    roles: string[],
    roundStartTime: number,
  ): Promise<DebateEntry[]> {
    const promises = roles.map(async (role) => {
      try {
        return await this.callSingleRole(role, round, maxRounds, context, previousEntries, config);
      } catch (error) {
        this.logger.warn(`${role} (Round ${round}) 调用失败: ${error.message}`);
        return null;
      }
    });

    const results = await Promise.allSettled(promises);

    const entries: DebateEntry[] = results
      .filter((r) => r.status === 'fulfilled' && r.value !== null)
      .map((r) => (r as PromiseFulfilledResult<DebateEntry>).value);

    const roundLatency = Date.now() - roundStartTime;
    this.logger.log(`Round ${round} 完成(并行): ${entries.length}/${roles.length} 角色成功, 耗时=${roundLatency}ms`);

    return entries;
  }

  /**
   * 调用单个角色的 LLM (共用逻辑，供顺序/并行模式调用)
   */
  private async callSingleRole(
    role: string,
    round: number,
    maxRounds: number,
    context: MarketContext,
    previousEntries: DebateEntry[],
    config: DebateConfig,
  ): Promise<DebateEntry | null> {
    const modelId = config.models?.[role] || this.defaultRoleModels[role];
    // Phase 9.1: useShortPrompts → 用 TRADING_ROLE_PROMPTS 短角色描述 (Product B NoFx-aligned)
    const rolePrompt = config.useShortPrompts
      ? (TRADING_ROLE_PROMPTS[role as AIRole] || config.rolePrompts?.[role] || DEFAULT_ROLE_PROMPTS[role])
      : (config.rolePrompts?.[role] || DEFAULT_ROLE_PROMPTS[role]);
    let systemPrompt = SYSTEM_PROMPT_BASE + '\n\n' + rolePrompt;

    // 如果提供了交易历史提示词，注入到系统提示中
    if (config.tradeHistoryPrompt) {
      systemPrompt += '\n\n' + config.tradeHistoryPrompt;
    }

    // G2: 角色专属 BM25 记忆检索（仅 Product A: 对齐 TradingAgents per-role 独立记忆）
    // Product B (useShortPrompts=true): 跳过 BM25（NoFx 无 BM25，用 RecentOrders+TradingStats 替代）
    if (!config.useShortPrompts && this.memoryService && config.userId && config.sceneText) {
      try {
        const roleMemories = await this.memoryService.retrieveSimilar(
          config.sceneText, config.userId, 2, role,
        );
        if (roleMemories.length > 0) {
          const roleMemoryPrompt = formatMemoryPrompt(
            roleMemories.map((m) => ({
              sceneText: m.sceneText,
              action: m.action,
              pnl: m.pnlPercent || 0,
              isWin: m.isWin || false,
              lesson: m.lesson || undefined,
            })),
          );
          systemPrompt += '\n\n' + roleMemoryPrompt;
        }
      } catch (err) {
        this.logger.warn(`${role} BM25 记忆检索失败: ${err.message}`);
      }
    } else if (!config.useShortPrompts && config.memoryPrompt) {
      // 兜底: Product A 如果没有 per-role BM25，使用统一记忆提示
      systemPrompt += '\n\n' + config.memoryPrompt;
    }

    // 构建用户消息
    let userMessage = this.buildUserMessage(context, round, maxRounds, previousEntries);

    // G1: Round 1 注入分析师研究报告（仅 Product A: 对齐 TradingAgents）
    if (!config.useShortPrompts && round === 1 && config.analystReports) {
      userMessage = `=== ANALYST RESEARCH REPORTS ===\n${config.analystReports.slice(0, 3000)}\n\n${userMessage}`;
    }

    // Phase 9.0 T4: 多币种辩论注入额外候选币数据
    if (config.additionalMarketData) {
      userMessage += '\n\n' + config.additionalMarketData;
    }

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
   * Research Manager Judge 裁决 (对齐 TradingAgents research_manager.py)
   *
   * 单次 LLM 调用：读取全部分析师论据 → 做出最终投资决策
   * 替代原先的投票共识机制，由 Judge 深度综合所有观点后裁决
   *
   * @param entries 所有辩论条目
   * @param context 市场上下文
   * @param config 辩论配置
   * @returns Judge 裁决结果 + 成本
   */
  private async runJudge(
    entries: DebateEntry[],
    context: MarketContext,
    config: DebateConfig,
  ): Promise<{ consensus: DebateResult['consensus']; cost: number; tokens: number }> {
    // 构建分析师论据摘要
    let analystSummary = '';
    for (const entry of entries) {
      analystSummary += `\n[${entry.role.toUpperCase()}] Direction: ${entry.direction} | Confidence: ${entry.confidence}%\n`;
      if (entry.arguments?.reasoning) {
        analystSummary += `Reasoning: ${entry.arguments.reasoning}\n`;
      }
      if (entry.arguments?.keyPoints && Array.isArray(entry.arguments.keyPoints)) {
        analystSummary += `Key Points:\n`;
        entry.arguments.keyPoints.forEach((p: string, i: number) => {
          analystSummary += `  ${i + 1}. ${p}\n`;
        });
      }
    }

    // Judge 系统提示 (对齐 TradingAgents research_manager 的裁决模式)
    let systemPrompt = `You are the Research Manager (Portfolio Manager Judge). You have received analysis from ${entries.length} specialist analysts. Your job is to:

1. Carefully evaluate ALL analyst arguments — bull, bear, technical, contrarian, and risk perspectives
2. Weigh the strength of each analyst's evidence and reasoning
3. Make a DEFINITIVE investment decision (do NOT default to hold/wait unless truly justified)
4. Provide your final recommendation with detailed rationale

IMPORTANT: You are the FINAL decision maker. Be decisive. Reference the strongest arguments from each analyst.
If bull and bear cases are roughly equal, lean toward "wait" rather than gambling. But if one side has clearly stronger evidence, commit to that direction.

${ANALYSIS_OUTPUT_FORMAT}`;

    // 注入交易历史（如果有）
    if (config.tradeHistoryPrompt) {
      systemPrompt += '\n\n' + config.tradeHistoryPrompt;
    }

    // GAP-B: Judge 角色专属 BM25 记忆 (对齐 TradingAgents invest_judge_memory)
    let judgeMemoryInjected = false;
    if (this.memoryService && config.userId && config.sceneText) {
      try {
        const judgeMemories = await this.memoryService.retrieveSimilar(
          config.sceneText, config.userId, 2, 'invest_judge',
        );
        if (judgeMemories.length > 0) {
          const judgeMemoryPrompt = formatMemoryPrompt(
            judgeMemories.map((m) => ({
              sceneText: m.sceneText,
              action: m.action,
              pnl: m.pnlPercent || 0,
              isWin: m.isWin || false,
              lesson: m.lesson || undefined,
            })),
          );
          systemPrompt += '\n\n' + judgeMemoryPrompt;
          judgeMemoryInjected = true;
          this.logger.log(`[Judge] invest_judge BM25 记忆注入: ${judgeMemories.length} 条`);
        }
      } catch (err) {
        this.logger.warn(`[Judge] invest_judge BM25 记忆检索失败: ${err.message}`);
      }
    }
    // 兜底: 无 per-role 记忆时使用统一 memoryPrompt
    if (!judgeMemoryInjected && config.memoryPrompt) {
      systemPrompt += '\n\n' + config.memoryPrompt;
    }

    let userMessage = `=== Market Context ===
Symbol: ${context.symbol}
Current Price: $${context.currentPrice}
Timeframe: ${context.timeframe}
${context.priceChange24h !== undefined ? `24h Change: ${context.priceChange24h > 0 ? '+' : ''}${context.priceChange24h.toFixed(2)}%` : ''}
${config.additionalMarketData ? '\n' + config.additionalMarketData : ''}
=== Analyst Arguments (${entries.length} specialists) ===${analystSummary}
Based on all analyst arguments above, make your FINAL investment decision.`;

    // G3: Judge 优先使用配置的深度思考模型（对齐 TradingAgents research_manager 用 deep_think）
    const judgeModel = config.judgeModel || config.models?.[AI_ROLES.RISK_MANAGER] || this.defaultRoleModels[AI_ROLES.RISK_MANAGER];

    try {
      const response = await this.llmService.chat(
        judgeModel,
        systemPrompt,
        userMessage,
        config.apiKeys,
        { temperature: 0.3, maxTokens: 1200 },
      );

      const parsed = this.parseResponse(response.content, 'judge');
      const action = this.extractDirection(parsed);
      const camp = this.actionToCamp(action);

      const directionToSimple: Record<string, string> = {
        BULLISH: 'buy',
        BEARISH: 'sell',
        NEUTRAL: 'hold',
      };

      return {
        consensus: {
          direction: directionToSimple[camp] || 'hold',
          action,
          confidence: parsed.confidence || 60,
          score: entries.length, // 参考了多少位分析师
          reasoning: parsed.reasoning || response.content.slice(0, 500),
        },
        cost: response.cost,
        tokens: response.tokenUsage,
      };
    } catch (error) {
      this.logger.error(`Judge 裁决失败: ${error.message}`);
      // 兜底：回退到简单投票
      const lastRoundEntries = entries.filter(
        (e) => e.round === Math.max(...entries.map((x) => x.round)),
      );
      return {
        consensus: this.calculateConsensus(lastRoundEntries),
        cost: 0,
        tokens: 0,
      };
    }
  }

  // ==================== Phase 9.1: NoFx-Aligned 投票阶段 ====================

  /**
   * 投票阶段: 辩论结束后，5 个角色各自投出 <final_vote>
   * 对齐 NoFx debate/engine.go buildVotingSystemPrompt + buildVotingUserPrompt
   */
  private async runVotingPhase(
    allEntries: DebateEntry[],
    context: MarketContext,
    config: DebateConfig,
  ): Promise<DebateEntry[]> {
    this.logger.log('开始投票阶段 (NoFx-aligned)');
    const roles = Object.values(AI_ROLES);

    // 构建辩论摘要 (用户 Prompt)
    const votingUserPrompt = buildVotingUserPrompt(
      allEntries.map((e) => ({
        role: e.role,
        round: e.round,
        direction: e.direction,
        confidence: e.confidence,
        arguments: e.arguments,
      })),
    );

    // 如果有额外市场数据 (多币种), 追加到用户 Prompt
    const userPrompt = config.additionalMarketData
      ? `${votingUserPrompt}\n\n${config.additionalMarketData}`
      : votingUserPrompt;

    // 顺序调用 5 个角色的投票 LLM (对齐 NoFx collectVotes: 顺序执行)
    const entries: DebateEntry[] = [];
    for (const role of roles) {
      try {
        const modelId = config.models?.[role] || this.defaultRoleModels[role];
        const systemPrompt = buildVotingSystemPrompt(role as AIRole, '');

        const response = await this.llmService.chat(modelId, systemPrompt, userPrompt, config.apiKeys, {
          temperature: config.temperature ?? 0.3, // 投票阶段用低温度提高一致性
          maxTokens: 1200,
        });

        // 解析 <final_vote> 标签
        const parsedVotes = this.parseFinalVote(response.content, role);
        const direction = parsedVotes.length > 0
          ? this.extractDirectionFromAction(parsedVotes[0]?.action || 'hold')
          : 'NEUTRAL';

        const entry: DebateEntry = {
          role,
          model: modelId,
          round: -1, // 投票阶段标记为 -1
          direction,
          confidence: parsedVotes.length > 0 ? (parsedVotes[0]?.confidence || 50) : 50,
          arguments: parsedVotes, // 存储完整投票数组
          tokenUsage: response.tokenUsage,
          latencyMs: response.latencyMs,
          cost: response.cost,
        };

        this.logger.log(`投票: ${role} → ${parsedVotes.length} 币种决策, 模型=${modelId}`);
        entries.push(entry);
      } catch (error) {
        this.logger.warn(`${role} 投票失败: ${error.message}`);
      }
    }

    this.logger.log(`投票阶段完成: ${entries.length}/${roles.length} 角色成功`);
    return entries;
  }

  /**
   * 解析 <final_vote> 标签内的 JSON 数组
   */
  private parseFinalVote(
    content: string,
    role: string,
  ): Array<{
    symbol: string;
    action: string;
    confidence: number;
    leverage: number;
    position_pct: number;
    stop_loss: number;
    take_profit: number;
    reasoning: string;
  }> {
    try {
      // 提取 <final_vote>...</final_vote> 内容
      const match = content.match(/<final_vote>\s*([\s\S]*?)\s*<\/final_vote>/);
      if (match && match[1]) {
        const parsed = JSON.parse(match[1].trim());
        if (Array.isArray(parsed)) return parsed;
        // 如果返回单个对象，包装为数组
        if (typeof parsed === 'object') return [parsed];
      }

      // 兜底: 尝试直接解析整个 content 为 JSON
      const directParse = JSON.parse(content.trim());
      if (Array.isArray(directParse)) return directParse;
      if (typeof directParse === 'object') return [directParse];
    } catch (e) {
      this.logger.warn(`${role} <final_vote> 解析失败，尝试兜底解析`);
    }

    // 最终兜底: 尝试从 content 中提取 JSON 数组
    try {
      const jsonMatch = content.match(/\[\s*\{[\s\S]*?\}\s*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      this.logger.warn(`${role} 兜底 JSON 解析也失败`);
    }

    return [];
  }

  /**
   * 从 action 提取方向字符串
   */
  private extractDirectionFromAction(action: string): string {
    const a = action.toLowerCase();
    if (a === 'open_long' || a === 'close_short') return 'LONG';
    if (a === 'open_short' || a === 'close_long') return 'SHORT';
    return 'NEUTRAL';
  }

  /**
   * 投票共识计算 (严格对齐 NoFx determineMultiCoinConsensus)
   *
   * 算法:
   * 1. 从每个投票 entry 的 arguments 中提取 per-symbol decisions
   * 2. 按 symbol → action 分组，weight = confidence / 100（min 0.5 if < 0.1）
   * 3. 加法累积 score，同 action 的参数分别求和
   * 4. 每个 symbol 选 score 最高的 action 为 winner
   * 5. 算术平均计算 winner action 的参数
   * 6. 应用默认值和限制
   */
  private determineVotingConsensus(
    votingEntries: DebateEntry[],
    symbols: string[],
  ): Record<string, DebateResult['consensus'] & {
    leverage?: number;
    positionPct?: number;
    stopLoss?: number;
    takeProfit?: number;
  }> {
    // actionData 结构 (对齐 NoFx)
    interface ActionData {
      score: number;
      totalConf: number;
      totalLeverage: number;
      totalPosPct: number;
      totalSLPct: number;
      totalTPPct: number;
      count: number;
      reasonings: string[];
    }

    const symbolActions: Record<string, Record<string, ActionData>> = {};

    // 构建 symbol 标准化映射: LLM 可能返回 "BTCUSDT" 但输入是 "BTC/USDT"
    // 将所有格式统一映射到输入 symbols 的格式
    const normalizeSymbol = (raw: string): string => {
      // 1) 精确匹配
      if (symbols.includes(raw)) return raw;
      // 2) 去掉 "/" 和 ":" 后匹配 (BTC/USDT → BTCUSDT, BTC/USDT:USDT → BTCUSDTUSDT)
      const stripped = raw.replace(/[/:]/g, '');
      for (const s of symbols) {
        if (s.replace(/[/:]/g, '') === stripped) return s;
      }
      // 3) 大小写不敏感匹配
      const rawUpper = raw.toUpperCase();
      for (const s of symbols) {
        if (s.toUpperCase() === rawUpper) return s;
        if (s.replace(/[/:]/g, '').toUpperCase() === stripped.toUpperCase()) return s;
      }
      // 4) 无法匹配 → 保持原样
      return raw;
    };

    // 从投票 entries 提取决策
    for (const entry of votingEntries) {
      const decisions = Array.isArray(entry.arguments) ? entry.arguments : [];
      if (decisions.length === 0) continue;

      for (const d of decisions) {
        const rawSymbol = d.symbol || '';
        const action = (d.action || '').toLowerCase();
        if (!rawSymbol || !this.isValidVotingAction(action)) continue;

        // 标准化 symbol: LLM 返回 "BTCUSDT" → 映射到 "BTC/USDT"
        const symbol = normalizeSymbol(rawSymbol);
        if (!symbolActions[symbol]) symbolActions[symbol] = {};
        if (!symbolActions[symbol][action]) {
          symbolActions[symbol][action] = {
            score: 0, totalConf: 0, totalLeverage: 0,
            totalPosPct: 0, totalSLPct: 0, totalTPPct: 0,
            count: 0, reasonings: [],
          };
        }

        const ad = symbolActions[symbol][action];
        let weight = (d.confidence || 0) / 100;
        if (weight < 0.1) weight = 0.5; // NoFx: 低信心默认 0.5 权重

        ad.score += weight;
        ad.totalConf += d.confidence || 50;
        ad.totalLeverage += (d.leverage && d.leverage > 0) ? d.leverage : 5;
        ad.totalPosPct += (d.position_pct && d.position_pct > 0) ? d.position_pct : 0.2;
        ad.totalSLPct += d.stop_loss || 0;
        ad.totalTPPct += d.take_profit || 0;
        ad.count++;
        if (d.reasoning) ad.reasonings.push(d.reasoning);
      }
    }

    // 构建结果
    const result: Record<string, DebateResult['consensus'] & {
      leverage?: number;
      positionPct?: number;
      stopLoss?: number;
      takeProfit?: number;
    }> = {};

    // 对所有 symbols 构建共识（包括投票中出现但不在 symbols 列表的币种）
    const allSymbols = new Set([...symbols, ...Object.keys(symbolActions)]);

    for (const symbol of allSymbols) {
      const actions = symbolActions[symbol];
      if (!actions) {
        // 该 symbol 无投票 → hold
        result[symbol] = {
          direction: 'hold', action: 'hold', confidence: 0, score: 0,
          reasoning: '投票阶段未收到该币种的有效投票',
        };
        continue;
      }

      // 找 score 最高的 action
      let winningAction = '';
      let maxScore = 0;
      for (const [action, ad] of Object.entries(actions)) {
        if (ad.score > maxScore) {
          maxScore = ad.score;
          winningAction = action;
        }
      }

      if (!winningAction) {
        result[symbol] = {
          direction: 'hold', action: 'hold', confidence: 0, score: 0,
          reasoning: '无有效投票动作',
        };
        continue;
      }

      const ad = actions[winningAction];
      if (ad.count === 0) continue;

      // 算术平均
      const avgConf = Math.round(ad.totalConf / ad.count);
      let avgLeverage = Math.round(ad.totalLeverage / ad.count);
      let avgPosPct = ad.totalPosPct / ad.count;
      let avgSLPct = ad.totalSLPct / ad.count;
      let avgTPPct = ad.totalTPPct / ad.count;

      // 应用限制 (对齐 NoFx)
      if (avgLeverage < 1) avgLeverage = 5;
      if (avgLeverage > 20) avgLeverage = 20;
      if (avgPosPct < 0.1) avgPosPct = 0.2;
      if (avgPosPct > 1.0) avgPosPct = 1.0;
      if (avgSLPct <= 0 && (winningAction === 'open_long' || winningAction === 'open_short')) {
        avgSLPct = 0.03; // 默认 3%
      }
      if (avgTPPct <= 0 && (winningAction === 'open_long' || winningAction === 'open_short')) {
        avgTPPct = 0.06; // 默认 6%
      }

      const direction = this.extractDirectionFromAction(winningAction);
      const directionSimple = direction === 'LONG' ? 'buy' : direction === 'SHORT' ? 'sell' : 'hold';

      this.logger.log(
        `投票共识 ${symbol}: ${winningAction} (score=${maxScore.toFixed(2)}, conf=${avgConf}%, lev=${avgLeverage}x)`,
      );

      result[symbol] = {
        direction: directionSimple,
        action: winningAction,
        confidence: avgConf,
        score: ad.count,
        reasoning: ad.reasonings.join('; ').slice(0, 500),
        leverage: avgLeverage,
        positionPct: avgPosPct,
        stopLoss: avgSLPct,
        takeProfit: avgTPPct,
      };
    }

    return result;
  }

  /**
   * 验证 action 是否有效
   */
  private isValidVotingAction(action: string): boolean {
    return ['open_long', 'open_short', 'close_long', 'close_short', 'hold', 'wait'].includes(action);
  }

  /**
   * 计算共识 (6-Action 投票版本，作为 Judge 失败时的兜底)
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
