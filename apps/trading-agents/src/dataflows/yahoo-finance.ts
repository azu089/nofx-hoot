/**
 * Yahoo Finance 数据源 - 股价、技术指标、基本面
 * 对应 Python: tradingagents/dataflows/yfin_utils.py
 *
 * 使用 yahoo-finance2 获取行情数据，technicalindicators 计算指标
 */

import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
import {
  SMA,
  EMA,
  RSI,
  MACD,
  BollingerBands,
  ATR,
} from 'technicalindicators';

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

/** 将 Date 对象格式化为 YYYY-MM-DD */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 解析 YYYY-MM-DD 字符串为 UTC 午夜 Date */
function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

/** chart() 返回的 quote 行转 CSV */
function chartQuoteToRow(q: {
  date: Date;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
  adjclose?: number | null;
}): string {
  return [
    toDateStr(q.date),
    (q.open ?? '').toString(),
    (q.high ?? '').toString(),
    (q.low ?? '').toString(),
    (q.close ?? '').toString(),
    (q.volume ?? '').toString(),
    (q.adjclose ?? q.close ?? '').toString(),
  ].join(',');
}

// ─────────────────────────────────────────────
// 1. 历史 OHLCV 数据
// ─────────────────────────────────────────────

/**
 * 获取股票历史 OHLCV 数据，返回 CSV 字符串
 * @param symbol  股票代码，如 "AAPL"
 * @param startDate  起始日期 "YYYY-MM-DD"
 * @param endDate    结束日期 "YYYY-MM-DD"
 */
export async function getStockData(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<string> {
  try {
    const chartResult = await yahooFinance.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    });

    const quotes = chartResult.quotes;
    if (!quotes || quotes.length === 0) {
      return `No data found for ${symbol} between ${startDate} and ${endDate}`;
    }

    const header = 'Date,Open,High,Low,Close,Volume,Adj Close';
    const rows = quotes.map(chartQuoteToRow);
    return [header, ...rows].join('\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching stock data for ${symbol}: ${msg}`;
  }
}

// ─────────────────────────────────────────────
// 2. 技术指标
// ─────────────────────────────────────────────

/** 已支持的指标名 */
const SUPPORTED_INDICATORS = [
  'close_50_sma',
  'close_200_sma',
  'close_10_ema',
  'macd',
  'macds',
  'macdh',
  'rsi',
  'boll',
  'boll_ub',
  'boll_lb',
  'atr',
  'vwma',
] as const;
type IndicatorName = (typeof SUPPORTED_INDICATORS)[number];

/** 单个指标的计算结果：日期 → 值 */
type IndicatorSeries = Map<string, number | null>;

/** 计算 VWMA（成交量加权移动平均）*/
function calcVwma(
  closes: number[],
  volumes: number[],
  period: number,
): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    let sumPV = 0;
    let sumV = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumPV += closes[j] * volumes[j];
      sumV += volumes[j];
    }
    result.push(sumV === 0 ? NaN : sumPV / sumV);
  }
  return result;
}

/**
 * 计算技术指标，返回文本报告
 * @param symbol    股票代码
 * @param indicator 逗号分隔的指标名列表，如 "close_50_sma,rsi,macd"
 * @param currDate  当前日期 "YYYY-MM-DD"（防止前瞻偏差，只返回 <= currDate 的数据）
 * @param lookBackDays 向前取多少天数据用于计算（默认 365）
 */
