import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { MarketDataService } from './services/market-data.service';
import { IndicatorsService, OHLCV } from './services/indicators.service';
import { DebateService, MarketContext, DebateResult, DebateConfig } from './services/debate.service';
import { SafetyService, SafetyCheckResult } from './services/safety.service';
import { TradeHistoryService } from './services/trade-history.service';
import { AiMemoryService } from './services/memory.service';
import { QuickAnalysisService } from './services/quick-analysis.service';
import { EvolutionService } from './services/evolution.service';
import { UserApiKeys } from './services/llm.service';
import { TriggerAnalysisDto } from './dto/trigger-analysis.dto';
import { UpdateAiConfigDto } from './dto/ai-config.dto';
import { toFuturesSymbol } from '../../common/utils/symbol.util';

/**
 * AI 交易服务 - 主编排器
 *
 * 完整流程:
 * 1. 获取市场数据 (MarketDataService)
 * 2. 计算技术指标 (IndicatorsService)
 * 3. 运行 5 角色 3 轮辩论 (DebateService)
 * 4. 6 层安全检查 (SafetyService)
 * 5. 创建信号 → 注入 BullMQ trade 队列 → 复用 TradeProcessor 执行
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private marketData: MarketDataService,
    private indicators: IndicatorsService,
    private debate: DebateService,
    private safety: SafetyService,
    private tradeHistory: TradeHistoryService,
    private memory: AiMemoryService,
    private quickAnalysis: QuickAnalysisService,
    private evolution: EvolutionService,
    @InjectQueue('trade-ai') private tradeAiQueue: Queue,
  ) {}

  // ==================== 触发分析 ====================

  /**
   * 触发一次 AI 分析
   */
  async triggerAnalysis(userId: string, dto: TriggerAnalysisDto) {
    const symbol = toFuturesSymbol(dto.symbol);
    const timeframe = dto.timeframe || '4h';

    this.logger.log(`触发 AI 分析: ${symbol} ${timeframe} (用户: ${userId})`);

    // 1. 检查用户是否有 AI 配置
    const config = await this.getOrCreateConfig(userId);
    if (!config.isEnabled) {
      this.logger.warn(`用户 ${userId} 的 AI 交易未启用`);
      return { error: 'AI 交易未启用，请先在设置中开启' };
    }

    // 2. 检查月度预算
    if (
      config.currentSpend &&
      config.monthlyBudget &&
      Number(config.currentSpend) >= Number(config.monthlyBudget)
    ) {
      this.logger.warn(`用户 ${userId} 已超出月度 LLM 预算`);
      return { error: '已超出月度 LLM 调用预算' };
    }

    // v6: 模式路由 — quick 模式走快速分析，expert 模式走辩论
    const mode = config.mode || 'expert';
    if (mode === 'quick') {
      return this.triggerQuickAnalysis(userId, symbol, timeframe, config, dto);
    }

    try {
      // 3. 获取市场数据
      const rawOhlcv = await this.marketData.fetchOHLCV(symbol, timeframe, 100);
      const currentPrice = await this.marketData.fetchCurrentPrice(symbol);

      // 转换为 OHLCV 格式
      const ohlcv: OHLCV[] = rawOhlcv.map((d) => ({
        timestamp: d[0],
        open: d[1],
        high: d[2],
        low: d[3],
        close: d[4],
        volume: d[5],
      }));

      // 4. 计算技术指标
      const indicatorsResult = this.indicators.calculateAll(ohlcv);

      // 计算 24h 变动
      const priceChange24h =
        ohlcv.length >= 2
          ? ((currentPrice - ohlcv[ohlcv.length - 24]?.close || currentPrice) /
              (ohlcv[ohlcv.length - 24]?.close || currentPrice)) *
            100
          : 0;

      // 5. 构建市场上下文
      const marketContext: MarketContext = {
        symbol,
        currentPrice,
        timeframe,
        indicators: indicatorsResult,
        priceChange24h,
      };

      // 6. 提取用户 API Keys
      const apiKeys: UserApiKeys =
        config.apiKeys && typeof config.apiKeys === 'object'
          ? (config.apiKeys as UserApiKeys)
          : {};

      if (!apiKeys.deepseek && !apiKeys.openai && !apiKeys.openrouter) {
        return { error: '请先在 AI 配置页面填写至少一个 LLM API Key' };
      }

      // 7. 智能分配模型 — P2: 优先使用用户 per-role 配置，fallback 到自动分配
      const userRoleModels =
        config.roleModels && typeof config.roleModels === 'object'
          ? (config.roleModels as Record<string, string>)
          : {};

      // 默认可用模型（基于用户有哪些 API Key）
      const availableModel = apiKeys.deepseek
        ? 'deepseek-chat'
        : apiKeys.openai
          ? 'gpt-4o-mini'
          : 'claude-3-5-haiku-20241022';

      const roleModels: Record<string, string> = {
        bull: userRoleModels.bull || availableModel,
        bear: userRoleModels.bear || availableModel,
        analyst: userRoleModels.analyst || availableModel,
        contrarian: userRoleModels.contrarian || availableModel,
        risk_manager: userRoleModels.risk_manager || availableModel,
      };

      // 多 Key 时分散使用不同模型（仅在用户未手动配置时生效）
      if (!Object.keys(userRoleModels).length) {
        if (apiKeys.deepseek && apiKeys.openai) {
          roleModels.bear = 'gpt-4o-mini';
          roleModels.contrarian = 'gpt-4o-mini';
        }
        if (apiKeys.openrouter) {
          roleModels.analyst = 'claude-3-5-haiku-20241022';
        }
      }

      // P3: 获取交易历史用于 prompt 注入
      const tradeHistoryPrompt = await this.tradeHistory.formatTradeHistoryForPrompt(userId);

      const debateConfig: DebateConfig = {
        models: roleModels,
        rolePrompts:
          config.rolePrompts && typeof config.rolePrompts === 'object'
            ? (config.rolePrompts as Record<string, string>)
            : undefined,
        apiKeys,
        maxRounds: config.maxDebateRounds || 5,
        tradeHistoryPrompt: tradeHistoryPrompt || undefined,
      };

      // 6.5 BM25 记忆检索 — 查找相似历史场景
      try {
        const sceneText = this.memory.buildSceneText({
          symbol,
          timeframe,
          rsi: indicatorsResult.rsi,
          macdTrend: indicatorsResult.macd?.histogram
            ? (indicatorsResult.macd.histogram > 0 ? 'bullish' : 'bearish')
            : undefined,
          atr: indicatorsResult.atr,
          fundingRate: (marketContext as any).fundingRate,
        });
        const memories = await this.memory.retrieveSimilar(sceneText, userId, 5);
        if (memories.length > 0) {
          debateConfig.memoryPrompt = this.memory.formatForPrompt(memories);
          this.logger.log(`BM25 检索到 ${memories.length} 条相似历史记忆`);
        }
      } catch (e) {
        this.logger.warn(`BM25 记忆检索失败: ${e.message}`);
      }

      const debateResult = await this.debate.runDebate(
        marketContext,
        debateConfig,
      );

      // 7. 创建分析记录
      const analysis = await this.prisma.aiAnalysis.create({
        data: {
          userId,
          subscriptionId: dto.subscriptionId || null,
          symbol,
          timeframe,
          direction: debateResult.consensus.direction,
          confidence: new Decimal(debateResult.consensus.confidence),
          consensusScore: debateResult.consensus.score,
          reasoning: debateResult.consensus.reasoning,
          executionCost: new Decimal(debateResult.totalCost),
          indicators: indicatorsResult as any,
          status: 'pending',
          mode: 'expert',
        },
      });

      // 8. 保存辩论记录
      for (const entry of debateResult.entries) {
        await this.prisma.aiDebateEntry.create({
          data: {
            analysisId: analysis.id,
            role: entry.role,
            model: entry.model,
            round: entry.round,
            direction: entry.direction,
            confidence: new Decimal(entry.confidence),
            arguments: entry.arguments,
            chainOfThought: entry.chainOfThought || null,
            tokenUsage: entry.tokenUsage,
            latencyMs: entry.latencyMs,
            cost: new Decimal(entry.cost),
          },
        });
      }

      // 9. 更新用户的 LLM 花费
      await this.prisma.aiConfig.update({
        where: { userId },
        data: {
          currentSpend: {
            increment: debateResult.totalCost,
          },
        },
      });

      // 10. 安全检查（传入 action 用于平仓豁免）
      const safetyResult = await this.safety.checkAll({
        userId,
        symbol,
        direction: debateResult.consensus.direction,
        action: debateResult.consensus.action,
        confidence: debateResult.consensus.confidence,
        consensusScore: debateResult.consensus.score,
        indicators: indicatorsResult,
        mode: 'expert',
      });

      if (!safetyResult.passed) {
        // 安全检查未通过，记录但不执行
        await this.prisma.aiAnalysis.update({
          where: { id: analysis.id },
          data: {
            status: 'blocked',
            blockedBy: safetyResult.blockedBy,
          },
        });

        this.logger.warn(
          `分析 ${analysis.id} 被安全检查阻止: ${safetyResult.blockedBy} - ${safetyResult.blockedReason}`,
        );

        return {
          analysisId: analysis.id,
          direction: debateResult.consensus.direction,
          confidence: debateResult.consensus.confidence,
          status: 'blocked',
          blockedBy: safetyResult.blockedBy,
          blockedReason: safetyResult.blockedReason,
          safetyChecks: safetyResult.checks,
          debateSummary: this.formatDebateSummary(debateResult),
          cost: debateResult.totalCost,
        };
      }

      // 11. 如果 action 是 hold/wait，不需要执行交易
      const consensusAction = debateResult.consensus.action || debateResult.consensus.direction;
      if (consensusAction === 'hold' || consensusAction === 'wait' || debateResult.consensus.direction === 'hold') {
        await this.prisma.aiAnalysis.update({
          where: { id: analysis.id },
          data: { status: 'hold' },
        });

        return {
          analysisId: analysis.id,
          direction: debateResult.consensus.direction,
          action: consensusAction,
          confidence: debateResult.consensus.confidence,
          status: 'hold',
          safetyChecks: safetyResult.checks,
          debateSummary: this.formatDebateSummary(debateResult),
          cost: debateResult.totalCost,
        };
      }

      // 12. 注入信号到交易队列 - 使用具体 action
      await this.injectTradeSignal(
        analysis.id,
        userId,
        dto.subscriptionId || '',
        symbol,
        consensusAction,
        currentPrice,
      );

      this.logger.log(
        `AI 分析完成: ${analysis.id} → ${consensusAction} (置信度: ${debateResult.consensus.confidence}%)`,
      );

      return {
        analysisId: analysis.id,
        direction: debateResult.consensus.direction,
        action: consensusAction,
        confidence: debateResult.consensus.confidence,
        consensusScore: debateResult.consensus.score,
        status: 'executed',
        safetyChecks: safetyResult.checks,
        debateSummary: this.formatDebateSummary(debateResult),
        cost: debateResult.totalCost,
      };
    } catch (error) {
      this.logger.error(`AI 分析失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ==================== 快速模式分析 (v6) ====================

  /**
   * 快速模式: 单次 LLM 调用，无多角色辩论
   */
  private async triggerQuickAnalysis(
    userId: string,
    symbol: string,
    timeframe: string,
    config: any,
    dto: TriggerAnalysisDto,
  ) {
    this.logger.log(`[Quick Mode] 分析: ${symbol} ${timeframe} (用户: ${userId})`);

    try {
      const apiKeys: UserApiKeys =
        config.apiKeys && typeof config.apiKeys === 'object'
          ? (config.apiKeys as UserApiKeys)
          : {};

      if (!apiKeys.deepseek && !apiKeys.openai && !apiKeys.openrouter) {
        return { error: '请先在 AI 配置页面填写至少一个 LLM API Key' };
      }

      // 调用 QuickAnalysisService
      const result = await this.quickAnalysis.analyze({
        userId,
        symbol,
        timeframe,
        config,
      });

      // 创建分析记录
      const analysis = await this.prisma.aiAnalysis.create({
        data: {
          userId,
          subscriptionId: dto.subscriptionId || null,
          symbol,
          timeframe,
          direction: result.direction,
          confidence: new Decimal(result.confidence),
          consensusScore: result.confidence >= 70 ? 4 : result.confidence >= 50 ? 3 : 2,
          reasoning: result.reasoning,
          executionCost: new Decimal(result.cost || 0),
          indicators: result.indicators as any,
          status: 'pending',
          mode: 'quick',
        },
      });

      // 更新 LLM 花费
      if (result.cost > 0) {
        await this.prisma.aiConfig.update({
          where: { userId },
          data: { currentSpend: { increment: result.cost } },
        });
      }

      // 安全检查（跳过 L2 共识检查）
      const safetyResult = await this.safety.checkAll({
        userId,
        symbol,
        direction: result.direction,
        action: result.action,
        confidence: result.confidence,
        consensusScore: result.confidence >= 70 ? 4 : 3, // quick 模式模拟共识分
        indicators: result.indicators,
        mode: 'quick',
      });

      if (!safetyResult.passed) {
        await this.prisma.aiAnalysis.update({
          where: { id: analysis.id },
          data: { status: 'blocked', blockedBy: safetyResult.blockedBy },
        });

        return {
          analysisId: analysis.id,
          direction: result.direction,
          action: result.action,
          confidence: result.confidence,
          status: 'blocked',
          blockedBy: safetyResult.blockedBy,
          blockedReason: safetyResult.blockedReason,
          safetyChecks: safetyResult.checks,
          mode: 'quick',
          cost: result.cost,
        };
      }

      // hold/wait 不执行交易
      if (result.action === 'hold' || result.action === 'wait') {
        await this.prisma.aiAnalysis.update({
          where: { id: analysis.id },
          data: { status: 'hold' },
        });

        return {
          analysisId: analysis.id,
          direction: result.direction,
          action: result.action,
          confidence: result.confidence,
          status: 'hold',
          safetyChecks: safetyResult.checks,
          mode: 'quick',
          cost: result.cost,
          reasoning: result.reasoning,
        };
      }

      // 注入交易信号
      await this.injectTradeSignal(
        analysis.id,
        userId,
        dto.subscriptionId || '',
        symbol,
        result.action,
        result.entryPrice || 0,
      );

      this.logger.log(
        `[Quick Mode] 完成: ${analysis.id} → ${result.action} (信心: ${result.confidence}%)`,
      );

      return {
        analysisId: analysis.id,
        direction: result.direction,
        action: result.action,
        confidence: result.confidence,
        status: 'executed',
        safetyChecks: safetyResult.checks,
        mode: 'quick',
        cost: result.cost,
        reasoning: result.reasoning,
      };
    } catch (error) {
      this.logger.error(`[Quick Mode] 分析失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  // ==================== 注入交易信号 ====================

  /**
   * 将 AI 分析结果注入到独立的 AI 交易队列
   *
   * 支持 6-action:
   * - open_long → entry_long (buy)
   * - open_short → entry_short (sell)
   * - close_long → close_long (sell to close)
   * - close_short → close_short (buy to close)
   */
  private async injectTradeSignal(
    analysisId: string,
    userId: string,
    subscriptionId: string,
    symbol: string,
    consensusAction: string,
    price: number,
  ) {
    // 6-action → trade action 映射
    let action: string;
    let side: string;

    switch (consensusAction) {
      case 'open_long':
      case 'buy':
        action = 'entry_long';
        side = 'buy';
        break;
      case 'open_short':
      case 'sell':
        action = 'entry_short';
        side = 'sell';
        break;
      case 'close_long':
        action = 'close_long';
        side = 'sell'; // 平多 = 卖出
        break;
      case 'close_short':
        action = 'close_short';
        side = 'buy'; // 平空 = 买入
        break;
      default:
        this.logger.warn(`未知的 AI 动作: ${consensusAction}，跳过交易`);
        return;
    }

    // 对于平仓动作，检查是否有对应持仓
    if (action === 'close_long' || action === 'close_short') {
      const positionSide = action === 'close_long' ? 'long' : 'short';
      const existingPosition = await this.prisma.position.findFirst({
        where: {
          userId,
          symbol,
          side: positionSide,
          status: 'open',
          source: 'ai_analysis',
        },
      });

      if (!existingPosition) {
        this.logger.log(`[AI交易] 无 ${positionSide} 持仓可平，跳过 ${action} ${symbol}`);
        return;
      }
    }

    // 1. 获取用户 AI 配置
    const config = await this.getOrCreateConfig(userId);
    const maxLeverage = config.maxLeverage || 3;

    // v6: 优先使用 exchangeApiKeyId，fallback 到最新的 active API Key
    let userApiKey: any = null;
    if (config.exchangeApiKeyId) {
      userApiKey = await this.prisma.apiKey.findFirst({
        where: { id: config.exchangeApiKeyId, userId, isActive: true },
      });
    }
    if (!userApiKey) {
      userApiKey = await this.prisma.apiKey.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!userApiKey) {
      this.logger.warn(
        `用户 ${userId} 没有可用的交易所 API Key，跳过交易执行`,
      );
      return;
    }

    // 2. 计算下单金额: 优先使用 amountPerTrade，fallback 到 maxPositionSize
    const configAmount = Number(config.amountPerTrade) || Number(config.maxPositionSize) || 50;
    const amountPerTrade = configAmount > 0 ? configAmount.toString() : '50';

    // 4. 决策验证：杠杆自动夹紧到 [1, maxLeverage]
    const clampedLeverage = Math.min(Math.max(1, maxLeverage), 125);

    // 5. 创建信号记录（不依赖策略订阅）
    let signalId: string | null = null;
    try {
      // 查找订阅的 strategyId（如果有）
      if (subscriptionId) {
        const subscription =
          await this.prisma.strategySubscription.findUnique({
            where: { id: subscriptionId },
          });
        if (subscription) {
          const signal = await this.prisma.signal.create({
            data: {
              strategyId: subscription.strategyId,
              symbol,
              side,
              price: new Decimal(price),
            },
          });
          signalId = signal.id;

          // 关联 AI 分析与信号
          await this.prisma.aiAnalysis.update({
            where: { id: analysisId },
            data: { signalId: signal.id },
          });
        }
      }
    } catch (e) {
      this.logger.warn(`创建信号记录失败: ${e.message}，继续执行交易`);
    }

    // 6. 注入到独立 AI 交易队列
    await this.tradeAiQueue.add(
      'execute',
      {
        analysisId,
        signalId: signalId || analysisId, // fallback 用 analysisId
        userId,
        apiKeyId: userApiKey.id,
        exchange: userApiKey.exchange,
        symbol,
        side,
        action,
        price: price.toString(),
        amountPerTrade,
        leverage: clampedLeverage,
        source: 'ai_analysis',
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        priority: 1, // 高优先级
      },
    );

    this.logger.log(
      `[AI交易] 信号已注入 trade-ai 队列: ${action} ${symbol} @ ${price}, 金额 ${amountPerTrade} USDT, 杠杆 ${clampedLeverage}x`,
    );
  }

  // ==================== 查询接口 ====================

  /**
   * 获取分析列表
   */
  async getAnalyses(
    userId: string,
    page: number = 1,
    limit: number = 20,
    symbol?: string,
    status?: string,
  ) {
    const where: any = { userId };
    if (symbol) where.symbol = symbol;
    if (status) where.status = status;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.aiAnalysis.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          symbol: true,
          timeframe: true,
          direction: true,
          confidence: true,
          consensusScore: true,
          status: true,
          blockedBy: true,
          executionCost: true,
          createdAt: true,
          executedAt: true,
        },
      }),
      this.prisma.aiAnalysis.count({ where }),
    ]);

    return {
      items: items.map((a) => ({
        ...a,
        confidence: Number(a.confidence),
        executionCost: a.executionCost ? Number(a.executionCost) : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取分析详情（含辩论记录）
   */
  async getAnalysisDetail(userId: string, analysisId: string) {
    const analysis = await this.prisma.aiAnalysis.findFirst({
      where: { id: analysisId, userId },
      include: {
        debateEntries: {
          orderBy: [{ round: 'asc' }, { role: 'asc' }],
        },
      },
    });

    if (!analysis) {
      throw new NotFoundException('分析记录不存在');
    }

    return {
      id: analysis.id,
      symbol: analysis.symbol,
      timeframe: analysis.timeframe,
      direction: analysis.direction,
      confidence: Number(analysis.confidence),
      consensusScore: analysis.consensusScore,
      reasoning: analysis.reasoning,
      status: analysis.status,
      blockedBy: analysis.blockedBy,
      executionCost: analysis.executionCost
        ? Number(analysis.executionCost)
        : null,
      indicators: analysis.indicators,
      createdAt: analysis.createdAt,
      executedAt: analysis.executedAt,
      debateEntries: analysis.debateEntries.map((e) => ({
        id: e.id,
        role: e.role,
        model: e.model,
        round: e.round,
        direction: e.direction,
        confidence: Number(e.confidence),
        arguments: e.arguments,
        tokenUsage: e.tokenUsage,
        latencyMs: e.latencyMs,
        cost: e.cost ? Number(e.cost) : null,
      })),
    };
  }

  // ==================== 配置管理 ====================

  /**
   * 获取或创建用户 AI 配置
   */
  async getOrCreateConfig(userId: string) {
    let config = await this.prisma.aiConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      config = await this.prisma.aiConfig.create({
        data: { userId },
      });
      this.logger.log(`为用户 ${userId} 创建默认 AI 配置`);
    }

    return config;
  }

  /**
   * 获取用户 AI 配置
   */
  async getConfig(userId: string) {
    const config = await this.getOrCreateConfig(userId);

    // 掩码 API Keys（前端只显示最后 4 位）
    const rawApiKeys =
      config.apiKeys && typeof config.apiKeys === 'object'
        ? (config.apiKeys as Record<string, string>)
        : {};

    const maskedApiKeys: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawApiKeys)) {
      if (value && value.length > 4) {
        maskedApiKeys[key] = '****' + value.slice(-4);
      } else if (value) {
        maskedApiKeys[key] = '****';
      }
    }

    return {
      isEnabled: config.isEnabled,
      symbols: config.symbols,
      timeframes: config.timeframes,
      models: config.models,
      roleModels: config.roleModels || {},
      maxDebateRounds: config.maxDebateRounds || 5,
      minConfidence: config.minConfidence,
      analysisInterval: config.analysisInterval,
      maxPositionSize: Number(config.maxPositionSize),
      maxLeverage: config.maxLeverage,
      maxDailyTrades: config.maxDailyTrades,
      maxDailyDrawdown: Number(config.maxDailyDrawdown),
      cooldownMinutes: config.cooldownMinutes,
      circuitBreaker: config.circuitBreaker,
      monthlyBudget: Number(config.monthlyBudget),
      currentSpend: Number(config.currentSpend),
      apiKeys: maskedApiKeys,
      // v6 新增字段
      mode: config.mode || 'quick',
      autoEnabled: config.autoEnabled,
      autoStatus: config.autoStatus,
      autoStatusReason: config.autoStatusReason,
      lastAutoRunAt: config.lastAutoRunAt,
      evolutionTier: config.evolutionTier,
      rollingSharpe: config.rollingSharpe ? Number(config.rollingSharpe) : null,
      amountPerTrade: Number(config.amountPerTrade),
      exchangeApiKeyId: config.exchangeApiKeyId,
    };
  }

  /**
   * 更新用户 AI 配置
   */
  async updateConfig(userId: string, dto: UpdateAiConfigDto) {
    await this.getOrCreateConfig(userId);

    const data: any = {};
    if (dto.isEnabled !== undefined) data.isEnabled = dto.isEnabled;
    if (dto.symbols) data.symbols = dto.symbols;
    if (dto.timeframes) data.timeframes = dto.timeframes;
    if (dto.models) data.models = dto.models;
    if (dto.rolePrompts) data.rolePrompts = dto.rolePrompts;
    if (dto.apiKeys) {
      // 合并 API Keys（只更新有值的字段，保留已有的其他 key）
      const existingConfig = await this.prisma.aiConfig.findUnique({
        where: { userId },
      });
      const existingApiKeys =
        existingConfig?.apiKeys && typeof existingConfig.apiKeys === 'object'
          ? (existingConfig.apiKeys as Record<string, string>)
          : {};
      data.apiKeys = { ...existingApiKeys, ...dto.apiKeys };
    }
    if (dto.minConfidence !== undefined)
      data.minConfidence = dto.minConfidence;
    if (dto.analysisInterval !== undefined)
      data.analysisInterval = dto.analysisInterval;
    if (dto.maxPositionSize !== undefined)
      data.maxPositionSize = dto.maxPositionSize;
    if (dto.maxLeverage !== undefined) data.maxLeverage = dto.maxLeverage;
    if (dto.maxDailyTrades !== undefined)
      data.maxDailyTrades = dto.maxDailyTrades;
    if (dto.maxDailyDrawdown !== undefined)
      data.maxDailyDrawdown = dto.maxDailyDrawdown;
    if (dto.cooldownMinutes !== undefined)
      data.cooldownMinutes = dto.cooldownMinutes;
    if (dto.circuitBreaker !== undefined)
      data.circuitBreaker = dto.circuitBreaker;
    if (dto.maxDebateRounds !== undefined)
      data.maxDebateRounds = dto.maxDebateRounds;
    if (dto.roleModels !== undefined) data.roleModels = dto.roleModels;
    if (dto.monthlyBudget !== undefined)
      data.monthlyBudget = dto.monthlyBudget;
    // v6 新增字段
    if (dto.mode !== undefined) data.mode = dto.mode;
    if (dto.amountPerTrade !== undefined) data.amountPerTrade = dto.amountPerTrade;
    if (dto.exchangeApiKeyId !== undefined) data.exchangeApiKeyId = dto.exchangeApiKeyId;

    const updated = await this.prisma.aiConfig.update({
      where: { userId },
      data,
    });

    this.logger.log(`用户 ${userId} 更新了 AI 配置`);

    return this.getConfig(userId);
  }

  // ==================== 统计 ====================

  /**
   * 获取 AI 交易统计
   */
  async getStats(userId: string) {
    const [totalAnalyses, executedCount, blockedCount, holdCount] =
      await Promise.all([
        this.prisma.aiAnalysis.count({ where: { userId } }),
        this.prisma.aiAnalysis.count({
          where: { userId, status: 'executed' },
        }),
        this.prisma.aiAnalysis.count({
          where: { userId, status: 'blocked' },
        }),
        this.prisma.aiAnalysis.count({
          where: { userId, status: 'hold' },
        }),
      ]);

    const config = await this.getOrCreateConfig(userId);

    return {
      totalAnalyses,
      executedCount,
      blockedCount,
      holdCount,
      monthlyBudget: Number(config.monthlyBudget),
      currentSpend: Number(config.currentSpend),
      budgetRemaining: Number(config.monthlyBudget) - Number(config.currentSpend),
    };
  }

  // ==================== 工具方法 ====================

  /**
   * 格式化辩论摘要
   */
  private formatDebateSummary(result: DebateResult) {
    // 动态获取最后一轮
    const lastRound = Math.max(...result.entries.map((e) => e.round), 1);
    const lastRoundEntries = result.entries.filter((e) => e.round === lastRound);

    return {
      finalVotes: lastRoundEntries.map((e) => ({
        role: e.role,
        model: e.model,
        direction: e.direction,
        confidence: e.confidence,
      })),
      consensus: result.consensus,
      totalRounds: lastRound,
      totalEntries: result.entries.length,
      totalCost: result.totalCost,
      totalTokens: result.totalTokens,
    };
  }
}
