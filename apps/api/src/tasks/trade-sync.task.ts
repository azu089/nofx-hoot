import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TradesService } from '../modules/trades/trades.service';
import { BillingService } from '../modules/billing/billing.service';

/**
 * 交易同步定时任务
 * 每分钟同步运行中实例的交易数据
 * 同步完成后自动触发燃油费计算
 */
@Injectable()
export class TradeSyncTask {
  private readonly logger = new Logger(TradeSyncTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tradesService: TradesService,
    private readonly billingService: BillingService,
  ) {}

  /**
   * 每分钟同步交易数据
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleTradeSyncCron() {
    this.logger.debug('开始交易同步定时任务');

    try {
      // 1. 查询所有运行中的实例
      const runningInstances = await this.prisma.client.instances.findMany({
        where: {
          status: 'running',
        },
      });

      if (runningInstances.length === 0) {
        this.logger.debug('没有运行中的实例，跳过同步');
        return;
      }

      this.logger.log(`发现 ${runningInstances.length} 个运行中的实例`);

      // 2. 逐个同步交易数据
      for (const instance of runningInstances) {
        try {
          this.logger.debug(`同步实例 ${instance.id} 的交易数据`);

          const result = await this.tradesService.syncTrades(instance.id);

          this.logger.log(
            `实例 ${instance.id} 同步完成: ${result.synced} 条新交易`,
          );
        } catch (error) {
          // 单个实例同步失败不影响其他实例
          this.logger.error(
            `实例 ${instance.id} 同步失败: ${error.message}`,
            error.stack,
          );
        }
      }

      // 3. 同步完成后，自动计算燃油费抽成
      this.logger.debug('开始计算燃油费抽成');
      try {
        const gasFeeResult = await this.billingService.calculateGasFee();
        if (gasFeeResult.charged > 0) {
          this.logger.log(
            `燃油费抽成完成: 处理 ${gasFeeResult.charged} 笔, 总计 ${gasFeeResult.totalGasFee} USDT`,
          );
        }
      } catch (error) {
        this.logger.error(`燃油费计算失败: ${error.message}`, error.stack);
      }

      this.logger.log('交易同步定时任务完成');
    } catch (error) {
      this.logger.error(
        `交易同步定时任务失败: ${error.message}`,
        error.stack,
      );
    }
  }
}
