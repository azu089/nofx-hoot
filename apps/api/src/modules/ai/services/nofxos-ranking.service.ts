/**
 * NofxOS 排名数据服务
 *
 * 移植自 nofx reference/nofx/provider/nofxos/（oi.go, netflow.go, price.go, client.go）
 * 提供 OI 排名、资金流向排名、涨跌幅排名数据，注入 AI Prompt 辅助决策。
 *
 * API: https://nofxos.ai
 * Auth: URL query param ?auth=xxx
 */
import { Injectable, Logger } from '@nestjs/common';

// ==================== 类型定义（对齐 nofx Go 结构体） ====================

/** OI 单个持仓数据（nofxos/oi.go:OIPosition） */
export interface OIPosition {
  symbol: string;
  rank: number;
  price: number;
  currentOI: number;           // current_oi
  oiDelta: number;             // oi_delta
  oiDeltaPercent: number;      // oi_delta_percent (已×100, 5.0=5%)
  oiDeltaValue: number;        // oi_delta_value (USDT)
  priceDeltaPercent: number;   // price_delta_percent (已×100)
  netLong: number;             // net_long
  netShort: number;            // net_short
}

/** OI 排名数据（nofxos/oi.go:OIRankingData） */
export interface OIRankingData {
  timeRange: string;
  duration: string;
  topPositions: OIPosition[];
  lowPositions: OIPosition[];
  fetchedAt: Date;
}

/** 资金流向单个数据（nofxos/netflow.go:NetFlowPosition） */
export interface NetFlowPosition {
  rank: number;
  symbol: string;
  amount: number;   // USDT, 正=流入, 负=流出
  price: number;
}

/** 资金流向排名数据（nofxos/netflow.go:NetFlowRankingData） */
export interface NetFlowRankingData {
  duration: string;
  timeRange: string;
  institutionFutureTop: NetFlowPosition[];  // 机构合约资金流入 Top
  institutionFutureLow: NetFlowPosition[];  // 机构合约资金流出 Top
  personalFutureTop: NetFlowPosition[];     // 散户合约买入 Top
  personalFutureLow: NetFlowPosition[];     // 散户合约卖出 Top
  fetchedAt: Date;
}

/** 价格排名单条数据（nofxos/price.go:PriceRankingItem） */
export interface PriceRankingItem {
  pair: string;
  symbol: string;
  priceDelta: number;      // 小数制: 0.0723=7.23%
  price: number;
  futureFlow: number;      // 合约资金流 (USDT)
  spotFlow: number;        // 现货资金流 (USDT)
  oi: number;              // 持仓量 (USDT)
  oiDelta: number;         // 持仓量变化
  oiDeltaValue: number;    // 持仓量变化价值 (USDT)
}

/** 单时段涨跌榜（nofxos/price.go:PriceRankingDuration） */
export interface PriceRankingDuration {
  top: PriceRankingItem[];
  low: PriceRankingItem[];
}

/** 价格排名数据（nofxos/price.go:PriceRankingData） */
export interface PriceRankingData {
  durations: Record<string, PriceRankingDuration>;  // "1h"→{top,low}, "4h"→...
  fetchedAt: Date;
}

// ==================== 缓存项 ====================

interface CacheEntry<T> {
  data: T;
  expireAt: number;
}

// ==================== 服务 ====================

@Injectable()
export class NofxosRankingService {
  private readonly logger = new Logger(NofxosRankingService.name);
  private readonly baseUrl: string;
  private readonly authKey: string;
  private readonly timeout = 10_000; // 10s
  private readonly cacheTTL = 5 * 60 * 1000; // 5min

  // 内存缓存
  private cache = new Map<string, CacheEntry<any>>();

  constructor() {
    this.baseUrl = process.env.NOFXOS_API_URL || 'https://nofxos.ai';
    this.authKey = process.env.NOFXOS_AUTH_KEY ?? '';
    if (!this.authKey) {
      this.logger.warn('NOFXOS_AUTH_KEY 未配置，NofxOS 排名数据请求将失败');
    }
    this.logger.log(`NofxOS 客户端初始化: ${this.baseUrl}`);
  }

  // ==================== OI 排名 ====================

