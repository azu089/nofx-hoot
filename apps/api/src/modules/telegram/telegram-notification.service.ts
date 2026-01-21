import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramBotService } from './telegram-bot.service';

/**
 * 通知设置默认值
 */
export const DEFAULT_NOTIFICATION_SETTINGS = {
  // 交易类
  trade_open: true,
  trade_close: true,
  stop_loss: true, // 强制开启
  large_profit: true,
  profit_threshold: 100, // 大额盈利阈值（美元）
  strategy_error: true, // 强制开启

  // 资金类
  deposit_confirm: true,
  withdraw_complete: true,

  // 生态类
  stake_expiry: true,
  vesting_release: false, // 默认关闭（频繁）
  dividend_receive: true,

  // 运营类
  checkin_reminder: false, // 默认关闭
  checkin_reminder_time: '09:00',
  invite_success: true,
  rank_change: false, // 默认关闭
  rank_change_threshold: 5,

  // 系统类
  daily_report: true,
  daily_report_time: '20:00',
  vip_expiry: true,
  system_announcement: true,

  // 市场类（P2）
  price_alerts: [],
};

export type NotificationSettings = typeof DEFAULT_NOTIFICATION_SETTINGS;

/**
 * Telegram 通知管理服务
 * 负责：
 * 1. 管理用户通知设置
 * 2. 判断是否应发送通知
 * 3. 调用 Bot 服务发送通知
 */
