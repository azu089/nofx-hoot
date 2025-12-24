import { SetMetadata } from '@nestjs/common';

/**
 * Public 装饰器的元数据 Key
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Public 装饰器
 * 标记公开接口，跳过 JWT 认证
 *
 * 使用方式：
 * @Public()
 * @Post('login')
 * login(@Body() dto: LoginDto) {
 *   return this.authService.login(dto);
 * }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
