import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  ReferralStatsResponse,
  InviteeResponse,
  RewardRecordResponse,
  REFERRAL_CONFIG,
} from './dto/referral.dto';

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(private prisma: PrismaService) {}

  // 生成邀请码
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符
    let code = '';
    for (let i = 0; i < REFERRAL_CONFIG.INVITE_CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // 获取或生成用户的邀请码
  async getOrCreateInviteCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { inviteCode: true },
    });

    if (user?.inviteCode) {
      return user.inviteCode;
    }

    // 生成唯一邀请码
    let inviteCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      inviteCode = this.generateInviteCode();
      const existing = await this.prisma.user.findUnique({
        where: { inviteCode },
      });
      if (!existing) break;
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new BadRequestException('生成邀请码失败，请稍后重试');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { inviteCode: inviteCode! },
    });

    return inviteCode!;
  }

  // 绑定邀请码（注册时使用）
  async bindInviteCode(userId: string, inviteCode: string): Promise<void> {
    // 检查用户是否已绑定
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { invitedBy: true },
    });

    if (user?.invitedBy) {
      throw new BadRequestException('已绑定邀请人，无法重复绑定');
    }

    // 查找邀请人
    const inviter = await this.prisma.user.findUnique({
      where: { inviteCode },
      select: { id: true },
    });

    if (!inviter) {
      throw new NotFoundException('邀请码无效');
    }

    if (inviter.id === userId) {
      throw new BadRequestException('不能使用自己的邀请码');
    }

    // 绑定邀请关系
    await this.prisma.user.update({
      where: { id: userId },
      data: { invitedBy: inviter.id },
    });

    this.logger.log(`用户 ${userId} 绑定邀请人 ${inviter.id}`);
  }

  // 获取邀请统计
  async getStats(userId: string): Promise<ReferralStatsResponse> {
    const inviteCode = await this.getOrCreateInviteCode(userId);

    // 统计邀请人数
    const totalInvites = await this.prisma.user.count({
      where: { invitedBy: userId },
    });

    // 统计返佣金额
    const rewards = await this.prisma.referralReward.aggregate({
      where: { userId },
      _sum: { amount: true },
    });

    const pendingRewards = await this.prisma.referralReward.aggregate({
      where: { userId, status: 'pending' },
      _sum: { amount: true },
    });

    return {
      inviteCode,
      totalInvites,
      totalRewards: rewards._sum.amount?.toString() || '0',
      pendingRewards: pendingRewards._sum.amount?.toString() || '0',
      inviteLink: `https://hoot.app/register?ref=${inviteCode}`,
    };
  }

  // 获取被邀请人列表
  async getInvitees(userId: string): Promise<InviteeResponse[]> {
    const invitees = await this.prisma.user.findMany({
      where: { invitedBy: userId },
      select: {
        id: true,
        nickname: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 计算每个被邀请人的贡献
    const result: InviteeResponse[] = [];

    for (const invitee of invitees) {
      const contribution = await this.prisma.referralReward.aggregate({
        where: {
          userId,
          fromUserId: invitee.id,
        },
        _sum: { amount: true },
      });

      result.push({
        id: invitee.id,
        nickname: invitee.nickname || '未设置',
        email: invitee.email ? this.maskEmail(invitee.email) : 'TG用户',
        createdAt: invitee.createdAt,
        totalContribution: contribution._sum.amount?.toString() || '0',
      });
    }

    return result;
  }

  // 获取返佣记录
  async getRewardRecords(userId: string): Promise<RewardRecordResponse[]> {
    const rewards = await this.prisma.referralReward.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // 获取来源用户信息
    const fromUserIds = [...new Set(rewards.map((r) => r.fromUserId))];
    const fromUsers = await this.prisma.user.findMany({
      where: { id: { in: fromUserIds } },
      select: { id: true, nickname: true },
    });

    const userMap = new Map(fromUsers.map((u) => [u.id, u.nickname || '用户']));

    return rewards.map((r) => ({
      id: r.id,
      fromUserNickname: userMap.get(r.fromUserId) || '用户',
      type: r.type,
      amount: r.amount.toString(),
      asset: r.asset,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  // 创建返佣记录（内部方法，供其他模块调用）
  async createReward(
    inviterId: string,
    fromUserId: string,
    type: 'subscription' | 'trading',
    amount: string,
    asset: string,
    uniqueOrderId: string,
  ): Promise<void> {
    // 幂等性检查
    const existing = await this.prisma.referralReward.findUnique({
      where: { uniqueOrderId },
    });

    if (existing) {
      this.logger.warn(`返佣已记录: ${uniqueOrderId}`);
      return;
    }

    await this.prisma.referralReward.create({
      data: {
        userId: inviterId,
        fromUserId,
        type,
        amount: new Decimal(amount),
        asset,
        uniqueOrderId,
        status: 'pending',
      },
    });

    this.logger.log(
      `创建返佣: ${inviterId} 从 ${fromUserId} 获得 ${amount} ${asset}`,
    );
  }

  // 邮箱脱敏
  private maskEmail(email: string): string {
    const [name, domain] = email.split('@');
    if (name.length <= 2) {
      return `${name[0]}***@${domain}`;
    }
    return `${name[0]}***${name[name.length - 1]}@${domain}`;
  }

  // 获取推荐排行榜（Top 10）
  async getLeaderboard(): Promise<
    Array<{ rank: number; username: string; referrals: number; earnings: number }>
  > {
    // 查询所有有邀请人的用户，按邀请人分组统计
    const inviterStats = await this.prisma.user.groupBy({
      by: ['invitedBy'],
      where: { invitedBy: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    if (inviterStats.length === 0) return [];

    // 获取邀请人详情
    const inviterIds = inviterStats.map((s) => s.invitedBy!);
    const inviters = await this.prisma.user.findMany({
      where: { id: { in: inviterIds } },
      select: { id: true, nickname: true, email: true },
    });

    // 获取每个邀请人的返佣总额
    const rewards = await this.prisma.referralReward.groupBy({
      by: ['userId'],
      where: { userId: { in: inviterIds } },
      _sum: { amount: true },
    });

    const inviterMap = new Map(inviters.map((u) => [u.id, u]));
    const rewardMap = new Map(
      rewards.map((r) => [
        r.userId,
        parseFloat(r._sum.amount?.toString() || '0'),
      ]),
    );

    return inviterStats.map((stat, index) => {
      const inviter = inviterMap.get(stat.invitedBy!);
      const displayName =
        inviter?.nickname ||
        (inviter?.email ? this.maskEmail(inviter.email) : '***');
      return {
        rank: index + 1,
        username: displayName,
        referrals: stat._count.id,
        earnings: rewardMap.get(stat.invitedBy!) || 0,
      };
    });
  }
}
