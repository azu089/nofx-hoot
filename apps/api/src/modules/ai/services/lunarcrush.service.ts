/**
 * 社媒情绪数据服务（极速策略增强 Task 4）
 *
 * 双源设计:
 * - 有 LUNARCRUSH_API_KEY → 调用 LunarCrush v4 API（Galaxy Score、Alt Rank、Social Volume 等专业指标）
 * - 无 Key → 降级到 CoinGecko 免费 API（sentiment_votes_up_percentage，免费无需 Key）
 *
 * 参考开源项目:
 * - https://github.com/danilobatson/lunarcrush_mcp (TS, LunarCrush v4 封装)
 * - https://github.com/danilobatson/ai-trading-agent-gemini (TS/Next.js, LunarCrush + AI)
 */
import { Injectable, Logger } from '@nestjs/common';

export interface SocialSentimentData {
  /** 综合社交热度评分 (0-100) */
  galaxyScore: number | null;
  /** 在所有山寨币中的排名 (1=最热) */
  altRank: number | null;
  /** 24h 社交媒体提及量 */
  socialVolume: number | null;
  /** 社交主导度 (占全市场社交讨论比例, 0-100%) */
  socialDominance: number | null;
  /** 情绪看涨百分比 (0-100) — LunarCrush 用 sentiment*20 换算, CoinGecko 直接是百分比 */
  sentimentBullish: number;
  /** 数据来源标记 */
  source: 'lunarcrush' | 'coingecko';
}

@Injectable()
export class LunarCrushService {
  private readonly logger = new Logger(LunarCrushService.name);
  private cache = new Map<string, { data: SocialSentimentData; expireAt: number }>();
  private readonly TTL = 10 * 60 * 1000; // 10min

  /**
   * 获取指定币种的社交媒体指标（双源: LunarCrush → CoinGecko 降级）
   */
  async fetchSocialMetrics(symbol: string): Promise<SocialSentimentData | null> {
    const coin = this.symbolToCoin(symbol);
    const cacheKey = `social:${coin}`;

    // 缓存检查
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expireAt) {
      return cached.data;
    }

    // 优先 LunarCrush（有 Key 时）
    const apiKey = process.env.LUNARCRUSH_API_KEY;
    if (apiKey) {
      const result = await this.fetchFromLunarCrush(coin, apiKey);
      if (result) {
        this.cache.set(cacheKey, { data: result, expireAt: Date.now() + this.TTL });
        return result;
      }
    }

    // 降级到 CoinGecko 免费 API（无需 Key）
    const result = await this.fetchFromCoinGecko(coin);
    if (result) {
      this.cache.set(cacheKey, { data: result, expireAt: Date.now() + this.TTL });
    }
    return result;
  }

  /**
   * LunarCrush v4 API（付费，需要 Bearer token）
   */
  private async fetchFromLunarCrush(coin: string, apiKey: string): Promise<SocialSentimentData | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(
        `https://lunarcrush.com/api4/public/coins/${coin}/v1`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`[LunarCrush] API 返回 ${res.status} (${coin})`);
        return null;
      }

      const json = await res.json();
      const d = json?.data;
      if (!d) return null;

      const sentiment = d.sentiment ?? 0; // 0-5 scale
      const result: SocialSentimentData = {
        galaxyScore: d.galaxy_score ?? d.galaxyScore ?? null,
        altRank: d.alt_rank ?? d.altRank ?? null,
        socialVolume: d.social_volume ?? d.socialVolume ?? null,
        socialDominance: d.social_dominance ?? d.socialDominance ?? null,
        sentimentBullish: Math.round(sentiment * 20), // 0-5 → 0-100
        source: 'lunarcrush',
      };

      this.logger.log(
        `[LunarCrush] ${coin}: Galaxy=${result.galaxyScore}, AltRank=#${result.altRank}, ` +
        `SocialVol=${result.socialVolume}, Bullish=${result.sentimentBullish}%`,
      );
      return result;
    } catch (error) {
      this.logger.warn(`[LunarCrush] API 失败 (${coin}): ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * CoinGecko 免费 API（无需 Key，有 sentiment_votes_up_percentage）
   * API: https://api.coingecko.com/api/v3/coins/{id}
   * 免费限流: ~30 calls/min
   */
  private async fetchFromCoinGecko(coin: string): Promise<SocialSentimentData | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coin}?localization=false&tickers=false&market_data=false&community_data=true&developer_data=false`,
        { signal: controller.signal },
      );
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`[CoinGecko] API 返回 ${res.status} (${coin})`);
        return null;
      }

      const d = await res.json();
      const bullish = d.sentiment_votes_up_percentage;
      if (bullish == null) return null;

      const result: SocialSentimentData = {
        galaxyScore: null, // CoinGecko 没有这些指标
        altRank: null,
        socialVolume: null,
        socialDominance: null,
        sentimentBullish: Math.round(bullish),
        source: 'coingecko',
      };

      this.logger.log(`[CoinGecko] ${coin}: Bullish=${result.sentimentBullish}% (free tier)`);
      return result;
    } catch (error) {
      this.logger.warn(`[CoinGecko] sentiment API 失败 (${coin}): ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * 格式化为 AI prompt 段落
   */
  formatForAI(data: SocialSentimentData): string {
    const sentimentLabel = data.sentimentBullish >= 70 ? 'Very Bullish'
      : data.sentimentBullish >= 50 ? 'Bullish'
      : data.sentimentBullish >= 30 ? 'Bearish'
      : 'Very Bearish';

    const lines = [`=== Social Sentiment (${data.source === 'lunarcrush' ? 'LunarCrush' : 'CoinGecko'}) ===`];

    if (data.galaxyScore != null) lines.push(`Galaxy Score: ${data.galaxyScore}/100 | Alt Rank: #${data.altRank}`);
    if (data.socialVolume != null) lines.push(`Social Volume (24h): ${data.socialVolume.toLocaleString()} mentions`);
    if (data.socialDominance != null) lines.push(`Social Dominance: ${data.socialDominance.toFixed(2)}%`);
    lines.push(`Sentiment: ${data.sentimentBullish}% Bullish (${sentimentLabel})`);
    lines.push('NOTE: Sentiment divergence from price = potential reversal signal.');

    return lines.join('\n');
  }

  /**
   * 将 CCXT symbol 转换为 coin slug（LunarCrush 和 CoinGecko 共用）
   * 'BTC/USDT:USDT' → 'bitcoin', 'ETH/USDT:USDT' → 'ethereum'
   */
  private symbolToCoin(symbol: string): string {
    const ticker = symbol.split('/')[0].toUpperCase();
    const mapping: Record<string, string> = {
      BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana',
      BNB: 'binancecoin', XRP: 'ripple', ADA: 'cardano',
      DOGE: 'dogecoin', AVAX: 'avalanche-2', DOT: 'polkadot',
      MATIC: 'matic-network', LINK: 'chainlink', UNI: 'uniswap',
      ATOM: 'cosmos', ARB: 'arbitrum', OP: 'optimism',
      SUI: 'sui', APT: 'aptos', NEAR: 'near',
      FIL: 'filecoin', LTC: 'litecoin', PEPE: 'pepe',
      WIF: 'dogwifhat', RENDER: 'render-token', FET: 'fetch-ai',
      INJ: 'injective-protocol', TIA: 'celestia', SEI: 'sei-network',
      JUP: 'jupiter', AAVE: 'aave', MKR: 'maker',
    };
    return mapping[ticker] || ticker.toLowerCase();
  }
}
