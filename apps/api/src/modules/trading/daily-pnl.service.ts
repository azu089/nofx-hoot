import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { TradingService } from './trading.service';
import { NotificationsService } from '../notifications/notifications.service';
import Decimal from 'decimal.js';

interface DailyLossConfig {
  dailyMaxLossEnabled: boolean;
  dailyMaxLossPercent: number;
  dailyMaxLossAction: 'close_all' | 'close_half' | 'pause';
}

interface UserDailyPnl {
  userId: string;
  apiKeyId: string;
  startBalance: number; // 当日起始余额
  currentBalance: number; // 当前余额
  realizedPnl: number; // 已实现盈亏
  unrealizedPnl: number; // 未实现盈亏
  config: DailyLossConfig;
  isLocked: boolean; // 是否已锁定
}

@Injectable()
export class DailyPnlService implements OnModuleInit {
  private readonly logger = new Logger(DailyPnlService.name);
  private userDailyPnl: Map<string, UserDailyPnl> = new Map();

  constructor(
    private prisma: PrismaService,
    private tradingService: TradingService,
    private notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    await this.loadUserConfigs();
    await this.initializeDailyBalances();
  }

  // 每天 UTC 00:00 重置日盈亏
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetDailyPnl() {
    this.logger.log('重置每日盈亏统计...');

    for (const [userId, data] of this.userDailyPnl) {
      // 保存昨日结算记录
      await this.saveDailySettlement(userId, data);

      // 重置数据
      data.realizedPnl = 0;
      data.unrealizedPnl = 0;
      data.isLocked = false;

      // 更新起始余额
      try {
        data.startBalance = await this.tradingService.fetchBalance(
          userId,
          data.apiKeyId,
        );
        data.currentBalance = data.startBalance;
      } catch (error) {
        this.logger.warn(`获取用户 ${userId} 余额失败`);
      }
    }

    this.logger.log('每日盈亏已重置');
  }

  // 加载用户配置
  private async loadUserConfigs() {
    const subscriptions = await this.prisma.strategySubscription.findMany({
      where: {
        isActive: true,
        dailyMaxLossEnabled: true,
      },
      select: {
        userId: true,
        apiKeyId: true,
        dailyMaxLossEnabled: true,
        dailyMaxLossPercent: true,
        dailyMaxLossAction: true,
      },
    });

    for (const sub of subscriptions) {
      this.userDailyPnl.set(sub.userId, {
        userId: sub.userId,
        apiKeyId: sub.apiKeyId,
        startBalance: 0,
        currentBalance: 0,
        realizedPnl: 0,
        unrealizedPnl: 0,
        config: {
          dailyMaxLossEnabled: sub.dailyMaxLossEnabled || false,
          dailyMaxLossPercent: sub.dailyMaxLossPercent
            ? new Decimal(sub.dailyMaxLossPercent).toNumber()
            : 20,
          dailyMaxLossAction: (sub.dailyMaxLossAction as 'close_all' | 'close_half' | 'pause') || 'close_all',
        },
        isLocked: false,
      });
    }

    this.logger.log(`加载了 ${this.userDailyPnl.size} 个日盈亏配置`);
  }

  // 初始化当日余额
  private async initializeDailyBalances() {
    for (const [userId, data] of this.userDailyPnl) {
      try {
        const balance = await this.tradingService.fetchBalance(
          userId,
          data.apiKeyId,
        );
        data.startBalance = balance;
        data.currentBalance = balance;
      } catch (error) {
        this.logger.warn(`初始化用户 ${userId} 余额失败`);
      }
    }
  }

  // 记录已实现盈亏（平仓时调用）
  async recordRealizedPnl(
    userId: string,
    pnlUsdt: number,
    symbol: string,
    positionId: string,
  ): Promise<void> {
    const data = this.userDailyPnl.get(userId);
    if (!data) return;

    data.realizedPnl += pnlUsdt;
    this.logger.log(
      `用户 ${userId} 记录盈亏: ${pnlUsdt} USDT, 累计: ${data.realizedPnl}`,
    );

    // 检查日亏损限制
    await this.checkDailyLossLimit(userId);
  }

  // 更新未实现盈亏（定期调用）
  async updateUnrealizedPnl(
    userId: string,
    unrealizedPnl: number,
  ): Promise<void> {
    const data = this.userDailyPnl.get(userId);
    if (!data) return;

    data.unrealizedPnl = unrealizedPnl;

    // 检查日亏损限制
    await this.checkDailyLossLimit(userId);
  }

  // 检查日亏损限制
  async checkDailyLossLimit(userId: string): Promise<boolean> {
    const data = this.userDailyPnl.get(userId);
    if (!data || !data.config.dailyMaxLossEnabled || data.isLocked) {
      return false;
    }

    // 计算当日总亏损
    const totalPnl = data.realizedPnl + data.unrealizedPnl;
    const lossPercent =
      data.startBalance > 0
        ? (Math.abs(Math.min(0, totalPnl)) / data.startBalance) * 100
        : 0;

    if (lossPercent >= data.config.dailyMaxLossPercent) {
      await this.triggerDailyLossLimit(data, lossPercent);
      return true;
    }

    return false;
  }

