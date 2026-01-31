/**
 * 管理员权限守卫
 * 验证 Admin Token 并检查权限
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 从 Header 获取 Token
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('未提供认证令牌');
    }

    const token = authHeader.substring(7);

    try {
      // 验证 Token
      const payload = this.jwtService.verify(token);

      // 检查是否为管理员令牌
      if (payload.type !== 'admin') {
        throw new UnauthorizedException('无效的管理员令牌');
      }

      // 从数据库获取管理员信息
      const admin = await this.prisma.admin.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
        },
      });

      if (!admin) {
        throw new UnauthorizedException('管理员不存在');
      }

      if (!admin.isActive) {
        throw new UnauthorizedException('管理员账号已禁用');
      }

      // 将管理员信息挂载到请求对象
      request.admin = admin;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('令牌无效或已过期');
    }
  }
}
