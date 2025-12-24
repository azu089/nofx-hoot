import { registerAs } from '@nestjs/config';
import { IsNumber, IsString, validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';

/**
 * Redis 配置类（用于验证）
 */
class RedisConfigClass {
  @IsString()
  host: string = 'localhost';

  @IsNumber()
  port: number = 6379;

  @IsString()
  password: string;

  @IsNumber()
  db: number = 0;
}

/**
 * Redis 配置
 */
export default registerAs('redis', () => {
  const config = plainToClass(RedisConfigClass, {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  });

  // 验证配置
  const errors = validateSync(config);
  if (errors.length > 0) {
    throw new Error(`Redis 配置验证失败: ${errors.toString()}`);
  }

  return config;
});
