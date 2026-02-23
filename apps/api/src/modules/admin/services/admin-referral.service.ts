/**
 * 管理后台 - 返佣邀请管理服务
 * 邀请关系、返佣配置、返佣记录
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import Decimal from 'decimal.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class AdminReferralService {
  private readonly logger = new Logger(AdminReferralService.name);

  constructor(private prisma: PrismaService) {}

  // 获取返佣概览
  async getReferralOverview() {
    const [
      totalReferrers,
      totalReferred,
      totalRewards,
      pendingRewards,
      monthlyRewards,
      config,
    ] = await Promise.all([
      // 有邀请人的用户数
      this.prisma.user.count({
        where: {
          invitees: { some: {} },
        },
      }),
      // 被邀请的用户数
      this.prisma.user.count({
        where: {
          invitedBy: { not: null },
        },
      }),
      // 累计返佣
      this.prisma.referralReward.aggregate({
        where: { status: 'paid' },
        _sum: { amount: true },
      }),
      // 待发放返佣
      this.prisma.referralReward.aggregate({
        where: { status: 'pending' },
        _sum: { amount: true },
      }),
      // 本月返佣
      this.prisma.referralReward.aggregate({
        where: {
          createdAt: {
            gte: new Date(new Date().setDate(1)),
          },
        },
        _sum: { amount: true },
      }),
      // 返佣配置
      this.getReferralConfig(),
    ]);

    return {
      overview: {
        totalReferrers,
        totalReferred,
        totalRewards: totalRewards._sum.amount?.toString() || '0',
        pendingRewards: pendingRewards._sum.amount?.toString() || '0',
        monthlyRewards: monthlyRewards._sum.amount?.toString() || '0',
      },
      config,
    };
  }

  // 获取返佣配置
  async getReferralConfig() {
    // 使用 upsert 避免并发创建时的唯一约束冲突
    const config = await this.prisma.referralConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        level1Rate: 10,
        level2Rate: 5,
        level3Rate: 2,
        enabledTypes: ['trading'], // 燃油费返佣；订阅费不参与返佣
        isActive: true,
      },
      update: {}, // 已存在则不更新
    });

    return {
      level1Rate: config.level1Rate.toString(),
      level2Rate: config.level2Rate.toString(),
      level3Rate: config.level3Rate.toString(),
      enabledTypes: config.enabledTypes,
      isActive: config.isActive,
    };
  }

  // 更新返佣配置
  async updateReferralConfig(
    data: {
      level1Rate?: number;
      level2Rate?: number;
      level3Rate?: number;
      enabledTypes?: string[];
      isActive?: boolean;
    },
    adminId: string,
  ) {
    const config = await this.prisma.referralConfig.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        level1Rate: data.level1Rate ?? 10,
        level2Rate: data.level2Rate ?? 5,
        level3Rate: data.level3Rate ?? 2,
        enabledTypes: data.enabledTypes ?? ['trading'],
        isActive: data.isActive ?? true,
        updatedBy: adminId,
      },
      update: {
        ...(data.level1Rate !== undefined && { level1Rate: data.level1Rate }),
        ...(data.level2Rate !== undefined && { level2Rate: data.level2Rate }),
        ...(data.level3Rate !== undefined && { level3Rate: data.level3Rate }),
        ...(data.enabledTypes && { enabledTypes: data.enabledTypes }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedBy: adminId,
      },
    });

    this.logger.log(`返佣配置已更新: ${JSON.stringify(data)}`);

    return {
      level1Rate: config.level1Rate.toString(),
      level2Rate: config.level2Rate.toString(),
      level3Rate: config.level3Rate.toString(),
      enabledTypes: config.enabledTypes,
      isActive: config.isActive,
    };
  }

  // 获取邀请关系列表
  async getReferralRelations(
    page: number = 1,
    limit: number = 20,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      invitees: { some: {} },
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { nickname: { contains: search, mode: 'insensitive' } },
        { inviteCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [referrers, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          nickname: true,
          inviteCode: true,
          createdAt: true,
          _count: {
            select: { invitees: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // 获取每个邀请人的返佣统计
    const referrerIds = referrers.map((r) => r.id);
    const rewardStats = await this.prisma.referralReward.groupBy({
      by: ['userId'],
      where: {
        userId: { in: referrerIds },
      },
      _sum: { amount: true },
      _count: true,
    });

    const rewardMap = new Map(
      rewardStats.map((r) => [
        r.userId,
        { total: r._sum.amount?.toString() || '0', count: r._count },
      ]),
    );

    return {
      items: referrers.map((r) => ({
        id: r.id,
        email: r.email,
        nickname: r.nickname,
        inviteCode: r.inviteCode,
        inviteeCount: r._count.invitees,
        totalReward: rewardMap.get(r.id)?.total || '0',
        rewardCount: rewardMap.get(r.id)?.count || 0,
        createdAt: r.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 获取用户的被邀请人列表
  async getUserInvitees(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [invitees, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { invitedBy: userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          nickname: true,
          usdtBalance: true,
          createdAt: true,
          _count: {
            select: {
              subscriptions: true,
              positions: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where: { invitedBy: userId } }),
    ]);

    // 获取从每个被邀请人产生的返佣
    const inviteeIds = invitees.map((i) => i.id);
    const rewardStats = await this.prisma.referralReward.groupBy({
      by: ['fromUserId'],
      where: {
        userId,
        fromUserId: { in: inviteeIds },
      },
      _sum: { amount: true },
    });

    const rewardMap = new Map(
      rewardStats.map((r) => [r.fromUserId, r._sum.amount?.toString() || '0']),
    );

    return {
      items: invitees.map((i) => ({
        id: i.id,
        email: i.email,
        nickname: i.nickname,
        usdtBalance: i.usdtBalance.toString(),
        subscriptionCount: i._count.subscriptions,
        positionCount: i._count.positions,
        rewardGenerated: rewardMap.get(i.id) || '0',
        createdAt: i.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 获取返佣记录列表
  async getReferralRewards(
    page: number = 1,
    limit: number = 50,
    userId?: string,
    status?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.ReferralRewardWhereInput = {};
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const [rewards, total] = await Promise.all([
      this.prisma.referralReward.findMany({
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
      this.prisma.referralReward.count({ where }),
    ]);

    return {
      items: rewards.map((r) => ({
        ...r,
        amount: r.amount.toString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 获取返佣排行榜
  async getReferralLeaderboard(limit: number = 20) {
    const rewards = await this.prisma.referralReward.groupBy({
      by: ['userId'],
      _sum: { amount: true },
      _count: true,
      orderBy: {
        _sum: { amount: 'desc' },
      },
      take: limit,
    });

    // 获取用户信息
    const userIds = rewards.map((r) => r.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        nickname: true,
        inviteCode: true,
        _count: {
          select: { invitees: true },
        },
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return rewards.map((r, index) => {
      const user = userMap.get(r.userId);
      return {
        rank: index + 1,
        userId: r.userId,
        email: user?.email,
        nickname: user?.nickname,
        inviteCode: user?.inviteCode,
        inviteeCount: user?._count.invitees || 0,
        totalReward: r._sum.amount?.toString() || '0',
        rewardCount: r._count,
      };
    });
  }

  // 批量发放待处理的返佣
  async processPendingRewards() {
    const pendingRewards = await this.prisma.referralReward.findMany({
      where: { status: 'pending' },
      include: { user: true },
    });

    if (pendingRewards.length === 0) {
      return { message: '没有待处理的返佣', count: 0 };
    }

    let processedCount = 0;
    let totalAmount = new Decimal(0);

    await this.prisma.$transaction(async (tx) => {
      for (const reward of pendingRewards) {
        // 更新用户余额
        if (reward.asset === 'USDT') {
          await tx.user.update({
            where: { id: reward.userId },
            data: {
              usdtBalance: { increment: reward.amount },
            },
          });
        } else if (reward.asset === 'HOOT') {
          await tx.user.update({
            where: { id: reward.userId },
            data: {
              hootBalance: { increment: reward.amount },
            },
          });
        }

        // 更新返佣状态
        await tx.referralReward.update({
          where: { id: reward.id },
          data: { status: 'paid' },
        });

        // 创建交易记录
        await tx.transaction.create({
          data: {
            userId: reward.userId,
            type: 'referral',
            asset: reward.asset,
            amount: reward.amount,
            uniqueOrderId: `referral_pay_${reward.id}_${Date.now()}`,
            status: 'completed',
            remark: `邀请返佣 - 来自 ${reward.fromUserId}`,
          },
        });

        processedCount++;
        totalAmount = totalAmount.plus(reward.amount);
      }
    });

    this.logger.log(
      `返佣发放完成: ${processedCount} 笔, 总金额: ${totalAmount.toString()}`,
    );

    return {
      message: '返佣发放成功',
      count: processedCount,
      totalAmount: totalAmount.toString(),
    };
  }
}
