/**
 * Yahoo Finance 新闻数据源
 * 对应 Python: tradingagents/dataflows/yfin_utils.py (news 部分)
 *
 * 提供特定股票新闻和全球宏观新闻两种接口
 */

import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

/** 从 Yahoo News 条目提取可读摘要行 */
function formatNewsItem(item: {
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: Date | number | string | null;
  summary?: string;
}, index: number): string {
  const title = item.title ?? '(no title)';
  const publisher = item.publisher ?? 'Unknown';
  let dateStr = 'N/A';
  if (item.providerPublishTime) {
    try {
      const d =
        item.providerPublishTime instanceof Date
          ? item.providerPublishTime
          : new Date(
              typeof item.providerPublishTime === 'number'
                ? item.providerPublishTime * 1000
                : item.providerPublishTime,
            );
      dateStr = toDateStr(d);
    } catch {
      // 保持 N/A
    }
  }
  const summary = (item.summary ?? '').slice(0, 300);
  const link = item.link ?? '';

  return [
    `[${index + 1}] ${title}`,
    `    Date: ${dateStr} | Source: ${publisher}`,
    summary ? `    Summary: ${summary}` : '',
    link ? `    Link: ${link}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// ─────────────────────────────────────────────
// 1. 股票特定新闻
// ─────────────────────────────────────────────

/**
 * 获取特定股票的新闻，按日期范围过滤
 * @param ticker     股票代码，如 "AAPL"
 * @param startDate  起始日期 "YYYY-MM-DD"（含）
 * @param endDate    结束日期 "YYYY-MM-DD"（含，防前瞻偏差）
 */
export async function getNewsYahoo(
  ticker: string,
  startDate: string,
  endDate: string,
): Promise<string> {
  try {
    const result = await yahooFinance.search(ticker, {
      newsCount: 50,
      quotesCount: 0,
    });

    const newsItems = result.news ?? [];

    if (newsItems.length === 0) {
      return `No news found for ${ticker}`;
    }

    // 日期边界（防前瞻偏差：严格 <= endDate）
    const start = parseDate(startDate).getTime();
    const end = parseDate(endDate).getTime() + 86400_000 - 1; // 含当天结束

    const filtered = newsItems.filter(item => {
      if (!item.providerPublishTime) return false;
      const t =
        item.providerPublishTime instanceof Date
          ? item.providerPublishTime.getTime()
          : typeof item.providerPublishTime === 'number'
            ? item.providerPublishTime * 1000
            : new Date(item.providerPublishTime).getTime();
      return t >= start && t <= end;
    });

    if (filtered.length === 0) {
      return `No news for ${ticker} between ${startDate} and ${endDate}`;
    }

    const header = `=== News for ${ticker} (${startDate} to ${endDate}) — ${filtered.length} items ===\n`;
    const body = filtered.map((item, i) => formatNewsItem(item, i)).join('\n\n');
    return header + body;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching news for ${ticker}: ${msg}`;
  }
}

// ─────────────────────────────────────────────
// 2. 全球宏观新闻
// ─────────────────────────────────────────────

/**
 * 搜索全球宏观市场新闻（不针对特定股票）
 * @param currDate     当前日期 "YYYY-MM-DD"（只取 <= 当天的新闻）
 * @param lookBackDays 向前多少天（默认 7）
 * @param limit        最多返回条数（默认 20）
 */
export async function getGlobalNewsYahoo(
  currDate: string,
  lookBackDays: number = 7,
  limit: number = 20,
): Promise<string> {
  // 全球宏观关键词列表，轮流查询以获得多样性
  const macroTopics = [
    'stock market',
    'federal reserve interest rates',
    'global economy',
    'inflation CPI',
    'GDP growth',
  ];

  try {
    const end = parseDate(currDate).getTime() + 86400_000 - 1;
    const start = end - lookBackDays * 86400_000;

    const allItems: Array<{
      title?: string;
      publisher?: string;
      link?: string;
      providerPublishTime?: Date | number | string | null;
      summary?: string;
    }> = [];
    const seenLinks = new Set<string>();

    for (const topic of macroTopics) {
      try {
        const result = await yahooFinance.search(topic, {
          newsCount: 20,
          quotesCount: 0,
        });
        for (const item of result.news ?? []) {
          if (item.link && seenLinks.has(item.link)) continue;
          if (item.link) seenLinks.add(item.link);

          // 过滤日期（防前瞻偏差）
          if (!item.providerPublishTime) continue;
          const t =
            item.providerPublishTime instanceof Date
              ? item.providerPublishTime.getTime()
              : typeof item.providerPublishTime === 'number'
                ? item.providerPublishTime * 1000
                : new Date(item.providerPublishTime).getTime();
          if (t < start || t > end) continue;

          allItems.push(item);
        }
      } catch {
        // 单个关键词失败不影响整体
      }
    }

    if (allItems.length === 0) {
      return `No global macro news found within ${lookBackDays} days of ${currDate}`;
    }

    // 按时间倒序，截取 limit 条
    const sorted = allItems
      .sort((a, b) => {
        const ta =
          a.providerPublishTime instanceof Date
            ? a.providerPublishTime.getTime()
            : typeof a.providerPublishTime === 'number'
              ? a.providerPublishTime * 1000
              : new Date(a.providerPublishTime ?? 0).getTime();
        const tb =
          b.providerPublishTime instanceof Date
            ? b.providerPublishTime.getTime()
            : typeof b.providerPublishTime === 'number'
              ? b.providerPublishTime * 1000
              : new Date(b.providerPublishTime ?? 0).getTime();
        return tb - ta;
      })
      .slice(0, limit);

    const header = `=== Global Macro News (last ${lookBackDays} days, up to ${currDate}) — ${sorted.length} items ===\n`;
    const body = sorted.map((item, i) => formatNewsItem(item, i)).join('\n\n');
    return header + body;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching global news: ${msg}`;
  }
}
