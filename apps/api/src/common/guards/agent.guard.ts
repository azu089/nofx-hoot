import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 代理商权限守卫
 * 验证用户是否具有 agent 角色
 * 代理商只能查看自己伞下的用户，且只有只读权限
 */
@Injectable()
export class AgentGuard implements CanActivate {
  private readonly logger = new Logger(AgentGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      this.logger.warn('AgentGuard: 未找到用户信息');
      throw new ForbiddenException('需要代理商权限');
    }

    // 从数据库查询用户角色
    const dbUser = await this.prisma.client.users.findUnique({
      where: { id: user.sub },
      select: { role: true, status: true, email: true },
    });

    if (!dbUser) {
      this.logger.warn(`AgentGuard: 用户 ${user.sub} 不存在`);
      throw new ForbiddenException('用户不存在');
    }

    // 检查用户状态
    if (dbUser.status !== 'active') {
      this.logger.warn(`AgentGuard: 用户 ${user.sub} 状态异常: ${dbUser.status}`);
      throw new ForbiddenException('用户状态异常');
    }

    // 管理员也可以通过代理商 Guard
    if (dbUser.role === 'admin' || dbUser.role === 'super_admin') {
      request.isAdmin = true;
      request.isAgent = false;
      return true;
    }

    // 检查是否是代理商（通过 agents 表匹配 email）
    const agent = await this.prisma.client.agents.findUnique({
      where: { email: dbUser.email },
      select: { id: true, status: true },
    });

    if (!agent || agent.status !== 'active') {
      this.logger.warn(`AgentGuard: 用户 ${user.sub} 不是代理商`);
      throw new ForbiddenException('需要代理商权限');
    }

    // 标记为代理商（用于后续筛选数据）
    request.isAgent = true;
    request.isAdmin = false;
    request.agentId = agent.id; // 使用 agent 表的 ID
    request.userId = user.sub;

    this.logger.log(`AgentGuard: 代理商 ${user.sub} 通过权限验证`);
    return true;
  }
}

/**
 * 只读权限装饰器
 * 用于标记只允许 GET 请求的接口
 */
export const READONLY_KEY = 'isReadonly';
export const Readonly = () => (target: any, key: string, descriptor: PropertyDescriptor) => {
  Reflect.defineMetadata(READONLY_KEY, true, descriptor.value);
  return descriptor;
};
