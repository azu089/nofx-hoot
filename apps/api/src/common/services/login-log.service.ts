import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 登录日志信息
 */
export interface LoginLogInfo {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  loginStatus: 'success' | 'failed';
  failureReason?: string;
}

/**
 * 解析后的 User-Agent 信息
 */
interface ParsedUserAgent {
  deviceType: string;
  browser: string;
  os: string;
}

/**
 * 登录日志服务
 * 记录用户登录行为，支持安全审计
 */
@Injectable()
export class LoginLogService {
  private readonly logger = new Logger(LoginLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 记录登录日志
   * @param info 登录信息
   */
  async log(info: LoginLogInfo): Promise<void> {
    try {
      const parsed = this.parseUserAgent(info.userAgent);

      await this.prisma.client.login_logs.create({
        data: {
          user_id: info.userId,
          ip_address: info.ipAddress || null,
          user_agent: info.userAgent?.substring(0, 500) || null,
          device_type: parsed.deviceType,
          browser: parsed.browser,
          os: parsed.os,
          login_status: info.loginStatus,
          failure_reason: info.failureReason || null,
        },
      });

      this.logger.log(
        `登录日志: ${info.userId} - ${info.loginStatus} - IP: ${info.ipAddress}`,
      );
    } catch (error) {
      // 日志记录失败不应影响主流程
      this.logger.error(`记录登录日志失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 获取用户最近的登录日志
   * @param userId 用户 ID
   * @param limit 限制数量
   */
  async getRecentLogs(userId: string, limit = 10) {
    return this.prisma.client.login_logs.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
      select: {
        id: true,
        ip_address: true,
        device_type: true,
        browser: true,
        os: true,
        login_status: true,
        created_at: true,
      },
    });
  }

  /**
   * 获取用户失败登录次数（指定时间范围）
   * @param userId 用户 ID
   * @param minutes 时间范围（分钟）
   */
  async getFailedAttempts(userId: string, minutes = 30): Promise<number> {
    const since = new Date(Date.now() - minutes * 60 * 1000);

    const result = await this.prisma.client.login_logs.count({
      where: {
        user_id: userId,
        login_status: 'failed',
        created_at: { gte: since },
      },
    });

    return result;
  }

  /**
   * 检查是否有异常登录（不同 IP 登录）
   * @param userId 用户 ID
   * @param currentIp 当前 IP
   */
  async hasAnomalousLogin(userId: string, currentIp: string): Promise<boolean> {
    // 获取最近成功登录的 IP
    const recentSuccess = await this.prisma.client.login_logs.findFirst({
      where: {
        user_id: userId,
        login_status: 'success',
        created_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 7 天内
      },
      orderBy: { created_at: 'desc' },
      select: { ip_address: true },
    });

    if (!recentSuccess?.ip_address) {
      return false; // 没有历史记录，不算异常
    }

    // 检查 IP 是否变化
    return recentSuccess.ip_address !== currentIp;
  }

  /**
   * 解析 User-Agent
   * @param userAgent User-Agent 字符串
   */
  private parseUserAgent(userAgent?: string): ParsedUserAgent {
    if (!userAgent) {
      return { deviceType: 'unknown', browser: 'unknown', os: 'unknown' };
    }

    const ua = userAgent.toLowerCase();

    // 设备类型
    let deviceType = 'desktop';
    if (ua.includes('mobile') || ua.includes('android')) {
      deviceType = 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      deviceType = 'tablet';
    }

    // 浏览器
    let browser = 'unknown';
    if (ua.includes('chrome') && !ua.includes('edg')) {
      browser = 'Chrome';
    } else if (ua.includes('firefox')) {
      browser = 'Firefox';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      browser = 'Safari';
    } else if (ua.includes('edg')) {
      browser = 'Edge';
    } else if (ua.includes('opera') || ua.includes('opr')) {
      browser = 'Opera';
    }

    // 操作系统
    let os = 'unknown';
    if (ua.includes('windows')) {
      os = 'Windows';
    } else if (ua.includes('mac os') || ua.includes('macos')) {
      os = 'macOS';
    } else if (ua.includes('linux')) {
      os = 'Linux';
    } else if (ua.includes('android')) {
      os = 'Android';
    } else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) {
      os = 'iOS';
    }

    return { deviceType, browser, os };
  }
}
