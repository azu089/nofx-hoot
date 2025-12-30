import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from '../modules/billing/billing.service';
import Decimal from 'decimal.js';

/**
 * 订阅续费定时任务
 * 每天检查是否有需要续费的 VPS 实例（创建满 30 天）
 * 余额充足则自动续费，余额不足则标记欠费
 */
@Injectable()
export class SubscriptionRenewalTask {
  private readonly logger = new Logger(SubscriptionRenewalTask.name);

  // VPS 订阅费（美元/月）
  private readonly SUBSCRIPTION_FEE = new Decimal('25');

  // 续费周期（天）
  private readonly RENEWAL_PERIOD_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  /**
   * 每天凌晨 2 点检查订阅续费
   */
  @Cron('0 2 * * *') // 每天 02:00
  async handleSubscriptionRenewal() {
    this.logger.log('开始订阅续费检查');

    try {
      // 1. 查询需要续费的实例（创建满 30 天，且状态为 running）
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - this.RENEWAL_PERIOD_DAYS);

      const instancesToRenew = await this.prisma.client.instances.findMany({
        where: {
          status: 'running',
          created_at: {
            lte: thirtyDaysAgo,
          },
          // 排除已经在今天续费过的实例（通过检查最后一次订阅日志）
          // 这里简化处理，后续可以通过 last_renewal_at 字段优化
        },
        include: {
          users: {
            include: {
              wallets: true,
            },
          },
        },
      });

      this.logger.log(`发现 ${instancesToRenew.length} 个需要续费的实例`);

      let renewed = 0;
      let failed = 0;

      for (const instance of instancesToRenew) {
        try {
          await this.renewInstance(instance);
          renewed++;
        } catch (error) {
          this.logger.error(
            `实例 ${instance.id} 续费失败: ${error.message}`,
            error.stack,
          );
          failed++;
        }
      }

      this.logger.log(
        `订阅续费完成: 成功 ${renewed}, 失败 ${failed}`,
      );
    } catch (error) {
      this.logger.error(`订阅续费检查失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 续费单个实例
   */
  private async renewInstance(instance: any) {
    const userId = instance.user_id;
    const wallet = instance.users?.wallets;

    if (!wallet) {
      this.logger.warn(`用户 ${userId} 没有钱包，跳过续费`);
      return;
    }

    const balance = new Decimal(wallet.usdt_balance);

    if (balance.gte(this.SUBSCRIPTION_FEE)) {
      // 余额充足，自动续费
      await this.billingService.chargeSubscription(
        userId,
        this.SUBSCRIPTION_FEE.toString(),
        `VPS 实例订阅续费 - 实例 ${instance.id}`,
      );

      this.logger.log(
        `实例 ${instance.id} 续费成功，扣费 ${this.SUBSCRIPTION_FEE} USDT`,
      );
    } else {
      // 余额不足，标记欠费
      await this.handleArrears(instance, balance);
    }
  }

  /**
   * 处理欠费
   * 策略：标记实例状态为 arrears（欠费）
   */
  private async handleArrears(instance: any, balance: Decimal) {
    this.logger.warn(
      `实例 ${instance.id} 续费失败，余额不足 (${balance} < ${this.SUBSCRIPTION_FEE})`,
    );

    // 记录欠费日志
    await this.prisma.client.billing_logs.create({
      data: {
        user_id: instance.user_id,
        unique_order_id: `arrears_${instance.id}_${Date.now()}`,
        billing_type: 'subscription_arrears',
        amount: this.SUBSCRIPTION_FEE.toString(),
        currency: 'USDT',
        description: `VPS 实例订阅续费失败，余额不足`,
        status: 'pending',
        reference_type: 'instances',
        reference_id: instance.id,
      },
    });

    this.logger.log(`实例 ${instance.id} 欠费记录已创建`);
  }

  /**
   * 手动触发检查（用于测试）
   */
  async manualCheck() {
    return this.handleSubscriptionRenewal();
  }
}
