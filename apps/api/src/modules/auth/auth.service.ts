import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
  OnModuleDestroy,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ethers } from 'ethers';
import { createHmac, randomBytes, randomInt } from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AirdropService } from '../airdrop/airdrop.service';
import { ReferralService } from '../referral/referral.service';
import {
  RegisterDto,
  LoginDto,
  LoginResponse,
  UserResponse,
  UpdateProfileDto,
} from './dto/auth.dto';
import { BindTelegramDto, TelegramLoginDto } from './dto/telegram.dto';
import { JwtPayload } from './strategies/jwt.strategy';

// 安全常量
const BIND_CODE_TTL = 5 * 60; // 5分钟
const NONCE_TTL = 5 * 60; // 5分钟
const LOGIN_ATTEMPT_TTL = 15 * 60; // 15分钟窗口
const MAX_LOGIN_ATTEMPTS = 5; // 最大登录尝试次数
const ACCOUNT_LOCK_TTL = 30 * 60; // 锁定30分钟

// Token TTL 常量
const ACCESS_TOKEN_TTL = 15 * 60; // 15分钟（秒）
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7天（秒）

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  private readonly redis: Redis;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    @Inject(forwardRef(() => AirdropService))
    private airdropService: AirdropService,
    @Inject(forwardRef(() => ReferralService))
    private referralService: ReferralService,
  ) {
    // 创建 Redis 连接（用于认证缓存）
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      keyPrefix: 'auth:',
    });

    this.redis.on('error', (err) => {
      this.logger.error('认证 Redis 连接错误:', err.message);
    });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  // ===== Refresh Token 机制 =====

  /**
   * 生成 Access Token + Refresh Token 对
   * Access Token: JWT 15分钟，Refresh Token: 随机 64 字节 hex，7天
   */
  private async generateTokenPair(
    userId: string,
    email?: string | null,
    ip?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    // Access Token (15min)
    const payload: JwtPayload = {
      sub: userId,
      email: email || undefined,
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_TTL,
    });

    // Refresh Token（随机 64 字节 hex，不是 JWT）
    const refreshTokenValue = randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);

    // 存储到数据库
    await this.prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        userId,
        expiresAt,
        ipAddress: ip,
        userAgent,
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: ACCESS_TOKEN_TTL,
    };
  }

  /**
   * 使用 Refresh Token 换取新的 Token 对（Token Rotation）
   * 旧 Token 立即撤销，生成新 Token 对
   * 重放检测：已撤销的 Token 被再次使用 = 撤销该用户所有 Token
   */
  async refreshAccessToken(
    refreshToken: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    // 查找 Refresh Token（连同用户信息）
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!stored) {
      throw new UnauthorizedException('无效的 Refresh Token');
    }

    if (stored.revokedAt) {
      // Token 已被使用过（可能是被盗）— 撤销该用户所有活跃 Token
      await this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(
        `Refresh Token 重放攻击检测: userId=${stored.userId}, ip=${ip}`,
      );
      throw new UnauthorizedException('Refresh Token 已失效，请重新登录');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh Token 已过期，请重新登录');
    }

    // Token Rotation：撤销旧 Token
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    // 生成新的 Token 对
    return this.generateTokenPair(stored.userId, stored.user.email, ip, userAgent);
  }

  /**
   * 撤销指定用户的所有活跃 Refresh Token（登出时调用）
   */
  async revokeAllTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ===== 防暴力破解 =====

  // 检查登录是否被锁定
  private async isLoginLocked(identifier: string): Promise<boolean> {
    const lockKey = `lock:${identifier}`;
    const locked = await this.redis.get(lockKey);
    return locked === '1';
  }

  // 记录登录失败
  private async recordLoginFailure(email: string, ip: string): Promise<void> {
    const emailKey = `attempts:email:${email}`;
    const ipKey = `attempts:ip:${ip}`;

    // 递增失败计数
    const emailAttempts = await this.redis.incr(emailKey);
    const ipAttempts = await this.redis.incr(ipKey);

    // 设置过期时间（只在首次设置）
    if (emailAttempts === 1) await this.redis.expire(emailKey, LOGIN_ATTEMPT_TTL);
    if (ipAttempts === 1) await this.redis.expire(ipKey, LOGIN_ATTEMPT_TTL);

    // 超过阈值则锁定
    if (emailAttempts >= MAX_LOGIN_ATTEMPTS) {
      await this.redis.set(`lock:email:${email}`, '1', 'EX', ACCOUNT_LOCK_TTL);
      this.logger.warn(`账户因多次失败已锁定: ${email}，锁定 ${ACCOUNT_LOCK_TTL / 60} 分钟`);
    }

    if (ipAttempts >= MAX_LOGIN_ATTEMPTS * 3) {
      await this.redis.set(`lock:ip:${ip}`, '1', 'EX', ACCOUNT_LOCK_TTL);
      this.logger.warn(`IP 因多次失败已锁定: ${ip}，锁定 ${ACCOUNT_LOCK_TTL / 60} 分钟`);
    }
  }

  // 登录成功后清除失败记录
  private async clearLoginFailures(email: string): Promise<void> {
    await this.redis.del(`attempts:email:${email}`);
    await this.redis.del(`lock:email:${email}`);
  }

  // ===== 审计日志 =====

  // 记录审计日志
  private async logAudit(
    actorId: string,
    actorType: string,
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          actorType,
          action,
          resourceType,
          resourceId,
          details,
          ipAddress: ip,
          userAgent,
        },
      });
    } catch (error) {
      // 审计日志写入失败不应影响业务流程
      this.logger.error(`审计日志写入失败: ${error.message}`);
    }
  }

  // 注册
  async register(dto: RegisterDto): Promise<UserResponse> {
    // 验证邀请码是否有效（填写邀请码时校验，未填写则允许直接注册）
    let inviter: { id: string } | null = null;
    if (dto.inviteCode) {
      inviter = await this.prisma.user.findUnique({
        where: { inviteCode: dto.inviteCode },
        select: { id: true },
      });

      if (!inviter) {
        throw new BadRequestException('邀请码无效');
      }
    }

    // 检查邮箱是否已存在
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('邮箱已被注册');
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        nickname: dto.nickname || dto.email.split('@')[0],
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        createdAt: true,
      },
    });

    // 绑定邀请码（仅在用户填写了邀请码时处理）
    if (dto.inviteCode) {
      try {
        await this.referralService.bindInviteCode(user.id, dto.inviteCode);
        this.logger.log(`邮箱注册绑定邀请人: ${dto.email} -> ${dto.inviteCode}`);
      } catch (error) {
        // 绑定失败不影响注册流程（用户已创建成功）
        this.logger.warn(`邀请码绑定失败: ${dto.email}, ${error.message}`);
      }
    }

    // 审计日志
    await this.logAudit(user.id, 'user', 'register', 'user', user.id, `邮箱注册: ${dto.email}, 邀请码: ${dto.inviteCode}`);

    // 发送验证码（邮箱注册必定有 email）
    if (user.email) {
      await this.sendVerificationCode(user.email);
    }

    return user;
  }

  // 发送验证码
  async sendVerificationCode(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (user.emailVerified) {
      throw new BadRequestException('邮箱已验证');
    }

    // 生成 6 位验证码
    const code = randomInt(100000, 999999).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10分钟过期

    // 保存验证码
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationCode: code,
        verificationExpiry: expiry,
      },
    });

    // 发送邮件
    const sent = await this.emailService.sendVerificationCode(email, code);

    if (!sent) {
      throw new BadRequestException('发送验证码失败，请稍后重试');
    }

    this.logger.log(`验证码已发送: ${email}`);

    return { message: '验证码已发送' };
  }

  // 验证邮箱
  async verifyEmail(
    email: string,
    code: string,
  ): Promise<{ message: string; accessToken: string; refreshToken: string; user: { id: string; email: string; nickname: string } }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        nickname: true,
        emailVerified: true,
        verificationCode: true,
        verificationExpiry: true,
        telegramId: true,
        walletAddress: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (user.emailVerified) {
      throw new BadRequestException('邮箱已验证');
    }

    if (!user.verificationCode || !user.verificationExpiry) {
      throw new BadRequestException('请先获取验证码');
    }

    if (new Date() > user.verificationExpiry) {
      throw new BadRequestException('验证码已过期');
    }

    if (user.verificationCode !== code) {
      throw new BadRequestException('验证码错误');
    }

    // 验证成功
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationCode: null,
        verificationExpiry: null,
      },
    });

    // 发送欢迎邮件
    await this.emailService.sendWelcomeEmail(
      email,
      user.nickname || email.split('@')[0],
    );

    // 判断是首次注册还是绑定邮箱
    const isBindEmail = !!(user.telegramId || user.walletAddress);

    try {
      if (isBindEmail) {
        // 已有账户绑定邮箱 (+10 HOOT)
        await this.airdropService.grantBindEmailAirdrop(user.id, email);
        this.logger.log(`绑定邮箱空投已发放: ${email} +10 HOOT`);
      } else {
        // 首次注册 (+20 HOOT)
        await this.airdropService.grantRegisterAirdrop(user.id);
        this.logger.log(`注册空投已发放: ${email} +20 HOOT`);
      }
    } catch (error) {
      this.logger.error(`空投发放失败: ${email}, ${error.message}`);
    }

    this.logger.log(`邮箱验证成功: ${email}`);

    // 验证成功后自动颁发 Token，免去再次手动登录
    const tokenPair = await this.generateTokenPair(user.id, email);

    const reward = isBindEmail ? 10 : 20;
    return {
      message: `邮箱验证成功，获得 ${reward} HOOT 空投奖励！`,
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: {
        id: user.id,
        email: user.email ?? email,
        nickname: user.nickname ?? email.split('@')[0],
      },
    };
  }

  // 登录（含防暴力破解）
  async login(dto: LoginDto, ip?: string): Promise<LoginResponse> {
    // 并行检查账户和 IP 锁定状态（节省一次串行 Redis 往返）
    const [emailLocked, ipLocked] = await Promise.all([
      this.isLoginLocked(`email:${dto.email}`),
      ip ? this.isLoginLocked(`ip:${ip}`) : Promise.resolve(false),
    ]);

    if (emailLocked) {
      throw new UnauthorizedException('账户因多次登录失败已被临时锁定，请 30 分钟后重试');
    }
    if (ipLocked) {
      throw new UnauthorizedException('此 IP 因频繁失败已被临时锁定，请稍后重试');
    }

    // 查找用户
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      // 防止邮箱枚举：无论用户是否存在，都返回相同的错误信息和延迟
      if (ip) await this.recordLoginFailure(dto.email, ip);
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      if (ip) await this.recordLoginFailure(dto.email, ip);
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 登录成功：并行执行清除失败记录 + 审计日志 + 生成 Token
    const [, , tokenPair] = await Promise.all([
      this.clearLoginFailures(dto.email),
      this.logAudit(user.id, 'user', 'login', 'user', user.id, '邮箱密码登录', ip),
      this.generateTokenPair(user.id, user.email, ip),
    ]);

    return {
      ...tokenPair,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
      },
    };
  }

  // 获取当前用户信息
  async getProfile(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nickname: true,
        createdAt: true,
        // 会员信息
        membershipStatus: true,
        membershipExpireAt: true,
        // Telegram 绑定状态
        telegramId: true,
        telegramUsername: true,
        // 钱包绑定状态
        walletAddress: true,
        // 邮箱验证状态
        emailVerified: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 计算会员等级（根据 membershipStatus 和到期时间）
    let subscriptionTier = 'basic';
    if (
      user.membershipStatus === 'active' &&
      user.membershipExpireAt &&
      new Date(user.membershipExpireAt) > new Date()
    ) {
      subscriptionTier = 'premium';
    }

    return {
      ...user,
      subscriptionTier,
      vipLevel: subscriptionTier === 'premium' ? 1 : 0,
    };
  }

  // ===== 用户资料更新 =====

  // 更新用户资料（昵称等）
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<{ nickname: string }> {
    const updateData: Record<string, string> = {};

    if (dto.nickname !== undefined) {
      updateData.nickname = dto.nickname.trim();
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('没有需要更新的字段');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { nickname: true },
    });

    // 审计日志
    await this.logAudit(userId, 'user', 'update_profile', 'user', userId, `更新资料: ${JSON.stringify(updateData)}`);

    this.logger.log(`用户资料已更新: ${userId}`);

    return { nickname: user.nickname ?? '' };
  }

  // ===== Telegram 相关 =====

  // 生成 Telegram 绑定码（使用 Redis 存储）
  async generateBindCode(
    userId: string,
  ): Promise<{ bindCode: string; expiresAt: Date }> {
    // 生成 8 位绑定码（crypto 安全随机）
    const bindCode = randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + BIND_CODE_TTL * 1000);

    // 存入 Redis，自动过期
    await this.redis.set(
      `bindcode:${bindCode}`,
      JSON.stringify({ userId, expiresAt: expiresAt.toISOString() }),
      'EX',
      BIND_CODE_TTL,
    );

    return { bindCode, expiresAt };
  }

  // 绑定 Telegram
  async bindTelegram(dto: BindTelegramDto) {
    // 从 Redis 获取绑定码
    const cachedStr = await this.redis.get(`bindcode:${dto.bindCode}`);

    if (!cachedStr) {
      throw new BadRequestException('绑定码无效或已过期');
    }

    const cached = JSON.parse(cachedStr);

    if (new Date() > new Date(cached.expiresAt)) {
      await this.redis.del(`bindcode:${dto.bindCode}`);
      throw new BadRequestException('绑定码已过期');
    }

    // 检查 Telegram ID 是否已绑定
    const existingUser = await this.prisma.user.findUnique({
      where: { telegramId: dto.telegramId },
    });

    if (existingUser) {
      throw new ConflictException('此 Telegram 账户已绑定其他用户');
    }

    // 绑定
    const user = await this.prisma.user.update({
      where: { id: cached.userId },
      data: {
        telegramId: dto.telegramId,
        telegramUsername: dto.telegramUsername,
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        usdtBalance: true,
        hootBalance: true,
      },
    });

    // 删除已使用的绑定码
    await this.redis.del(`bindcode:${dto.bindCode}`);

    // 审计日志
    await this.logAudit(user.id, 'user', 'bind_telegram', 'user', user.id, `绑定 TG: ${dto.telegramId}`);

    // 发放绑定 Telegram 空投 (+10 HOOT)
    try {
      await this.airdropService.grantBindTgAirdrop(user.id, dto.telegramId);
      this.logger.log(`TG 绑定空投已发放: ${user.email} +10 HOOT`);
    } catch (error) {
      this.logger.error(`TG 绑定空投发放失败: ${user.email}, ${error.message}`);
    }

    // 重新获取更新后的余额
    const updatedUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { hootBalance: true },
    });

    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      usdtBalance: user.usdtBalance.toString(),
      hootBalance:
        updatedUser?.hootBalance.toString() || user.hootBalance.toString(),
    };
  }

  // 通过 Telegram ID 获取用户
  async getUserByTelegramId(telegramId: string) {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      select: {
        id: true,
        email: true,
        nickname: true,
        usdtBalance: true,
        hootBalance: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      usdtBalance: user.usdtBalance.toString(),
      hootBalance: user.hootBalance.toString(),
    };
  }

  // 解绑 Telegram
  async unbindTelegram(userId: string): Promise<void> {
    // 检查用户是否有其他登录方式
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, walletAddress: true },
    });

    if (!user?.email && !user?.walletAddress) {
      throw new BadRequestException('无法解绑：至少保留一种登录方式');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        telegramId: null,
        telegramUsername: null,
      },
    });

    // 审计日志
    await this.logAudit(userId, 'user', 'unbind_telegram', 'user', userId);
  }

  // ===== Telegram 自动登录（新） =====

  // TG 自动登录/注册
  async loginByTelegram(dto: TelegramLoginDto): Promise<LoginResponse> {
    let user = await this.prisma.user.findUnique({
      where: { telegramId: dto.telegramId },
    });

    let isNewUser = false;

    // 不存在则自动创建账户
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          telegramId: dto.telegramId,
          telegramUsername: dto.telegramUsername || null,
          nickname: dto.telegramUsername || `TG${dto.telegramId.slice(-6)}`,
        },
      });
      isNewUser = true;

      // 审计日志
      await this.logAudit(user.id, 'user', 'register', 'user', user.id, `TG 注册: ${dto.telegramId}`);

      // 发放注册空投 (+20 HOOT) - 与邮箱/钱包注册一致
      try {
        await this.airdropService.grantRegisterAirdrop(user.id);
        this.logger.log(`TG 用户注册空投: ${dto.telegramId} +20 HOOT`);
      } catch (error) {
        this.logger.error(
          `TG 注册空投失败: ${dto.telegramId}, ${error.message}`,
        );
      }

      // 如果有邀请码，自动绑定邀请关系（TG Bot 深度链接）
      // 注意：邀请奖励不在注册时发放，改为被邀请人首次订阅策略后发放（防刷）
      if (dto.referralCode) {
        try {
          await this.referralService.bindInviteCode(user.id, dto.referralCode);
          this.logger.log(
            `TG 用户通过深度链接绑定邀请人: ${dto.telegramId} -> ${dto.referralCode}`,
          );
        } catch (error) {
          // 绑定失败不影响注册流程
          this.logger.warn(
            `TG 邀请码绑定失败: ${dto.telegramId}, ${error.message}`,
          );
        }
      }
    }

    // 审计日志
    await this.logAudit(user.id, 'user', 'login', 'user', user.id, `TG 登录: ${dto.telegramId}`);

    // 重新查询包含余额的用户信息（注册后余额可能已变）
    const freshUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        nickname: true,
        usdtBalance: true,
        hootBalance: true,
        pointBalance: true,
      },
    });

    // freshUser 理论上不会为 null（刚创建/查到的用户），但 TS 要求 null check
    const u = freshUser || user;

    // 生成 Token 对（Access Token 15min + Refresh Token 7天）
    const tokenPair = await this.generateTokenPair(user.id, user.email);

    return {
      ...tokenPair,
      user: {
        id: u.id,
        email: u.email,
        nickname: u.nickname,
        usdtBalance: freshUser?.usdtBalance?.toString() || '0',
        hootBalance: freshUser?.hootBalance?.toString() || '0',
        pointBalance: freshUser?.pointBalance?.toString() || '0',
      },
      isNewUser,
    };
  }

  // ===== Telegram WebApp 登录（Mini App 专用）=====

  /**
   * 验证 TG WebApp initData 签名
   * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
   */
  private validateTelegramInitData(initData: string): { user: { id: number; username?: string; first_name?: string }; authDate: number } {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      throw new UnauthorizedException('Telegram Bot Token 未配置');
    }

    // 解析 initData（URL 参数格式）
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      throw new UnauthorizedException('initData 缺少 hash');
    }

    // 按字母序排列参数（排除 hash），用 \n 连接
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // HMAC-SHA256 验签
    const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) {
      throw new UnauthorizedException('initData 签名验证失败');
    }

    // 检查 auth_date 时效（1 小时内有效）
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 3600) {
      throw new UnauthorizedException('initData 已过期，请重新打开应用');
    }

    // 解析用户信息
    const userStr = params.get('user');
    if (!userStr) {
      throw new UnauthorizedException('initData 缺少用户信息');
    }

    try {
      const user = JSON.parse(userStr);
      return { user, authDate };
    } catch {
      throw new UnauthorizedException('initData 用户信息解析失败');
    }
  }

  /**
   * TG WebApp 登录（Mini App 前端调用）
   * 通过 initData 验签实现免密登录
   */
  async loginByWebApp(initData: string): Promise<LoginResponse> {
    // 验证 initData 签名
    const { user: tgUser } = this.validateTelegramInitData(initData);

    const telegramId = String(tgUser.id);
    const telegramUsername = tgUser.username || null;

    // 复用 TG 登录逻辑（查找/创建用户 + 发放空投 + JWT）
    return this.loginByTelegram({
      telegramId,
      telegramUsername: telegramUsername || undefined,
      firstName: tgUser.first_name,
    });
  }

  // ===== 钱包登录 (SIWE) =====

  // 获取登录 Nonce（使用 Redis 存储）
  async getWalletNonce(
    address: string,
  ): Promise<{ nonce: string; expiresAt: Date }> {
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + NONCE_TTL * 1000);

    // 存入 Redis，自动过期
    await this.redis.set(
      `nonce:${address.toLowerCase()}`,
      JSON.stringify({ nonce, expiresAt: expiresAt.toISOString() }),
      'EX',
      NONCE_TTL,
    );

    return { nonce, expiresAt };
  }

  // 钱包登录（使用 ethers.js 密码学签名验证）
  async loginByWallet(
    address: string,
    signature: string,
    message: string,
  ): Promise<LoginResponse> {
    const normalizedAddress = address.toLowerCase();

    // 从 Redis 获取 Nonce
    const cachedStr = await this.redis.get(`nonce:${normalizedAddress}`);
    if (!cachedStr) {
      throw new BadRequestException('请先获取 Nonce');
    }

    const cached = JSON.parse(cachedStr);

    if (new Date() > new Date(cached.expiresAt)) {
      await this.redis.del(`nonce:${normalizedAddress}`);
      throw new BadRequestException('Nonce 已过期');
    }

    // 验证消息中包含 Nonce
    if (!message.includes(cached.nonce)) {
      throw new UnauthorizedException('签名验证失败：消息不包含有效 Nonce');
    }

    // 使用 ethers.js 密码学验证签名
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== normalizedAddress) {
        throw new UnauthorizedException('签名验证失败：签名者地址不匹配');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.warn(`钱包签名验证异常: ${error.message}`);
      throw new UnauthorizedException('签名验证失败：无效的签名格式');
    }

    // 删除已使用的 Nonce
    await this.redis.del(`nonce:${normalizedAddress}`);

    // 查找或创建用户
    let user = await this.prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
    });

    let isNewUser = false;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          walletAddress: normalizedAddress,
          nickname: `${address.slice(0, 6)}...${address.slice(-4)}`,
        },
      });
      isNewUser = true;

      // 审计日志
      await this.logAudit(user.id, 'user', 'register', 'user', user.id, `钱包注册: ${address}`);

      // 发放钱包注册空投 (+100 HOOT)
      try {
        await this.airdropService.grantRegisterAirdrop(user.id);
        this.logger.log(`钱包用户注册空投: ${address} +100 HOOT`);
      } catch (error) {
        this.logger.error(`钱包注册空投失败: ${address}, ${error.message}`);
      }
    }

    // 审计日志
    await this.logAudit(user.id, 'user', 'login', 'user', user.id, `钱包登录: ${address}`);

    // 生成 Token 对（Access Token 15min + Refresh Token 7天）
    const tokenPair = await this.generateTokenPair(user.id, user.email);

    return {
      ...tokenPair,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        walletAddress: user.walletAddress,
      },
      isNewUser,
    };
  }

  // ===== 账户绑定 =====

  // 绑定邮箱（已登录用户）
  async bindEmail(
    userId: string,
    email: string,
    password: string,
  ): Promise<{ message: string }> {
    // 检查邮箱是否已被使用
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing && existing.id !== userId) {
      throw new ConflictException('邮箱已被其他账户使用');
    }

    // 更新用户
    const hashedPassword = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email,
        password: hashedPassword,
        emailVerified: false,
      },
    });

    // 审计日志
    await this.logAudit(userId, 'user', 'bind_email', 'user', userId, `绑定邮箱: ${email}`);

    // 发送验证码
    await this.sendVerificationCode(email);

    return { message: '邮箱绑定成功，请验证邮箱' };
  }

  // 绑定钱包（已登录用户，含 ethers.js 签名验证）
  async bindWallet(
    userId: string,
    address: string,
    signature: string,
    message: string,
  ): Promise<{ message: string }> {
    const normalizedAddress = address.toLowerCase();

    // 从 Redis 获取 Nonce
    const cachedStr = await this.redis.get(`nonce:${normalizedAddress}`);
    if (!cachedStr) {
      throw new BadRequestException('请先获取 Nonce');
    }

    const cached = JSON.parse(cachedStr);

    if (!message.includes(cached.nonce)) {
      throw new UnauthorizedException('签名验证失败');
    }

    // 使用 ethers.js 密码学验证签名
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      if (recoveredAddress.toLowerCase() !== normalizedAddress) {
        throw new UnauthorizedException('签名验证失败：签名者地址不匹配');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('签名验证失败：无效的签名');
    }

    await this.redis.del(`nonce:${normalizedAddress}`);

    // 检查钱包是否已被使用
    const existing = await this.prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
    });

    if (existing && existing.id !== userId) {
      throw new ConflictException('钱包已被其他账户使用');
    }

    // 更新用户
    await this.prisma.user.update({
      where: { id: userId },
      data: { walletAddress: normalizedAddress },
    });

    // 审计日志
    await this.logAudit(userId, 'user', 'bind_wallet', 'user', userId, `绑定钱包: ${normalizedAddress}`);

    // 发放绑定钱包空投 (+10 HOOT)
    try {
      await this.airdropService.grantBindWalletAirdrop(
        userId,
        normalizedAddress,
      );
      this.logger.log(`钱包绑定空投: ${userId} +10 HOOT`);
    } catch (error) {
      this.logger.error(`钱包绑定空投失败: ${error.message}`);
    }

    return { message: '钱包绑定成功，获得 10 HOOT 奖励！' };
  }

  // 解绑钱包
  async unbindWallet(userId: string): Promise<{ message: string }> {
    // 检查用户是否有其他登录方式
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, telegramId: true },
    });

    if (!user?.email && !user?.telegramId) {
      throw new BadRequestException('无法解绑：至少保留一种登录方式');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { walletAddress: null },
    });

    // 审计日志
    await this.logAudit(userId, 'user', 'unbind_wallet', 'user', userId);

    return { message: '钱包已解绑' };
  }

  // 获取用户完整信息（包含所有绑定状态）
  async getFullProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        nickname: true,
        telegramId: true,
        telegramUsername: true,
        walletAddress: true,
        usdtBalance: true,
        hootBalance: true,
        pointBalance: true,
        lockedBalance: true,
        availableBalance: true,
        inviteCode: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return {
      ...user,
      usdtBalance: user.usdtBalance.toString(),
      hootBalance: user.hootBalance.toString(),
      pointBalance: user.pointBalance.toString(),
      lockedBalance: user.lockedBalance.toString(),
      availableBalance: user.availableBalance.toString(),
      bindings: {
        email: !!user.email,
        emailVerified: user.emailVerified,
        telegram: !!user.telegramId,
        wallet: !!user.walletAddress,
      },
    };
  }

  // ===== 定期清理 =====

  /**
   * 每天凌晨 3 点清理过期和已撤销的 Refresh Token
   * - 已过期超过 24 小时的 token
   * - 已撤销超过 24 小时的 token
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredRefreshTokens(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24小时前

    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: cutoff } },
            { revokedAt: { lt: cutoff } },
          ],
        },
      });

      if (result.count > 0) {
        this.logger.log(`清理过期 Refresh Token: 删除 ${result.count} 条`);
      }
    } catch (error) {
      this.logger.error('清理过期 Refresh Token 失败:', error);
    }
  }
}
