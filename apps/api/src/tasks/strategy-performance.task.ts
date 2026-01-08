import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RevenuePricingService } from '../modules/strategies/revenue-pricing.service';
import Decimal from 'decimal.js';

/**
 * 策略性能统计定时任务 - Phase 16
 *
 * 功能：
 * 1. 每日凌晨 2:00 执行
 * 2. 更新所有用户上传策略的性能指标
 * 3. 自动调整策略分成等级
 *
 * 统计指标：
 * - total_users: 使用该策略的用户数
 * - total_profit: 累计为用户创造的盈利（从 strategy_revenue_logs 汇总）
 * - avg_win_rate: 平均胜率（从所有用户的交易记录计算）
 * - avg_sharpe_ratio: 平均夏普比率（简化计算：收益率 / 波动率）
 */
@Injectable()
export class StrategyPerformanceTask {
  private readonly logger = new Logger(StrategyPerformanceTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: RevenuePricingService,
  ) {}

  /**
   * 每日凌晨 2:00 执行策略性能统计
   */
  @Cron('0 2 * * *', {
    name: 'strategy-performance-update',
    timeZone: 'Asia/Shanghai',
  })
  async handleStrategyPerformanceUpdate() {
    this.logger.log('开始执行策略性能统计定时任务...');

    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    try {
      // 1. 获取所有用户上传的策略
      const userStrategies = await this.prisma.client.strategies.findMany({
        where: {
          owner_type: 'user',
          is_active: true,
          revenue_share_enabled: true,
        },
        select: {
          id: true,
          name: true,
          uploader_id: true,
        },
      });

      this.logger.log(`找到 ${userStrategies.length} 个用户策略需要统计`);

      // 2. 逐个更新策略性能
      for (const strategy of userStrategies) {
        try {
          await this.updateStrategyPerformance(strategy.id);
          successCount++;
        } catch (error) {
          this.logger.error(
            `更新策略 ${strategy.id} 性能失败: ${error.message}`,
            error.stack,
          );
          errorCount++;
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `策略性能统计完成: 成功 ${successCount} 个, 失败 ${errorCount} 个, 耗时 ${duration}ms`,
      );
    } catch (error) {
      this.logger.error(
        `策略性能统计定时任务执行失败: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * 更新单个策略的性能指标
   */
  private async updateStrategyPerformance(strategyId: string): Promise<void> {
    this.logger.debug(`更新策略 ${strategyId} 的性能指标`);

    // 1. 统计使用该策略的用户数
    const totalUsers = await this.calculateTotalUsers(strategyId);

    // 2. 统计累计盈利（从 strategy_revenue_logs 汇总）
    const totalProfit = await this.calculateTotalProfit(strategyId);

    // 3. 统计平均胜率
    const avgWinRate = await this.calculateAvgWinRate(strategyId);

    // 4. 统计夏普比率（简化计算）
    const avgSharpeRatio = await this.calculateAvgSharpeRatio(strategyId);

    // 5. 更新策略性能数据
    await this.prisma.client.strategies.update({
      where: { id: strategyId },
      data: {
        total_users: totalUsers,
        total_profit: totalProfit.toString(),
        avg_win_rate: avgWinRate?.toString(),
        avg_sharpe_ratio: avgSharpeRatio?.toString(),
        last_performance_calc: new Date(),
      },
    });

    this.logger.debug(
      `策略 ${strategyId} 性能更新完成: 用户=${totalUsers}, 盈利=${totalProfit}, 胜率=${avgWinRate}%, 夏普=${avgSharpeRatio}`,
    );

    // 6. 根据新性能数据更新分成等级
    await this.pricingService.updateStrategyRevenueTier(strategyId);
  }

  /**
   * 计算使用该策略的用户数
   */
  private async calculateTotalUsers(strategyId: string): Promise<number> {
    const result = await this.prisma.client.trade_history.groupBy({
      by: ['user_id'],
      where: { strategy_id: strategyId },
    });

    return result.length;
  }

  /**
   * 计算累计盈利（从收益分成记录汇总）
   */
  private async calculateTotalProfit(strategyId: string): Promise<Decimal> {
    const result = await this.prisma.client.strategy_revenue_logs.aggregate({
      where: {
        strategy_id: strategyId,
        status: 'settled',
      },
      _sum: {
        revenue_amount: true,
      },
    });

    return new Decimal(result._sum.revenue_amount || 0);
  }

  /**
   * 计算平均胜率
   * 胜率 = 盈利交易数 / 总交易数
   */
  private async calculateAvgWinRate(strategyId: string): Promise<Decimal | null> {
    // 获取使用该策略的所有已平仓交易
    const trades = await this.prisma.client.trade_history.findMany({
      where: {
        strategy_id: strategyId,
        status: 'closed',
      },
      select: {
        pnl: true,
      },
    });

    if (trades.length === 0) {
      return null;
    }

    // 统计盈利交易数
    const winningTrades = trades.filter((t) =>
      t.pnl && new Decimal(t.pnl).gt(0),
    ).length;

    // 计算胜率（百分比，不含 %）
    const winRate = new Decimal(winningTrades)
      .div(trades.length)
      .times(100);

    return winRate;
  }

  /**
   * 计算夏普比率（简化版本）
   *
   * 简化公式：夏普比率 = 平均收益率 / 收益率标准差
   * 注：真实夏普比率计算更复杂，这里做简化处理
   */
  private async calculateAvgSharpeRatio(strategyId: string): Promise<Decimal | null> {
    // 获取最近 30 天的每日收益率
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trades = await this.prisma.client.trade_history.findMany({
      where: {
        strategy_id: strategyId,
        status: 'closed',
        closed_at: {
          gte: thirtyDaysAgo,
        },
      },
      select: {
        pnl: true,
        entry_price: true,
        quantity: true,
      },
      orderBy: {
        closed_at: 'asc',
      },
    });

    if (trades.length < 10) {
      // 交易数据不足，无法计算
      return null;
    }

    // 计算每笔交易的收益率
    const returns = trades
      .filter((t) => t.pnl && t.entry_price && t.quantity)
      .map((t) => {
        const capital = new Decimal(t.entry_price!).times(t.quantity);
        const returnRate = new Decimal(t.pnl!).div(capital);
        return returnRate.toNumber();
      });

    // 计算平均收益率
    const avgReturn =
      returns.reduce((sum: number, r: number) => sum + r, 0) / returns.length;

    // 计算收益率标准差
    const variance =
      returns.reduce((sum: number, r: number) => sum + Math.pow(r - avgReturn, 2), 0) /
      returns.length;
    const stdDev = Math.sqrt(variance);

    // 避免除零
    if (stdDev === 0) {
      return null;
    }

    // 夏普比率 = 平均收益率 / 标准差
    const sharpeRatio = new Decimal(avgReturn).div(stdDev);

    return sharpeRatio;
  }
}
