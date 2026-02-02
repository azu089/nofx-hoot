/**
 * 敏感操作需要 TOTP 验证的装饰器
 * 用于标记需要二次确认的敏感操作
 */
import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  Injectable,
  CanActivate,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminAuthService } from '../admin-auth.service';

// 元数据 key
export const REQUIRE_TOTP_KEY = 'requireTotp';

/**
 * 标记需要 TOTP 验证的路由
 * @example @RequireTotp()
 */
export const RequireTotp = () => SetMetadata(REQUIRE_TOTP_KEY, true);

/**
 * 敏感操作守卫
 * 检查是否需要 TOTP 验证，如果管理员启用了 TOTP 则必须验证
 */
@Injectable()
export class TotpGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private adminAuthService: AdminAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查路由是否标记了 @RequireTotp()
    const requireTotp = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_TOTP_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requireTotp) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const admin = request.admin;

    if (!admin) {
      throw new BadRequestException('需要管理员身份');
    }

    // 获取管理员详情
    const adminDetail = await this.adminAuthService.getMe(admin.id);

    // 如果管理员启用了 TOTP，必须验证
    if (adminDetail.totpEnabled) {
      const totpCode = request.body?.totpCode;

      if (!totpCode) {
        throw new BadRequestException('此操作需要两步验证码');
      }

      const isValid = await this.adminAuthService.verifyTotpForOperation(
        admin.id,
        totpCode,
      );

      if (!isValid) {
        throw new BadRequestException('两步验证码错误');
      }
    }

    return true;
  }
}

/**
 * 敏感操作列表（用于前端展示）
 */
export const SENSITIVE_OPERATIONS = [
  { action: 'approve_withdraw', name: '审批提现', module: 'finance' },
  { action: 'reject_withdraw', name: '拒绝提现', module: 'finance' },
  { action: 'adjust_balance', name: '调整用户余额', module: 'finance' },
  { action: 'create_admin', name: '创建管理员', module: 'admin' },
  { action: 'delete_user', name: '删除用户', module: 'user' },
  { action: 'suspend_trading', name: '暂停交易', module: 'system' },
  { action: 'update_config', name: '修改系统配置', module: 'system' },
];
