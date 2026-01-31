import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';

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
}

// 公告
export interface Announcement {
  id: string;
  title: string;
  content?: string;
  type: 'info' | 'warning' | 'success' | 'promo';
  link?: string;
  createdAt: Date;
}

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  // 缓存数据
  private priceCache: CoinPrice[] = [];
  private newsCache: CryptoNews[] = [];
  private lastPriceUpdate: Date | null = null;
  private lastNewsUpdate: Date | null = null;

  // 缓存时间（毫秒）
  private readonly PRICE_CACHE_TTL = 30 * 1000; // 30秒
  private readonly NEWS_CACHE_TTL = 5 * 60 * 1000; // 5分钟

  // 支持的币种（CoinGecko ID -> 显示符号）
  private readonly SUPPORTED_COINS: Record<string, { symbol: string; name: string }> = {
    bitcoin: { symbol: 'BTC', name: 'Bitcoin' },
    ethereum: { symbol: 'ETH', name: 'Ethereum' },
    binancecoin: { symbol: 'BNB', name: 'BNB' },
    solana: { symbol: 'SOL', name: 'Solana' },
    ripple: { symbol: 'XRP', name: 'XRP' },
    dogecoin: { symbol: 'DOGE', name: 'Dogecoin' },
    'the-open-network': { symbol: 'TON', name: 'Toncoin' },
    cardano: { symbol: 'ADA', name: 'Cardano' },
  };

  constructor(private httpService: HttpService) {
    // 初始化时获取数据
    this.refreshPrices();
    this.refreshNews();
  }

  /**
   * 获取市场行情
   */
  async getPrices(): Promise<CoinPrice[]> {
    // 检查缓存是否有效
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
   * 获取平台公告
   */
  async getAnnouncements(): Promise<Announcement[]> {
    // 后续可以从数据库读取，目前返回硬编码数据
    return [
      {
        id: '1',
        title: '🎉 HOOT 平台正式上线，注册即送 $50 体验金',
        type: 'promo',
        createdAt: new Date(),
      },
      {
        id: '2',
        title: '📢 系统维护通知：每周日凌晨2点进行例行维护',
        type: 'info',
        createdAt: new Date(),
      },
      {
        id: '3',
        title: '🔥 新策略上线：AI趋势追踪Pro，回测年化收益 180%',
        type: 'success',
        createdAt: new Date(),
      },
    ];
  }

  /**
   * 刷新价格数据 (使用 CoinGecko API)
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  private async refreshPrices() {
    try {
      const coinIds = Object.keys(this.SUPPORTED_COINS).join(',');
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true&include_7d_change=true&include_market_cap=true&include_24hr_vol=true`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Accept: 'application/json',
          },
        }),
      );

      const data = response.data;
      const prices: CoinPrice[] = [];

      for (const [coinId, info] of Object.entries(this.SUPPORTED_COINS)) {
        const coinData = data[coinId];
        if (coinData) {
          prices.push({
            symbol: info.symbol,
            name: info.name,
            price: coinData.usd || 0,
            change24h: coinData.usd_24h_change || 0,
            change7d: coinData.usd_7d_change,
            marketCap: coinData.usd_market_cap,
            volume24h: coinData.usd_24h_vol,
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
   * 刷新新闻数据 (使用 CryptoPanic API 或备用方案)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  private async refreshNews() {
    try {
      // 尝试使用 CryptoPanic 免费 API
      // 如果没有 API Key，返回模拟数据
      const news = await this.fetchNewsFromCryptoPanic();
      if (news.length > 0) {
        this.newsCache = news;
        this.lastNewsUpdate = new Date();
        this.logger.debug(`新闻数据已更新: ${news.length} 条`);
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

    // 如果没有 API Key，返回备用数据
    if (!apiKey) {
      return this.getBackupNews();
    }

    const url = `https://cryptopanic.com/api/v1/posts/?auth_token=${apiKey}&kind=news&filter=hot&public=true`;

    const response = await firstValueFrom(
      this.httpService.get(url, {
        headers: {
          Accept: 'application/json',
        },
      }),
    );

    const data = response.data;
    return (data.results || []).slice(0, 20).map((item: any) => ({
      id: item.id?.toString() || Math.random().toString(),
      title: item.title,
      source: item.source?.title || 'Unknown',
      url: item.url,
      publishedAt: item.published_at,
      sentiment: this.mapSentiment(item.votes),
      tags: item.currencies?.map((c: any) => c.code) || [],
    }));
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
  private mapSentiment(votes: any): 'positive' | 'negative' | 'neutral' {
    if (!votes) return 'neutral';
    const positive = votes.positive || 0;
    const negative = votes.negative || 0;
    if (positive > negative * 2) return 'positive';
    if (negative > positive * 2) return 'negative';
    return 'neutral';
  }
}
