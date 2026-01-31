import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from 'decimal.js';
import {
  AirdropType,
  AirdropStatus,
  AIRDROP_REWARDS,
  AIRDROP_CAPS,
  VESTING_CONFIG,
  AirdropBalanceDto,
  QueryAirdropDto,
} from './dto/airdrop.dto';

@Injectable()
export class AirdropService {
  private readonly logger = new Logger(AirdropService.name);

  constructor(private prisma: PrismaService) {}

  // ==================== 空投发放 ====================

  /**
   * 发放空投奖励
   */
  async grantAirdrop(
    userId: string,
    type: AirdropType,
    options?: {
      amount?: number;      // 自定义金额（如盈利交易）
      source?: string;      // 来源说明
      sourceId?: string;    // 关联ID
      vestingDays?: number; // 释放天数
    },
  ): Promise<void> {
    // 计算空投金额
    let amount: number;
    if (options?.amount) {
      amount = options.amount;
    } else if (type === AirdropType.TRADING_PROFIT) {
      throw new BadRequestException('盈利交易空投必须指定金额');
    } else {
      amount = AIRDROP_REWARDS[type] as number;
    }

    const vestingDays = options?.vestingDays || VESTING_CONFIG.defaultDays;

    // 使用事务
    await this.prisma.$transaction(async (tx) => {
      // 获取当前用户余额
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { hootBalance: true, lockedBalance: true },
      });

      if (!user) {
        throw new BadRequestException('用户不存在');
      }

      const currentBalance = new Decimal(user.hootBalance.toString());
      const currentLocked = new Decimal(user.lockedBalance.toString());
      const airdropAmount = new Decimal(amount);
      const newBalance = currentBalance.plus(airdropAmount);
      const newLocked = currentLocked.plus(airdropAmount);

      // 创建空投记录
      await tx.airdrop.create({
        data: {
          userId,
          type,
          amount: airdropAmount.toString(),
          balance: newBalance.toString(),
          source: options?.source,
          sourceId: options?.sourceId,
          vestingDays,
          vestingStart: new Date(),
          status: AirdropStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      // 更新用户余额
      await tx.user.update({
        where: { id: userId },
        data: {
          hootBalance: newBalance.toString(),
          lockedBalance: newLocked.toString(),
        },
      });

      this.logger.log(
        `空投发放成功: userId=${userId}, type=${type}, amount=${amount} HOOT`,
      );
    });
  }

  /**
   * 注册空投
   */
  async grantRegisterAirdrop(userId: string): Promise<void> {
    // 检查是否已发放过注册空投
    const existing = await this.prisma.airdrop.findFirst({
      where: {
        userId,
        type: AirdropType.REGISTER,
        status: { not: AirdropStatus.CANCELLED },
      },
    });

    if (existing) {
      this.logger.warn(`用户 ${userId} 已领取过注册空投`);
      return;
    }

    await this.grantAirdrop(userId, AirdropType.REGISTER, {
      source: '新用户注册奖励',
    });
  }

  /**
   * 绑定 Telegram 空投（已有账户额外绑定）
   */
  async grantBindTgAirdrop(userId: string, telegramId: string): Promise<void> {
    // 检查是否已发放过
    const existing = await this.prisma.airdrop.findFirst({
      where: {
        userId,
        type: AirdropType.BIND_TG,
        status: { not: AirdropStatus.CANCELLED },
      },
    });

    if (existing) {
      this.logger.warn(`用户 ${userId} 已领取过 TG 绑定空投`);
      return;
    }

    await this.grantAirdrop(userId, AirdropType.BIND_TG, {
      source: `绑定 Telegram: ${telegramId}`,
      sourceId: telegramId,
    });
  }

  /**
   * 绑定钱包空投（已有账户额外绑定）
   */
  async grantBindWalletAirdrop(userId: string, walletAddress: string): Promise<void> {
    const existing = await this.prisma.airdrop.findFirst({
      where: {
        userId,
        type: AirdropType.BIND_WALLET,
        status: { not: AirdropStatus.CANCELLED },
      },
    });

    if (existing) {
      this.logger.warn(`用户 ${userId} 已领取过钱包绑定空投`);
      return;
    }

    await this.grantAirdrop(userId, AirdropType.BIND_WALLET, {
      source: `绑定钱包: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      sourceId: walletAddress,
    });
  }

  /**
   * 绑定邮箱空投（已有账户额外绑定 + 验证）
   */
  async grantBindEmailAirdrop(userId: string, email: string): Promise<void> {
    const existing = await this.prisma.airdrop.findFirst({
      where: {
        userId,
        type: AirdropType.BIND_EMAIL,
        status: { not: AirdropStatus.CANCELLED },
      },
    });

    if (existing) {
      this.logger.warn(`用户 ${userId} 已领取过邮箱绑定空投`);
      return;
    }

    await this.grantAirdrop(userId, AirdropType.BIND_EMAIL, {
      source: `绑定邮箱: ${email}`,
    });
  }

  /**
   * 邀请奖励空投
   */
  async grantReferralAirdrop(
    inviterId: string,
    inviteeId: string,
  ): Promise<void> {
    // 检查今日邀请奖励是否已达上限
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayReferralAirdrop = await this.prisma.airdrop.aggregate({
      where: {
        userId: inviterId,
        type: AirdropType.REFERRAL,
        createdAt: { gte: today, lt: tomorrow },
        status: { not: AirdropStatus.CANCELLED },
      },
      _sum: { amount: true },
    });
    const todayAmount = new Decimal(todayReferralAirdrop._sum.amount?.toString() || '0');

    if (todayAmount.gte(AIRDROP_CAPS.referralDailyCap)) {
      this.logger.log(`用户 ${inviterId} 今日邀请奖励已达上限 ${AIRDROP_CAPS.referralDailyCap} HOOT`);
      return; // 今日已达上限
    }

    await this.grantAirdrop(inviterId, AirdropType.REFERRAL, {
      source: `邀请用户奖励`,
      sourceId: inviteeId,
    });
  }

  /**
   * 盈利交易空投
   * @param profitUsdt 盈利金额 USDT
   */
  async grantTradingProfitAirdrop(
    userId: string,
    profitUsdt: number,
    positionId: string,
  ): Promise<void> {
    if (profitUsdt <= 0) {
      return; // 只有盈利才发放
    }

    // 检查今日交易盈利空投是否已达上限
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayTradingAirdrop = await this.prisma.airdrop.aggregate({
      where: {
        userId,
        type: AirdropType.TRADING_PROFIT,
        createdAt: { gte: today, lt: tomorrow },
        status: { not: AirdropStatus.CANCELLED },
      },
      _sum: { amount: true },
    });
    const todayAmount = new Decimal(todayTradingAirdrop._sum.amount?.toString() || '0');

    if (todayAmount.gte(AIRDROP_CAPS.tradingProfitDailyCap)) {
      this.logger.log(`用户 ${userId} 今日交易盈利空投已达上限 ${AIRDROP_CAPS.tradingProfitDailyCap} HOOT`);
      return; // 今日已达上限，不发放
    }

    // 盈利 * 5 = HOOT 数量
    let hootAmount = profitUsdt * (AIRDROP_REWARDS[AirdropType.TRADING_PROFIT] as number);

    // 如果加上本次会超过每日上限，则只发放剩余额度
    const remaining = AIRDROP_CAPS.tradingProfitDailyCap - todayAmount.toNumber();
    if (hootAmount > remaining) {
      hootAmount = remaining;
    }

    if (hootAmount <= 0) {
      return;
    }

    await this.grantAirdrop(userId, AirdropType.TRADING_PROFIT, {
      amount: hootAmount,
      source: `盈利交易奖励: ${profitUsdt} USDT`,
      sourceId: positionId,
      vestingDays: 30, // 盈利空投 30 天释放
    });
  }

  // ==================== 签到系统 ====================

  /**
   * 每日签到
   */
  async checkin(userId: string): Promise<{
    success: boolean;
    reward: number;
    streak: number;
    message: string;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 检查今日是否已签到
    const todayCheckin = await this.prisma.checkinRecord.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    if (todayCheckin) {
      return {
        success: false,
        reward: 0,
        streak: todayCheckin.streak,
        message: '今日已签到',
      };
    }

    // 检查签到终身上限
    const totalCheckinAirdrop = await this.prisma.airdrop.aggregate({
      where: {
        userId,
        type: AirdropType.CHECKIN,
        status: { not: AirdropStatus.CANCELLED },
      },
      _sum: { amount: true },
    });
    const totalCheckinAmount = new Decimal(totalCheckinAirdrop._sum.amount?.toString() || '0');

    if (totalCheckinAmount.gte(AIRDROP_CAPS.checkinLifetimeCap)) {
      return {
        success: false,
        reward: 0,
        streak: 0,
        message: `签到奖励已达终身上限 ${AIRDROP_CAPS.checkinLifetimeCap} HOOT`,
      };
    }

    // 获取昨日签到记录
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const yesterdayCheckin = await this.prisma.checkinRecord.findUnique({
      where: {
        userId_date: {
          userId,
          date: yesterday,
        },
      },
    });

    // 计算连续签到天数
    const streak = yesterdayCheckin ? yesterdayCheckin.streak + 1 : 1;

    // 计算奖励（连续签到递增）
    const { base, max, increment } = AIRDROP_REWARDS[AirdropType.CHECKIN] as {
      base: number;
      max: number;
      increment: number;
    };
    let reward = Math.min(base + (streak - 1) * increment, max);

    // 如果加上本次奖励会超过终身上限，则只发放剩余额度
    const remaining = AIRDROP_CAPS.checkinLifetimeCap - totalCheckinAmount.toNumber();
    if (reward > remaining) {
      reward = remaining;
    }

    // 使用事务
    await this.prisma.$transaction(async (tx) => {
      // 创建签到记录
      await tx.checkinRecord.create({
        data: {
          userId,
          date: today,
          streak,
          reward: reward.toString(),
        },
      });

      // 发放空投
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { hootBalance: true, lockedBalance: true },
      });

      const currentBalance = new Decimal(user!.hootBalance.toString());
      const currentLocked = new Decimal(user!.lockedBalance.toString());
      const airdropAmount = new Decimal(reward);
      const newBalance = currentBalance.plus(airdropAmount);
      const newLocked = currentLocked.plus(airdropAmount);

      // 创建空投记录
      await tx.airdrop.create({
        data: {
          userId,
          type: AirdropType.CHECKIN,
          amount: airdropAmount.toString(),
          balance: newBalance.toString(),
          source: `每日签到第 ${streak} 天`,
          vestingDays: VESTING_CONFIG.minDays,
          vestingStart: new Date(),
          status: AirdropStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      // 更新用户余额
      await tx.user.update({
        where: { id: userId },
        data: {
          hootBalance: newBalance.toString(),
          lockedBalance: newLocked.toString(),
        },
      });
    });

    this.logger.log(
      `用户 ${userId} 签到成功: 连续 ${streak} 天, 获得 ${reward} HOOT`,
    );

    return {
      success: true,
      reward,
      streak,
      message: `签到成功！连续 ${streak} 天，获得 ${reward} HOOT`,
    };
  }

  // ==================== Vesting 释放 ====================

  /**
   * 处理每日 Vesting 释放（定时任务调用）
   */
  async processVestingRelease(): Promise<void> {
    const now = new Date();

    // 获取所有进行中的空投
    const vestingAirdrops = await this.prisma.airdrop.findMany({
      where: {
        status: { in: [AirdropStatus.CONFIRMED, AirdropStatus.VESTING] },
      },
    });

    this.logger.log(`开始处理 ${vestingAirdrops.length} 条空投释放`);

    for (const airdrop of vestingAirdrops) {
      try {
        await this.releaseVesting(airdrop);
      } catch (error) {
        this.logger.error(
          `释放空投失败: airdropId=${airdrop.id}, error=${error.message}`,
        );
      }
    }
  }

  /**
   * 释放单条空投
   */
  private async releaseVesting(airdrop: {
    id: string;
    userId: string;
    amount: any;
    vestingDays: number;
    vestingStart: Date;
    releasedAmount: any;
  }): Promise<void> {
    const now = new Date();
    const startDate = new Date(airdrop.vestingStart);
    const daysPassed = Math.floor(
      (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    const totalAmount = new Decimal(airdrop.amount.toString());
    const alreadyReleased = new Decimal(airdrop.releasedAmount.toString());

    // 计算应释放金额
    const releasePerDay = totalAmount.div(airdrop.vestingDays);
    const shouldReleased = Decimal.min(
      releasePerDay.times(daysPassed),
      totalAmount,
    );
    const toRelease = shouldReleased.minus(alreadyReleased);

    if (toRelease.lte(0)) {
      return; // 没有新的释放
    }

    await this.prisma.$transaction(async (tx) => {
      // 更新空投记录
      const isCompleted = shouldReleased.gte(totalAmount);
      await tx.airdrop.update({
        where: { id: airdrop.id },
        data: {
          releasedAmount: shouldReleased.toString(),
          status: isCompleted ? AirdropStatus.COMPLETED : AirdropStatus.VESTING,
          completedAt: isCompleted ? new Date() : undefined,
        },
      });

      // 更新用户余额：锁定减少，可用增加
      await tx.user.update({
        where: { id: airdrop.userId },
        data: {
          lockedBalance: { decrement: toRelease.toNumber() },
          availableBalance: { increment: toRelease.toNumber() },
          lastVestingAt: now,
        },
      });
    });

    this.logger.debug(
      `释放空投: userId=${airdrop.userId}, released=${toRelease.toString()} HOOT`,
    );
  }

  // ==================== 查询接口 ====================

  /**
   * 获取用户空投余额
   */
  async getBalance(userId: string): Promise<AirdropBalanceDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        hootBalance: true,
        lockedBalance: true,
        availableBalance: true,
      },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 获取待确认空投总额
    const pendingAirdrops = await this.prisma.airdrop.aggregate({
      where: {
        userId,
        status: AirdropStatus.PENDING,
      },
      _sum: { amount: true },
    });

    const total = new Decimal(user.hootBalance.toString());
    const locked = new Decimal(user.lockedBalance.toString());
    const available = new Decimal(user.availableBalance.toString());
    const pending = new Decimal(
      pendingAirdrops._sum.amount?.toString() || '0',
    );

    // 计算释放进度
    const vestingProgress =
      total.gt(0) && locked.gt(0)
        ? available.div(total).times(100).toNumber()
        : 100;

    return {
      totalBalance: total.toString(),
      lockedBalance: locked.toString(),
      availableBalance: available.toString(),
      pendingAmount: pending.toString(),
      vestingProgress: Math.min(vestingProgress, 100),
    };
  }

  /**
   * 获取空投历史
   */
  async getHistory(userId: string, query: QueryAirdropDto) {
    const { type, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (type) where.type = type;
    if (status) where.status = status;

    const [airdrops, total] = await Promise.all([
      this.prisma.airdrop.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.airdrop.count({ where }),
    ]);

    return {
      items: airdrops.map((a) => ({
        id: a.id,
        type: a.type,
        amount: a.amount.toString(),
        status: a.status,
        vestingDays: a.vestingDays,
        vestingProgress: this.calculateVestingProgress(a),
        releasedAmount: a.releasedAmount.toString(),
        source: a.source,
        createdAt: a.createdAt,
        confirmedAt: a.confirmedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取签到状态
   */
  async getCheckinStatus(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCheckin = await this.prisma.checkinRecord.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
    });

    // 获取最近的签到记录
    const latestCheckin = await this.prisma.checkinRecord.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    const streak = latestCheckin?.streak || 0;
    const { base, max, increment } = AIRDROP_REWARDS[AirdropType.CHECKIN] as {
      base: number;
      max: number;
      increment: number;
    };
    const nextReward = Math.min(base + streak * increment, max);

    return {
      checkedInToday: !!todayCheckin,
      streak,
      todayReward: todayCheckin ? todayCheckin.reward.toString() : null,
      nextReward: nextReward.toString(),
    };
  }

  // ==================== 辅助方法 ====================

  private calculateVestingProgress(airdrop: {
    amount: any;
    releasedAmount: any;
  }): number {
    const total = new Decimal(airdrop.amount.toString());
    const released = new Decimal(airdrop.releasedAmount.toString());
    if (total.eq(0)) return 100;
    return released.div(total).times(100).toNumber();
  }
}
