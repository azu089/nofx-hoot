import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiService } from '../ai.service';
import { EvolutionService } from '../services/evolution.service';

/**
 * AI 自动运行任务处理器
 * 负责执行定时的 AI 分析任务
 */
@Processor('ai-auto')
export class AutoRunProcessor extends WorkerHost {
  private readonly logger = new Logger(AutoRunProcessor.name);
  private consecutiveFailures = new Map<string, number>(); // userId → failure count

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AiService))
    private readonly aiService: AiService,
    private readonly evolutionService: EvolutionService,
  ) {
    super();
  }

  async process(job: Job<{ userId: string }>): Promise<{ analyzed: number; executed: number; errors: number }> {
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
      // Sharpe 太低，自动暂停
      this.logger.warn(`[自动运行] 用户 ${userId} Sharpe 过低 (${evolution.sharpe}), 自动暂停`);
      await this.prisma.aiConfig.update({
        where: { userId },
        data: {
          autoEnabled: false,
          autoStatus: 'paused',
          autoStatusReason: `Sharpe Ratio 过低 (${evolution.sharpe?.toFixed(2) || 'N/A'})，系统自动暂停`
        },
      });
      return { analyzed: 0, executed: 0, errors: 0 };
    }

    // 3. 遍历交易对执行分析
    const symbols: string[] = Array.isArray(config.symbols) ? config.symbols as string[] : [];
    const timeframes: string[] = Array.isArray(config.timeframes) ? config.timeframes as string[] : ['4h'];
    const timeframe = timeframes[0] || '4h';

    let analyzed = 0;
    let executed = 0;
    let errors = 0;

    for (const symbol of symbols) {
      try {
        this.logger.log(`[自动运行] 分析: ${symbol} ${timeframe} (模式: ${config.mode}, Tier: ${evolution.tier})`);

        const result = await this.aiService.triggerAnalysis(userId, { symbol, timeframe });
        analyzed++;

        if (result?.status === 'executed') {
          executed++;
        }

        // 重置连续失败计数
        this.consecutiveFailures.set(userId, 0);
      } catch (error) {
        errors++;
        const msg = error instanceof Error ? error.message : '未知错误';
        this.logger.error(`[自动运行] 分析失败: ${symbol} - ${msg}`);
      }
    }

    // 4. 更新 lastAutoRunAt
    await this.prisma.aiConfig.update({
      where: { userId },
      data: { lastAutoRunAt: new Date() },
    });

    // 5. 连续失败检查
    if (errors > 0 && analyzed === 0) {
      const failures = (this.consecutiveFailures.get(userId) || 0) + 1;
      this.consecutiveFailures.set(userId, failures);

      if (failures >= 3) {
        this.logger.warn(`[自动运行] 用户 ${userId} 连续 ${failures} 次失败，自动暂停`);
        await this.prisma.aiConfig.update({
          where: { userId },
          data: {
            autoEnabled: false,
            autoStatus: 'paused',
            autoStatusReason: `连续 ${failures} 次分析全部失败，系统自动暂停`
          },
        });
        this.consecutiveFailures.delete(userId);
      }
    }

    this.logger.log(`[自动运行] 用户 ${userId} 完成: ${analyzed} 个分析, ${executed} 个执行, ${errors} 个错误`);
    return { analyzed, executed, errors };
  }
}
