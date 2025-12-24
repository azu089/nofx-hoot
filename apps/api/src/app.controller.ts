import { Controller, Get, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('health')
  async healthCheck() {
    // 健康检查结果
    const checks: {
      database: { status: 'up' | 'down'; responseTime: number };
      redis: { status: 'up' | 'down'; responseTime: number };
    } = {
      database: { status: 'down', responseTime: 0 },
      redis: { status: 'down', responseTime: 0 },
    };

    // 测试数据库连接
    const dbStartTime = Date.now();
    try {
      // 使用原生 SQL 测试连接
      await this.prisma.client.$queryRaw`SELECT 1 as test`;
      checks.database.status = 'up';
      checks.database.responseTime = Date.now() - dbStartTime;
    } catch (error) {
      this.logger.error('数据库连接测试失败:', error);
      checks.database.status = 'down';
      checks.database.responseTime = Date.now() - dbStartTime;
    }

    // 测试 Redis 连接
    try {
      const redisCheck = await this.redis.healthCheck();
      checks.redis = redisCheck;
    } catch (error) {
      this.logger.error('Redis 连接测试失败:', error);
      checks.redis.status = 'down';
    }

    // 判断整体健康状态
    let overallStatus = 'healthy';
    if (checks.database.status === 'down' || checks.redis.status === 'down') {
      overallStatus = 'degraded';
    }

    return {
      code: 0,
      message: 'success',
      data: {
        status: overallStatus,
        service: 'quantfi-api',
        version: '0.1.0',
        checks,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('db/stats')
  async getDatabaseStats() {
    try {
      // 查询用户表数量
      const userCount = await this.prisma.client.users.count();

      // 查询钱包表数量
      const walletCount = await this.prisma.client.wallets.count();

      // 查询策略表数量
      const strategyCount = await this.prisma.client.strategies.count();

      return {
        code: 0,
        message: 'success',
        data: {
          users: userCount,
          wallets: walletCount,
          strategies: strategyCount,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('数据库查询失败:', error);
      return {
        code: 50001,
        message: '数据库查询失败',
        data: null,
        error: error.message || String(error),
      };
    }
  }
}
