import { Injectable, Logger } from '@nestjs/common';
import * as ccxt from 'ccxt';

/**
 * 市场数据服务
 * 使用 CCXT 获取交易所市场数据供 AI 分析使用
 */
@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly exchange: ccxt.Exchange;

  // 缓存配置
  private readonly ohlcvCache = new Map<string, { data: any[][]; timestamp: number }>();
  private readonly priceCache = new Map<string, { price: number; timestamp: number }>();
  private readonly oiCache = new Map<string, { data: any; timestamp: number }>();
  private readonly fundingRateCache = new Map<string, { data: any; timestamp: number }>();
  private readonly OHLCV_TTL = 5 * 60 * 1000; // 5 分钟
  private readonly PRICE_TTL = 30 * 1000; // 30 秒
  private readonly OI_TTL = 60 * 1000; // 1 分钟
  private readonly FUNDING_RATE_TTL = 60 * 1000; // 1 分钟

  constructor() {
    // 创建公共 Binance 实例（无需 API Key，仅获取市场数据）
    this.exchange = new ccxt.binance({
      enableRateLimit: true,
      options: {
        defaultType: 'future', // 使用合约市场
      },
    });

    this.logger.log('MarketDataService 初始化完成，使用 Binance 合约市场');
  }

  /**
   * 获取 OHLCV 数据（K线数据）
   * @param symbol 交易对，如 'BTC/USDT'
   * @param timeframe 时间周期，如 '1h', '4h', '1d'
   * @param limit 获取数量，默认 100
   * @returns OHLCV 数据数组 [[timestamp, open, high, low, close, volume], ...]
   */
  async fetchOHLCV(
    symbol: string,
    timeframe: string = '1h',
    limit: number = 100,
  ): Promise<any[][]> {
    const cacheKey = `${symbol}_${timeframe}_${limit}`;

    // 检查缓存
    const cached = this.ohlcvCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.OHLCV_TTL) {
      this.logger.debug(`OHLCV 缓存命中: ${cacheKey}`);
      return cached.data;
    }

    try {
      this.logger.log(`获取 OHLCV 数据: ${symbol} ${timeframe} limit=${limit}`);

      // 从交易所获取数据
      const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);

      // 缓存结果
      this.ohlcvCache.set(cacheKey, {
        data: ohlcv,
        timestamp: Date.now(),
      });

      this.logger.log(`OHLCV 数据获取成功: ${symbol} 获取了 ${ohlcv.length} 条数据`);
      return ohlcv;
    } catch (error) {
      this.logger.error(`获取 OHLCV 数据失败: ${symbol} ${timeframe}`, error.stack);

      // 如果有缓存数据，即使过期也返回
      if (cached) {
        this.logger.warn(`使用过期缓存数据: ${cacheKey}`);
        return cached.data;
      }

      throw new Error(`获取市场数据失败: ${error.message}`);
    }
  }

  /**
   * 获取当前价格
   * @param symbol 交易对，如 'BTC/USDT'
   * @returns 当前价格
   */
  async fetchCurrentPrice(symbol: string): Promise<number> {
    // 检查缓存
    const cached = this.priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.PRICE_TTL) {
      this.logger.debug(`价格缓存命中: ${symbol} = ${cached.price}`);
      return cached.price;
    }

    try {
      this.logger.log(`获取当前价格: ${symbol}`);

      // 从交易所获取 ticker
      const ticker = await this.exchange.fetchTicker(symbol);
      const price = ticker.last; // 最新成交价

      // 缓存结果
      this.priceCache.set(symbol, {
        price,
        timestamp: Date.now(),
      });

      this.logger.log(`价格获取成功: ${symbol} = ${price}`);
      return price;
    } catch (error) {
      this.logger.error(`获取价格失败: ${symbol}`, error.stack);

      // 如果有缓存数据，即使过期也返回
      if (cached) {
        this.logger.warn(`使用过期价格缓存: ${symbol} = ${cached.price}`);
        return cached.price;
      }

      throw new Error(`获取价格失败: ${error.message}`);
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.ohlcvCache.clear();
    this.priceCache.clear();
    this.oiCache.clear();
    this.fundingRateCache.clear();
    this.logger.log('缓存已清除');
  }

  /**
   * 获取持仓量 (Open Interest)
   * @param symbol 交易对，如 'BTC/USDT:USDT'
   * @returns { openInterest: number, timestamp: number } | null
   */
  async fetchOpenInterest(symbol: string): Promise<{ openInterest: number; timestamp: number } | null> {
    const cacheKey = `oi_${symbol}`;
    const cached = this.oiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.OI_TTL) {
      this.logger.debug(`OI 缓存命中: ${cacheKey}`);
      return cached.data;
    }

    try {
      this.logger.log(`获取持仓量: ${symbol}`);
      const oi = await this.exchange.fetchOpenInterest(symbol);
      const result = {
        openInterest: oi.openInterestAmount || oi.openInterestValue || 0,
        timestamp: Date.now(),
      };

      this.oiCache.set(cacheKey, { data: result, timestamp: Date.now() });
      this.logger.log(`持仓量获取成功: ${symbol} OI=${result.openInterest}`);
      return result;
    } catch (error) {
      this.logger.warn(`获取持仓量失败: ${symbol} - ${error.message}`);
      if (cached) return cached.data;
      return null;
    }
  }

  /**
   * 获取资金费率 (Funding Rate)
   * @param symbol 交易对，如 'BTC/USDT:USDT'
   * @returns { fundingRate: number, nextFundingTime: number, timestamp: number } | null
   */
  async fetchFundingRate(symbol: string): Promise<{ fundingRate: number; nextFundingTime: number; timestamp: number } | null> {
    const cacheKey = `fr_${symbol}`;
    const cached = this.fundingRateCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.FUNDING_RATE_TTL) {
      this.logger.debug(`资金费率缓存命中: ${cacheKey}`);
      return cached.data;
    }

    try {
      this.logger.log(`获取资金费率: ${symbol}`);
      const fr = await this.exchange.fetchFundingRate(symbol);
      const result = {
        fundingRate: fr.fundingRate || 0,
        nextFundingTime: fr.fundingTimestamp || 0,
        timestamp: Date.now(),
      };

      this.fundingRateCache.set(cacheKey, { data: result, timestamp: Date.now() });
      this.logger.log(`资金费率获取成功: ${symbol} rate=${(result.fundingRate * 100).toFixed(4)}%`);
      return result;
    } catch (error) {
      this.logger.warn(`获取资金费率失败: ${symbol} - ${error.message}`);
      if (cached) return cached.data;
      return null;
    }
  }

  /**
   * 获取支持的时间周期
   */
  getSupportedTimeframes(): string[] {
    return ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
  }

  /**
   * 清理过期缓存（定期任务可调用）
   */
  cleanExpiredCache(): void {
    const now = Date.now();

    // 清理 OHLCV 缓存
    for (const [key, value] of this.ohlcvCache.entries()) {
      if (now - value.timestamp > this.OHLCV_TTL) {
        this.ohlcvCache.delete(key);
      }
    }

    // 清理价格缓存
    for (const [key, value] of this.priceCache.entries()) {
      if (now - value.timestamp > this.PRICE_TTL) {
        this.priceCache.delete(key);
      }
    }

    // 清理 OI 缓存
    for (const [key, value] of this.oiCache.entries()) {
      if (now - value.timestamp > this.OI_TTL) {
        this.oiCache.delete(key);
      }
    }

    // 清理资金费率缓存
    for (const [key, value] of this.fundingRateCache.entries()) {
      if (now - value.timestamp > this.FUNDING_RATE_TTL) {
        this.fundingRateCache.delete(key);
      }
    }

    this.logger.debug(`缓存清理完成，剩余 OHLCV: ${this.ohlcvCache.size}, 价格: ${this.priceCache.size}, OI: ${this.oiCache.size}, 资金费率: ${this.fundingRateCache.size}`);
  }
}
