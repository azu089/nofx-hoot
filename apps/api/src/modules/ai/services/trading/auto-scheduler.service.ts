import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../../prisma/prisma.service';

/**
 * AI 自动交易调度器
 * 管理每个用户的 BullMQ 定时任务，定期触发 AI 分析与交易
 *
 * 服务启动时自动恢复所有 running 状态的自动交易任务
 * + 注册回撤监控定时任务（每 60 秒）
 */
@Injectable()
export class AutoSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AutoSchedulerService.name);

  constructor(
    @InjectQueue('ai-auto') private readonly autoQueue: Queue,
    @InjectQueue('ai-monitor') private readonly monitorQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 模块初始化时恢复所有运行中的自动交易任务 + 注册回撤监控
   */
  async onModuleInit(): Promise<void> {
    try {
      const restored = await this.restoreAutoRuns();
      if (restored > 0) {
        this.logger.log(`[OnModuleInit] 已恢复 ${restored} 个自动交易任务`);
      }
    } catch (error) {
      this.logger.error(`[OnModuleInit] 恢复自动交易失败: ${error.message}`);
    }

    // 注册回撤监控 repeatable job（每 60 秒检查一次）
    // 参考 NoFx startDrawdownMonitor() — 独立于分析周期的高频仓位保护
    await this.registerDrawdownMonitor();
  }

  /**
   * 注册回撤监控定时任务
   *
   * DrawdownMonitorProcessor 已实现完整的回撤检查逻辑（盈利>5% 且回撤≥40% 自动平仓），
   * 但此前没有任何代码往 ai-monitor 队列添加 repeatable job，导致该处理器从未运行。
   * 此方法补上这个关键调度缺口。
   */
  private async registerDrawdownMonitor(): Promise<void> {
    const jobId = 'ai-drawdown-monitor';
    try {
      // 先清理可能存在的旧任务（防止重复注册）
      try {
        await this.monitorQueue.removeRepeatable('drawdown-check', { every: 60_000 }, jobId);
      } catch {
        // 旧任务不存在，忽略
      }

      // 注册每 60 秒执行一次
      await this.monitorQueue.add('drawdown-check', {}, {
        repeat: { every: 60_000 },
        jobId,
        removeOnComplete: 10,
        removeOnFail: 5,
      });

      this.logger.log('[监控] 回撤监控已注册 (每 60 秒)');
    } catch (error) {
      this.logger.error(`[监控] 注册回撤监控失败: ${error.message}`);
    }
  }

  /**
   * 启动用户的自动交易
   * @param userId 用户 ID
   * @returns 启动结果
   */
  async startAutoRun(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      // 获取 AI 配置
      const config = await this.prisma.aiConfig.findUnique({
        where: { userId },
      });

      // 前置条件检查
      if (!config || !config.isEnabled) {
        return { success: false, message: '请先启用 AI 交易' };
      }

      if (!config.apiKeys || Object.keys(config.apiKeys as object).length === 0) {
        return { success: false, message: '请先配置 LLM API Key' };
      }

      if (!config.exchangeApiKeyId) {
        return { success: false, message: '请先绑定交易所 API Key' };
      }

      const symbols = config.symbols as string[];
      if (!symbols || symbols.length === 0) {
        return { success: false, message: '请至少配置一个交易对' };
      }

      if (config.evolutionTier <= 0) {
        return { success: false, message: 'AI 因表现不佳已暂停，请等待改善或手动重置' };
      }

      if (config.autoStatus === 'running') {
        return { success: false, message: '自动交易已在运行中' };
      }

      // 根据第一个时间周期计算重复间隔
      const timeframes = config.timeframes as string[];
      const firstTimeframe = timeframes && timeframes.length > 0 ? timeframes[0] : '1h';

      let interval: number;
      let intervalDesc: string;

      switch (firstTimeframe) {
        case '1h':
          interval = 15 * 60 * 1000; // 15 分钟
          intervalDesc = '每 15 分钟';
          break;
        case '4h':
          interval = 60 * 60 * 1000; // 60 分钟
          intervalDesc = '每小时';
          break;
        case '1d':
          interval = 4 * 60 * 60 * 1000; // 4 小时
          intervalDesc = '每 4 小时';
          break;
        case '1w':
          interval = 24 * 60 * 60 * 1000; // 24 小时
          intervalDesc = '每天';
          break;
        default:
          interval = 60 * 60 * 1000; // 默认 60 分钟
          intervalDesc = '每小时';
      }

      // 清理可能存在的旧任务
      await this.removeUserRepeatableJobs(userId);

      // 添加定时任务
      await this.autoQueue.add(
        'auto-analyze',
        { userId },
        {
          repeat: { every: interval },
          jobId: `ai-auto-${userId}`,
          removeOnComplete: 50,
          removeOnFail: 20,
        },
      );

      // 更新配置状态
      await this.prisma.aiConfig.update({
        where: { userId },
        data: {
          autoEnabled: true,
          autoStatus: 'running',
          autoStatusReason: null,
        },
      });

      this.logger.log(`启动自动交易成功 - 用户: ${userId}, 间隔: ${intervalDesc}`);

      return {
        success: true,
        message: `自动交易已启动，${intervalDesc}分析一次`,
      };
    } catch (error) {
      this.logger.error(`启动自动交易失败 - 用户: ${userId}`, error.stack);
      return { success: false, message: '启动失败，请稍后重试' };
    }
  }

  /**
   * 停止用户的自动交易
   * @param userId 用户 ID
   * @param reason 停止原因（可选）
   * @returns 停止结果
   */
  async stopAutoRun(userId: string, reason?: string): Promise<{ success: boolean }> {
    try {
      // 移除所有该用户的定时任务
      await this.removeUserRepeatableJobs(userId);

      // 更新配置状态
      await this.prisma.aiConfig.update({
        where: { userId },
        data: {
          autoEnabled: false,
          autoStatus: reason ? 'paused' : 'stopped',
          autoStatusReason: reason || null,
        },
      });

      this.logger.log(`停止自动交易成功 - 用户: ${userId}, 原因: ${reason || '手动停止'}`);

      return { success: true };
    } catch (error) {
      this.logger.error(`停止自动交易失败 - 用户: ${userId}`, error.stack);
      return { success: false };
    }
  }

  /**
   * 获取用户自动交易状态
   * @param userId 用户 ID
   * @returns 状态信息
   */
  async getAutoRunStatus(userId: string): Promise<{
    enabled: boolean;
    status: string;
    reason: string | null;
    lastRunAt: string | null;
    evolutionTier: number;
    rollingSharpe: number | null;
    mode: string;
  }> {
    const config = await this.prisma.aiConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      return {
        enabled: false,
        status: 'stopped',
        reason: null,
        lastRunAt: null,
        evolutionTier: 0,
        rollingSharpe: null,
        mode: 'quick',
      };
    }

    return {
      enabled: config.autoEnabled,
      status: config.autoStatus,
      reason: config.autoStatusReason,
      lastRunAt: config.lastAutoRunAt ? config.lastAutoRunAt.toISOString() : null,
      evolutionTier: config.evolutionTier,
      rollingSharpe: config.rollingSharpe ? parseFloat(config.rollingSharpe.toString()) : null,
      mode: config.mode,
    };
  }

  /**
   * 恢复所有运行中的自动交易
   * 用于服务重启时恢复状态
   * @returns 恢复的任务数量
   */
  async restoreAutoRuns(): Promise<number> {
    try {
      // 查询所有运行中的配置
      const runningConfigs = await this.prisma.aiConfig.findMany({
        where: { autoStatus: 'running' },
      });

      let restored = 0;

      for (const config of runningConfigs) {
        try {
          // 计算重复间隔
          const timeframes = config.timeframes as string[];
          const firstTimeframe = timeframes && timeframes.length > 0 ? timeframes[0] : '1h';

          let interval: number;

          switch (firstTimeframe) {
            case '1h':
              interval = 15 * 60 * 1000;
              break;
            case '4h':
              interval = 60 * 60 * 1000;
              break;
            case '1d':
              interval = 4 * 60 * 60 * 1000;
              break;
            case '1w':
              interval = 24 * 60 * 60 * 1000;
              break;
            default:
              interval = 60 * 60 * 1000;
          }

          // 重新注册定时任务
          await this.autoQueue.add(
            'auto-analyze',
            { userId: config.userId },
            {
              repeat: { every: interval },
              jobId: `ai-auto-${config.userId}`,
              removeOnComplete: 50,
              removeOnFail: 20,
            },
          );

          restored++;
          this.logger.log(`恢复自动交易 - 用户: ${config.userId}`);
        } catch (error) {
          this.logger.error(`恢复自动交易失败 - 用户: ${config.userId}`, error.stack);
        }
      }

      this.logger.log(`自动交易恢复完成 - 共恢复 ${restored} 个任务`);
      return restored;
    } catch (error) {
      this.logger.error('恢复自动交易失败', error.stack);
      return 0;
    }
  }

  /**
   * 移除用户的所有定时任务
   * @param userId 用户 ID
   */
  private async removeUserRepeatableJobs(userId: string): Promise<void> {
    try {
      const repeatableJobs = await this.autoQueue.getRepeatableJobs();

      for (const job of repeatableJobs) {
        // 检查 jobId 或通过 key 匹配用户
        if (job.id === `ai-auto-${userId}` || job.key.includes(userId)) {
          await this.autoQueue.removeRepeatableByKey(job.key);
          this.logger.debug(`移除定时任务 - Key: ${job.key}`);
        }
      }
    } catch (error) {
      this.logger.error(`移除用户定时任务失败 - 用户: ${userId}`, error.stack);
      throw error;
    }
  }
}