export async function getIndicators(
  symbol: string,
  indicator: string,
  currDate: string,
  lookBackDays: number = 365,
): Promise<string> {
  try {
    const endDate = parseDate(currDate);
    const startDate = new Date(endDate.getTime() - lookBackDays * 86400_000);

    const chartResult = await yahooFinance.chart(symbol, {
      period1: toDateStr(startDate),
      period2: currDate,
      interval: '1d',
    });

    const history = chartResult.quotes;
    if (!history || history.length === 0) {
      return `No historical data for ${symbol} up to ${currDate}`;
    }

    // 过滤：只保留 <= currDate 的行（防止前瞻偏差）
    const cutoff = parseDate(currDate).getTime();
    const filtered = history.filter((h) => h.date.getTime() <= cutoff);

    if (filtered.length === 0) {
      return `No data for ${symbol} on or before ${currDate}`;
    }

    const dates = filtered.map((h) => toDateStr(h.date));
    const closes = filtered.map((h) => h.close ?? 0);
    const highs = filtered.map((h) => h.high ?? 0);
    const lows = filtered.map((h) => h.low ?? 0);
    const volumes = filtered.map((h) => h.volume ?? 0);
    const n = dates.length;

    // 解析请求的指标
    const requested = indicator
      .split(',')
      .map(s => s.trim().toLowerCase() as IndicatorName)
      .filter(s => SUPPORTED_INDICATORS.includes(s as IndicatorName));

    if (requested.length === 0) {
      return `No supported indicators found in: "${indicator}". Supported: ${SUPPORTED_INDICATORS.join(', ')}`;
    }

    // ── 按需计算各指标 ──────────────────────────────────────
    const seriesMap = new Map<IndicatorName, IndicatorSeries>();

    // 辅助：将 number[] 对齐到 dates（从尾部对齐）
    const alignToDates = (vals: number[]): IndicatorSeries => {
      const m: IndicatorSeries = new Map();
      const offset = n - vals.length;
      vals.forEach((v, i) => {
        m.set(dates[i + offset], isNaN(v) ? null : v);
      });
      return m;
    };

    for (const ind of requested) {
      if (ind === 'close_50_sma') {
        const vals = SMA.calculate({ period: 50, values: closes });
        seriesMap.set(ind, alignToDates(vals));
      } else if (ind === 'close_200_sma') {
        const vals = SMA.calculate({ period: 200, values: closes });
        seriesMap.set(ind, alignToDates(vals));
      } else if (ind === 'close_10_ema') {
        const vals = EMA.calculate({ period: 10, values: closes });
        seriesMap.set(ind, alignToDates(vals));
      } else if (ind === 'rsi') {
        const vals = RSI.calculate({ period: 14, values: closes });
        seriesMap.set(ind, alignToDates(vals));
      } else if (ind === 'macd' || ind === 'macds' || ind === 'macdh') {
        // 三个 MACD 衍生指标一次性计算，避免重复
        if (!seriesMap.has('macd') && !seriesMap.has('macds') && !seriesMap.has('macdh')) {
          const raw = MACD.calculate({
            values: closes,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
          });
          const macdVals = raw.map((r: { MACD?: number; signal?: number; histogram?: number }) => r.MACD ?? NaN);
          const signalVals = raw.map((r: { MACD?: number; signal?: number; histogram?: number }) => r.signal ?? NaN);
          const histVals = raw.map((r: { MACD?: number; signal?: number; histogram?: number }) => r.histogram ?? NaN);
          const offset = n - raw.length;
          const macdM: IndicatorSeries = new Map();
          const signalM: IndicatorSeries = new Map();
          const histM: IndicatorSeries = new Map();
          raw.forEach((_: unknown, i: number) => {
            const d = dates[i + offset];
            macdM.set(d, isNaN(macdVals[i]) ? null : macdVals[i]);
            signalM.set(d, isNaN(signalVals[i]) ? null : signalVals[i]);
            histM.set(d, isNaN(histVals[i]) ? null : histVals[i]);
          });
          seriesMap.set('macd', macdM);
          seriesMap.set('macds', signalM);
          seriesMap.set('macdh', histM);
        }
      } else if (ind === 'boll' || ind === 'boll_ub' || ind === 'boll_lb') {
        if (!seriesMap.has('boll') && !seriesMap.has('boll_ub') && !seriesMap.has('boll_lb')) {
          const raw = BollingerBands.calculate({
            period: 20,
            values: closes,
            stdDev: 2,
          });
          const offset = n - raw.length;
          const midM: IndicatorSeries = new Map();
          const ubM: IndicatorSeries = new Map();
          const lbM: IndicatorSeries = new Map();
          raw.forEach((r: { middle?: number; upper?: number; lower?: number }, i: number) => {
            const d = dates[i + offset];
            midM.set(d, r.middle ?? null);
            ubM.set(d, r.upper ?? null);
            lbM.set(d, r.lower ?? null);
          });
          seriesMap.set('boll', midM);
          seriesMap.set('boll_ub', ubM);
          seriesMap.set('boll_lb', lbM);
        }
      } else if (ind === 'atr') {
        const raw = ATR.calculate({
          period: 14,
          high: highs,
          low: lows,
          close: closes,
        });
        seriesMap.set(ind, alignToDates(raw));
      } else if (ind === 'vwma') {
        const raw = calcVwma(closes, volumes, 20);
        seriesMap.set(ind, alignToDates(raw));
      }
    }

    // ── 构建输出 CSV ──────────────────────────────────────
    const presentIndicators = requested.filter(ind => seriesMap.has(ind));
    const header = ['Date', ...presentIndicators].join(',');

    const rows: string[] = [];
    for (let i = 0; i < n; i++) {
      const d = dates[i];
      const cols: string[] = [d];
      for (const ind of presentIndicators) {
        const series = seriesMap.get(ind);
        const val = series?.get(d);
        cols.push(val != null ? val.toFixed(4) : '');
      }
      rows.push(cols.join(','));
    }

    return [header, ...rows].join('\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error computing indicators for ${symbol}: ${msg}`;
  }
}

// ─────────────────────────────────────────────
// 3. 公司基本面概览
// ─────────────────────────────────────────────

/**
 * 获取公司基本面信息（市值、PE、EPS、行业等）
 */
export async function getFundamentals(ticker: string): Promise<string> {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, {
      modules: ['assetProfile', 'summaryDetail', 'defaultKeyStatistics', 'financialData'],
    });

    const lines: string[] = [`=== Fundamentals: ${ticker} ===`];

    const profile = summary.assetProfile;
    if (profile) {
      lines.push(`Industry: ${profile.industry ?? 'N/A'}`);
      lines.push(`Sector: ${profile.sector ?? 'N/A'}`);
      lines.push(`Country: ${profile.country ?? 'N/A'}`);
      lines.push(`Employees: ${profile.fullTimeEmployees?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Description: ${(profile.longBusinessSummary ?? '').slice(0, 500)}`);
    }

    const detail = summary.summaryDetail;
    if (detail) {
      lines.push(`Market Cap: ${detail.marketCap?.toLocaleString() ?? 'N/A'}`);
      lines.push(`P/E (Trailing): ${detail.trailingPE?.toFixed(2) ?? 'N/A'}`);
      lines.push(`P/E (Forward): ${detail.forwardPE?.toFixed(2) ?? 'N/A'}`);
      lines.push(`Dividend Yield: ${detail.dividendYield != null ? (detail.dividendYield * 100).toFixed(2) + '%' : 'N/A'}`);
      lines.push(`52W High: ${detail.fiftyTwoWeekHigh?.toFixed(2) ?? 'N/A'}`);
      lines.push(`52W Low: ${detail.fiftyTwoWeekLow?.toFixed(2) ?? 'N/A'}`);
    }

    const stats = summary.defaultKeyStatistics;
    if (stats) {
      lines.push(`EPS (TTM): ${stats.trailingEps?.toFixed(2) ?? 'N/A'}`);
      lines.push(`Beta: ${stats.beta?.toFixed(2) ?? 'N/A'}`);
      lines.push(`Book Value: ${stats.bookValue?.toFixed(2) ?? 'N/A'}`);
      lines.push(`Shares Outstanding: ${stats.sharesOutstanding?.toLocaleString() ?? 'N/A'}`);
    }

    const finData = summary.financialData;
    if (finData) {
      lines.push(`Revenue (TTM): ${finData.totalRevenue?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Gross Margin: ${finData.grossMargins != null ? (finData.grossMargins * 100).toFixed(2) + '%' : 'N/A'}`);
      lines.push(`Profit Margin: ${finData.profitMargins != null ? (finData.profitMargins * 100).toFixed(2) + '%' : 'N/A'}`);
      lines.push(`Return on Equity: ${finData.returnOnEquity != null ? (finData.returnOnEquity * 100).toFixed(2) + '%' : 'N/A'}`);
      lines.push(`Debt/Equity: ${finData.debtToEquity?.toFixed(2) ?? 'N/A'}`);
      lines.push(`Current Ratio: ${finData.currentRatio?.toFixed(2) ?? 'N/A'}`);
      lines.push(`Free Cash Flow: ${finData.freeCashflow?.toLocaleString() ?? 'N/A'}`);
    }

    return lines.join('\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching fundamentals for ${ticker}: ${msg}`;
  }
}

