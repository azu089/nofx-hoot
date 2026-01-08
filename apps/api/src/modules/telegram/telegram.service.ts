import { Injectable, Logger, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  TelegramAuthDto,
  TelegramAuthResponseDto,
  ParsedInitData,
  TelegramUserInfo,
  TelegramLinkStatusDto,
} from './dto';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly initDataMaxAge = 5 * 60 * 1000; // 5 分钟有效期

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN 未配置，Telegram 认证将不可用');
    }
  }

  /**
   * 验证 Telegram initData 签名
   * 使用 HMAC-SHA256 验证数据完整性
   * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
   */
  private verifyInitData(initData: string): ParsedInitData {
    if (!this.botToken) {
      throw new UnauthorizedException('Telegram 认证未配置');
    }

    // 解析 initData 为键值对
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) {
      throw new UnauthorizedException('缺少签名哈希');
    }

    // 获取 auth_date 并检查时效性
    const authDateStr = params.get('auth_date');
    if (!authDateStr) {
      throw new UnauthorizedException('缺少认证时间');
    }

    const authDate = parseInt(authDateStr, 10) * 1000; // 转换为毫秒
    const now = Date.now();

    if (now - authDate > this.initDataMaxAge) {
      throw new UnauthorizedException('认证数据已过期');
    }

    // 构建数据检查字符串（按字母顺序排列，不包含 hash）
    const dataCheckArr: string[] = [];
    params.forEach((value, key) => {
      if (key !== 'hash') {
        dataCheckArr.push(`${key}=${value}`);
      }
    });
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    // 计算 HMAC-SHA256
    // secret_key = HMAC-SHA256(bot_token, "WebAppData")
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(this.botToken)
      .digest();

    // calculated_hash = HMAC-SHA256(data_check_string, secret_key)
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      throw new UnauthorizedException('签名验证失败');
    }

    // 解析用户信息
    const userStr = params.get('user');
    if (!userStr) {
      throw new UnauthorizedException('缺少用户信息');
    }

    let user: TelegramUserInfo;
    try {
      user = JSON.parse(userStr);
    } catch {
      throw new UnauthorizedException('用户信息格式错误');
    }

    return {
      user,
      auth_date: parseInt(authDateStr, 10),
      hash,
      query_id: params.get('query_id') || undefined,
      chat_type: params.get('chat_type') || undefined,
      chat_instance: params.get('chat_instance') || undefined,
    };
  }

  /**
   * Telegram 登录/注册
   * 自动查找或创建用户
   */
  async authenticate(
    dto: TelegramAuthDto,
    ipAddress?: string,
  ): Promise<TelegramAuthResponseDto> {
    // 验证签名
    let parsedData: ParsedInitData;
    try {
      parsedData = this.verifyInitData(dto.initData);
    } catch (error) {
      // 记录失败日志
      await this.logTelegramLogin({
        telegramId: 0n,
        userId: null,
        authDate: new Date(),
        initDataHash: '',
        ipAddress,
        status: 'invalid_signature',
        errorMessage: error instanceof Error ? error.message : '签名验证失败',
      });
      throw error;
    }

    const { user: tgUser, auth_date, hash } = parsedData;
    const telegramId = BigInt(tgUser.id);

    // 查找现有用户
    let user = await this.prisma.client.users.findUnique({
      where: { telegram_id: telegramId },
      include: { wallets: true },
    });

    let isNewUser = false;

    if (!user) {
      // 创建新用户
      isNewUser = true;
      const inviteCode = this.generateInviteCode();

      user = await this.prisma.client.users.create({
        data: {
          email: `tg_${tgUser.id}@telegram.local`, // 临时邮箱，用户可后续绑定真实邮箱
          password_hash: '', // Telegram 用户无密码
          telegram_id: telegramId,
          telegram_username: tgUser.username || null,
          telegram_first_name: tgUser.first_name,
          telegram_photo_url: tgUser.photo_url || null,
          telegram_linked_at: new Date(),
          invite_code: inviteCode,
          role: 'user',
          status: 'active',
          last_login_at: new Date(),
          last_login_ip: ipAddress,
          wallets: {
            create: {
              usdt_balance: 0,
              usdt_frozen: 0,
              card_balance: 0,
              points_balance: 0,
              points_frozen: 0,
              points_locked: 0,
              token_balance: 0,
              token_locked: 0,
              token_vesting: 0,
            },
          },
        },
        include: { wallets: true },
      });

      this.logger.log(`新 Telegram 用户注册: ${user.id}, TG: @${tgUser.username || tgUser.id}`);
    } else {
      // 更新现有用户信息
      await this.prisma.client.users.update({
        where: { id: user.id },
        data: {
          telegram_username: tgUser.username || user.telegram_username,
          telegram_first_name: tgUser.first_name,
          telegram_photo_url: tgUser.photo_url || user.telegram_photo_url,
          last_login_at: new Date(),
          last_login_ip: ipAddress,
        },
      });
    }

    // 记录成功登录日志
    await this.logTelegramLogin({
      telegramId,
      userId: user.id,
      authDate: new Date(auth_date * 1000),
      initDataHash: hash,
      ipAddress,
      status: 'success',
    });

    // 生成 JWT Token
    const payload = {
      sub: user.id,
      email: user.email,
      vipLevel: user.vip_level,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '7d' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '30d' });

    return {
      accessToken,
      refreshToken,
      isNewUser,
      userId: user.id,
      email: user.email.includes('@telegram.local') ? undefined : user.email,
    };
  }

  /**
   * 绑定 Telegram 到现有账户
   */
  async linkTelegram(
    userId: string,
    initData: string,
    ipAddress?: string,
  ): Promise<TelegramLinkStatusDto> {
    // 验证签名
    const parsedData = this.verifyInitData(initData);
    const telegramId = BigInt(parsedData.user.id);

    // 检查该 Telegram 是否已被其他账户绑定
    const existingUser = await this.prisma.client.users.findUnique({
      where: { telegram_id: telegramId },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new ConflictException('该 Telegram 账户已绑定其他用户');
    }

    // 绑定
    const user = await this.prisma.client.users.update({
      where: { id: userId },
      data: {
        telegram_id: telegramId,
        telegram_username: parsedData.user.username || null,
        telegram_first_name: parsedData.user.first_name,
        telegram_photo_url: parsedData.user.photo_url || null,
        telegram_linked_at: new Date(),
      },
    });

    // 记录绑定日志
    await this.logTelegramLogin({
      telegramId,
      userId: user.id,
      authDate: new Date(parsedData.auth_date * 1000),
      initDataHash: parsedData.hash,
      ipAddress,
      status: 'success',
    });

    this.logger.log(`用户 ${userId} 绑定 Telegram: @${parsedData.user.username || parsedData.user.id}`);

    return {
      isLinked: true,
      telegramUsername: user.telegram_username || undefined,
      telegramFirstName: user.telegram_first_name || undefined,
      linkedAt: user.telegram_linked_at || undefined,
    };
  }

  /**
   * 解绑 Telegram
   */
  async unlinkTelegram(userId: string): Promise<TelegramLinkStatusDto> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 检查是否有其他登录方式
    if (user.email.includes('@telegram.local') && !user.password_hash) {
      throw new ConflictException('请先绑定邮箱后再解绑 Telegram');
    }

    await this.prisma.client.users.update({
      where: { id: userId },
      data: {
        telegram_id: null,
        telegram_username: null,
        telegram_first_name: null,
        telegram_photo_url: null,
        telegram_linked_at: null,
      },
    });

    this.logger.log(`用户 ${userId} 解绑 Telegram`);

    return {
      isLinked: false,
    };
  }

  /**
   * 获取绑定状态
   */
  async getLinkStatus(userId: string): Promise<TelegramLinkStatusDto> {
    const user = await this.prisma.client.users.findUnique({
      where: { id: userId },
      select: {
        telegram_id: true,
        telegram_username: true,
        telegram_first_name: true,
        telegram_linked_at: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return {
      isLinked: !!user.telegram_id,
      telegramUsername: user.telegram_username || undefined,
      telegramFirstName: user.telegram_first_name || undefined,
      linkedAt: user.telegram_linked_at || undefined,
    };
  }

  /**
   * 记录 Telegram 登录日志
   */
  private async logTelegramLogin(data: {
    telegramId: bigint;
    userId: string | null;
    authDate: Date;
    initDataHash: string;
    ipAddress?: string;
    status: string;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.prisma.client.telegram_login_logs.create({
        data: {
          telegram_id: data.telegramId,
          user_id: data.userId,
          auth_date: data.authDate,
          init_data_hash: data.initDataHash,
          ip_address: data.ipAddress || null,
          status: data.status,
          error_message: data.errorMessage || null,
        },
      });
    } catch (error) {
      this.logger.error('记录 Telegram 登录日志失败', error);
    }
  }

  /**
   * 生成唯一邀请码
   */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
