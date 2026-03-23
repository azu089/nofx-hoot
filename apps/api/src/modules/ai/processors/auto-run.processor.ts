import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { AutoTraderService } from '../services/trading/auto-trader.service';
import { EvolutionService } from '../services/evolution.service';
import { StrategyEngineService } from '../services/trading/strategy-engine.service';
import { ResearchCycleService } from '../services/research/research-cycle.service';

/**
 * AI 自动运行任务处理器
 *
 * 处理三种任务:
 * 1. 'strategy-cycle' — 产品 B 策略定时循环（由 StrategyEngine 注册）
 * 2. 'research-cycle' — 产品 A 研究自动循环（由 ResearchCycleService 注册）
 * 3. 'auto-run' — 全局自动运行（AiConfig 级别，遍历所有交易对）
 */
// 对齐 nofx: 单线程串行执行，同一时间只处理一个策略周期
// nofx 用 for-select-ticker 单 goroutine 模式，不可能并行
// HOOT 用 BullMQ，concurrency=1 确保串行（积压的 job 排队等待）
@Processor('ai-auto', { concurrency: 1 })
export class AutoRunProcessor extends WorkerHost {
  private readonly logger = new Logger(AutoRunProcessor.name);
  private consecutiveFailures = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly autoTrader: AutoTraderService,
    private readonly evolutionService: EvolutionService,
    private readonly strategyEngine: StrategyEngineService,
    private readonly researchCycleService: ResearchCycleService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const jobName = job.name;

    if (jobName === 'strategy-cycle') {
      return this.processStrategyCycle(job);
    }

    if (jobName === 'research-cycle') {
      return this.processResearchCycle(job);
    }

    // 兼容旧的 auto-run 任务
    return this.processAutoRun(job);
  }

  /**
   * 处理产品 A 研究循环任务
   */
  private async processResearchCycle(
    job: Job<{ rootSessionId: string; userId: string }>,
  ): Promise<void> {
    const { rootSessionId } = job.data;
    this.logger.log(`[研究循环] 触发: rootSession=${rootSessionId}`);

    try {
      await this.researchCycleService.runNextCycle(rootSessionId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      this.logger.error(`[研究循环] 失败: rootSession=${rootSessionId} - ${msg}`);
    }
  }

  /**
   * 处理产品 B 策略周期任务
   */
  private async processStrategyCycle(
    job: Job<{ strategyId: string; userId: string }>,
  ): Promise<{ analyzed: number; executed: number; errors: number }> {
    const { strategyId, userId } = job.data;

    // 策略已停止时（如GAS耗尽被自动停止）直接跳过，不发起 LLM 调用
    const strategy = await this.prisma.aiStrategy.findUnique({
      where: { id: strategyId },
      select: { isActive: true },
    });
    if (!strategy?.isActive) {
      this.logger.debug(`[策略周期] 跳过: 策略=${strategyId} 已停止`);
      return { analyzed: 0, executed: 0, errors: 0 };
    }

    this.logger.log(`[策略周期] 开始: 策略=${strategyId}, 用户=${userId}`);

    try {
      const result = await this.autoTrader.runCycle(strategyId);

      this.logger.log(
        `[策略周期] 完成: 策略=${strategyId}, 分析=${result.analyzed}, 执行=${result.executed}, 错误=${result.errors}, 耗时=${result.totalLatencyMs}ms`,
      );

      // 周期完成后 lazy 清理过期日志（交易90天 + wait/hold 7天）
      await this.strategyEngine.cleanOldLogs(strategyId).catch(() => {});

      return {
        analyzed: result.analyzed,
        executed: result.executed,
        errors: result.errors,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      this.logger.error(`[策略周期] 失败: 策略=${strategyId} - ${msg}`);

      return { analyzed: 0, executed: 0, errors: 1 };
    }
  }

  /**
   * 处理全局自动运行任务（AiConfig 级别）
   */
  private async processAutoRun(
    job: Job<{ userId: string }>,
  ): Promise<{ analyzed: number; executed: number; errors: number }> {
    const { userId } = job.data;

    // 1. 获取用户配置
    const config = await this.prisma.aiConfig.findUnique({ where: { userId } });
    if (!config || !config.autoEnabled) {
      this.logger.debug(`[自动运行] 用户 ${userId} 已停止，跳过`);
      return { analyzed: 0, executed: 0, errors: 0 };
    }

    // 2. 更新进化状态
    const evolution = await this.evolutionService.updateEvolution(userId);
    if (evolution.tier === 0) {
      this.logger.warn(`[自动运行] 用户 ${userId} Sharpe 过低 (${evolution.sharpe}), 自动暂停`);
      await this.prisma.aiConfig.update({
        where: { userId },
        data: {
          autoEnabled: false,
          autoStatus: 'paused',
          autoStatusReason: `Sharpe Ratio 过低 (${evolution.sharpe?.toFixed(2) || 'N/A'})，系统自动暂停`,
        },
      });
      return { analyzed: 0, executed: 0, errors: 0 };
    }

    // 3. 查找用户的所有活跃策略并逐一运行
    const strategies = await this.prisma.aiStrategy.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    let totalAnalyzed = 0;
    let totalExecuted = 0;
    let totalErrors = 0;

    for (const strategy of strategies) {
      try {
        const result = await this.autoTrader.runCycle(strategy.id);
        totalAnalyzed += result.analyzed;
        totalExecuted += result.executed;
        totalErrors += result.errors;
      } catch (error) {
        totalErrors++;
        const msg = error instanceof Error ? error.message : '未知错误';
        this.logger.error(`[自动运行] 策略 ${strategy.id} 失败: ${msg}`);
      }
    }

    // 4. 更新 lastAutoRunAt
    await this.prisma.aiConfig.update({
      where: { userId },
      data: { lastAutoRunAt: new Date() },
    });

    // 5. 连续失败检查
    if (totalErrors > 0 && totalAnalyzed === 0) {
      const failures = (this.consecutiveFailures.get(userId) || 0) + 1;
      this.consecutiveFailures.set(userId, failures);

      if (failures >= 3) {
        this.logger.warn(`[自动运行] 用户 ${userId} 连续 ${failures} 次失败，自动暂停`);
        await this.prisma.aiConfig.update({
          where: { userId },
          data: {
            autoEnabled: false,
            autoStatus: 'paused',
            autoStatusReason: `连续 ${failures} 次分析全部失败，系统自动暂停`,
          },
        });
        this.consecutiveFailures.delete(userId);
      }
    } else {
      this.consecutiveFailures.set(userId, 0);
    }

    this.logger.log(
      `[自动运行] 用户 ${userId} 完成: ${totalAnalyzed} 分析, ${totalExecuted} 执行, ${totalErrors} 错误`,
    );
    return { analyzed: totalAnalyzed, executed: totalExecuted, errors: totalErrors };
  }
}
