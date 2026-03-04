import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getLocalizedContent,
  getValidLocale,
  DEFAULT_LOCALE,
  type I18nContent,
} from '../../common/utils/i18n.util';
import WebSocket from 'ws';
import Redis from 'ioredis';

// 币种价格数据
export interface CoinPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d?: number;
  marketCap?: number;
  volume24h?: number;
  image?: string;
}

// 行业新闻
export interface CryptoNews {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  tags?: string[];
  image?: string; // 新闻配图
}

// 公告（返回给前端的格式）
export interface AnnouncementResponse {
  id: string;
  title: string;
  content?: string;
  type: string;
  link?: string;
  coverImage?: string;
  createdAt: Date;
}

// 跑马灯（返回给前端的格式）
export interface MarqueeResponse {
  id: string;
  content: string;
  link?: string;
  bgColor?: string;
  textColor?: string;
}

// 跑马灯配置
export interface MarqueeConfig {
  scrollSpeed: number; // 滚动速度（像素/秒）
  pauseOnHover: boolean; // 鼠标悬停时暂停
  displayDuration: number; // 每条消息显示时长（秒）
}

const DEFAULT_MARQUEE_CONFIG: MarqueeConfig = {
  scrollSpeed: 100,
  pauseOnHover: true,
  displayDuration: 5,
};

const MARQUEE_CONFIG_KEY = 'hoot:marquee:config';

