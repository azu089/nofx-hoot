/**
 * 管理后台 - 财务中心服务
 * 处理收入统计：订阅费、GAS、燃油费
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import Decimal from 'decimal.js';

/** 日期过滤器形状（对应 Prisma createdAt 条件） */
type DateFilter = { createdAt?: { gte?: Date; lte?: Date } };

@Injectable()
export class AdminFinanceService {
  private readonly logger = new Logger(AdminFinanceService.name);

  constructor(private prisma: PrismaService) {}

  // 获取财务概览
  async getFinanceOverview(startDate?: Date, endDate?: Date) {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    // 并行查询各项收入
    const [subscriptionStats, pointCardStats, gasFeeStats, withdrawStats] =
      await Promise.all([
        this.getSubscriptionRevenue(dateFilter),
        this.getPointCardRevenue(dateFilter),
        this.getGasFeeRevenue(dateFilter),
        this.getWithdrawStats(dateFilter),
      ]);

    // 计算总收入
    const totalRevenue = new Decimal(subscriptionStats.total)
      .plus(pointCardStats.total)
      .plus(gasFeeStats.total);

    return {
      summary: {
        totalRevenue: totalRevenue.toString(),
        subscriptionRevenue: subscriptionStats.total,
        pointCardRevenue: pointCardStats.total,
        gasFeeRevenue: gasFeeStats.total,
        pendingWithdraws: withdrawStats.pendingAmount,
      },
      subscription: subscriptionStats,
      pointCard: pointCardStats,
      gasFee: gasFeeStats,
      withdraw: withdrawStats,
    };
  }

  // 获取订阅收入统计
  async getSubscriptionRevenue(dateFilter: DateFilter) {
    const revenues = await this.prisma.subscriptionRevenue.findMany({
      where: dateFilter,
      orderBy: { createdAt: 'desc' },
    });

    const total = revenues.reduce(
      (sum, r) => new Decimal(sum).plus(r.amount).toString(),
      '0',
    );

    // 按策略分组统计
    const byStrategy = await this.prisma.subscriptionRevenue.groupBy({
      by: ['strategyId', 'strategyName'],
      where: dateFilter,
      _sum: { amount: true },
      _count: true,
    });

    // 按日期分组统计
    const dailyStats = await this.getDailyStats('subscription', dateFilter);

    return {
      total,
      count: revenues.length,
      byStrategy: byStrategy.map((s) => ({
        strategyId: s.strategyId,
        strategyName: s.strategyName,
        amount: s._sum.amount?.toString() || '0',
        count: s._count,
      })),
      daily: dailyStats,
      recentRecords: revenues.slice(0, 20).map((r) => ({
        ...r,
        amount: r.amount.toString(),
      })),
    };
  }

