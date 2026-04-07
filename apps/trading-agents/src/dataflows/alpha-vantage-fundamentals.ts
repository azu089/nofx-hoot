/**
 * Alpha Vantage 基本面数据
 * 对应 Python: tradingagents/dataflows/av_utils.py (fundamentals 部分)
 *
 * 涵盖：公司概览、资产负债表、现金流量、利润表
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

// ─────────────────────────────────────────────
// 工具：将 AV 返回的 key-value 对象转为可读文本
// ─────────────────────────────────────────────

function formatKV(obj: Record<string, unknown>, title: string): string {
  const lines: string[] = [`=== ${title} ===`];
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== 'None' && v !== '') {
      lines.push(`${k}: ${v}`);
    }
  }
  return lines.join('\n');
}

/** 将期间报告数组格式化为文本 */
function formatStatements(
  statements: Record<string, unknown>[],
  title: string,
  dateKey: string,
): string {
  if (!statements || statements.length === 0) {
    return `No ${title} data available`;
  }

  const lines: string[] = [`=== ${title} ===`];
  for (const stmt of statements) {
    lines.push(`\n--- Period: ${stmt[dateKey] ?? 'N/A'} ---`);
    for (const [k, v] of Object.entries(stmt)) {
      if (k === dateKey) continue;
      if (v !== undefined && v !== null && v !== 'None' && v !== '') {
        lines.push(`${k}: ${v}`);
      }
    }
  }
  return lines.join('\n');
}

// ─────────────────────────────────────────────
// 1. 公司概览
// ─────────────────────────────────────────────

interface AVOverviewResponse {
  'Error Message'?: string;
  'Note'?: string;
  'Information'?: string;
  Symbol?: string;
  [key: string]: unknown;
}

/**
 * 获取公司基本面概览（AV OVERVIEW 端点）
 */
export async function getFundamentalsAV(ticker: string): Promise<string> {
  try {
    const apiKey = getApiKey();
    const resp = await axios.get<AVOverviewResponse>(BASE_URL, {
      params: {
        function: 'OVERVIEW',
        symbol: ticker,
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
    if (!data.Symbol) {
      return `No overview data returned for ${ticker} (symbol may not exist on Alpha Vantage)`;
    }

    return formatKV(data as Record<string, unknown>, `Company Overview: ${ticker}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching AV fundamentals for ${ticker}: ${msg}`;
  }
}

// ─────────────────────────────────────────────
// 2. 资产负债表
// ─────────────────────────────────────────────

interface AVBalanceSheetResponse {
  symbol?: string;
  annualReports?: Record<string, unknown>[];
  quarterlyReports?: Record<string, unknown>[];
  'Note'?: string;
  'Information'?: string;
  'Error Message'?: string;
}

/**
 * 获取资产负债表（AV BALANCE_SHEET 端点）
 * @param freq "annual" | "quarterly"（默认 annual）
 */
export async function getBalanceSheetAV(ticker: string, freq: string = 'annual'): Promise<string> {
  try {
    const apiKey = getApiKey();
    const resp = await axios.get<AVBalanceSheetResponse>(BASE_URL, {
      params: {
        function: 'BALANCE_SHEET',
        symbol: ticker,
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

    const isQuarterly = freq === 'quarterly';
    const statements = isQuarterly ? data.quarterlyReports : data.annualReports;

    if (!statements || statements.length === 0) {
      return `No balance sheet (${freq}) data for ${ticker}`;
    }

    return formatStatements(
      statements,
      `Balance Sheet (${freq}): ${ticker}`,
      'fiscalDateEnding',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching AV balance sheet for ${ticker}: ${msg}`;
  }
}

// ─────────────────────────────────────────────
// 3. 现金流量表
// ─────────────────────────────────────────────

interface AVCashFlowResponse {
  symbol?: string;
  annualReports?: Record<string, unknown>[];
  quarterlyReports?: Record<string, unknown>[];
  'Note'?: string;
  'Information'?: string;
  'Error Message'?: string;
}

/**
 * 获取现金流量表（AV CASH_FLOW 端点）
 * @param freq "annual" | "quarterly"（默认 annual）
 */
export async function getCashflowAV(ticker: string, freq: string = 'annual'): Promise<string> {
  try {
    const apiKey = getApiKey();
    const resp = await axios.get<AVCashFlowResponse>(BASE_URL, {
      params: {
        function: 'CASH_FLOW',
        symbol: ticker,
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

    const isQuarterly = freq === 'quarterly';
    const statements = isQuarterly ? data.quarterlyReports : data.annualReports;

    if (!statements || statements.length === 0) {
      return `No cash flow (${freq}) data for ${ticker}`;
    }

    return formatStatements(
      statements,
      `Cash Flow Statement (${freq}): ${ticker}`,
      'fiscalDateEnding',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching AV cash flow for ${ticker}: ${msg}`;
  }
}

// ─────────────────────────────────────────────
// 4. 利润表
// ─────────────────────────────────────────────

interface AVIncomeStatementResponse {
  symbol?: string;
  annualReports?: Record<string, unknown>[];
  quarterlyReports?: Record<string, unknown>[];
  'Note'?: string;
  'Information'?: string;
  'Error Message'?: string;
}

/**
 * 获取利润表（AV INCOME_STATEMENT 端点）
 * @param freq "annual" | "quarterly"（默认 annual）
 */
export async function getIncomeStatementAV(ticker: string, freq: string = 'annual'): Promise<string> {
  try {
    const apiKey = getApiKey();
    const resp = await axios.get<AVIncomeStatementResponse>(BASE_URL, {
      params: {
        function: 'INCOME_STATEMENT',
        symbol: ticker,
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

    const isQuarterly = freq === 'quarterly';
    const statements = isQuarterly ? data.quarterlyReports : data.annualReports;

    if (!statements || statements.length === 0) {
      return `No income statement (${freq}) data for ${ticker}`;
    }

    return formatStatements(
      statements,
      `Income Statement (${freq}): ${ticker}`,
      'fiscalDateEnding',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error fetching AV income statement for ${ticker}: ${msg}`;
  }
}
