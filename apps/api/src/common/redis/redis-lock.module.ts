import { Global, Module } from '@nestjs/common';
import { RedisLockService } from './redis-lock.service';

/**
 * Redis 锁模块
 * 全局模块，可在任意位置注入 RedisLockService
 */
@Global()
@Module({
  providers: [RedisLockService],
  exports: [RedisLockService],
})
export class RedisLockModule {}