  // 触发日亏损限制
  private async triggerDailyLossLimit(data: UserDailyPnl, lossPercent: number) {
    const { userId, apiKeyId, config } = data;
    const action = config.dailyMaxLossAction;

    this.logger.warn(
      `日亏损触发: 用户 ${userId} 亏损 ${lossPercent.toFixed(2)}% (限制 ${config.dailyMaxLossPercent}%), 动作: ${action}`,
    );

    // 锁定交易
    data.isLocked = true;

    // 根据动作执行
    const positions = await this.prisma.position.findMany({
      where: { userId, status: 'open' },
    });

    switch (action) {
      case 'close_all':
        // 全部平仓
        for (const pos of positions) {
          try {
            await this.tradingService.closePosition(
              userId,
              apiKeyId,
              pos.symbol,
              new Decimal(pos.amount).toNumber(),
              pos.side as 'long' | 'short',
            );
            await this.prisma.position.update({
              where: { id: pos.id },
              data: {
                status: 'closed',
                closedAt: new Date(),
                closeReason: 'daily_loss_limit',
              },
            });
          } catch (error) {
            this.logger.error(
              `平仓失败 ${pos.symbol}: ${(error as Error).message}`,
            );
          }
        }
        break;

      case 'close_half':
        // 平仓 50%
        for (const pos of positions) {
          try {
            const halfAmount = new Decimal(pos.amount).div(2).toNumber();
            await this.tradingService.closePosition(
              userId,
              apiKeyId,
              pos.symbol,
              halfAmount,
              pos.side as 'long' | 'short',
            );
            await this.prisma.position.update({
              where: { id: pos.id },
              data: {
                amount: new Decimal(pos.amount).div(2),
              },
            });
          } catch (error) {
            this.logger.error(
              `减仓失败 ${pos.symbol}: ${(error as Error).message}`,
            );
          }
        }
        break;

      case 'pause':
        // 仅暂停，不平仓
        break;
    }

    // 发送通知
    const actionText = {
      close_all: '已全部平仓',
      close_half: '已平仓50%',
      pause: '已暂停交易',
    }[action];

    await this.notificationsService.sendNotification(userId, {
      type: 'daily_loss_limit',
      title: '单日亏损限制触发',
      body: `当日亏损 ${lossPercent.toFixed(2)}% 已达到限制 ${config.dailyMaxLossPercent}%，${actionText}`,
      data: {
        lossPercent,
        limitPercent: config.dailyMaxLossPercent,
        action,
        realizedPnl: data.realizedPnl,
        unrealizedPnl: data.unrealizedPnl,
      },
    });

    // 记录风控日志
    await this.prisma.riskLog.create({
      data: {
        userId,
        reason: 'daily_loss_limit',
        details: JSON.stringify({
          lossPercent,
          limitPercent: config.dailyMaxLossPercent,
          action,
          realizedPnl: data.realizedPnl,
          unrealizedPnl: data.unrealizedPnl,
          startBalance: data.startBalance,
        }),
      },
    });
  }

  // 检查用户是否被锁定
  isUserLocked(userId: string): boolean {
    return this.userDailyPnl.get(userId)?.isLocked || false;
  }

  // 获取用户当日盈亏
  getUserDailyPnl(userId: string): {
    realizedPnl: number;
    unrealizedPnl: number;
    totalPnl: number;
    pnlPercent: number;
    isLocked: boolean;
  } | null {
    const data = this.userDailyPnl.get(userId);
    if (!data) return null;

    const totalPnl = data.realizedPnl + data.unrealizedPnl;
    const pnlPercent =
      data.startBalance > 0 ? (totalPnl / data.startBalance) * 100 : 0;

    return {
      realizedPnl: data.realizedPnl,
      unrealizedPnl: data.unrealizedPnl,
      totalPnl,
      pnlPercent,
      isLocked: data.isLocked,
    };
  }

  // 保存日结算记录
  private async saveDailySettlement(userId: string, data: UserDailyPnl) {
    const totalPnl = data.realizedPnl + data.unrealizedPnl;
    const pnlPercent =
      data.startBalance > 0 ? (totalPnl / data.startBalance) * 100 : 0;

    await this.prisma.dailySettlement.create({
      data: {
        userId,
        date: new Date(),
        startBalance: new Decimal(data.startBalance).toString(),
        endBalance: new Decimal(data.currentBalance).toString(),
        realizedPnl: new Decimal(data.realizedPnl).toString(),
        unrealizedPnl: new Decimal(data.unrealizedPnl).toString(),
        totalPnl: new Decimal(totalPnl).toString(),
        pnlPercent: new Decimal(pnlPercent).toString(),
        wasLocked: data.isLocked,
      },
    });

    this.logger.log(
      `保存日结算: 用户 ${userId}, 盈亏 ${totalPnl.toFixed(2)} USDT (${pnlPercent.toFixed(2)}%)`,
    );
  }

  // 手动解锁用户（管理员操作）
  unlockUser(userId: string): boolean {
    const data = this.userDailyPnl.get(userId);
    if (!data) return false;

    data.isLocked = false;
    this.logger.log(`用户 ${userId} 已手动解锁`);
    return true;
  }
}
