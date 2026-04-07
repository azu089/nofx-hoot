/**
 * 统一数据接口层 - Vendor 路由与降级
 * 对应 Python: tradingagents/dataflows/interface.py
 *
 * 设计原则：
 * 1. 根据全局配置（data_vendors）选择主 vendor
 * 2. 主 vendor 失败时自动降级到备用 vendor
 * 3. 所有函数返回 string，上层调用方无需关心底层 vendor 细节
 */

import { getConfig } from './config.js';

// Yahoo Finance
import {
  getStockData as yfGetStockData,
  getIndicators as yfGetIndicators,
  getFundamentals as yfGetFundamentals,
  getBalanceSheet as yfGetBalanceSheet,
  getCashflow as yfGetCashflow,
  getIncomeStatement as yfGetIncomeStatement,
  getInsiderTransactions as yfGetInsiderTransactions,
} from './yahoo-finance.js';

import {
  getNewsYahoo,
  getGlobalNewsYahoo,
} from './yahoo-finance-news.js';

// Alpha Vantage
import {
  getStockAV,
  getIndicatorAV,
} from './alpha-vantage.js';

import {
  getFundamentalsAV,
  getBalanceSheetAV,
  getCashflowAV,
  getIncomeStatementAV,
} from './alpha-vantage-fundamentals.js';

import {
  getNewsAV,
  getGlobalNewsAV,
} from './alpha-vantage-news.js';

// ─────────────────────────────────────────────
// Vendor 枚举
// ─────────────────────────────────────────────

type Vendor = 'yfinance' | 'alpha_vantage';

/** 从 data_vendors 配置中推断当前主 vendor（不同数据类型可能不同） */
function getPrimaryVendor(dataType: keyof ReturnType<typeof getConfig>['data_vendors']): Vendor {
  return getConfig().data_vendors[dataType] ?? 'yfinance';
}

/** 获取降级 vendor */
function getFallbackVendor(primary: Vendor): Vendor {
  return primary === 'yfinance' ? 'alpha_vantage' : 'yfinance';
}

// ─────────────────────────────────────────────
// 带降级的执行包装器
// ─────────────────────────────────────────────

