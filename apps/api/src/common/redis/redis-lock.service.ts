import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis 分布式锁服务
 * 用于防止并发执行导致的超额交易问题
 */
@Injectable()
export class RedisLockService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisLockService.name);
  private readonly redis: Redis;

  // 默认锁超时时间（秒）
  private readonly DEFAULT_LOCK_TTL = 60;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      keyPrefix: 'lock:',
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis 锁服务连接错误:', err.message);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis 锁服务已连接');
    });
  }

  onModuleDestroy() {
    this.redis.disconnect();
  }

  /**
   * 尝试获取锁
   * @param key 锁的键名
   * @param ttl 锁的超时时间（秒），默认 60 秒
   * @returns 是否获取成功
   */
  async acquireLock(key: string, ttl: number = this.DEFAULT_LOCK_TTL): Promise<boolean> {
    try {
      const result = await this.redis.set(key, '1', 'EX', ttl, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.error(`获取锁失败 [${key}]:`, error);
      return false;
    }
  }

  /**
   * 释放锁
   * @param key 锁的键名
   */
  async releaseLock(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`释放锁失败 [${key}]:`, error);
    }
  }

  /**
   * 获取交易锁
   * 锁的格式: trade_lock:{userId}:{apiKeyId}
   * @param userId 用户 ID
   * @param apiKeyId API Key ID
   * @param ttl 锁超时时间（秒）
   */
  async acquireTradeLock(
    userId: string,
    apiKeyId: string,
    ttl: number = this.DEFAULT_LOCK_TTL,
  ): Promise<boolean> {
    const key = `trade_lock:${userId}:${apiKeyId}`;
    return this.acquireLock(key, ttl);
  }

  /**
   * 释放交易锁
   */
  async releaseTradeLock(userId: string, apiKeyId: string): Promise<void> {
    const key = `trade_lock:${userId}:${apiKeyId}`;
    return this.releaseLock(key);
  }

  /**
   * 检查锁是否存在
   */
  async isLocked(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`检查锁状态失败 [${key}]:`, error);
      return false;
    }
  }
}
