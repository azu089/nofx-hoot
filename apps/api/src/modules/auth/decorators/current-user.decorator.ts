import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// 获取当前登录用户
// 使用方式:
// - @CurrentUser() user - 获取整个用户对象
// - @CurrentUser('id') userId - 获取用户的特定字段
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // 如果指定了字段名，返回该字段；否则返回整个用户对象
    return data ? user?.[data] : user;
  },
);
