/**
 * 代理商权限守卫
 * 验证代理商 Token 并检查状态
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
export class AgentGuard implements CanActivate {
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
      console.log('[AgentGuard] verifying token...');
      const payload = this.jwtService.verify(token);
      console.log('[AgentGuard] payload:', JSON.stringify(payload));

      // 检查是否为代理商令牌
      if (payload.type !== 'agent') {
        throw new UnauthorizedException('无效的代理商令牌');
      }

      // 从数据库获取代理商信息
      const agent = await this.prisma.agent.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          status: true,
          isActive: true,
          level: true,
          commissionRate: true,
        },
      });

      if (!agent) {
        throw new UnauthorizedException('代理商不存在');
      }

      if (agent.status !== 'active' || !agent.isActive) {
        throw new UnauthorizedException('代理商账号已禁用');
      }

      // 将代理商信息挂载到请求对象
      request.agent = agent;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      console.error('[AgentGuard] JWT verify failed:', error.message);
      throw new UnauthorizedException('令牌无效或已过期');
    }
  }
}
