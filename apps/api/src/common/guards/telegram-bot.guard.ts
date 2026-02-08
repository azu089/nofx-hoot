import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';

/**
 * Telegram Bot 专用守卫
 *
 * 保护仅供 Telegram Bot 调用的公开端点，防止外部滥用。
 * 验证方式：请求头 X-Telegram-Bot-Secret 必须匹配环境变量 TELEGRAM_BOT_API_SECRET
 * 使用 timingSafeEqual 防止时序攻击。
 */
@Injectable()
export class TelegramBotGuard implements CanActivate {
  private readonly logger = new Logger(TelegramBotGuard.name);
  private readonly botApiSecret: string;

  constructor() {
    this.botApiSecret = process.env.TELEGRAM_BOT_API_SECRET || '';
    if (!this.botApiSecret) {
      this.logger.warn(
        'TELEGRAM_BOT_API_SECRET 未配置，Telegram Bot 端点验证将被跳过（仅限开发环境）',
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // 开发环境且未配置密钥时跳过验证
    if (!this.botApiSecret && process.env.NODE_ENV !== 'production') {
      this.logger.debug('开发环境跳过 Telegram Bot 端点验证');
      return true;
    }

    if (!this.botApiSecret) {
      throw new UnauthorizedException('Telegram Bot 验证配置错误');
    }

    const providedSecret = request.headers['x-telegram-bot-secret'] as string;
    if (!providedSecret) {
      this.logger.warn('缺少 Telegram Bot 密钥', { ip: request.ip });
      throw new UnauthorizedException('未授权访问');
    }

    // 使用时间安全比较防止时序攻击
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(providedSecret, 'utf8'),
        Buffer.from(this.botApiSecret, 'utf8'),
      );

      if (!isValid) {
        this.logger.warn('Telegram Bot 密钥验证失败', { ip: request.ip });
        throw new UnauthorizedException('未授权访问');
      }
    } catch (error) {
      // timingSafeEqual 在长度不一致时抛出异常
      this.logger.warn('Telegram Bot 密钥验证失败', { ip: request.ip });
      throw new UnauthorizedException('未授权访问');
    }

    return true;
  }
}
