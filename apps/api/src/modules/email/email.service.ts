import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY 未配置，邮件功能将不可用');
    } else {
      this.resend = new Resend(apiKey);
    }
  }

  // 发送验证码邮件
  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn('邮件服务未配置，跳过发送验证码');
      return false;
    }
    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.EMAIL_FROM || 'HOOT <noreply@hoot.cool>',
        to: email,
        subject: 'HOOT 邮箱验证码',
        html: this.getVerificationEmailTemplate(code),
      });

      if (error) {
        this.logger.error(`发送验证码失败: ${error.message}`, error);
        return false;
      }

      this.logger.log(`验证码已发送: ${email}, messageId: ${data?.id}`);
      return true;
    } catch (error) {
      this.logger.error(`发送邮件异常: ${error.message}`, error);
      return false;
    }
  }

  // 发送欢迎邮件
  async sendWelcomeEmail(email: string, nickname: string): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn('邮件服务未配置，跳过发送欢迎邮件');
      return false;
    }
    try {
      const { error } = await this.resend.emails.send({
        from: process.env.EMAIL_FROM || 'HOOT <noreply@hoot.cool>',
        to: email,
        subject: '欢迎加入 HOOT',
        html: this.getWelcomeEmailTemplate(nickname),
      });

      if (error) {
        this.logger.error(`发送欢迎邮件失败: ${error.message}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`发送欢迎邮件异常: ${error.message}`);
      return false;
    }
  }

  // 验证码邮件模板
  private getVerificationEmailTemplate(code: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0F; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="text-align: center; padding-bottom: 30px;">
        <h1 style="color: #06B6D4; margin: 0; font-size: 32px;">HOOT</h1>
        <p style="color: #9090A0; margin: 10px 0 0 0; font-size: 14px;">AI 量化交易平台</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #12121A; border-radius: 12px; padding: 40px; border: 1px solid #1E1E2E;">
        <h2 style="color: #F8F8FC; margin: 0 0 20px 0; font-size: 20px; text-align: center;">邮箱验证</h2>
        <p style="color: #9090A0; margin: 0 0 30px 0; font-size: 14px; text-align: center; line-height: 1.6;">
          您正在注册 HOOT 账户，请使用以下验证码完成验证：
        </p>
        <div style="background-color: #1A1A24; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 30px;">
          <span style="color: #06B6D4; font-size: 36px; font-weight: bold; letter-spacing: 8px;">${code}</span>
        </div>
        <p style="color: #606070; margin: 0; font-size: 12px; text-align: center;">
          验证码有效期为 10 分钟，请勿泄露给他人。
        </p>
      </td>
    </tr>
    <tr>
      <td style="text-align: center; padding-top: 30px;">
        <p style="color: #606070; margin: 0; font-size: 12px;">
          如果您没有请求此验证码，请忽略此邮件。
        </p>
        <p style="color: #606070; margin: 10px 0 0 0; font-size: 12px;">
          © 2026 HOOT. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  // 欢迎邮件模板
  private getWelcomeEmailTemplate(nickname: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0F; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="text-align: center; padding-bottom: 30px;">
        <h1 style="color: #06B6D4; margin: 0; font-size: 32px;">HOOT</h1>
      </td>
    </tr>
    <tr>
      <td style="background-color: #12121A; border-radius: 12px; padding: 40px; border: 1px solid #1E1E2E;">
        <h2 style="color: #F8F8FC; margin: 0 0 20px 0; font-size: 20px;">欢迎加入 HOOT，${nickname}！</h2>
        <p style="color: #9090A0; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6;">
          感谢您注册 HOOT AI 量化交易平台。您现在可以：
        </p>
        <ul style="color: #9090A0; margin: 0 0 20px 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
          <li>浏览和订阅专业量化策略</li>
          <li>绑定交易所 API 自动跟单</li>
          <li>质押 HOOT 代币获取分红</li>
          <li>邀请好友获得返佣奖励</li>
        </ul>
        <a href="${process.env.WEB_URL || 'https://hoot.cool'}/dashboard"
           style="display: inline-block; background-color: #06B6D4; color: #000; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: bold; margin-top: 10px;">
          开始使用
        </a>
      </td>
    </tr>
    <tr>
      <td style="text-align: center; padding-top: 30px;">
        <p style="color: #606070; margin: 0; font-size: 12px;">
          © 2026 HOOT. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }
}
