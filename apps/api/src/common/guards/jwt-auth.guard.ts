import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT 认证守卫
 * 继承自 Passport 的 AuthGuard
 * 负责保护需要认证的路由
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * 判断是否可以激活路由
   * 1. 检查是否标记为 @Public()
   * 2. 如果不是公开路由，调用父类的认证逻辑
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否为公开路由
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.debug('公开路由，跳过 JWT 认证');
      return true;
    }

    // 调用父类的 JWT 验证逻辑
    return super.canActivate(context) as Promise<boolean>;
  }

  /**
   * 处理认证失败
   * 返回友好的错误信息
   */
  handleRequest(err: any, user: any, info: any) {
    // 如果有错误或没有用户信息，抛出未授权异常
    if (err || !user) {
      this.logger.warn('JWT 认证失败', { error: err?.message, info: info?.message });

      // 根据不同错误类型返回友好提示
      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token 已过期，请重新登录');
      }

      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Token 无效');
      }

      if (info?.message === 'No auth token') {
        throw new UnauthorizedException('缺少认证 Token');
      }

      throw err || new UnauthorizedException('认证失败');
    }

    return user;
  }
}
