import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Redis 模块（全局模块）
 *
 * 功能：
 * 1. 提供 RedisService（全局可用）
 * 2. 供其他模块注入使用
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