  // 获取GAS收入统计
  async getPointCardRevenue(dateFilter: DateFilter) {
    const recharges = await this.prisma.pointCardRecord.findMany({
      where: {
        ...dateFilter,
        type: 'recharge',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, nickname: true },
        },
      },
    });

    const total = recharges.reduce(
      (sum, r) => new Decimal(sum).plus(r.amount).toString(),
      '0',
    );

    // 按日期分组统计
    const dailyStats = await this.getDailyStats('pointCard', dateFilter);

    // 获取消费统计
    const consumptions = await this.prisma.pointCardRecord.aggregate({
      where: {
        ...dateFilter,
        type: 'consume',
      },
      _sum: { amount: true },
      _count: true,
    });

    return {
      total,
      count: recharges.length,
      consumed: {
        amount: consumptions._sum.amount?.toString() || '0',
        count: consumptions._count,
      },
      daily: dailyStats,
      recentRecords: recharges.slice(0, 20).map((r) => ({
        id: r.id,
        userId: r.userId,
        user: r.user,
        amount: r.amount.toString(),
        createdAt: r.createdAt,
      })),
    };
  }

  // 获取燃油费收入统计
  async getGasFeeRevenue(dateFilter: DateFilter) {
    const gasFees = await this.prisma.gasFeeRecord.findMany({
      where: dateFilter,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, nickname: true },
        },
      },
    });

    const total = gasFees.reduce(
      (sum, r) => new Decimal(sum).plus(r.feeAmount).toString(),
      '0',
    );

    const totalProfit = gasFees.reduce(
      (sum, r) => new Decimal(sum).plus(r.profitUsdt).toString(),
      '0',
    );

    // 按交易所分组
    const byExchange = await this.prisma.gasFeeRecord.groupBy({
      by: ['exchange'],
      where: dateFilter,
      _sum: { feeAmount: true, profitUsdt: true },
      _count: true,
    });

    // 按日期分组统计
    const dailyStats = await this.getDailyStats('gasFee', dateFilter);

    // 分红池相关统计
    const dividendPoolStats = await this.prisma.dividendPool.aggregate({
      where: {
        status: { in: ['collecting', 'pending'] },
      },
      _sum: { totalAmount: true },
    });

    return {
      total,
      totalProfit,
      count: gasFees.length,
      averageFeeRate:
        gasFees.length > 0
          ? new Decimal(total).div(totalProfit).mul(100).toFixed(2) + '%'
          : '0%',
      byExchange: byExchange.map((e) => ({
        exchange: e.exchange,
        feeAmount: e._sum.feeAmount?.toString() || '0',
        profitAmount: e._sum.profitUsdt?.toString() || '0',
        count: e._count,
      })),
      pendingDividend: dividendPoolStats._sum.totalAmount?.toString() || '0',
      daily: dailyStats,
      recentRecords: gasFees.slice(0, 20).map((r) => ({
        id: r.id,
        userId: r.userId,
        userEmail: r.user?.email || '-',
        user: r.user,
        symbol: r.symbol,
        exchange: r.exchange,
        profitUsdt: r.profitUsdt.toFixed(8),
        feeAmount: r.feeAmount.toFixed(8),
        // RevenueRow 兼容字段
        amount: r.feeAmount.toFixed(8),
        description: `盈利${r.profitUsdt.toFixed(8)}`,
        date: r.createdAt.toISOString().split('T')[0],
        createdAt: r.createdAt,
      })),
    };
  }

  // 获取提现统计
  async getWithdrawStats(dateFilter: DateFilter) {
    const [pending, completed, rejected] = await Promise.all([
      this.prisma.withdrawRequest.aggregate({
        where: { status: 'pending' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.withdrawRequest.aggregate({
        where: { ...dateFilter, status: 'completed' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.withdrawRequest.aggregate({
        where: { ...dateFilter, status: 'rejected' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      pendingAmount: pending._sum.amount?.toString() || '0',
      pendingCount: pending._count,
      completedAmount: completed._sum.amount?.toString() || '0',
      completedCount: completed._count,
      rejectedAmount: rejected._sum.amount?.toString() || '0',
      rejectedCount: rejected._count,
    };
  }

  // 获取每日统计数据
  private async getDailyStats(type: string, dateFilter: DateFilter) {
    // 使用平台每日统计表
    const stats = await this.prisma.platformDailyStats.findMany({
      where: {
        date: dateFilter.createdAt,
      },
      orderBy: { date: 'asc' },
      take: 30,
    });

    return stats.map((s) => {
      let amount = '0';
      if (type === 'subscription') {
        amount = s.subscriptionRevenue.toString();
      } else if (type === 'pointCard') {
        amount = s.pointCardRevenue.toString();
      } else if (type === 'gasFee') {
        amount = s.gasFeeRevenue.toString();
      }
      return {
        date: s.date.toISOString().split('T')[0],
        amount,
      };
    });
  }

  // 构建日期过滤器
  private buildDateFilter(startDate?: Date, endDate?: Date) {
    if (!startDate && !endDate) {
      // 默认最近30天
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return {
        createdAt: {
          gte: thirtyDaysAgo,
        },
      };
    }

    const filter: DateFilter = { createdAt: {} };
    if (startDate) filter.createdAt!.gte = startDate;
    if (endDate) filter.createdAt!.lte = endDate;
    return filter;
  }

  // 获取收入趋势数据
  async getRevenueTrend(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await this.prisma.platformDailyStats.findMany({
      where: {
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    return stats.map((s) => ({
      date: s.date.toISOString().split('T')[0],
      subscription: s.subscriptionRevenue.toString(),
      pointCard: s.pointCardRevenue.toString(),
      gasFee: s.gasFeeRevenue.toString(),
      total: new Decimal(s.subscriptionRevenue)
        .plus(s.pointCardRevenue)
        .plus(s.gasFeeRevenue)
        .toString(),
    }));
  }
}
