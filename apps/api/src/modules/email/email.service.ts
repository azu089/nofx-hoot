import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

/**
 * 邮件服务
 * 使用 Resend 发送邮件（验证码、通知等）
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY 未配置，邮件功能将不可用');
    }
    this.resend = new Resend(apiKey);
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@send.tizo.cc';
  }

  /**
   * 发送验证码邮件
   * @param to 收件人邮箱
   * @param code 6位验证码
   * @param type 验证类型：register | reset_password | login
   */
  async sendVerificationCode(
    to: string,
    code: string,
    type: 'register' | 'reset_password' | 'login' = 'register',
  ): Promise<boolean> {
    const subjects = {
      register: 'QuantFi 注册验证码',
      reset_password: 'QuantFi 密码重置验证码',
      login: 'QuantFi 登录验证码',
    };

    const titles = {
      register: '欢迎注册 QuantFi',
      reset_password: '重置您的密码',
      login: '登录验证',
    };

    const descriptions = {
      register: '您正在注册 QuantFi 账户，请使用以下验证码完成注册：',
      reset_password: '您正在重置 QuantFi 账户密码，请使用以下验证码：',
      login: '您正在登录 QuantFi 账户，请使用以下验证码：',
    };

    const html = this.buildVerificationEmailHtml({
      title: titles[type],
      description: descriptions[type],
      code,
    });

    try {
      const { data, error } = await this.resend.emails.send({
        from: `QuantFi <${this.fromEmail}>`,
        to: [to],
        subject: subjects[type],
        html,
      });

      if (error) {
        this.logger.error(`发送验证码邮件失败: ${to}`, error);
        return false;
      }

      this.logger.log(`验证码邮件已发送: ${to}, type=${type}, messageId=${data?.id}`);
      return true;
    } catch (error) {
      this.logger.error(`发送验证码邮件异常: ${to}`, error);
      return false;
    }
  }

  /**
   * 构建验证码邮件 HTML
   */
  private buildVerificationEmailHtml(params: {
    title: string;
    description: string;
    code: string;
  }): string {
    const { title, description, code } = params;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0E11; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width: 480px; margin: 0 auto;">
    <tr>
      <td style="padding: 40px 20px;">
        <!-- Logo -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="text-align: center; padding-bottom: 30px;">
              <span style="font-size: 28px; font-weight: bold; color: #3772FF;">QuantFi</span>
            </td>
          </tr>
        </table>

        <!-- 主内容卡片 -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #131722; border-radius: 16px; border: 1px solid #2B3139;">
          <tr>
            <td style="padding: 40px 30px;">
              <!-- 标题 -->
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #FFFFFF; text-align: center;">
                ${title}
              </h1>

              <!-- 描述 -->
              <p style="margin: 0 0 30px 0; font-size: 14px; line-height: 1.6; color: #848E9C; text-align: center;">
                ${description}
              </p>

              <!-- 验证码 -->
              <div style="background-color: #1E222D; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 30px;">
                <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #3772FF; font-family: monospace;">
                  ${code}
                </span>
              </div>

              <!-- 有效期提示 -->
              <p style="margin: 0; font-size: 13px; color: #5E6673; text-align: center;">
                验证码有效期为 <strong style="color: #F7931A;">10 分钟</strong>，请尽快使用
              </p>
            </td>
          </tr>
        </table>

        <!-- 底部提示 -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="padding-top: 30px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #5E6673;">
                如果这不是您本人的操作，请忽略此邮件
              </p>
              <p style="margin: 0; font-size: 12px; color: #5E6673;">
                © 2024 QuantFi. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * 发送通用通知邮件
   */
  async sendNotification(
    to: string,
    subject: string,
    content: string,
  ): Promise<boolean> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: `QuantFi <${this.fromEmail}>`,
        to: [to],
        subject,
        html: `<div style="font-family: sans-serif; padding: 20px;">${content}</div>`,
      });

      if (error) {
        this.logger.error(`发送通知邮件失败: ${to}`, error);
        return false;
      }

      this.logger.log(`通知邮件已发送: ${to}, messageId=${data?.id}`);
      return true;
    } catch (error) {
      this.logger.error(`发送通知邮件异常: ${to}`, error);
      return false;
    }
  }
}