async function withFallback(
  primaryFn: () => Promise<string>,
  fallbackFn: (() => Promise<string>) | null,
  label: string,
): Promise<string> {
  try {
    const result = await primaryFn();
    // 如果返回内容包含明显错误标志，尝试降级
    if (
      result.startsWith('Error ') ||
      result.includes('rate limit') ||
      result.startsWith('Alpha Vantage error')
    ) {
      if (fallbackFn) {
        console.warn(`[DataInterface] ${label}: primary vendor returned error, trying fallback`);
        return await fallbackFn();
      }
    }
    return result;
  } catch (err) {
    if (fallbackFn) {
      console.warn(
        `[DataInterface] ${label}: primary vendor threw, trying fallback. Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      try {
        return await fallbackFn();
      } catch (fallbackErr) {
        const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        return `Both vendors failed for ${label}. Last error: ${msg}`;
      }
    }
    const msg = err instanceof Error ? err.message : String(err);
    return `Error in ${label}: ${msg}`;
  }
}

// ─────────────────────────────────────────────
// 公开接口：股价数据
// ─────────────────────────────────────────────

/**
 * 获取股票历史 OHLCV 数据
 */
export async function getStockData(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<string> {
  const primary = getPrimaryVendor('core_stock_apis');
  const fallback = getFallbackVendor(primary);

  return withFallback(
    () =>
      primary === 'yfinance'
        ? yfGetStockData(symbol, startDate, endDate)
        : getStockAV(symbol, startDate, endDate),
    () =>
      fallback === 'yfinance'
        ? yfGetStockData(symbol, startDate, endDate)
        : getStockAV(symbol, startDate, endDate),
    `getStockData(${symbol})`,
  );
}

// ─────────────────────────────────────────────
// 公开接口：技术指标
// ─────────────────────────────────────────────

/**
 * 获取技术指标数据
 * @param indicator 逗号分隔的指标名（yfinance 格式）或单个 AV 格式指标名
 */
export async function getIndicators(
  symbol: string,
  indicator: string,
  currDate: string,
  lookBackDays?: number,
): Promise<string> {
  const primary = getPrimaryVendor('technical_indicators');
  const fallback = getFallbackVendor(primary);

  return withFallback(
    () =>
      primary === 'yfinance'
        ? yfGetIndicators(symbol, indicator, currDate, lookBackDays)
        : getIndicatorAV(symbol, indicator, currDate),
    () =>
      fallback === 'yfinance'
        ? yfGetIndicators(symbol, indicator, currDate, lookBackDays)
        : getIndicatorAV(symbol, indicator, currDate),
    `getIndicators(${symbol}, ${indicator})`,
  );
}

// ─────────────────────────────────────────────
// 公开接口：基本面数据
// ─────────────────────────────────────────────

/**
 * 获取公司基本面概览
 */
export async function getFundamentals(ticker: string): Promise<string> {
  const primary = getPrimaryVendor('fundamental_data');
  const fallback = getFallbackVendor(primary);

  return withFallback(
    () =>
      primary === 'yfinance' ? yfGetFundamentals(ticker) : getFundamentalsAV(ticker),
    () =>
      fallback === 'yfinance' ? yfGetFundamentals(ticker) : getFundamentalsAV(ticker),
    `getFundamentals(${ticker})`,
  );
}

/**
 * 获取资产负债表
 */
export async function getBalanceSheet(ticker: string, freq: string = 'annual', currDate?: string): Promise<string> {
  const primary = getPrimaryVendor('fundamental_data');
  const fallback = getFallbackVendor(primary);

  return withFallback(
    () =>
      primary === 'yfinance'
        ? yfGetBalanceSheet(ticker, freq, currDate)
        : getBalanceSheetAV(ticker, freq),
    () =>
      fallback === 'yfinance'
        ? yfGetBalanceSheet(ticker, freq, currDate)
        : getBalanceSheetAV(ticker, freq),
    `getBalanceSheet(${ticker}, ${freq})`,
  );
}

/**
 * 获取现金流量表
 */
export async function getCashflow(ticker: string, freq: string = 'annual', currDate?: string): Promise<string> {
  const primary = getPrimaryVendor('fundamental_data');
  const fallback = getFallbackVendor(primary);

  return withFallback(
    () =>
      primary === 'yfinance' ? yfGetCashflow(ticker, freq, currDate) : getCashflowAV(ticker, freq),
    () =>
      fallback === 'yfinance' ? yfGetCashflow(ticker, freq, currDate) : getCashflowAV(ticker, freq),
    `getCashflow(${ticker}, ${freq})`,
  );
}

/**
 * 获取利润表
 */
export async function getIncomeStatement(
  ticker: string,
  freq: string = 'annual',
  currDate?: string,
): Promise<string> {
  const primary = getPrimaryVendor('fundamental_data');
  const fallback = getFallbackVendor(primary);

  return withFallback(
    () =>
      primary === 'yfinance'
        ? yfGetIncomeStatement(ticker, freq, currDate)
        : getIncomeStatementAV(ticker, freq),
    () =>
      fallback === 'yfinance'
        ? yfGetIncomeStatement(ticker, freq, currDate)
        : getIncomeStatementAV(ticker, freq),
    `getIncomeStatement(${ticker}, ${freq})`,
  );
}

/**
 * 获取内部人交易记录（仅 Yahoo Finance 支持，无 AV 降级）
 */
export async function getInsiderTransactions(ticker: string): Promise<string> {
  return withFallback(
    () => yfGetInsiderTransactions(ticker),
    null,
    `getInsiderTransactions(${ticker})`,
  );
}

// ─────────────────────────────────────────────
// 公开接口：新闻数据
// ─────────────────────────────────────────────

/**
 * 获取特定股票新闻
 */
export async function getTickerNews(
  ticker: string,
  startDate: string,
  endDate: string,
): Promise<string> {
  const primary = getPrimaryVendor('news_data');
  const fallback = getFallbackVendor(primary);

  return withFallback(
    () =>
      primary === 'yfinance'
        ? getNewsYahoo(ticker, startDate, endDate)
        : getNewsAV(ticker, startDate, endDate),
    () =>
      fallback === 'yfinance'
        ? getNewsYahoo(ticker, startDate, endDate)
        : getNewsAV(ticker, startDate, endDate),
    `getTickerNews(${ticker})`,
  );
}

/**
 * 获取全球宏观新闻
 */
export async function getGlobalNews(
  currDate: string,
  lookBackDays: number = 7,
  limit: number = 5,
): Promise<string> {
  const primary = getPrimaryVendor('news_data');
  const fallback = getFallbackVendor(primary);

  return withFallback(
    () =>
      primary === 'yfinance'
        ? getGlobalNewsYahoo(currDate, lookBackDays, limit)
        : getGlobalNewsAV(currDate, lookBackDays, limit),
    () =>
      fallback === 'yfinance'
        ? getGlobalNewsYahoo(currDate, lookBackDays, limit)
        : getGlobalNewsAV(currDate, lookBackDays, limit),
    `getGlobalNews(${currDate})`,
  );
}

// ─────────────────────────────────────────────
// 通用路由入口（动态方法分发）
// ─────────────────────────────────────────────

/**
 * 动态路由：根据 method 名称分发到对应函数
 * 供 LangChain Tool / Agent 动态调用时使用
 *
 * 支持的 method 名称：
 * - get_stock_data
 * - get_indicators
 * - get_fundamentals
 * - get_balance_sheet
 * - get_cashflow
 * - get_income_statement
 * - get_insider_transactions
 * - get_ticker_news
 * - get_global_news
 */
export async function routeToVendor(method: string, ...args: unknown[]): Promise<string> {
  switch (method) {
    case 'get_stock_data':
      return getStockData(args[0] as string, args[1] as string, args[2] as string);

    case 'get_indicators':
      return getIndicators(
        args[0] as string,
        args[1] as string,
        args[2] as string,
        args[3] as number | undefined,
      );

    case 'get_fundamentals':
      return getFundamentals(args[0] as string);

    case 'get_balance_sheet':
      return getBalanceSheet(args[0] as string, args[1] as string | undefined, args[2] as string | undefined);

    case 'get_cashflow':
      return getCashflow(args[0] as string, args[1] as string | undefined, args[2] as string | undefined);

    case 'get_income_statement':
      return getIncomeStatement(args[0] as string, args[1] as string | undefined, args[2] as string | undefined);

    case 'get_insider_transactions':
      return getInsiderTransactions(args[0] as string);

    case 'get_ticker_news':
    case 'get_news':  // Python 原版工具名是 get_news，兼容两种调用方式
      return getTickerNews(args[0] as string, args[1] as string, args[2] as string);

    case 'get_global_news':
      return getGlobalNews(
        args[0] as string,
        args[1] as number | undefined,
        args[2] as number | undefined,
      );

    default:
      return `Unknown method: "${method}". Supported methods: get_stock_data, get_indicators, get_fundamentals, get_balance_sheet, get_cashflow, get_income_statement, get_insider_transactions, get_ticker_news, get_global_news`;
  }
}
