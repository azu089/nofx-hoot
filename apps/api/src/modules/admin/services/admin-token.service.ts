/**
 * 管理后台 - 代币流通管理服务
 * HOOT 代币流通统计、记录查询
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import Decimal from 'decimal.js';

@Injectable()
export class AdminTokenService {
  private readonly logger = new Logger(AdminTokenService.name);

  constructor(private prisma: PrismaService) {}

  // 获取代币流通概览
  async getTokenOverview() {
    const [
      airdropStats,
      stakingStats,
      dividendStats,
      burnStats,
      userBalanceStats,
    ] = await Promise.all([
      // 空投统计
      this.prisma.tokenCirculation.aggregate({
        where: { type: 'airdrop', direction: 'out' },
        _sum: { amount: true },
        _count: true,
      }),
      // 质押统计
      this.prisma.stakingRecord.aggregate({
        where: { status: 'active' },
        _sum: { amount: true },
        _count: true,
      }),
      // 分红统计
      this.prisma.dividendRecord.aggregate({
        where: { status: 'paid' },
        _sum: { dividendAmount: true },
        _count: true,
      }),
      // 销毁统计
      this.prisma.tokenCirculation.aggregate({
        where: { type: 'burn' },
        _sum: { amount: true },
        _count: true,
      }),
      // 用户持有统计
      this.prisma.user.aggregate({
        _sum: {
          hootBalance: true,
          lockedBalance: true,
          availableBalance: true,
        },
      }),
    ]);

    // 计算流通量（空投 - 销毁）
    const totalAirdrop = airdropStats._sum.amount || new Decimal(0);
    const totalBurned = burnStats._sum.amount || new Decimal(0);
    const totalCirculating = new Decimal(totalAirdrop.toString()).minus(
      totalBurned.toString(),
    );

    return {
      overview: {
        totalAirdrop: totalAirdrop.toString(),
        totalBurned: totalBurned.toString(),
        totalCirculating: totalCirculating.toString(),
        totalStaked: stakingStats._sum.amount?.toString() || '0',
        totalDividends: dividendStats._sum.dividendAmount?.toString() || '0',
      },
      airdrop: {
        total: totalAirdrop.toString(),
        count: airdropStats._count,
      },
      staking: {
        total: stakingStats._sum.amount?.toString() || '0',
        count: stakingStats._count,
      },
      burn: {
        total: totalBurned.toString(),
        count: burnStats._count,
      },
      userHoldings: {
        available: userBalanceStats._sum.availableBalance?.toString() || '0',
        locked: userBalanceStats._sum.lockedBalance?.toString() || '0',
        total: new Decimal(userBalanceStats._sum.hootBalance?.toString() || '0')
          .plus(userBalanceStats._sum.lockedBalance?.toString() || '0')
          .plus(userBalanceStats._sum.availableBalance?.toString() || '0')
          .toString(),
      },
    };
  }

  // 获取代币流通记录
  async getCirculationRecords(
    page: number = 1,
    limit: number = 50,
    type?: string,
    direction?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (direction) where.direction = direction;

    const [records, total] = await Promise.all([
      this.prisma.tokenCirculation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tokenCirculation.count({ where }),
    ]);

    return {
      items: records.map((r) => ({
        ...r,
        amount: r.amount.toString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 获取空投记录
  async getAirdropRecords(
    page: number = 1,
    limit: number = 50,
    status?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [airdrops, total] = await Promise.all([
      this.prisma.airdrop.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              nickname: true,
            },
          },
        },
      }),
      this.prisma.airdrop.count({ where }),
    ]);

    return {
      items: airdrops.map((a) => {
        // 计算释放结束时间
        const vestingEndAt = new Date(a.vestingStart);
        vestingEndAt.setDate(vestingEndAt.getDate() + a.vestingDays);

        return {
          ...a,
          amount: a.amount.toString(),
          balance: a.balance.toString(),
          releasedAmount: a.releasedAmount.toString(),
          vestingStartAt: a.vestingStart,
          vestingEndAt: vestingEndAt,
          reason: a.type, // 空投类型作为原因
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 获取按类型分组的流通统计
  async getCirculationByType() {
    const stats = await this.prisma.tokenCirculation.groupBy({
      by: ['type', 'direction'],
      _sum: { amount: true },
      _count: true,
    });

    return stats.map((s) => ({
      type: s.type,
      direction: s.direction,
      amount: s._sum.amount?.toString() || '0',
      count: s._count,
    }));
  }

  // 获取流通趋势数据
  async getCirculationTrend(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await this.prisma.platformDailyStats.findMany({
      where: {
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        hootCirculating: true,
        hootStaked: true,
        hootBurned: true,
      },
    });

    return stats.map((s) => ({
      date: s.date.toISOString().split('T')[0],
      circulating: s.hootCirculating.toString(),
      staked: s.hootStaked.toString(),
      burned: s.hootBurned.toString(),
    }));
  }

  // 记录代币流通事件
  async recordCirculation(data: {
    type: string;
    amount: string;
    direction: 'in' | 'out';
    userId?: string;
    fromAddress?: string;
    toAddress?: string;
    description?: string;
    relatedType?: string;
    relatedId?: string;
    txHash?: string;
  }) {
    const record = await this.prisma.tokenCirculation.create({
      data: {
        type: data.type,
        amount: new Decimal(data.amount),
        direction: data.direction,
        userId: data.userId,
        fromAddress: data.fromAddress,
        toAddress: data.toAddress,
        description: data.description,
        relatedType: data.relatedType,
        relatedId: data.relatedId,
        txHash: data.txHash,
      },
    });

    this.logger.log(
      `代币流通记录: ${data.type} ${data.direction} ${data.amount}`,
    );
    return record;
  }

  // 获取 HOOT 持有者排行榜
  async getHootHolders(limit: number = 50) {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { hootBalance: { gt: 0 } },
          { lockedBalance: { gt: 0 } },
          { availableBalance: { gt: 0 } },
        ],
      },
      orderBy: [{ hootBalance: 'desc' }, { availableBalance: 'desc' }],
      take: limit,
      select: {
        id: true,
        email: true,
        nickname: true,
        hootBalance: true,
        lockedBalance: true,
        availableBalance: true,
        createdAt: true,
      },
    });

    return users.map((u, index) => ({
      rank: index + 1,
      id: u.id,
      email: u.email,
      nickname: u.nickname,
      hootBalance: u.hootBalance.toString(),
      lockedBalance: u.lockedBalance.toString(),
      availableBalance: u.availableBalance.toString(),
      totalBalance: new Decimal(u.hootBalance.toString())
        .plus(u.lockedBalance.toString())
        .plus(u.availableBalance.toString())
        .toString(),
      createdAt: u.createdAt,
    }));
  }
}