  async fetchOIRanking(duration = '1h', limit = 20): Promise<OIRankingData | null> {
    const cacheKey = `oi_${duration}_${limit}`;
    const cached = this.getCache<OIRankingData>(cacheKey);
    if (cached) return cached;

    try {
      const [topRes, lowRes] = await Promise.all([
        this.doRequest(`/api/oi/top-ranking?limit=${limit}&duration=${duration}`),
        this.doRequest(`/api/oi/low-ranking?limit=${limit}&duration=${duration}`),
      ]);

      const result: OIRankingData = {
        duration,
        timeRange: topRes?.data?.time_range || duration,
        topPositions: this.parseOIPositions(topRes?.data?.positions),
        lowPositions: this.parseOIPositions(lowRes?.data?.positions),
        fetchedAt: new Date(),
      };

      this.logger.log(
        `📊 OI排名获取成功: ${result.topPositions.length} top, ${result.lowPositions.length} low (${duration})`,
      );
      this.setCache(cacheKey, result);
      return result;
    } catch (e: any) {
      this.logger.warn(`📊 OI排名获取失败: ${e.message}`);
      return null;
    }
  }

  private parseOIPositions(raw: any[]): OIPosition[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((p) => ({
      symbol: p.symbol ?? '',
      rank: p.rank ?? 0,
      price: p.price ?? 0,
      currentOI: p.current_oi ?? 0,
      oiDelta: p.oi_delta ?? 0,
      oiDeltaPercent: p.oi_delta_percent ?? 0,
      oiDeltaValue: p.oi_delta_value ?? 0,
      priceDeltaPercent: p.price_delta_percent ?? 0,
      netLong: p.net_long ?? 0,
      netShort: p.net_short ?? 0,
    }));
  }

  // ==================== 资金流向排名 ====================

  async fetchNetFlowRanking(duration = '1h', limit = 10): Promise<NetFlowRankingData | null> {
    const cacheKey = `netflow_${duration}_${limit}`;
    const cached = this.getCache<NetFlowRankingData>(cacheKey);
    if (cached) return cached;

    try {
      const [instTop, instLow, persTop, persLow] = await Promise.all([
        this.doRequest(`/api/netflow/top-ranking?limit=${limit}&duration=${duration}&type=institution&trade=future`),
        this.doRequest(`/api/netflow/low-ranking?limit=${limit}&duration=${duration}&type=institution&trade=future`),
        this.doRequest(`/api/netflow/top-ranking?limit=${limit}&duration=${duration}&type=personal&trade=future`),
        this.doRequest(`/api/netflow/low-ranking?limit=${limit}&duration=${duration}&type=personal&trade=future`),
      ]);

      const result: NetFlowRankingData = {
        duration,
        timeRange: instTop?.data?.time_range || duration,
        institutionFutureTop: this.parseNetFlowPositions(instTop?.data?.netflows),
        institutionFutureLow: this.parseNetFlowPositions(instLow?.data?.netflows),
        personalFutureTop: this.parseNetFlowPositions(persTop?.data?.netflows),
        personalFutureLow: this.parseNetFlowPositions(persLow?.data?.netflows),
        fetchedAt: new Date(),
      };

      this.logger.log(
        `💰 资金流排名获取成功: inst_in=${result.institutionFutureTop.length}, inst_out=${result.institutionFutureLow.length}, ` +
        `retail_in=${result.personalFutureTop.length}, retail_out=${result.personalFutureLow.length} (${duration})`,
      );
      this.setCache(cacheKey, result);
      return result;
    } catch (e: any) {
      this.logger.warn(`💰 资金流排名获取失败: ${e.message}`);
      return null;
    }
  }

  private parseNetFlowPositions(raw: any[]): NetFlowPosition[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((p) => ({
      rank: p.rank ?? 0,
      symbol: p.symbol ?? '',
      amount: p.amount ?? 0,
      price: p.price ?? 0,
    }));
  }

  // ==================== 价格排名 ====================

