import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AdapterFactoryService } from '../../../exchange-adapters/adapter-factory.service';
import { encrypt } from '../../../../common/utils/crypto.util';
import { FeeService } from '../../../trading/fee.service';
import { GridTradingService } from './grid-trading.service';
import { AiExecutionService } from '../ai-execution.service';

/**
 * 策略引擎服务 — 产品 B 策略 CRUD + 启停控制
 *
 * 管理 AiStrategy 的生命周期:
 * - 创建/更新/删除策略
 * - 启动/停止/暂停策略
 * - 热更新配置（运行中修改不停策略）
 *
 * 调度机制：
 * - 直接使用 BullMQ ai-auto 队列，job name = 'strategy-cycle'
 * - jobId 格式: ai-strategy-${strategyId}（与用户级 ai-auto-${userId} 区分）
 * - 服务启动时自动恢复运行中的策略（OnModuleInit）
 */
@Injectable()
export class StrategyEngineService implements OnModuleInit {
  private readonly logger = new Logger(StrategyEngineService.name);

  constructor(
    @InjectQueue('ai-auto') private readonly autoQueue: Queue,
    private readonly prisma: PrismaService,
    @Optional() private readonly adapterFactory?: AdapterFactoryService,
    @Optional() private readonly feeService?: FeeService,
    @Optional() private readonly gridTrading?: GridTradingService,
    @Optional() private readonly aiExecution?: AiExecutionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.restoreActiveStrategies();
    // 启动后异步快照持仓（不阻塞启动）
    this.snapshotPositionsOnStartup().catch((e) =>
      this.logger.error(`[策略] 启动持仓快照失败: ${e.message}`),
    );
  }

  // ========================= CRUD =========================

  /**
   * 加密 LLM API Keys（AiStrategy 级别 BYOK）
   * 与 AiConfig 的 sanitizeAiConfigUpdate 保持一致
   */
  private encryptApiKeys(raw: Record<string, string>): Record<string, unknown> {
    const encrypted: Record<string, unknown> = {};
    for (const [provider, key] of Object.entries(raw)) {
      if (typeof key === 'string' && key.length > 0) {
        encrypted[provider] = encrypt(key);
      }
    }
    return encrypted;
  }

  /**
   * 从策略对象中去除 apiKeys 字段，返回含 hasApiKeys 标记的安全副本
   */
  private sanitizeStrategyResponse(strategy: any): any {
    const { apiKeys, ...rest } = strategy;
    return {
      ...rest,
      hasApiKeys: !!(apiKeys && Object.keys(apiKeys as object).length > 0),
    };
  }

  async createStrategy(userId: string, data: {
    name: string;
    strategyType?: string;
    tradingMode?: string;
    coinSourceConfig: Record<string, any>;
    indicatorConfig: Record<string, any>;
    riskControlConfig: Record<string, any>;
    promptSections?: Record<string, any>;
    gridConfig?: Record<string, any>;
    intervalMinutes?: number;
    exchangeApiKeyId?: string;
    apiKeys?: Record<string, string>;
    models?: string[];
    debateConfig?: Record<string, any>;
    stopConditions?: Record<string, any>;
  }): Promise<any> {
    const db = this.prisma;

    // 共识/深研模式：创建时必须选择 2 个以上 AI 模型
    if (data.tradingMode === 'debate' || data.tradingMode === 'research') {
      if (!data.models || data.models.length < 2) {
        throw new BadRequestException(
          `共识/深研模式需要至少选择 2 个 AI 模型，当前选择 ${data.models?.length ?? 0} 个`,
        );
      }
    }

    // 加密 LLM BYOK Keys（与 AiConfig 保持一致）
    const encryptedApiKeys = data.apiKeys && Object.keys(data.apiKeys).length > 0
      ? this.encryptApiKeys(data.apiKeys)
      : {};

    const strategy = await db.aiStrategy.create({
      data: {
        userId,
        name: data.name,
        strategyType: data.strategyType || 'normal',
        tradingMode: data.tradingMode || 'solo',
        coinSourceConfig: data.coinSourceConfig,
        indicatorConfig: data.indicatorConfig,
        riskControlConfig: data.riskControlConfig,
        promptSections: data.promptSections || {},
        gridConfig: data.gridConfig || undefined,
        intervalMinutes: data.intervalMinutes || 60,
        exchangeApiKeyId: data.exchangeApiKeyId || null,
        apiKeys: encryptedApiKeys as any,
        models: data.models || [],
        debateConfig: data.debateConfig || undefined,
        stopConditions: data.stopConditions || undefined,
        isActive: false,
      },
    });

    this.logger.log(`[策略] 创建: ${strategy.id} (${data.name}) for user ${userId}`);
    return this.sanitizeStrategyResponse(strategy);
  }

  async getStrategy(strategyId: string, userId: string): Promise<any> {
    const db = this.prisma;
    const strategy = await db.aiStrategy.findFirst({
      where: { id: strategyId, userId },
    });
    if (!strategy) throw new NotFoundException('策略不存在');
    // 不返回 apiKeys 密文，只暴露 hasApiKeys 标记
    return this.sanitizeStrategyResponse(strategy);
  }

