import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../modules/billing/billing.service';
import { DigitalOceanService } from '../modules/digitalocean/digitalocean.service';
import Decimal from 'decimal.js';

/**
 * 订阅扣费定时任务
 * 每天检查 VIP 到期用户，自动续费或立即销毁
 *
 * 规则（白皮书 2.1）：
 * - 订阅即将到期 + 余额充足 = 自动续费
 * - 订阅到期 + 余额不足 = VIP 降级 + VPS 立即销毁（无宽限期）
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
    private readonly digitalOceanService: DigitalOceanService,
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
   * 处理欠费（无宽限期）
   * 策略：订阅到期 + 余额不足 = 立即降级 + VPS 销毁
   */
  private async handleArrears(
    user: any,
    vipLevel: number,
    price: Decimal,
    balance: Decimal,
  ) {
    const now = new Date();
    const expiresAt = new Date(user.vip_expires_at);

    if (now < expiresAt) {
      // 还未到期，只记录警告（提前 24 小时提醒）
      this.logger.warn(
        `用户 ${user.id} 余额不足 (${balance} < ${price})，订阅即将到期`,
      );

      // 记录欠费警告日志
      await this.prisma.client.billing_logs.create({
        data: {
          user_id: user.id,
          unique_order_id: `arrears_warning_${user.id}_${Date.now()}`,
          billing_type: 'arrears_warning',
          amount: price.toString(),
          currency: 'USDT',
          description: `VIP${vipLevel} 订阅即将到期，余额不足，请及时充值`,
          status: 'pending',
        },
      });
    } else {
      // 已到期，立即执行降级和 VPS 销毁（无宽限期）
      await this.downgradeAndDestroyVps(user, vipLevel);
    }
  }

  /**
   * VIP 降级并销毁 VPS
   * 规则（白皮书 2.1）：订阅到期 = VPS 立即销毁（无宽限期）
   */
  private async downgradeAndDestroyVps(user: any, vipLevel: number) {
    this.logger.warn(`用户 ${user.id} 订阅到期，执行降级并立即销毁 VPS`);

    // 先获取该用户的活跃实例（需要调用 DO API 销毁）
    const activeInstances = await this.prisma.client.instances.findMany({
      where: {
        user_id: user.id,
        status: { notIn: ['destroyed', 'error'] },
      },
    });

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

      // 2. 销毁该用户的所有活跃 VPS 实例（订阅到期立即销毁，无宽限期）
      await tx.instances.updateMany({
        where: {
          user_id: user.id,
          status: { notIn: ['destroyed', 'error'] },
        },
        data: {
          status: 'destroyed',
          destroyed_at: new Date(),
          destroy_reason: `VIP${vipLevel} 订阅到期，系统自动销毁`,
          updated_at: new Date(),
        },
      });

      // 2.1【Bug修复】将该用户所有活跃策略配置设为非活跃
      await tx.user_strategy_configs.updateMany({
        where: {
          user_id: user.id,
          is_active: true,
        },
        data: { is_active: false },
      });

      // 3. 记录降级日志
      await tx.billing_logs.create({
        data: {
          user_id: user.id,
          unique_order_id: `downgrade_destroy_${user.id}_${Date.now()}`,
          billing_type: 'vip_downgrade',
          amount: '0',
          currency: 'USDT',
          description: `VIP${vipLevel} 订阅到期，降级到免费版，${activeInstances.length} 个 VPS 实例已销毁`,
          status: 'completed',
        },
      });
    });

    // 4. 调用 DO API 销毁实际的 Droplet（事务外执行，避免 API 失败导致回滚）
    for (const instance of activeInstances) {
      if (instance.droplet_id) {
        try {
          this.logger.warn(
            `[订阅到期销毁] 正在销毁 Droplet: ${instance.droplet_id}, 实例: ${instance.id}`,
          );
          await this.digitalOceanService.destroyDroplet(instance.droplet_id);
          this.logger.log(
            `[订阅到期销毁] Droplet ${instance.droplet_id} 销毁成功`,
          );
        } catch (error) {
          this.logger.error(
            `[订阅到期销毁] 销毁 Droplet ${instance.droplet_id} 失败: ${error.message}`,
          );
          // 即使 DO API 失败，数据库状态已经是 destroyed，后续可以手动清理
        }
      }
    }

    this.logger.log(
      `用户 ${user.id} 已降级到免费版，${activeInstances.length} 个 VPS 实例已标记为销毁`,
    );
  }

  /**
   * 手动触发检查（用于测试）
   */
  async manualCheck() {
    return this.handleSubscriptionCheck();
  }
}
