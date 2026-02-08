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

// 会员套餐定价配置（方案 C）
const MEMBERSHIP_PLANS = {
  monthly: {
    code: 'monthly',
    nameZh: '月度会员',
    nameEn: 'Monthly',
    price: '15',
    durationDays: 30,
    originalPrice: '15',
    discountPercent: 0,
    maxStrategies: 10,
  },
  quarterly: {
    code: 'quarterly',
    nameZh: '季度会员',
    nameEn: 'Quarterly',
    price: '36',
    durationDays: 90,
    originalPrice: '45', // 15 * 3
    discountPercent: 20,
    maxStrategies: 10,
  },
  yearly: {
    code: 'yearly',
    nameZh: '年度会员',
    nameEn: 'Yearly',
    price: '99',
    durationDays: 365,
    originalPrice: '180', // 15 * 12
    discountPercent: 45,
    maxStrategies: 10,
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

    return {
      isMember: status === 'active',
      status: status,
      currentPlan,
      canSubscribeStrategies: status === 'active',
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

    // 获取用户余额
    const user = await this.prisma.user.findUnique({
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

    const paymentAsset = dto.paymentAsset || 'USDT';
    const price = new Decimal(plan.price.toString());
    const balance =
      paymentAsset === 'USDT'
        ? new Decimal(user.usdtBalance.toString())
        : new Decimal(user.pointBalance.toString());

    // 检查余额
    if (balance.lt(price)) {
      throw new BadRequestException(
        `${paymentAsset} 余额不足，需要 ${price.toString()}，当前余额 ${balance.toString()}`,
      );
    }

    // 计算有效期
    const now = new Date();
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

      // 获取最后一个订阅
      const lastSub = await this.prisma.membershipSubscription.findFirst({
        where: { userId, status: 'active' },
        orderBy: { expireAt: 'desc' },
      });
      if (lastSub) {
        renewedFrom = lastSub.id;
      }
    }

    const expireAt = new Date(startAt);
    expireAt.setDate(expireAt.getDate() + plan.durationDays);

    // 生成唯一订单号
    const uniqueOrderId = `membership_${userId}_${Date.now()}_${uuidv4().slice(0, 8)}`;

    // 使用事务扣费并创建订阅
    const subscription = await this.prisma.$transaction(async (tx) => {
      // 扣除余额
      const updateData =
        paymentAsset === 'USDT'
          ? { usdtBalance: { decrement: price.toNumber() } }
          : { pointBalance: { decrement: price.toNumber() } };

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
   * 验证会员资格（用于策略订阅前验证）
   * 抛出异常如果没有有效会员
   */
  async validateMembership(userId: string): Promise<void> {
    const isActive = await this.isActiveMember(userId);
    if (!isActive) {
      throw new BadRequestException(
        '请先订阅会员后再订阅策略。会员套餐包含月度、季度、年度三种选择。',
      );
    }
  }
}
