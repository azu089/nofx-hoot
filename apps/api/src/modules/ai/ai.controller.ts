import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
// 共享服务
import { AiExecutionService } from './services/ai-execution.service';
import { AiPerformanceService } from './services/ai-performance.service';
import { MarketDataService } from './services/market-data.service';
import { IndicatorsService } from './services/indicators.service';
import { SafetyService } from './services/safety.service';
import { LLMService } from './services/llm.service';
// 产品 A
import { ResearchPipelineService, ResearchConfig } from './services/research/research-pipeline.service';
import { ResearchCycleService } from './services/research/research-cycle.service';
// 产品 B
import { StrategyEngineService } from './services/trading/strategy-engine.service';
import { GridTradingService, GridConfig } from './services/trading/grid-trading.service';
import { AutoTraderService } from './services/trading/auto-trader.service';
import { PromptBuilderService } from './services/trading/prompt-builder.service';
// DTO
import { StartResearchDto, ExecuteResearchDto } from './dto/research.dto';
import { CreateStrategyDto, UpdateStrategyDto } from './dto/strategy.dto';
import { encrypt, decrypt } from '../../common/utils/crypto.util';

/**
 * AI 模块控制器
 *
 * 包含产品 A（AI 研究团队）和产品 B（AI 自动交易）的所有端点
 *
 * Phase 8.0-A 基础 + 共享端点:
 *   GET  /ai/health         — 模块健康检查
 *   GET  /ai/config         — 获取 AI 配置
 *   PUT  /ai/config         — 更新 AI 配置
 *   GET  /ai/performance    — 性能统计（模型排名+角色准确度+总览）
 *   GET  /ai/budget         — LLM 预算使用情况
 *
 * Phase 8.0-B 产品 A 端点（待实现）:
 *   POST /ai/research/start
 *   GET  /ai/research/:id/status
 *   GET  /ai/research/:id/report
 *   POST /ai/research/:id/execute
 *   GET  /ai/research/history
 *
 * Phase 8.0-C 产品 B 端点:
 *   POST   /ai/strategy              — 创建策略
 *   GET    /ai/strategy              — 策略列表
 *   GET    /ai/strategy/:id          — 策略详情
 *   PUT    /ai/strategy/:id          — 更新策略
 *   DELETE /ai/strategy/:id          — 删除策略
 *   POST   /ai/strategy/:id/start   — 启动策略
 *   POST   /ai/strategy/:id/stop    — 停止策略
 *   POST   /ai/strategy/:id/pause   — 暂停策略
 *   PUT    /ai/strategy/:id/config  — 热更新配置
 *   GET    /ai/strategy/:id/logs    — 决策日志
 *   GET    /ai/strategy/competition — 竞赛排行
 */
