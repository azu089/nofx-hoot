import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';

/**
 * 余额检测定时任务
 * 每小时检测用户余额是否欠费（余额 < 0）
 * 欠费超过 3 天的用户，标记其 VPS 实例为待销毁
 */
@Injectable()
export class BalanceCheckTask {
  private readonly logger = new Logger(BalanceCheckTask.name);

  // 欠费宽限期（天）
  private readonly ARREARS_GRACE_PERIOD_DAYS = 3;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 每小时检查余额
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleBalanceCheck() {
    this.logger.debug('开始余额检测');

    try {
      // 1. 查询余额 < 0 的用户
      const arrearsUsers = await this.prisma.client.wallets.findMany({
        where: {
          usdt_balance: {
            lt: 0,
          },
        },
        include: {
          users: {
            include: {
              instances: {
                where: {
                  status: { in: ['running', 'stopped', 'provisioning'] },
                },
              },
            },
          },
        },
      });

      if (arrearsUsers.length === 0) {
        this.logger.debug('没有欠费用户');
        return;
      }

      this.logger.log(`发现 ${arrearsUsers.length} 个欠费用户`);

      let marked = 0;
      let warned = 0;

      for (const wallet of arrearsUsers) {
        try {
          const result = await this.checkUserArrears(wallet);
          if (result === 'marked') marked++;
          if (result === 'warned') warned++;
        } catch (error) {
          this.logger.error(
            `检查用户 ${wallet.user_id} 欠费失败: ${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log(
        `余额检测完成: 标记待销毁 ${marked}, 欠费提醒 ${warned}`,
      );
    } catch (error) {
      this.logger.error(`余额检测失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 检查单个用户的欠费情况
   * @returns 'marked' | 'warned' | 'skipped'
   */
  private async checkUserArrears(wallet: any): Promise<string> {
    const userId = wallet.user_id;
    const balance = new Decimal(wallet.usdt_balance);

    this.logger.debug(`用户 ${userId} 余额: ${balance}`);

    // 查询最早的欠费日志（状态为 pending）
    const firstArrearsLog = await this.prisma.client.billing_logs.findFirst({
      where: {
        user_id: userId,
        billing_type: { in: ['subscription_arrears', 'arrears_warning'] },
        status: 'pending',
      },
      orderBy: { created_at: 'asc' },
    });

    if (!firstArrearsLog) {
      // 首次检测到欠费，创建欠费提醒
      await this.createArrearsWarning(userId, balance);
      return 'warned';
    }

    // 计算欠费天数
    const now = new Date();
    const arrearsDays = Math.floor(
      (now.getTime() - firstArrearsLog.created_at.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    this.logger.debug(
      `用户 ${userId} 已欠费 ${arrearsDays} 天，宽限期 ${this.ARREARS_GRACE_PERIOD_DAYS} 天`,
    );

    if (arrearsDays >= this.ARREARS_GRACE_PERIOD_DAYS) {
      // 超过宽限期，标记 VPS 为待销毁
      await this.markInstancesForDestruction(wallet.users);
      return 'marked';
    }

    return 'skipped';
  }

  /**
   * 创建欠费提醒
   */
  private async createArrearsWarning(userId: string, balance: Decimal) {
    this.logger.warn(`用户 ${userId} 首次检测到欠费，余额: ${balance}`);

    await this.prisma.client.billing_logs.create({
      data: {
        user_id: userId,
        unique_order_id: `arrears_warning_${userId}_${Date.now()}`,
        billing_type: 'arrears_warning',
        amount: balance.abs().toString(),
        currency: 'USDT',
        description: `余额不足，当前余额: ${balance} USDT`,
        status: 'pending',
      },
    });

    this.logger.log(`用户 ${userId} 欠费提醒已创建`);
  }

  /**
   * 标记用户的 VPS 实例为待销毁
   */
  private async markInstancesForDestruction(user: any) {
    const userId = user.id;
    const instances = user.instances || [];

    if (instances.length === 0) {
      this.logger.debug(`用户 ${userId} 没有活跃实例，跳过`);
      return;
    }

    this.logger.warn(
      `用户 ${userId} 欠费超过宽限期，标记 ${instances.length} 个实例为待销毁`,
    );

    for (const instance of instances) {
      await this.prisma.client.instances.update({
        where: { id: instance.id },
        data: {
          status: 'pending_destroy',
          destroy_reason: `用户欠费超过 ${this.ARREARS_GRACE_PERIOD_DAYS} 天宽限期`,
          updated_at: new Date(),
        },
      });

      this.logger.log(`实例 ${instance.id} 已标记为待销毁`);
    }
  }

  /**
   * 手动触发检查（用于测试）
   */
  async manualCheck() {
    return this.handleBalanceCheck();
  }
}
