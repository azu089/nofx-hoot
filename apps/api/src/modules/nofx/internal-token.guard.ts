import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Public } from '../auth/decorators/public.decorator';

/**
 * InternalTokenGuard —— 防御 nofx → HOOT webhook 入口的服务级共享密钥校验。
 *
 * 与全局 JwtAuthGuard 的关系：
 * - JwtAuthGuard 是 APP_GUARD（apps/api/src/app.module.ts），按 IS_PUBLIC_KEY 跳过
 * - 受本 guard 保护的控制器必须先用 @Public() 让 JwtAuthGuard 放行，
 *   再由本 guard 用 X-Internal-Token 做服务级验证
 *
 * 时序攻击防御：用 crypto.timingSafeEqual 比对，长度先校验。
 */
@Injectable()
export class InternalTokenGuard implements CanActivate {
  private readonly logger = new Logger(InternalTokenGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.NOFX_INTERNAL_TOKEN ?? '';
    if (!expected) {
      this.logger.error('[nofx-events] NOFX_INTERNAL_TOKEN not configured — refusing all webhook traffic');
      return false;
    }
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const raw = req.headers['x-internal-token'];
    const provided = Array.isArray(raw) ? raw[0] : raw ?? '';
    if (!provided) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}

// Re-export to keep all internal-auth bits in one import for the controller.
export { Public };
