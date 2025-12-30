import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import Decimal from 'decimal.js';

/**
 * 燃油费欠费催收定时任务
 * 每小时检查 pending 状态的燃油费，尝试从点卡余额补扣
 */
@Injectable()
export class GasFeeArrearsTask {
  private readonly logger = new Logger(GasFeeArrearsTask.name);

  // 欠费超过 7 天未补扣，发送警告
  private readonly WARNING_DAYS = 7;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 每小时执行一次欠费催收
   */
  @Cron('0 * * * *') // 每小时整点执行
  async handleGasFeeArrears() {
    this.logger.log('开始燃油费欠费催收');

    try {
      // 1. 查询所有 pending 状态的燃油费欠费记录
      const pendingLogs = await this.prisma.client.billing_logs.findMany({
        where: {
          billing_type: 'gas_fee',
          status: 'pending',
        },
        orderBy: {
          created_at: 'asc',
        },
      });

      this.logger.log(`发现 ${pendingLogs.length} 条燃油费欠费记录`);

      if (pendingLogs.length === 0) {
        return;
      }

      // 2. 按用户分组处理
      const userArrearsMap = new Map<string, typeof pendingLogs>();
      for (const log of pendingLogs) {
        const userId = log.user_id;
        if (!userArrearsMap.has(userId)) {
          userArrearsMap.set(userId, []);
        }
        userArrearsMap.get(userId)!.push(log);
      }

      // 3. 逐用户处理欠费
      let successCount = 0;
      let failCount = 0;

      for (const [userId, userLogs] of userArrearsMap) {
        const result = await this.processUserArrears(userId, userLogs);
        successCount += result.success;
        failCount += result.fail;
      }

      this.logger.log(
        `燃油费欠费催收完成: 成功补扣 ${successCount} 条, 仍欠费 ${failCount} 条`,
      );
    } catch (error) {
      this.logger.error(`燃油费欠费催收失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 处理单个用户的欠费
   */
  private async processUserArrears(
    userId: string,
    arrearLogs: any[],
  ): Promise<{ success: number; fail: number }> {
    let success = 0;
    let fail = 0;

    // 获取用户钱包
    const wallet = await this.prisma.client.wallets.findUnique({
      where: { user_id: userId },
    });

    if (!wallet) {
      this.logger.warn(`用户 ${userId} 没有钱包，跳过`);
      return { success: 0, fail: arrearLogs.length };
    }

    let cardBalance = new Decimal(wallet.card_balance);

    for (const log of arrearLogs) {
      const arrearsAmount = new Decimal(log.amount);
      const arrearsAge = this.getAgeDays(log.created_at);

      // 检查点卡余额是否足够
      if (cardBalance.gte(arrearsAmount)) {
        // 点卡余额充足，执行补扣
        const result = await this.collectArrears(
          userId,
          log.id,
          arrearsAmount,
          cardBalance,
        );
        if (result) {
          cardBalance = cardBalance.minus(arrearsAmount);
          success++;
        } else {
          fail++;
        }
      } else {
        // 点卡不足
        fail++;

        // 超过 7 天，记录警告
        if (arrearsAge >= this.WARNING_DAYS) {
          await this.createWarningLog(userId, log.id, arrearsAmount, arrearsAge);
        }
      }
    }

    return { success, fail };
  }

  /**
   * 执行欠费补扣
   */
  private async collectArrears(
    userId: string,
    logId: string,
    amount: Decimal,
    currentBalance: Decimal,
  ): Promise<boolean> {
    try {
      await this.prisma.client.$transaction(async (tx) => {
        // 1. 扣除点卡余额
        await tx.wallets.update({
          where: { user_id: userId },
          data: {
            card_balance: currentBalance.minus(amount).toString(),
            updated_at: new Date(),
          },
        });

        // 2. 更新欠费记录状态为 completed
        await tx.billing_logs.update({
          where: { id: logId },
          data: {
            status: 'completed',
          },
        });

        // 3. 添加新的日志记录（补扣成功）
        await tx.billing_logs.create({
          data: {
            user_id: userId,
            unique_order_id: `gas_fee_arrears_collect_${logId}_${Date.now()}`,
            billing_type: 'gas_fee_arrears_collect',
            amount: amount.toString(),
            currency: 'CARD',
            description: `燃油费欠费补扣成功，原记录ID: ${logId}`,
            status: 'completed',
          },
        });
      });

      this.logger.log(
        `用户 ${userId} 燃油费欠费 ${amount} 点卡补扣成功`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `用户 ${userId} 燃油费补扣失败: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * 创建超期欠费警告日志
   */
  private async createWarningLog(
    userId: string,
    logId: string,
    amount: Decimal,
    days: number,
  ) {
    // 检查是否已经创建过警告
    const existingWarning = await this.prisma.client.billing_logs.findFirst({
      where: {
        user_id: userId,
        billing_type: 'gas_fee_arrears_warning',
        description: {
          contains: logId,
        },
      },
    });

    if (existingWarning) {
      return; // 已经警告过，跳过
    }

    await this.prisma.client.billing_logs.create({
      data: {
        user_id: userId,
        unique_order_id: `gas_fee_arrears_warning_${logId}_${Date.now()}`,
        billing_type: 'gas_fee_arrears_warning',
        amount: amount.toString(),
        currency: 'CARD',
        description: `燃油费欠费超过 ${days} 天未补扣，原记录ID: ${logId}，请充值点卡`,
        status: 'warning',
      },
    });

    this.logger.warn(
      `用户 ${userId} 燃油费欠费 ${amount} 超过 ${days} 天，已记录警告`,
    );
  }

  /**
   * 计算记录创建天数
   */
  private getAgeDays(createdAt: Date): number {
    const now = new Date();
    const created = new Date(createdAt);
    return Math.floor(
      (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  /**
   * 手动触发催收（用于测试）
   */
  async manualCollect() {
    return this.handleGasFeeArrears();
  }

  /**
   * 获取欠费统计
   */
  async getArrearsStats(): Promise<{
    totalArrears: string;
    userCount: number;
    oldestDays: number;
    recentCollected: number;
  }> {
    // 统计欠费总额
    const pendingLogs = await this.prisma.client.billing_logs.findMany({
      where: {
        billing_type: 'gas_fee',
        status: 'pending',
      },
    });

    const totalArrears = pendingLogs.reduce(
      (sum, log) => sum.plus(new Decimal(log.amount)),
      new Decimal(0),
    );

    // 统计欠费用户数
    const uniqueUsers = new Set(pendingLogs.map((log) => log.user_id));

    // 最久欠费天数
    const oldestDays =
      pendingLogs.length > 0
        ? Math.max(...pendingLogs.map((log) => this.getAgeDays(log.created_at)))
        : 0;

    // 最近 24 小时补扣成功数
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const recentCollected = await this.prisma.client.billing_logs.count({
      where: {
        billing_type: 'gas_fee_arrears_collect',
        created_at: { gte: yesterday },
      },
    });

    return {
      totalArrears: totalArrears.toString(),
      userCount: uniqueUsers.size,
      oldestDays,
      recentCollected,
    };
  }
}
