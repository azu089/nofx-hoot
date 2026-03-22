import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as ccxt from 'ccxt';
import * as fs from 'fs';
import * as path from 'path';
import { translateExchangeError } from '../utils/error-translator';
import {
  LongShortRatioData, TakerFlowData, OIHistoryData,
  StablecoinFlowData, OptionsMarketData, MacroData,
  LiquidationHeatmapData, ETFFlowData, COTReportData,
  EnhancedMarketData,
} from '../types/ai.types';

/**
 * CryptoPanic 新闻条目
 */
export interface CryptoNewsItem {
  title: string;
  publishedAt: string;
  source: string;
  kind: string; // news | media
  sentiment: 'positive' | 'negative' | 'neutral';
  votes: {
    positive: number;
    negative: number;
    important: number;
  };
}

/**
 * 市场排名数据（价格涨跌幅+成交量排名）
 */
export interface MarketRankingData {
  topGainers: Array<{ symbol: string; change24h: number }>;
  topLosers: Array<{ symbol: string; change24h: number }>;
  topVolume: Array<{ symbol: string; volume24h: number }>;
  topOI?: Array<{ symbol: string; openInterest: number }>; // 持仓量前 5
  totalCoins: number;
  targetRank: { priceRank: number; volumeRank: number };
}

/**
 * 市场数据服务
 * 使用 CCXT 获取交易所市场数据供 AI 分析使用
 */
@Injectable()
export class MarketDataService implements OnModuleInit {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly exchange: ccxt.Exchange;
  private marketsLoaded = false;

  // 缓存配置
  private readonly ohlcvCache = new Map<string, { data: any[][]; timestamp: number }>();
  private readonly priceCache = new Map<string, { price: number; timestamp: number }>();
  private readonly oiCache = new Map<string, { data: any; timestamp: number }>();
  private readonly fundingRateCache = new Map<string, { data: any; timestamp: number }>();
  private readonly newsCache = new Map<string, { data: CryptoNewsItem[]; timestamp: number }>();
  private readonly orderBookCache = new Map<string, { data: { bids: number[][]; asks: number[][] }; timestamp: number }>();

  // === 增强数据缓存 (Phase 11) ===
  private readonly longShortCache = new Map<string, { data: LongShortRatioData; timestamp: number }>();
  private readonly takerFlowCache = new Map<string, { data: TakerFlowData; timestamp: number }>();
  private readonly oiHistoryCache = new Map<string, { data: OIHistoryData[]; timestamp: number }>();
  private readonly stablecoinCache = new Map<string, { data: StablecoinFlowData; timestamp: number }>();
  private readonly optionsCache = new Map<string, { data: OptionsMarketData; timestamp: number }>();
  private readonly macroCache = new Map<string, { data: MacroData; timestamp: number }>();
  private readonly liquidationCache = new Map<string, { data: LiquidationHeatmapData; timestamp: number }>();
  private readonly etfCache = new Map<string, { data: ETFFlowData; timestamp: number }>();
  private readonly cotCache = new Map<string, { data: COTReportData; timestamp: number }>();

  // 对齐 nofx：每轮直调交易所 API，禁用缓存（TTL=0）
  // 多用户场景下如果触发限流，可适当调高 TTL
  private readonly OHLCV_TTL = 0;
  private readonly PRICE_TTL = 0;
  private readonly OI_TTL = 0;
  private readonly FUNDING_RATE_TTL = 0;
  private readonly NEWS_TTL = 15 * 60 * 1000; // 新闻保留15分钟缓存（第三方API限流严格）
  private readonly ORDER_BOOK_TTL = 0;

  // === 增强数据 TTL（第三方API保留适当缓存，防限流）===
  private readonly LONG_SHORT_TTL = 0;
  private readonly TAKER_FLOW_TTL = 0;
  private readonly OI_HISTORY_TTL = 0;
  private readonly STABLECOIN_TTL = 30 * 60 * 1000;    // 稳定币数据变化慢，保留30分钟
  private readonly OPTIONS_TTL = 10 * 60 * 1000;       // Deribit期权数据，保留10分钟
  private readonly MACRO_TTL = 6 * 60 * 60 * 1000;     // 宏观数据每日更新，保留6小时
  private readonly LIQUIDATION_TTL = 0;
  private readonly ETF_TTL = 60 * 60 * 1000;           // ETF数据每日更新，保留1小时
  private readonly COT_TTL = 24 * 60 * 60 * 1000;      // COT周报，保留24小时

  constructor() {
    // 使用 binanceusdm 期货专用类（使用 fapi.binance.com 域名，避免 api.binance.com 被墙）
    this.exchange = new ccxt.binanceusdm({
      enableRateLimit: true,
      timeout: 60000, // 60s — exchangeInfo 响应体 800KB+，需要更长超时
      options: {
        defaultType: 'future',
        fetchCurrencies: false,
      },
    });

    this.logger.log('MarketDataService 初始化完成，使用 binanceusdm 合约市场');
  }

