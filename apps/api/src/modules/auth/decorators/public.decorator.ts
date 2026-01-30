import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../guards/jwt-auth.guard';

// 标记接口为公开，不需要认证
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
