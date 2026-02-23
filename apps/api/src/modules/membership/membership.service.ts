import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Decimal from 'decimal.js';
import {
  PurchaseMembershipDto,
  MembershipPlanResponse,
  MembershipStatusResponse,
  MembershipSubscriptionResponse,
} from './dto/membership.dto';
import { v4 as uuidv4 } from 'uuid';

// Free / Pro 层级常量
const FREE_TIER = { maxStrategies: 2, gasFeeRate: '0.25' };
const PRO_TIER = { maxStrategies: 10, gasFeeRate: '0.20' };

// Pro 会员套餐定价
const MEMBERSHIP_PLANS = {
  monthly: {
    code: 'monthly',
    nameZh: 'Pro 月度',
    nameEn: 'Pro Monthly',
    price: '19.99',
    durationDays: 30,
    originalPrice: '19.99',
    discountPercent: 0,
    maxStrategies: PRO_TIER.maxStrategies,
  },
  quarterly: {
    code: 'quarterly',
    nameZh: 'Pro 季度',
    nameEn: 'Pro Quarterly',
    price: '49.99',
    durationDays: 90,
    originalPrice: '59.97', // 19.99 * 3
    discountPercent: 17,
    maxStrategies: PRO_TIER.maxStrategies,
  },
  yearly: {
    code: 'yearly',
    nameZh: 'Pro 年度',
    nameEn: 'Pro Yearly',
    price: '149.99',
    durationDays: 365,
    originalPrice: '239.88', // 19.99 * 12
    discountPercent: 37,
    maxStrategies: PRO_TIER.maxStrategies,
  },
};

@Injectable()
export class MembershipService {
  constructor(private prisma: PrismaService) {}

  /**
   * 初始化会员套餐数据（首次启动时调用）
   */
  async initializePlans(): Promise<void> {
    for (const [code, plan] of Object.entries(MEMBERSHIP_PLANS)) {
      await this.prisma.membershipPlan.upsert({
        where: { code },
        update: {
          price: plan.price,
          durationDays: plan.durationDays,
          originalPrice: plan.originalPrice,
          discountPercent: plan.discountPercent,
          maxStrategies: plan.maxStrategies,
          nameI18n: {
            'zh-CN': plan.nameZh,
            en: plan.nameEn,
          },
          name: plan.nameZh,
        },
        create: {
          code,
          price: plan.price,
          durationDays: plan.durationDays,
          originalPrice: plan.originalPrice,
          discountPercent: plan.discountPercent,
          maxStrategies: plan.maxStrategies,
          nameI18n: {
            'zh-CN': plan.nameZh,
            en: plan.nameEn,
          },
          name: plan.nameZh,
          sortOrder: code === 'monthly' ? 1 : code === 'quarterly' ? 2 : 3,
        },
      });
    }
  }

