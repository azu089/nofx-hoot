import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Telegram initData 验证守卫
 * 用于验证请求头中的 Telegram initData
 */
@Injectable()
export class TelegramGuard implements CanActivate {
  private readonly botToken: string;
  private readonly initDataMaxAge = 5 * 60 * 1000; // 5 分钟

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 从请求头获取 initData
    const initData = request.headers['x-telegram-init-data'] as string;

    if (!initData) {
      throw new UnauthorizedException('缺少 Telegram 认证数据');
    }

    if (!this.botToken) {
      throw new UnauthorizedException('Telegram 认证未配置');
    }

    // 验证签名
    const isValid = this.verifyInitData(initData);
    if (!isValid) {
      throw new UnauthorizedException('Telegram 认证失败');
    }

    // 解析用户信息并附加到请求
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (userStr) {
      try {
        request.telegramUser = JSON.parse(userStr);
      } catch {
        // 忽略解析错误
      }
    }

    return true;
  }

  private verifyInitData(initData: string): boolean {
    try {
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');

      if (!hash) return false;

      // 检查时效性
      const authDateStr = params.get('auth_date');
      if (!authDateStr) return false;

      const authDate = parseInt(authDateStr, 10) * 1000;
      if (Date.now() - authDate > this.initDataMaxAge) {
        return false;
      }

      // 构建数据检查字符串
      const dataCheckArr: string[] = [];
      params.forEach((value, key) => {
        if (key !== 'hash') {
          dataCheckArr.push(`${key}=${value}`);
        }
      });
      dataCheckArr.sort();
      const dataCheckString = dataCheckArr.join('\n');

      // 计算 HMAC-SHA256
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(this.botToken)
        .digest();

      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      return calculatedHash === hash;
    } catch {
      return false;
    }
  }
}
