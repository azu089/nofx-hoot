import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TradingGateway } from '../../gateways/trading.gateway';
import Redis from 'ioredis';

/**
 * Freqtrade 健康状态
 */
export interface FreqtradeHealth {
  strategyId: string;
  strategyName: string;
  freqtradeId: string;
  isOnline: boolean;
  lastPingAt?: Date;
  lastProcessAt?: Date;
  lastSignalAt?: Date;
  minutesSinceLastSignal?: number;
  openTradeCount: number;
  todaySignals: number;
  status: 'healthy' | 'degraded' | 'warning' | 'offline';
  message: string;
}

/**
 * Freqtrade 实例配置
 */
interface FreqtradeInstance {
  name: string;       // Freqtrade 策略名（对应 strategy.freqtradeId）
  url: string;        // 实例 URL
  strategyId?: string; // 关联的 Strategy ID
}

/**
 * FreqtradeHealthService
 * 定期轮询 Freqtrade REST API 监控策略运行状态
 *
 * 功能：
 * 1. 每 60 秒轮询 /api/v1/ping + /api/v1/health
 * 2. 缓存健康状态到 Redis
 * 3. 检测无信号异常
 */
@Injectable()
export class FreqtradeHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FreqtradeHealthService.name);
  private redis: Redis;
  private pollInterval: NodeJS.Timeout | null = null;
  private instances: FreqtradeInstance[] = [];
  // 缓存 JWT token，{instanceUrl: token}
  private tokens: Map<string, string> = new Map();

  // 上一次健康状态，用于检测变化
  private previousStatus: Map<string, FreqtradeHealth['status']> = new Map();

  private readonly POLL_INTERVAL_MS = 60_000;  // 60 秒
  private readonly REDIS_KEY_PREFIX = 'freqtrade:health:';
  private readonly REDIS_TTL = 300; // 5 分钟过期

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TradingGateway))
    private tradingGateway: TradingGateway,
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    });
  }

  async onModuleInit() {
    await this.loadInstances();
    if (this.instances.length > 0) {
      this.startPolling();
      this.logger.log(`Freqtrade 健康监控已启动，监控 ${this.instances.length} 个实例`);
    } else {
      this.logger.warn('未配置 Freqtrade 实例，健康监控未启动');
    }
  }

  onModuleDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.redis.disconnect();
  }

  /**
   * 加载 Freqtrade 实例配置
   * 从环境变量 FREQTRADE_INSTANCES 读取，格式: name:url,name:url
   * 示例: HootTestStrategy:http://freqtrade-test:8090,HootOwlV1Strategy:http://freqtrade-owl:8091
   */
  private async loadInstances() {
    const instancesEnv = process.env.FREQTRADE_INSTANCES || '';
    if (!instancesEnv) {
      // 回退：使用单实例配置
      const url = process.env.FREQTRADE_API_URL;
      if (url) {
        this.instances = [{ name: 'default', url }];
      }
      return;
    }

    this.instances = instancesEnv.split(',').map((entry) => {
      const [name, url] = entry.trim().split(':http');
      return { name, url: `http${url}` };
    });

    // 关联 Strategy ID
    for (const instance of this.instances) {
      const strategy = await this.prisma.strategy.findFirst({
        where: { freqtradeId: instance.name },
        select: { id: true },
      });
      if (strategy) {
        instance.strategyId = strategy.id;
      }
    }
  }

  /**
   * 开始定时轮询
   */
  private startPolling() {
    // 立即执行一次
    this.pollAll();
    // 定时轮询
    this.pollInterval = setInterval(() => this.pollAll(), this.POLL_INTERVAL_MS);
  }

  /**
   * 轮询所有实例
   */
  private async pollAll() {
    for (const instance of this.instances) {
      try {
        await this.pollInstance(instance);
      } catch (error) {
        this.logger.error(`轮询 ${instance.name} 失败: ${(error as Error).message}`);
        await this.cacheHealth(instance.name, {
          strategyId: instance.strategyId || '',
          strategyName: instance.name,
          freqtradeId: instance.name,
          isOnline: false,
          openTradeCount: 0,
          todaySignals: 0,
          status: 'offline',
          message: `Freqtrade 实例不可达: ${(error as Error).message}`,
        });
      }
    }
  }

  /**
   * 轮询单个 Freqtrade 实例
   */
  private async pollInstance(instance: FreqtradeInstance) {
    const token = await this.getToken(instance.url);
    if (!token) {
      await this.cacheHealth(instance.name, {
        strategyId: instance.strategyId || '',
        strategyName: instance.name,
        freqtradeId: instance.name,
        isOnline: false,
        openTradeCount: 0,
        todaySignals: 0,
        status: 'offline',
        message: '无法获取 Freqtrade JWT Token',
      });
      return;
    }

    // 并行请求 ping + health + status
    const [pingResult, healthResult, statusResult] = await Promise.allSettled([
      this.ftApiGet(instance.url, '/api/v1/ping', token),
      this.ftApiGet(instance.url, '/api/v1/health', token),
      this.ftApiGet(instance.url, '/api/v1/status', token),
    ]);

    const isOnline = pingResult.status === 'fulfilled';
    const healthData = healthResult.status === 'fulfilled' ? healthResult.value : null;
    const statusData = statusResult.status === 'fulfilled' ? statusResult.value : [];

    // 获取最后信号时间（从数据库）
    const lastSignal = instance.strategyId
      ? await this.prisma.signal.findFirst({
          where: { strategyId: instance.strategyId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        })
      : null;

    // 今日信号数
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todaySignals = instance.strategyId
      ? await this.prisma.signal.count({
          where: {
            strategyId: instance.strategyId,
            createdAt: { gte: todayStart },
          },
        })
      : 0;

    // 计算距离最后信号的分钟数
    const minutesSinceLastSignal = lastSignal
      ? (Date.now() - lastSignal.createdAt.getTime()) / 60_000
      : undefined;

    // Freqtrade health 返回 last_process 时间
    const lastProcessAt = healthData?.last_process
      ? new Date(healthData.last_process)
      : undefined;

    // 判断健康状态
    let status: FreqtradeHealth['status'] = 'healthy';
    let message = '策略运行正常';

    if (!isOnline) {
      status = 'offline';
      message = 'Freqtrade 服务离线';
    } else if (minutesSinceLastSignal != null && minutesSinceLastSignal > 1440) {
      // 超过 24 小时无信号
      status = 'warning';
      message = `超过 ${Math.floor(minutesSinceLastSignal / 60)} 小时无新信号`;
    } else if (minutesSinceLastSignal != null && minutesSinceLastSignal > 120) {
      // 超过 2 小时无信号
      status = 'degraded';
      message = `${Math.floor(minutesSinceLastSignal)} 分钟无新信号`;
    }

    const health: FreqtradeHealth = {
      strategyId: instance.strategyId || '',
      strategyName: instance.name,
      freqtradeId: instance.name,
      isOnline,
      lastPingAt: isOnline ? new Date() : undefined,
      lastProcessAt,
      lastSignalAt: lastSignal?.createdAt,
      minutesSinceLastSignal: minutesSinceLastSignal != null
        ? Math.floor(minutesSinceLastSignal)
        : undefined,
      openTradeCount: Array.isArray(statusData) ? statusData.length : 0,
      todaySignals,
      status,
      message,
    };

    await this.cacheHealth(instance.name, health);
  }

  /**
   * 获取 Freqtrade JWT Token
   */
  private async getToken(baseUrl: string): Promise<string | null> {
    // 检查缓存
    const cached = this.tokens.get(baseUrl);
    if (cached) return cached;

    const username = process.env.FREQTRADE_USERNAME || 'hoot';
    const password = process.env.FREQTRADE_PASSWORD || 'hoot123';

    try {
      const response = await fetch(`${baseUrl}/api/v1/token/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        this.logger.warn(`Freqtrade ${baseUrl} 登录失败: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const token = data.access_token;
      if (token) {
        this.tokens.set(baseUrl, token);
        // Token 15 分钟后过期，提前清理
        setTimeout(() => this.tokens.delete(baseUrl), 14 * 60 * 1000);
      }
      return token;
    } catch (error) {
      this.logger.warn(`Freqtrade ${baseUrl} 登录异常: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * 调用 Freqtrade REST API
   */
  private async ftApiGet(baseUrl: string, path: string, token: string): Promise<any> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 401) {
      // Token 过期，清除缓存
      this.tokens.delete(baseUrl);
      throw new Error('Token expired');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * 缓存健康状态到 Redis，并检测状态变化推送 WebSocket
   */
  private async cacheHealth(instanceName: string, health: FreqtradeHealth): Promise<void> {
    try {
      await this.redis.set(
        `${this.REDIS_KEY_PREFIX}${instanceName}`,
        JSON.stringify(health),
        'EX',
        this.REDIS_TTL,
      );
    } catch (e) {
      this.logger.warn(`缓存健康状态失败: ${(e as Error).message}`);
    }

    // 检测状态变化，推送 WebSocket 通知
    const prevStatus = this.previousStatus.get(instanceName);
    if (prevStatus && prevStatus !== health.status) {
      this.logger.log(
        `策略 ${instanceName} 状态变化: ${prevStatus} → ${health.status}`,
      );
      // 广播给所有在线用户
      try {
        this.tradingGateway.broadcastStrategyHealth({
          strategyId: health.strategyId,
          strategyName: health.strategyName,
          status: health.status,
          message: health.message,
          lastSignalAt: health.lastSignalAt,
        });
      } catch (e) {
        this.logger.warn(`WebSocket 推送策略健康状态失败: ${(e as Error).message}`);
      }
    }
    this.previousStatus.set(instanceName, health.status);
  }

  /**
   * 获取所有策略的健康状态（供 API 调用）
   */
  async getAllHealth(): Promise<FreqtradeHealth[]> {
    const results: FreqtradeHealth[] = [];

    for (const instance of this.instances) {
      try {
        const cached = await this.redis.get(`${this.REDIS_KEY_PREFIX}${instance.name}`);
        if (cached) {
          results.push(JSON.parse(cached));
        } else {
          // 缓存过期，返回未知状态
          results.push({
            strategyId: instance.strategyId || '',
            strategyName: instance.name,
            freqtradeId: instance.name,
            isOnline: false,
            openTradeCount: 0,
            todaySignals: 0,
            status: 'offline',
            message: '健康数据不可用',
          });
        }
      } catch (e) {
        this.logger.warn(`读取健康缓存失败: ${(e as Error).message}`);
      }
    }

    return results;
  }

  /**
   * 获取指定策略的健康状态
   */
  async getHealth(strategyName: string): Promise<FreqtradeHealth | null> {
    try {
      const cached = await this.redis.get(`${this.REDIS_KEY_PREFIX}${strategyName}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }
}
