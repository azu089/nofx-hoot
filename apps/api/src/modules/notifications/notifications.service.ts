import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TradingGateway } from '../../gateways/trading.gateway';
import {
  SendNotificationDto,
  NotificationType,
  NotificationChannel,
  NotificationTemplate,
} from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // 通知模板
  private readonly templates: Map<NotificationType, NotificationTemplate> = new Map([
    [NotificationType.SIGNAL_RECEIVED, {
      type: NotificationType.SIGNAL_RECEIVED,
      title: '📊 新交易信号',
      messageTemplate: '策略 {strategyName} 发出 {side} 信号: {symbol} @ {price}',
      defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.TELEGRAM],
    }],
    [NotificationType.POSITION_OPENED, {
      type: NotificationType.POSITION_OPENED,
      title: '✅ 开仓成功',
      messageTemplate: '{symbol} {side} 开仓成功，入场价 {entryPrice}',
      defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.TELEGRAM],
    }],
    [NotificationType.POSITION_CLOSED, {
      type: NotificationType.POSITION_CLOSED,
      title: '📈 平仓完成',
      messageTemplate: '{symbol} 平仓完成，盈亏 {pnl} USDT',
      defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.TELEGRAM],
    }],
    [NotificationType.TRADE_FAILED, {
      type: NotificationType.TRADE_FAILED,
      title: '❌ 交易失败',
      messageTemplate: '{symbol} 交易执行失败: {reason}',
      defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.TELEGRAM],
    }],
    [NotificationType.DEPOSIT_CONFIRMED, {
      type: NotificationType.DEPOSIT_CONFIRMED,
      title: '💰 充值到账',
      messageTemplate: '充值 {amount} {asset} 已到账',
      defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    }],
    [NotificationType.WITHDRAW_APPROVED, {
      type: NotificationType.WITHDRAW_APPROVED,
      title: '✅ 提现已审核',
      messageTemplate: '提现 {amount} {asset} 已审核通过，请查收',
      defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    }],
    [NotificationType.WITHDRAW_REJECTED, {
      type: NotificationType.WITHDRAW_REJECTED,
      title: '❌ 提现被拒',
      messageTemplate: '提现 {amount} {asset} 审核未通过: {reason}',
      defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    }],
    [NotificationType.DIVIDEND_RECEIVED, {
      type: NotificationType.DIVIDEND_RECEIVED,
      title: '💎 分红到账',
      messageTemplate: '质押分红 {amount} USDT 已发放',
      defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.TELEGRAM],
    }],
    [NotificationType.SYSTEM_ANNOUNCEMENT, {
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title: '📢 系统公告',
      messageTemplate: '{message}',
      defaultChannels: [NotificationChannel.IN_APP],
    }],
  ]);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TradingGateway))
    private tradingGateway: TradingGateway,
  ) {}

  // 发送通知
  async send(dto: SendNotificationDto): Promise<void> {
    const template = this.templates.get(dto.type);
    const channels = dto.channels || template?.defaultChannels || [NotificationChannel.IN_APP];

    // 渲染消息
    const message = this.renderMessage(dto.message || template?.messageTemplate || '', dto.data);
    const title = dto.title || template?.title || '通知';

    this.logger.log(`发送通知给用户 ${dto.userId}: ${title}`);

    // 保存通知记录到数据库
    await this.saveNotification(dto.userId, dto.type, title, message, channels);

    // 通过各渠道发送
    for (const channel of channels) {
      try {
        switch (channel) {
          case NotificationChannel.IN_APP:
            await this.sendInApp(dto.userId, title, message, dto.type, dto.data);
            break;
          case NotificationChannel.TELEGRAM:
            await this.sendTelegram(dto.userId, title, message);
            break;
          case NotificationChannel.EMAIL:
            await this.sendEmail(dto.userId, title, message);
            break;
        }
      } catch (error) {
        this.logger.error(`通知发送失败 (${channel}): ${error.message}`);
      }
    }
  }

  // WebSocket 推送
  private async sendInApp(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    data?: Record<string, any>,
  ): Promise<void> {
    this.tradingGateway.sendNotification(userId, {
      type,
      title,
      message,
      data,
    });
  }

  // Telegram 推送
  private async sendTelegram(
    userId: string,
    title: string,
    message: string,
  ): Promise<void> {
    // 获取用户的 Telegram ID
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true },
    });

    if (!user?.telegramId) {
      this.logger.debug(`用户 ${userId} 未绑定 Telegram，跳过推送`);
      return;
    }

    // TODO: 调用 Telegram Bot API 发送消息
    // 这里可以通过 HTTP 调用 telegram-bot 服务，或使用消息队列
    this.logger.log(`Telegram 推送给 ${user.telegramId}: ${title}`);
  }

  // 邮件推送
  private async sendEmail(
    userId: string,
    title: string,
    message: string,
  ): Promise<void> {
    // 获取用户邮箱
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user?.email) {
      return;
    }

    // TODO: 集成邮件服务（如 Novu, SendGrid, AWS SES）
    this.logger.log(`邮件推送给 ${user.email}: ${title}`);
  }

  // 保存通知记录
  private async saveNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    channels: NotificationChannel[],
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        channels: channels.join(','),
        read: false,
      },
    });
  }

  // 渲染消息模板
  private renderMessage(template: string, data?: Record<string, any>): string {
    if (!data) return template;

    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), String(value));
    }
    return result;
  }

  // ==================== 用户 API ====================

  // 获取用户通知列表
  async getNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      items: notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // 标记通知为已读
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: { read: true },
    });
  }

  // 标记所有通知为已读
  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  // 获取未读数量
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  // ==================== 便捷方法 ====================

  // 发送信号通知
  async notifySignalReceived(
    userId: string,
    strategyName: string,
    symbol: string,
    side: string,
    price: string,
  ): Promise<void> {
    await this.send({
      userId,
      type: NotificationType.SIGNAL_RECEIVED,
      title: '📊 新交易信号',
      message: '',
      data: { strategyName, symbol, side, price },
    });
  }

  // 发送开仓通知
  async notifyPositionOpened(
    userId: string,
    symbol: string,
    side: string,
    entryPrice: string,
  ): Promise<void> {
    await this.send({
      userId,
      type: NotificationType.POSITION_OPENED,
      title: '✅ 开仓成功',
      message: '',
      data: { symbol, side, entryPrice },
    });
  }

  // 发送平仓通知
  async notifyPositionClosed(
    userId: string,
    symbol: string,
    pnl: string,
  ): Promise<void> {
    await this.send({
      userId,
      type: NotificationType.POSITION_CLOSED,
      title: '📈 平仓完成',
      message: '',
      data: { symbol, pnl },
    });
  }

  // 发送分红通知
  async notifyDividendReceived(
    userId: string,
    amount: string,
  ): Promise<void> {
    await this.send({
      userId,
      type: NotificationType.DIVIDEND_RECEIVED,
      title: '💎 分红到账',
      message: '',
      data: { amount },
    });
  }
}