  async fetchPriceRanking(durations = '1h,4h,24h', limit = 10): Promise<PriceRankingData | null> {
    const cacheKey = `price_${durations}_${limit}`;
    const cached = this.getCache<PriceRankingData>(cacheKey);
    if (cached) return cached;

    try {
      const res = await this.doRequest(`/api/price/ranking?duration=${durations}&limit=${limit}`);

      const result: PriceRankingData = {
        durations: {},
        fetchedAt: new Date(),
      };

      const rawData = res?.data?.data;
      if (rawData && typeof rawData === 'object') {
        for (const [dur, data] of Object.entries(rawData)) {
          const d = data as any;
          result.durations[dur] = {
            top: this.parsePriceRankingItems(d?.top),
            low: this.parsePriceRankingItems(d?.low),
          };
        }
      }

      this.logger.log(`📈 涨跌幅排名获取成功: ${Object.keys(result.durations).length} 个时段`);
      this.setCache(cacheKey, result);
      return result;
    } catch (e: any) {
      this.logger.warn(`📈 涨跌幅排名获取失败: ${e.message}`);
      return null;
    }
  }

  private parsePriceRankingItems(raw: any[]): PriceRankingItem[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((p) => ({
      pair: p.pair ?? '',
      symbol: p.symbol ?? '',
      priceDelta: p.price_delta ?? 0,
      price: p.price ?? 0,
      futureFlow: p.future_flow ?? 0,
      spotFlow: p.spot_flow ?? 0,
      oi: p.oi ?? 0,
      oiDelta: p.oi_delta ?? 0,
      oiDeltaValue: p.oi_delta_value ?? 0,
    }));
  }

  // ==================== Format 方法（对齐 nofx FormatXXXForAI） ====================

  /** 格式化 OI 排名为 AI Prompt 段落（对齐 nofxos/oi.go:formatOIRankingEN） */
  formatOIRankingForAI(data: OIRankingData | null): string {
    if (!data) return '';
    const lines: string[] = [];
    lines.push(`## Open Interest Changes (${data.duration})\n`);

    if (data.topPositions.length > 0) {
      lines.push('### OI Increase Ranking');
      lines.push('Capital inflow signals - trend continuation or new positions:\n');
      lines.push('| Rank | Symbol | OI Change (USDT) | OI Change % | Price Change % |');
      lines.push('|------|--------|------------------|-------------|----------------|');
      for (const pos of data.topPositions) {
        lines.push(`| ${pos.rank} | ${pos.symbol} | ${this.fmtValue(pos.oiDeltaValue)} | ${pos.oiDeltaPercent >= 0 ? '+' : ''}${pos.oiDeltaPercent.toFixed(2)}% | ${pos.priceDeltaPercent >= 0 ? '+' : ''}${pos.priceDeltaPercent.toFixed(2)}% |`);
      }
      lines.push('');
    }

    if (data.lowPositions.length > 0) {
      lines.push('### OI Decrease Ranking');
      lines.push('Capital outflow signals - trend reversal or position closing:\n');
      lines.push('| Rank | Symbol | OI Change (USDT) | OI Change % | Price Change % |');
      lines.push('|------|--------|------------------|-------------|----------------|');
      for (const pos of data.lowPositions) {
        lines.push(`| ${pos.rank} | ${pos.symbol} | ${this.fmtValue(pos.oiDeltaValue)} | ${pos.oiDeltaPercent >= 0 ? '+' : ''}${pos.oiDeltaPercent.toFixed(2)}% | ${pos.priceDeltaPercent >= 0 ? '+' : ''}${pos.priceDeltaPercent.toFixed(2)}% |`);
      }
      lines.push('');
    }

    lines.push('**Key**: OI↑+Price↑=Bulls dominant | OI↑+Price↓=Bears dominant | OI↓+Price↑=Short covering | OI↓+Price↓=Long liquidation\n');
    return lines.join('\n');
  }

