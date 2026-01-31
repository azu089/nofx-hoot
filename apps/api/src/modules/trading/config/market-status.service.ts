import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TradingConfigService } from './config.service';
import { Decimal } from '@prisma/client/runtime/library';

export type MarketStatusLevel = 'normal' | 'volatile' | 'extreme' | 'suspended';

export interface MarketStatusResult {
  symbol: string;
  exchange: string;
  status: MarketStatusLevel;
  volatility24h: number;
  priceChange24h: number;
  reason?: string;
  canTrade: boolean;
  warnings: string[];
}

/**
 * 市场状态检测服务
 * 监控市场波动率、流动性，在极端行情下保护用户
 */
@Injectable()
export class MarketStatusService {
  private readonly logger = new Logger(MarketStatusService.name);

  // 内存缓存
  private statusCache: Map<string, MarketStatusResult> = new Map();
  private readonly CACHE_TTL = 60 * 1000; // 1 分钟
  private lastUpdateTime: number = 0;

  constructor(
    private prisma: PrismaService,
    private configService: TradingConfigService,
  ) {}

  /**
   * 检查特定交易对的市场状态
   */
  async checkMarketStatus(
    symbol: string,
    exchange: string,
  ): Promise<MarketStatusResult> {
    const cacheKey = `${exchange}:${symbol}`;
    const now = Date.now();

    // 检查缓存
    if (
      this.statusCache.has(cacheKey) &&
      now - this.lastUpdateTime < this.CACHE_TTL
    ) {
      return this.statusCache.get(cacheKey)!;
    }

    // 从数据库获取最新状态
    const record = await this.prisma.marketStatus.findUnique({
      where: {
        symbol_exchange: { symbol, exchange },
      },
    });

    if (record) {
      const result: MarketStatusResult = {
        symbol,
        exchange,
        status: record.status as MarketStatusLevel,
        volatility24h: parseFloat(record.volatility24h.toString()),
        priceChange24h: parseFloat(record.priceChange24h.toString()),
        reason: record.reason || undefined,
        canTrade: record.status !== 'suspended',
        warnings: this.generateWarnings(
          record.status as MarketStatusLevel,
          parseFloat(record.volatility24h.toString()),
        ),
      };

      this.statusCache.set(cacheKey, result);
      return result;
    }

    // 默认返回正常状态
    const defaultResult: MarketStatusResult = {
      symbol,
      exchange,
      status: 'normal',
      volatility24h: 0,
      priceChange24h: 0,
      canTrade: true,
      warnings: [],
    };

    this.statusCache.set(cacheKey, defaultResult);
    return defaultResult;
  }

  /**
   * 批量检查多个交易对
   */
  async checkMultipleMarkets(
    pairs: Array<{ symbol: string; exchange: string }>,
  ): Promise<Map<string, MarketStatusResult>> {
    const results = new Map<string, MarketStatusResult>();

    await Promise.all(
      pairs.map(async ({ symbol, exchange }) => {
        const status = await this.checkMarketStatus(symbol, exchange);
        results.set(`${exchange}:${symbol}`, status);
      }),
    );

    return results;
  }

