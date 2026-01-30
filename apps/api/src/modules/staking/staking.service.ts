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
  StakingType,
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
  private readonly A_TYPE_WEIGHT = 1.0;

  constructor(private prisma: PrismaService) {}

  // 计算 B 类质押权重（1.0x -> 3.0x，最长 365 天）
  calculateWeight(type: string, stakedAt: Date, lockDays: number = 0): number {
    if (type === 'A') {
      return this.A_TYPE_WEIGHT;
    }

    // B 类：权重随时间增长
    const now = new Date();
    const daysStaked = Math.floor(
      (now.getTime() - stakedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    // 使用更长的时间（质押时长或锁定期）
    const effectiveDays = Math.max(daysStaked, lockDays);

    // 权重 = 1.0 + (effectiveDays / 365) * 2.0，最高 3.0x
    const weight = 1.0 + (effectiveDays / this.MAX_DAYS_FOR_MAX_WEIGHT) * 2.0;
    return Math.min(weight, this.MAX_WEIGHT);
  }

  // 创建质押
  async stake(userId: string, dto: CreateStakingDto): Promise<StakingResponse> {
    const amount = new Decimal(dto.amount.toString());

    // 检查用户 HOOT 余额
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { hootBalance: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const balance = new Decimal(user.hootBalance.toString());
    if (balance.lessThan(amount)) {
      throw new BadRequestException('HOOT 余额不足');
    }

    // 计算锁定到期时间
    const lockDays = dto.lockDays || 0;
    const lockUntil = lockDays > 0
      ? new Date(Date.now() + lockDays * 24 * 60 * 60 * 1000)
      : null;

    // 执行质押（事务）
    const staking = await this.prisma.$transaction(async (tx) => {
      // 扣除 HOOT 余额
      await tx.user.update({
        where: { id: userId },
        data: {
          hootBalance: {
            decrement: amount,
          },
        },
      });

      // 创建质押记录
      return tx.stakingRecord.create({
        data: {
          userId,
          type: dto.type,
          amount,
          lockDays,
          lockUntil,
          status: 'active',
        },
      });
    });

    const weight = this.calculateWeight(dto.type, staking.stakedAt, lockDays);
    const weightedAmount = new Decimal(staking.amount.toString()).times(weight);

    this.logger.log(`用户 ${userId} 质押 ${dto.amount} HOOT, 类型: ${dto.type}, 锁定: ${lockDays} 天`);

    return {
      id: staking.id,
      type: staking.type,
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
  async unstake(userId: string, stakingId: string): Promise<{ message: string; returnedAmount: string }> {
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
      this.logger.log(`用户 ${userId} 提前解押, 惩罚: ${penalty.toString()} HOOT`);
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
      where: { userId, status: 'active' },
      orderBy: { stakedAt: 'desc' },
    });

    return stakings.map((s) => {
      const weight = this.calculateWeight(s.type, s.stakedAt, s.lockDays);
      const weightedAmount = new Decimal(s.amount.toString()).times(weight);

      return {
        id: s.id,
        type: s.type,
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
      where: { userId, status: 'active' },
    });

    let totalStaked = new Decimal(0);
    let totalWeighted = new Decimal(0);

    for (const s of stakings) {
      const amount = new Decimal(s.amount.toString());
      const weight = this.calculateWeight(s.type, s.stakedAt, s.lockDays);
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
        estimatedDividend = new Decimal(latestPool.totalAmount.toString()).times(share);
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
      this.prisma.stakingRecord.groupBy({
        by: ['userId'],
        where: { status: 'active' },
      }).then((r) => r.length),
      this.prisma.stakingRecord.findMany({
        where: { status: 'active' },
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
      const weight = this.calculateWeight(s.type, s.stakedAt, s.lockDays);
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

  // ==================== 管理员方法 ====================

  // 分发周分红（由定时任务或管理员触发）
  async distributeDividends(poolId: string): Promise<{ message: string; totalDistributed: string }> {
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
      where: { status: 'active' },
      include: { user: true },
    });

    if (stakings.length === 0) {
      throw new BadRequestException('没有活跃质押');
    }

    // 计算总权重
    let totalWeighted = new Decimal(0);
    const stakingWeights: Array<{ staking: typeof stakings[0]; weight: number; weightedAmount: Decimal }> = [];

    for (const s of stakings) {
      const weight = this.calculateWeight(s.type, s.stakedAt, s.lockDays);
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

    this.logger.log(`分红完成: ${poolAmount.toString()} USDT 分配给 ${stakings.length} 位质押者`);

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
      where: { status: 'active' },
    });

    let totalStaked = new Decimal(0);
    let totalWeighted = new Decimal(0);

    for (const s of stakings) {
      const amount = new Decimal(s.amount.toString());
      const weight = this.calculateWeight(s.type, s.stakedAt, s.lockDays);
      totalStaked = totalStaked.plus(amount);
      totalWeighted = totalWeighted.plus(amount.times(weight));
    }

    const pool = await this.prisma.dividendPool.create({
      data: {
        periodStart,
        periodEnd,
        totalAmount: new Decimal(totalAmount.toString()),
        totalStaked,
        totalWeighted,
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