@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botService: TelegramBotService,
  ) {}

  /**
   * 获取用户通知设置
   */
  async getNotificationSettings(userId: string): Promise<NotificationSettings> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { notification_settings: true },
    });

    if (!user?.notification_settings) {
      return { ...DEFAULT_NOTIFICATION_SETTINGS };
    }

    // 合并默认设置和用户设置
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(user.notification_settings as Partial<NotificationSettings>),
    };
  }

  /**
   * 更新用户通知设置
   */
  async updateNotificationSettings(
    userId: string,
    settings: Partial<NotificationSettings>,
  ): Promise<NotificationSettings> {
    // 强制开启的通知不允许关闭
    if ('stop_loss' in settings) {
      settings.stop_loss = true;
    }
    if ('strategy_error' in settings) {
      settings.strategy_error = true;
    }

    const currentSettings = await this.getNotificationSettings(userId);
    const newSettings = { ...currentSettings, ...settings };

    await this.prisma.client.users.update({
      where: { id: userId },
      data: {
        notification_settings: newSettings as any,
      },
    });

    this.logger.log(`用户 ${userId} 更新通知设置`);
    return newSettings;
  }

  /**
   * 检查是否应该发送某类通知
   */
  private async shouldNotify(userId: string, notificationType: keyof NotificationSettings): Promise<boolean> {
    const settings = await this.getNotificationSettings(userId);
    return !!settings[notificationType];
  }

  /**
   * 检查用户是否绑定了 Telegram
   */
  private async hasTelegramId(userId: string): Promise<boolean> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { telegram_id: true },
    });
    return !!user?.telegram_id;
  }

  // ==================== 交易类通知 ====================

  /**
   * 发送策略开仓通知
   */
  async notifyTradeOpen(
    userId: string,
    data: {
      strategyName: string;
      symbol: string;
      side: 'long' | 'short';
      amount: string;
      price: string;
    },
  ): Promise<boolean> {
    if (!(await this.hasTelegramId(userId))) return false;
    if (!(await this.shouldNotify(userId, 'trade_open'))) return false;

    return this.botService.sendTradeOpenNotification(userId, data);
  }

  /**
   * 发送策略平仓通知
   */
  async notifyTradeClose(
    userId: string,
    data: {
      strategyName: string;
      symbol: string;
      profit: string;
      profitPercent: string;
    },
  ): Promise<boolean> {
    if (!(await this.hasTelegramId(userId))) return false;
    if (!(await this.shouldNotify(userId, 'trade_close'))) return false;

    return this.botService.sendTradeCloseNotification(userId, data);
  }

  /**
   * 发送止损触发通知（强制）
   */
  async notifyStopLoss(
    userId: string,
    data: {
      strategyName: string;
      symbol: string;
      loss: string;
      lossPercent: string;
      stopPrice: string;
    },
  ): Promise<boolean> {
    if (!(await this.hasTelegramId(userId))) return false;
    // 止损通知强制发送，不检查设置

    return this.botService.sendStopLossNotification(userId, data);
  }

  /**
   * 发送大额盈利通知
   */
  async notifyLargeProfit(
    userId: string,
    data: {
      strategyName: string;
      symbol: string;
      profit: string;
      profitPercent: string;
    },
  ): Promise<boolean> {
    if (!(await this.hasTelegramId(userId))) return false;

    const settings = await this.getNotificationSettings(userId);
    if (!settings.large_profit) return false;

    const profitNum = parseFloat(data.profit);
    if (profitNum < settings.profit_threshold) return false;

    return this.botService.sendTradeCloseNotification(userId, data);
  }

  // ==================== 资金类通知 ====================

  /**
   * 发送充值到账通知
   */
  async notifyDeposit(
    userId: string,
    data: {
      amount: string;
      chain: string;
      txHash?: string;
    },
  ): Promise<boolean> {
    if (!(await this.hasTelegramId(userId))) return false;
    if (!(await this.shouldNotify(userId, 'deposit_confirm'))) return false;

    return this.botService.sendDepositNotification(userId, data);
  }

  /**
   * 发送提现完成通知
   */
  async notifyWithdraw(
    userId: string,
    data: {
      amount: string;
      chain: string;
      address: string;
      txHash?: string;
    },
  ): Promise<boolean> {
    if (!(await this.hasTelegramId(userId))) return false;
    if (!(await this.shouldNotify(userId, 'withdraw_complete'))) return false;

    return this.botService.sendWithdrawNotification(userId, data);
  }

  // ==================== 生态类通知 ====================

  /**
   * 发送分红到账通知
   */
  async notifyDividend(
    userId: string,
    data: {
      usdtAmount: string;
      qfiAmount: string;
    },
  ): Promise<boolean> {
    if (!(await this.hasTelegramId(userId))) return false;
    if (!(await this.shouldNotify(userId, 'dividend_receive'))) return false;

    return this.botService.sendDividendNotification(userId, data);
  }

  /**
   * 发送质押到期提醒
   */
  async notifyStakeExpiry(
    userId: string,
    data: {
      stakeType: string;
      amount: string;
      expiryDate: string;
      daysRemaining: number;
    },
  ): Promise<boolean> {
    if (!(await this.hasTelegramId(userId))) return false;
    if (!(await this.shouldNotify(userId, 'stake_expiry'))) return false;

    return this.botService.sendStakeExpiryNotification(userId, data);
  }

  // ==================== 运营类通知 ====================

  /**
   * 发送邀请成功通知
   */
  async notifyInviteSuccess(
    userId: string,
    data: {
      inviteeName: string;
    },
  ): Promise<boolean> {
    if (!(await this.hasTelegramId(userId))) return false;
    if (!(await this.shouldNotify(userId, 'invite_success'))) return false;

    return this.botService.sendInviteSuccessNotification(userId, data);
  }

  /**
   * 发送每日报告
   */
  async notifyDailyReport(
    userId: string,
    data: {
      totalPnl: string;
      tradeCount: number;
      winRate: string;
      bestTrade?: { symbol: string; profit: string };
      activeStrategies: number;
    },
  ): Promise<boolean> {
    if (!(await this.hasTelegramId(userId))) return false;
    if (!(await this.shouldNotify(userId, 'daily_report'))) return false;

    return this.botService.sendDailyReport(userId, data);
  }

  // ==================== 系统类通知 ====================

  /**
   * 发送系统公告
   */
  async broadcastAnnouncement(
    title: string,
    content: string,
    targetUserIds?: string[],
  ): Promise<{ success: number; failed: number }> {
    return this.botService.broadcastAnnouncement(title, content, targetUserIds);
  }

  // ==================== 批量通知 ====================

  /**
   * 获取所有启用每日报告的用户（用于定时任务）
   */
  async getUsersForDailyReport(): Promise<string[]> {
    const users = await this.prisma.client.users.findMany({
      where: {
        telegram_id: { not: null },
        status: 'active',
      },
      select: { id: true, notification_settings: true },
    });

    return users
      .filter((user) => {
        const settings = {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          ...(user.notification_settings as Partial<NotificationSettings> || {}),
        };
        return settings.daily_report;
      })
      .map((user) => user.id);
  }

  /**
   * 获取所有启用签到提醒的用户
   */
  async getUsersForCheckinReminder(): Promise<string[]> {
    const users = await this.prisma.client.users.findMany({
      where: {
        telegram_id: { not: null },
        status: 'active',
      },
      select: { id: true, notification_settings: true },
    });

    return users
      .filter((user) => {
        const settings = {
          ...DEFAULT_NOTIFICATION_SETTINGS,
          ...(user.notification_settings as Partial<NotificationSettings> || {}),
        };
        return settings.checkin_reminder;
      })
      .map((user) => user.id);
  }
}
