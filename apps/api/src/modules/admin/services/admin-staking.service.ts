/**
 * 管理后台 - 质押分红管理服务
 * 质押统计、分红池管理、分红发放
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import Decimal from 'decimal.js';

@Injectable()
export class AdminStakingService {
  private readonly logger = new Logger(AdminStakingService.name);

  constructor(private prisma: PrismaService) {}

  // 获取质押统计概览
  async getStakingOverview() {
    const [
      totalStaked,
      totalStakers,
      activeStakingRecords,
      totalDividendsDistributed,
      pendingDividendPool,
      currentWeekGasFee,
    ] = await Promise.all([
      // 总质押量
      this.prisma.stakingRecord.aggregate({
        where: { status: 'active' },
        _sum: { amount: true },
      }),
      // 质押人数
      this.prisma.stakingRecord.groupBy({
        by: ['userId'],
        where: { status: 'active' },
      }),
      // 活跃质押记录数
      this.prisma.stakingRecord.count({
        where: { status: 'active' },
      }),
      // 累计分红
      this.prisma.dividendRecord.aggregate({
        where: { status: 'paid' },
        _sum: { dividendAmount: true },
      }),
      // 待分配分红池
      this.prisma.dividendPool.aggregate({
        where: { status: { in: ['collecting', 'pending'] } },
        _sum: { totalAmount: true },
      }),
      // 本周燃油费
      this.getCurrentWeekGasFee(),
    ]);

    // 计算全网加权质押量
    const weightedStaking = await this.calculateTotalWeightedStaking();

    return {
      totalStaked: totalStaked._sum.amount?.toString() || '0',
      totalStakers: totalStakers.length,
      activeRecords: activeStakingRecords,
      totalDividends: totalDividendsDistributed._sum.dividendAmount?.toString() || '0',
      pendingDividend: pendingDividendPool._sum.totalAmount?.toString() || '0',
      currentWeekGasFee: currentWeekGasFee.toString(),
      weightedStaking: weightedStaking.toString(),
    };
  }

  // 获取本周燃油费
  private async getCurrentWeekGasFee() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    const result = await this.prisma.gasFeeRecord.aggregate({
      where: {
        createdAt: { gte: startOfWeek },
      },
      _sum: { feeAmount: true },
    });

    return result._sum.feeAmount || new Decimal(0);
  }

  // 计算全网加权质押量
  private async calculateTotalWeightedStaking() {
    const stakingRecords = await this.prisma.stakingRecord.findMany({
      where: { status: 'active' },
    });

    return stakingRecords.reduce((sum, record) => {
      const weighted = new Decimal(record.amount.toString())
        .mul(record.weight.toString());
      return new Decimal(sum).plus(weighted);
    }, new Decimal(0));
  }

  // 获取分红池列表
  async getDividendPools(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [pools, total] = await Promise.all([
      this.prisma.dividendPool.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dividendPool.count(),
    ]);

    return {
      items: pools.map((p) => ({
        ...p,
        gasFeeTotal: p.gasFeeTotal.toString(),
        dividendRate: p.dividendRate.toString(),
        totalAmount: p.totalAmount.toString(),
        distributedAmount: p.distributedAmount.toString(),
        remainingAmount: p.remainingAmount.toString(),
        totalStaked: p.totalStaked.toString(),
        totalWeighted: p.totalWeighted.toString(),
        dividendPerWeight: p.dividendPerWeight?.toString() || '0',
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 创建分红池（基于燃油费）
  async createDividendPool(dividendRate: number = 0.5) {
    // 获取当前周期
    const now = new Date();
    const dayOfWeek = now.getDay();

    // 上周一到上周日
    const periodEnd = new Date(now);
    periodEnd.setDate(now.getDate() - (dayOfWeek === 0 ? 0 : dayOfWeek));
    periodEnd.setHours(23, 59, 59, 999);

    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodEnd.getDate() - 6);
    periodStart.setHours(0, 0, 0, 0);

    // 检查是否已存在
    const existing = await this.prisma.dividendPool.findFirst({
      where: {
        periodStart,
        periodEnd,
      },
    });

    if (existing) {
      throw new BadRequestException('该周期分红池已存在');
    }

    // 获取该周期燃油费
    const gasFeeResult = await this.prisma.gasFeeRecord.aggregate({
      where: {
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      _sum: { feeAmount: true },
      _count: true,
    });

    const gasFeeTotal = gasFeeResult._sum.feeAmount || new Decimal(0);
    const gasFeeCount = gasFeeResult._count;

    // 计算分红池金额
    const totalAmount = new Decimal(gasFeeTotal.toString()).mul(dividendRate);

    // 获取质押快照
    const stakingRecords = await this.prisma.stakingRecord.findMany({
      where: { status: 'active' },
    });

    const totalStaked = stakingRecords.reduce(
      (sum, r) => new Decimal(sum).plus(r.amount),
      new Decimal(0),
    );

    const totalWeighted = stakingRecords.reduce(
      (sum, r) => new Decimal(sum).plus(
        new Decimal(r.amount.toString()).mul(r.weight.toString()),
      ),
      new Decimal(0),
    );

    // 计算年度周数
    const startOfYear = new Date(periodStart.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((periodStart.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
    );

    // 创建分红池
    const pool = await this.prisma.dividendPool.create({
      data: {
        periodStart,
        periodEnd,
        weekNumber,
        gasFeeTotal,
        gasFeeCount,
        dividendRate,
        totalAmount,
        remainingAmount: totalAmount,
        totalStaked,
        totalWeighted,
        stakerCount: stakingRecords.length,
        status: 'pending',
      },
    });

    this.logger.log(`创建分红池: ${pool.id}, 金额: ${totalAmount.toString()}`);

    return {
      ...pool,
      gasFeeTotal: pool.gasFeeTotal.toString(),
      dividendRate: pool.dividendRate.toString(),
      totalAmount: pool.totalAmount.toString(),
      totalStaked: pool.totalStaked.toString(),
      totalWeighted: pool.totalWeighted.toString(),
    };
  }

  // 分发分红
  async distributeDividends(poolId: string) {
    const pool = await this.prisma.dividendPool.findUnique({
      where: { id: poolId },
    });

    if (!pool) {
      throw new NotFoundException('分红池不存在');
    }

    if (pool.status === 'distributed') {
      throw new BadRequestException('该分红池已分发');
    }

    // 获取所有活跃质押记录
    const stakingRecords = await this.prisma.stakingRecord.findMany({
      where: { status: 'active' },
      include: { user: true },
    });

    if (stakingRecords.length === 0) {
      throw new BadRequestException('没有活跃的质押记录');
    }

    // 计算每单位权重分红
    const dividendPerWeight = new Decimal(pool.totalAmount.toString())
      .div(pool.totalWeighted.toString());

    // 分发分红
    await this.prisma.$transaction(async (tx) => {
      let distributedAmount = new Decimal(0);

      for (const record of stakingRecords) {
        const weightedAmount = new Decimal(record.amount.toString())
          .mul(record.weight.toString());
        const dividendAmount = weightedAmount.mul(dividendPerWeight);

        // 创建分红记录
        await tx.dividendRecord.create({
          data: {
            stakingId: record.id,
            periodStart: pool.periodStart,
            periodEnd: pool.periodEnd,
            stakedAmount: record.amount,
            weightedAmount,
            totalWeighted: pool.totalWeighted,
            dividendAmount,
            asset: 'USDT',
            status: 'paid',
            paidAt: new Date(),
          },
        });

        // 更新用户余额
        await tx.user.update({
          where: { id: record.userId },
          data: {
            usdtBalance: { increment: dividendAmount },
          },
        });

        // 更新质押记录的累计分红
        await tx.stakingRecord.update({
          where: { id: record.id },
          data: {
            totalDividends: { increment: dividendAmount },
          },
        });

        // 创建交易记录
        await tx.transaction.create({
          data: {
            userId: record.userId,
            type: 'reward',
            asset: 'USDT',
            amount: dividendAmount,
            uniqueOrderId: `dividend_${poolId}_${record.id}_${Date.now()}`,
            status: 'completed',
            remark: `质押分红 - 周${pool.weekNumber}`,
          },
        });

        distributedAmount = distributedAmount.plus(dividendAmount);
      }

      // 更新分红池状态
      await tx.dividendPool.update({
        where: { id: poolId },
        data: {
          status: 'distributed',
          distributedAmount,
          remainingAmount: new Decimal(pool.totalAmount.toString()).minus(distributedAmount),
          dividendPerWeight,
          distributedAt: new Date(),
        },
      });
    });

    this.logger.log(`分红分发完成: ${poolId}, 分发给 ${stakingRecords.length} 人`);

    return {
      message: '分红分发成功',
      poolId,
      stakerCount: stakingRecords.length,
      totalDistributed: pool.totalAmount.toString(),
    };
  }

  // 获取质押排行榜
  async getStakingLeaderboard(limit: number = 20) {
    const records = await this.prisma.stakingRecord.findMany({
      where: { status: 'active' },
      orderBy: { amount: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nickname: true,
          },
        },
      },
    });

    return records.map((r, index) => ({
      rank: index + 1,
      userId: r.userId,
      user: r.user,
      amount: r.amount.toString(),
      weight: r.weight.toString(),
      weightedAmount: new Decimal(r.amount.toString())
        .mul(r.weight.toString())
        .toString(),
      totalDividends: r.totalDividends.toString(),
      stakedAt: r.stakedAt,
    }));
  }

  // 获取质押记录列表
  async getStakingRecords(page: number = 1, limit: number = 20, status?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [records, total] = await Promise.all([
      this.prisma.stakingRecord.findMany({
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
      this.prisma.stakingRecord.count({ where }),
    ]);

    return {
      items: records.map((r) => ({
        ...r,
        amount: r.amount.toString(),
        weight: r.weight.toString(),
        totalDividends: r.totalDividends.toString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
