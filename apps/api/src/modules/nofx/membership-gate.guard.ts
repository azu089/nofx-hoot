import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * MembershipGateGuard —— 只有活跃订阅用户才能执行写操作。
 *
 * 复用 HOOT 现有 `membershipStatus === 'active' && membershipExpireAt > now()`
 * 逻辑（与 ai.controller.ts 和 fee.service.ts 一致），统一到可声明式复用的 Guard。
 *
 * 放在 nofx 写接口（create/start/stop/delete trader）上，让非付费用户只能浏览。
 * 读接口不挂此 guard（所有用户都能看数据）。
 *
 * 需配合 JwtAuthGuard（全局 APP_GUARD 已自动生效），从 request.user.id 取 userId。
 */
@Injectable()
export class MembershipGateGuard implements CanActivate {
  private readonly logger = new Logger(MembershipGateGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: { id?: string } }>();
    const userId = req.user?.id;
    if (!userId) return false; // 不应走到这（JwtAuthGuard 先跑），但 fail-safe

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { membershipStatus: true, membershipExpireAt: true },
    });

    const isPro =
      user?.membershipStatus === 'active' &&
      user.membershipExpireAt != null &&
      user.membershipExpireAt > new Date();

    if (!isPro) {
      this.logger.log(
        `[nofx] membership gate blocked user=${userId} status=${user?.membershipStatus ?? 'null'}`,
      );
      throw new ForbiddenException(
        '此操作需要有效订阅。请先订阅 Pro 计划或续费。',
      );
    }
    return true;
  }
}