  async listStrategies(userId: string, page: number = 1, limit: number = 20): Promise<{
    data: any[];
    total: number;
  }> {
    const db = this.prisma;
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      db.aiStrategy.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.aiStrategy.count({ where: { userId } }),
    ]);

    return { data: rows.map(s => this.sanitizeStrategyResponse(s)), total };
  }

  async updateStrategy(strategyId: string, userId: string, data: Record<string, any>): Promise<any> {
    const db = this.prisma;

    // 验证策略存在且属于该用户
    const existing = await db.aiStrategy.findFirst({
      where: { id: strategyId, userId },
    });
    if (!existing) throw new NotFoundException('策略不存在');

    // 共识/深研模式：修改模型列表时也需要保证 2 个以上
    const newMode = data.tradingMode ?? existing.tradingMode;
    const newModels = data.models ?? (existing.models as string[] | null) ?? [];
    if ((newMode === 'debate' || newMode === 'research') && newModels.length < 2) {
      throw new BadRequestException(
        `共识/深研模式需要至少选择 2 个 AI 模型，当前选择 ${newModels.length} 个`,
      );
    }

    // 白名单过滤可更新字段
    const allowed = [
      'name', 'tradingMode', 'coinSourceConfig', 'indicatorConfig',
      'riskControlConfig', 'promptSections', 'gridConfig',
      'intervalMinutes', 'isPublic',
      'exchangeApiKeyId', 'apiKeys', 'models',
      'debateConfig', 'stopConditions',
    ];

    const updateData: Record<string, any> = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        updateData[key] = data[key];
      }
    }

    // 如果传入了 apiKeys 则加密存储（与 createStrategy 保持一致）
    if (updateData.apiKeys && typeof updateData.apiKeys === 'object') {
      updateData.apiKeys = this.encryptApiKeys(updateData.apiKeys as Record<string, string>);
    }

    // 网格策略：gridConfig.symbol 变更时同步 coinSourceConfig.coins（保持卡片显示一致）
    if (updateData.gridConfig?.symbol) {
      const newSymbol = updateData.gridConfig.symbol as string;
      const existingCc = (existing.coinSourceConfig as Record<string, any>) || {};
      updateData.coinSourceConfig = { ...existingCc, coins: [newSymbol] };
    }

    const updated = await db.aiStrategy.update({
      where: { id: strategyId },
      data: updateData,
    });

    // 如果间隔变更且策略正在运行，重新注册定时任务（防止旧间隔的 BullMQ job 残留）
    if (updateData.intervalMinutes !== undefined && updated.isActive) {
      const newIntervalMs = (updateData.intervalMinutes as number) * 60 * 1000;
      try {
        await this.removeStrategyJob(strategyId);
        await this.addStrategyJob(strategyId, userId, newIntervalMs, false);
        this.logger.log(`[策略] 间隔变更: ${strategyId} → ${updateData.intervalMinutes}分钟，已重新注册定时任务`);
      } catch (e: any) {
        this.logger.warn(`[策略] 重新注册定时任务失败: ${e.message}`);
      }
    }

    this.logger.log(`[策略] 更新: ${strategyId}`);
    return this.sanitizeStrategyResponse(updated);
  }

  async deleteStrategy(strategyId: string, userId: string): Promise<void> {
    const db = this.prisma;

    const existing = await db.aiStrategy.findFirst({
      where: { id: strategyId, userId },
    });
    if (!existing) throw new NotFoundException('策略不存在');

    // 如果正在运行，先停止
    if (existing.isActive) {
      await this.stopStrategy(strategyId, userId);
    }

    await db.aiStrategy.delete({ where: { id: strategyId } });
    this.logger.log(`[策略] 删除: ${strategyId}`);
  }

  // ========================= 启停控制 =========================

  async startStrategy(strategyId: string, userId: string): Promise<any> {
    const db = this.prisma;

    // GAS余额门控：余额为 0 时禁止启动
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { pointBalance: true },
    });
    if (!user || Number(user.pointBalance) <= 0) {
      throw new BadRequestException('GAS余额不足，请充值后再启动策略');
    }

    const strategy = await db.aiStrategy.findFirst({
      where: { id: strategyId, userId },
    });
    if (!strategy) throw new NotFoundException('策略不存在');

    if (strategy.isActive) {
      throw new BadRequestException('策略已在运行中');
    }

    // 如果存在风控暂停状态（_riskPause），清除它
    const riskControl = (strategy.riskControlConfig as Record<string, unknown>) || {};
    if (riskControl._riskPause) {
      const { _riskPause, ...cleanConfig } = riskControl;
      void _riskPause; // 标记已使用
      await db.aiStrategy.update({
        where: { id: strategyId },
        data: { riskControlConfig: cleanConfig as any },
      });
      this.logger.log(`[策略引擎] 清除风控暂停状态: ${strategyId}`);
    }

    // 激活策略
    const updated = await db.aiStrategy.update({
      where: { id: strategyId },
      data: { isActive: true },
    });

    // 清除内存状态，强制下次从 DB 加载并 reconcile（每次启动都重新从交易所读取真实状态）
    this.gridTrading?.clearGridState(strategyId);

    // 注册定时任务到 BullMQ（strategy-cycle 类型）
    // 最小 3 分钟（服务端强制执行，防止过于频繁消耗 LLM 预算）
    const intervalMs = Math.max(3, strategy.intervalMinutes || 60) * 60 * 1000;
    await this.addStrategyJob(strategyId, userId, intervalMs);

    this.logger.log(
      `[策略] 启动: ${strategyId}, 间隔 ${strategy.intervalMinutes || 60}min`,
    );

    return updated;
  }

  /**
   * 立即触发一次策略执行（用于恢复后立即运行，无需等待下一个周期）
   */
  async triggerImmediateRun(strategyId: string, userId: string): Promise<void> {
    await this.autoQueue.add(
      'strategy-cycle',
      { strategyId, userId },
      { removeOnComplete: 1, removeOnFail: 1 },
    );
    this.logger.log(`[策略] 立即触发执行: ${strategyId}`);
  }

  async stopStrategy(strategyId: string, userId: string): Promise<any> {
    const db = this.prisma;

    const strategy = await db.aiStrategy.findFirst({
      where: { id: strategyId, userId },
    });
    if (!strategy) throw new NotFoundException('策略不存在');

    // 停止定时任务
    await this.removeStrategyJob(strategyId);

    // 平仓 + 结算燃油费（手动停止时与止盈/止损触发行为一致）
    const apiKeyId = (strategy.exchangeApiKeyId as string | null) ?? '';
    if (strategy.strategyType === 'grid') {
      // 网格策略：取消挂单 → 平仓 → 结算燃油费
      if (this.gridTrading && apiKeyId) {
        try {
          await this.gridTrading.stopGridForCondition(strategyId, userId, apiKeyId, '手动停止');
        } catch (e: any) {
          this.logger.error(`[策略] 手动停止网格平仓失败(继续停策略): ${e.message}`);
        }
      }
    } else {
      // 极速/共识/深研策略：逐一平仓 + 结算燃油费
      if (this.aiExecution && apiKeyId) {
        try {
          await this.aiExecution.closeAllStrategyPositions(userId, strategyId, apiKeyId);
        } catch (e: any) {
          this.logger.error(`[策略] 手动停止平仓失败(继续停策略): ${e.message}`);
        }
      }
    }

    // 更新状态
    const updated = await db.aiStrategy.update({
      where: { id: strategyId },
      data: { isActive: false },
    });

    this.logger.log(`[策略] 停止: ${strategyId}`);
    return updated;
  }

  async pauseStrategy(strategyId: string, userId: string, minutes: number = 60): Promise<any> {
    const db = this.prisma;

    const strategy = await db.aiStrategy.findFirst({
      where: { id: strategyId, userId },
    });
    if (!strategy) throw new NotFoundException('策略不存在');

    if (!strategy.isActive) {
      throw new BadRequestException('策略未在运行，无需暂停');
    }

    // 暂停: 停止定时任务 + 设置 isActive = false（前端可感知状态变化）
    await this.removeStrategyJob(strategyId);

    await db.aiStrategy.update({
      where: { id: strategyId },
      data: { isActive: false },
    });

    const resumeAt = new Date(Date.now() + minutes * 60 * 1000);

    this.logger.log(
      `[策略] 暂停: ${strategyId}, ${minutes} 分钟后可恢复 (${resumeAt.toISOString()})`,
    );

    return { paused: true, resumeAt };
  }

  // ========================= 热更新 =========================

  async hotUpdateConfig(
    strategyId: string,
    userId: string,
    partial: Record<string, any>,
  ): Promise<any> {
    // 更新配置但不停止策略
    const updated = await this.updateStrategy(strategyId, userId, partial);

    this.logger.log(`[策略] 热更新: ${strategyId}`);
    return updated;
  }

  // ========================= 统计更新 =========================

  async updateStats(strategyId: string, stats: {
    totalTrades?: number;
    totalPnl?: number;
    winRate?: number;
    sharpe?: number;
  }): Promise<void> {
    const db = this.prisma;

    const updateData: Record<string, any> = {};
    if (stats.totalTrades !== undefined) updateData.totalTrades = stats.totalTrades;
    if (stats.totalPnl !== undefined) updateData.totalPnl = stats.totalPnl;
    if (stats.winRate !== undefined) updateData.winRate = stats.winRate;
    if (stats.sharpe !== undefined) updateData.sharpe = stats.sharpe;

    await db.aiStrategy.update({
      where: { id: strategyId },
      data: updateData,
    });
  }

  // ========================= 策略日志 =========================

  async getStrategyLogs(
    strategyId: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
    actionsOnly: boolean = false,
  ): Promise<{
    data: any[];
    total: number;
    totalAll: number; // 含 wait/hold 的总数
    skippedCount: number; // 被过滤掉的 wait/hold 数量
  }> {
    const db = this.prisma;

    const strategy = await db.aiStrategy.findFirst({
      where: { id: strategyId, userId },
      select: { id: true },
    });
    if (!strategy) throw new NotFoundException('策略不存在');

    const skip = (page - 1) * limit;

    // 注意：不在 DB 层做 JSON path 过滤（部分 PostgreSQL 版本会报错），改为取回后代码层过滤
    // 参考 getTimeline 相同处理方式
    const baseWhere: any = { strategyId };

    // 足量预取（保证第 N 页有数据），最多取 500 条避免内存压力
    const fetchLimit = Math.min(500, Math.max(skip + limit * 3, limit * 5));

    const [rawData, totalAll] = await Promise.all([
      db.aiStrategyLog.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        take: fetchLimit,
      }),
      db.aiStrategyLog.count({ where: baseWhere }),
    ]);

    // 代码层过滤 wait/hold（与 getTimeline 保持一致，避免 Prisma JSON path 兼容性问题）
    let filtered = rawData;
    if (actionsOnly) {
      filtered = rawData.filter(log => {
        const dec = (log.decision as Record<string, any>) || {};
        const act = dec.action || '';
        if (act === 'wait' || act === 'hold') return false;
        // grid_cycle 且 decisions 为空（0 操作）视为无操作，过滤掉
        if (act === 'grid_cycle' && Array.isArray(dec.decisions) && dec.decisions.length === 0) return false;
        return true;
      });
    }

    // 手动分页（在过滤后的结果上）
    const data = filtered.slice(skip, skip + limit);
    const total = filtered.length;

    return {
      data,
      total,
      totalAll,
      skippedCount: actionsOnly ? totalAll - total : 0,
    };
  }

  // ========================= 统一时间线 =========================

  /**
   * 跨策略/研究的统一时间线查询
   * 合并 AiStrategyLog + AiResearchSession，按时间倒序分页
   *
   * @param type 过滤类型: 'all' | 'solo' | 'debate' | 'research'
   */
  async getTimeline(
    userId: string,
    page: number = 1,
    limit: number = 10,
    type: string = 'all',
    actionsOnly: boolean = false,
  ): Promise<{ data: any[]; total: number; totalAll: number; skippedCount: number }> {
    const db = this.prisma;

    // 1. 查询用户所有策略（获取 id→meta 映射）
    const strategies = await db.aiStrategy.findMany({
      where: { userId },
      select: { id: true, name: true, tradingMode: true, strategyType: true, models: true },
    });
    const strategyMap = new Map(strategies.map((s) => [s.id, s]));
    const gridIds = strategies.filter((s) => s.strategyType === 'grid').map((s) => s.id);
    const gridIdSet = new Set(gridIds);
    const soloIds = strategies.filter((s) => s.tradingMode === 'solo' && !gridIdSet.has(s.id)).map((s) => s.id);
    const debateIds = strategies.filter((s) => s.tradingMode === 'debate').map((s) => s.id);

    // 2. 根据 type 过滤，并行查询
    const includeSolo = type === 'all' || type === 'solo';
    const includeDebate = type === 'all' || type === 'debate';
    const includeResearch = type === 'all' || type === 'research';
    const includeGrid = type === 'all' || type === 'grid';

    // 策略日志查询
    const logStrategyIds = [
      ...(includeSolo ? soloIds : []),
      ...(includeDebate ? debateIds : []),
      ...(includeGrid ? gridIds : []),
    ];

    // 注意：不在 DB 层做 JSON path 过滤（部分 PostgreSQL 版本会报错），代码层过滤
    const logBaseWhere: any = { strategyId: { in: logStrategyIds } };
    const researchBaseWhere: any = {
      userId,
      OR: [
        { rootSessionId: null, campaignStatus: null },
        { rootSessionId: { not: null } },
      ],
    };

    const [logs, logTotal, logTotalAll, sessions, sessionTotal, sessionTotalAll] = await Promise.all([
      logStrategyIds.length > 0
        ? db.aiStrategyLog.findMany({
            where: logBaseWhere,
            orderBy: { createdAt: 'desc' },
            take: limit * 5, // 多取，代码层过滤后截取
          })
        : Promise.resolve([]),
      logStrategyIds.length > 0
        ? db.aiStrategyLog.count({ where: logBaseWhere })
        : Promise.resolve(0),
      logStrategyIds.length > 0
        ? db.aiStrategyLog.count({ where: logBaseWhere })
        : Promise.resolve(0),
      includeResearch
        ? db.aiResearchSession.findMany({
            where: researchBaseWhere,
            orderBy: { createdAt: 'desc' },
            take: limit * 5, // 多取，代码层过滤后截取
            select: {
              id: true, symbol: true, depth: true, status: true,
              autoExecute: true, finalDecision: true, executedTradeId: true,
              totalCost: true, errorMessage: true, createdAt: true,
              cycleNumber: true, campaignStatus: true,
            },
          })
        : Promise.resolve([]),
      includeResearch
        ? db.aiResearchSession.count({ where: researchBaseWhere })
        : Promise.resolve(0),
      // 获取 research 未过滤总数（用于计算 skippedCount）
      includeResearch
        ? db.aiResearchSession.count({ where: researchBaseWhere })
        : Promise.resolve(0),
    ]);

    // 3. 转化为统一格式并合并排序
    const merged: Array<{ createdAt: Date; entry: any }> = [];
    let skippedLogCount = 0;
    let skippedSessionCount = 0;

    for (const log of logs as any[]) {
      const meta = strategyMap.get(log.strategyId);
      if (!meta) continue;
      // actionsOnly 代码层过滤（替代 DB JSON path 过滤，避免 PostgreSQL 版本兼容性问题）
      if (actionsOnly) {
        const dec = (log.decision as Record<string, any>) || {};
        const act = dec.action || '';
        if (act === 'wait' || act === 'hold') {
          skippedLogCount++;
          continue;
        }
        // grid_cycle 且 decisions 为空（0 操作）视为无操作
        if (act === 'grid_cycle' && Array.isArray(dec.decisions) && dec.decisions.length === 0) {
          skippedLogCount++;
          continue;
        }
      }
      const entryType = (meta as any).strategyType === 'grid' ? 'grid_log'
        : meta.tradingMode === 'debate' ? 'debate_log' : 'solo_log';
      merged.push({
        createdAt: new Date(log.createdAt),
        entry: {
          entryType,
          log,
          strategy: { id: meta.id, name: meta.name, tradingMode: meta.tradingMode, models: (meta as any).models as string[] | undefined },
        },
      });
    }

    for (const session of sessions as any[]) {
      // actionsOnly 代码层过滤研究会话
      if (actionsOnly) {
        const fd = (session.finalDecision as Record<string, any>) || {};
        const act = fd.action || '';
        if (act === 'wait' || act === 'hold') {
          skippedSessionCount++;
          continue;
        }
      }
      merged.push({
        createdAt: new Date(session.createdAt),
        entry: {
          entryType: 'research',
          session: { ...session, totalCost: Number(session.totalCost) || 0 },
        },
      });
    }

    // 按时间倒序排序
    merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // 4. 分页
    const total = logTotal + sessionTotal;
    const totalAll = actionsOnly ? (logTotalAll + sessionTotalAll) : total;
    const skip = (page - 1) * limit;
    const paged = merged.slice(skip, skip + limit);

    return {
      data: paged.map((m) => m.entry),
      total,
      totalAll,
      skippedCount: skippedLogCount + skippedSessionCount,
    };
  }

  // ========================= 日志清理 =========================

  /** 每个策略最多保留的日志条数（超出则删除最旧记录） */
  private static readonly MAX_LOGS_PER_STRATEGY = 500;

  /**
   * 清理策略的过期日志（分层保留）
   * - 有交易动作 (open_long/open_short/close_long/close_short): 90 天
   * - 无交易 (wait/hold): 7 天
   * - 数量上限: 最多保留 MAX_LOGS_PER_STRATEGY 条
   *
   * 触发时机: 由 AutoRunProcessor 在每次策略周期完成后调用（lazy cleanup）
   */
  async cleanOldLogs(strategyId: string): Promise<number> {
    const now = new Date();

    // 1. 所有日志: 90 天前全删
    const allCutoff = new Date(now);
    allCutoff.setDate(allCutoff.getDate() - 90);
    const r1 = await this.prisma.aiStrategyLog.deleteMany({
      where: { strategyId, createdAt: { lt: allCutoff } },
    });

    // 2. wait/hold 日志: 7 天前删
    const waitCutoff = new Date(now);
    waitCutoff.setDate(waitCutoff.getDate() - 7);
    const r2 = await this.prisma.aiStrategyLog.deleteMany({
      where: {
        strategyId,
        createdAt: { lt: waitCutoff },
        OR: [
          { decision: { path: ['action'], equals: 'wait' } },
          { decision: { path: ['action'], equals: 'hold' } },
        ],
      },
    });

    // 3. 数量上限: 保留最新 MAX_LOGS_PER_STRATEGY 条，删除超出的旧记录
    let r3Count = 0;
    const totalCount = await this.prisma.aiStrategyLog.count({ where: { strategyId } });
    if (totalCount > StrategyEngineService.MAX_LOGS_PER_STRATEGY) {
      // 找第 501 条（按时间倒序），其 createdAt 即为删除边界
      const anchor = await this.prisma.aiStrategyLog.findMany({
        where: { strategyId },
        orderBy: { createdAt: 'desc' },
        skip: StrategyEngineService.MAX_LOGS_PER_STRATEGY,
        take: 1,
        select: { createdAt: true },
      });
      if (anchor.length > 0) {
        const r3 = await this.prisma.aiStrategyLog.deleteMany({
          where: { strategyId, createdAt: { lte: anchor[0].createdAt } },
        });
        r3Count = r3.count;
      }
    }

    const total = r1.count + r2.count + r3Count;
    if (total > 0) {
      this.logger.log(
        `[清理] 策略 ${strategyId}: ${r1.count} 条过期(>90天) + ${r2.count} 条 wait/hold(>7天) + ${r3Count} 条超数量上限(>${StrategyEngineService.MAX_LOGS_PER_STRATEGY})`,
      );
    }
    return total;
  }

  /**
   * 每天凌晨 4 点全局清理过期 AI 日志
   * 覆盖已停止策略 + 研究记录 + 辩论会话
   *
   * 保留策略:
   * - 策略日志(有交易): 90 天
   * - 策略日志(wait/hold): 7 天
   * - 研究记录: 90 天
   * - 辩论会话: 90 天
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async globalLogCleanup(): Promise<void> {
    const now = new Date();
    this.logger.log('[Cron] 全局 AI 日志清理开始...');

    // 1. 策略日志: 90天前全删
    const allCutoff = new Date(now);
    allCutoff.setDate(allCutoff.getDate() - 90);
    const r1 = await this.prisma.aiStrategyLog.deleteMany({
      where: { createdAt: { lt: allCutoff } },
    });

    // 2. 策略日志: 7天前 wait/hold
    const waitCutoff = new Date(now);
    waitCutoff.setDate(waitCutoff.getDate() - 7);
    const r2 = await this.prisma.aiStrategyLog.deleteMany({
      where: {
        createdAt: { lt: waitCutoff },
        OR: [
          { decision: { path: ['action'], equals: 'wait' } },
          { decision: { path: ['action'], equals: 'hold' } },
        ],
      },
    });

    // 3. 研究记录: 90天前
    const r3 = await this.prisma.aiResearchSession.deleteMany({
      where: { createdAt: { lt: allCutoff } },
    });

    // 4. 辩论会话: 90天前
    const r4 = await this.prisma.aiDebateSession.deleteMany({
      where: { createdAt: { lt: allCutoff } },
    });

    // 5. 全策略数量上限（覆盖已停止策略，cleanOldLogs 仅在运行中的策略周期触发）
    const allStrategies = await this.prisma.aiStrategy.findMany({ select: { id: true } });
    let r5Count = 0;
    for (const strategy of allStrategies) {
      const cnt = await this.prisma.aiStrategyLog.count({ where: { strategyId: strategy.id } });
      if (cnt > StrategyEngineService.MAX_LOGS_PER_STRATEGY) {
        const anchor = await this.prisma.aiStrategyLog.findMany({
          where: { strategyId: strategy.id },
          orderBy: { createdAt: 'desc' },
          skip: StrategyEngineService.MAX_LOGS_PER_STRATEGY,
          take: 1,
          select: { createdAt: true },
        });
        if (anchor.length > 0) {
          const del = await this.prisma.aiStrategyLog.deleteMany({
            where: { strategyId: strategy.id, createdAt: { lte: anchor[0].createdAt } },
          });
          r5Count += del.count;
        }
      }
    }

    this.logger.log(
      `[Cron] 清理完成: 策略(>90天)=${r1.count}, wait/hold(>7天)=${r2.count}, 研究(>90天)=${r3.count}, 辩论(>90天)=${r4.count}, 超数量上限=${r5Count}`,
    );
  }

  // ========================= BullMQ 调度 =========================

  /**
   * 添加策略定时任务
   */
  private async addStrategyJob(
    strategyId: string,
    userId: string,
    intervalMs: number,
    runImmediately = true,
  ): Promise<void> {
    // 先清理旧任务
    await this.removeStrategyJob(strategyId);

    // 立即触发一次（不重复）：让策略启动/恢复后无需等待第一个周期
    if (runImmediately) {
      await this.autoQueue.add(
        'strategy-cycle',
        { strategyId, userId },
        { removeOnComplete: 1, removeOnFail: 1 },
      );
    }

    // 周期性重复任务
    await this.autoQueue.add(
      'strategy-cycle',
      { strategyId, userId },
      {
        repeat: { every: intervalMs },
        jobId: `ai-strategy-${strategyId}`,
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    );
  }

  /**
   * 移除策略定时任务
   *
   * BullMQ 5.x 的 repeatable job key 是 md5(name:jobId:::every) 的哈希值。
   * 当 every（间隔）变化时会产生不同的 key，导致旧 job 残留。
   *
   * 方案: 用 removeRepeatable(name, repeatOpts, jobId) 尝试已知的所有间隔，
   * 如果失败则 fallback 到遍历全部 repeatable jobs 按 name 匹配清理。
   */
  async removeStrategyJob(strategyId: string): Promise<void> {
    const jobId = `ai-strategy-${strategyId}`;
    try {
      // 方案 1: 尝试用 removeRepeatable 精确移除（需要知道 every 值）
      // 尝试所有可能的间隔 (5min ~ 24h)
      // 方案 1: removeRepeatable(name, repeatOpts, jobId)
      // 注意: jobId 必须作为第 3 参数，不能放入 repeatOpts！
      // BullMQ 内部 Object.assign({...repeat}, {jobId}) 会用第 3 参数覆盖
      const possibleIntervals = [3, 5, 10, 15, 30, 60, 120, 240, 480, 720, 1440];
      for (const minutes of possibleIntervals) {
        try {
          await this.autoQueue.removeRepeatable('strategy-cycle', {
            every: minutes * 60 * 1000,
          }, jobId);
        } catch {
          // 该间隔不存在，继续尝试下一个
        }
      }

      // 方案 2: 遍历所有 repeatable jobs，按 name + id 精确匹配清理（不依赖白名单）
      const remaining = await this.autoQueue.getRepeatableJobs();
      const leftover = remaining.filter(
        (j) => j.name === 'strategy-cycle' && (j.id === jobId || j.key.includes(jobId)),
      );
      if (leftover.length > 0) {
        this.logger.warn(`[策略] 清理后仍有 ${leftover.length} 个残留 job (${jobId})，尝试 removeRepeatableByKey`);
        for (const job of leftover) {
          try {
            await this.autoQueue.removeRepeatableByKey(job.key);
            this.logger.debug(`[策略] fallback 移除: ${job.key} (every=${job.every})`);
          } catch {
            // ignore
          }
        }
      }
    } catch (error) {
      this.logger.error(`[策略] 移除定时任务失败: ${strategyId} - ${error.message}`);
    }
  }

  /**
   * 启动时持仓快照
   *
   * 遍历所有活跃策略的交易所连接，对比交易所实际持仓与 DB 记录:
   * - 交易所有但 DB 无 → 创建 Position (source: 'snapshot')
   * - DB 有但交易所无 → 标记 closed (closeReason: 'not_found_on_exchange')
   */
  private async snapshotPositionsOnStartup(): Promise<void> {
    if (!this.adapterFactory) {
      this.logger.debug('[快照] AdapterFactory 不可用，跳过持仓快照');
      return;
    }

    try {
      const db = this.prisma;

      // 查询所有活跃策略的 userId + exchangeApiKeyId
      const activeStrategies = await db.aiStrategy.findMany({
        where: { isActive: true },
        select: { userId: true, id: true, coinSourceConfig: true, strategyType: true, gridRuntimeState: true },
      });

      if (activeStrategies.length === 0) return;

      // 获取每个用户的 AI 配置（含 exchangeApiKeyId）
      const userIds = [...new Set(activeStrategies.map((s) => s.userId))];
      const aiConfigs = await db.aiConfig.findMany({
        where: { userId: { in: userIds }, exchangeApiKeyId: { not: null } },
        select: { userId: true, exchangeApiKeyId: true },
      });

      // 按 userId+apiKeyId 去重
      const seen = new Set<string>();
      const uniquePairs: Array<{ userId: string; apiKeyId: string }> = [];
      for (const cfg of aiConfigs) {
        if (!cfg.exchangeApiKeyId) continue;
        const key = `${cfg.userId}:${cfg.exchangeApiKeyId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        uniquePairs.push({ userId: cfg.userId, apiKeyId: cfg.exchangeApiKeyId });
      }

      if (uniquePairs.length === 0) return;

      let synced = 0;
      let created = 0;
      let closed = 0;

      for (const { userId, apiKeyId } of uniquePairs) {
        try {
          const adapter = await this.adapterFactory!.createAdapter(userId, apiKeyId);

          // 获取交易所实际持仓
          const exchangePositions = await adapter.getPositions();

          // 获取 DB 中的 open 持仓
          const dbPositions = await db.position.findMany({
            where: {
              userId,
              status: 'open',
              source: { in: ['ai_research', 'ai_strategy'] },
            },
          });

          // 交易所有但 DB 无 → 创建快照持仓；DB 有且交易所有 → 更新 amount（防止网格累积后 DB 过时）
          for (const ep of exchangePositions) {
            const matched = dbPositions.find(
              (dp) => dp.symbol === ep.symbol && dp.side === ep.side,
            );
            if (!matched) {
              // 尝试匹配活跃策略：按 userId + symbol 查找
              const baseCoin = ep.symbol.split('/')[0]; // "DOGE/USDT:USDT" → "DOGE"
              const matchedStrategy = activeStrategies.find((s) => {
                if (s.userId !== userId) return false;
                const cfg = s.coinSourceConfig as { coins?: string[] };
                return cfg?.coins?.some((c: string) => c.includes(baseCoin));
              });

              await db.position.create({
                data: {
                  userId,
                  exchange: adapter.exchangeType,
                  symbol: ep.symbol,
                  side: ep.side,
                  entryPrice: ep.entryPrice,
                  amount: ep.quantity,
                  margin: ep.margin,
                  leverage: ep.leverage,
                  unrealizedPnl: ep.unrealizedPnl,
                  status: 'open',
                  source: 'ai_strategy',
                  apiKeyId,
                  ...(matchedStrategy ? { aiStrategyId: matchedStrategy.id } : {}),
                },
              });
              created++;
              this.logger.log(
                `[快照] 创建遗失持仓: ${ep.symbol} ${ep.side} qty=${ep.quantity} user=${userId}` +
                (matchedStrategy ? ` → 关联策略 ${matchedStrategy.id}` : ''),
              );
            } else {
              // DB 有且交易所有 → 同步最新 amount/entryPrice/unrealizedPnl，避免网格累积后 DB 量过时
              await db.position.update({
                where: { id: matched.id },
                data: {
                  amount: ep.quantity,
                  entryPrice: ep.entryPrice,
                  unrealizedPnl: ep.unrealizedPnl,
                  lastSyncAt: new Date(),
                },
              });
            }
          }

          // DB 有但交易所无 → 标记关闭（仅从交易所 fills 取实际 PnL，不估算）
          for (const dp of dbPositions) {
            const matched = exchangePositions.find(
              (ep) => ep.symbol === dp.symbol && ep.side === dp.side,
            );
            if (!matched) {
              let exchangePnl: number | undefined;
              let closePrice: number | undefined;

              // 从交易所 fills 获取实际 PnL（Binance: info.realizedPnl，OKX: info.pnl）
              try {
                const since = dp.createdAt ? new Date(dp.createdAt).getTime() : Date.now() - 24 * 60 * 60 * 1000;
                const fills = await adapter.fetchMyTrades(dp.symbol, since, 200);
                // 平仓方向：多头用 sell 成交，空头用 buy 成交
                const closingSide = dp.side === 'long' ? 'sell' : 'buy';
                const closingFills = fills.filter((f: any) => f.side === closingSide);
                if (closingFills.length > 0) {
                  const totalPnl = closingFills.reduce((sum: number, f: any) => {
                    return sum + Number(f.info?.realizedPnl ?? f.info?.pnl ?? 0);
                  }, 0);
                  if (totalPnl !== 0) exchangePnl = totalPnl;
                  closePrice = Number(closingFills[closingFills.length - 1].price);
                }
              } catch {
                this.logger.warn(`[快照] 无法获取 ${dp.symbol} fills，PnL 未写入`);
              }

              await db.position.update({
                where: { id: dp.id },
                data: {
                  status: 'closed',
                  closeReason: 'not_found_on_exchange',
                  closedAt: new Date(),
                  ...(closePrice != null ? {
                    closePrice: closePrice.toFixed(8),
                    exitPrice: closePrice.toFixed(8),
                  } : {}),
                  ...(exchangePnl != null ? {
                    pnl: exchangePnl.toFixed(8),
                    realizedPnl: exchangePnl.toFixed(8),
                  } : {}),
                },
              });
              closed++;
              this.logger.log(
                `[快照] 关闭遗失持仓: ${dp.symbol} ${dp.side} id=${dp.id}` +
                (exchangePnl != null ? ` PnL=$${exchangePnl.toFixed(4)}(交易所)` : ' (PnL未获取)'),
              );

            }
          }

          synced++;
          await adapter.dispose();
        } catch (e: any) {
          this.logger.warn(
            `[快照] 用户 ${userId} 持仓同步失败: ${e.message}`,
          );
          // 单个 adapter 失败不阻断整体
        }
      }

      this.logger.log(
        `[快照] 持仓快照完成: ${synced} 交易所同步, 新建 ${created} 持仓, 关闭 ${closed} 持仓`,
      );
    } catch (e: any) {
      this.logger.error(`[快照] 持仓快照异常: ${e.message}`);
    }
  }

  /**
   * R2: 单用户持仓同步（可由 auto-trader 每周期调用）
   *
   * 交易所 vs DB 持仓对比:
   * - 交易所有 DB 无 → 创建 Position
   * - DB 有交易所无 → 标记 closed
   */
  async syncPositionsForUser(
    userId: string,
    apiKeyId: string,
    strategyId?: string,
    existingAdapter?: any,
  ): Promise<{ created: number; closed: number; exchangePositions: any[] }> {
    if (!this.adapterFactory && !existingAdapter) {
      return { created: 0, closed: 0, exchangePositions: [] };
    }

    let created = 0;
    let closed = 0;
    let liveExchangePositions: any[] = [];

    const ownsAdapter = !existingAdapter;
    const adapter = existingAdapter ?? await this.adapterFactory!.createAdapter(userId, apiKeyId);
    try {
      const exchangePositions = await adapter.getPositions();
      liveExchangePositions = exchangePositions;
      const dbPositions = await this.prisma.position.findMany({
        where: {
          userId,
          status: 'open',
          source: { in: ['ai_research', 'ai_strategy'] },
          // 隔离：按策略过滤，防止跨策略持仓污染
          ...(strategyId ? { aiStrategyId: strategyId } : {}),
        },
      });

      // 对齐 nofx: 只更新已有记录，不创建新记录
      // 持仓创建的唯一入口是 ai-execution.openPosition()
      for (const ep of exchangePositions) {
        const matched = dbPositions.find(
          (dp) => dp.symbol === ep.symbol && dp.side === ep.side,
        );
        if (matched) {
          // 对齐 nofx: 只更新实时行情数据（unrealizedPnl/markPrice），不覆盖 entryPrice/amount
          // nofx 的 entryPrice 只在 OrderSync→ProcessTrade（开仓成交）时写入，
          // getPositions() 返回的 entryPrice 是交易所的加权均价（含加仓），会覆盖精确的开仓价导致 PnL 计算错误
          await this.prisma.position.update({
            where: { id: matched.id },
            data: {
              unrealizedPnl: ep.unrealizedPnl,
              markPrice: ep.markPrice,
              lastSyncAt: new Date(),
            },
          });
        }
        // 交易所有 DB 无 → 不创建（由 ai-execution 负责创建）
      }

      // 对齐 nofx OrderSync: DB open 但交易所无 → 标记 closed
      // nofx 通过 SyncOrdersFromBinance → ProcessTrade(close_long/close_short) 自动关闭
      // HOOT 等价：检测交易所已平仓（SL/TP 条件单触发），标记 DB closed
      const exchangeSymbolSides = new Set(
        exchangePositions.map((ep: any) => `${ep.symbol}::${ep.side}`),
      );
      for (const dbPos of dbPositions) {
        const key = `${dbPos.symbol}::${dbPos.side}`;
        if (!exchangeSymbolSides.has(key)) {
          // 交易所接口正常返回但找不到此仓 = 已被条件单平仓
          closed++;
          await this.prisma.position.update({
            where: { id: dbPos.id },
            data: {
              status: 'closed',
              closedAt: new Date(),
              closeReason: 'not_found_on_exchange',
            },
          });
          this.logger.warn(
            `[持仓同步] ${dbPos.symbol} ${dbPos.side} 交易所已无持仓（SL/TP 条件单触发），标记 closed`,
          );
        }
      }

      if (created > 0 || closed > 0) {
        this.logger.log(`[持仓同步] user=${userId}: 新建${created}, 关闭${closed}`);
      }
    } finally {
      if (ownsAdapter) await adapter.dispose();
    }

    return { created, closed, exchangePositions: liveExchangePositions };
  }

  /**
   * 服务启动时恢复所有运行中的策略
   */
  private async restoreActiveStrategies(): Promise<void> {
    try {
      const db = this.prisma;
      const activeStrategies = await db.aiStrategy.findMany({
        where: { isActive: true },
      });

      if (activeStrategies.length === 0) {
        this.logger.log('[策略] 无运行中的策略需要恢复');
        return;
      }

      let restored = 0;
      for (const strategy of activeStrategies) {
        try {
          const intervalMs = Math.max(3, strategy.intervalMinutes || 60) * 60 * 1000;
          // VPS 重启后强制 reconcile：清除内存状态，让 runGridCycle 冷启动（同 startStrategy 路径）
          this.gridTrading?.clearGridState(strategy.id);
          await this.addStrategyJob(strategy.id, strategy.userId, intervalMs);
          restored++;
        } catch (error) {
          this.logger.error(`[策略] 恢复失败: ${strategy.id} - ${error.message}`);
        }
      }

      this.logger.log(`[策略] 恢复完成: ${restored}/${activeStrategies.length} 个策略`);
    } catch (error) {
      this.logger.error(`[策略] 恢复策略失败: ${error.message}`);
    }
  }
}
