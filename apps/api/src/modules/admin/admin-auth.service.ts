/**
 * 管理员认证服务（增强版）
 * - Google Authenticator (TOTP) 支持
 * - 登录失败锁定
 * - 异地登录检测
 * - 敏感操作二次确认
 */
import {
  Injectable,
  UnauthorizedException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { TOTP, generateSecret, generateURI, verify } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminLoginDto, CreateAdminDto } from './dto/auth.dto';

// 安全配置常量
const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5, // 最大登录失败次数
  LOCKOUT_DURATION_MINUTES: 15, // 锁定时长（分钟）
  TOTP_ISSUER: 'HOOT Admin', // TOTP 发行方名称
  ENCRYPTION_KEY:
    process.env.TOTP_ENCRYPTION_KEY || 'hoot-totp-key-32bytes-long!!', // 32 字节
};

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ==================== 登录相关 ====================

  /**
   * 管理员登录（第一步：验证密码）
   * 如果启用了 TOTP，返回需要二次验证的标志
   */
  async login(dto: AdminLoginDto, ip?: string, userAgent?: string) {
    // 查找管理员
    const admin = await this.prisma.admin.findUnique({
      where: { username: dto.username },
    });

    if (!admin) {
      this.logger.warn(`登录失败: 用户不存在 ${dto.username}`);
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 检查账号锁定状态
    await this.checkAccountLock(admin);

    // 检查账号状态
    if (!admin.isActive) {
      this.logger.warn(`登录失败: 账号已禁用 ${dto.username}`);
      throw new UnauthorizedException('账号已被禁用');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(dto.password, admin.password);
    if (!isPasswordValid) {
      // 增加失败次数
      await this.incrementLoginAttempts(admin.id);
      this.logger.warn(`登录失败: 密码错误 ${dto.username}`);
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 密码验证通过，检查是否需要 TOTP
    if (admin.totpEnabled) {
      // 如果启用了 TOTP，需要第二步验证
      if (!dto.totpCode) {
        return {
          requireTotp: true,
          message: '请输入两步验证码',
        };
      }

      // 验证 TOTP 码
      const totpSecret = this.decryptTotpSecret(admin.totpSecret!);
      const verifyResult = await verify({
        token: dto.totpCode,
        secret: totpSecret,
      });

      if (!verifyResult.valid) {
        await this.incrementLoginAttempts(admin.id);
        this.logger.warn(`登录失败: TOTP 验证码错误 ${dto.username}`);
        throw new UnauthorizedException('两步验证码错误');
      }
    }

    // 登录成功，重置失败次数
    await this.resetLoginAttempts(admin.id);

    // 检查异地登录
    const isNewLocation = await this.checkNewLoginLocation(admin, ip);

    // 生成 Token
    const payload = {
      sub: admin.id,
      username: admin.username,
      role: admin.role,
      type: 'admin',
    };
    const token = this.jwtService.sign(payload, { expiresIn: '24h' });

    // 更新登录信息
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    });

    // 记录登录日志
    await this.logOperation(
      admin.id,
      'login',
      'admin',
      admin.id,
      'admin',
      `管理员登录${isNewLocation ? '（新IP）' : ''}`,
      ip,
      userAgent,
    );

    // 异地登录通知
    if (isNewLocation && admin.email) {
      await this.sendNewLoginNotification(admin, ip, userAgent);
    }

    this.logger.log(`管理员登录成功: ${admin.username} from ${ip}`);

    return {
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname || admin.username,
        role: admin.role,
        totpEnabled: admin.totpEnabled,
      },
    };
  }

  /**
   * 检查账号锁定状态
   */
  private async checkAccountLock(admin: any) {
    if (admin.lockedUntil && new Date() < admin.lockedUntil) {
      const remainingMinutes = Math.ceil(
        (admin.lockedUntil.getTime() - Date.now()) / 60000,
      );
      this.logger.warn(`登录失败: 账号已锁定 ${admin.username}`);
      throw new ForbiddenException(
        `账号已锁定，请 ${remainingMinutes} 分钟后重试`,
      );
    }
  }

  /**
   * 增加登录失败次数
   */
  private async incrementLoginAttempts(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    const newAttempts = (admin?.loginAttempts || 0) + 1;

    const updateData: any = {
      loginAttempts: newAttempts,
    };

    // 如果达到最大尝试次数，锁定账号
    if (newAttempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
      updateData.lockedUntil = new Date(
        Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000,
      );
      this.logger.warn(`账号已锁定: ${admin?.username}`);
    }

    await this.prisma.admin.update({
      where: { id: adminId },
      data: updateData,
    });
  }

  /**
   * 重置登录失败次数
   */
  private async resetLoginAttempts(adminId: string) {
    await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  /**
   * 检查是否为新登录位置
   */
  private async checkNewLoginLocation(
    admin: any,
    ip?: string,
  ): Promise<boolean> {
    if (!ip || !admin.lastLoginIp) return false;
    return admin.lastLoginIp !== ip;
  }

  /**
   * 发送新登录通知
   */
  private async sendNewLoginNotification(
    admin: any,
    ip?: string,
    userAgent?: string,
  ) {
    // TODO: 集成 TG Bot 或邮件通知
    this.logger.log(`异地登录通知: ${admin.username} from ${ip}`);

    // 记录到操作日志
    await this.logOperation(
      admin.id,
      'security_alert',
      'admin',
      admin.id,
      'admin',
      `检测到新IP登录: ${ip}`,
      ip,
      userAgent,
    );
  }

  // ==================== TOTP 相关 ====================

  /**
   * 生成 TOTP 密钥和二维码
   */
  async generateTotpSecret(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('管理员不存在');
    }

    if (admin.totpEnabled) {
      throw new BadRequestException('两步验证已启用，如需重新绑定请先禁用');
    }

    // 生成密钥
    const secret = generateSecret();

    // 生成 otpauth URL
    const otpauthUrl = generateURI({
      issuer: SECURITY_CONFIG.TOTP_ISSUER,
      label: admin.username,
      secret,
    });

    // 生成二维码
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // 临时存储密钥（加密）
    const encryptedSecret = this.encryptTotpSecret(secret);
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { totpSecret: encryptedSecret },
    });

    this.logger.log(`生成 TOTP 密钥: ${admin.username}`);

    return {
      secret, // 显示给用户手动输入
      qrCode: qrCodeDataUrl,
      message: '请使用 Google Authenticator 扫描二维码',
    };
  }

  /**
   * 启用 TOTP（验证后）
   */
  async enableTotp(adminId: string, totpCode: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('管理员不存在');
    }

    if (!admin.totpSecret) {
      throw new BadRequestException('请先生成两步验证密钥');
    }

    if (admin.totpEnabled) {
      throw new BadRequestException('两步验证已启用');
    }

    // 验证 TOTP 码
    const totpSecret = this.decryptTotpSecret(admin.totpSecret);
    const verifyResult = await verify({
      token: totpCode,
      secret: totpSecret,
    });

    if (!verifyResult.valid) {
      throw new BadRequestException('验证码错误，请重试');
    }

    // 启用 TOTP
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { totpEnabled: true },
    });

    await this.logOperation(
      adminId,
      'enable_totp',
      'security',
      adminId,
      'admin',
      '启用两步验证',
    );

    this.logger.log(`启用 TOTP: ${admin.username}`);

    return { message: '两步验证已启用' };
  }

  /**
   * 禁用 TOTP
   */
  async disableTotp(adminId: string, password: string, totpCode: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('管理员不存在');
    }

    if (!admin.totpEnabled) {
      throw new BadRequestException('两步验证未启用');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new BadRequestException('密码错误');
    }

    // 验证 TOTP 码
    const totpSecret = this.decryptTotpSecret(admin.totpSecret!);
    const verifyResult = await verify({
      token: totpCode,
      secret: totpSecret,
    });

    if (!verifyResult.valid) {
      throw new BadRequestException('验证码错误');
    }

    // 禁用 TOTP
    await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        totpEnabled: false,
        totpSecret: null,
      },
    });

    await this.logOperation(
      adminId,
      'disable_totp',
      'security',
      adminId,
      'admin',
      '禁用两步验证',
    );

    this.logger.log(`禁用 TOTP: ${admin.username}`);

    return { message: '两步验证已禁用' };
  }

  /**
   * 验证 TOTP 码（用于敏感操作）
   */
  async verifyTotpForOperation(
    adminId: string,
    totpCode: string,
  ): Promise<boolean> {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin || !admin.totpEnabled || !admin.totpSecret) {
      return false;
    }

    const totpSecret = this.decryptTotpSecret(admin.totpSecret);
    const verifyResult = await verify({
      token: totpCode,
      secret: totpSecret,
    });
    return verifyResult.valid;
  }

  /**
   * 加密 TOTP 密钥
   */
  private encryptTotpSecret(secret: string): string {
    const key = Buffer.from(SECURITY_CONFIG.ENCRYPTION_KEY).slice(0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * 解密 TOTP 密钥
   */
  private decryptTotpSecret(encryptedSecret: string): string {
    const [ivHex, encrypted] = encryptedSecret.split(':');
    const key = Buffer.from(SECURITY_CONFIG.ENCRYPTION_KEY).slice(0, 32);
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // ==================== 原有方法 ====================

  /**
   * 获取当前管理员信息
   */
  async getMe(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        username: true,
        nickname: true,
        email: true,
        role: true,
        isActive: true,
        totpEnabled: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('管理员不存在');
    }

    return admin;
  }

  /**
   * 验证 Token
   */
  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);

      if (payload.type !== 'admin') {
        throw new UnauthorizedException('无效的管理员令牌');
      }

      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          totpEnabled: true,
        },
      });

      if (!admin || !admin.isActive) {
        throw new UnauthorizedException('管理员账号无效');
      }

      return admin;
    } catch (error) {
      throw new UnauthorizedException('令牌无效或已过期');
    }
  }

  /**
   * 修改密码
   */
  async changePassword(
    adminId: string,
    oldPassword: string,
    newPassword: string,
    totpCode?: string,
  ) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('管理员不存在');
    }

    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(oldPassword, admin.password);
    if (!isPasswordValid) {
      throw new BadRequestException('原密码错误');
    }

    // 如果启用了 TOTP，需要验证
    if (admin.totpEnabled) {
      if (!totpCode) {
        throw new BadRequestException('请输入两步验证码');
      }
      const isValidTotp = await this.verifyTotpForOperation(adminId, totpCode);
      if (!isValidTotp) {
        throw new BadRequestException('两步验证码错误');
      }
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.admin.update({
      where: { id: adminId },
      data: { password: hashedPassword },
    });

    await this.logOperation(
      adminId,
      'change_password',
      'security',
      adminId,
      'admin',
      '修改密码',
    );

    this.logger.log(`管理员修改密码: ${admin.username}`);

    return { message: '密码修改成功' };
  }

  /**
   * 创建管理员（仅超级管理员）
   */
  async createAdmin(dto: CreateAdminDto, creatorId: string) {
    // 检查用户名是否存在
    const existing = await this.prisma.admin.findUnique({
      where: { username: dto.username },
    });

    if (existing) {
      throw new BadRequestException('用户名已存在');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const admin = await this.prisma.admin.create({
      data: {
        username: dto.username,
        password: hashedPassword,
        nickname: dto.nickname,
        email: dto.email,
        role: dto.role || 'admin',
      },
    });

    // 记录操作日志
    await this.logOperation(
      creatorId,
      'create',
      'admin',
      admin.id,
      'admin',
      `创建管理员 ${admin.username}`,
    );

    this.logger.log(`创建管理员: ${admin.username}`);

    return {
      id: admin.id,
      username: admin.username,
      nickname: admin.nickname,
      role: admin.role,
    };
  }

  /**
   * 获取管理员列表
   */
  async getAdmins(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [admins, total] = await Promise.all([
      this.prisma.admin.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          nickname: true,
          email: true,
          role: true,
          isActive: true,
          totpEnabled: true,
          lastLoginAt: true,
          lastLoginIp: true,
          createdAt: true,
        },
      }),
      this.prisma.admin.count(),
    ]);

    return {
      items: admins,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取安全状态
   */
  async getSecurityStatus(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        totpEnabled: true,
        lastLoginAt: true,
        lastLoginIp: true,
        loginAttempts: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('管理员不存在');
    }

    // 获取最近的登录记录
    const recentLogins = await this.prisma.adminOperationLog.findMany({
      where: {
        adminId,
        action: 'login',
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    });

    return {
      totpEnabled: admin.totpEnabled,
      lastLoginAt: admin.lastLoginAt,
      lastLoginIp: admin.lastLoginIp,
      recentLogins,
    };
  }

  /**
   * 记录操作日志
   */
  async logOperation(
    adminId: string,
    action: string,
    module: string,
    targetId?: string,
    targetType?: string,
    description?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.prisma.adminOperationLog.create({
      data: {
        adminId,
        action,
        module,
        targetId,
        targetType,
        description,
        ipAddress,
        userAgent,
      },
    });
  }

  /**
   * 初始化默认管理员（首次启动时调用）
   */
  async initDefaultAdmin() {
    const count = await this.prisma.admin.count();

    if (count === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);

      await this.prisma.admin.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          nickname: '超级管理员',
          role: 'super_admin',
        },
      });

      this.logger.log('已创建默认管理员账号: admin / admin123');
      this.logger.warn('⚠️ 请立即修改默认密码并启用两步验证！');
    }
  }
}
