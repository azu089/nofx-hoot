import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  LoginResponse,
  UserResponse,
} from './dto/auth.dto';
import { BindTelegramDto } from './dto/telegram.dto';
import { JwtPayload } from './strategies/jwt.strategy';

// 绑定码缓存（实际项目应该用 Redis）
const bindCodeCache = new Map<string, { userId: string; expiresAt: Date }>();

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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

    return user;
  }

  // 登录
  async login(dto: LoginDto): Promise<LoginResponse> {
    // 查找用户
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
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
      email: user.email,
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
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return user;
  }

  // ===== Telegram 相关 =====

  // 生成 Telegram 绑定码
  async generateBindCode(userId: string): Promise<{ bindCode: string; expiresAt: Date }> {
    // 生成 6 位绑定码
    const bindCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟过期

    // 缓存绑定码
    bindCodeCache.set(bindCode, { userId, expiresAt });

    // 5分钟后自动清理
    setTimeout(() => {
      bindCodeCache.delete(bindCode);
    }, 5 * 60 * 1000);

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

    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      usdtBalance: user.usdtBalance.toString(),
      hootBalance: user.hootBalance.toString(),
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
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        telegramId: null,
        telegramUsername: null,
      },
    });
  }
}
