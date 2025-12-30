import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 管理员权限守卫
 * 验证用户是否具有 admin 或 super_admin 角色
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // 从 JwtAuthGuard 获取的用户信息

    if (!user || !user.sub) {
      this.logger.warn('AdminGuard: 未找到用户信息');
      throw new ForbiddenException('需要管理员权限');
    }

    // 从数据库查询用户角色
    const dbUser = await this.prisma.client.users.findUnique({
      where: { id: user.sub },
      select: { role: true, status: true },
    });

    if (!dbUser) {
      this.logger.warn(`AdminGuard: 用户 ${user.sub} 不存在`);
      throw new ForbiddenException('用户不存在');
    }

    // 检查用户状态
    if (dbUser.status !== 'active') {
      this.logger.warn(`AdminGuard: 用户 ${user.sub} 状态异常: ${dbUser.status}`);
      throw new ForbiddenException('用户状态异常');
    }

    // 检查用户角色
    if (dbUser.role !== 'admin' && dbUser.role !== 'super_admin') {
      this.logger.warn(`AdminGuard: 用户 ${user.sub} 权限不足，角色为 ${dbUser.role}`);
      throw new ForbiddenException('需要管理员权限');
    }

    this.logger.log(`AdminGuard: 用户 ${user.sub} 通过权限验证 (role: ${dbUser.role})`);
    return true;
  }
}
