import { registerAs } from '@nestjs/config';
import { IsNumber, IsString, validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';

/**
 * 数据库配置类（用于验证）
 */
class DatabaseConfigClass {
  @IsString()
  databaseUrl: string;

  @IsNumber()
  poolMin: number = 2;

  @IsNumber()
  poolMax: number = 10;
}

/**
 * 数据库配置
 */
export default registerAs('database', () => {
  const config = plainToClass(DatabaseConfigClass, {
    databaseUrl: process.env.DATABASE_URL,
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  });

  // 验证配置
  const errors = validateSync(config);
  if (errors.length > 0) {
    throw new Error(`数据库配置验证失败: ${errors.toString()}`);
  }

  // 验证 PostgreSQL URL 格式
  if (!config.databaseUrl.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL 必须是有效的 PostgreSQL 连接字符串，格式: postgresql://user:password@host:port/database');
  }

  return config;
});
