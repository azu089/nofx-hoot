import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import Decimal from 'decimal.js';

/**
 * 策略统计数据自动计算服务
 *
 * 定时从 Position 表聚合计算每个策略的统计指标：
 * - return7d / return30d / return90d (收益率)
 * - winRate (胜率)
 * - totalTrades (总交易次数)
 * - maxDrawdown (最大回撤)
 *
 * 数据链路：Position → StrategySubscription → Strategy
 */
@Injectable()
export class StrategyStatsService {
  private readonly logger = new Logger(StrategyStatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 每小时自动计算一次策略统计
   */
  @Cron(CronExpression.EVERY_HOUR)
  async calculateAllStrategyStats() {
    this.logger.log('开始计算所有策略统计数据...');

    try {
      const strategies = await this.prisma.strategy.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      });

      let updated = 0;
      for (const strategy of strategies) {
        try {
          await this.calculateStrategyStats(strategy.id);
          updated++;
        } catch (error) {
          this.logger.error(
            `计算策略 ${strategy.id} (${strategy.name}) 统计失败: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `策略统计计算完成: ${updated}/${strategies.length} 个策略已更新`,
      );
    } catch (error) {
      this.logger.error(`策略统计计算批量失败: ${error.message}`);
    }
  }

  /**
   * 计算单个策略的统计数据
   */
  async calculateStrategyStats(strategyId: string) {
    // 1. 获取该策略的所有订阅 ID
    const subscriptions = await this.prisma.strategySubscription.findMany({
      where: { strategyId },
      select: { id: true },
    });

    if (subscriptions.length === 0) {
      return; // 无订阅，跳过
    }

    const subscriptionIds = subscriptions.map((s) => s.id);

    // 2. 获取所有已平仓持仓
    const allClosedPositions = await this.prisma.position.findMany({
      where: {
        subscriptionId: { in: subscriptionIds },
        status: 'closed',
        closedAt: { not: null },
      },
      select: {
        realizedPnl: true,
        pnl: true,
        margin: true,
        closedAt: true,
        createdAt: true,
      },
      orderBy: { closedAt: 'asc' },
    });

    if (allClosedPositions.length === 0) {
      // 无交易记录，重置统计
      await this.prisma.strategy.update({
        where: { id: strategyId },
        data: {
          totalTrades: 0,
          winRate: null,
          return7d: null,
          return30d: null,
          return90d: null,
          maxDrawdown: null,
        },
      });
      return;
    }

    const now = new Date();

    // 3. 计算各时间段收益率
    const return7d = this.calculateReturnForPeriod(allClosedPositions, now, 7);
    const return30d = this.calculateReturnForPeriod(
      allClosedPositions,
      now,
      30,
    );
    const return90d = this.calculateReturnForPeriod(
      allClosedPositions,
      now,
      90,
    );

    // 4. 计算总交易次数和胜率
    const totalTrades = allClosedPositions.length;
    const winTrades = allClosedPositions.filter((p) => {
      const pnl = new Decimal(p.realizedPnl?.toString() || p.pnl?.toString() || '0');
      return pnl.greaterThan(0);
    }).length;
    const winRate =
      totalTrades > 0
        ? new Decimal(winTrades).div(totalTrades).mul(100).toDecimalPlaces(2)
        : null;

    // 5. 计算最大回撤
    const maxDrawdown = this.calculateMaxDrawdown(allClosedPositions);

    // 6. 更新策略统计
    await this.prisma.strategy.update({
      where: { id: strategyId },
      data: {
        totalTrades,
        winRate: winRate?.toString() ?? null,
        return7d: return7d?.toString() ?? null,
        return30d: return30d?.toString() ?? null,
        return90d: return90d?.toString() ?? null,
        maxDrawdown: maxDrawdown?.toString() ?? null,
      },
    });

    this.logger.debug(
      `策略 ${strategyId} 统计已更新: trades=${totalTrades}, winRate=${winRate}, 7d=${return7d}, 30d=${return30d}`,
    );
  }

  /**
   * 计算指定时间段的收益率
   * 收益率 = sum(realizedPnl) / sum(margin) * 100
   */
  private calculateReturnForPeriod(
    positions: Array<{
      realizedPnl: any;
      pnl: any;
      margin: any;
      closedAt: Date | null;
    }>,
    now: Date,
    days: number,
  ): Decimal | null {
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const periodPositions = positions.filter(
      (p) => p.closedAt && new Date(p.closedAt) >= cutoff,
    );

    if (periodPositions.length === 0) return null;

    let totalPnl = new Decimal(0);
    let totalMargin = new Decimal(0);

    for (const p of periodPositions) {
      const pnl = new Decimal(
        p.realizedPnl?.toString() || p.pnl?.toString() || '0',
      );
      const margin = new Decimal(p.margin?.toString() || '0');

      totalPnl = totalPnl.plus(pnl);
      if (margin.greaterThan(0)) {
        totalMargin = totalMargin.plus(margin);
      }
    }

    // 避免除零
    if (totalMargin.isZero()) return null;

    return totalPnl.div(totalMargin).mul(100).toDecimalPlaces(4);
  }

  /**
   * 计算最大回撤
   * 从峰值到谷值的最大跌幅百分比
   */
  private calculateMaxDrawdown(
    positions: Array<{
      realizedPnl: any;
      pnl: any;
      margin: any;
      closedAt: Date | null;
    }>,
  ): Decimal | null {
    if (positions.length === 0) return null;

    // 按平仓时间排序的累计 PnL
    let cumulativePnl = new Decimal(0);
    let peak = new Decimal(0);
    let maxDrawdown = new Decimal(0);
    // 用总 margin 作为基准计算百分比
    let totalMargin = new Decimal(0);

    for (const p of positions) {
      const pnl = new Decimal(
        p.realizedPnl?.toString() || p.pnl?.toString() || '0',
      );
      const margin = new Decimal(p.margin?.toString() || '0');

      cumulativePnl = cumulativePnl.plus(pnl);
      totalMargin = totalMargin.plus(margin);

      if (cumulativePnl.greaterThan(peak)) {
        peak = cumulativePnl;
      }

      const drawdown = peak.minus(cumulativePnl);
      if (drawdown.greaterThan(maxDrawdown)) {
        maxDrawdown = drawdown;
      }
    }

    if (totalMargin.isZero() || maxDrawdown.isZero()) return null;

    // 回撤为负数表示
    return maxDrawdown.div(totalMargin).mul(-100).toDecimalPlaces(4);
  }
}
