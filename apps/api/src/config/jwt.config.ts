import { registerAs } from '@nestjs/config';
import { IsString, MinLength, validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';

/**
 * JWT 配置类（用于验证）
 */
class JwtConfigClass {
  @IsString()
  @MinLength(32, { message: 'JWT_SECRET 必须至少 32 位，生产环境请使用强密钥' })
  secret: string;

  @IsString()
  expiresIn: string = '7d';

  @IsString()
  refreshExpiresIn: string = '30d';
}

/**
 * JWT 配置
 */
export default registerAs('jwt', () => {
  const config = plainToClass(JwtConfigClass, {
    secret: process.env.JWT_SECRET || 'default-dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });

  // 验证配置
  const errors = validateSync(config);
  if (errors.length > 0) {
    throw new Error(`JWT 配置验证失败: ${errors.toString()}`);
  }

  // 生产环境额外检查
  if (process.env.NODE_ENV === 'production') {
    if (config.secret.includes('default') || config.secret.includes('change')) {
      throw new Error('生产环境禁止使用默认 JWT_SECRET，请设置强密钥');
    }
  }

  return config;
});
