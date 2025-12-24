import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import jwtConfig from './jwt.config';
import encryptionConfig from './encryption.config';

/**
 * 配置模块
 *
 * 功能：
 * 1. 加载 .env 文件
 * 2. 注册所有配置（app/database/redis/jwt/encryption）
 * 3. 验证配置完整性
 * 4. 全局可用
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true, // 全局可用，无需在其他模块重复导入
      cache: true, // 缓存配置，提高性能
      envFilePath: ['.env.local', '.env'], // 支持多个 .env 文件
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        jwtConfig,
        encryptionConfig,
      ],
    }),
  ],
})
export class ConfigModule {}
