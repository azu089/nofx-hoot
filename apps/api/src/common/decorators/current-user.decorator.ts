import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../../modules/auth/dto/jwt-payload.dto';

/**
 * CurrentUser 装饰器
 * 从请求中提取当前已认证的用户信息
 *
 * 使用方式：
 * @Get('me')
 * @UseGuards(JwtAuthGuard)
 * getMe(@CurrentUser() user: JwtPayload) {
 *   return user;
 * }
 *
 * 也可以提取特定字段：
 * @Get('profile')
 * @UseGuards(JwtAuthGuard)
 * getProfile(@CurrentUser('sub') userId: string) {
 *   return { userId };
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    // 如果指定了字段名，返回该字段
    if (data) {
      return user?.[data];
    }

    // 否则返回完整的用户对象
    return user;
  },
);
