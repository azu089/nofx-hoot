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
 *
 * 代理商（is_agent=true）也可以登录管理后台，但：
 * - 只能查看自己伞下的用户
 * - 只有只读权限（GET 请求）
 * - 在 request 中标记 isAgent=true 和 agentId
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
      select: { role: true, status: true, email: true },
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

    // 管理员角色：完全权限
    if (dbUser.role === 'admin' || dbUser.role === 'super_admin') {
      request.isAdmin = true;
      request.isAgent = false;
      this.logger.log(`AdminGuard: 管理员 ${user.sub} 通过权限验证 (role: ${dbUser.role})`);
      return true;
    }

    // 检查是否是代理商（通过 agents 表匹配 email）
    const agent = await this.prisma.client.agents.findUnique({
      where: { email: dbUser.email },
      select: { id: true, status: true },
    });

    if (agent && agent.status === 'active') {
      // 检查是否是 GET 请求（只读）
      const method = request.method;
      if (method !== 'GET') {
        this.logger.warn(`AdminGuard: 代理商 ${user.sub} 尝试执行非只读操作 (${method})`);
        throw new ForbiddenException('代理商只有只读权限');
      }

      request.isAdmin = false;
      request.isAgent = true;
      request.agentId = agent.id; // 使用 agent 表的 ID
      request.userId = user.sub;
      this.logger.log(`AdminGuard: 代理商 ${user.sub} 通过权限验证（只读模式）`);
      return true;
    }

    // 其他用户：无权限
    this.logger.warn(`AdminGuard: 用户 ${user.sub} 权限不足，角色为 ${dbUser.role}`);
    throw new ForbiddenException('需要管理员权限');
  }
}
