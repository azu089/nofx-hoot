/**
 * 管理员认证服务
 */
import {
  Injectable,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminLoginDto, CreateAdminDto } from './dto/auth.dto';

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * 管理员登录
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

    // 检查账号状态
    if (!admin.isActive) {
      this.logger.warn(`登录失败: 账号已禁用 ${dto.username}`);
      throw new UnauthorizedException('账号已被禁用');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(dto.password, admin.password);
    if (!isPasswordValid) {
      this.logger.warn(`登录失败: 密码错误 ${dto.username}`);
      throw new UnauthorizedException('用户名或密码错误');
    }

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
    await this.logOperation(admin.id, 'login', 'admin', admin.id, 'admin', '管理员登录', ip, userAgent);

    this.logger.log(`管理员登录成功: ${admin.username}`);

    return {
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        nickname: admin.nickname || admin.username,
        role: admin.role,
      },
    };
  }

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
  async changePassword(adminId: string, oldPassword: string, newPassword: string) {
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

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.admin.update({
      where: { id: adminId },
      data: { password: hashedPassword },
    });

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
    await this.logOperation(creatorId, 'create', 'admin', admin.id, 'admin', `创建管理员 ${admin.username}`);

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
          lastLoginAt: true,
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
    }
  }
}
