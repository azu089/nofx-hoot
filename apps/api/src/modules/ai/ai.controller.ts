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
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ResearchPipelineService, ResearchConfig } from './services/research-pipeline.service';
import { AiExecutionService } from './services/ai-execution.service';
import { StrategyEngineService } from './services/strategy-engine.service';
import { GridTradingService, GridConfig } from './services/grid-trading.service';
import { AiPerformanceService } from './services/ai-performance.service';
import { MarketDataService } from './services/market-data.service';
import { IndicatorsService } from './services/indicators.service';
import { SafetyService } from './services/safety.service';
import { StartResearchDto, ExecuteResearchDto } from './dto/research.dto';
import { CreateStrategyDto, UpdateStrategyDto } from './dto/strategy.dto';
import { LLMService } from './services/llm.service';
import { AutoTraderService } from './services/auto-trader.service';
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
    const quickModel = (aiConfig.models as string[])?.[0] || 'deepseek-chat';
    if (!this.llmService.hasAvailableKey(quickModel, apiKeys)) {
      throw new BadRequestException('无可用 LLM API Key：用户未配置且平台未设置默认 Key');
    }

    // 异步启动研究流水线（不阻塞请求）
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
      apiKeyId: aiConfig.exchangeApiKeyId || undefined,
      llmApiKeys: apiKeys,
      quickThinkModel: (aiConfig.models as string[])?.[0] || 'deepseek-chat',
      deepThinkModel: (aiConfig.models as string[])?.[1] || 'deepseek-chat',
      sessionId, // 传入已创建的会话 ID
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

    return {
      sessionId: session.id,
      symbol: session.symbol,
      depth: session.depth,
      status: session.status,
      stages: session.stages || [],
      finalDecision: session.finalDecision,
      executedTradeId: session.executedTradeId,
      totalCost: Number(session.totalCost) || 0,
      errorMessage: session.errorMessage,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
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

    const [sessions, total] = await Promise.all([
      db.aiResearchSession.findMany({
        where: { userId },
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
        },
      }),
      db.aiResearchSession.count({ where: { userId } }),
    ]);

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
      })),
      pagination: {
        page: pageNum,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
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
    });

    return { success: true, strategy };
  }

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
        await this.gridTrading.initializeGrid(id, userId, gridConfig);
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