  /** 格式化资金流向排名为 AI Prompt 段落（对齐 nofxos/netflow.go:formatNetFlowRankingEN） */
  formatNetFlowRankingForAI(data: NetFlowRankingData | null): string {
    if (!data) return '';
    const lines: string[] = [];
    lines.push(`## Fund Flow Ranking (${data.duration})\n`);

    if (data.institutionFutureTop.length > 0) {
      lines.push('### Institution Inflow (Smart Money Buy)');
      lines.push('| Rank | Symbol | Inflow (USDT) | Price |');
      lines.push('|------|--------|---------------|-------|');
      for (const pos of data.institutionFutureTop) {
        lines.push(`| ${pos.rank} | ${pos.symbol} | ${this.fmtValue(pos.amount)} | $${pos.price.toFixed(4)} |`);
      }
      lines.push('');
    }

    if (data.institutionFutureLow.length > 0) {
      lines.push('### Institution Outflow (Smart Money Sell)');
      lines.push('| Rank | Symbol | Outflow (USDT) | Price |');
      lines.push('|------|--------|----------------|-------|');
      for (const pos of data.institutionFutureLow) {
        lines.push(`| ${pos.rank} | ${pos.symbol} | ${this.fmtValue(pos.amount)} | $${pos.price.toFixed(4)} |`);
      }
      lines.push('');
    }

    // 散户资金动向摘要
    if (data.personalFutureTop.length > 0 || data.personalFutureLow.length > 0) {
      lines.push('### Retail Flow Summary');
      if (data.personalFutureTop.length > 0) {
        const top3 = data.personalFutureTop.slice(0, 3).map(p => `${p.symbol}(${this.fmtValue(p.amount)})`).join(', ');
        lines.push(`Retail buy: ${top3}`);
      }
      if (data.personalFutureLow.length > 0) {
        const low3 = data.personalFutureLow.slice(0, 3).map(p => `${p.symbol}(${this.fmtValue(p.amount)})`).join(', ');
        lines.push(`Retail sell: ${low3}`);
      }
      lines.push('');
    }

    lines.push('**Key**: Institution buy + Retail sell = Strong bullish | Institution sell + Retail buy = Strong bearish\n');
    return lines.join('\n');
  }

  /** 格式化涨跌幅排名为 AI Prompt 段落（对齐 nofxos/price.go:formatPriceRankingEN） */
  formatPriceRankingForAI(data: PriceRankingData | null): string {
    if (!data || Object.keys(data.durations).length === 0) return '';
    const lines: string[] = [];
    lines.push('## Price Gainers/Losers\n');

    const durationOrder = ['1h', '4h', '24h'];
    for (const dur of durationOrder) {
      const d = data.durations[dur];
      if (!d) continue;

      lines.push(`### ${dur} Price Change\n`);

      if (d.top.length > 0) {
        lines.push('**Top Gainers**');
        lines.push('| Symbol | Change | Price | Fund Flow | OI Change |');
        lines.push('|--------|--------|-------|-----------|-----------|');
        for (const item of d.top) {
          lines.push(`| ${item.symbol} | ${item.priceDelta >= 0 ? '+' : ''}${(item.priceDelta * 100).toFixed(2)}% | $${item.price.toFixed(4)} | ${this.fmtValue(item.futureFlow)} | ${this.fmtValue(item.oiDeltaValue)} |`);
        }
        lines.push('');
      }

      if (d.low.length > 0) {
        lines.push('**Top Losers**');
        lines.push('| Symbol | Change | Price | Fund Flow | OI Change |');
        lines.push('|--------|--------|-------|-----------|-----------|');
        for (const item of d.low) {
          lines.push(`| ${item.symbol} | ${(item.priceDelta * 100).toFixed(2)}% | $${item.price.toFixed(4)} | ${this.fmtValue(item.futureFlow)} | ${this.fmtValue(item.oiDeltaValue)} |`);
        }
        lines.push('');
      }
    }

    lines.push('**Key**: Big gain + Fund inflow + OI increase = Strong bullish | Big drop + Fund outflow + OI decrease = Weak bearish\n');
    return lines.join('\n');
  }

  // ==================== 内部工具 ====================

  /** 格式化数值（对齐 nofxos/util.go:formatValue） */
  private fmtValue(v: number): string {
    const sign = v >= 0 ? '+' : '';
    const abs = Math.abs(v);
    if (abs >= 1e9) return `${sign}${(v / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}${(v / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${sign}${(v / 1e3).toFixed(2)}K`;
    return `${sign}${v.toFixed(2)}`;
  }

  /** HTTP GET 请求（对齐 nofxos/client.go:doRequest） */
  private async doRequest(endpoint: string): Promise<any> {
    const sep = endpoint.includes('?') ? '&' : '?';
    const url = `${this.baseUrl}${endpoint}${sep}auth=${this.authKey}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();
      if (json.success === false) {
        throw new Error(`API error: code=${json.code ?? 'unknown'}`);
      }
      return json;
    } finally {
      clearTimeout(timer);
    }
  }

  /** 缓存读取 */
  private getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() < entry.expireAt) {
      return entry.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  /** 缓存写入 */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, expireAt: Date.now() + this.cacheTTL });
  }
}
