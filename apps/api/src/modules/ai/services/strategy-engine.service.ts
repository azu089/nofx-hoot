import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';

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
  ) {}

  async onModuleInit(): Promise<void> {
    await this.restoreActiveStrategies();
  }

  // ========================= CRUD =========================

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
  }): Promise<any> {
    const db = this.prisma;

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
        isActive: false,
      },
    });

    this.logger.log(`[策略] 创建: ${strategy.id} (${data.name}) for user ${userId}`);
    return strategy;
  }

  async getStrategy(strategyId: string, userId: string): Promise<any> {
    const db = this.prisma;
    const strategy = await db.aiStrategy.findFirst({
      where: { id: strategyId, userId },
    });
    if (!strategy) throw new NotFoundException('策略不存在');
    return strategy;
  }

  async listStrategies(userId: string, page: number = 1, limit: number = 20): Promise<{
    data: any[];
    total: number;
  }> {
    const db = this.prisma;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      db.aiStrategy.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.aiStrategy.count({ where: { userId } }),
    ]);

    return { data, total };
  }

  async updateStrategy(strategyId: string, userId: string, data: Record<string, any>): Promise<any> {
    const db = this.prisma;

    // 验证策略存在且属于该用户
    const existing = await db.aiStrategy.findFirst({
      where: { id: strategyId, userId },
    });
    if (!existing) throw new NotFoundException('策略不存在');

    // 白名单过滤可更新字段
    const allowed = [
      'name', 'tradingMode', 'coinSourceConfig', 'indicatorConfig',
      'riskControlConfig', 'promptSections', 'gridConfig',
      'intervalMinutes', 'isPublic',
      'exchangeApiKeyId', 'apiKeys', 'models',
    ];

    const updateData: Record<string, any> = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        updateData[key] = data[key];
      }
    }

    const updated = await db.aiStrategy.update({
      where: { id: strategyId },
      data: updateData,
    });

    this.logger.log(`[策略] 更新: ${strategyId}`);
    return updated;
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

    const strategy = await db.aiStrategy.findFirst({
      where: { id: strategyId, userId },
    });
    if (!strategy) throw new NotFoundException('策略不存在');

    if (strategy.isActive) {
      throw new BadRequestException('策略已在运行中');
    }

    // 激活策略
    const updated = await db.aiStrategy.update({
      where: { id: strategyId },
      data: { isActive: true },
    });

    // 注册定时任务到 BullMQ（strategy-cycle 类型）
    const intervalMs = (strategy.intervalMinutes || 60) * 60 * 1000;
    await this.addStrategyJob(strategyId, userId, intervalMs);

    this.logger.log(
      `[策略] 启动: ${strategyId}, 间隔 ${strategy.intervalMinutes || 60}min`,
    );

    return updated;
  }

  async stopStrategy(strategyId: string, userId: string): Promise<any> {
    const db = this.prisma;

    const strategy = await db.aiStrategy.findFirst({
      where: { id: strategyId, userId },
    });
    if (!strategy) throw new NotFoundException('策略不存在');

    // 停止定时任务
    await this.removeStrategyJob(strategyId);

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

    // 暂停: 停止定时任务但不改 isActive
    await this.removeStrategyJob(strategyId);

    // 设置恢复时间
    const resumeAt = new Date(Date.now() + minutes * 60 * 1000);

    this.logger.log(
      `[策略] 暂停: ${strategyId}, ${minutes} 分钟后恢复 (${resumeAt.toISOString()})`,
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

  async getStrategyLogs(strategyId: string, userId: string, page: number = 1, limit: number = 20): Promise<{
    data: any[];
    total: number;
  }> {
    const db = this.prisma;

    // 先验证策略属于用户
    const strategy = await db.aiStrategy.findFirst({
      where: { id: strategyId, userId },
      select: { id: true },
    });
    if (!strategy) throw new NotFoundException('策略不存在');

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      db.aiStrategyLog.findMany({
        where: { strategyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.aiStrategyLog.count({ where: { strategyId } }),
    ]);

    return { data, total };
  }

  // ========================= BullMQ 调度 =========================

  /**
   * 添加策略定时任务
   */
  private async addStrategyJob(
    strategyId: string,
    userId: string,
    intervalMs: number,
  ): Promise<void> {
    // 先清理旧任务
    await this.removeStrategyJob(strategyId);

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
  private async removeStrategyJob(strategyId: string): Promise<void> {
    const jobId = `ai-strategy-${strategyId}`;
    try {
      // 方案 1: 尝试用 removeRepeatable 精确移除（需要知道 every 值）
      // 尝试所有可能的间隔 (5min ~ 24h)
      // 方案 1: removeRepeatable(name, repeatOpts, jobId)
      // 注意: jobId 必须作为第 3 参数，不能放入 repeatOpts！
      // BullMQ 内部 Object.assign({...repeat}, {jobId}) 会用第 3 参数覆盖
      const possibleIntervals = [5, 10, 15, 30, 60, 120, 240, 480, 720, 1440];
      for (const minutes of possibleIntervals) {
        try {
          await this.autoQueue.removeRepeatable('strategy-cycle', {
            every: minutes * 60 * 1000,
          }, jobId);
        } catch {
          // 该间隔不存在，继续尝试下一个
        }
      }

      // 方案 2: 验证清理结果（只清理当前策略的残留 job，不影响其他策略）
      const remaining = await this.autoQueue.getRepeatableJobs();
      const leftover = remaining.filter(
        (j) => j.name === 'strategy-cycle' && j.key.includes(jobId),
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
          const intervalMs = (strategy.intervalMinutes || 60) * 60 * 1000;
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
