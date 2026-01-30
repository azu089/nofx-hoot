import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';

// 通知类型
export enum NotificationType {
  // 交易相关
  SIGNAL_RECEIVED = 'signal_received',
  POSITION_OPENED = 'position_opened',
  POSITION_CLOSED = 'position_closed',
  TRADE_FAILED = 'trade_failed',

  // 资金相关
  DEPOSIT_CONFIRMED = 'deposit_confirmed',
  WITHDRAW_APPROVED = 'withdraw_approved',
  WITHDRAW_REJECTED = 'withdraw_rejected',

  // 质押相关
  STAKING_CREATED = 'staking_created',
  DIVIDEND_RECEIVED = 'dividend_received',

  // 系统相关
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  SECURITY_ALERT = 'security_alert',
}

// 通知渠道
export enum NotificationChannel {
  IN_APP = 'in_app',       // WebSocket 推送
  TELEGRAM = 'telegram',   // Telegram Bot
  EMAIL = 'email',         // 邮件
}

// 发送通知 DTO
export class SendNotificationDto {
  @IsString()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @IsOptional()
  channels?: NotificationChannel[];
}

// 通知模板
export interface NotificationTemplate {
  type: NotificationType;
  title: string;
  messageTemplate: string;
  defaultChannels: NotificationChannel[];
}

// 通知记录
export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  channels: NotificationChannel[];
  read: boolean;
  createdAt: Date;
}
