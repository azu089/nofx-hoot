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
        subject: 'HOOT 验证码 / Verification Code',
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
        subject: '欢迎加入 HOOT / Welcome to HOOT',
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

  private get webUrl(): string {
    return process.env.WEB_URL || 'https://hoot.cool';
  }

  // 验证码邮件模板
  private getVerificationEmailTemplate(code: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>HOOT 验证码</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0A0A0F; }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 20px 12px !important; }
      .email-card { padding: 28px 20px !important; }
      .code-text { font-size: 30px !important; letter-spacing: 6px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0A0A0F;-webkit-font-smoothing:antialiased;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0A0A0F">
  <tr>
    <td align="center" bgcolor="#0A0A0F" class="email-wrapper" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

        <!-- LOGO -->
        <tr>
          <td align="center" style="padding-bottom:28px;">
            <h1 style="margin:0;color:#06B6D4;font-size:30px;font-weight:900;letter-spacing:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">HOOT</h1>
            <p style="margin:8px 0 0;color:#9090A0;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              AI 量化交易平台 &nbsp;·&nbsp; AI Quantitative Trading Platform
            </p>
          </td>
        </tr>

        <!-- CARD -->
        <tr>
          <td bgcolor="#12121A" class="email-card"
              style="background-color:#12121A;border-radius:14px;padding:36px 32px;border:1px solid #1E1E2E;">

            <h1 style="margin:0 0 6px;color:#F8F8FC;font-size:22px;font-weight:700;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              邮箱验证
            </h1>
            <p style="margin:0 0 28px;color:#606070;font-size:13px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              Email Verification
            </p>

            <p style="margin:0 0 5px;color:#9090A0;font-size:14px;text-align:center;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              您正在注册 HOOT 账户，请使用以下验证码完成验证：
            </p>
            <p style="margin:0 0 24px;color:#5A5A6A;font-size:12px;text-align:center;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              You're registering a HOOT account. Use the code below to verify your email:
            </p>

            <!-- 验证码区域 -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td align="center" bgcolor="#0D0D16"
                    style="background-color:#0D0D16;border-radius:10px;padding:24px 20px;border:1px solid #252535;">
                  <span class="code-text"
                        style="color:#06B6D4;font-size:36px;font-weight:700;letter-spacing:10px;font-family:'Courier New',Courier,monospace;display:block;text-align:center;">
                    ${code}
                  </span>
                </td>
              </tr>
            </table>

            <!-- 安全提示框 -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="background-color:#111118;border-radius:8px;border:1px solid #1A1A28;">
              <tr>
                <td style="padding:14px 16px;">
                  <p style="margin:0 0 4px;color:#9090A0;font-size:12px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                    🔒 &nbsp;验证码有效期为 <strong style="color:#C0C0D0;">10 分钟</strong>，请勿泄露给他人。
                  </p>
                  <p style="margin:0;color:#5A5A6A;font-size:11px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                    This code expires in 10 minutes. Never share it with anyone.
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td align="center" style="padding-top:28px;">
            <p style="margin:0 0 5px;color:#9090A0;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              如果您没有请求此验证码，请忽略此邮件。
            </p>
            <p style="margin:0 0 16px;color:#5A5A6A;font-size:11px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              If you didn't request this code, you can safely ignore this email.
            </p>
            <p style="margin:0;color:#404050;font-size:11px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              © 2026 HOOT. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
  }

  // 欢迎邮件模板
  private getWelcomeEmailTemplate(nickname: string): string {
    const dashboardUrl = `${this.webUrl}/dashboard`;

    const features: Array<{ icon: string; zh: string; zhDesc: string; enDesc: string }> = [
      {
        icon: '🔬',
        zh: 'AI 深度研究',
        zhDesc: '启动 AI 研究，多维度分析市场行情',
        enDesc: 'Launch AI research for multi-dimensional market analysis',
      },
      {
        icon: '🤖',
        zh: 'AI 自动交易',
        zhDesc: '创建 AI 交易策略，7×24 小时自动捕捉机会',
        enDesc: 'Create AI trading strategies that work 24/7',
      },
      {
        icon: '🔗',
        zh: '交易所直连',
        zhDesc: '绑定交易所 API，AI 决策即时执行',
        enDesc: 'Connect your exchange API for instant AI-driven execution',
      },
      {
        icon: '📈',
        zh: '网格策略',
        zhDesc: '震荡市场中自动低买高卖，稳定获利',
        enDesc: 'Grid trading strategies for steady gains in ranging markets',
      },
      {
        icon: '👥',
        zh: '邀请返佣',
        zhDesc: '邀请好友，获得返佣奖励',
        enDesc: 'Invite friends and earn referral rewards',
      },
    ];

    const featureRows = features
      .map(
        (f, i) => `
        <tr>
          <td style="padding:14px 0;${i < features.length - 1 ? 'border-bottom:1px solid #1A1A28;' : ''}">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="44" style="vertical-align:middle;padding-right:14px;">
                  <div style="width:36px;height:36px;background-color:#111118;border-radius:8px;border:1px solid #1E1E2E;text-align:center;line-height:36px;font-size:18px;">
                    ${f.icon}
                  </div>
                </td>
                <td style="vertical-align:middle;">
                  <p style="margin:0 0 3px;color:#E8E8F0;font-size:14px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                    ${f.zh}
                  </p>
                  <p style="margin:0 0 2px;color:#9090A0;font-size:12px;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                    ${f.zhDesc}
                  </p>
                  <p style="margin:0;color:#5A5A6A;font-size:11px;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                    ${f.enDesc}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>欢迎加入 HOOT</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0A0A0F; }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 20px 12px !important; }
      .email-card { padding: 24px 18px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0A0A0F;-webkit-font-smoothing:antialiased;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0A0A0F">
  <tr>
    <td align="center" bgcolor="#0A0A0F" class="email-wrapper" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

        <!-- LOGO -->
        <tr>
          <td align="center" style="padding-bottom:28px;">
            <h1 style="margin:0;color:#06B6D4;font-size:30px;font-weight:900;letter-spacing:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">HOOT</h1>
          </td>
        </tr>

        <!-- HERO: 欢迎标题 -->
        <tr>
          <td bgcolor="#12121A" class="email-card"
              style="background-color:#12121A;border-radius:14px 14px 0 0;padding:32px 32px 24px;border:1px solid #1E1E2E;border-bottom:none;">
            <!-- 顶部强调线 -->
            <div style="height:3px;background:linear-gradient(90deg,#06B6D4,#0E7490);border-radius:2px;margin-bottom:28px;"></div>
            <h1 style="margin:0 0 5px;color:#F8F8FC;font-size:22px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              欢迎加入 HOOT，${nickname}！
            </h1>
            <p style="margin:0 0 22px;color:#606070;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              Welcome to HOOT, ${nickname}!
            </p>
            <p style="margin:0 0 5px;color:#9090A0;font-size:14px;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              感谢您注册 HOOT —— 您的 AI 量化交易助手。您现在可以：
            </p>
            <p style="margin:0;color:#5A5A6A;font-size:12px;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              Thank you for joining HOOT — your AI-powered quant trading assistant. Here's what you can do:
            </p>
          </td>
        </tr>

        <!-- FEATURES 列表 -->
        <tr>
          <td bgcolor="#12121A"
              style="background-color:#12121A;padding:4px 32px 20px;border:1px solid #1E1E2E;border-top:none;border-bottom:none;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${featureRows}
            </table>
          </td>
        </tr>

        <!-- CTA 按钮 -->
        <tr>
          <td bgcolor="#12121A"
              style="background-color:#12121A;border-radius:0 0 14px 14px;padding:24px 32px 36px;border:1px solid #1E1E2E;border-top:none;text-align:center;">
            <a href="${dashboardUrl}"
               style="display:inline-block;background-color:#06B6D4;color:#000000;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:0.3px;">
              开始使用 &nbsp;/&nbsp; Get Started
            </a>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td align="center" style="padding-top:28px;">
            <p style="margin:0;color:#404050;font-size:11px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              © 2026 HOOT. All rights reserved.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
  }
}