@Controller('ai')
export class AiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly researchPipeline: ResearchPipelineService,
    private readonly aiExecution: AiExecutionService,
    private readonly strategyEngine: StrategyEngineService,
    private readonly gridTrading: GridTradingService,
    private readonly aiPerformance: AiPerformanceService,
    private readonly marketData: MarketDataService,
    private readonly indicators: IndicatorsService,
    private readonly safety: SafetyService,
    private readonly llmService: LLMService,
    private readonly autoTrader: AutoTraderService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly researchCycleService: ResearchCycleService,
  ) {}

  // ========================= 基础端点 =========================

  /**
   * AI 模块健康检查
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async health() {
    return {
      status: 'ok',
      module: 'ai',
      version: '8.0.0',
      products: {
        research: 'Phase 8.0-B (pending)',
        autoTrading: 'Phase 8.0-C (pending)',
      },
    };
  }

  /**
   * 诊断端点 — 测试市场数据 + 指标 + CCXT 连接
   * GET /ai/diagnose?symbol=BTC/USDT
   */
  @Get('diagnose')
  async diagnose(@Query('symbol') symbol: string = 'BTC/USDT', @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    const results: Record<string, any> = { symbol, tests: {} };

    // 1. 市场数据（OHLCV）
    try {
      const ohlcv = await this.marketData.fetchOHLCV(symbol, '4h', 20);
      results.tests.ohlcv = {
        status: 'ok',
        bars: ohlcv.length,
        latest: ohlcv.length > 0 ? {
          time: new Date(ohlcv[ohlcv.length - 1][0]).toISOString(),
          open: ohlcv[ohlcv.length - 1][1],
          high: ohlcv[ohlcv.length - 1][2],
          low: ohlcv[ohlcv.length - 1][3],
          close: ohlcv[ohlcv.length - 1][4],
          volume: ohlcv[ohlcv.length - 1][5],
        } : null,
      };

      // 2. 技术指标
      try {
        const ohlcvObjects = ohlcv.map((bar: any[]) => ({
          timestamp: bar[0], open: bar[1], high: bar[2], low: bar[3], close: bar[4], volume: bar[5],
        }));
        const ind = this.indicators.calculateAll(ohlcvObjects);
        results.tests.indicators = {
          status: 'ok',
          rsi: ind.rsi,
          macd: ind.macd ? { histogram: ind.macd.histogram, signal: ind.macd.signal } : null,
          ema: ind.ema,
          atr: ind.atr,
          bollingerBands: ind.bollingerBands ? { upper: ind.bollingerBands.upper, lower: ind.bollingerBands.lower } : null,
        };
      } catch (e: any) {
        results.tests.indicators = { status: 'error', message: e.message };
      }
    } catch (e: any) {
      results.tests.ohlcv = { status: 'error', message: e.message };
    }

    // 3. 当前价格
    try {
      const price = await this.marketData.fetchCurrentPrice(symbol);
      results.tests.price = { status: 'ok', price };
    } catch (e: any) {
      results.tests.price = { status: 'error', message: e.message };
    }

    // 4. 资金费率
    try {
      const fr = await this.marketData.fetchFundingRate(symbol);
      results.tests.fundingRate = { status: 'ok', ...fr };
    } catch (e: any) {
      results.tests.fundingRate = { status: 'error', message: e.message };
    }

    // 5. CCXT 交易所连接（如果配置了 API Key）
    if (userId) {
      try {
        const config = await this.prisma.aiConfig.findUnique({ where: { userId } });
        if (config?.exchangeApiKeyId) {
          const exchange = await (this.aiExecution as any).createExchangeInstance(userId, config.exchangeApiKeyId);
          const balance = await exchange.fetchBalance();
          const futuresUSDT = balance.USDT || balance.total?.USDT;
          results.tests.exchangeConnection = {
            status: 'ok',
            exchange: exchange.id,
            futuresBalance: typeof futuresUSDT === 'object' ? futuresUSDT : { total: futuresUSDT },
          };

          // 6. 获取当前持仓
          try {
            const positions = await exchange.fetchPositions([symbol.replace('/', '')]);
            const openPositions = positions.filter((p: any) => p.contracts > 0 || Math.abs(parseFloat(p.info?.positionAmt || '0')) > 0);
            results.tests.positions = {
              status: 'ok',
              total: positions.length,
              open: openPositions.length,
              details: openPositions.map((p: any) => ({
                symbol: p.symbol,
                side: p.side,
                contracts: p.contracts,
                unrealizedPnl: p.unrealizedPnl,
                leverage: p.leverage,
              })),
            };
          } catch (e: any) {
            results.tests.positions = { status: 'error', message: e.message };
          }
        } else {
          results.tests.exchangeConnection = { status: 'skipped', message: '未绑定交易所 API Key' };
        }
      } catch (e: any) {
        results.tests.exchangeConnection = { status: 'error', message: e.message };
      }
    }

    return results;
  }

  /**
   * 直接执行交易测试（开发调试用，跳过 LLM）
   * POST /ai/test-execute
   * Body: { action, symbol, confidence, leverage, positionSizeUSD, stopLoss?, takeProfit? }
   */
  @Post('test-execute')
  @HttpCode(HttpStatus.OK)
  async testExecute(@Body() body: any, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const config = await this.prisma.aiConfig.findUnique({ where: { userId } });
    if (!config?.isEnabled) throw new BadRequestException('请先启用 AI 模块');
    if (!config?.exchangeApiKeyId) throw new BadRequestException('请先绑定交易所 API Key');

    const { action, symbol, confidence, leverage, positionSizeUSD, stopLoss, takeProfit } = body;

    if (!action || !symbol) {
      throw new BadRequestException('必须提供 action 和 symbol');
    }

    const validActions = ['open_long', 'open_short', 'close_long', 'close_short', 'hold', 'wait'];
    if (!validActions.includes(action)) {
      throw new BadRequestException(`action 必须是: ${validActions.join(', ')}`);
    }

    // 安全检查：限制测试仓位（BTC 合约最小 0.001 BTC ≈ $65，需要足够余额）
    const safeSize = Math.min(positionSizeUSD || 12, 100); // 测试最大 $100
    const safeLeverage = Math.min(leverage || 3, 5); // 测试最大 5x

    const decision = {
      symbol,
      action,
      confidence: confidence || 80,
      leverage: safeLeverage,
      positionSizeUSD: safeSize,
      stopLoss: stopLoss || null,
      takeProfit: takeProfit || null,
      reasoning: 'Manual test execution',
    };

    const result = await this.aiExecution.executeDecision(
      userId,
      config.exchangeApiKeyId,
      decision as any,
      'ai_research',
    );

    return { decision, result };
  }

  /**
   * 获取用户 AI 配置
   */
  @Get('config')
  async getConfig(@Request() req: any) {
    const userId = req.user?.sub || req.user?.id;

    const config = await this.prisma.aiConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      return {
        isEnabled: false,
        mode: 'quick',
        models: [],
        symbols: ['BTC/USDT'],
        timeframes: ['4h'],
        autoEnabled: false,
        autoStatus: 'stopped',
        evolutionTier: 2,
      };
    }

    return {
      isEnabled: config.isEnabled,
      mode: config.mode,
      models: config.models,
      symbols: config.symbols,
      timeframes: config.timeframes,
      rolePrompts: config.rolePrompts,
      roleModels: config.roleModels,
      minConfidence: config.minConfidence,
      maxPositionSize: config.maxPositionSize,
      maxLeverage: config.maxLeverage,
      maxPositions: config.maxPositions,
      maxDailyTrades: config.maxDailyTrades,
      maxDailyDrawdown: config.maxDailyDrawdown,
      cooldownMinutes: config.cooldownMinutes,
      monthlyBudget: config.monthlyBudget,
      currentSpend: config.currentSpend,
      amountPerTrade: config.amountPerTrade,
      autoEnabled: config.autoEnabled,
      autoStatus: config.autoStatus,
      autoStatusReason: config.autoStatusReason,
      evolutionTier: config.evolutionTier,
      rollingSharpe: config.rollingSharpe,
      exchangeApiKeyId: config.exchangeApiKeyId,
      // 注意：不返回 apiKeys 明文
      hasApiKeys: config.apiKeys ? Object.keys(config.apiKeys as object).length > 0 : false,
    };
  }

  /**
   * 更新用户 AI 配置
   */
  @Put('config')
  async updateConfig(@Request() req: any, @Body() body: any) {
    const userId = req.user?.sub || req.user?.id;

    // upsert: 如果不存在则创建
    const config = await this.prisma.aiConfig.upsert({
      where: { userId },
      create: {
        userId,
        ...this.sanitizeConfigBody(body),
      },
      update: this.sanitizeConfigBody(body),
    });

    return {
      success: true,
      config: {
        isEnabled: config.isEnabled,
        mode: config.mode,
        autoEnabled: config.autoEnabled,
        autoStatus: config.autoStatus,
      },
    };
  }

  // ========================= 共享: 性能 + 预算 =========================

  /**
   * AI 性能统计
   *
   * GET /ai/performance
   * 返回模型排名、角色准确度、整体统计
   */
  @Get('performance')
  async getPerformance(@Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const summary = await this.aiPerformance.getPerformanceSummary(userId);
    return summary;
  }

  /**
   * LLM 预算使用情况
   *
   * GET /ai/budget
   * 返回月度预算、当前消耗、使用百分比
   */
  @Get('budget')
  async getBudget(@Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const aiConfig = await this.prisma.aiConfig.findUnique({
      where: { userId },
    });

    const monthlyBudget = Number(aiConfig?.monthlyBudget) || 10;
    const currentSpend = Number(aiConfig?.currentSpend) || 0;
    const usagePercent = monthlyBudget > 0 ? (currentSpend / monthlyBudget) * 100 : 0;

    // 获取本月 AI 分析数量
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const db = this.prisma;
    const monthlyAnalyses = await this.prisma.aiAnalysis.count({
      where: { userId, createdAt: { gte: monthStart } },
    });

    // 获取策略消耗（如果有策略日志）
    let strategyLogCount = 0;
    try {
      strategyLogCount = await db.aiStrategyLog.count({
        where: {
          strategy: { userId },
          createdAt: { gte: monthStart },
        },
      });
    } catch {
      // 表可能不存在（未迁移时）
    }

    return {
      monthlyBudget,
      currentSpend: Number(currentSpend.toFixed(6)),
      usagePercent: Number(usagePercent.toFixed(1)),
      remaining: Number((monthlyBudget - currentSpend).toFixed(6)),
      monthlyAnalyses,
      monthlyStrategyCycles: strategyLogCount,
      resetDate: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1).toISOString(),
      status: usagePercent >= 100 ? 'exceeded' : usagePercent >= 80 ? 'warning' : 'normal',
    };
  }

  // ========================= 产品 A: AI 研究团队 =========================

  /**
   * 启动 AI 研究
   *
   * POST /ai/research/start
   * Body: { symbol: 'BTC/USDT', depth: 'standard', autoExecute: false }
   *
   * 返回 sessionId，客户端可用 WebSocket 或轮询获取进度
   */
  @Post('research/start')
  @HttpCode(HttpStatus.ACCEPTED)
  async startResearch(@Request() req: any, @Body() body: StartResearchDto) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    // 并发研究请求限制（最多 3 个同时运行）
    const runningCount = await this.prisma.aiResearchSession.count({
      where: { userId, status: 'running' },
    });
    if (runningCount >= 3) {
      throw new BadRequestException('最多同时运行 3 个研究任务，请等待现有任务完成');
    }

    // 获取用户 AI 配置
    const aiConfig = await this.prisma.aiConfig.findUnique({
      where: { userId },
    });

    if (!aiConfig || !aiConfig.isEnabled) {
      throw new BadRequestException('请先启用 AI 模块并配置 LLM API Keys');
    }

    // 双轨制 Key 解析：先解密用户自备 Key，再回退平台默认
    const apiKeys = this.resolveApiKeys(aiConfig.apiKeys);

    // Free 用户门控：无 BYOK Key 的免费用户不能使用平台 Key
    await this.validateLlmAccess(userId, apiKeys);

    const quickModel = (aiConfig.models as string[])?.[0] || 'deepseek-chat';
    if (!this.llmService.hasAvailableKey(quickModel, apiKeys)) {
      throw new BadRequestException('无可用 LLM API Key：用户未配置且平台未设置默认 Key');
    }

    // ── 循环模式分支 ──
    if (body.cyclingConfig?.enabled) {
      const { rootSessionId } = await this.researchCycleService.startCycling(userId, {
        symbol: body.symbol,
        depth: (body.depth || 'standard') as any,
        intervalMinutes: body.cyclingConfig.intervalMinutes,
        maxCycles: body.cyclingConfig.maxCycles || 0,
        profitTargetPercent: body.cyclingConfig.profitTargetPercent || 0,
        maxLossPercent: body.cyclingConfig.maxLossPercent || 0,
        exchangeApiKeyId: body.exchangeApiKeyId || aiConfig.exchangeApiKeyId || undefined,
        llmApiKeys: apiKeys,
        quickModel: body.quickModel || (aiConfig.models as string[])?.[0] || 'deepseek-chat',
        deepModel: body.deepModel || (aiConfig.models as string[])?.[1] || 'deepseek-chat',
        riskControlConfig: body.riskControlConfig,
      });

      return {
        sessionId: rootSessionId,
        symbol: body.symbol,
        depth: body.depth || 'standard',
        autoExecute: true,
        status: 'running',
        message: '自动循环研究已启动',
      };
    }

    // ── 单次研究模式（原有逻辑） ──
    const sessionId = `rs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 先创建会话记录
    const db = this.prisma;
    await db.aiResearchSession.create({
      data: {
        id: sessionId,
        userId,
        symbol: body.symbol,
        depth: body.depth || 'standard',
        autoExecute: body.autoExecute || false,
        status: 'running',
        stages: [],
      },
    });

    // 构建研究配置（传入 sessionId 避免 pipeline 重复创建）
    const config: ResearchConfig = {
      userId,
      symbol: body.symbol,
      depth: body.depth || 'standard',
      autoExecute: body.autoExecute || false,
      apiKeyId: body.exchangeApiKeyId || aiConfig.exchangeApiKeyId || undefined,
      llmApiKeys: apiKeys,
      quickThinkModel: body.quickModel || (aiConfig.models as string[])?.[0] || 'deepseek-chat',
      deepThinkModel: body.deepModel || (aiConfig.models as string[])?.[1] || 'deepseek-chat',
      sessionId,
      riskControlConfig: body.riskControlConfig,
    };

    // 在后台运行研究（不等待结果）
    this.researchPipeline.runResearch(config).catch((error) => {
      // 错误已在 pipeline 内部处理，这里只是防止未捕获的 Promise 异常
    });

    return {
      sessionId,
      symbol: body.symbol,
      depth: body.depth || 'standard',
      autoExecute: body.autoExecute || false,
      status: 'running',
      message: '研究已启动，请通过 WebSocket 或轮询获取进度',
    };
  }

  /**
   * 查询研究进度
   *
   * GET /ai/research/:id/status
   */
  @Get('research/:id/status')
  async getResearchStatus(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    const db = this.prisma;

    const session = await db.aiResearchSession.findFirst({
      where: { id, userId },
    });

    if (!session) throw new NotFoundException('研究会话不存在');

    const stages = (session.stages as any[]) || [];

    return {
      sessionId: session.id,
      symbol: session.symbol,
      depth: session.depth,
      status: session.status,
      autoExecute: session.autoExecute,
      currentStage: stages.length > 0
        ? stages[stages.length - 1]
        : { stage: 0, name: '等待开始', status: 'pending' },
      stagesCompleted: stages.filter((s: any) => s.status === 'completed').length,
      totalStages: 5,
      totalCost: Number(session.totalCost) || 0,
      errorMessage: session.errorMessage,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      cyclingConfig: session.cyclingConfig,
      campaignStatus: session.campaignStatus,
      cycleNumber: session.cycleNumber,
      rootSessionId: session.rootSessionId,
    };
  }

  /**
   * 研究阶段详情（懒加载）
   *
   * GET /ai/research/:id/stages
   * 返回完整 5 阶段数据，供时间线卡片展开时使用
   */
  @Get('research/:id/stages')
  async getResearchStages(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const session = await this.prisma.aiResearchSession.findFirst({
      where: { id, userId },
      select: { stages: true, finalDecision: true, status: true },
    });
    if (!session) throw new NotFoundException('研究会话不存在');

    return {
      stages: session.stages || [],
      finalDecision: session.finalDecision || null,
      status: session.status,
    };
  }

  /**
   * 获取完整研究报告
   *
   * GET /ai/research/:id/report
   */
  @Get('research/:id/report')
  async getResearchReport(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    const db = this.prisma;

    const session = await db.aiResearchSession.findFirst({
      where: { id, userId },
    });

    if (!session) throw new NotFoundException('研究会话不存在');

    // 查询关联持仓
    let positionSummary: any = null;
    if (session.executedTradeId && session.executedTradeId !== 'executed') {
      const posSelect = {
        id: true, status: true, side: true, symbol: true,
        entryPrice: true, markPrice: true, amount: true, leverage: true, margin: true,
        unrealizedPnl: true, realizedPnl: true, pnl: true,
        closeReason: true, createdAt: true, closedAt: true,
      } as const;

      let position = await db.position.findFirst({
        where: { id: session.executedTradeId, userId },
        select: posSelect,
      });

      if (!position) {
        position = await db.position.findFirst({
          where: { exchangeOrderId: session.executedTradeId, userId },
          select: posSelect,
        });
      }

      if (position) {
        positionSummary = {
          positionId: position.id,
          status: position.status,
          side: position.side,
          entryPrice: Number(position.entryPrice),
          markPrice: position.markPrice ? Number(position.markPrice) : null,
          amount: Number(position.amount),
          leverage: position.leverage,
          margin: Number(position.margin),
          unrealizedPnl: position.unrealizedPnl ? Number(position.unrealizedPnl) : null,
          realizedPnl: position.realizedPnl ? Number(position.realizedPnl) : null,
          closeReason: position.closeReason,
          openedAt: position.createdAt,
          closedAt: position.closedAt,
        };
      }
    }

    return {
      sessionId: session.id,
      symbol: session.symbol,
      depth: session.depth,
      status: session.status,
      stages: session.stages || [],
      finalDecision: session.finalDecision,
      executedTradeId: session.executedTradeId,
      positionSummary,
      totalCost: Number(session.totalCost) || 0,
      errorMessage: session.errorMessage,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      rootSessionId: session.rootSessionId,
      campaignStatus: session.campaignStatus,
      cycleNumber: session.cycleNumber,
    };
  }

  /**
   * 手动执行研究结果的交易
   *
   * POST /ai/research/:id/execute
   * 仅当 autoExecute=false 且研究已完成时可用
   */
  @Post('research/:id/execute')
  @HttpCode(HttpStatus.OK)
  async executeResearch(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    const db = this.prisma;

    const session = await db.aiResearchSession.findFirst({
      where: { id, userId },
    });

    if (!session) throw new NotFoundException('研究会话不存在');
    if (session.status !== 'completed') {
      throw new BadRequestException('研究尚未完成，无法执行');
    }
    if (session.executedTradeId) {
      throw new BadRequestException('该研究结果已执行过交易');
    }

    const decision = session.finalDecision as any;
    if (!decision || decision.action === 'hold' || decision.action === 'wait') {
      throw new BadRequestException('研究结论为 hold/wait，无需执行交易');
    }

    // 获取 AI 配置中的交易所 API Key ID
    const aiConfig = await this.prisma.aiConfig.findUnique({
      where: { userId },
    });

    if (!aiConfig?.exchangeApiKeyId) {
      throw new BadRequestException('请先在 AI 配置中绑定交易所 API Key');
    }

    // 将 positionSizePercent 转为 positionSizeUSD
    // 使用 amountPerTrade 或按百分比计算（实际余额在执行层获取）
    const positionSizeUSD = decision.positionSizePercent && aiConfig.amountPerTrade
      ? Number(aiConfig.amountPerTrade) * (decision.positionSizePercent / 100)
      : undefined;

    // 执行交易
    const result = await this.aiExecution.executeDecision(
      userId,
      aiConfig.exchangeApiKeyId,
      {
        symbol: session.symbol,
        action: decision.action,
        confidence: decision.confidence,
        leverage: decision.leverage,
        positionSizeUSD,
        stopLoss: decision.stopLoss,
        takeProfit: decision.takeProfit,
        reasoning: decision.reasoning,
      },
      'ai_research',
    );

    // 更新会话
    await db.aiResearchSession.update({
      where: { id },
      data: { executedTradeId: result.orderId || result.positionId || 'executed' },
    });

    return {
      success: result.success,
      sessionId: id,
      symbol: session.symbol,
      action: decision.action,
      orderId: result.orderId,
      positionId: result.positionId,
      error: result.error,
    };
  }

  /**
   * 研究历史列表
   *
   * GET /ai/research/history?page=1&limit=10
   */
  @Get('research/history')
  async getResearchHistory(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const userId = req.user?.sub || req.user?.id;
    const db = this.prisma;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * pageSize;

    // 历史列表只显示根会话 + 单次研究（隐藏子会话）
    const where = { userId, rootSessionId: null as string | null };

    const [sessions, total] = await Promise.all([
      db.aiResearchSession.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          symbol: true,
          depth: true,
          status: true,
          autoExecute: true,
          finalDecision: true,
          executedTradeId: true,
          totalCost: true,
          errorMessage: true,
          createdAt: true,
          // 循环字段
          cycleNumber: true,
          campaignStatus: true,
          cyclingConfig: true,
        },
      }),
      db.aiResearchSession.count({ where }),
    ]);

    // 根会话附加子会话数量 + 批量 campaign 统计
    const rootIds = sessions
      .filter((s: any) => s.campaignStatus)
      .map((s: any) => s.id);
    const childCounts = new Map<string, number>();
    const cumulativeCosts = new Map<string, number>();
    const cumulativePnls = new Map<string, number>();

    if (rootIds.length > 0) {
      const counts = await db.aiResearchSession.groupBy({
        by: ['rootSessionId'],
        where: { rootSessionId: { in: rootIds } },
        _count: { id: true },
      });
      for (const c of counts) {
        if (c.rootSessionId) childCounts.set(c.rootSessionId, c._count.id);
      }

      // 聚合子会话的 totalCost
      const costAgg = await db.aiResearchSession.groupBy({
        by: ['rootSessionId'],
        where: { rootSessionId: { in: rootIds } },
        _sum: { totalCost: true },
      });
      for (const c of costAgg) {
        if (c.rootSessionId) {
          cumulativeCosts.set(c.rootSessionId, Number(c._sum.totalCost) || 0);
        }
      }

      // 批量查询已平仓 PnL
      const childTrades = await db.aiResearchSession.findMany({
        where: { rootSessionId: { in: rootIds }, executedTradeId: { not: null } },
        select: { rootSessionId: true, executedTradeId: true },
      });
      const tradeIds = childTrades
        .map((c) => c.executedTradeId)
        .filter((id): id is string => !!id && id !== 'executed');

      if (tradeIds.length > 0) {
        const positions = await db.position.findMany({
          where: { id: { in: tradeIds }, status: 'closed' },
          select: { id: true, realizedPnl: true },
        });
        const pnlMap = new Map(positions.map((p) => [p.id, Number(p.realizedPnl) || 0]));

        for (const ct of childTrades) {
          if (ct.rootSessionId && ct.executedTradeId && pnlMap.has(ct.executedTradeId)) {
            const current = cumulativePnls.get(ct.rootSessionId) || 0;
            cumulativePnls.set(ct.rootSessionId, current + pnlMap.get(ct.executedTradeId)!);
          }
        }
      }
    }

    return {
      data: sessions.map((s: any) => ({
        ...s,
        totalCost: Number(s.totalCost) || 0,
        decision: s.finalDecision
          ? {
              action: (s.finalDecision as any).action,
              confidence: (s.finalDecision as any).confidence,
            }
          : null,
        cycleCount: childCounts.get(s.id) || 0,
        cumulativePnl: cumulativePnls.get(s.id) ?? 0,
        cumulativeCost: cumulativeCosts.get(s.id) ?? 0,
        totalCycles: childCounts.get(s.id) || 0,
      })),
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // ── 产品 A 循环控制端点 ──

  /**
   * 停止研究循环
   *
   * POST /ai/research/:id/stop-cycling
   */
  @Post('research/:id/stop-cycling')
  @HttpCode(HttpStatus.OK)
  async stopResearchCycling(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    await this.researchCycleService.stopCycling(id, userId);
    return { success: true, message: '研究循环已停止' };
  }

  /**
   * 暂停研究循环
   *
   * POST /ai/research/:id/pause-cycling
   */
  @Post('research/:id/pause-cycling')
  @HttpCode(HttpStatus.OK)
  async pauseResearchCycling(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    await this.researchCycleService.pauseCycling(id, userId);
    return { success: true, message: '研究循环已暂停' };
  }

  /**
   * 恢复研究循环
   *
   * POST /ai/research/:id/resume-cycling
   */
  @Post('research/:id/resume-cycling')
  @HttpCode(HttpStatus.OK)
  async resumeResearchCycling(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    await this.researchCycleService.resumeCycling(id, userId);
    return { success: true, message: '研究循环已恢复' };
  }

  /**
   * 获取循环统计
   *
   * GET /ai/research/:id/campaign
   */
  @Get('research/:id/campaign')
  async getResearchCampaign(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const stats = await this.researchCycleService.getCampaignStats(id, userId);
    return stats;
  }

  // ========================= 产品 B: AI 自动交易策略 =========================

  /**
   * 创建 AI 策略
   *
   * POST /ai/strategy
   */
  @Post('strategy')
  @HttpCode(HttpStatus.CREATED)
  async createStrategy(@Request() req: any, @Body() body: CreateStrategyDto) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const strategy = await this.strategyEngine.createStrategy(userId, {
      name: body.name,
      strategyType: body.strategyType,
      tradingMode: body.tradingMode,
      coinSourceConfig: body.coinSourceConfig,
      indicatorConfig: body.indicatorConfig,
      riskControlConfig: body.riskControlConfig,
      promptSections: body.promptSections,
      gridConfig: body.gridConfig,
      intervalMinutes: body.intervalMinutes,
      exchangeApiKeyId: body.exchangeApiKeyId,
      apiKeys: body.apiKeys,
      models: body.models,
      debateConfig: body.debateConfig,
      stopConditions: body.stopConditions,
    });

    return { success: true, strategy };
  }

  // ========================= 统一时间线 =========================

  /**
   * 统一时间线 — 跨策略/研究合并查询
   *
   * GET /ai/timeline?page=1&limit=10&type=all
   * type: 'all' | 'solo' | 'debate' | 'research'
   */
  @Get('timeline')
  async getTimeline(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('type') type: string = 'all',
  ) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 10));

    const result = await this.strategyEngine.getTimeline(userId, pageNum, pageSize, type);

    return {
      data: result.data,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize),
      },
    };
  }

  // ========================= 策略管理 =========================

  /**
   * 获取策略列表
   *
   * GET /ai/strategy?page=1&limit=20
   */
  @Get('strategy')
  async listStrategies(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 20));

    const result = await this.strategyEngine.listStrategies(userId, pageNum, pageSize);

    // 附加每个策略的 todayPnl
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const strategyIds = result.data.map((s: any) => s.id);

    const todayPnlMap = new Map<string, number>();
    if (strategyIds.length > 0) {
      const todayPositions = await this.prisma.position.findMany({
        where: {
          aiStrategyId: { in: strategyIds },
          status: 'closed',
          closedAt: { gte: todayStart },
        },
        select: { aiStrategyId: true, realizedPnl: true },
      });
      for (const p of todayPositions) {
        if (p.aiStrategyId) {
          const prev = todayPnlMap.get(p.aiStrategyId) || 0;
          todayPnlMap.set(p.aiStrategyId, prev + Number(p.realizedPnl || 0));
        }
      }
    }

    return {
      data: result.data.map((s: any) => ({
        ...s,
        todayPnl: Number((todayPnlMap.get(s.id) || 0).toFixed(2)),
      })),
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize),
      },
    };
  }

  /**
   * 策略竞赛排行榜（必须在 strategy/:id 之前，否则 "competition" 会被匹配为 :id）
   *
   * GET /ai/strategy/competition?period=weekly&page=1&limit=20
   */
  @Get('strategy/competition')
  async getCompetition(
    @Query('period') period: string = 'weekly',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const db = this.prisma;

    const validPeriods = ['daily', 'weekly', 'monthly'];
    const selectedPeriod = validPeriods.includes(period) ? period : 'weekly';

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * pageSize;

    // 查询竞赛快照（按 period 过滤，取最新一批快照）
    const latestSnapshot = await db.aiStrategyCompetition.findFirst({
      where: { period: selectedPeriod },
      orderBy: { snapshotAt: 'desc' },
      select: { snapshotAt: true },
    });

    if (latestSnapshot) {
      // 有快照数据：从 AiStrategyCompetition 查询
      const [data, total] = await Promise.all([
        db.aiStrategyCompetition.findMany({
          where: {
            period: selectedPeriod,
            snapshotAt: latestSnapshot.snapshotAt,
            strategy: { isPublic: true },
          },
          orderBy: [{ sharpe: 'desc' }, { roi: 'desc' }],
          skip,
          take: pageSize,
          include: {
            strategy: {
              select: { name: true, strategyType: true, tradingMode: true, user: { select: { id: true, nickname: true } } },
            },
          },
        }),
        db.aiStrategyCompetition.count({
          where: {
            period: selectedPeriod,
            snapshotAt: latestSnapshot.snapshotAt,
            strategy: { isPublic: true },
          },
        }),
      ]);

      return {
        period: selectedPeriod,
        snapshotAt: latestSnapshot.snapshotAt,
        data: data.map((c: any, index: number) => ({
          rank: skip + index + 1,
          strategyId: c.strategyId,
          name: c.strategy?.name,
          type: c.strategy?.strategyType,
          mode: c.strategy?.tradingMode,
          totalTrades: c.totalTrades,
          roi: Number(c.roi),
          winRate: Number(c.winRate),
          sharpe: Number(c.sharpe),
          username: c.strategy?.user?.nickname || '匿名',
        })),
        pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) },
      };
    }

    // Fallback: 无快照数据时从 AiStrategy 实时计算
    const [data, total] = await Promise.all([
      db.aiStrategy.findMany({
        where: { isPublic: true, totalTrades: { gt: 0 } },
        orderBy: [{ sharpe: 'desc' }, { totalPnl: 'desc' }],
        skip,
        take: pageSize,
        select: {
          id: true, name: true, strategyType: true, tradingMode: true,
          totalTrades: true, totalPnl: true, winRate: true, sharpe: true, createdAt: true,
          user: { select: { id: true, nickname: true } },
        },
      }),
      db.aiStrategy.count({ where: { isPublic: true, totalTrades: { gt: 0 } } }),
    ]);

    return {
      period: selectedPeriod,
      snapshotAt: null,
      data: data.map((s: any, index: number) => ({
        rank: skip + index + 1,
        strategyId: s.id,
        name: s.name,
        type: s.strategyType,
        mode: s.tradingMode,
        totalTrades: s.totalTrades,
        totalPnl: Number(s.totalPnl),
        winRate: Number(s.winRate),
        sharpe: Number(s.sharpe),
        username: s.user?.nickname || '匿名',
        createdAt: s.createdAt,
      })),
      pagination: { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /**
   * 预览 System Prompt（渲染后的完整 8-section Prompt）
   *
   * POST /ai/strategy/preview-prompt
   * 必须放在 GET /ai/strategy/:id 之前，避免路由冲突
   */
  @Post('strategy/preview-prompt')
  @HttpCode(HttpStatus.OK)
  async previewPrompt(@Body() body: {
    promptSections?: { role?: string; mode?: 'aggressive' | 'conservative' | 'scalping'; custom?: string; tradingFrequency?: string; entryStandards?: string };
    riskControlConfig?: { maxPositions?: number; maxLeverage?: number; maxDailyDrawdown?: number; allocatedCapital?: number };
    intervalMinutes?: number;
  }) {
    const systemPrompt = this.promptBuilder.buildSystemPrompt({
      promptSections: body.promptSections,
      riskControl: body.riskControlConfig ? {
        maxPositions: body.riskControlConfig.maxPositions,
        maxLeverage: body.riskControlConfig.maxLeverage,
        maxDailyDrawdown: body.riskControlConfig.maxDailyDrawdown,
        allocatedCapital: body.riskControlConfig.allocatedCapital,
      } : undefined,
      intervalMinutes: body.intervalMinutes,
    });

    // 按 ## 标题拆分为 section 数组
    const sections = systemPrompt
      .split(/(?=^## )/m)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return {
      systemPrompt,
      sections,
      estimatedTokens: Math.ceil(systemPrompt.length / 4),
    };
  }

  /**
   * 获取策略详情
   *
   * GET /ai/strategy/:id
   */
  @Get('strategy/:id')
  async getStrategy(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const strategy = await this.strategyEngine.getStrategy(id, userId);

    // 计算下次分析时间
    let nextCycleAt: string | null = null;
    if (strategy.isActive && strategy.lastCycleAt) {
      const next = new Date(strategy.lastCycleAt.getTime() + (strategy.intervalMinutes || 60) * 60 * 1000);
      nextCycleAt = next.toISOString();
    }

    // 今日 PnL（UTC 日期起始）
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayPositions = await this.prisma.position.findMany({
      where: {
        aiStrategyId: id,
        status: 'closed',
        closedAt: { gte: todayStart },
      },
      select: { realizedPnl: true },
    });
    const todayPnl = todayPositions.reduce((sum, p) => sum + Number(p.realizedPnl || 0), 0);

    // 如果是网格策略，附加网格状态
    let gridState: any = null;
    if (strategy.strategyType === 'grid') {
      gridState = await this.gridTrading.getGridState(id);
    }

    return { strategy, nextCycleAt, todayPnl: Number(todayPnl.toFixed(2)), gridState };
  }

  /**
   * 更新策略配置
   *
   * PUT /ai/strategy/:id
   */
  @Put('strategy/:id')
  async updateStrategy(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: UpdateStrategyDto,
  ) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const strategy = await this.strategyEngine.updateStrategy(id, userId, body);
    return { success: true, strategy };
  }

  /**
   * 删除策略
   *
   * DELETE /ai/strategy/:id
   */
  @Delete('strategy/:id')
  @HttpCode(HttpStatus.OK)
  async deleteStrategy(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    // 如果是网格策略，关闭网格
    this.gridTrading.closeGrid(id);

    await this.strategyEngine.deleteStrategy(id, userId);
    return { success: true, message: '策略已删除' };
  }

  /**
   * 启动策略
   *
   * POST /ai/strategy/:id/start
   */
  @Post('strategy/:id/start')
  @HttpCode(HttpStatus.OK)
  async startStrategy(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    // 验证用户有 AI 配置和 API Key
    const aiConfig = await this.prisma.aiConfig.findUnique({
      where: { userId },
    });

    if (!aiConfig || !aiConfig.isEnabled) {
      throw new BadRequestException('请先启用 AI 模块');
    }

    if (!aiConfig.exchangeApiKeyId) {
      throw new BadRequestException('请先绑定交易所 API Key');
    }

    // 双轨制 Key 检查
    const apiKeys = this.resolveApiKeys(aiConfig.apiKeys);

    // Free 用户门控：无 BYOK Key 的免费用户不能使用平台 Key
    await this.validateLlmAccess(userId, apiKeys);

    const defaultModel = (aiConfig.models as string[])?.[0] || 'deepseek-chat';
    if (!this.llmService.hasAvailableKey(defaultModel, apiKeys)) {
      throw new BadRequestException('无可用 LLM API Key：用户未配置且平台未设置默认 Key');
    }

    const strategy = await this.strategyEngine.startStrategy(id, userId);

    // 如果是网格策略，初始化网格
    if (strategy.strategyType === 'grid' && strategy.gridConfig) {
      const gc = strategy.gridConfig as any;
      const gridConfig: GridConfig = {
        symbol: gc.symbol || ((strategy.coinSourceConfig as any)?.coins?.[0]) || 'BTC/USDT',
        gridCount: gc.gridCount || 10,
        totalInvestment: gc.totalInvestment || 1000,
        upperBound: gc.upperBound,
        lowerBound: gc.lowerBound,
        leverage: gc.leverage || 1,
      };

      if (gridConfig.upperBound && gridConfig.lowerBound) {
        const aiCfg = await this.prisma.aiConfig.findUnique({ where: { userId }, select: { exchangeApiKeyId: true } });
        if (aiCfg?.exchangeApiKeyId) {
          await this.gridTrading.initializeGrid(id, userId, aiCfg.exchangeApiKeyId, gridConfig);
        }
      }
    }

    return { success: true, strategy, message: '策略已启动' };
  }

  /**
   * 停止策略
   *
   * POST /ai/strategy/:id/stop
   */
  @Post('strategy/:id/stop')
  @HttpCode(HttpStatus.OK)
  async stopStrategy(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    // 关闭网格（如果有）
    this.gridTrading.closeGrid(id);

    const strategy = await this.strategyEngine.stopStrategy(id, userId);
    return { success: true, strategy, message: '策略已停止' };
  }

  /**
   * 手动触发策略周期（开发调试用）
   *
   * POST /ai/strategy/:id/trigger-cycle
   * 立即执行一次策略分析+交易周期，不等待 BullMQ 定时器
   */
  @Post('strategy/:id/trigger-cycle')
  @HttpCode(HttpStatus.OK)
  async triggerCycle(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    // 验证策略属于该用户且已激活
    const strategy = await this.prisma.aiStrategy.findFirst({
      where: { id, userId },
    });

    if (!strategy) throw new NotFoundException('策略不存在');
    if (!strategy.isActive) {
      throw new BadRequestException('策略未启动，请先启动策略');
    }

    // 直接调用 autoTrader.runCycle
    const cycleResult = await this.autoTrader.runCycle(id);

    return {
      success: true,
      message: '手动触发周期完成',
      cycle: cycleResult,
    };
  }

  /**
   * 暂停策略
   *
   * POST /ai/strategy/:id/pause
   * Body: { minutes?: number }  默认 60 分钟
   */
  @Post('strategy/:id/pause')
  @HttpCode(HttpStatus.OK)
  async pauseStrategy(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { minutes?: number },
  ) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const minutes = Math.max(1, Math.min(1440, body?.minutes || 60));
    const result = await this.strategyEngine.pauseStrategy(id, userId, minutes);
    return { success: true, ...result, message: `策略已暂停 ${minutes} 分钟` };
  }

  /**
   * 热更新策略配置（运行中修改，不停策略）
   *
   * PUT /ai/strategy/:id/config
   */
  @Put('strategy/:id/config')
  async hotUpdateStrategyConfig(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: UpdateStrategyDto,
  ) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const strategy = await this.strategyEngine.hotUpdateConfig(id, userId, body);
    return { success: true, strategy, message: '配置已热更新' };
  }

  /**
   * 策略 PnL 曲线图数据
   *
   * GET /ai/strategy/:id/pnl-chart?days=30
   * 返回每日累计 PnL 数据点，供前端绘制曲线图
   */
  @Get('strategy/:id/pnl-chart')
  async getStrategyPnlChart(
    @Param('id') id: string,
    @Request() req: any,
    @Query('days') days: string = '30',
  ) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    // 验证策略属于用户
    await this.strategyEngine.getStrategy(id, userId);

    const daysNum = Math.min(90, Math.max(1, parseInt(days) || 30));
    const since = new Date();
    since.setDate(since.getDate() - daysNum);

    // 查询策略关联的已平仓持仓
    const closedPositions = await this.prisma.position.findMany({
      where: {
        aiStrategyId: id,
        status: 'closed',
        closedAt: { gte: since },
      },
      orderBy: { closedAt: 'asc' },
      select: {
        realizedPnl: true,
        closedAt: true,
      },
    });

    // 按日期聚合累计 PnL
    const dailyMap = new Map<string, number>();
    let cumPnl = 0;

    for (const pos of closedPositions) {
      const dateKey = (pos.closedAt as Date).toISOString().slice(0, 10);
      cumPnl += Number(pos.realizedPnl || 0);
      dailyMap.set(dateKey, cumPnl);
    }

    // 填充空缺日期（保持曲线连续）
    const dataPoints: Array<{ date: string; pnl: number }> = [];
    const cursor = new Date(since);
    const today = new Date();
    let lastPnl = 0;

    while (cursor <= today) {
      const key = cursor.toISOString().slice(0, 10);
      if (dailyMap.has(key)) {
        lastPnl = dailyMap.get(key)!;
      }
      dataPoints.push({ date: key, pnl: Number(lastPnl.toFixed(2)) });
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      strategyId: id,
      days: daysNum,
      totalClosedTrades: closedPositions.length,
      finalPnl: Number(cumPnl.toFixed(2)),
      dataPoints,
    };
  }

  /**
   * 策略决策日志
   *
   * GET /ai/strategy/:id/logs?page=1&limit=20
   */
  @Get('strategy/:id/logs')
  async getStrategyLogs(
    @Param('id') id: string,
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 20));

    const result = await this.strategyEngine.getStrategyLogs(id, userId, pageNum, pageSize);

    return {
      data: result.data,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize),
      },
    };
  }

  /**
   * 策略关联持仓列表
   *
   * GET /ai/strategy/:id/positions
   * 返回该策略的活跃持仓和最近关闭的持仓
   */
  @Get('strategy/:id/positions')
  async getStrategyPositions(
    @Param('id') id: string,
    @Request() req: any,
    @Query('status') status: string = 'all',
  ) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    // 验证策略属于用户
    await this.strategyEngine.getStrategy(id, userId);

    const where: any = { aiStrategyId: id };
    if (status === 'open') {
      where.status = 'open';
    } else if (status === 'closed') {
      where.status = 'closed';
    }

    const positions = await this.prisma.position.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        symbol: true,
        side: true,
        leverage: true,
        entryPrice: true,
        exitPrice: true,
        amount: true,
        margin: true,
        realizedPnl: true,
        unrealizedPnl: true,
        closeReason: true,
        status: true,
        createdAt: true,
        closedAt: true,
      },
    });

    return {
      data: positions.map((p) => ({
        id: p.id,
        symbol: p.symbol,
        side: p.side,
        leverage: Number(p.leverage || 1),
        entryPrice: Number(p.entryPrice || 0),
        exitPrice: p.exitPrice ? Number(p.exitPrice) : null,
        amount: Number(p.amount || 0),
        margin: Number(p.margin || 0),
        realizedPnl: Number(p.realizedPnl || 0),
        unrealizedPnl: Number(p.unrealizedPnl || 0),
        closeReason: p.closeReason || null,
        status: p.status,
        createdAt: p.createdAt,
        closedAt: p.closedAt,
      })),
      total: positions.length,
    };
  }

  // ========================= 用户级持仓（独立于策略） =========================

  /**
   * GET /ai/positions
   * 返回用户所有 AI 相关持仓（不依赖策略是否存在）
   */
  @Get('positions')
  async getUserPositions(
    @Request() req: any,
    @Query('status') status: string = 'all',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const take = Math.min(Number(limit) || 50, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    // 不限制 aiStrategyId — 包含已删除策略的历史仓位
    const where: any = { userId };
    if (status === 'open') where.status = 'open';
    else if (status === 'closed') where.status = 'closed';

    const [positions, total] = await Promise.all([
      this.prisma.position.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          symbol: true,
          side: true,
          leverage: true,
          entryPrice: true,
          exitPrice: true,
          amount: true,
          margin: true,
          realizedPnl: true,
          unrealizedPnl: true,
          closeReason: true,
          status: true,
          createdAt: true,
          closedAt: true,
          source: true,
          aiStrategyId: true,
          aiStrategy: { select: { name: true } },
        },
      }),
      this.prisma.position.count({ where }),
    ]);

    return {
      data: positions.map((p) => ({
        id: p.id,
        symbol: p.symbol,
        side: p.side,
        leverage: Number(p.leverage || 1),
        entryPrice: Number(p.entryPrice || 0),
        exitPrice: p.exitPrice ? Number(p.exitPrice) : null,
        amount: Number(p.amount || 0),
        margin: Number(p.margin || 0),
        realizedPnl: Number(p.realizedPnl || 0),
        unrealizedPnl: Number(p.unrealizedPnl || 0),
        closeReason: p.closeReason || null,
        source: p.source || null,
        status: p.status,
        createdAt: p.createdAt,
        closedAt: p.closedAt,
        strategyId: p.aiStrategyId,
        strategyName: p.aiStrategy?.name || '已删除策略',
      })),
      total,
      page: Number(page) || 1,
      limit: take,
    };
  }

  // ========================= TG Bot 专用端点 =========================

  /**
   * AI 总览（TG Bot /ai 命令用）
   *
   * GET /ai/overview
   * 返回策略/研究统计 + 今日 PnL + 预算
   */
  @Get('overview')
  async getAiOverview(@Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const db = this.prisma;

    // 策略统计：按 tradingMode 和 isActive 分组
    const strategies = await db.aiStrategy.findMany({
      where: { userId },
      select: { id: true, tradingMode: true, isActive: true },
    });

    const soloStats = { running: 0, paused: 0, stopped: 0 };
    const debateStats = { running: 0, paused: 0, stopped: 0 };

    for (const s of strategies) {
      const bucket = s.tradingMode === 'debate' ? debateStats : soloStats;
      if (s.isActive) {
        bucket.running++;
      } else {
        bucket.stopped++;
      }
    }

    // 研究统计：循环中 vs 已停止
    const researchSessions = await db.aiResearchSession.findMany({
      where: { userId, rootSessionId: null },
      select: { campaignStatus: true },
    });

    let researchCycling = 0;
    let researchStopped = 0;
    for (const r of researchSessions) {
      if (r.campaignStatus === 'cycling' || r.campaignStatus === 'paused') {
        researchCycling++;
      } else if (r.campaignStatus) {
        researchStopped++;
      }
    }

    // 今日 PnL（策略 + 研究的已平仓持仓）
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const todayPositions = await db.position.findMany({
      where: {
        userId,
        status: 'closed',
        closedAt: { gte: todayStart },
        OR: [
          { aiStrategyId: { not: null } },
          { source: 'ai_research' },
        ],
      },
      select: { realizedPnl: true },
    });

    const todayPnl = todayPositions.reduce(
      (sum, p) => sum + Number(p.realizedPnl || 0),
      0,
    );

    // 预算使用（本月 LLM 调用费用）
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const aiConfig = await db.aiConfig.findUnique({
      where: { userId },
      select: { monthlyBudget: true },
    });

    // 累加本月所有 AI 研究会话的 totalCost
    const monthCostResult = await db.aiResearchSession.aggregate({
      where: { userId, createdAt: { gte: monthStart } },
      _sum: { totalCost: true },
    });

    const budgetUsed = Number(monthCostResult._sum.totalCost || 0);
    const budgetLimit = Number(aiConfig?.monthlyBudget || 50);

    return {
      solo: soloStats,
      debate: debateStats,
      research: { cycling: researchCycling, stopped: researchStopped },
      todayPnl: Number(todayPnl.toFixed(2)),
      budget: {
        used: Number(budgetUsed.toFixed(2)),
        limit: budgetLimit,
      },
    };
  }

  /**
   * 暂停用户所有 AI 策略 + 研究
   *
   * POST /ai/pause-all
   */
  @Post('pause-all')
  @HttpCode(HttpStatus.OK)
  async pauseAll(@Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const db = this.prisma;
    let pausedCount = 0;

    // 暂停所有运行中的策略
    const activeStrategies = await db.aiStrategy.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    if (activeStrategies.length > 0) {
      await db.aiStrategy.updateMany({
        where: { id: { in: activeStrategies.map((s) => s.id) } },
        data: { isActive: false },
      });
      pausedCount += activeStrategies.length;
    }

    // 暂停所有循环中的研究
    const cyclingResearch = await db.aiResearchSession.findMany({
      where: { userId, rootSessionId: null, campaignStatus: 'cycling' },
      select: { id: true },
    });

    for (const r of cyclingResearch) {
      try {
        await this.researchCycleService.pauseCycling(r.id, userId);
        pausedCount++;
      } catch { /* 单个失败不阻断 */ }
    }

    return { success: true, paused: pausedCount };
  }

  /**
   * 恢复用户所有暂停的 AI 策略 + 研究
   *
   * POST /ai/resume-all
   */
  @Post('resume-all')
  @HttpCode(HttpStatus.OK)
  async resumeAll(@Request() req: any) {
    const userId = req.user?.sub || req.user?.id;
    if (!userId) throw new BadRequestException('用户未认证');

    const db = this.prisma;
    let resumedCount = 0;

    // 恢复所有已停止的策略（isActive = false）
    const stoppedStrategies = await db.aiStrategy.findMany({
      where: { userId, isActive: false },
      select: { id: true },
    });

    if (stoppedStrategies.length > 0) {
      await db.aiStrategy.updateMany({
        where: { id: { in: stoppedStrategies.map((s) => s.id) } },
        data: { isActive: true, consecutiveFailures: 0 },
      });
      resumedCount += stoppedStrategies.length;
    }

    // 恢复所有暂停的研究
    const pausedResearch = await db.aiResearchSession.findMany({
      where: { userId, rootSessionId: null, campaignStatus: 'paused' },
      select: { id: true },
    });

    for (const r of pausedResearch) {
      try {
        await this.researchCycleService.resumeCycling(r.id, userId);
        resumedCount++;
      } catch { /* 单个失败不阻断 */ }
    }

    return { success: true, resumed: resumedCount };
  }

  // ========================= 内部工具 =========================

  /**
   * 清洗配置更新请求
   */
  private sanitizeConfigBody(body: any): Record<string, any> {
    const allowed = [
      'isEnabled', 'mode', 'models', 'symbols', 'timeframes',
      'rolePrompts', 'roleModels', 'minConfidence', 'maxPositionSize',
      'maxLeverage', 'maxDailyTrades', 'maxDailyDrawdown', 'cooldownMinutes',
      'circuitBreaker', 'maxDebateRounds', 'apiKeys', 'indicatorRules',
      'monthlyBudget', 'amountPerTrade', 'exchangeApiKeyId',
      'maxPositions', 'minPositionSizeUSD', 'maxMarginUsage',
    ];

    const result: Record<string, any> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        result[key] = body[key];
      }
    }

    // AES-256-GCM 加密用户提供的 LLM API Keys
    if (result.apiKeys && typeof result.apiKeys === 'object') {
      const encrypted: Record<string, any> = {};
      for (const [provider, key] of Object.entries(result.apiKeys)) {
        if (typeof key === 'string' && key.length > 0) {
          encrypted[provider] = encrypt(key);
        }
      }
      result.apiKeys = encrypted;
    }

    return result;
  }

  /**
   * 免费用户 LLM 访问门控：无 BYOK Key 的 Free 用户不能使用平台 Key
   */
  private async validateLlmAccess(
    userId: string,
    apiKeys: import('./services/llm.service').UserApiKeys,
  ): Promise<void> {
    // 用户自带了 Key → 放行（无论 Free/Pro）
    const hasByokKeys = Object.values(apiKeys).some(
      (v) => typeof v === 'string' && v.trim().length > 0,
    );
    if (hasByokKeys) return;

    // 无 BYOK Key → 只有 Pro 用户可使用平台 Key
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { membershipStatus: true, membershipExpireAt: true },
    });
    const isPro =
      user?.membershipStatus === 'active' &&
      user.membershipExpireAt != null &&
      user.membershipExpireAt > new Date();

    if (!isPro) {
      throw new ForbiddenException(
        '免费用户需自行配置 LLM API Key（BYOK）才能使用 AI 功能，升级 Pro 可免费使用平台 AI 模型',
      );
    }
  }

  /**
   * 解析 API Keys：如果是加密格式则解密，否则原样返回（向后兼容）
   */
  private resolveApiKeys(raw: any): import('./services/llm.service').UserApiKeys {
    if (!raw || typeof raw !== 'object') return {};
    const result: Record<string, string> = {};
    for (const provider of ['deepseek', 'openai', 'openrouter', 'qwen', 'grok', 'kimi']) {
      const val = raw[provider];
      if (!val) continue;
      if (typeof val === 'object' && val.encryptedData && val.iv && val.authTag) {
        try { result[provider] = decrypt(val); } catch { /* 解密失败忽略 */ }
      } else if (typeof val === 'string') {
        result[provider] = val;
      }
    }
    return result;
  }
}