// ─────────────────────────────────────────────
// 4. 资产负债表
// ─────────────────────────────────────────────

/**
 * 获取资产负债表
 * @param freq "annual" | "quarterly"（默认 annual）
 */
export async function getBalanceSheet(ticker: string, freq: string = 'annual', currDate?: string): Promise<string> {
  try {
    const module = freq === 'quarterly' ? 'balanceSheetHistoryQuarterly' : 'balanceSheetHistory';
    const summary = await yahooFinance.quoteSummary(ticker, { modules: [module] });

    let statements =
      freq === 'quarterly'
        ? summary.balanceSheetHistoryQuarterly?.balanceSheetStatements
        : summary.balanceSheetHistory?.balanceSheetStatements;

    if (!statements || statements.length === 0) {
      return `No balance sheet data available for ${ticker}`;
    }

    // 日期过滤：防止回测前视偏差（对齐 Python filter_financials_by_date）
    if (currDate) {
      const cutoff = parseDate(currDate).getTime();
      statements = statements.filter(s => {
        if (!s.endDate) return true;
        return new Date(s.endDate as unknown as string).getTime() <= cutoff;
      });
    }

    if (statements.length === 0) {
      return `No balance sheet data available for ${ticker} on or before ${currDate}`;
    }

    const lines: string[] = [`=== Balance Sheet (${freq}): ${ticker} ===`];

    for (const s of statements) {
      const date = s.endDate ? toDateStr(new Date(s.endDate as unknown as string)) : 'N/A';
      lines.push(`\n--- Period: ${date} ---`);
      lines.push(`Total Assets: ${(s as unknown as Record<string, unknown>).totalAssets?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Total Liabilities: ${(s as unknown as Record<string, unknown>).totalLiab?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Total Stockholder Equity: ${(s as unknown as Record<string, unknown>).totalStockholderEquity?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Cash: ${(s as unknown as Record<string, unknown>).cash?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Short Term Investments: ${(s as unknown as Record<string, unknown>).shortTermInvestments?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Total Current Assets: ${(s as unknown as Record<string, unknown>).totalCurrentAssets?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Total Current Liabilities: ${(s as unknown as Record<string, unknown>).totalCurrentLiabilities?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Long Term Debt: ${(s as unknown as Record<string, unknown>).longTermDebt?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Retained Earnings: ${(s as unknown as Record<string, unknown>).retainedEarnings?.toLocaleString() ?? 'N/A'}`);
    }

    return lines.join('\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching balance sheet for ${ticker}: ${msg}`;
  }
}

// ─────────────────────────────────────────────
// 5. 现金流量表
// ─────────────────────────────────────────────

/**
 * 获取现金流量表
 * @param freq "annual" | "quarterly"（默认 annual）
 */
export async function getCashflow(ticker: string, freq: string = 'annual', currDate?: string): Promise<string> {
  try {
    const module = freq === 'quarterly' ? 'cashflowStatementHistoryQuarterly' : 'cashflowStatementHistory';
    const summary = await yahooFinance.quoteSummary(ticker, { modules: [module] });

    let statements =
      freq === 'quarterly'
        ? summary.cashflowStatementHistoryQuarterly?.cashflowStatements
        : summary.cashflowStatementHistory?.cashflowStatements;

    if (!statements || statements.length === 0) {
      return `No cash flow data available for ${ticker}`;
    }

    // 日期过滤：防止回测前视偏差
    if (currDate) {
      const cutoff = parseDate(currDate).getTime();
      statements = statements.filter(s => {
        if (!s.endDate) return true;
        return new Date(s.endDate as unknown as string).getTime() <= cutoff;
      });
    }

    if (statements.length === 0) {
      return `No cash flow data available for ${ticker} on or before ${currDate}`;
    }

    const lines: string[] = [`=== Cash Flow Statement (${freq}): ${ticker} ===`];

    for (const s of statements) {
      const raw = s as unknown as Record<string, unknown>;
      const date = s.endDate ? toDateStr(new Date(s.endDate as unknown as string)) : 'N/A';
      lines.push(`\n--- Period: ${date} ---`);
      lines.push(`Total Cash From Operating: ${raw.totalCashFromOperatingActivities?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Total Cash From Investing: ${raw.totalCashflowsFromInvestingActivities?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Total Cash From Financing: ${raw.totalCashFromFinancingActivities?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Capital Expenditures: ${raw.capitalExpenditures?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Free Cash Flow: ${raw.freeCashFlow?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Net Income: ${raw.netIncome?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Depreciation: ${raw.depreciation?.toLocaleString() ?? 'N/A'}`);
    }

    return lines.join('\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching cash flow for ${ticker}: ${msg}`;
  }
}

// ─────────────────────────────────────────────
// 6. 利润表
// ─────────────────────────────────────────────

/**
 * 获取利润表（损益表）
 * @param freq "annual" | "quarterly"（默认 annual）
 */
export async function getIncomeStatement(ticker: string, freq: string = 'annual', currDate?: string): Promise<string> {
  try {
    const module = freq === 'quarterly' ? 'incomeStatementHistoryQuarterly' : 'incomeStatementHistory';
    const summary = await yahooFinance.quoteSummary(ticker, { modules: [module] });

    let statements =
      freq === 'quarterly'
        ? summary.incomeStatementHistoryQuarterly?.incomeStatementHistory
        : summary.incomeStatementHistory?.incomeStatementHistory;

    if (!statements || statements.length === 0) {
      return `No income statement data available for ${ticker}`;
    }

    // 日期过滤：防止回测前视偏差
    if (currDate) {
      const cutoff = parseDate(currDate).getTime();
      statements = statements.filter(s => {
        if (!s.endDate) return true;
        return new Date(s.endDate as unknown as string).getTime() <= cutoff;
      });
    }

    if (statements.length === 0) {
      return `No income statement data available for ${ticker} on or before ${currDate}`;
    }

    const lines: string[] = [`=== Income Statement (${freq}): ${ticker} ===`];

    for (const s of statements) {
      const raw = s as unknown as Record<string, unknown>;
      const date = s.endDate ? toDateStr(new Date(s.endDate as unknown as string)) : 'N/A';
      lines.push(`\n--- Period: ${date} ---`);
      lines.push(`Total Revenue: ${raw.totalRevenue?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Gross Profit: ${raw.grossProfit?.toLocaleString() ?? 'N/A'}`);
      lines.push(`EBIT: ${raw.ebit?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Net Income: ${raw.netIncome?.toLocaleString() ?? 'N/A'}`);
      lines.push(`EPS (Basic): ${typeof raw.basicEPS === 'number' ? (raw.basicEPS as number).toFixed(2) : (raw.basicEPS ?? 'N/A')}`);
      lines.push(`EPS (Diluted): ${typeof raw.dilutedEPS === 'number' ? (raw.dilutedEPS as number).toFixed(2) : (raw.dilutedEPS ?? 'N/A')}`);
      lines.push(`Operating Income: ${raw.operatingIncome?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Interest Expense: ${raw.interestExpense?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Research & Development: ${raw.researchDevelopment?.toLocaleString() ?? 'N/A'}`);
      lines.push(`Selling GA: ${raw.sellingGeneralAdministrative?.toLocaleString() ?? 'N/A'}`);
    }

    return lines.join('\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching income statement for ${ticker}: ${msg}`;
  }
}

// ─────────────────────────────────────────────
// 7. 内部人交易记录
// ─────────────────────────────────────────────

/**
 * 获取内部人（董事、高管等）交易记录
 */
export async function getInsiderTransactions(ticker: string): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const summary = await yahooFinance.quoteSummary(ticker, {
      modules: ['insiderTransactions'],
    }) as any;

    const transactions = summary.insiderTransactions?.transactions;

    if (!transactions || transactions.length === 0) {
      return `No insider transactions found for ${ticker}`;
    }

    const lines: string[] = [`=== Insider Transactions: ${ticker} ===`];
    lines.push('Date,Filer,Title,Transaction Type,Shares,Value');

    for (const t of transactions) {
      const raw = t as unknown as Record<string, unknown>;
      const date = t.startDate ? toDateStr(new Date(t.startDate as unknown as string)) : 'N/A';
      const filer = (raw.filerName as string) ?? 'N/A';
      const title = (raw.filerRelation as string) ?? 'N/A';
      const txType = (raw.transactionText as string) ?? 'N/A';
      const shares = raw.shares?.toLocaleString() ?? 'N/A';
      const value = raw.value?.toLocaleString() ?? 'N/A';
      lines.push(`${date},"${filer}","${title}","${txType}",${shares},${value}`);
    }

    return lines.join('\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching insider transactions for ${ticker}: ${msg}`;
  }
}
