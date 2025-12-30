import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StakingService } from '../modules/staking/staking.service';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';

/**
 * 质押收益分配定时任务
 *
 * 执行周期：每周一凌晨 2 点
 *
 * 分红规则（白皮书 v5.0 第 3.3 节）：
 * - 来源：燃油费（盈利抽成 20%）的 30%
 * - 周期：每周一次
 * - 结算：USDT（直接打入用户 usdt_balance）
 * - 分配：按质押权重比例分配
 *
 * 流程：
 * 1. 统计上周所有燃油费收入
 * 2. 计算分红池 = 燃油费 × 30%
 * 3. 按权重分配给所有质押者
 * 4. USDT 直接打入用户钱包
 */
@Injectable()
export class StakingRewardsTask {
  private readonly logger = new Logger(StakingRewardsTask.name);

  // 分红比例：燃油费的 30%
  private readonly DIVIDEND_RATIO = new Decimal('0.30');

  constructor(
    private readonly stakingService: StakingService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 每周一凌晨 2 点执行收益分配
   *
   * 分配逻辑：
   * 1. 统计上周燃油费收入（billing_logs 中 billing_type='gas_fee'）
   * 2. 计算分红池 = 燃油费 × 30%
   * 3. 按质押权重比例分配 USDT 给质押者
   */
  @Cron('0 2 * * 1') // 每周一凌晨 2 点
  async handleWeeklyRewards() {
    this.logger.log('=== 开始每周质押分红（USDT 结算）===');

    try {
      // 1. 计算上周时间范围
      const now = new Date();
      const lastWeekStart = new Date(now);
      lastWeekStart.setDate(now.getDate() - 7);
      lastWeekStart.setHours(2, 0, 0, 0);

      const lastWeekEnd = new Date(now);
      lastWeekEnd.setHours(2, 0, 0, 0);

      // 2. 统计上周燃油费收入
      const gasFeeResult = await this.prisma.client.billing_logs.aggregate({
        where: {
          billing_type: 'gas_fee',
          status: 'completed',
          created_at: {
            gte: lastWeekStart,
            lt: lastWeekEnd,
          },
        },
        _sum: {
          amount: true,
        },
      });

      const totalGasFee = new Decimal(gasFeeResult._sum.amount?.toString() || '0');
      this.logger.log(`上周燃油费收入：${totalGasFee.toString()} USDT`);

      if (totalGasFee.lte(0)) {
        this.logger.log('上周无燃油费收入，跳过分红');
        return;
      }

      // 3. 计算分红池 = 燃油费 × 30%
      const dividendPool = totalGasFee.times(this.DIVIDEND_RATIO);
      this.logger.log(`分红池：${dividendPool.toString()} USDT（燃油费的 30%）`);

      // 4. 获取全局质押统计
      const globalStats = await this.stakingService.getGlobalStats();
      this.logger.log(
        `全局质押统计：活跃质押 ${globalStats.activeStakesCount} 笔，总加权金额 ${globalStats.totalWeighted}`,
      );

      if (globalStats.activeStakesCount === 0) {
        this.logger.log('无活跃质押，跳过分红');
        return;
      }

      // 5. 按权重分配 USDT
      const result = await this.distributeUsdtDividends(dividendPool.toString());

      this.logger.log(
        `分红完成：分配 ${result.distributed} USDT 给 ${result.stakesUpdated} 笔质押`,
      );

      this.logger.log('=== 每周质押分红完成 ===');
    } catch (error) {
      this.logger.error('每周质押分红失败', error.stack);
    }
  }

  /**
   * 按权重分配 USDT 分红
   *
   * @param totalDividend 总分红金额（USDT）
   * @returns 分配结果
   */
  private async distributeUsdtDividends(totalDividend: string): Promise<{
    distributed: string;
    stakesUpdated: number;
  }> {
    const totalDividendDecimal = new Decimal(totalDividend);

    return await this.prisma.client.$transaction(async (tx) => {
      // 1. 获取所有活跃质押
      const activeStakes = await tx.stakes.findMany({
        where: { status: 'active' },
      });

      if (activeStakes.length === 0) {
        return { distributed: '0', stakesUpdated: 0 };
      }

      // 2. 计算每个质押的权重和加权金额
      const stakesWithWeight = activeStakes.map((stake) => {
        const weight = this.stakingService.calculateWeight(stake);
        return {
          stake,
          weight,
          weightedAmount: weight.times(new Decimal(stake.amount)),
        };
      });

      // 3. 计算总加权金额
      const totalWeightedAmount = stakesWithWeight.reduce(
        (sum, s) => sum.plus(s.weightedAmount),
        new Decimal(0),
      );

      if (totalWeightedAmount.lte(0)) {
        return { distributed: '0', stakesUpdated: 0 };
      }

      // 4. 按比例分配 USDT 到用户钱包
      let totalDistributed = new Decimal(0);
      let stakesUpdated = 0;

      // 按用户分组
      const userDividends = new Map<string, Decimal>();

      for (const { stake, weightedAmount } of stakesWithWeight) {
        // 用户分红 = 总分红 × (用户加权金额 / 总加权金额)
        const userDividend = totalDividendDecimal
          .times(weightedAmount)
          .dividedBy(totalWeightedAmount)
          .toDecimalPlaces(8);

        if (userDividend.gt(0)) {
          const existing = userDividends.get(stake.user_id) || new Decimal(0);
          userDividends.set(stake.user_id, existing.plus(userDividend));
          totalDistributed = totalDistributed.plus(userDividend);
          stakesUpdated++;
        }
      }

      // 5. 更新用户钱包余额（USDT）
      for (const [userId, dividend] of userDividends) {
        await tx.wallets.update({
          where: { user_id: userId },
          data: {
            usdt_balance: {
              increment: dividend.toNumber(),
            },
          },
        });

        // 6. 记录分红日志
        await tx.billing_logs.create({
          data: {
            user_id: userId,
            unique_order_id: `staking_dividend_${userId}_${Date.now()}`,
            billing_type: 'staking_dividend',
            amount: dividend.toString(),
            currency: 'USDT',
            description: `每周质押分红：${dividend.toString()} USDT`,
            status: 'completed',
          },
        });

        this.logger.debug(
          `用户 ${userId} 获得分红 ${dividend.toString()} USDT`,
        );
      }

      return {
        distributed: totalDistributed.toString(),
        stakesUpdated,
      };
    });
  }

  /**
   * 手动触发 USDT 分红（用于测试）
   * @param amount 分配金额（USDT）
   */
  async manualDistribute(amount: string): Promise<{
    distributed: string;
    stakesUpdated: number;
  }> {
    this.logger.log(`手动触发 USDT 分红：${amount} USDT`);
    return await this.distributeUsdtDividends(amount);
  }
}
