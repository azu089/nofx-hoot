/**
 * Alpha Vantage 新闻情绪数据
 * 对应 Python: tradingagents/dataflows/av_utils.py (news 部分)
 *
 * 使用 AV NEWS_SENTIMENT 端点，支持：
 * 1. 特定股票新闻（按日期范围过滤）
 * 2. 全球宏观新闻（按话题搜索）
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

// AV 时间格式：yyyyMMddTHHmm
function toAVTime(dateStr: string): string {
  return dateStr.replace(/-/g, '') + 'T0000';
}

function toDateStr(avDate: string): string {
  // AV 返回 "20240101T120000"
  if (avDate.length >= 8) {
    return `${avDate.slice(0, 4)}-${avDate.slice(4, 6)}-${avDate.slice(6, 8)}`;
  }
  return avDate;
}

function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

// ─────────────────────────────────────────────
// AV 新闻条目结构
// ─────────────────────────────────────────────

interface AVNewsFeed {
  title?: string;
  url?: string;
  time_published?: string;
  authors?: string[];
  summary?: string;
  source?: string;
  overall_sentiment_label?: string;
  overall_sentiment_score?: number;
  ticker_sentiment?: Array<{
    ticker: string;
    relevance_score: string;
    ticker_sentiment_label: string;
    ticker_sentiment_score: string;
  }>;
  topics?: Array<{
    topic: string;
    relevance_score: string;
  }>;
}

interface AVNewsResponse {
  feed?: AVNewsFeed[];
  items?: string;
  'Note'?: string;
  'Information'?: string;
  'Error Message'?: string;
}

/** 将单条 AV 新闻格式化为可读文本 */
function formatAVNewsItem(item: AVNewsFeed, index: number): string {
  const title = item.title ?? '(no title)';
  const source = item.source ?? 'Unknown';
  const date = item.time_published ? toDateStr(item.time_published) : 'N/A';
  const sentiment = item.overall_sentiment_label ?? 'N/A';
  const sentimentScore =
    item.overall_sentiment_score != null
      ? item.overall_sentiment_score.toFixed(4)
      : 'N/A';
  const summary = (item.summary ?? '').slice(0, 400);
  const url = item.url ?? '';

  const lines = [
    `[${index + 1}] ${title}`,
    `    Date: ${date} | Source: ${source}`,
    `    Sentiment: ${sentiment} (score: ${sentimentScore})`,
  ];

  if (summary) lines.push(`    Summary: ${summary}`);
  if (url) lines.push(`    Link: ${url}`);

  // 相关股票情绪
  if (item.ticker_sentiment && item.ticker_sentiment.length > 0) {
    const tickers = item.ticker_sentiment
      .slice(0, 5)
      .map(
        t =>
          `${t.ticker}(${t.ticker_sentiment_label}, rel:${parseFloat(t.relevance_score).toFixed(2)})`,
      )
      .join(', ');
    lines.push(`    Related Tickers: ${tickers}`);
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────────
// 1. 特定股票新闻
// ─────────────────────────────────────────────

/**
 * 获取特定股票相关新闻情绪（AV NEWS_SENTIMENT 端点）
 * @param ticker    股票代码，如 "AAPL"
 * @param startDate 起始日期 "YYYY-MM-DD"
 * @param endDate   结束日期 "YYYY-MM-DD"（防前瞻偏差）
 */
export async function getNewsAV(
  ticker: string,
  startDate: string,
  endDate: string,
): Promise<string> {
  try {
    const apiKey = getApiKey();
    const resp = await axios.get<AVNewsResponse>(BASE_URL, {
      params: {
        function: 'NEWS_SENTIMENT',
        tickers: ticker,
        time_from: toAVTime(startDate),
        time_to: toAVTime(endDate) + '59', // 包含当天
        limit: 200,
        sort: 'LATEST',
        apikey: apiKey,
      },
      timeout: 30_000,
    });

    const data = resp.data;

    if (data['Error Message']) {
      return `Alpha Vantage error for ${ticker}: ${data['Error Message']}`;
    }
    if (data['Note'] || data['Information']) {
      return `Alpha Vantage rate limit. Message: ${data['Note'] ?? data['Information']}`;
    }

    const feed = data.feed ?? [];

    if (feed.length === 0) {
      return `No news found for ${ticker} between ${startDate} and ${endDate} (Alpha Vantage)`;
    }

    // 二次过滤：确保 <= endDate（防前瞻偏差）
    const cutoff = parseDate(endDate).getTime() + 86400_000 - 1;
    const start = parseDate(startDate).getTime();

    const filtered = feed.filter(item => {
      if (!item.time_published) return false;
      const dateStr = toDateStr(item.time_published);
      const t = parseDate(dateStr).getTime();
      return t >= start && t <= cutoff;
    });

    if (filtered.length === 0) {
      return `No news for ${ticker} strictly within ${startDate} to ${endDate}`;
    }

    const header = `=== AV News Sentiment for ${ticker} (${startDate} to ${endDate}) — ${filtered.length} items ===\n`;
    const body = filtered.map((item, i) => formatAVNewsItem(item, i)).join('\n\n');
    return header + body;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching AV news for ${ticker}: ${msg}`;
  }
}

// ─────────────────────────────────────────────
// 2. 全球宏观新闻
// ─────────────────────────────────────────────

/**
 * AV 支持的宏观话题分类
 * 详见 https://www.alphavantage.co/documentation/#news-sentiment
 */
const MACRO_TOPICS = [
  'economy_macro',
  'economy_monetary',
  'economy_fiscal',
  'financial_markets',
  'manufacturing',
] as const;

/**
 * 获取全球宏观新闻情绪（AV NEWS_SENTIMENT，按 topics 过滤）
 * @param currDate     当前日期 "YYYY-MM-DD"（只取 <= 当天的新闻）
 * @param lookBackDays 向前多少天（默认 7）
 * @param limit        最多返回条数（默认 20）
 */
export async function getGlobalNewsAV(
  currDate: string,
  lookBackDays: number = 7,
  limit: number = 20,
): Promise<string> {
  try {
    const apiKey = getApiKey();

    const endDate = currDate;
    const startDate = new Date(parseDate(currDate).getTime() - lookBackDays * 86400_000)
      .toISOString()
      .slice(0, 10);

    const allItems: AVNewsFeed[] = [];
    const seenUrls = new Set<string>();
    const cutoff = parseDate(currDate).getTime() + 86400_000 - 1;
    const start = parseDate(startDate).getTime();

    // 逐话题查询，合并去重
    for (const topic of MACRO_TOPICS) {
      try {
        const resp = await axios.get<AVNewsResponse>(BASE_URL, {
          params: {
            function: 'NEWS_SENTIMENT',
            topics: topic,
            time_from: toAVTime(startDate),
            time_to: toAVTime(endDate) + '59',
            limit: 50,
            sort: 'LATEST',
            apikey: apiKey,
          },
          timeout: 30_000,
        });

        const data = resp.data;

        // 遇到限流立即停止，避免浪费配额
        if (data['Note'] || data['Information']) {
          break;
        }

        for (const item of data.feed ?? []) {
          if (!item.time_published) continue;
          const url = item.url ?? '';
          if (url && seenUrls.has(url)) continue;
          if (url) seenUrls.add(url);

          // 日期过滤（防前瞻偏差）
          const dateStr = toDateStr(item.time_published);
          const t = parseDate(dateStr).getTime();
          if (t < start || t > cutoff) continue;

          allItems.push(item);
        }
      } catch {
        // 单个话题失败不影响整体
      }
    }

    if (allItems.length === 0) {
      return `No global macro news found (AV) within ${lookBackDays} days of ${currDate}`;
    }

    // 按发布时间倒序，截取 limit 条
    const sorted = allItems
      .sort((a, b) => {
        const ta = a.time_published ?? '';
        const tb = b.time_published ?? '';
        return tb.localeCompare(ta);
      })
      .slice(0, limit);

    const header = `=== AV Global Macro News (last ${lookBackDays} days, up to ${currDate}) — ${sorted.length} items ===\n`;
    const body = sorted.map((item, i) => formatAVNewsItem(item, i)).join('\n\n');
    return header + body;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching AV global news: ${msg}`;
  }
}

// ─────────────────────────────────────────────
// 工具：toDateStr 也需在模块顶部，确保使用正确
// ─────────────────────────────────────────────
// （已在文件顶部定义，无需重复）
