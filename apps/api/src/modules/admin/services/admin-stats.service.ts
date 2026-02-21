/**
 * 管理后台 - 用户数据统计服务
 * 用户看板：总用户、日登录、日注册、活跃用户等
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import Decimal from 'decimal.js';

@Injectable()
export class AdminStatsService {
  private readonly logger = new Logger(AdminStatsService.name);

  constructor(private prisma: PrismaService) {}

  // 获取用户看板数据
  async getUserDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [
      totalUsers,
      todayRegistrations,
      yesterdayRegistrations,
      activeUsers7d,
      tradingUsers,
      usersByStatus,
      topReferrers,
    ] = await Promise.all([
      // 总用户数
      this.prisma.user.count(),
      // 今日注册
      this.prisma.user.count({
        where: { createdAt: { gte: today } },
      }),
      // 昨日注册
      this.prisma.user.count({
        where: {
          createdAt: { gte: yesterday, lt: today },
        },
      }),
      // 7日活跃用户（有交易的用户）
      this.prisma.position.groupBy({
        by: ['userId'],
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      // 有持仓的用户
      this.prisma.position.groupBy({
        by: ['userId'],
        where: { status: 'open' },
      }),
      // 按状态分组
      this.prisma.user.groupBy({
        by: ['status'],
        _count: true,
      }),
      // 邀请排行榜（前10）
      this.getTopReferrers(10),
    ]);

    // 计算增长率
    const registrationGrowth =
      yesterdayRegistrations > 0
        ? (
            ((todayRegistrations - yesterdayRegistrations) /
              yesterdayRegistrations) *
            100
          ).toFixed(1)
        : todayRegistrations > 0
          ? '100'
          : '0';

    return {
      overview: {
        totalUsers,
        todayRegistrations,
        registrationGrowth: `${registrationGrowth}%`,
        activeUsers7d: activeUsers7d.length,
        tradingUsers: tradingUsers.length,
      },
      usersByStatus: usersByStatus.map((s) => ({
        status: s.status || 'active',
        count: s._count,
      })),
      topReferrers,
      recentRegistrations: await this.getRecentRegistrations(10),
    };
  }

  // 获取用户增长趋势
  async getUserGrowthTrend(days: number = 30) {
    const stats = await this.prisma.platformDailyStats.findMany({
      where: {
        date: {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { date: 'asc' },
    });

    return stats.map((s) => ({
      date: s.date.toISOString().split('T')[0],
      totalUsers: s.totalUsers,
      newUsers: s.newUsers,
      activeUsers: s.activeUsers,
      tradingUsers: s.tradingUsers,
    }));
  }

  // 获取邀请排行榜
  async getTopReferrers(limit: number = 10) {
    const referrers = await this.prisma.user.findMany({
      where: {
        invitees: {
          some: {},
        },
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        inviteCode: true,
        _count: {
          select: { invitees: true },
        },
      },
      orderBy: {
        invitees: { _count: 'desc' },
      },
      take: limit,
    });

    // 获取每个邀请人的返佣总额
    const referrerIds = referrers.map((r) => r.id);
    const rewards = await this.prisma.referralReward.groupBy({
      by: ['userId'],
      where: {
        userId: { in: referrerIds },
        status: 'paid',
      },
      _sum: { amount: true },
    });

    const rewardMap = new Map(
      rewards.map((r) => [r.userId, r._sum.amount?.toString() || '0']),
    );

    return referrers.map((r) => ({
      id: r.id,
      email: r.email,
      nickname: r.nickname,
      inviteCode: r.inviteCode,
      inviteeCount: r._count.invitees,
      totalReward: rewardMap.get(r.id) || '0',
    }));
  }

  // 获取最近注册用户
  async getRecentRegistrations(limit: number = 10) {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        email: true,
        nickname: true,
        telegramUsername: true,
        walletAddress: true,
        invitedBy: true,
        status: true,
        createdAt: true,
      },
    });
  }

  // 获取用户资产分布
  async getUserAssetDistribution() {
    const users = await this.prisma.user.findMany({
      select: {
        usdtBalance: true,
        hootBalance: true,
        pointBalance: true,
      },
    });

    // 资产区间分布
    const ranges = [
      { label: '0', min: 0, max: 0 },
      { label: '0-100', min: 0.01, max: 100 },
      { label: '100-1000', min: 100, max: 1000 },
      { label: '1000-10000', min: 1000, max: 10000 },
      { label: '10000+', min: 10000, max: Infinity },
    ];

    const distribution = ranges.map((range) => ({
      label: range.label,
      count: users.filter((u) => {
        const balance = new Decimal(u.usdtBalance.toString())
          .plus(u.pointBalance.toString())
          .toNumber();
        return balance >= range.min && balance < range.max;
      }).length,
    }));

    // 总资产统计
    const totalUsdt = users.reduce(
      (sum, u) => new Decimal(sum).plus(u.usdtBalance).toString(),
      '0',
    );
    const totalHoot = users.reduce(
      (sum, u) => new Decimal(sum).plus(u.hootBalance).toString(),
      '0',
    );
    const totalPoints = users.reduce(
      (sum, u) => new Decimal(sum).plus(u.pointBalance).toString(),
      '0',
    );

    return {
      distribution,
      totals: {
        usdt: totalUsdt,
        hoot: totalHoot,
        points: totalPoints,
      },
    };
  }

  // 获取用户来源统计
  async getUserSourceStats() {
    const [emailUsers, telegramUsers, walletUsers] = await Promise.all([
      this.prisma.user.count({
        where: {
          email: { not: null },
          telegramId: null,
          walletAddress: null,
        },
      }),
      this.prisma.user.count({
        where: {
          telegramId: { not: null },
        },
      }),
      this.prisma.user.count({
        where: {
          walletAddress: { not: null },
        },
      }),
    ]);

    return {
      email: emailUsers,
      telegram: telegramUsers,
      wallet: walletUsers,
    };
  }

  // 更新每日统计（定时任务调用）
  async updateDailyStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      newUsers,
      activeUsersData,
      tradingUsersData,
      depositStats,
      withdrawStats,
      subscriptionRevenue,
      pointCardRevenue,
      gasFeeRevenue,
      tradeStats,
      stakingStats,
      hootStats,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { createdAt: { gte: today } },
      }),
      this.prisma.position.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: today } },
      }),
      this.prisma.position.groupBy({
        by: ['userId'],
        where: { status: 'open' },
      }),
      this.prisma.transaction.aggregate({
        where: {
          createdAt: { gte: today },
          type: 'deposit',
          status: 'completed',
        },
        _sum: { amount: true },
      }),
      this.prisma.withdrawRequest.aggregate({
        where: { createdAt: { gte: today }, status: 'completed' },
        _sum: { amount: true },
      }),
      this.prisma.subscriptionRevenue.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { amount: true },
      }),
      this.prisma.pointCardRecord.aggregate({
        where: { createdAt: { gte: today }, type: 'recharge' },
        _sum: { amount: true },
      }),
      this.prisma.gasFeeRecord.aggregate({
        where: { createdAt: { gte: today } },
        _sum: { feeAmount: true },
      }),
      this.prisma.position.aggregate({
        where: { createdAt: { gte: today } },
        _count: true,
        _sum: { realizedPnl: true, margin: true },
      }),
      this.prisma.stakingRecord.aggregate({
        where: { status: 'active' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.tokenCirculation.aggregate({
        where: { type: 'airdrop' },
        _sum: { amount: true },
      }),
    ]);

    const totalDeposit = depositStats._sum.amount || 0;
    const totalWithdraw = withdrawStats._sum.amount || 0;

    await this.prisma.platformDailyStats.upsert({
      where: { date: today },
      create: {
        date: today,
        totalUsers,
        newUsers,
        activeUsers: activeUsersData.length,
        tradingUsers: tradingUsersData.length,
        totalDeposit,
        totalWithdraw,
        netInflow: new Decimal(totalDeposit.toString()).minus(
          totalWithdraw.toString(),
        ),
        subscriptionRevenue: subscriptionRevenue._sum.amount || 0,
        pointCardRevenue: pointCardRevenue._sum.amount || 0,
        gasFeeRevenue: gasFeeRevenue._sum.feeAmount || 0,
        totalRevenue: new Decimal(
          subscriptionRevenue._sum.amount?.toString() || '0',
        )
          .plus(pointCardRevenue._sum.amount?.toString() || '0')
          .plus(gasFeeRevenue._sum.feeAmount?.toString() || '0'),
        totalTrades: tradeStats._count,
        totalVolumeUsdt: tradeStats._sum.margin || 0,
        totalProfitUsdt: tradeStats._sum.realizedPnl || 0,
        totalStaked: stakingStats._sum.amount || 0,
        totalStakers: stakingStats._count,
        hootCirculating: hootStats._sum.amount || 0,
        hootStaked: stakingStats._sum.amount || 0,
        hootBurned: 0, // 暂无销毁记录，未来实现代币销毁时更新
      },
      update: {
        totalUsers,
        newUsers,
        activeUsers: activeUsersData.length,
        tradingUsers: tradingUsersData.length,
        totalDeposit,
        totalWithdraw,
        netInflow: new Decimal(totalDeposit.toString()).minus(
          totalWithdraw.toString(),
        ),
        subscriptionRevenue: subscriptionRevenue._sum.amount || 0,
        pointCardRevenue: pointCardRevenue._sum.amount || 0,
        gasFeeRevenue: gasFeeRevenue._sum.feeAmount || 0,
        totalRevenue: new Decimal(
          subscriptionRevenue._sum.amount?.toString() || '0',
        )
          .plus(pointCardRevenue._sum.amount?.toString() || '0')
          .plus(gasFeeRevenue._sum.feeAmount?.toString() || '0'),
        totalTrades: tradeStats._count,
        totalVolumeUsdt: tradeStats._sum.margin || 0,
        totalProfitUsdt: tradeStats._sum.realizedPnl || 0,
        totalStaked: stakingStats._sum.amount || 0,
        totalStakers: stakingStats._count,
        hootCirculating: hootStats._sum.amount || 0,
        hootStaked: stakingStats._sum.amount || 0,
        hootBurned: 0, // 暂无销毁记录，未来实现代币销毁时更新
      },
    });

    this.logger.log(`每日统计已更新: ${today.toISOString()}`);
  }
}
