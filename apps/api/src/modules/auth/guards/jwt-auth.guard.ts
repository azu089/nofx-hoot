import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

export const IS_PUBLIC_KEY = 'isPublic';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否标记为公开接口
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // 公开路由：尝试验证 JWT（可选认证）
      // 如果有有效的 token，设置 request.user；如果没有或无效，继续执行
      const request = context.switchToHttp().getRequest();
      const authHeader = request.headers.authorization;

      if (authHeader?.startsWith('Bearer ')) {
        try {
          // 调用父类验证，成功后 request.user 会被设置
          await super.canActivate(context);
        } catch {
          // 验证失败时忽略错误，保持 request.user = undefined
        }
      }

      return true;
    }

    return super.canActivate(context) as Promise<boolean>;
  }
}
