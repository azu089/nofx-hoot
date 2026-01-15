import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StakingService } from '../modules/staking/staking.service';

/**
 * 周分红定时任务
 *
 * 每周一凌晨 2 点执行分红：
 * - 计算本周燃油费收入的 20% 作为分红池
 * - 按质押权重分配：70% USDT 立即到账 + 30% QFI 90天释放
 */
@Injectable()
export class DividendTask {
  private readonly logger = new Logger(DividendTask.name);

  constructor(private readonly stakingService: StakingService) {}

  /**
   * 每周一凌晨 2 点执行分红
   * Cron: 0 2 * * 1 (秒 分 时 日 月 周)
   */
  @Cron('0 0 2 * * 1') // 周一 02:00:00
  async handleWeeklyDividend() {
    this.logger.log('===== 开始执行周分红任务 =====');

    try {
      const result = await this.stakingService.distributeWeeklyDividends();

      if (result.success) {
        this.logger.log(
          `周分红完成: 总池 ${result.totalDividend} USDT, ` +
            `分配 USDT ${result.usdtDistributed}, QFI ${result.qfiDistributed}, ` +
            `惠及 ${result.stakersCount} 人`,
        );
      } else {
        this.logger.warn(`周分红未执行: ${result.message}`);
      }
    } catch (error) {
      this.logger.error('周分红任务失败', error.stack);
    }

    this.logger.log('===== 周分红任务结束 =====');
  }
}
