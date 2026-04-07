/**
 * Alpha Vantage 股价 & 技术指标
 * 对应 Python: tradingagents/dataflows/av_utils.py (price + indicator 部分)
 *
 * API Key 从环境变量 ALPHA_VANTAGE_API_KEY 读取
 * 所有函数返回 string，错误时返回描述性字符串而非抛出
 */

import axios from 'axios';

const BASE_URL = 'https://www.alphavantage.co/query';

function getApiKey(): string {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) {
    throw new Error('ALPHA_VANTAGE_API_KEY environment variable is not set');
  }
  return key;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

// ─────────────────────────────────────────────
// 1. 日线股价数据
// ─────────────────────────────────────────────

interface AVDailyTimeSeriesEntry {
  '1. open': string;
  '2. high': string;
  '3. low': string;
  '4. close': string;
  '5. volume': string;
}

interface AVDailyResponse {
  'Meta Data'?: {
    '2. Symbol': string;
    '3. Last Refreshed': string;
  };
  'Time Series (Daily)'?: Record<string, AVDailyTimeSeriesEntry>;
  'Note'?: string;
  'Information'?: string;
  'Error Message'?: string;
}

/**
 * 获取股票日线 OHLCV 数据（使用 AV TIME_SERIES_DAILY 全量拉取，本地过滤日期）
 * @param symbol    股票代码，如 "AAPL"
 * @param startDate 起始日期 "YYYY-MM-DD"
 * @param endDate   结束日期 "YYYY-MM-DD"（防前瞻偏差）
 */
export async function getStockAV(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<string> {
  try {
    const apiKey = getApiKey();
    const resp = await axios.get<AVDailyResponse>(BASE_URL, {
      params: {
        function: 'TIME_SERIES_DAILY',
        symbol,
        outputsize: 'full',
        apikey: apiKey,
      },
      timeout: 30_000,
    });

    const data = resp.data;

    if (data['Error Message']) {
      return `Alpha Vantage error for ${symbol}: ${data['Error Message']}`;
    }
    if (data['Note'] || data['Information']) {
      return `Alpha Vantage rate limit reached. Message: ${data['Note'] ?? data['Information']}`;
    }

    const timeSeries = data['Time Series (Daily)'];
    if (!timeSeries) {
      return `No time series data returned for ${symbol}`;
    }

    const start = parseDate(startDate).getTime();
    const end = parseDate(endDate).getTime();

    const header = 'Date,Open,High,Low,Close,Volume';
    const rows: string[] = [];

    // AV 返回的日期键是 "YYYY-MM-DD"，按日期排序
    const sortedDates = Object.keys(timeSeries).sort();

    for (const dateStr of sortedDates) {
      const d = parseDate(dateStr).getTime();
      if (d < start || d > end) continue;

      const entry = timeSeries[dateStr];
      rows.push(
        [
          dateStr,
          entry['1. open'],
          entry['2. high'],
          entry['3. low'],
          entry['4. close'],
          entry['5. volume'],
        ].join(','),
      );
    }

    if (rows.length === 0) {
      return `No data for ${symbol} between ${startDate} and ${endDate}`;
    }

    return [header, ...rows].join('\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching AV stock data for ${symbol}: ${msg}`;
  }
}

// ─────────────────────────────────────────────
// 2. 技术指标
// ─────────────────────────────────────────────

/** AV 技术指标 API 通用响应结构 */
interface AVIndicatorMeta {
  '1: Symbol'?: string;
  '2: Indicator'?: string;
}

interface AVIndicatorResponse {
  'Meta Data'?: AVIndicatorMeta;
  [key: string]: unknown; // 'Technical Analysis: SMA' 等动态键
  'Note'?: string;
  'Information'?: string;
  'Error Message'?: string;
}

type AVSupportedIndicator = 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'BBANDS' | 'ATR';

/** 将 indicator 字符串规范化为 AV 函数名 */
function normalizeIndicator(indicator: string): AVSupportedIndicator | null {
  const map: Record<string, AVSupportedIndicator> = {
    sma: 'SMA',
    ema: 'EMA',
    rsi: 'RSI',
    macd: 'MACD',
    bbands: 'BBANDS',
    boll: 'BBANDS',
    atr: 'ATR',
  };
  return map[indicator.toLowerCase()] ?? null;
}

/**
 * 获取技术指标数据（AV 版），返回 CSV 格式
 * @param symbol    股票代码
 * @param indicator 指标名：SMA / EMA / RSI / MACD / BBANDS / ATR
 * @param currDate  当前日期（只返回 <= currDate 的数据，防前瞻偏差）
 */
export async function getIndicatorAV(
  symbol: string,
  indicator: string,
  currDate: string,
): Promise<string> {
  try {
    const apiKey = getApiKey();
    const func = normalizeIndicator(indicator);

    if (!func) {
      return `Unsupported indicator: "${indicator}". Supported: SMA, EMA, RSI, MACD, BBANDS, ATR`;
    }

    // 各指标的默认参数
    const baseParams: Record<string, string | number> = {
      function: func,
      symbol,
      interval: 'daily',
      apikey: apiKey,
    };

    if (func === 'SMA' || func === 'EMA') {
      baseParams['time_period'] = 50;
      baseParams['series_type'] = 'close';
    } else if (func === 'RSI') {
      baseParams['time_period'] = 14;
      baseParams['series_type'] = 'close';
    } else if (func === 'BBANDS') {
      baseParams['time_period'] = 20;
      baseParams['series_type'] = 'close';
      baseParams['nbdevup'] = 2;
      baseParams['nbdevdn'] = 2;
    } else if (func === 'ATR') {
      baseParams['time_period'] = 14;
    }
    // MACD 使用默认参数（12/26/9），无需额外指定

    const resp = await axios.get<AVIndicatorResponse>(BASE_URL, {
      params: baseParams,
      timeout: 30_000,
    });

    const data = resp.data;

    if (data['Error Message']) {
      return `Alpha Vantage error for ${symbol} ${func}: ${data['Error Message']}`;
    }
    if (data['Note'] || data['Information']) {
      return `Alpha Vantage rate limit. Message: ${data['Note'] ?? data['Information']}`;
    }

    // 找到动态键（Technical Analysis: SMA 等）
    const dataKey = Object.keys(data).find(k => k.startsWith('Technical Analysis'));
    if (!dataKey) {
      return `No technical analysis data returned for ${symbol} ${func}`;
    }

    const series = data[dataKey] as Record<string, Record<string, string>>;
    const cutoff = parseDate(currDate).getTime();

    const sortedDates = Object.keys(series)
      .filter(d => parseDate(d).getTime() <= cutoff)
      .sort();

    if (sortedDates.length === 0) {
      return `No ${func} data for ${symbol} on or before ${currDate}`;
    }

    // 构建 CSV：第一行取字段名，后续行取值
    const sampleEntry = series[sortedDates[0]];
    const fields = Object.keys(sampleEntry);
    const header = ['Date', ...fields].join(',');

    const rows = sortedDates.map(d => {
      const entry = series[d];
      return [d, ...fields.map(f => entry[f] ?? '')].join(',');
    });

    return [header, ...rows].join('\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching AV indicator ${indicator} for ${symbol}: ${msg}`;
  }
}
