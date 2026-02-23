import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import {
  AirdropType,
  AirdropStatus,
  AIRDROP_REWARDS,
  AIRDROP_CAPS,
  VESTING_CONFIG,
  AirdropBalanceDto,
  QueryAirdropDto,
  TaskStatus,
  TaskItemDto,
} from './dto/airdrop.dto';

@Injectable()
export class AirdropService {
  private readonly logger = new Logger(AirdropService.name);

  constructor(private prisma: PrismaService) {}

  // ==================== 动态配置读取（DB 优先，硬编码兜底） ====================

  private async getRewardsConfig(): Promise<typeof AIRDROP_REWARDS> {
    try {
      const config = await this.prisma.platformConfig.findUnique({
        where: { key: 'airdrop_rewards' },
      });
      if (config) {
        return JSON.parse(config.value);
      }
    } catch {
      this.logger.warn('读取 airdrop_rewards 配置失败，使用默认值');
    }
    return AIRDROP_REWARDS;
  }

  private async getCapsConfig(): Promise<typeof AIRDROP_CAPS> {
    try {
      const config = await this.prisma.platformConfig.findUnique({
        where: { key: 'airdrop_caps' },
      });
      if (config) {
        return JSON.parse(config.value);
      }
    } catch {
      this.logger.warn('读取 airdrop_caps 配置失败，使用默认值');
    }
    return AIRDROP_CAPS;
  }

  private async getVestingCfg(): Promise<typeof VESTING_CONFIG> {
    try {
      const config = await this.prisma.platformConfig.findUnique({
        where: { key: 'vesting_config' },
      });
      if (config) {
        return JSON.parse(config.value);
      }
    } catch {
      this.logger.warn('读取 vesting_config 配置失败，使用默认值');
    }
    return VESTING_CONFIG;
  }

  // ==================== 空投发放 ====================

