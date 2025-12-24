import { registerAs } from '@nestjs/config';
import { IsEnum, IsNumber, IsString, validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';

/**
 * 环境枚举
 */
export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * 应用配置类（用于验证）
 */
class AppConfigClass {
  @IsEnum(Environment)
  nodeEnv: Environment = Environment.Development;

  @IsNumber()
  port: number = 4001;

  @IsString()
  corsOrigin: string = 'http://localhost:3001';

  @IsString()
  logLevel: string = 'debug';

  @IsString()
  logFilePath: string = './logs';

  @IsNumber()
  rateLimitTtl: number = 60;

  @IsNumber()
  rateLimitMax: number = 100;
}

/**
 * 应用配置
 */
export default registerAs('app', () => {
  const config = plainToClass(AppConfigClass, {
    nodeEnv: process.env.NODE_ENV || Environment.Development,
    port: parseInt(process.env.PORT || '4001', 10),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    logLevel: process.env.LOG_LEVEL || 'debug',
    logFilePath: process.env.LOG_FILE_PATH || './logs',
    rateLimitTtl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  });

  // 验证配置
  const errors = validateSync(config);
  if (errors.length > 0) {
    throw new Error(`应用配置验证失败: ${errors.toString()}`);
  }

  return config;
});
