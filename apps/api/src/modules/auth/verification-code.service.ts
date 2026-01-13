import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { EmailService } from '../email/email.service';

/**
 * 验证码服务
 * 使用 Redis 存储验证码，支持发送频率限制
 */
@Injectable()
export class VerificationCodeService {
  private readonly logger = new Logger(VerificationCodeService.name);

  // 验证码有效期（秒）
  private readonly CODE_TTL = 10 * 60; // 10 分钟

  // 发送间隔（秒）
  private readonly SEND_INTERVAL = 60; // 60 秒内不能重复发送

  // 每日发送上限
  private readonly DAILY_LIMIT = 10;

  constructor(
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * 发送验证码
   * @param email 邮箱
   * @param type 类型：register | reset_password | login
   * @returns { success, message, retryAfter? }
   */
  async sendCode(
    email: string,
    type: 'register' | 'reset_password' | 'login' = 'register',
  ): Promise<{ success: boolean; message: string; retryAfter?: number }> {
    const normalizedEmail = email.toLowerCase().trim();

    // 检查发送间隔
    const intervalKey = `verify:interval:${normalizedEmail}`;
    const lastSendTime = await this.redisService.get(intervalKey);

    if (lastSendTime) {
      const elapsed = Math.floor(Date.now() / 1000) - parseInt(lastSendTime);
      const retryAfter = this.SEND_INTERVAL - elapsed;

      if (retryAfter > 0) {
        return {
          success: false,
          message: `请${retryAfter}秒后再试`,
          retryAfter,
        };
      }
    }

    // 检查每日发送上限
    const dailyKey = `verify:daily:${normalizedEmail}`;
    const dailyCountStr = await this.redisService.get(dailyKey);
    const dailyCount = dailyCountStr ? parseInt(dailyCountStr) : 0;

    if (dailyCount >= this.DAILY_LIMIT) {
      return {
        success: false,
        message: '今日发送次数已达上限，请明天再试',
      };
    }

    // 生成 6 位数字验证码
    const code = this.generateCode();

    // 发送邮件
    const sent = await this.emailService.sendVerificationCode(
      normalizedEmail,
      code,
      type,
    );

    if (!sent) {
      return {
        success: false,
        message: '验证码发送失败，请稍后重试',
      };
    }

    // 存储验证码
    const codeKey = `verify:code:${type}:${normalizedEmail}`;
    await this.redisService.set(codeKey, code, this.CODE_TTL);

    // 记录发送时间（用于间隔检查）
    await this.redisService.set(
      intervalKey,
      Math.floor(Date.now() / 1000).toString(),
      this.SEND_INTERVAL,
    );

    // 增加每日发送计数
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const ttlToEndOfDay = Math.floor((endOfDay.getTime() - now.getTime()) / 1000);

    await this.redisService.set(dailyKey, (dailyCount + 1).toString(), ttlToEndOfDay);

    this.logger.log(`验证码已发送: ${normalizedEmail}, type=${type}`);

    return {
      success: true,
      message: '验证码已发送，请查收邮件',
    };
  }

  /**
   * 验证验证码
   * @param email 邮箱
   * @param code 验证码
   * @param type 类型
   * @param consume 验证成功后是否消费（删除）验证码
   * @returns 是否验证成功
   */
  async verifyCode(
    email: string,
    code: string,
    type: 'register' | 'reset_password' | 'login' = 'register',
    consume: boolean = true,
  ): Promise<{ success: boolean; message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const codeKey = `verify:code:${type}:${normalizedEmail}`;

    const storedCode = await this.redisService.get(codeKey);

    if (!storedCode) {
      return {
        success: false,
        message: '验证码已过期或不存在，请重新获取',
      };
    }

    if (storedCode !== code) {
      // 记录错误次数，防止暴力破解
      const errorKey = `verify:errors:${type}:${normalizedEmail}`;
      const errorCountStr = await this.redisService.get(errorKey);
      const errorCount = (errorCountStr ? parseInt(errorCountStr) : 0) + 1;

      await this.redisService.set(errorKey, errorCount.toString(), this.CODE_TTL);

      if (errorCount >= 5) {
        // 错误次数过多，删除验证码
        await this.redisService.del(codeKey);
        return {
          success: false,
          message: '验证码错误次数过多，请重新获取',
        };
      }

      return {
        success: false,
        message: '验证码错误',
      };
    }

    // 验证成功，根据 consume 参数决定是否删除
    if (consume) {
      await this.redisService.del(codeKey);
    }

    return {
      success: true,
      message: '验证成功',
    };
  }

  /**
   * 生成 6 位数字验证码
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