  /**
   * 获取所有会员套餐
   */
  async getPlans(): Promise<MembershipPlanResponse[]> {
    const plans = await this.prisma.membershipPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return plans.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      price: plan.price.toString(),
      durationDays: plan.durationDays,
      originalPrice: plan.originalPrice?.toString(),
      discountPercent: plan.discountPercent,
      monthlyPrice: new Decimal(plan.price)
        .div(plan.durationDays)
        .mul(30)
        .toFixed(2),
      maxStrategies: plan.maxStrategies,
      gasFeeRate: PRO_TIER.gasFeeRate,
    }));
  }

  /**
   * 获取用户会员状态
   */
  async getMembershipStatus(userId: string): Promise<MembershipStatusResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        membershipStatus: true,
        membershipExpireAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 检查是否过期
    const now = new Date();
    const isExpired = user.membershipExpireAt && user.membershipExpireAt < now;
    const status = isExpired
      ? 'expired'
      : user.membershipStatus === 'active'
        ? 'active'
        : 'none';

    // 如果过期，更新状态
    if (isExpired && user.membershipStatus === 'active') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { membershipStatus: 'expired' },
      });
    }

    // 获取当前有效订阅
    let currentPlan: MembershipStatusResponse['currentPlan'] = undefined;
    if (status === 'active' && user.membershipExpireAt) {
      const activeSub = await this.prisma.membershipSubscription.findFirst({
        where: {
          userId,
          status: 'active',
          expireAt: { gt: now },
        },
        include: { plan: true },
        orderBy: { expireAt: 'desc' },
      });

      if (activeSub) {
        const daysRemaining = Math.ceil(
          (activeSub.expireAt.getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        currentPlan = {
          code: activeSub.planCode,
          name: activeSub.planName,
          expireAt: activeSub.expireAt,
          daysRemaining,
        };
      }
    }

    const isPro = status === 'active';
    return {
      isMember: isPro,
      status: status,
      tier: isPro ? ('pro' as const) : ('free' as const),
      gasFeeRate: isPro ? PRO_TIER.gasFeeRate : FREE_TIER.gasFeeRate,
      maxStrategies: isPro ? PRO_TIER.maxStrategies : FREE_TIER.maxStrategies,
      currentPlan,
      canSubscribeStrategies: true, // Free 用户也可订阅(受数量限制)
    };
  }

  /**
   * 购买会员
   */
  async purchaseMembership(
    userId: string,
    dto: PurchaseMembershipDto,
  ): Promise<MembershipSubscriptionResponse> {
    // 获取套餐
    const plan = await this.prisma.membershipPlan.findUnique({
      where: { code: dto.planCode },
    });

    if (!plan || !plan.isActive) {
      throw new BadRequestException('套餐不存在或已下架');
    }

    const paymentAsset = dto.paymentAsset || 'USDT';
    const price = new Decimal(plan.price.toString());

    // 生成唯一订单号（在事务外生成，避免重复）
    const uniqueOrderId = `membership_${userId}_${Date.now()}_${uuidv4().slice(0, 8)}`;
    const now = new Date();

    // 使用事务：余额检查 + 扣费 + 创建订阅（防止 TOCTOU 并发问题）
    const subscription = await this.prisma.$transaction(async (tx) => {
      // 在事务内读取用户余额，防止并发竞态
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          usdtBalance: true,
          pointBalance: true,
          membershipStatus: true,
          membershipExpireAt: true,
        },
      });

      if (!user) {
        throw new NotFoundException('用户不存在');
      }

      const balance =
        paymentAsset === 'USDT'
          ? new Decimal(user.usdtBalance.toString())
          : new Decimal(user.pointBalance.toString());

      // 在事务内检查余额，与扣款操作原子不可分割
      if (balance.lt(price)) {
        throw new BadRequestException(
          `${paymentAsset} 余额不足，需要 ${price.toString()}，当前余额 ${balance.toString()}`,
        );
      }

      // 计算有效期
      let startAt = now;
      let isRenewal = false;
      let renewedFrom: string | null = null;

      // 如果已有会员且未过期，从到期时间开始算
      if (
        user.membershipStatus === 'active' &&
        user.membershipExpireAt &&
        user.membershipExpireAt > now
      ) {
        startAt = user.membershipExpireAt;
        isRenewal = true;

        // 获取最后一个订阅（在事务内查询）
        const lastSub = await tx.membershipSubscription.findFirst({
          where: { userId, status: 'active' },
          orderBy: { expireAt: 'desc' },
        });
        if (lastSub) {
          renewedFrom = lastSub.id;
        }
      }

      const expireAt = new Date(startAt);
      expireAt.setDate(expireAt.getDate() + plan.durationDays);

      // 扣除余额（使用精确的 Decimal 字符串，避免浮点精度问题）
      const newBalance = balance.minus(price);
      const updateData =
        paymentAsset === 'USDT'
          ? { usdtBalance: newBalance.toFixed(8) }
          : { pointBalance: newBalance.toFixed(8) };

      await tx.user.update({
        where: { id: userId },
        data: {
          ...updateData,
          membershipStatus: 'active',
          membershipExpireAt: expireAt,
        },
      });

      // 创建订阅记录
      const sub = await tx.membershipSubscription.create({
        data: {
          userId,
          planId: plan.id,
          planCode: plan.code,
          planName: plan.name,
          amount: price.toString(),
          paymentAsset,
          startAt,
          expireAt,
          status: 'active',
          isRenewal,
          renewedFrom,
          autoRenew: dto.autoRenew || false,
          uniqueOrderId,
          paidAt: now,
        },
      });

      // 创建交易记录
      await tx.transaction.create({
        data: {
          userId,
          type: 'membership',
          asset: paymentAsset,
          amount: price.neg().toString(),
          uniqueOrderId,
          status: 'completed',
          remark: `购买${plan.name}`,
        },
      });

      // 创建计费日志
      await tx.billingLog.create({
        data: {
          userId,
          type: 'MEMBERSHIP',
          amount: price,
          uniqueOrderId,
          description: `购买${plan.name}，有效期至 ${expireAt.toISOString().split('T')[0]}`,
        },
      });

      return sub;
    });

    return {
      id: subscription.id,
      planCode: subscription.planCode,
      planName: subscription.planName,
      amount: subscription.amount.toString(),
      paymentAsset: subscription.paymentAsset,
      startAt: subscription.startAt,
      expireAt: subscription.expireAt,
      status: subscription.status,
      isRenewal: subscription.isRenewal,
      createdAt: subscription.createdAt,
    };
  }

  /**
   * 获取用户订阅历史
   */
  async getSubscriptionHistory(
    userId: string,
  ): Promise<MembershipSubscriptionResponse[]> {
    const subscriptions = await this.prisma.membershipSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return subscriptions.map((sub) => ({
      id: sub.id,
      planCode: sub.planCode,
      planName: sub.planName,
      amount: sub.amount.toString(),
      paymentAsset: sub.paymentAsset,
      startAt: sub.startAt,
      expireAt: sub.expireAt,
      status: sub.status,
      isRenewal: sub.isRenewal,
      createdAt: sub.createdAt,
    }));
  }

  /**
   * 检查用户是否为有效会员
   */
  async isActiveMember(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        membershipStatus: true,
        membershipExpireAt: true,
      },
    });

    if (!user) return false;

    const now = new Date();
    return (
      user.membershipStatus === 'active' &&
      user.membershipExpireAt !== null &&
      user.membershipExpireAt > now
    );
  }

  /**
   * 获取用户层级限制（Free / Pro）
   */
  async getTierLimits(userId: string): Promise<{
    tier: 'free' | 'pro';
    maxStrategies: number;
    gasFeeRate: string;
  }> {
    const isPro = await this.isActiveMember(userId);
    return isPro
      ? { tier: 'pro', ...PRO_TIER }
      : { tier: 'free', ...FREE_TIER };
  }

  /**
   * 验证策略订阅限制（按层级限制数量，Free=2 / Pro=10）
   */
  async validateMembership(userId: string): Promise<void> {
    const tierLimits = await this.getTierLimits(userId);
    const currentCount = await this.prisma.strategySubscription.count({
      where: { userId, isActive: true },
    });
    if (currentCount >= tierLimits.maxStrategies) {
      throw new BadRequestException(
        tierLimits.tier === 'free'
          ? `免费版最多订阅 ${tierLimits.maxStrategies} 个策略，升级 Pro 可解锁更多`
          : `Pro 版最多订阅 ${tierLimits.maxStrategies} 个策略`,
      );
    }
  }
}
