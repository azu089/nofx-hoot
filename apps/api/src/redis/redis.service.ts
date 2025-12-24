import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis 服务
 *
 * 功能：
 * 1. 封装 Redis 连接
 * 2. 提供基础操作方法
 * 3. 健康检查
 * 4. 优雅关闭
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('redis.host');
    const port = this.configService.get<number>('redis.port');
    const password = this.configService.get<string>('redis.password');
    const db = this.configService.get<number>('redis.db');

    this.logger.log(`连接 Redis: ${host}:${port} DB${db}`);

    this.client = new Redis({
      host,
      port,
      password,
      db,
      retryStrategy: (times) => {
        // 最多重试 3 次，每次延迟递增
        if (times > 3) {
          this.logger.error('Redis 连接重试次数超限，放弃连接');
          return null; // 停止重试
        }
        const delay = Math.min(times * 1000, 3000);
        this.logger.warn(`Redis 连接失败，${delay}ms 后重试 (${times}/3)`);
        return delay;
      },
      lazyConnect: false, // 立即连接
      enableReadyCheck: true, // 启用就绪检查
      maxRetriesPerRequest: 3, // 每个请求最多重试 3 次
    });

    // 监听连接事件
    this.client.on('connect', () => {
      this.logger.log('Redis 连接成功');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis 已就绪');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis 错误:', error.message);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis 连接关闭');
    });

    this.client.on('reconnecting', () => {
      this.logger.log('Redis 正在重新连接...');
    });

    // 等待连接就绪
    try {
      await this.client.ping();
      this.logger.log('Redis PING 成功');
    } catch (error) {
      this.logger.error('Redis PING 失败:', error.message);
      // 不抛出错误，让应用继续启动（降级模式）
    }
  }

  async onModuleDestroy() {
    this.logger.log('关闭 Redis 连接');
    await this.client.quit();
  }

  /**
   * 获取 Redis 客户端（供其他模块使用）
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * 健康检查
   * @returns { status: 'up' | 'down', responseTime: number }
   */
  async healthCheck(): Promise<{ status: 'up' | 'down'; responseTime: number }> {
    const startTime = Date.now();

    try {
      const result = await this.client.ping();
      const responseTime = Date.now() - startTime;

      if (result === 'PONG') {
        return { status: 'up', responseTime };
      } else {
        this.logger.error('Redis PING 返回非预期响应:', result);
        return { status: 'down', responseTime };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.logger.error('Redis 健康检查失败:', error.message);
      return { status: 'down', responseTime };
    }
  }

  // -------------------- 基础操作方法（按需扩展） --------------------

  /**
   * 设置键值（带过期时间）
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * 获取键值
   */
  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  /**
   * 删除键
   */
  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  /**
   * 检查键是否存在
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * 设置过期时间
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    const result = await this.client.expire(key, seconds);
    return result === 1;
  }

  /**
   * 获取剩余过期时间
   */
  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }
}
