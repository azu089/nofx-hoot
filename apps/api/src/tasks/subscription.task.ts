import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../modules/billing/billing.service';
import Decimal from 'decimal.js';

/**
 * 订阅扣费定时任务
 * 每天检查 VIP 到期用户，自动续费或降级
 */
@Injectable()
export class SubscriptionTask {
  private readonly logger = new Logger(SubscriptionTask.name);

  // VIP 订阅费用 (USDT/月)
  private readonly VIP_PRICES: Record<number, Decimal> = {
    1: new Decimal('25'),  // 基础版
    2: new Decimal('50'),  // 高级版
    3: new Decimal('100'), // 专业版
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  /**
   * 每天凌晨 1 点检查订阅到期
   */
  @Cron('0 1 * * *') // 每天 01:00
  async handleSubscriptionCheck() {
    this.logger.log('开始订阅到期检查');

    try {
      // 1. 查询即将到期的 VIP 用户（24 小时内到期）
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const expiringUsers = await this.prisma.client.users.findMany({
        where: {
          vip_level: { gt: 0 },
          vip_expires_at: { lte: tomorrow },
          status: 'active',
        },
        include: {
          wallets: true,
        },
      });

      this.logger.log(`发现 ${expiringUsers.length} 个即将到期的 VIP 用户`);

      for (const user of expiringUsers) {
        await this.processUserSubscription(user);
      }

      this.logger.log('订阅检查完成');
    } catch (error) {
      this.logger.error(`订阅检查失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 处理单个用户的订阅续费
   */
  private async processUserSubscription(user: any) {
    const wallet = user.wallets;
    if (!wallet) {
      this.logger.warn(`用户 ${user.id} 没有钱包，跳过`);
      return;
    }

    const vipLevel = user.vip_level;
    const price = this.VIP_PRICES[vipLevel];
    if (!price) {
      this.logger.warn(`无效的 VIP 等级: ${vipLevel}`);
      return;
    }

    const balance = new Decimal(wallet.usdt_balance);

    if (balance.gte(price)) {
      // 余额充足，自动续费
      await this.renewSubscription(user, vipLevel, price);
    } else {
      // 余额不足，标记欠费
      await this.handleArrears(user, vipLevel, price, balance);
    }
  }

  /**
   * 自动续费
   */
  private async renewSubscription(user: any, vipLevel: number, price: Decimal) {
    try {
      // 计算新的到期时间（续费 30 天）
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 30);

      // 调用计费服务扣费
      await this.billingService.chargeSubscription(
        user.id,
        price.toString(),
        `VIP${vipLevel} 月度订阅`,
      );

      // 更新 VIP 到期时间
      await this.prisma.client.users.update({
        where: { id: user.id },
        data: {
          vip_expires_at: newExpiresAt,
          updated_at: new Date(),
        },
      });

      this.logger.log(
        `用户 ${user.id} VIP${vipLevel} 自动续费成功，新到期时间: ${newExpiresAt.toISOString()}`,
      );
    } catch (error) {
      this.logger.error(`用户 ${user.id} 续费失败: ${error.message}`);
    }
  }

  /**
   * 处理欠费
   * 策略：
   * 1. 首次欠费：发送提醒，给予 3 天宽限期
   * 2. 宽限期后仍欠费：VIP 降级到 0
   * 3. 降级后停止该用户的 VPS 实例
   */
  private async handleArrears(
    user: any,
    vipLevel: number,
    price: Decimal,
    balance: Decimal,
  ) {
    const now = new Date();
    const expiresAt = new Date(user.vip_expires_at);
    const daysOverdue = Math.floor(
      (now.getTime() - expiresAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysOverdue <= 0) {
      // 还未到期，只记录即将欠费
      this.logger.warn(
        `用户 ${user.id} 余额不足 (${balance} < ${price})，即将欠费`,
      );

      // 记录欠费日志
      await this.prisma.client.billing_logs.create({
        data: {
          user_id: user.id,
          unique_order_id: `arrears_warning_${user.id}_${Date.now()}`,
          billing_type: 'arrears_warning',
          amount: price.toString(),
          currency: 'USDT',
          description: `VIP${vipLevel} 订阅即将到期，余额不足`,
          status: 'pending',
        },
      });
    } else if (daysOverdue <= 3) {
      // 宽限期内（1-3 天）
      this.logger.warn(
        `用户 ${user.id} 欠费 ${daysOverdue} 天，在宽限期内`,
      );
    } else {
      // 超过宽限期，执行降级
      await this.downgradeUser(user);
    }
  }

  /**
   * VIP 降级处理
   */
  private async downgradeUser(user: any) {
    this.logger.warn(`用户 ${user.id} 超过欠费宽限期，执行降级`);

    await this.prisma.client.$transaction(async (tx) => {
      // 1. VIP 降级到 0
      await tx.users.update({
        where: { id: user.id },
        data: {
          vip_level: 0,
          vip_expires_at: null,
          updated_at: new Date(),
        },
      });

      // 2. 停止该用户的所有 VPS 实例
      await tx.instances.updateMany({
        where: {
          user_id: user.id,
          status: 'running',
        },
        data: {
          status: 'stopped',
          updated_at: new Date(),
        },
      });

      // 3. 记录降级日志
      await tx.billing_logs.create({
        data: {
          user_id: user.id,
          unique_order_id: `downgrade_${user.id}_${Date.now()}`,
          billing_type: 'vip_downgrade',
          amount: '0',
          currency: 'USDT',
          description: '因欠费超过宽限期，VIP 降级到免费版',
          status: 'completed',
        },
      });
    });

    this.logger.log(`用户 ${user.id} 已降级到免费版，VPS 实例已停止`);
  }

  /**
   * 手动触发检查（用于测试）
   */
  async manualCheck() {
    return this.handleSubscriptionCheck();
  }
}
