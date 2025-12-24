import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, UserResponseDto } from './dto/auth-response.dto';
import * as bcrypt from 'bcrypt';

/**
 * 认证服务
 * 处理用户认证相关业务逻辑
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 用户注册
   * 1. 检查邮箱是否已存在
   * 2. bcrypt 加密密码
   * 3. 创建用户记录
   * 4. 自动创建钱包记录
   * 5. 返回用户信息（不含密码）
   */
  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const { email, password, inviteCode } = dto;

    // 1. 检查邮箱是否已存在
    const existingUser = await this.prisma.client.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('邮箱已被注册');
    }

    // 2. 如果提供了邀请码，验证代理商是否存在
    let agentId: string | null = null;
    if (inviteCode) {
      const agent = await this.prisma.client.agents.findUnique({
        where: { code: inviteCode },
      });

      if (!agent) {
        throw new BadRequestException('邀请码无效');
      }

      if (agent.status !== 'active') {
        throw new BadRequestException('该代理商已被禁用');
      }

      agentId = agent.id;
    }

    // 3. bcrypt 加密密码
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

    // 4. 创建用户记录 + 自动创建钱包记录（使用事务）
    const user = await this.prisma.client.$transaction(async (tx) => {
      // 创建用户
      const newUser = await tx.users.create({
        data: {
          email,
          password_hash: passwordHash,
          agent_id: agentId,
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

    this.logger.log(`用户注册成功: ${user.id} (${email})`);

    return this.sanitizeUser(user);
  }

  /**
   * 用户登录
   * 1. 验证邮箱和密码
   * 2. 生成 JWT Token
   * 3. 更新最后登录时间
   * 4. 返回 { access_token, user }
   */
  async login(dto: LoginDto, ip?: string): Promise<AuthResponseDto> {
    const { email, password } = dto;

    // 1. 验证用户凭证
    const user = await this.validateUser(email, password);

    // 2. 检查用户状态
    if (user.status !== 'active') {
      throw new UnauthorizedException('账号已被禁用，请联系客服');
    }

    // 3. 生成 JWT Token
    const accessToken = this.generateToken(user);

    // 4. 更新最后登录时间和 IP
    await this.prisma.client.users.update({
      where: { id: user.id },
      data: {
        last_login_at: new Date(),
        last_login_ip: ip || null,
      },
    });

    this.logger.log(`用户登录成功: ${user.id} (${email})`);

    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
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
    };

    return this.jwtService.sign(payload);
  }

  /**
   * 脱敏用户信息（移除密码等敏感字段）
   * @param user 原始用户信息
   * @returns 脱敏后的用户信息
   */
  private sanitizeUser(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      vipLevel: user.vip_level,
      agentId: user.agent_id,
      inviteCode: user.invite_code,
      status: user.status,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };
  }
}
