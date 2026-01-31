/**
 * Admin 装饰器
 * 获取当前登录的管理员信息
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Admin = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.admin;
  },
);