  /**
   * 发放空投奖励
   */
  async grantAirdrop(
    userId: string,
    type: AirdropType,
    options?: {
      amount?: number; // 自定义金额（如盈利交易）
      source?: string; // 来源说明
      sourceId?: string; // 关联ID
      vestingDays?: number; // 释放天数
    },
  ): Promise<void> {
    // 从 DB 读取动态配置（兜底硬编码）
    const rewards = await this.getRewardsConfig();
    const vestingCfg = await this.getVestingCfg();

    // 计算空投金额
    let amount: number;
    if (options?.amount) {
      amount = options.amount;
    } else if (type === AirdropType.TRADING_PROFIT) {
      throw new BadRequestException('盈利交易空投必须指定金额');
    } else {
      amount = rewards[type] as number;
    }

    const vestingDays = options?.vestingDays || vestingCfg.defaultDays;

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
  async grantBindWalletAirdrop(
    userId: string,
    walletAddress: string,
  ): Promise<void> {
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
   * 邀请奖励空投（含终身上限检查）
   */
  async grantReferralAirdrop(
    inviterId: string,
    inviteeId: string,
  ): Promise<void> {
    const caps = await this.getCapsConfig();
    const rewards = await this.getRewardsConfig();

    // 1. 检查终身上限
    const totalReferralAirdrop = await this.prisma.airdrop.aggregate({
      where: {
        userId: inviterId,
        type: AirdropType.REFERRAL,
        status: { not: AirdropStatus.CANCELLED },
      },
      _sum: { amount: true },
    });
    const totalAmount = new Decimal(
      totalReferralAirdrop._sum.amount?.toString() || '0',
    );

    if (totalAmount.gte(caps.referralLifetimeCap)) {
      this.logger.log(
        `用户 ${inviterId} 邀请奖励已达终身上限 ${caps.referralLifetimeCap} HOOT`,
      );
      return;
    }

    // 2. 检查今日上限
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
    const todayAmount = new Decimal(
      todayReferralAirdrop._sum.amount?.toString() || '0',
    );

    if (todayAmount.gte(caps.referralDailyCap)) {
      this.logger.log(
        `用户 ${inviterId} 今日邀请奖励已达上限 ${caps.referralDailyCap} HOOT`,
      );
      return;
    }

    // 3. 计算实际发放金额（考虑终身上限）
    let rewardAmount = rewards[AirdropType.REFERRAL] as number;
    const lifetimeRemaining =
      caps.referralLifetimeCap - totalAmount.toNumber();
    if (rewardAmount > lifetimeRemaining) {
      rewardAmount = lifetimeRemaining;
    }

    if (rewardAmount <= 0) {
      return;
    }

    await this.grantAirdrop(inviterId, AirdropType.REFERRAL, {
      amount: rewardAmount,
      source: `邀请用户奖励`,
      sourceId: inviteeId,
    });
  }

  /**
   * 盈利交易空投（含终身上限检查）
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

    const caps = await this.getCapsConfig();
    const rewards = await this.getRewardsConfig();

    // 1. 检查终身上限
    const totalTradingAirdrop = await this.prisma.airdrop.aggregate({
      where: {
        userId,
        type: AirdropType.TRADING_PROFIT,
        status: { not: AirdropStatus.CANCELLED },
      },
      _sum: { amount: true },
    });
    const totalAmount = new Decimal(
      totalTradingAirdrop._sum.amount?.toString() || '0',
    );

    if (totalAmount.gte(caps.tradingProfitLifetimeCap)) {
      this.logger.log(
        `用户 ${userId} 交易盈利空投已达终身上限 ${caps.tradingProfitLifetimeCap} HOOT`,
      );
      return;
    }

    // 2. 检查今日上限
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
    const todayAmount = new Decimal(
      todayTradingAirdrop._sum.amount?.toString() || '0',
    );

    if (todayAmount.gte(caps.tradingProfitDailyCap)) {
      this.logger.log(
        `用户 ${userId} 今日交易盈利空投已达上限 ${caps.tradingProfitDailyCap} HOOT`,
      );
      return;
    }

    // 3. 计算 HOOT 数量（盈利 * 倍数）
    let hootAmount = profitUsdt * (rewards[AirdropType.TRADING_PROFIT] as number);

    // 4. 考虑每日上限
    const dailyRemaining =
      caps.tradingProfitDailyCap - todayAmount.toNumber();
    if (hootAmount > dailyRemaining) {
      hootAmount = dailyRemaining;
    }

    // 5. 考虑终身上限
    const lifetimeRemaining =
      caps.tradingProfitLifetimeCap - totalAmount.toNumber();
    if (hootAmount > lifetimeRemaining) {
      hootAmount = lifetimeRemaining;
    }

    if (hootAmount <= 0) {
      return;
    }

    await this.grantAirdrop(userId, AirdropType.TRADING_PROFIT, {
      amount: hootAmount,
      source: `盈利交易奖励: ${profitUsdt} USDT`,
      sourceId: positionId,
      // 使用默认 90 天释放（VESTING_CONFIG.defaultDays）
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

    const caps = await this.getCapsConfig();
    const rewards = await this.getRewardsConfig();
    const vestingCfg = await this.getVestingCfg();

    // 检查签到终身上限
    const totalCheckinAirdrop = await this.prisma.airdrop.aggregate({
      where: {
        userId,
        type: AirdropType.CHECKIN,
        status: { not: AirdropStatus.CANCELLED },
      },
      _sum: { amount: true },
    });
    const totalCheckinAmount = new Decimal(
      totalCheckinAirdrop._sum.amount?.toString() || '0',
    );

    if (totalCheckinAmount.gte(caps.checkinLifetimeCap)) {
      return {
        success: false,
        reward: 0,
        streak: 0,
        message: `签到奖励已达终身上限 ${caps.checkinLifetimeCap} HOOT`,
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
    const { base, max, increment } = rewards[AirdropType.CHECKIN] as {
      base: number;
      max: number;
      increment: number;
    };
    let reward = Math.min(base + (streak - 1) * increment, max);

    // 如果加上本次奖励会超过终身上限，则只发放剩余额度
    const remaining =
      caps.checkinLifetimeCap - totalCheckinAmount.toNumber();
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
          vestingDays: vestingCfg.minDays,
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
    amount: Prisma.Decimal | string | number;
    vestingDays: number;
    vestingStart: Date;
    releasedAmount: Prisma.Decimal | string | number;
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
      // 使用精确的 Decimal 字符串避免浮点精度问题
      await tx.user.update({
        where: { id: airdrop.userId },
        data: {
          lockedBalance: { decrement: toRelease.toFixed(8) },
          availableBalance: { increment: toRelease.toFixed(8) },
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
    try {
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

      const total = new Decimal(user.hootBalance?.toString() || '0');
      const locked = new Decimal(user.lockedBalance?.toString() || '0');
      const available = new Decimal(user.availableBalance?.toString() || '0');
      const pending = new Decimal(pendingAirdrops._sum.amount?.toString() || '0');

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
    } catch (error) {
      this.logger.error(`获取空投余额失败: userId=${userId}, error=${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 获取空投历史
   */
  async getHistory(userId: string, query: QueryAirdropDto) {
    const { type, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AirdropWhereInput = { userId };
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
    const rewards = await this.getRewardsConfig();
    const { base, max, increment } = rewards[AirdropType.CHECKIN] as {
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

  // ==================== 任务系统 ====================

  /**
   * 获取任务列表
   * 查询用户绑定状态和空投发放记录，动态计算每个任务的状态
   */
  async getTaskList(userId: string): Promise<TaskItemDto[]> {
    // 1. 获取用户信息（判断任务是否完成）
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        telegramId: true,
        walletAddress: true,
        email: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    // 2. 查询已发放的一次性空投记录（按 type 分组）
    const claimedAirdrops = await this.prisma.airdrop.findMany({
      where: {
        userId,
        type: {
          in: [
            AirdropType.REGISTER,
            AirdropType.BIND_TG,
            AirdropType.BIND_WALLET,
            AirdropType.BIND_EMAIL,
          ],
        },
        status: { not: AirdropStatus.CANCELLED },
      },
      select: { type: true, amount: true },
    });

    const claimedTypes = new Set(claimedAirdrops.map((a) => a.type));

    // 3. 查询可重复任务的累计数据
    const [referralStats, tradingStats] = await Promise.all([
      this.prisma.airdrop.aggregate({
        where: {
          userId,
          type: AirdropType.REFERRAL,
          status: { not: AirdropStatus.CANCELLED },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.airdrop.aggregate({
        where: {
          userId,
          type: AirdropType.TRADING_PROFIT,
          status: { not: AirdropStatus.CANCELLED },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // 4. 读取动态奖励配置
    const rewards = await this.getRewardsConfig();
    const registerReward = rewards[AirdropType.REGISTER] as number;
    const bindTgReward = rewards[AirdropType.BIND_TG] as number;
    const bindWalletReward = rewards[AirdropType.BIND_WALLET] as number;
    const bindEmailReward = rewards[AirdropType.BIND_EMAIL] as number;
    const referralReward = rewards[AirdropType.REFERRAL] as number;
    const tradingMultiplier = rewards[AirdropType.TRADING_PROFIT] as number;

    // 5. 构建任务列表（状态基于用户是否已完成操作，奖励自动到账）
    const tasks: TaskItemDto[] = [
      // 注册奖励 — 注册用户必定已完成
      {
        id: 'register',
        label: '注册奖励',
        description: '注册即送',
        reward: `${registerReward} HOOT`,
        rewardAmount: registerReward,
        status: TaskStatus.COMPLETED,
      },
      // 绑定 Telegram
      {
        id: 'bind_tg',
        label: '绑定 Telegram',
        description: '绑定 TG 账号',
        reward: `${bindTgReward} HOOT`,
        rewardAmount: bindTgReward,
        status: user.telegramId ? TaskStatus.COMPLETED : TaskStatus.INCOMPLETE,
        actionUrl: user.telegramId ? undefined : '/profile',
      },
      // 绑定钱包
      {
        id: 'bind_wallet',
        label: '绑定钱包',
        description: '绑定 Web3 钱包',
        reward: `${bindWalletReward} HOOT`,
        rewardAmount: bindWalletReward,
        status: user.walletAddress ? TaskStatus.COMPLETED : TaskStatus.INCOMPLETE,
        actionUrl: user.walletAddress ? undefined : '/profile',
      },
      // 绑定邮箱
      {
        id: 'bind_email',
        label: '绑定邮箱',
        description: '绑定并验证邮箱',
        reward: `${bindEmailReward} HOOT`,
        rewardAmount: bindEmailReward,
        status: user.email && user.emailVerified ? TaskStatus.COMPLETED : TaskStatus.INCOMPLETE,
        actionUrl: user.email && user.emailVerified ? undefined : '/profile',
      },
      // 邀请好友（可重复）
      {
        id: 'referral',
        label: '邀请好友',
        description: '邀请越多赚越多',
        reward: `${referralReward} HOOT/人`,
        rewardAmount: referralReward,
        status: TaskStatus.REPEATABLE,
        claimedAmount: referralStats._sum.amount?.toString() || '0',
        claimedCount: referralStats._count || 0,
        actionUrl: '/referral',
      },
      // 盈利交易（可重复）
      {
        id: 'trading_profit',
        label: '盈利交易',
        description: `盈利交易额的${tradingMultiplier}倍HOOT`,
        reward: `${tradingMultiplier}x 倍数`,
        rewardAmount: tradingMultiplier,
        status: TaskStatus.REPEATABLE,
        claimedAmount: tradingStats._sum.amount?.toString() || '0',
        claimedCount: tradingStats._count || 0,
        actionUrl: '/trading',
      },
    ];

    return tasks;
  }

  // ==================== 辅助方法 ====================

  private calculateVestingProgress(airdrop: {
    amount: Prisma.Decimal | string | number;
    releasedAmount: Prisma.Decimal | string | number;
  }): number {
    const total = new Decimal(airdrop.amount.toString());
    const released = new Decimal(airdrop.releasedAmount.toString());
    if (total.eq(0)) return 100;
    return released.div(total).times(100).toNumber();
  }
}