  /**
   * 更新市场状态（由外部数据源或定时任务调用）
   */
  async updateMarketStatus(
    symbol: string,
    exchange: string,
    data: {
      volatility24h: number;
      priceChange24h: number;
      bidDepthUsdt?: number;
      askDepthUsdt?: number;
    },
  ): Promise<MarketStatusResult> {
    const platformConfig = await this.configService.getPlatformConfig();
    const { marketStatus: config } = platformConfig;

    // 计算状态
    let status: MarketStatusLevel = 'normal';
    let reason: string | undefined;

    if (Math.abs(data.volatility24h) > config.maxVolatility24h) {
      status = 'extreme';
      reason = `波动率 ${data.volatility24h.toFixed(2)}% 超过阈值 ${config.maxVolatility24h}%`;
    } else if (Math.abs(data.volatility24h) > config.maxVolatility24h * 0.7) {
      status = 'volatile';
      reason = `波动率较高 ${data.volatility24h.toFixed(2)}%`;
    }

    // 价格偏离检测
    if (
      config.extremeMarketProtection &&
      Math.abs(data.priceChange24h) > config.priceDeviationThreshold * 2
    ) {
      status = 'extreme';
      reason = `价格剧烈波动 ${data.priceChange24h.toFixed(2)}%`;
    }

    // 更新数据库
    await this.prisma.marketStatus.upsert({
      where: {
        symbol_exchange: { symbol, exchange },
      },
      update: {
        volatility24h: new Decimal(data.volatility24h),
        priceChange24h: new Decimal(data.priceChange24h),
        bidDepthUsdt: data.bidDepthUsdt ? new Decimal(data.bidDepthUsdt) : null,
        askDepthUsdt: data.askDepthUsdt ? new Decimal(data.askDepthUsdt) : null,
        status,
        reason,
      },
      create: {
        symbol,
        exchange,
        volatility24h: new Decimal(data.volatility24h),
        priceChange24h: new Decimal(data.priceChange24h),
        bidDepthUsdt: data.bidDepthUsdt ? new Decimal(data.bidDepthUsdt) : null,
        askDepthUsdt: data.askDepthUsdt ? new Decimal(data.askDepthUsdt) : null,
        status,
        reason,
      },
    });

    // 清除缓存
    this.statusCache.delete(`${exchange}:${symbol}`);
    this.lastUpdateTime = Date.now();

    const result: MarketStatusResult = {
      symbol,
      exchange,
      status,
      volatility24h: data.volatility24h,
      priceChange24h: data.priceChange24h,
      reason,
      canTrade: status !== 'extreme', // 极端情况下不建议交易
      warnings: this.generateWarnings(status, data.volatility24h),
    };

    // 记录极端情况
    if (status === 'extreme') {
      this.logger.warn(`市场极端状态: ${exchange}:${symbol} - ${reason}`);
    }

    return result;
  }

  /**
   * 手动暂停某个交易对
   */
  async suspendTrading(
    symbol: string,
    exchange: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.marketStatus.upsert({
      where: {
        symbol_exchange: { symbol, exchange },
      },
      update: {
        status: 'suspended',
        reason,
      },
      create: {
        symbol,
        exchange,
        volatility24h: new Decimal(0),
        priceChange24h: new Decimal(0),
        status: 'suspended',
        reason,
      },
    });

    this.statusCache.delete(`${exchange}:${symbol}`);
    this.logger.warn(`交易已暂停: ${exchange}:${symbol} - ${reason}`);
  }

  /**
   * 恢复交易
   */
  async resumeTrading(symbol: string, exchange: string): Promise<void> {
    await this.prisma.marketStatus.update({
      where: {
        symbol_exchange: { symbol, exchange },
      },
      data: {
        status: 'normal',
        reason: null,
      },
    });

    this.statusCache.delete(`${exchange}:${symbol}`);
    this.logger.log(`交易已恢复: ${exchange}:${symbol}`);
  }

  /**
   * 生成警告信息
   */
  private generateWarnings(
    status: MarketStatusLevel,
    volatility: number,
  ): string[] {
    const warnings: string[] = [];

    if (status === 'volatile') {
      warnings.push('市场波动较大，请注意风险');
    }

    if (status === 'extreme') {
      warnings.push('市场极端波动，建议暂缓交易');
      warnings.push('可能出现较大滑点');
    }

    if (volatility > 30) {
      warnings.push('24小时波动率超过30%，高风险');
    }

    return warnings;
  }

  /**
   * 获取所有异常市场
   */
  async getAbnormalMarkets(): Promise<MarketStatusResult[]> {
    const records = await this.prisma.marketStatus.findMany({
      where: {
        status: {
          in: ['volatile', 'extreme', 'suspended'],
        },
      },
    });

    return records.map((r) => ({
      symbol: r.symbol,
      exchange: r.exchange,
      status: r.status as MarketStatusLevel,
      volatility24h: parseFloat(r.volatility24h.toString()),
      priceChange24h: parseFloat(r.priceChange24h.toString()),
      reason: r.reason || undefined,
      canTrade: r.status !== 'suspended',
      warnings: this.generateWarnings(
        r.status as MarketStatusLevel,
        parseFloat(r.volatility24h.toString()),
      ),
    }));
  }
}
