import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as ccxt from 'ccxt';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

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
 * 市场排名数据（对齐 NoFx RankingDataType: 价格涨跌幅+成交量排名）
 */
export interface MarketRankingData {
  topGainers: Array<{ symbol: string; change24h: number }>;
  topLosers: Array<{ symbol: string; change24h: number }>;
  topVolume: Array<{ symbol: string; volume24h: number }>;
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
  private readonly OHLCV_TTL = 5 * 60 * 1000; // 5 分钟
  private readonly PRICE_TTL = 30 * 1000; // 30 秒
  private readonly OI_TTL = 60 * 1000; // 1 分钟
  private readonly FUNDING_RATE_TTL = 60 * 1000; // 1 分钟
  private readonly NEWS_TTL = 15 * 60 * 1000; // 15 分钟（新闻更新不需要太频繁）

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

    // 策略 2: 用 curl 下载（curl 通过 TUN 代理更稳定）
    this.logger.log('尝试使用 curl 下载 exchangeInfo...');
    try {
      execSync(
        `curl -s --connect-timeout 15 --max-time 120 -o ${this.EXCHANGE_INFO_CACHE} https://fapi.binance.com/fapi/v1/exchangeInfo`,
        { timeout: 130000 },
      );
      const loaded = this.loadFromCacheFile();
      if (loaded) return;
    } catch (e) {
      this.logger.warn(`curl 下载失败: ${e.message}`);
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
      await this.ensureMarketsLoaded();
      this.logger.log(`获取持仓量: ${symbol}`);
      const oi = await this.retryCall<ccxt.OpenInterest>(
        `fetchOpenInterest(${symbol})`,
        () => this.exchange.fetchOpenInterest(symbol),
      );
      const result = {
        openInterest: (oi as any).openInterestAmount || (oi as any).openInterestValue || 0,
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

  /**
   * 并行获取双时间框架 OHLCV 数据
   * 产品 B 需要主时间框架（操作级别）+ 辅助时间框架（趋势级别）
   *
   * 参考 NoFx market.GetWithTimeframes() 设计
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

    this.logger.debug(`缓存清理完成，剩余 OHLCV: ${this.ohlcvCache.size}, 价格: ${this.priceCache.size}, OI: ${this.oiCache.size}, 资金费率: ${this.fundingRateCache.size}`);
  }

  // ========================= 市场排名数据 (对齐 NoFx 资金流+价格排名) =========================

  private readonly rankingCache = new Map<string, { data: MarketRankingData; timestamp: number }>();
  private readonly RANKING_TTL = 5 * 60 * 1000; // 5 分钟

  /**
   * 获取市场排名数据（对齐 NoFx RankingDataType）
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

      // 构建 URL
      const apiKey = process.env.CRYPTOPANIC_API_KEY;
      const baseUrl = 'https://cryptopanic.com/api/free/v1/posts/';
      const params = new URLSearchParams({
        currencies: currency,
        filter: 'hot',
        public: 'true',
      });
      if (apiKey) {
        params.set('auth_token', apiKey);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${baseUrl}?${params.toString()}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`[新闻] CryptoPanic API 返回 ${res.status}`);
        return [];
      }

      const data = await res.json();
      const results: CryptoNewsItem[] = (data?.results || [])
        .slice(0, limit)
        .map((item: any) => ({
          title: item.title || '',
          publishedAt: item.published_at || '',
          source: item.domain || item.source?.domain || 'unknown',
          kind: item.kind || 'news', // news | media
          sentiment: this.extractNewsSentiment(item),
          votes: {
            positive: item.votes?.positive || 0,
            negative: item.votes?.negative || 0,
            important: item.votes?.important || 0,
          },
        }));

      // 缓存
      this.newsCache.set(cacheKey, { data: results, timestamp: Date.now() });

      this.logger.log(`[新闻] ${currency}: 获取 ${results.length} 条新闻`);
      return results;
    } catch (error) {
      this.logger.warn(`[新闻] CryptoPanic API 失败: ${error.message}`);
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
}