@Injectable()
export class MarketService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketService.name);

  // Redis 连接（用于读取跑马灯配置）
  private redis: Redis;

  // 缓存数据
  private priceCache: CoinPrice[] = [];
  private newsCache: CryptoNews[] = [];
  private lastPriceUpdate: Date | null = null;
  private lastNewsUpdate: Date | null = null;

  // Binance WebSocket
  private binanceWs: WebSocket | null = null;
  private binancePrices: Map<string, { price: number; change24h: number }> =
    new Map();
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  // 缓存时间（毫秒）
  private readonly PRICE_CACHE_TTL = 5 * 1000; // 5秒（WebSocket 实时更新）
  private readonly NEWS_CACHE_TTL = 5 * 60 * 1000; // 5分钟

  // 支持的币种（Binance symbol -> 显示信息）
  private readonly SUPPORTED_COINS: Record<
    string,
    { symbol: string; name: string; image: string }
  > = {
    BTCUSDT: {
      symbol: 'BTC',
      name: 'Bitcoin',
      image:
        'https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png',
    },
    ETHUSDT: {
      symbol: 'ETH',
      name: 'Ethereum',
      image:
        'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
    },
    BNBUSDT: {
      symbol: 'BNB',
      name: 'BNB',
      image:
        'https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
    },
    SOLUSDT: {
      symbol: 'SOL',
      name: 'Solana',
      image:
        'https://coin-images.coingecko.com/coins/images/4128/large/solana.png',
    },
    XRPUSDT: {
      symbol: 'XRP',
      name: 'XRP',
      image:
        'https://coin-images.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
    },
    DOGEUSDT: {
      symbol: 'DOGE',
      name: 'Dogecoin',
      image:
        'https://coin-images.coingecko.com/coins/images/5/large/dogecoin.png',
    },
    TONUSDT: {
      symbol: 'TON',
      name: 'Toncoin',
      image:
        'https://coin-images.coingecko.com/coins/images/17980/large/photo_2024-09-10_17.09.00.jpeg',
    },
    ADAUSDT: {
      symbol: 'ADA',
      name: 'Cardano',
      image:
        'https://coin-images.coingecko.com/coins/images/975/large/cardano.png',
    },
  };

  constructor(
    private httpService: HttpService,
    private prisma: PrismaService,
  ) {
    // 初始化 Redis 连接
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
    });
  }

  onModuleInit() {
    // 启动时连接 Binance WebSocket
    this.connectBinanceWebSocket();
    // 同时获取新闻数据
    this.refreshNews();
  }

  onModuleDestroy() {
    // 关闭 WebSocket 连接
    this.disconnectBinanceWebSocket();
  }

  /**
   * 连接 Binance WebSocket 获取实时行情
   */
  private connectBinanceWebSocket() {
    const symbols = Object.keys(this.SUPPORTED_COINS).map((s) =>
      s.toLowerCase(),
    );
    // 使用组合流获取多个币种的 24h ticker
    const streams = symbols.map((s) => `${s}@ticker`).join('/');
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    this.logger.log('正在连接 Binance WebSocket...');

    try {
      const ws = new WebSocket(wsUrl);
      this.binanceWs = ws;

      ws.on('open', () => {
        this.logger.log('✅ Binance WebSocket 连接成功');
        this.reconnectAttempts = 0;
      });

      ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.data) {
            const ticker = message.data;
            const symbol = ticker.s; // e.g., "BTCUSDT"
            if (this.SUPPORTED_COINS[symbol]) {
              this.binancePrices.set(symbol, {
                price: parseFloat(ticker.c), // 最新价格
                change24h: parseFloat(ticker.P), // 24h 涨跌幅百分比
              });
              this.lastPriceUpdate = new Date();
            }
          }
        } catch {
          // 忽略解析错误
        }
      });

      ws.on('error', (error: Error) => {
        this.logger.error(`Binance WebSocket 错误: ${error.message}`);
      });

      ws.on('close', () => {
        this.logger.warn('Binance WebSocket 连接关闭，尝试重连...');
        this.scheduleReconnect();
      });
    } catch (error) {
      this.logger.error(
        `连接 Binance WebSocket 失败: ${(error as Error).message}`,
      );
      this.scheduleReconnect();
    }
  }

  /**
   * 计划重连
   */
  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.logger.error(
        'Binance WebSocket 重连次数已达上限，回退到 CoinGecko API',
      );
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // 指数退避，最大 30 秒
    this.reconnectAttempts++;

    this.logger.log(
      `将在 ${delay / 1000} 秒后重连 (第 ${this.reconnectAttempts} 次)...`,
    );

    this.reconnectTimeout = setTimeout(() => {
      this.connectBinanceWebSocket();
    }, delay);
  }

  /**
   * 断开 WebSocket 连接
   */
  private disconnectBinanceWebSocket() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.binanceWs) {
      this.binanceWs.close();
      this.binanceWs = null;
    }
  }

  /**
   * 获取市场行情（优先使用 Binance WebSocket 数据）
   */
  async getPrices(): Promise<CoinPrice[]> {
    // 如果有 Binance WebSocket 数据，直接使用
    if (this.binancePrices.size > 0) {
      const prices: CoinPrice[] = [];
      for (const [binanceSymbol, info] of Object.entries(
        this.SUPPORTED_COINS,
      )) {
        const priceData = this.binancePrices.get(binanceSymbol);
        if (priceData) {
          // 合并 CoinGecko 上次成功拿到的富数据（市值/7日涨跌/成交量）
          const existing = this.priceCache.find(p => p.symbol === info.symbol);
          prices.push({
            symbol: info.symbol,
            name: info.name,
            price: priceData.price,
            change24h: priceData.change24h,
            image: info.image,
            marketCap: existing?.marketCap,
            change7d: existing?.change7d,
            volume24h: existing?.volume24h,
          });
        }
      }
      if (prices.length > 0) {
        this.priceCache = prices;
        return prices;
      }
    }

    // 回退到 CoinGecko API（如果 WebSocket 不可用）
    if (
      this.priceCache.length > 0 &&
      this.lastPriceUpdate &&
      Date.now() - this.lastPriceUpdate.getTime() < this.PRICE_CACHE_TTL
    ) {
      return this.priceCache;
    }

    // 刷新缓存
    await this.refreshPrices();
    return this.priceCache;
  }

  /**
   * 获取单个合约币种的最新价格（供前端调用，避免前端直连 Binance 违反 CSP）
   * 优先读 WebSocket 缓存，缓存无则调 Binance Futures REST API
   */
  async getSymbolPrice(symbol: string): Promise<number> {
    const sym = symbol.toUpperCase();
    // 1. WebSocket 缓存（实时，最优先）
    const cached = this.binancePrices.get(sym);
    if (cached) return cached.price;

    // 2. 调 Binance Futures REST（服务端没有 CSP 限制）
    try {
      const resp = await fetch(
        `https://fapi.binance.com/fapi/v1/ticker/price?symbol=${sym}`,
      );
      const data = await resp.json() as { price?: string };
      const price = parseFloat(data.price ?? '0');
      if (price > 0) return price;
    } catch {
      // 忽略，返回 0
    }
    return 0;
  }

  /**
   * 获取行业新闻
   */
  async getNews(limit = 10): Promise<CryptoNews[]> {
    // 检查缓存是否有效
    if (
      this.newsCache.length > 0 &&
      this.lastNewsUpdate &&
      Date.now() - this.lastNewsUpdate.getTime() < this.NEWS_CACHE_TTL
    ) {
      return this.newsCache.slice(0, limit);
    }

    // 刷新缓存
    await this.refreshNews();
    return this.newsCache.slice(0, limit);
  }

  /**
   * 获取平台公告（支持多语言）
   * @param locale - 语言代码（如 zh-CN, en, ja 等）
   * @param position - 位置筛选（home, popup, marquee, all）
   */
  async getAnnouncements(
    locale: string = DEFAULT_LOCALE,
    position?: string,
  ): Promise<AnnouncementResponse[]> {
    const validLocale = getValidLocale(locale);

    try {
      // 从数据库获取公告
      const announcements = await this.prisma.announcement.findMany({
        where: {
          status: 'published',
          ...(position && position !== 'all' ? { position } : {}),
          OR: [{ expiredAt: null }, { expiredAt: { gt: new Date() } }],
        },
        orderBy: [{ priority: 'desc' }, { publishedAt: 'desc' }],
        take: 20,
      });

      // 转换为多语言响应
      return announcements.map((a) => ({
        id: a.id,
        title: getLocalizedContent(
          a.titleI18n as I18nContent,
          validLocale,
          a.title,
        ),
        content: getLocalizedContent(
          a.contentI18n as I18nContent,
          validLocale,
          a.content,
        ),
        type: a.type,
        link: a.link || undefined,
        coverImage: a.coverImage || undefined,
        createdAt: a.createdAt,
      }));
    } catch (error) {
      this.logger.warn(
        `获取公告失败: ${(error as Error).message}，使用备用数据`,
      );
      // 数据库不可用时返回备用数据
      return this.getBackupAnnouncements(validLocale);
    }
  }

  /**
   * 获取跑马灯（支持多语言）
   */
  async getMarquees(
    locale: string = DEFAULT_LOCALE,
  ): Promise<MarqueeResponse[]> {
    const validLocale = getValidLocale(locale);

    try {
      const marquees = await this.prisma.marquee.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });

      return marquees.map((m) => ({
        id: m.id,
        content: getLocalizedContent(
          m.contentI18n as I18nContent,
          validLocale,
          m.content,
        ),
        link: m.link || undefined,
        bgColor: m.bgColor || undefined,
        textColor: m.textColor || undefined,
      }));
    } catch (error) {
      this.logger.warn(`获取跑马灯失败: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 获取跑马灯配置（公开接口）
   */
  async getMarqueeConfig(): Promise<MarqueeConfig> {
    try {
      const configStr = await this.redis.get(MARQUEE_CONFIG_KEY);
      if (configStr) {
        return JSON.parse(configStr);
      }
    } catch (error) {
      this.logger.warn(`获取跑马灯配置失败: ${(error as Error).message}`);
    }
    return DEFAULT_MARQUEE_CONFIG;
  }

  /**
   * 备用公告数据（当数据库不可用时）
   */
  private getBackupAnnouncements(locale: string): AnnouncementResponse[] {
    const isEnglish = locale === 'en';
    return [
      {
        id: '1',
        title: isEnglish
          ? '🎉 HOOT platform launched! Register to get $50 bonus'
          : '🎉 HOOT 平台正式上线，注册即送 $50 体验金',
        type: 'activity',
        createdAt: new Date(),
      },
      {
        id: '2',
        title: isEnglish
          ? '📢 System maintenance every Sunday at 2 AM'
          : '📢 系统维护通知：每周日凌晨2点进行例行维护',
        type: 'system',
        createdAt: new Date(),
      },
      {
        id: '3',
        title: isEnglish
          ? '🔥 New strategy: AI Trend Tracker Pro, 180% annualized backtest return'
          : '🔥 新策略上线：AI趋势追踪Pro，回测年化收益 180%',
        type: 'system',
        createdAt: new Date(),
      },
    ];
  }

  /**
   * 刷新价格数据 (使用 CoinGecko API - 带市值/7日涨跌/成交量等富数据)
   * 5分钟一次：实时价格由 Binance WebSocket 提供，CoinGecko 只补充富数据
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  private async refreshPrices() {
    try {
      const coinIds = Object.keys(this.SUPPORTED_COINS).join(',');
      // 使用 /coins/markets API 获取完整数据包括图标
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIds}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h,7d`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Accept: 'application/json',
          },
        }),
      );

      const data = response.data;
      const prices: CoinPrice[] = [];

      for (const coin of data) {
        const info = this.SUPPORTED_COINS[coin.id];
        if (info) {
          prices.push({
            symbol: info.symbol,
            name: info.name,
            price: coin.current_price || 0,
            change24h: coin.price_change_percentage_24h || 0,
            change7d: coin.price_change_percentage_7d_in_currency,
            marketCap: coin.market_cap,
            volume24h: coin.total_volume,
            image: coin.image, // 币种图标 URL
          });
        }
      }

      this.priceCache = prices;
      this.lastPriceUpdate = new Date();
      this.logger.debug(`价格数据已更新: ${prices.length} 个币种`);
    } catch (error) {
      this.logger.warn(`获取价格数据失败: ${(error as Error).message}`);
      // 保留旧缓存
    }
  }

  /**
   * 刷新新闻数据 (优先 CryptoCompare，备选 CryptoPanic)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  private async refreshNews() {
    try {
      // 优先使用 CryptoCompare API（更稳定）
      let news = await this.fetchNewsFromCryptoCompare();

      // 如果 CryptoCompare 失败，尝试 CryptoPanic
      if (news.length === 0) {
        this.logger.log('CryptoCompare 无数据，尝试 CryptoPanic...');
        news = await this.fetchNewsFromCryptoPanic();
      }

      if (news.length > 0) {
        this.newsCache = news;
        this.lastNewsUpdate = new Date();
        this.logger.log(`✅ 新闻数据已更新: ${news.length} 条`);
      } else {
        // 使用备用数据
        this.newsCache = this.getBackupNews();
        this.lastNewsUpdate = new Date();
        this.logger.warn('使用备用新闻数据');
      }
    } catch (error) {
      this.logger.warn(`获取新闻数据失败: ${(error as Error).message}`);
      // 使用备用数据
      this.newsCache = this.getBackupNews();
      this.lastNewsUpdate = new Date();
    }
  }

  /**
   * 从 CryptoPanic 获取新闻
   */
  private async fetchNewsFromCryptoPanic(): Promise<CryptoNews[]> {
    const apiKey = process.env.CRYPTOPANIC_API_KEY;

    if (!apiKey) {
      this.logger.debug('未配置 CRYPTOPANIC_API_KEY');
      return [];
    }

    try {
      // 使用 rising 过滤器获取热门上升新闻，支持的币种
      const url = `https://cryptopanic.com/api/v1/posts/?auth_token=${apiKey}&kind=news&filter=rising&currencies=BTC,ETH,BNB,SOL,XRP,DOGE,TON,ADA&public=true`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: { Accept: 'application/json' },
          timeout: 10000,
        }),
      );

      const data = response.data;
      interface CryptoPanicItem {
        id: string | number;
        title: string;
        source?: { title?: string; domain?: string };
        url: string;
        published_at: string;
        votes?: Record<string, unknown>;
        currencies?: { code: string }[];
      }
      const news = (data.results || []).slice(0, 15).map((item: CryptoPanicItem) => ({
        id: `cp_${item.id}`,
        title: item.title,
        source: item.source?.title || item.source?.domain || 'CryptoPanic',
        url: item.url,
        publishedAt: item.published_at,
        sentiment: this.mapSentiment(item.votes),
        tags: item.currencies?.map((c) => c.code) || [],
      }));

      this.logger.debug(`CryptoPanic 返回 ${news.length} 条新闻`);
      return news;
    } catch (error) {
      this.logger.warn(`CryptoPanic API 错误: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 从 CryptoCompare 获取新闻（备选方案）
   */
  private async fetchNewsFromCryptoCompare(): Promise<CryptoNews[]> {
    const apiKey = process.env.CRYPTOCOMPARE_API_KEY;

    if (!apiKey) {
      this.logger.debug('未配置 CRYPTOCOMPARE_API_KEY');
      return [];
    }

    try {
      // CryptoCompare 新闻 API
      const url =
        'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=popular';

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Accept: 'application/json',
            authorization: `Apikey ${apiKey}`,
          },
          timeout: 10000,
        }),
      );

      const data = response.data;
      interface CryptoCompareItem {
        id: string | number;
        title: string;
        source_info?: { name?: string };
        source?: string;
        url: string;
        published_on: number;
        sentiment?: string;
        categories?: string;
        imageurl?: string;
      }
      const news = (data.Data || []).slice(0, 25).map((item: CryptoCompareItem) => ({
        id: `cc_${item.id}`,
        title: item.title,
        source: item.source_info?.name || item.source || 'CryptoCompare',
        url: item.url,
        publishedAt: new Date(item.published_on * 1000).toISOString(),
        sentiment: this.mapCryptoCompareSentiment(item.sentiment),
        tags: item.categories?.split('|').slice(0, 3) || [],
        image: item.imageurl || null, // 新闻配图
      }));

      this.logger.debug(`CryptoCompare 返回 ${news.length} 条新闻`);
      return news;
    } catch (error) {
      this.logger.warn(`CryptoCompare API 错误: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 映射 CryptoCompare 情绪
   */
  private mapCryptoCompareSentiment(
    sentiment: string | undefined,
  ): 'positive' | 'negative' | 'neutral' {
    if (!sentiment) return 'neutral';
    const lower = sentiment.toLowerCase();
    if (lower === 'positive' || lower === 'bullish') return 'positive';
    if (lower === 'negative' || lower === 'bearish') return 'negative';
    return 'neutral';
  }

  /**
   * 备用新闻数据
   */
  private getBackupNews(): CryptoNews[] {
    return [
      {
        id: '1',
        title: 'Bitcoin突破历史新高，机构投资者持续加仓',
        source: 'CoinDesk',
        url: 'https://coindesk.com',
        publishedAt: new Date().toISOString(),
        sentiment: 'positive',
        tags: ['BTC'],
      },
      {
        id: '2',
        title: 'Ethereum完成重大升级，交易费用显著降低',
        source: 'The Block',
        url: 'https://theblock.co',
        publishedAt: new Date(Date.now() - 3600000).toISOString(),
        sentiment: 'positive',
        tags: ['ETH'],
      },
      {
        id: '3',
        title: 'TON生态持续扩张，Telegram用户活跃度创新高',
        source: 'Decrypt',
        url: 'https://decrypt.co',
        publishedAt: new Date(Date.now() - 7200000).toISOString(),
        sentiment: 'positive',
        tags: ['TON'],
      },
      {
        id: '4',
        title: 'DeFi总锁仓量突破新高，用户增长势头强劲',
        source: 'DeFi Llama',
        url: 'https://defillama.com',
        publishedAt: new Date(Date.now() - 10800000).toISOString(),
        sentiment: 'neutral',
        tags: ['DeFi'],
      },
      {
        id: '5',
        title: '美联储官员暗示可能调整货币政策，加密市场反应积极',
        source: 'Bloomberg',
        url: 'https://bloomberg.com',
        publishedAt: new Date(Date.now() - 14400000).toISOString(),
        sentiment: 'positive',
        tags: ['Market'],
      },
    ];
  }

  /**
   * 映射情绪分析
   */
  private mapSentiment(votes: Record<string, unknown> | undefined): 'positive' | 'negative' | 'neutral' {
    if (!votes) return 'neutral';
    const positive = Number(votes.positive) || 0;
    const negative = Number(votes.negative) || 0;
    if (positive > negative * 2) return 'positive';
    if (negative > positive * 2) return 'negative';
    return 'neutral';
  }
}
