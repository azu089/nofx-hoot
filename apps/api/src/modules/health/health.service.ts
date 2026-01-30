import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import Redis from 'ioredis';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  version: string;
  uptime: number;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
  };
}

export interface ServiceHealth {
  status: 'up' | 'down';
  latency?: number;
  error?: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();
  private redis: Redis;

  constructor(private prisma: PrismaService) {
    // 初始化 Redis 连接用于健康检查
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      lazyConnect: true,
    });
  }

  // 完整健康检查
  async check(): Promise<HealthStatus> {
    const [dbHealth, redisHealth] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const allHealthy = dbHealth.status === 'up' && redisHealth.status === 'up';
    const anyDown = dbHealth.status === 'down' || redisHealth.status === 'down';

    return {
      status: allHealthy ? 'healthy' : anyDown ? 'unhealthy' : 'degraded',
      timestamp: new Date(),
      version: process.env.APP_VERSION || '1.0.0',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      services: {
        database: dbHealth,
        redis: redisHealth,
      },
    };
  }

  // 简单存活检查（用于 k8s liveness probe）
  async liveness(): Promise<{ status: string }> {
    return { status: 'ok' };
  }

  // 就绪检查（用于 k8s readiness probe）
  async readiness(): Promise<{ status: string; ready: boolean }> {
    try {
      const health = await this.check();
      const ready = health.status !== 'unhealthy';
      return { status: ready ? 'ok' : 'not_ready', ready };
    } catch {
      return { status: 'not_ready', ready: false };
    }
  }

  // 数据库健康检查
  private async checkDatabase(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'up',
        latency: Date.now() - start,
      };
    } catch (error) {
      this.logger.error(`数据库健康检查失败: ${error.message}`);
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  // Redis 健康检查
  private async checkRedis(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      await this.redis.ping();
      return {
        status: 'up',
        latency: Date.now() - start,
      };
    } catch (error) {
      this.logger.error(`Redis 健康检查失败: ${error.message}`);
      return {
        status: 'down',
        error: error.message,
      };
    }
  }

  // 获取系统指标
  async getMetrics(): Promise<{
    memory: NodeJS.MemoryUsage;
    uptime: number;
    cpuUsage: NodeJS.CpuUsage;
    activeConnections: number;
  }> {
    return {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage(),
      activeConnections: 0, // TODO: 从 WebSocket 获取
    };
  }

  // 获取业务统计
  async getStats(): Promise<{
    users: { total: number; active: number };
    strategies: { total: number; active: number };
    positions: { open: number; total: number };
    signals: { today: number; total: number };
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      totalStrategies,
      activeStrategies,
      openPositions,
      totalPositions,
      todaySignals,
      totalSignals,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: {
          updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.strategy.count(),
      this.prisma.strategy.count({ where: { isActive: true } }),
      this.prisma.position.count({ where: { status: 'open' } }),
      this.prisma.position.count(),
      this.prisma.signal.count({ where: { createdAt: { gte: today } } }),
      this.prisma.signal.count(),
    ]);

    return {
      users: { total: totalUsers, active: activeUsers },
      strategies: { total: totalStrategies, active: activeStrategies },
      positions: { open: openPositions, total: totalPositions },
      signals: { today: todaySignals, total: totalSignals },
    };
  }
}
