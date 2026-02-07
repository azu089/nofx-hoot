import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AirdropService } from '../airdrop/airdrop.service';
import { ReferralService } from '../referral/referral.service';
import {
  RegisterDto,
  LoginDto,
  LoginResponse,
  UserResponse,
} from './dto/auth.dto';
import { BindTelegramDto, TelegramLoginDto } from './dto/telegram.dto';
import { JwtPayload } from './strategies/jwt.strategy';

// 绑定码缓存（实际项目应该用 Redis）
const bindCodeCache = new Map<string, { userId: string; expiresAt: Date }>();

// Nonce 缓存（钱包登录用）
const nonceCache = new Map<string, { nonce: string; expiresAt: Date }>();

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    @Inject(forwardRef(() => AirdropService))
    private airdropService: AirdropService,
    @Inject(forwardRef(() => ReferralService))
    private referralService: ReferralService,
  ) {}

  // 注册
  async register(dto: RegisterDto): Promise<UserResponse> {
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
    const code = Math.floor(100000 + Math.random() * 900000).toString();
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
  async verifyEmail(email: string, code: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        emailVerified: true,
        verificationCode: true,
        verificationExpiry: true,
        nickname: true,
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
        // 已有账户绑定邮箱 (+30 HOOT)
        await this.airdropService.grantBindEmailAirdrop(user.id, email);
        this.logger.log(`绑定邮箱空投已发放: ${email} +30 HOOT`);
      } else {
        // 首次注册 (+100 HOOT)
        await this.airdropService.grantRegisterAirdrop(user.id);
        this.logger.log(`注册空投已发放: ${email} +100 HOOT`);
      }
    } catch (error) {
      this.logger.error(`空投发放失败: ${email}, ${error.message}`);
    }

    this.logger.log(`邮箱验证成功: ${email}`);

    const reward = isBindEmail ? 30 : 100;
    return { message: `邮箱验证成功，获得 ${reward} HOOT 空投奖励！` };
  }

  // 登录
  async login(dto: LoginDto): Promise<LoginResponse> {
    // 查找用户
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    // 生成 JWT
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email || undefined,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
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

  // ===== Telegram 相关 =====

  // 生成 Telegram 绑定码
  async generateBindCode(
    userId: string,
  ): Promise<{ bindCode: string; expiresAt: Date }> {
    // 生成 6 位绑定码
    const bindCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟过期

    // 缓存绑定码
    bindCodeCache.set(bindCode, { userId, expiresAt });

    // 5分钟后自动清理
    setTimeout(
      () => {
        bindCodeCache.delete(bindCode);
      },
      5 * 60 * 1000,
    );

    return { bindCode, expiresAt };
  }

  // 绑定 Telegram
  async bindTelegram(dto: BindTelegramDto) {
    // 验证绑定码
    const cached = bindCodeCache.get(dto.bindCode);

    if (!cached) {
      throw new BadRequestException('绑定码无效或已过期');
    }

    if (new Date() > cached.expiresAt) {
      bindCodeCache.delete(dto.bindCode);
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
    bindCodeCache.delete(dto.bindCode);

    // 发放绑定 Telegram 空投 (+50 HOOT)
    try {
      await this.airdropService.grantBindTgAirdrop(user.id, dto.telegramId);
      this.logger.log(`TG 绑定空投已发放: ${user.email} +50 HOOT`);
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

      // 发放注册空投 (+100 HOOT) - 与邮箱/钱包注册一致
      try {
        await this.airdropService.grantRegisterAirdrop(user.id);
        this.logger.log(`TG 用户注册空投: ${dto.telegramId} +100 HOOT`);
      } catch (error) {
        this.logger.error(
          `TG 注册空投失败: ${dto.telegramId}, ${error.message}`,
        );
      }

      // 如果有邀请码，自动绑定邀请关系（TG Bot 深度链接）
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

    // 生成 JWT
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email || undefined,
    };

    const accessToken = this.jwtService.sign(payload);

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

    return {
      accessToken,
      user: {
        id: freshUser.id,
        email: freshUser.email,
        nickname: freshUser.nickname,
        usdtBalance: freshUser.usdtBalance.toString(),
        hootBalance: freshUser.hootBalance.toString(),
        pointBalance: freshUser.pointBalance.toString(),
      },
      isNewUser,
    };
  }

  // ===== 钱包登录 (SIWE) =====

  // 获取登录 Nonce
  async getWalletNonce(
    address: string,
  ): Promise<{ nonce: string; expiresAt: Date }> {
    const nonce =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟有效

    nonceCache.set(address.toLowerCase(), { nonce, expiresAt });

    // 5分钟后自动清理
    setTimeout(
      () => {
        nonceCache.delete(address.toLowerCase());
      },
      5 * 60 * 1000,
    );

    return { nonce, expiresAt };
  }

  // 钱包登录
  async loginByWallet(
    address: string,
    signature: string,
    message: string,
  ): Promise<LoginResponse> {
    const normalizedAddress = address.toLowerCase();

    // 验证 Nonce
    const cached = nonceCache.get(normalizedAddress);
    if (!cached) {
      throw new BadRequestException('请先获取 Nonce');
    }

    if (new Date() > cached.expiresAt) {
      nonceCache.delete(normalizedAddress);
      throw new BadRequestException('Nonce 已过期');
    }

    // 验证签名（简化验证，实际应使用 ethers.verifyMessage）
    // TODO: 使用 ethers.js 验证签名
    if (!message.includes(cached.nonce)) {
      throw new UnauthorizedException('签名验证失败');
    }

    // 删除已使用的 Nonce
    nonceCache.delete(normalizedAddress);

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

      // 发放钱包注册空投 (+100 HOOT)
      try {
        await this.airdropService.grantRegisterAirdrop(user.id);
        this.logger.log(`钱包用户注册空投: ${address} +100 HOOT`);
      } catch (error) {
        this.logger.error(`钱包注册空投失败: ${address}, ${error.message}`);
      }
    }

    // 生成 JWT
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email || undefined,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
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

    // 发送验证码
    await this.sendVerificationCode(email);

    return { message: '邮箱绑定成功，请验证邮箱' };
  }

  // 绑定钱包（已登录用户）
  async bindWallet(
    userId: string,
    address: string,
    signature: string,
    message: string,
  ): Promise<{ message: string }> {
    const normalizedAddress = address.toLowerCase();

    // 验证 Nonce
    const cached = nonceCache.get(normalizedAddress);
    if (!cached) {
      throw new BadRequestException('请先获取 Nonce');
    }

    if (!message.includes(cached.nonce)) {
      throw new UnauthorizedException('签名验证失败');
    }

    nonceCache.delete(normalizedAddress);

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

    // 发放绑定钱包空投 (+20 HOOT)
    try {
      await this.airdropService.grantBindWalletAirdrop(
        userId,
        normalizedAddress,
      );
      this.logger.log(`钱包绑定空投: ${userId} +20 HOOT`);
    } catch (error) {
      this.logger.error(`钱包绑定空投失败: ${error.message}`);
    }

    return { message: '钱包绑定成功，获得 20 HOOT 奖励！' };
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
}
