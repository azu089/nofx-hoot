import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  CreateStakingDto,
  StakingResponse,
  StakingStats,
  DividendResponse,
} from './dto/staking.dto';

@Injectable()
export class StakingService {
  private readonly logger = new Logger(StakingService.name);

  // 权重计算常量
  private readonly MAX_WEIGHT = 3.0;
  private readonly MAX_DAYS_FOR_MAX_WEIGHT = 365;
  private readonly BASE_WEIGHT = 1.0;

  constructor(private prisma: PrismaService) {}

  // 计算质押权重（1.0x -> 3.0x，基于锁定天数）
  // 活期（lockDays=0）：1.0x
  // 定期：根据锁定时间增加权重
  calculateWeight(stakedAt: Date, lockDays: number = 0): number {
    if (lockDays === 0) {
      // 活期质押，固定权重 1.0
      return this.BASE_WEIGHT;
    }

    // 定期质押：权重随锁定时间增长
    // 权重 = 1.0 + (lockDays / 365) * 2.0，最高 3.0x
    const weight =
      this.BASE_WEIGHT + (lockDays / this.MAX_DAYS_FOR_MAX_WEIGHT) * 2.0;
    return Math.min(weight, this.MAX_WEIGHT);
  }

  // 创建质押
  async stake(userId: string, dto: CreateStakingDto): Promise<StakingResponse> {
    const amount = new Decimal(dto.amount.toString());

    // 计算锁定到期时间（不依赖用户数据，可在事务外计算）
    const lockDays = dto.lockDays || 0;
    const lockUntil =
      lockDays > 0
        ? new Date(Date.now() + lockDays * 24 * 60 * 60 * 1000)
        : null;

    // 执行质押（事务）：余额检查与扣款在同一事务内，防止 TOCTOU 并发问题
    const staking = await this.prisma.$transaction(async (tx) => {
      // 在事务内读取用户余额
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { hootBalance: true },
      });

      if (!user) {
        throw new NotFoundException('用户不存在');
      }

      // 在事务内检查余额，与扣款操作原子不可分割
      const balance = new Decimal(user.hootBalance.toString());
      if (balance.lessThan(amount)) {
        throw new BadRequestException('HOOT 余额不足');
      }

      // 扣除 HOOT 余额
      await tx.user.update({
        where: { id: userId },
        data: {
          hootBalance: {
            decrement: amount,
          },
        },
      });

      // 计算权重
      const weight = lockDays > 0 ? 1.0 + (lockDays / 365) * 2.0 : 1.0;
      const finalWeight = Math.min(weight, 3.0);

      // 创建质押记录
      return tx.stakingRecord.create({
        data: {
          userId,
          amount,
          lockDays,
          lockUntil,
          weight: finalWeight,
          status: lockDays > 0 ? 'locked' : 'active',
        },
      });
    });

    const weight = this.calculateWeight(staking.stakedAt, lockDays);
    const weightedAmount = new Decimal(staking.amount.toString()).times(weight);

    this.logger.log(
      `用户 ${userId} 质押 ${dto.amount} HOOT, 锁定: ${lockDays} 天, 权重: ${weight.toFixed(2)}`,
    );

    return {
      id: staking.id,
      amount: staking.amount.toString(),
      weight: weight.toFixed(2),
      weightedAmount: weightedAmount.toFixed(8),
      stakedAt: staking.stakedAt,
      lockDays: staking.lockDays,
      lockUntil: staking.lockUntil,
      status: staking.status,
    };
  }

  // 解除质押
  async unstake(
    userId: string,
    stakingId: string,
  ): Promise<{ message: string; returnedAmount: string }> {
    const staking = await this.prisma.stakingRecord.findUnique({
      where: { id: stakingId },
    });

    if (!staking) {
      throw new NotFoundException('质押记录不存在');
    }

    if (staking.userId !== userId) {
      throw new BadRequestException('无权操作此质押记录');
    }

    if (staking.status !== 'active') {
      throw new BadRequestException('该质押已解除');
    }

    // 检查是否在锁定期内
    const now = new Date();
    let penalty = new Decimal(0);
    let returnedAmount = new Decimal(staking.amount.toString());

    if (staking.lockUntil && now < staking.lockUntil) {
      // 提前解押，收取 10% 惩罚
      penalty = returnedAmount.times(0.1);
      returnedAmount = returnedAmount.minus(penalty);
      this.logger.log(
        `用户 ${userId} 提前解押, 惩罚: ${penalty.toString()} HOOT`,
      );
    }

    // 执行解押（事务）
    await this.prisma.$transaction(async (tx) => {
      // 更新质押记录状态
      await tx.stakingRecord.update({
        where: { id: stakingId },
        data: {
          status: 'unstaked',
          unstakedAt: now,
        },
      });

      // 返还 HOOT（扣除惩罚）
      await tx.user.update({
        where: { id: userId },
        data: {
          hootBalance: {
            increment: returnedAmount,
          },
        },
      });

      // 如果有惩罚，记录到交易历史（销毁或归入分红池）
      if (penalty.greaterThan(0)) {
        await tx.transaction.create({
          data: {
            userId,
            type: 'staking_penalty',
            asset: 'HOOT',
            amount: penalty.negated(), // 负数表示扣除
            uniqueOrderId: `penalty_${stakingId}_${Date.now()}`,
            status: 'completed',
            remark: '提前解押惩罚',
          },
        });
      }
    });

    return {
      message: penalty.greaterThan(0)
        ? `解押成功，提前解押惩罚 ${penalty.toString()} HOOT`
        : '解押成功',
      returnedAmount: returnedAmount.toString(),
    };
  }

  // 获取用户质押列表
  async getMyStakings(userId: string): Promise<StakingResponse[]> {
    const stakings = await this.prisma.stakingRecord.findMany({
      where: { userId, status: { in: ['active', 'locked'] } },
      orderBy: { stakedAt: 'desc' },
    });

    return stakings.map((s) => {
      const weight = this.calculateWeight(s.stakedAt, s.lockDays);
      const weightedAmount = new Decimal(s.amount.toString()).times(weight);

      return {
        id: s.id,
        amount: s.amount.toString(),
        weight: weight.toFixed(2),
        weightedAmount: weightedAmount.toFixed(8),
        stakedAt: s.stakedAt,
        lockDays: s.lockDays,
        lockUntil: s.lockUntil,
        status: s.status,
      };
    });
  }

  // 获取质押统计
  async getMyStats(userId: string): Promise<StakingStats> {
    const stakings = await this.prisma.stakingRecord.findMany({
      where: { userId, status: { in: ['active', 'locked'] } },
    });

    let totalStaked = new Decimal(0);
    let totalWeighted = new Decimal(0);

    for (const s of stakings) {
      const amount = new Decimal(s.amount.toString());
      const weight = this.calculateWeight(s.stakedAt, s.lockDays);
      totalStaked = totalStaked.plus(amount);
      totalWeighted = totalWeighted.plus(amount.times(weight));
    }

    // 获取最近一周的分红池（如有）
    const latestPool = await this.prisma.dividendPool.findFirst({
      where: { status: 'pending' },
      orderBy: { periodEnd: 'desc' },
    });

    // 估算周分红（基于上一期数据）
    let estimatedDividend = new Decimal(0);
    if (latestPool && totalWeighted.greaterThan(0)) {
      const poolTotal = new Decimal(latestPool.totalWeighted.toString());
      if (poolTotal.greaterThan(0)) {
        const share = totalWeighted.div(poolTotal);
        estimatedDividend = new Decimal(
          latestPool.totalAmount.toString(),
        ).times(share);
      }
    }

    // 计算下次分红日期（每周日）
    const nextSunday = this.getNextSunday();

    return {
      totalStaked: totalStaked.toString(),
      totalWeighted: totalWeighted.toFixed(8),
      estimatedWeeklyDividend: estimatedDividend.toFixed(8),
      nextDividendDate: nextSunday,
    };
  }

  // 获取分红历史
  async getMyDividends(userId: string): Promise<DividendResponse[]> {
    const dividends = await this.prisma.dividendRecord.findMany({
      where: {
        staking: {
          userId,
        },
      },
      orderBy: { periodEnd: 'desc' },
      take: 50,
    });

    return dividends.map((d) => ({
      id: d.id,
      periodStart: d.periodStart,
      periodEnd: d.periodEnd,
      stakedAmount: d.stakedAmount.toString(),
      weightedAmount: d.weightedAmount.toString(),
      dividendAmount: d.dividendAmount.toString(),
      status: d.status,
      paidAt: d.paidAt,
    }));
  }

  // 获取全网质押统计（公开）
  async getGlobalStats() {
    const [totalStakers, stakingData, latestPool] = await Promise.all([
      this.prisma.stakingRecord
        .groupBy({
          by: ['userId'],
          where: { status: { in: ['active', 'locked'] } },
        })
        .then((r) => r.length),
      this.prisma.stakingRecord.findMany({
        where: { status: { in: ['active', 'locked'] } },
      }),
      this.prisma.dividendPool.findFirst({
        where: { status: 'distributed' },
        orderBy: { periodEnd: 'desc' },
      }),
    ]);

    let totalStaked = new Decimal(0);
    let totalWeighted = new Decimal(0);

    for (const s of stakingData) {
      const amount = new Decimal(s.amount.toString());
      const weight = this.calculateWeight(s.stakedAt, s.lockDays);
      totalStaked = totalStaked.plus(amount);
      totalWeighted = totalWeighted.plus(amount.times(weight));
    }

    return {
      totalStakers,
      totalStaked: totalStaked.toString(),
      totalWeighted: totalWeighted.toFixed(8),
      lastDividendAmount: latestPool?.distributedAmount.toString() || '0',
      lastDividendDate: latestPool?.distributedAt || null,
    };
  }

  // 获取质押排行榜（公开）
  async getLeaderboard(limit: number = 10) {
    // 获取所有活跃质押记录，按加权质押量排序
    const stakingRecords = await this.prisma.stakingRecord.findMany({
      where: { status: { in: ['active', 'locked'] } },
      include: {
        user: {
          select: {
            id: true,
            walletAddress: true,
          },
        },
      },
    });

    // 按用户聚合质押数据
    const userStakingMap = new Map<
      string,
      {
        userId: string;
        walletAddress: string | null;
        totalStaked: Decimal;
        totalWeighted: Decimal;
        maxWeight: number;
        totalDividends: Decimal;
      }
    >();

    for (const record of stakingRecords) {
      const weight = this.calculateWeight(record.stakedAt, record.lockDays);
      const staked = new Decimal(record.amount.toString());
      const weighted = staked.times(weight);
      const dividends = new Decimal(record.totalDividends?.toString() || '0');

      const existing = userStakingMap.get(record.userId);
      if (existing) {
        existing.totalStaked = existing.totalStaked.plus(staked);
        existing.totalWeighted = existing.totalWeighted.plus(weighted);
        existing.maxWeight = Math.max(existing.maxWeight, weight);
        existing.totalDividends = existing.totalDividends.plus(dividends);
      } else {
        userStakingMap.set(record.userId, {
          userId: record.userId,
          walletAddress: record.user.walletAddress,
          totalStaked: staked,
          totalWeighted: weighted,
          maxWeight: weight,
          totalDividends: dividends,
        });
      }
    }

    // 按加权质押量排序
    const sorted = Array.from(userStakingMap.values())
      .sort((a, b) => b.totalWeighted.minus(a.totalWeighted).toNumber())
      .slice(0, limit);

    // 格式化返回数据（隐藏敏感信息）
    return sorted.map((user, index) => ({
      rank: index + 1,
      address: user.walletAddress
        ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
        : `User${user.userId.slice(0, 4)}...`,
      staked: this.formatAmount(user.totalStaked),
      weight: `${user.maxWeight.toFixed(1)}x`,
      rewards: `$${user.totalDividends.toFixed(2)}`,
    }));
  }

  // 格式化金额显示
  private formatAmount(amount: Decimal): string {
    const num = amount.toNumber();
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(0)}K`;
    }
    return num.toLocaleString();
  }

  // 辅助方法：获取下个周日
  private getNextSunday(): Date {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(0, 0, 0, 0);
    return nextSunday;
  }

  // 领取奖励
  // 当前设计：分红是周期性自动分发的，此接口检查并返回分红状态
  async claimRewards(userId: string): Promise<{
    message: string;
    hasRewards: boolean;
    claimedAmount?: string;
    pendingAmount?: string;
    nextDistribution?: Date;
  }> {
    // 检查用户是否有质押
    const stakings = await this.prisma.stakingRecord.findMany({
      where: { userId, status: { in: ['active', 'locked'] } },
    });

    if (stakings.length === 0) {
      return {
        message: '您当前没有质押，请先质押 HOOT 以参与分红',
        hasRewards: false,
      };
    }

    // 检查是否有待分发的分红池
    const pendingPool = await this.prisma.dividendPool.findFirst({
      where: { status: 'pending' },
      orderBy: { periodEnd: 'desc' },
    });

    // 获取用户最近已领取的分红
    const recentDividends = await this.prisma.dividendRecord.findMany({
      where: {
        staking: { userId },
        status: 'paid',
      },
      orderBy: { paidAt: 'desc' },
      take: 5,
    });

    const totalClaimed = recentDividends.reduce(
      (sum, d) => sum.plus(d.dividendAmount.toString()),
      new Decimal(0),
    );

    // 计算下次分红日期
    const nextSunday = this.getNextSunday();

    if (pendingPool) {
      // 有待分发的分红池，计算预估奖励
      const stats = await this.getMyStats(userId);
      return {
        message: '有分红待分发，预计在下个周期自动到账',
        hasRewards: true,
        pendingAmount: stats.estimatedWeeklyDividend,
        nextDistribution: nextSunday,
      };
    }

    if (totalClaimed.greaterThan(0)) {
      return {
        message: '您的分红已自动发放到账户',
        hasRewards: true,
        claimedAmount: totalClaimed.toFixed(8),
        nextDistribution: nextSunday,
      };
    }

    return {
      message: '暂无可领取的奖励，分红将在每周日自动发放',
      hasRewards: false,
      nextDistribution: nextSunday,
    };
  }

  // ==================== 管理员方法 ====================

  // 分发周分红（由定时任务或管理员触发）
  async distributeDividends(
    poolId: string,
  ): Promise<{ message: string; totalDistributed: string }> {
    const pool = await this.prisma.dividendPool.findUnique({
      where: { id: poolId },
    });

    if (!pool) {
      throw new NotFoundException('分红池不存在');
    }

    if (pool.status === 'distributed') {
      throw new BadRequestException('该分红池已分发');
    }

    // 获取所有活跃质押
    const stakings = await this.prisma.stakingRecord.findMany({
      where: { status: { in: ['active', 'locked'] } },
      include: { user: true },
    });

    if (stakings.length === 0) {
      throw new BadRequestException('没有活跃质押');
    }

    // 计算总权重
    let totalWeighted = new Decimal(0);
    const stakingWeights: Array<{
      staking: (typeof stakings)[0];
      weight: number;
      weightedAmount: Decimal;
    }> = [];

    for (const s of stakings) {
      const weight = this.calculateWeight(s.stakedAt, s.lockDays);
      const weightedAmount = new Decimal(s.amount.toString()).times(weight);
      totalWeighted = totalWeighted.plus(weightedAmount);
      stakingWeights.push({ staking: s, weight, weightedAmount });
    }

    const poolAmount = new Decimal(pool.totalAmount.toString());
    let totalDistributed = new Decimal(0);

    // 执行分红（事务）
    await this.prisma.$transaction(async (tx) => {
      for (const { staking, weight, weightedAmount } of stakingWeights) {
        // 计算分红金额
        const share = weightedAmount.div(totalWeighted);
        const dividendAmount = poolAmount.times(share);

        // 创建分红记录
        await tx.dividendRecord.create({
          data: {
            stakingId: staking.id,
            periodStart: pool.periodStart,
            periodEnd: pool.periodEnd,
            stakedAmount: staking.amount,
            weightedAmount,
            totalWeighted,
            dividendAmount,
            asset: 'USDT',
            status: 'paid',
            paidAt: new Date(),
          },
        });

        // 增加用户 USDT 余额
        await tx.user.update({
          where: { id: staking.userId },
          data: {
            usdtBalance: {
              increment: dividendAmount,
            },
          },
        });

        // 记录交易
        await tx.transaction.create({
          data: {
            userId: staking.userId,
            type: 'dividend',
            asset: 'USDT',
            amount: dividendAmount,
            uniqueOrderId: `dividend_${pool.id}_${staking.id}`,
            status: 'completed',
            remark: `质押分红 ${pool.periodStart.toISOString().split('T')[0]} - ${pool.periodEnd.toISOString().split('T')[0]}`,
          },
        });

        totalDistributed = totalDistributed.plus(dividendAmount);
      }

      // 更新分红池状态
      await tx.dividendPool.update({
        where: { id: poolId },
        data: {
          status: 'distributed',
          distributedAmount: totalDistributed,
          distributedAt: new Date(),
          totalWeighted,
        },
      });
    });

    this.logger.log(
      `分红完成: ${poolAmount.toString()} USDT 分配给 ${stakings.length} 位质押者`,
    );

    return {
      message: `分红完成，共分发 ${totalDistributed.toFixed(8)} USDT 给 ${stakings.length} 位质押者`,
      totalDistributed: totalDistributed.toString(),
    };
  }

  // 创建分红池（管理员）
  async createDividendPool(totalAmount: number): Promise<any> {
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(now.getDate() - 7);
    periodStart.setHours(0, 0, 0, 0);

    const periodEnd = new Date(now);
    periodEnd.setHours(0, 0, 0, 0);

    // 获取当前全网质押数据
    const stakings = await this.prisma.stakingRecord.findMany({
      where: { status: { in: ['active', 'locked'] } },
    });

    let totalStaked = new Decimal(0);
    let totalWeighted = new Decimal(0);

    for (const s of stakings) {
      const amount = new Decimal(s.amount.toString());
      const weight = this.calculateWeight(s.stakedAt, s.lockDays);
      totalStaked = totalStaked.plus(amount);
      totalWeighted = totalWeighted.plus(amount.times(weight));
    }

    // 计算周数
    const startOfYear = new Date(periodStart.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((periodStart.getTime() - startOfYear.getTime()) / 86400000 +
        startOfYear.getDay() +
        1) /
        7,
    );

    const pool = await this.prisma.dividendPool.create({
      data: {
        periodStart,
        periodEnd,
        weekNumber,
        gasFeeTotal: new Decimal(totalAmount.toString()),
        gasFeeCount: 0,
        dividendRate: new Decimal(1.0),
        totalAmount: new Decimal(totalAmount.toString()),
        remainingAmount: new Decimal(totalAmount.toString()),
        totalStaked,
        totalWeighted,
        stakerCount: stakings.length,
        status: 'pending',
      },
    });

    this.logger.log(`创建分红池: ${pool.id}, 金额: ${totalAmount} USDT`);

    return {
      ...pool,
      totalAmount: pool.totalAmount.toString(),
      totalStaked: pool.totalStaked.toString(),
      totalWeighted: pool.totalWeighted.toString(),
    };
  }
}
