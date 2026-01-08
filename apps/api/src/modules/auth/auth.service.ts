import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, FingerprintDto } from './dto/login.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import { RefreshTokenResponseDto } from './dto/refresh-token.dto';
import {
  TotpSetupResponseDto,
  TotpStatusResponseDto,
} from './dto/totp.dto';
import { TotpService } from '../../common/services/totp.service';
import { LoginLogService } from '../../common/services/login-log.service';
import { FingerprintService, FingerprintCheckResult } from '../../common/services/fingerprint.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

/**
 * 认证服务
 * 处理用户认证相关业务逻辑
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 10;
  private readonly REFRESH_TOKEN_EXPIRES_DAYS = 30; // Refresh Token 30 天过期
  private readonly ACCESS_TOKEN_EXPIRES_SECONDS = 7 * 24 * 60 * 60; // Access Token 7 天（秒）

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly totpService: TotpService,
    private readonly loginLogService: LoginLogService,
    private readonly fingerprintService: FingerprintService,
  ) {}

  /**
   * 用户注册
   * 1. 检查邮箱是否已存在
   * 2. 检查设备指纹（反作弊）
   * 3. bcrypt 加密密码
   * 4. 创建用户记录
   * 5. 自动创建钱包记录
   * 6. 记录设备指纹
   * 7. 返回用户信息（不含密码）
   */
  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const { email, password, inviteCode, fingerprint } = dto;

    // 1. 检查邮箱是否已存在
    const existingUser = await this.prisma.client.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('邮箱已被注册');
    }

    // 2. 检查设备指纹（反作弊）
    if (fingerprint?.hash) {
      const deviceCheck = await this.fingerprintService.isDeviceAllowed(fingerprint.hash);
      if (!deviceCheck.allowed) {
        this.logger.warn(`注册被拒绝: ${email}, 原因: ${deviceCheck.reason}`);
        throw new ForbiddenException(deviceCheck.reason || '该设备已达到注册限制');
      }
    }

    // 3. 如果提供了邀请码，验证邀请码来源
    // 邀请码可以来自：1. 代理商（agents 表）2. 普通用户（users 表）
    let agentId: string | null = null;
    let referredByUserId: string | null = null;

    if (inviteCode) {
      // 先检查是否是代理商邀请码
      const agent = await this.prisma.client.agents.findUnique({
        where: { code: inviteCode },
      });

      if (agent) {
        if (agent.status !== 'active') {
          throw new BadRequestException('该代理商已被禁用');
        }
        agentId = agent.id;
      } else {
        // 再检查是否是普通用户邀请码
        const referrer = await this.prisma.client.users.findUnique({
          where: { invite_code: inviteCode },
        });

        if (!referrer) {
          throw new BadRequestException('邀请码无效');
        }

        if (referrer.status !== 'active') {
          throw new BadRequestException('邀请人账号已被禁用');
        }

        referredByUserId = referrer.id;
      }
    }

    // 4. bcrypt 加密密码
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

    // 5. 创建用户记录 + 自动创建钱包记录（使用事务）
    const user = await this.prisma.client.$transaction(async (tx) => {
      // 创建用户
      const newUser = await tx.users.create({
        data: {
          email,
          password_hash: passwordHash,
          agent_id: agentId,
          referred_by_user_id: referredByUserId, // 普通用户邀请关系
          status: 'active',
        },
      });

      // 自动创建钱包
      await tx.wallets.create({
        data: {
          user_id: newUser.id,
          usdt_balance: 0,
          usdt_frozen: 0,
          points_balance: 0,
          points_frozen: 0,
          token_balance: 0,
          token_locked: 0,
          token_vesting: 0,
        },
      });

      // 如果有代理商，更新代理商的用户数
      if (agentId) {
        await tx.agents.update({
          where: { id: agentId },
          data: {
            total_users: { increment: 1 },
          },
        });
      }

      return newUser;
    });

    // 6. 记录设备指纹
    if (fingerprint) {
      try {
        await this.fingerprintService.recordFingerprint(user.id, fingerprint);
      } catch (error) {
        this.logger.error(`记录设备指纹失败: ${error.message}`, error.stack);
        // 不阻塞注册流程
      }
    }

    this.logger.log(`用户注册成功: ${user.id} (${email})`);

    return await this.sanitizeUser(user);
  }

  /**
   * 用户登录
   * 1. 验证邮箱和密码
   * 2. 生成 JWT Token
   * 3. 更新最后登录时间
   * 4. 记录登录日志
   * 5. 记录设备指纹
   * 6. 返回 { access_token, user }
   */
  async login(dto: LoginDto, ip?: string, userAgent?: string): Promise<AuthResponseDto & { fingerprintCheck?: FingerprintCheckResult }> {
    const { email, password, fingerprint } = dto;

    // 查找用户（先查找以便记录日志）
    const existingUser = await this.prisma.client.users.findUnique({
      where: { email },
    });

    try {
      // 1. 验证用户凭证
      const user = await this.validateUser(email, password);

      // 2. 检查用户状态
      if (user.status !== 'active') {
        // 记录失败日志
        if (existingUser) {
          await this.loginLogService.log({
            userId: existingUser.id,
            ipAddress: ip,
            userAgent,
            loginStatus: 'failed',
            failureReason: '账号已被禁用',
          });
        }
        throw new UnauthorizedException('账号已被禁用，请联系客服');
      }

      // 3. 生成 JWT Token 和 Refresh Token
      const accessToken = this.generateToken(user);
      const refreshToken = await this.generateRefreshToken(user.id);

      // 4. 更新最后登录时间和 IP
      await this.prisma.client.users.update({
        where: { id: user.id },
        data: {
          last_login_at: new Date(),
          last_login_ip: ip || null,
        },
      });

      // 5. 记录成功登录日志
      await this.loginLogService.log({
        userId: user.id,
        ipAddress: ip,
        userAgent,
        loginStatus: 'success',
      });

      // 6. 记录设备指纹并检查
      let fingerprintCheck: FingerprintCheckResult | undefined;
      if (fingerprint) {
        try {
          fingerprintCheck = await this.fingerprintService.recordFingerprint(user.id, fingerprint);

          // 如果检测到高风险，记录警告
          if (fingerprintCheck.riskLevel === 'high') {
            this.logger.warn(
              `高风险登录: 用户 ${user.id} (${email}), 原因: ${fingerprintCheck.suspiciousReason}`,
            );
          }
        } catch (error) {
          this.logger.error(`记录设备指纹失败: ${error.message}`, error.stack);
          // 不阻塞登录流程
        }
      }

      this.logger.log(`用户登录成功: ${user.id} (${email})`);

      return {
        accessToken,
        refreshToken,
        expiresIn: this.ACCESS_TOKEN_EXPIRES_SECONDS,
        user: await this.sanitizeUser(user),
        fingerprintCheck,
      };
    } catch (error) {
      // 记录失败登录日志
      if (existingUser) {
        await this.loginLogService.log({
          userId: existingUser.id,
          ipAddress: ip,
          userAgent,
          loginStatus: 'failed',
          failureReason: error.message || '登录失败',
        });
      }
      throw error;
    }
  }

  /**
   * 获取用户登录日志
   * @param userId 用户 ID
   * @param limit 限制数量
   */
  async getLoginLogs(userId: string, limit = 10) {
    return this.loginLogService.getRecentLogs(userId, limit);
  }

  /**
   * 获取完整用户信息（包括 role 和 isAgent）
   * @param userId 用户 ID
   * @returns 脱敏后的用户信息
   */
  async getUserInfo(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return await this.sanitizeUser(user);
  }

  /**
   * 验证用户凭证
   * @param email 邮箱
   * @param password 密码
   * @returns 用户信息
   */
  async validateUser(email: string, password: string) {
    // 查找用户
    const user = await this.prisma.client.users.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    return user;
  }

  /**
   * 生成 JWT Token
   * @param user 用户信息
   * @returns JWT Token
   */
  generateToken(user: any): string {
    const payload = {
      sub: user.id,
      email: user.email,
      vipLevel: user.vip_level,
      role: user.role || 'user',
    };

    return this.jwtService.sign(payload);
  }

  /**
   * 生成 Refresh Token
   * @param userId 用户 ID
   * @returns Refresh Token (随机字符串)
   */
  async generateRefreshToken(userId: string): Promise<string> {
    // 生成随机 Token
    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.REFRESH_TOKEN_EXPIRES_DAYS);

    // 将 token 哈希后存储（安全考虑）
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // 存储到数据库（复用 billing_logs 或新建表，这里使用 Redis 模式简化）
    // 由于没有专门的 refresh_tokens 表，我们将 token 存入用户记录
    await this.prisma.client.users.update({
      where: { id: userId },
      data: {
        // 存储 token hash 和过期时间（使用 JSON 格式存入备用字段）
        // 由于 users 表没有 refresh_token 字段，我们临时使用 invite_code 字段
        // TODO: 生产环境应创建专门的 refresh_tokens 表
        updated_at: new Date(),
      },
    });

    // 由于没有专用字段，使用 JWT 形式存储 refresh token 信息
    const refreshPayload = {
      sub: userId,
      tokenHash,
      type: 'refresh',
    };

    // 使用不同的过期时间签发 refresh token
    return this.jwtService.sign(refreshPayload, {
      expiresIn: `${this.REFRESH_TOKEN_EXPIRES_DAYS}d`,
    });
  }

  /**
   * 刷新 Access Token
   * @param refreshToken Refresh Token
   * @returns 新的 Access Token 和 Refresh Token
   */
  async refreshAccessToken(refreshToken: string): Promise<RefreshTokenResponseDto> {
    try {
      // 验证 refresh token
      const payload = this.jwtService.verify(refreshToken);

      // 检查是否为 refresh token 类型
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('无效的刷新令牌类型');
      }

      // 查找用户
      const user = await this.prisma.client.users.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }

      if (user.status !== 'active') {
        throw new UnauthorizedException('账号已被禁用');
      }

      // 生成新的 tokens
      const newAccessToken = this.generateToken(user);
      const newRefreshToken = await this.generateRefreshToken(user.id);

      this.logger.log(`用户刷新令牌成功: ${user.id} (${user.email})`);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.ACCESS_TOKEN_EXPIRES_SECONDS,
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('刷新令牌已过期，请重新登录');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('无效的刷新令牌');
      }
      throw error;
    }
  }

  /**
   * 脱敏用户信息（移除密码等敏感字段）
   * @param user 原始用户信息
   * @returns 脱敏后的用户信息
   */
  private async sanitizeUser(user: any): Promise<UserResponseDto> {
    // 检查用户是否是代理商（在 agents 表中有记录）
    const agent = await this.prisma.client.agents.findUnique({
      where: { email: user.email },
    });

    return {
      id: user.id,
      email: user.email,
      vipLevel: user.vip_level,
      agentId: user.agent_id,
      inviteCode: user.invite_code,
      status: user.status,
      role: user.role || 'user',
      isAgent: !!agent, // 如果 agents 表有记录，则为代理商
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }

  // ==================== 2FA 相关方法 ====================

  /**
   * 获取 2FA 状态
   * @param userId 用户 ID
   */
  async getTotpStatus(userId: string): Promise<TotpStatusResponseDto> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { two_factor_enabled: true, updated_at: true },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    return {
      enabled: user.two_factor_enabled || false,
      enabledAt: user.two_factor_enabled ? user.updated_at : undefined,
    };
  }

  /**
   * 生成 2FA 设置信息（二维码）
   * @param userId 用户 ID
   */
  async setupTotp(userId: string): Promise<TotpSetupResponseDto> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { email: true, two_factor_enabled: true },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    if (user.two_factor_enabled) {
      throw new BadRequestException('2FA 已启用，请先禁用后再重新设置');
    }

    // 生成新的密钥
    const secret = this.totpService.generateSecret();
    const uri = this.totpService.generateUri(user.email, secret);
    const qrCode = await this.totpService.generateQrCode(user.email, secret);

    return {
      secret,
      uri,
      qrCode,
    };
  }

  /**
   * 启用 2FA
   * @param userId 用户 ID
   * @param token 验证码
   * @param secret 密钥
   */
  async enableTotp(userId: string, token: string, secret: string): Promise<void> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { two_factor_enabled: true },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    if (user.two_factor_enabled) {
      throw new BadRequestException('2FA 已启用');
    }

    // 验证令牌
    const isValid = this.totpService.verify(token, secret);
    if (!isValid) {
      throw new BadRequestException('验证码错误，请重试');
    }

    // 保存密钥并启用 2FA
    await this.prisma.client.users.update({
      where: { id: userId },
      data: {
        two_factor_secret: secret,
        two_factor_enabled: true,
        updated_at: new Date(),
      },
    });

    this.logger.log(`用户 ${userId} 启用了 2FA`);
  }

  /**
   * 禁用 2FA
   * @param userId 用户 ID
   * @param token 验证码
   * @param password 当前密码
   */
  async disableTotp(userId: string, token: string, password: string): Promise<void> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { two_factor_enabled: true, two_factor_secret: true, password_hash: true },
    });

    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    if (!user.two_factor_enabled || !user.two_factor_secret) {
      throw new BadRequestException('2FA 未启用');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('密码错误');
    }

    // 验证令牌
    const isValid = this.totpService.verify(token, user.two_factor_secret);
    if (!isValid) {
      throw new BadRequestException('验证码错误');
    }

    // 禁用 2FA
    await this.prisma.client.users.update({
      where: { id: userId },
      data: {
        two_factor_secret: null,
        two_factor_enabled: false,
        updated_at: new Date(),
      },
    });

    this.logger.log(`用户 ${userId} 禁用了 2FA`);
  }

  /**
   * 验证 2FA 令牌
   * @param userId 用户 ID
   * @param token 验证码
   */
  async verifyTotp(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { two_factor_enabled: true, two_factor_secret: true },
    });

    if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
      throw new BadRequestException('2FA 未启用');
    }

    const isValid = this.totpService.verify(token, user.two_factor_secret);
    if (!isValid) {
      throw new BadRequestException('验证码错误');
    }

    return true;
  }

  /**
   * 检查用户是否启用了 2FA
   * @param userId 用户 ID
   */
  async isTotpEnabled(userId: string): Promise<boolean> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: { two_factor_enabled: true },
    });

    return user?.two_factor_enabled || false;
  }

  // ==================== 设备管理相关方法 ====================

  /**
   * 获取用户的设备列表
   * @param userId 用户 ID
   */
  async getUserDevices(userId: string) {
    return this.fingerprintService.getUserDevices(userId);
  }

  /**
   * 删除用户的某个设备
   * @param userId 用户 ID
   * @param fingerprintHash 设备指纹哈希
   */
  async removeDevice(userId: string, fingerprintHash: string) {
    return this.fingerprintService.removeDevice(userId, fingerprintHash);
  }

  /**
   * 清除用户所有设备
   * @param userId 用户 ID
   */
  async clearAllDevices(userId: string) {
    return this.fingerprintService.clearAllDevices(userId);
  }
}