  /**
   * 通用重试包装器（应对 TUN 代理网络间歇性故障）
   * 每次 CCXT API 调用自动重试 maxRetries 次
   */
  private async retryCall<T>(
    label: string,
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 2000,
  ): Promise<T> {
    let lastError: Error = new Error(`${label} failed`);
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < maxRetries) {
          this.logger.warn(`${label} 失败(${attempt}/${maxRetries}): ${lastError.message}，${delayMs}ms后重试`);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }
    throw lastError;
  }

  /**
   * 模块初始化时预加载市场数据（带重试）
   * 避免首次 API 调用时触发 loadMarkets 导致超时
   */
  async onModuleInit(): Promise<void> {
    await this.ensureMarketsLoaded();
  }

  private readonly EXCHANGE_INFO_CACHE = '/tmp/binance_exchangeinfo.json';

  private async ensureMarketsLoaded(): Promise<void> {
    if (this.marketsLoaded) return;

    // 策略 1: 标准 CCXT loadMarkets（3 次快速重试）
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.exchange.loadMarkets();
        this.marketsLoaded = true;
        this.logger.log(`市场数据加载成功 (${Object.keys(this.exchange.markets).length} 个交易对)`);
        // 同时缓存 exchangeInfo 到本地文件供下次使用
        this.saveExchangeInfoCache();
        return;
      } catch (e) {
        this.logger.warn(`市场数据加载失败(${attempt}/3): ${e.message}`);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }

    // 策略 2: 用 fetch 下载 exchangeInfo
    this.logger.log('尝试下载 exchangeInfo...');
    try {
      const resp = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo', {
        signal: AbortSignal.timeout(120000),
      });
      if (resp.ok) {
        const text = await resp.text();
        fs.writeFileSync(this.EXCHANGE_INFO_CACHE, text);
        const loaded = this.loadFromCacheFile();
        if (loaded) return;
      }
    } catch (e) {
      this.logger.warn(`fetch 下载失败: ${(e as Error).message}`);
    }

    // 策略 3: 从本地缓存文件加载（可能是旧的但仍可用）
    const loaded = this.loadFromCacheFile();
    if (loaded) return;

    this.logger.error('市场数据加载最终失败，将在首次 API 调用时重试');
  }

  /**
   * 从本地缓存文件加载 exchangeInfo 并手动设置市场
   * 利用 CCXT 的 defineRestApiEndpoint 缓存机制
   */
  private loadFromCacheFile(): boolean {
    try {
      if (!fs.existsSync(this.EXCHANGE_INFO_CACHE)) return false;

      const stat = fs.statSync(this.EXCHANGE_INFO_CACHE);
      const ageHours = (Date.now() - stat.mtimeMs) / 3600000;
      if (ageHours > 48) {
        this.logger.warn(`本地缓存已过期 (${ageHours.toFixed(1)}h)，跳过`);
        return false;
      }

      const raw = fs.readFileSync(this.EXCHANGE_INFO_CACHE, 'utf-8');
      const data = JSON.parse(raw);

      if (!data.symbols || data.symbols.length < 100) {
        this.logger.warn('本地缓存数据不完整，跳过');
        return false;
      }

      // 使用 CCXT 内部方法解析 exchangeInfo
      const ex = this.exchange as any;
      // binanceusdm 的 parseMarkets 方法会处理 symbols 数组
      if (typeof ex.parseMarkets === 'function') {
        const markets = ex.parseMarkets(data.symbols);
        this.exchange.setMarkets(markets);
      } else {
        // 备选：直接设置市场（简化格式）
        const marketDict: Record<string, any> = {};
        for (const s of data.symbols) {
          const symbol = `${s.baseAsset}/${s.quoteAsset}:${s.marginAsset || s.quoteAsset}`;
          marketDict[symbol] = {
            id: s.symbol,
            symbol,
            base: s.baseAsset,
            quote: s.quoteAsset,
            baseId: s.baseAsset,
            quoteId: s.quoteAsset,
            active: s.status === 'TRADING',
            type: 'swap',
            spot: false,
            future: true,
            linear: true,
            info: s,
            precision: {
              amount: s.quantityPrecision,
              price: s.pricePrecision,
            },
            limits: {
              amount: { min: undefined, max: undefined },
              price: { min: undefined, max: undefined },
            },
          };
        }
        this.exchange.setMarkets(Object.values(marketDict));
      }

      this.marketsLoaded = true;
      this.logger.log(`从本地缓存加载市场数据成功 (${Object.keys(this.exchange.markets).length} 个交易对，缓存时间 ${ageHours.toFixed(1)}h前)`);
      return true;
    } catch (e) {
      this.logger.warn(`从本地缓存加载失败: ${e.message}`);
      return false;
    }
  }

  /**
   * 缓存 exchangeInfo 到本地文件
   */
  private saveExchangeInfoCache(): void {
    try {
      // CCXT 加载市场后内部有 exchangeInfo 数据
      const markets = this.exchange.markets;
      if (markets && Object.keys(markets).length > 100) {
        // 保存简化版市场数据
        fs.writeFileSync(
          this.EXCHANGE_INFO_CACHE,
          JSON.stringify({ symbols: Object.values(markets).map((m: any) => m.info) }),
        );
        this.logger.log(`exchangeInfo 已缓存到 ${this.EXCHANGE_INFO_CACHE}`);
      }
    } catch (e) {
      this.logger.warn(`缓存 exchangeInfo 失败: ${e.message}`);
    }
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
      // 确保市场数据已加载（如果启动时失败会在这里重试）
      await this.ensureMarketsLoaded();

      this.logger.log(`获取 OHLCV 数据: ${symbol} ${timeframe} limit=${limit}`);

      // 从交易所获取数据（带重试）
      const ohlcv = await this.retryCall<ccxt.OHLCV[]>(
        `fetchOHLCV(${symbol} ${timeframe})`,
        () => this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit),
      );

      // 缓存结果
      this.ohlcvCache.set(cacheKey, {
        data: ohlcv as any[][],
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

      throw new Error(`获取市场数据失败: ${translateExchangeError(error.message)}`);
    }
  }

  /**
   * 计算近 1h 价格变化率（%）
   * 用于黑天鹅检测，ATR 指标对极端行情有滞后，1h 涨跌幅可提前拦截
   * @returns 变化率(%)，数据不足时返回 undefined
   */
  async fetchPriceChange1h(symbol: string): Promise<number | undefined> {
    try {
      const bars = await this.fetchOHLCV(symbol, '1h', 3);
      if (bars.length < 2) return undefined;
      const prev = bars[bars.length - 2][4] as number; // 上一根 close
      const curr = bars[bars.length - 1][4] as number; // 最新 close
      if (!prev || prev === 0) return undefined;
      return ((curr - prev) / prev) * 100;
    } catch {
      return undefined;
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
      await this.ensureMarketsLoaded();
      this.logger.log(`获取当前价格: ${symbol}`);

      // 从交易所获取 ticker（带重试）
      const ticker = await this.retryCall<ccxt.Ticker>(
        `fetchTicker(${symbol})`,
        () => this.exchange.fetchTicker(symbol),
      );
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

      throw new Error(`获取价格失败: ${translateExchangeError(error.message)}`);
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
    this.orderBookCache.clear();
    this.longShortCache.clear();
    this.takerFlowCache.clear();
    this.oiHistoryCache.clear();
    this.stablecoinCache.clear();
    this.optionsCache.clear();
    this.macroCache.clear();
    this.liquidationCache.clear();
    this.etfCache.clear();
    this.cotCache.clear();
    this.logger.log('缓存已清除');
  }

  /**
   * 获取持仓量 (Open Interest)
   * @param symbol 交易对，如 'BTC/USDT:USDT'
   * @returns { openInterest: number, timestamp: number } | null
   */
  async fetchOpenInterest(symbol: string): Promise<{ openInterest: number; openInterestValue: number; timestamp: number } | null> {
    const cacheKey = `oi_${symbol}`;
    const cached = this.oiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.OI_TTL) {
      this.logger.debug(`OI 缓存命中: ${cacheKey}`);
      return cached.data;
    }

    try {
      await this.ensureMarketsLoaded();
      this.logger.log(`获取持仓量: ${symbol}`);
      const oi = await this.retryCall<ccxt.OpenInterest>(
        `fetchOpenInterest(${symbol})`,
        () => this.exchange.fetchOpenInterest(symbol),
      );
      const result = {
        openInterest: (oi as any).openInterestAmount || (oi as any).openInterestValue || 0,
        openInterestValue: (oi as any).openInterestValue || 0, // R1: USD 计价，用于流动性过滤
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
      await this.ensureMarketsLoaded();
      this.logger.log(`获取资金费率: ${symbol}`);
      const fr = await this.retryCall<ccxt.FundingRate>(
        `fetchFundingRate(${symbol})`,
        () => this.exchange.fetchFundingRate(symbol),
      );
      const result = {
        fundingRate: (fr as any).fundingRate || 0,
        nextFundingTime: (fr as any).fundingTimestamp || 0,
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

  // ========================= 订单簿 & 滑点预估 =========================

  /**
   * 获取订单簿（缓存 10 秒）
   * @param symbol 交易对，如 'BTC/USDT:USDT'
   * @param depth 深度层数，默认 20
   */
  async fetchOrderBook(
    symbol: string,
    depth: number = 20,
  ): Promise<{ bids: number[][]; asks: number[][] }> {
    const cacheKey = `ob:${symbol}:${depth}`;
    const cached = this.orderBookCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.ORDER_BOOK_TTL) {
      return cached.data;
    }

    try {
      await this.ensureMarketsLoaded();
      const book = await this.retryCall<ccxt.OrderBook>(
        `fetchOrderBook(${symbol})`,
        () => this.exchange.fetchOrderBook(symbol, depth),
      );
      const data = {
        bids: (book.bids || []).map((b: any) => [Number(b[0]), Number(b[1])]),
        asks: (book.asks || []).map((a: any) => [Number(a[0]), Number(a[1])]),
      };

      this.orderBookCache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      this.logger.warn(`[订单簿] 获取失败: ${symbol} - ${error.message}`);
      if (cached) return cached.data;
      throw new Error(`获取订单簿失败: ${translateExchangeError(error.message)}`);
    }
  }

  /**
   * 预估大单滑点
   * 遍历订单簿逐层吃单，计算加权平均成交价与中间价的偏差
   *
   * @param orderBook 订单簿数据
   * @param side 'buy' 吃 asks，'sell' 吃 bids
   * @param sizeUSD 订单金额（USDT）
   * @returns { estimatedSlippage: 百分比, canFill: 是否有足够流动性, depthUSD: 盘口总深度 }
   */
  estimateSlippage(
    orderBook: { bids: number[][]; asks: number[][] },
    side: 'buy' | 'sell',
    sizeUSD: number,
  ): { estimatedSlippage: number; canFill: boolean; depthUSD: number } {
    const levels = side === 'buy' ? orderBook.asks : orderBook.bids;
    if (!levels || levels.length === 0) {
      return { estimatedSlippage: 0, canFill: false, depthUSD: 0 };
    }

    const bestBid = orderBook.bids[0]?.[0] || 0;
    const bestAsk = orderBook.asks[0]?.[0] || 0;
    const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : levels[0][0];

    let remaining = sizeUSD;
    let totalCost = 0;
    let totalQty = 0;

    for (const [price, qty] of levels) {
      const levelUSD = price * qty;
      const fill = Math.min(remaining, levelUSD);
      totalCost += fill;
      totalQty += fill / price;
      remaining -= fill;
      if (remaining <= 0) break;
    }

    const depthUSD = levels.reduce((sum, [p, q]) => sum + p * q, 0);
    const avgPrice = totalQty > 0 ? totalCost / totalQty : midPrice;
    const slippage = Math.abs((avgPrice - midPrice) / midPrice) * 100;

    return {
      estimatedSlippage: Math.round(slippage * 10000) / 10000, // 保留4位小数
      canFill: remaining <= 0,
      depthUSD: Math.round(depthUSD),
    };
  }

  /**
   * 并行获取双时间框架 OHLCV 数据
   * 产品 B 需要主时间框架（操作级别）+ 辅助时间框架（趋势级别）
   *
   * @param symbol 交易对，如 'BTC/USDT'
   * @param primary 主时间框架，如 '5m'
   * @param secondary 辅助时间框架，如 '4h'
   * @param limit 每个时间框架获取的 K 线数量，默认 100
   * @returns 双时间框架 OHLCV 数据
   */
  async fetchMultipleTimeframes(
    symbol: string,
    primary: string,
    secondary: string,
    limit: number = 100,
  ): Promise<{ primary: any[][]; secondary: any[][] }> {
    this.logger.log(`获取双时间框架数据: ${symbol} primary=${primary} secondary=${secondary}`);

    // 并行获取两个时间框架
    const [primaryData, secondaryData] = await Promise.all([
      this.fetchOHLCV(symbol, primary, limit),
      this.fetchOHLCV(symbol, secondary, limit),
    ]);

    this.logger.log(
      `双时间框架数据获取完成: ${symbol} primary=${primaryData.length}条 secondary=${secondaryData.length}条`,
    );

    return { primary: primaryData, secondary: secondaryData };
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

    // 清理订单簿缓存
    for (const [key, value] of this.orderBookCache.entries()) {
      if (now - value.timestamp > this.ORDER_BOOK_TTL) {
        this.orderBookCache.delete(key);
      }
    }

    // 清理增强数据缓存
    for (const [key, value] of this.longShortCache.entries()) {
      if (now - value.timestamp > this.LONG_SHORT_TTL) this.longShortCache.delete(key);
    }
    for (const [key, value] of this.takerFlowCache.entries()) {
      if (now - value.timestamp > this.TAKER_FLOW_TTL) this.takerFlowCache.delete(key);
    }
    for (const [key, value] of this.oiHistoryCache.entries()) {
      if (now - value.timestamp > this.OI_HISTORY_TTL) this.oiHistoryCache.delete(key);
    }
    for (const [key, value] of this.stablecoinCache.entries()) {
      if (now - value.timestamp > this.STABLECOIN_TTL) this.stablecoinCache.delete(key);
    }
    for (const [key, value] of this.optionsCache.entries()) {
      if (now - value.timestamp > this.OPTIONS_TTL) this.optionsCache.delete(key);
    }
    for (const [key, value] of this.macroCache.entries()) {
      if (now - value.timestamp > this.MACRO_TTL) this.macroCache.delete(key);
    }
    for (const [key, value] of this.liquidationCache.entries()) {
      if (now - value.timestamp > this.LIQUIDATION_TTL) this.liquidationCache.delete(key);
    }
    for (const [key, value] of this.etfCache.entries()) {
      if (now - value.timestamp > this.ETF_TTL) this.etfCache.delete(key);
    }
    for (const [key, value] of this.cotCache.entries()) {
      if (now - value.timestamp > this.COT_TTL) this.cotCache.delete(key);
    }

    // 清理排名缓存
    for (const [key, value] of this.rankingCache.entries()) {
      if (now - value.timestamp > this.RANKING_TTL) this.rankingCache.delete(key);
    }

    this.logger.debug(`缓存清理完成，剩余: OHLCV=${this.ohlcvCache.size} 价格=${this.priceCache.size} OI=${this.oiCache.size} 资金费率=${this.fundingRateCache.size} 订单簿=${this.orderBookCache.size} 排名=${this.rankingCache.size} 多空比=${this.longShortCache.size} Taker=${this.takerFlowCache.size} OI历史=${this.oiHistoryCache.size} 稳定币=${this.stablecoinCache.size} 期权=${this.optionsCache.size} 宏观=${this.macroCache.size} 清算=${this.liquidationCache.size} ETF=${this.etfCache.size} COT=${this.cotCache.size}`);
  }

  // ========================= 市场排名数据 =========================

  private readonly rankingCache = new Map<string, { data: MarketRankingData; timestamp: number }>();
  private readonly RANKING_TTL = 5 * 60 * 1000; // 5 分钟

  /**
   * 获取市场排名数据
   *
   * 返回:
   * - topGainers: 24h 涨幅前5
   * - topLosers: 24h 跌幅前5
   * - topVolume: 24h 成交量前5
   * - targetRank: 目标币种在各维度的排名
   */
  async fetchMarketRanking(targetSymbol: string): Promise<MarketRankingData> {
    const cacheKey = `ranking:all`;
    const cached = this.rankingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.RANKING_TTL) {
      return this.enrichWithTargetRank(cached.data, targetSymbol);
    }

    try {
      await this.ensureMarketsLoaded();
      const tickers = await this.exchange.fetchTickers();

      // 只保留 USDT 永续合约
      const usdtTickers = Object.entries(tickers)
        .filter(([k]) => k.endsWith('/USDT:USDT') || k.endsWith('/USDT'))
        .map(([symbol, t]: [string, any]) => ({
          symbol,
          change24h: (t.percentage as number) || 0,
          volume24h: ((t.quoteVolume as number) || 0),
          last: (t.last as number) || 0,
        }))
        .filter((t) => t.last > 0 && t.volume24h > 100000); // 过滤极低流动性

      // 排序
      const byChange = [...usdtTickers].sort((a, b) => b.change24h - a.change24h);
      const byVolume = [...usdtTickers].sort((a, b) => b.volume24h - a.volume24h);

      // 并行获取 top-10 成交量币种的 OI（failsafe：单个失败返回 0，不影响主流程）
      const top10Symbols = byVolume.slice(0, 10).map(t => t.symbol);
      const oiResults = await Promise.all(
        top10Symbols.map(sym =>
          this.fetchOpenInterest(sym)
            .then(r => ({ symbol: sym, openInterest: r?.openInterest ?? 0 }))
            .catch(() => ({ symbol: sym, openInterest: 0 }))
        )
      );
      const topOI = oiResults
        .filter(r => r.openInterest > 0)
        .sort((a, b) => b.openInterest - a.openInterest)
        .slice(0, 5);

      const data: MarketRankingData = {
        topGainers: byChange.slice(0, 5).map((t) => ({
          symbol: t.symbol,
          change24h: Math.round(t.change24h * 100) / 100,
        })),
        topLosers: byChange.slice(-5).reverse().map((t) => ({
          symbol: t.symbol,
          change24h: Math.round(t.change24h * 100) / 100,
        })),
        topVolume: byVolume.slice(0, 5).map((t) => ({
          symbol: t.symbol,
          volume24h: Math.round(t.volume24h),
        })),
        topOI: topOI.length > 0 ? topOI : undefined,
        totalCoins: usdtTickers.length,
        targetRank: { priceRank: 0, volumeRank: 0 },
      };

      this.rankingCache.set(cacheKey, { data, timestamp: Date.now() });
      return this.enrichWithTargetRank(data, targetSymbol);
    } catch (error) {
      this.logger.warn(`[排名] fetchTickers 失败: ${error.message}`);
      return {
        topGainers: [], topLosers: [], topVolume: [],
        totalCoins: 0, targetRank: { priceRank: 0, volumeRank: 0 },
      };
    }
  }

  private enrichWithTargetRank(data: MarketRankingData, targetSymbol: string): MarketRankingData {
    // 找到目标币种在涨跌幅中的排名（从缓存的 tickers 中推算）
    const result = { ...data };
    const gainerIdx = data.topGainers.findIndex((t) => t.symbol.includes(targetSymbol.split('/')[0]));
    const loserIdx = data.topLosers.findIndex((t) => t.symbol.includes(targetSymbol.split('/')[0]));
    const volIdx = data.topVolume.findIndex((t) => t.symbol.includes(targetSymbol.split('/')[0]));

    result.targetRank = {
      priceRank: gainerIdx >= 0 ? gainerIdx + 1 : (loserIdx >= 0 ? data.totalCoins - loserIdx : 0),
      volumeRank: volIdx >= 0 ? volIdx + 1 : 0,
    };
    return result;
  }

  // ========================= 新闻数据 =========================

  /**
   * 获取加密货币新闻（CryptoPanic API）
   *
   * 免费端点无需 API Key，但有 rate limit (200 req/hr)
   * 有 API Key 时可获得更高限额
   *
   * @param symbol 交易对，如 'BTC/USDT' → 提取 'BTC'
   * @param limit 返回新闻数量（默认 10）
   */
  async fetchCryptoNews(
    symbol: string,
    limit: number = 10,
  ): Promise<CryptoNewsItem[]> {
    const cacheKey = `news:${symbol}`;
    const cached = this.newsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.NEWS_TTL) {
      return cached.data;
    }

    try {
      // 从 symbol 提取币种代码: 'BTC/USDT' → 'BTC', 'SOL/USDT:USDT' → 'SOL'
      const currency = symbol.split('/')[0].toUpperCase();

      // 数据源 1: CoinGecko Trending（免费无需 Key，反映市场热点和情绪）
      const trendingNews = await this.fetchCoinGeckoTrending(currency, limit);
      if (trendingNews.length > 0) {
        this.newsCache.set(cacheKey, { data: trendingNews, timestamp: Date.now() });
        this.logger.log(`[新闻] ${currency}: CoinGecko trending ${trendingNews.length} 条`);
        return trendingNews;
      }

      // 数据源 2: CryptoPanic（备用，API 可能已下线）
      const apiKey = process.env.CRYPTOPANIC_API_KEY;
      if (apiKey) {
        const cpNews = await this.fetchCryptoPanicNews(currency, apiKey, limit);
        if (cpNews.length > 0) {
          this.newsCache.set(cacheKey, { data: cpNews, timestamp: Date.now() });
          return cpNews;
        }
      }

      return [];
    } catch (error: any) {
      this.logger.warn(`[新闻] 获取失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 从 CryptoPanic 投票数据推断新闻情绪
   */
  private extractNewsSentiment(
    item: any,
  ): 'positive' | 'negative' | 'neutral' {
    const positive = item.votes?.positive || 0;
    const negative = item.votes?.negative || 0;
    if (positive > negative * 2) return 'positive';
    if (negative > positive * 2) return 'negative';
    return 'neutral';
  }

  /**
   * CoinGecko Trending → 转换为 CryptoNewsItem 格式
   * 免费无需 Key，反映市场关注热点
   */
  private async fetchCoinGeckoTrending(currency: string, limit: number): Promise<CryptoNewsItem[]> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('https://api.coingecko.com/api/v3/search/trending', {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return [];

      const data = await res.json();
      const coins = data?.coins || [];

      // 当前币是否在 trending 列表中
      const targetInTrending = coins.find((c: any) => c?.item?.symbol?.toUpperCase() === currency);
      const results: CryptoNewsItem[] = [];

      if (targetInTrending) {
        const item = targetInTrending.item;
        results.push({
          title: `${item.name} (${item.symbol}) is trending #${(item.score ?? 0) + 1} on CoinGecko`,
          publishedAt: new Date().toISOString(),
          source: 'CoinGecko Trending',
          kind: 'news',
          sentiment: 'positive' as const,
          votes: { positive: 1, negative: 0, important: 1 },
        });
      }

      // Top trending 作为市场热点背景
      const topTrending = coins.slice(0, Math.min(limit, 5));
      for (const c of topTrending) {
        const item = c?.item;
        if (!item || item.symbol?.toUpperCase() === currency) continue;
        const rawPriceChange = item.data?.price_change_percentage_24h;
        // CoinGecko 返回多币种对象 {usd: 5.5, btc: 7.8, ...}，取 usd 值
        const priceChange = typeof rawPriceChange === 'object' ? rawPriceChange?.usd ?? null : rawPriceChange;
        let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
        if (typeof priceChange === 'number') {
          sentiment = priceChange > 5 ? 'positive' : priceChange < -5 ? 'negative' : 'neutral';
        }
        results.push({
          title: `Market trending: ${item.name} (${item.symbol}) #${(item.score ?? 0) + 1}${typeof priceChange === 'number' ? ` (24h: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(1)}%)` : ''}`,
          publishedAt: new Date().toISOString(),
          source: 'CoinGecko Trending',
          kind: 'news',
          sentiment,
          votes: { positive: sentiment === 'positive' ? 1 : 0, negative: sentiment === 'negative' ? 1 : 0, important: 0 },
        });
      }

      return results.slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * CryptoPanic 新闻获取（备用，API 可能已下线）
   */
  private async fetchCryptoPanicNews(currency: string, apiKey: string, limit: number): Promise<CryptoNewsItem[]> {
    try {
      const baseUrl = 'https://cryptopanic.com/api/free/v1/posts/';
      const params = new URLSearchParams({
        currencies: currency,
        filter: 'hot',
        public: 'true',
        auth_token: apiKey,
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${baseUrl}?${params.toString()}`, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`[新闻] CryptoPanic API 返回 ${res.status}`);
        return [];
      }

      const data = await res.json();
      return (data?.results || []).slice(0, limit).map((item: any) => ({
        title: item.title || '',
        publishedAt: item.published_at || '',
        source: item.domain || item.source?.domain || 'unknown',
        kind: item.kind || 'news',
        sentiment: this.extractNewsSentiment(item),
        votes: {
          positive: item.votes?.positive || 0,
          negative: item.votes?.negative || 0,
          important: item.votes?.important || 0,
        },
      }));
    } catch (e: any) {
      this.logger.warn(`[新闻] CryptoPanic 失败: ${e.message}`);
      return [];
    }
  }

  // ========================= Fear & Greed Index =========================

  private fearGreedCache: { data: { value: number; classification: string }; timestamp: number } | null = null;
  private readonly FEAR_GREED_TTL = 10 * 60 * 1000; // 10min

  /**
   * 获取 Crypto Fear & Greed Index（极速策略增强 Task 2）
   * 数据源: alternative.me（免费，无需 Key）
   * 缓存: 10min（指数变化频率低）
   */
  async fetchFearGreedIndex(): Promise<{ value: number; classification: string } | null> {
    if (this.fearGreedCache && Date.now() - this.fearGreedCache.timestamp < this.FEAR_GREED_TTL) {
      return this.fearGreedCache.data;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch('https://api.alternative.me/fng/?limit=1', {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`[F&G] API 返回 ${res.status}`);
        return null;
      }

      const json = await res.json();
      const item = json?.data?.[0];
      if (!item) return null;

      const result = {
        value: Number(item.value),
        classification: item.value_classification || 'Unknown',
      };

      this.fearGreedCache = { data: result, timestamp: Date.now() };
      this.logger.log(`[F&G] Fear & Greed Index: ${result.value}/100 (${result.classification})`);
      return result;
    } catch (error) {
      this.logger.warn(`[F&G] API 失败: ${error.message}`);
      return null;
    }
  }

  /** 将 CCXT 格式 symbol 转换为 Binance API 格式: 'BTC/USDT:USDT' → 'BTCUSDT' */
  private toBinanceSymbol(symbol: string): string {
    return symbol.replace('/', '').replace(':USDT', '').replace(':BUSD', '').toUpperCase();
  }

  // ========================= 增强市场数据 (Phase 11) =========================

  /**
   * 获取 Binance 多空账户比
   * API: https://fapi.binance.com/futures/data/globalLongShortAccountRatio
   * 免费，无需 Key
   */
  async fetchLongShortRatio(symbol: string, period: string = '1h'): Promise<LongShortRatioData | null> {
    const cacheKey = `ls:${symbol}:${period}`;
    const cached = this.longShortCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.LONG_SHORT_TTL) return cached.data;

    try {
      const binanceSymbol = this.toBinanceSymbol(symbol);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(
        `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${binanceSymbol}&period=${period}&limit=1`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);

      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;

      const item = data[0];
      const result: LongShortRatioData = {
        longShortRatio: parseFloat(item.longShortRatio),
        longAccount: parseFloat(item.longAccount),
        shortAccount: parseFloat(item.shortAccount),
        timestamp: item.timestamp,
      };

      this.longShortCache.set(cacheKey, { data: result, timestamp: Date.now() });
      this.logger.log(`[多空比] ${binanceSymbol}: L/S=${result.longShortRatio.toFixed(2)} (${(result.longAccount * 100).toFixed(1)}%/${(result.shortAccount * 100).toFixed(1)}%)`);
      return result;
    } catch (error) {
      this.logger.warn(`[多空比] 获取失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取 Binance Taker 买卖比
   * API: https://fapi.binance.com/futures/data/takerlongshortRatio
   * 免费，无需 Key
   */
  async fetchTakerBuySellRatio(symbol: string, period: string = '1h'): Promise<TakerFlowData | null> {
    const cacheKey = `taker:${symbol}:${period}`;
    const cached = this.takerFlowCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.TAKER_FLOW_TTL) return cached.data;

    try {
      const binanceSymbol = this.toBinanceSymbol(symbol);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(
        `https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=${binanceSymbol}&period=${period}&limit=1`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);

      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) return null;

      const item = data[0];
      const result: TakerFlowData = {
        buySellRatio: parseFloat(item.buySellRatio),
        buyVol: parseFloat(item.buyVol),
        sellVol: parseFloat(item.sellVol),
        timestamp: item.timestamp,
      };

      this.takerFlowCache.set(cacheKey, { data: result, timestamp: Date.now() });
      this.logger.log(`[Taker] ${binanceSymbol}: Buy/Sell=${result.buySellRatio.toFixed(2)}`);
      return result;
    } catch (error) {
      this.logger.warn(`[Taker] 获取失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取 Binance OI 历史数据
   * API: https://fapi.binance.com/futures/data/openInterestHist
   * 免费，无需 Key
   */
  async fetchOIHistory(symbol: string, period: string = '1h', limit: number = 24): Promise<OIHistoryData[] | null> {
    const cacheKey = `oih:${symbol}:${period}:${limit}`;
    const cached = this.oiHistoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.OI_HISTORY_TTL) return cached.data;

    try {
      const binanceSymbol = this.toBinanceSymbol(symbol);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(
        `https://fapi.binance.com/futures/data/openInterestHist?symbol=${binanceSymbol}&period=${period}&limit=${limit}`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);

      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data)) return null;

      const result: OIHistoryData[] = data.map((item: any) => ({
        sumOpenInterest: parseFloat(item.sumOpenInterest),
        sumOpenInterestValue: parseFloat(item.sumOpenInterestValue),
        timestamp: item.timestamp,
      }));

      this.oiHistoryCache.set(cacheKey, { data: result, timestamp: Date.now() });
      this.logger.log(`[OI历史] ${binanceSymbol}: ${result.length} 条记录`);
      return result;
    } catch (error) {
      this.logger.warn(`[OI历史] 获取失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取稳定币铸造/销毁数据 (DeFiLlama)
   * API: https://stablecoins.llama.fi/stablecoins?includePrices=true
   * 免费，无需 Key
   */
  async fetchStablecoinFlows(): Promise<StablecoinFlowData | null> {
    const cacheKey = 'stablecoin:global';
    const cached = this.stablecoinCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.STABLECOIN_TTL) return cached.data;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch('https://stablecoins.llama.fi/stablecoins?includePrices=true', {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) return null;
      const json = await res.json();
      const stablecoins = json?.peggedAssets || [];

      // 查找 USDT 和 USDC
      let usdtCirc = 0, usdtPrev = 0, usdcCirc = 0, usdcPrev = 0, totalMcap = 0;
      for (const sc of stablecoins) {
        const circ = sc.circulating?.peggedUSD || 0;
        totalMcap += circ;

        if (sc.symbol === 'USDT') {
          usdtCirc = circ;
          usdtPrev = sc.circulatingPrevDay?.peggedUSD || circ;
        } else if (sc.symbol === 'USDC') {
          usdcCirc = circ;
          usdcPrev = sc.circulatingPrevDay?.peggedUSD || circ;
        }
      }

      const netMinted24h = (usdtCirc - usdtPrev) + (usdcCirc - usdcPrev);
      const change24h = totalMcap > 0 ? (netMinted24h / totalMcap * 100) : 0;

      // 7d 变化需要额外计算
      let usdtPrev7d = 0, usdcPrev7d = 0, totalPrev7d = 0;
      for (const sc of stablecoins) {
        const prev7 = sc.circulatingPrevWeek?.peggedUSD || sc.circulating?.peggedUSD || 0;
        totalPrev7d += prev7;
        if (sc.symbol === 'USDT') usdtPrev7d = prev7;
        else if (sc.symbol === 'USDC') usdcPrev7d = prev7;
      }
      const net7d = (usdtCirc - usdtPrev7d) + (usdcCirc - usdcPrev7d);
      const change7d = totalPrev7d > 0 ? (net7d / totalPrev7d * 100) : 0;

      const result: StablecoinFlowData = {
        totalMarketCap: Math.round(totalMcap),
        usdtCirculating: Math.round(usdtCirc),
        usdcCirculating: Math.round(usdcCirc),
        change24h: Math.round(change24h * 100) / 100,
        change7d: Math.round(change7d * 100) / 100,
        netMinted24h: Math.round(netMinted24h),
        timestamp: Date.now(),
      };

      this.stablecoinCache.set(cacheKey, { data: result, timestamp: Date.now() });
      this.logger.log(`[稳定币] 总市值: $${(totalMcap / 1e9).toFixed(1)}B, 24h净铸造: ${netMinted24h > 0 ? '+' : ''}$${(netMinted24h / 1e6).toFixed(1)}M`);
      return result;
    } catch (error) {
      this.logger.warn(`[稳定币] DeFiLlama API 失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取期权市场数据 (Deribit)
   * API: https://www.deribit.com/api/v2/public/get_book_summary_by_currency
   * 免费，无需 Key。仅支持 BTC 和 ETH
   */
  async fetchOptionsData(baseCurrency: string = 'BTC'): Promise<OptionsMarketData | null> {
    const upper = baseCurrency.toUpperCase();
    if (upper !== 'BTC' && upper !== 'ETH') return null; // Deribit 仅支持 BTC/ETH

    const cacheKey = `options:${upper}`;
    const cached = this.optionsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.OPTIONS_TTL) return cached.data;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(
        `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${upper}&kind=option`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);

      if (!res.ok) return null;
      const json = await res.json();
      const summaries = json?.result || [];

      if (summaries.length === 0) return null;

      let totalCallOI = 0, totalPutOI = 0;
      let ivSum = 0, ivCount = 0;
      const strikeOI = new Map<number, number>(); // strike → total OI

      for (const s of summaries) {
        const name: string = s.instrument_name || '';
        const oi = (s.open_interest || 0) * (s.underlying_price || 0); // 转 USD
        const iv = s.mark_iv || 0;

        // 从名称解析: BTC-28MAR25-100000-C → C=Call, P=Put
        const isCall = name.endsWith('-C');
        const isPut = name.endsWith('-P');

        if (isCall) totalCallOI += oi;
        else if (isPut) totalPutOI += oi;

        if (iv > 0) { ivSum += iv; ivCount++; }

        // 提取 strike 用于 max pain 计算
        const parts = name.split('-');
        if (parts.length >= 3) {
          const strike = parseFloat(parts[2]);
          if (!isNaN(strike)) {
            strikeOI.set(strike, (strikeOI.get(strike) || 0) + oi);
          }
        }
      }

      // Max pain: OI 最集中的 strike
      let maxPainPrice = 0, maxOI = 0;
      for (const [strike, oi] of strikeOI) {
        if (oi > maxOI) { maxOI = oi; maxPainPrice = strike; }
      }

      const putCallRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 1;

      const result: OptionsMarketData = {
        putCallRatio: Math.round(putCallRatio * 100) / 100,
        totalCallOI: Math.round(totalCallOI),
        totalPutOI: Math.round(totalPutOI),
        maxPainPrice,
        impliedVolatility: ivCount > 0 ? Math.round(ivSum / ivCount * 100) / 100 : 0,
        timestamp: Date.now(),
      };

      this.optionsCache.set(cacheKey, { data: result, timestamp: Date.now() });
      this.logger.log(`[期权] ${upper}: P/C=${result.putCallRatio}, MaxPain=$${maxPainPrice}, IV=${result.impliedVolatility}%`);
      return result;
    } catch (error) {
      this.logger.warn(`[期权] Deribit API 失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取宏观经济数据 (FRED)
   * API: https://api.stlouisfed.org/fred/series/observations
   * 需要免费 API Key (FRED_API_KEY)
   */
  async fetchMacroData(): Promise<MacroData | null> {
    const fredKey = process.env.FRED_API_KEY;
    if (!fredKey) return null; // 无 Key 直接跳过

    const cacheKey = 'macro:global';
    const cached = this.macroCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.MACRO_TTL) return cached.data;

    try {
      const series = ['DFF', 'CPIAUCSL', 'T10Y2Y', 'VIXCLS'];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const results = await Promise.all(
        series.map(async (id) => {
          try {
            const res = await fetch(
              `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${fredKey}&file_type=json&limit=1&sort_order=desc`,
              { signal: controller.signal },
            );
            if (!res.ok) return null;
            const json = await res.json();
            const obs = json?.observations?.[0];
            return obs ? { id, value: parseFloat(obs.value), date: obs.date } : null;
          } catch { return null; }
        }),
      );
      clearTimeout(timeout);

      const getValue = (id: string): number => {
        const v = results.find(r => r?.id === id)?.value;
        return (v != null && !isNaN(v)) ? v : 0;
      };
      const getDate = (id: string) => results.find(r => r?.id === id)?.date || '';

      const fedRate = getValue('DFF');
      const cpiRaw = getValue('CPIAUCSL'); // CPIAUCSL 是绝对指数（~320），非 YoY%
      const spread = getValue('T10Y2Y');
      const vix = getValue('VIXCLS');

      // 至少有一个有效值才缓存（全部为 0 说明 API 全失败，不存）
      if (fedRate === 0 && cpiRaw === 0 && spread === 0 && vix === 0) {
        this.logger.warn('[宏观] FRED 所有系列返回空值，跳过');
        return null;
      }

      const result: MacroData = {
        fedFundsRate: fedRate,
        cpiYoY: cpiRaw > 100 ? 0 : cpiRaw, // CPIAUCSL 绝对值(>100) 不是百分比，设 0 让 prompt 跳过
        yieldCurveSpread: spread,
        vix,
        lastUpdated: getDate('DFF') || getDate('VIXCLS'),
        timestamp: Date.now(),
      };

      this.macroCache.set(cacheKey, { data: result, timestamp: Date.now() });
      this.logger.log(`[宏观] Fed=${result.fedFundsRate}% CPI=${result.cpiYoY} 10Y-2Y=${result.yieldCurveSpread} VIX=${result.vix}`);
      return result;
    } catch (error) {
      this.logger.warn(`[宏观] FRED API 失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取清算热力图数据 (CoinGlass)
   * API: https://open-api-v3.coinglass.com/api/futures/liquidation/chart
   * 需要付费 Key (COINGLASS_API_KEY, $29/月)
   */
  async fetchLiquidationHeatmap(symbol: string): Promise<LiquidationHeatmapData | null> {
    const cgKey = process.env.COINGLASS_API_KEY;
    if (!cgKey) return null;

    const base = symbol.split('/')[0].toUpperCase();
    const cacheKey = `liq:${base}`;
    const cached = this.liquidationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.LIQUIDATION_TTL) return cached.data;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(
        `https://open-api-v3.coinglass.com/api/futures/liquidation/chart?symbol=${base}&interval=1h`,
        { signal: controller.signal, headers: { 'CG-API-KEY': cgKey } },
      );
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`[清算] CoinGlass 返回 ${res.status}`);
        return null;
      }

      const json = await res.json();
      const d = json?.data;
      if (!d) return null;

      const result: LiquidationHeatmapData = {
        total24hLiquidation: d.total24hLiquidation || d.h24TotalLiquidationUsd || 0,
        longLiquidation24h: d.longLiquidation24h || d.h24LongLiquidationUsd || 0,
        shortLiquidation24h: d.shortLiquidation24h || d.h24ShortLiquidationUsd || 0,
        nearestUpLiqZone: d.nearestUpLiqZone || d.upperLiquidationPrice || 0,
        nearestDownLiqZone: d.nearestDownLiqZone || d.lowerLiquidationPrice || 0,
        timestamp: Date.now(),
      };

      this.liquidationCache.set(cacheKey, { data: result, timestamp: Date.now() });
      this.logger.log(`[清算] ${base}: 24h=$${(result.total24hLiquidation / 1e6).toFixed(1)}M (L:$${(result.longLiquidation24h / 1e6).toFixed(1)}M S:$${(result.shortLiquidation24h / 1e6).toFixed(1)}M)`);
      return result;
    } catch (error) {
      this.logger.warn(`[清算] CoinGlass API 失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取 ETF 资金流数据 (CoinGlass)
   * 需要付费 Key (COINGLASS_API_KEY)
   */
  async fetchETFFlows(): Promise<ETFFlowData | null> {
    const cgKey = process.env.COINGLASS_API_KEY;
    if (!cgKey) return null;

    const cacheKey = 'etf:global';
    const cached = this.etfCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.ETF_TTL) return cached.data;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(
        'https://open-api-v3.coinglass.com/api/etf/bitcoin/flow-total',
        { signal: controller.signal, headers: { 'CG-API-KEY': cgKey } },
      );
      clearTimeout(timeout);

      if (!res.ok) return null;
      const json = await res.json();
      const d = json?.data;

      // 尝试获取最新一天的数据
      let btcFlow = 0;
      if (Array.isArray(d) && d.length > 0) {
        const latest = d[d.length - 1];
        btcFlow = latest?.totalNetFlow || latest?.netFlow || 0;
      } else if (d?.totalNetFlow !== undefined) {
        btcFlow = d.totalNetFlow;
      }

      const result: ETFFlowData = {
        btcEtfNetFlow24h: btcFlow,
        ethEtfNetFlow24h: 0, // ETH ETF 端点可能不同，先置 0
        trend: btcFlow > 0 ? 'inflow' : btcFlow < 0 ? 'outflow' : 'neutral',
        timestamp: Date.now(),
      };

      this.etfCache.set(cacheKey, { data: result, timestamp: Date.now() });
      this.logger.log(`[ETF] BTC ETF 24h: ${btcFlow > 0 ? '+' : ''}$${(btcFlow / 1e6).toFixed(1)}M [${result.trend}]`);
      return result;
    } catch (error) {
      this.logger.warn(`[ETF] CoinGlass ETF API 失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取 CFTC COT 机构持仓报告 (NASDAQ Data Link)
   * 需要免费 Key (NASDAQ_DATA_LINK_API_KEY)
   */
  async fetchCOTReport(): Promise<COTReportData | null> {
    const nasdaqKey = process.env.NASDAQ_DATA_LINK_API_KEY;
    if (!nasdaqKey) return null;

    const cacheKey = 'cot:btc';
    const cached = this.cotCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.COT_TTL) return cached.data;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      // CME Bitcoin Futures COT 数据
      const res = await fetch(
        `https://data.nasdaq.com/api/v3/datasets/CFTC/133741_FO_ALL.json?api_key=${nasdaqKey}&rows=1`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`[COT] NASDAQ API 返回 ${res.status}（WAF拦截或Key无效），跳过`);
        return null;
      }
      const json = await res.json();
      const dataset = json?.dataset;
      if (!dataset?.data || dataset.data.length === 0) return null;

      const columns: string[] = dataset.column_names || [];
      const row = dataset.data[0];

      // 查找 Non-Commercial Long/Short 列索引
      const ncLongIdx = columns.findIndex(c => c.includes('Noncommercial') && c.includes('Long'));
      const ncShortIdx = columns.findIndex(c => c.includes('Noncommercial') && c.includes('Short'));
      const dateIdx = 0; // 第一列通常是日期

      const ncLong = ncLongIdx >= 0 ? (row[ncLongIdx] || 0) : 0;
      const ncShort = ncShortIdx >= 0 ? (row[ncShortIdx] || 0) : 0;

      const result: COTReportData = {
        btcNetSpeculative: ncLong - ncShort,
        reportDate: row[dateIdx] || '',
        timestamp: Date.now(),
      };

      this.cotCache.set(cacheKey, { data: result, timestamp: Date.now() });
      this.logger.log(`[COT] BTC CME 投机净头寸: ${result.btcNetSpeculative > 0 ? '+' : ''}${result.btcNetSpeculative} (${result.reportDate})`);
      return result;
    } catch (error) {
      this.logger.warn(`[COT] NASDAQ Data Link API 失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取所有增强市场数据（单一入口，并行调用，全部降级）
   * 供 quick-analysis 和 research-pipeline 调用
   */
  async fetchEnhancedMarketData(symbol: string): Promise<EnhancedMarketData> {
    const baseCurrency = symbol.split('/')[0].toUpperCase();

    const [
      longShortRatio, takerFlow, oiHistory,
      stablecoinFlows, optionsData, macroData,
      liquidationHeatmap, etfFlows, cotReport,
    ] = await Promise.all([
      this.fetchLongShortRatio(symbol).catch(() => null),
      this.fetchTakerBuySellRatio(symbol).catch(() => null),
      this.fetchOIHistory(symbol).catch(() => null),
      this.fetchStablecoinFlows().catch(() => null),
      this.fetchOptionsData(baseCurrency).catch(() => null),
      this.fetchMacroData().catch(() => null),
      this.fetchLiquidationHeatmap(symbol).catch(() => null),
      this.fetchETFFlows().catch(() => null),
      this.fetchCOTReport().catch(() => null),
    ]);

    return {
      longShortRatio: longShortRatio ?? undefined,
      takerFlow: takerFlow ?? undefined,
      oiHistory: oiHistory ?? undefined,
      stablecoinFlows: stablecoinFlows ?? undefined,
      optionsData: optionsData ?? undefined,
      macroData: macroData ?? undefined,
      liquidationHeatmap: liquidationHeatmap ?? undefined,
      etfFlows: etfFlows ?? undefined,
      cotReport: cotReport ?? undefined,
    };
  }
}
