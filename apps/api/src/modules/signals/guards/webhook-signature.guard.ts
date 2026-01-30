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
 * Webhook 签名验证守卫
 *
 * 验证方式：HMAC-SHA256 签名
 * - 请求头：X-Webhook-Signature
 * - 签名格式：sha256=<hex_signature>
 * - 签名内容：请求 body 的 JSON 字符串
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);
  private readonly webhookSecret: string;

  constructor() {
    this.webhookSecret = process.env.WEBHOOK_SECRET || '';
    if (!this.webhookSecret) {
      this.logger.warn('WEBHOOK_SECRET 未配置，Webhook 签名验证将被跳过（仅限开发环境）');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // 开发环境且未配置密钥时跳过验证
    if (!this.webhookSecret && process.env.NODE_ENV !== 'production') {
      this.logger.debug('开发环境跳过 Webhook 签名验证');
      return true;
    }

    if (!this.webhookSecret) {
      throw new UnauthorizedException('Webhook 签名验证配置错误');
    }

    const signature = request.headers['x-webhook-signature'] as string;
    if (!signature) {
      this.logger.warn('缺少 Webhook 签名', { ip: request.ip });
      throw new UnauthorizedException('缺少 Webhook 签名');
    }

    // 解析签名格式：sha256=<hex_signature>
    const [algorithm, providedSignature] = signature.split('=');
    if (algorithm !== 'sha256' || !providedSignature) {
      this.logger.warn('Webhook 签名格式错误', { signature });
      throw new UnauthorizedException('Webhook 签名格式错误');
    }

    // 计算预期签名
    const payload = JSON.stringify(request.body);
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    // 使用时间安全比较防止时序攻击
    const isValid = crypto.timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );

    if (!isValid) {
      this.logger.warn('Webhook 签名验证失败', {
        ip: request.ip,
        providedSignature: providedSignature.substring(0, 16) + '...',
      });
      throw new UnauthorizedException('Webhook 签名验证失败');
    }

    this.logger.debug('Webhook 签名验证通过');
    return true;
  }
}
