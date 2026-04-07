/**
 * 工具定义 + 执行器 — 1:1 对齐 Python TradingAgents 的 @tool 装饰器
 *
 * 每个工具对应 Python 原版中 LangChain @tool 装饰的函数。
 * LLM 自主决定调用哪些工具和参数。
 */

import type { ToolDefinition } from '../llm/llm-client.js';
import { routeToVendor } from '../dataflows/interface.js';

// ================================================================
// 工具 Schema 定义（OpenAI function calling 格式）
// ================================================================

export const TOOL_GET_STOCK_DATA: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_stock_data',
    description: 'Retrieve stock price data (OHLCV) for a given ticker symbol. Returns a formatted dataframe containing the stock price data for the specified ticker symbol in the specified date range.',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Ticker symbol of the company, e.g. AAPL, TSM, BTC-USD' },
        start_date: { type: 'string', description: 'Start date in yyyy-mm-dd format' },
        end_date: { type: 'string', description: 'End date in yyyy-mm-dd format' },
      },
      required: ['symbol', 'start_date', 'end_date'],
    },
  },
};

export const TOOL_GET_INDICATORS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_indicators',
    description: 'Retrieve a single technical indicator for a given ticker symbol. Call this tool once per indicator. Supported indicators: close_50_sma, close_200_sma, close_10_ema, macd, macds, macdh, rsi, boll, boll_ub, boll_lb, atr, vwma.',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Ticker symbol of the company, e.g. AAPL, TSM' },
        indicator: { type: 'string', description: 'A single technical indicator name, e.g. rsi, macd. Call this tool once per indicator.' },
        curr_date: { type: 'string', description: 'The current trading date you are trading on, YYYY-mm-dd' },
        look_back_days: { type: 'integer', description: 'How many days to look back, default is 30' },
      },
      required: ['symbol', 'indicator', 'curr_date'],
    },
  },
};

export const TOOL_GET_NEWS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_news',
    description: 'Retrieve news data for a given ticker symbol. Returns a formatted string containing news data.',
    parameters: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Ticker symbol' },
        start_date: { type: 'string', description: 'Start date in yyyy-mm-dd format' },
        end_date: { type: 'string', description: 'End date in yyyy-mm-dd format' },
      },
      required: ['ticker', 'start_date', 'end_date'],
    },
  },
};

export const TOOL_GET_GLOBAL_NEWS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_global_news',
    description: 'Retrieve global macroeconomic news data. Returns a formatted string containing global news data.',
    parameters: {
      type: 'object',
      properties: {
        curr_date: { type: 'string', description: 'Current date in yyyy-mm-dd format' },
        look_back_days: { type: 'integer', description: 'Number of days to look back (default 7)' },
        limit: { type: 'integer', description: 'Maximum number of articles to return (default 5)' },
      },
      required: ['curr_date'],
    },
  },
};

export const TOOL_GET_INSIDER_TRANSACTIONS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_insider_transactions',
    description: 'Retrieve insider transaction information about a company. Returns a report of insider transaction data.',
    parameters: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Ticker symbol of the company' },
      },
      required: ['ticker'],
    },
  },
};

export const TOOL_GET_FUNDAMENTALS: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_fundamentals',
    description: 'Retrieve comprehensive fundamental data for a given ticker symbol. Returns a formatted report containing market cap, PE ratios, EPS, dividend yield, etc.',
    parameters: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Ticker symbol of the company' },
        curr_date: { type: 'string', description: 'Current date you are trading at, yyyy-mm-dd' },
      },
      required: ['ticker', 'curr_date'],
    },
  },
};

export const TOOL_GET_BALANCE_SHEET: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_balance_sheet',
    description: 'Retrieve balance sheet data for a given ticker symbol. Returns a formatted report containing balance sheet data.',
    parameters: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Ticker symbol of the company' },
        freq: { type: 'string', description: 'Reporting frequency: annual/quarterly (default quarterly)' },
        curr_date: { type: 'string', description: 'Current date you are trading at, yyyy-mm-dd' },
      },
      required: ['ticker'],
    },
  },
};

export const TOOL_GET_CASHFLOW: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_cashflow',
    description: 'Retrieve cash flow statement data for a given ticker symbol.',
    parameters: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Ticker symbol of the company' },
        freq: { type: 'string', description: 'Reporting frequency: annual/quarterly (default quarterly)' },
        curr_date: { type: 'string', description: 'Current date you are trading at, yyyy-mm-dd' },
      },
      required: ['ticker'],
    },
  },
};

export const TOOL_GET_INCOME_STATEMENT: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_income_statement',
    description: 'Retrieve income statement data for a given ticker symbol.',
    parameters: {
      type: 'object',
      properties: {
        ticker: { type: 'string', description: 'Ticker symbol of the company' },
        freq: { type: 'string', description: 'Reporting frequency: annual/quarterly (default quarterly)' },
        curr_date: { type: 'string', description: 'Current date you are trading at, yyyy-mm-dd' },
      },
      required: ['ticker'],
    },
  },
};

// ================================================================
// 工具集合（按分析师分组，对齐 Python setup.py _create_tool_nodes）
// ================================================================

export const MARKET_ANALYST_TOOLS: ToolDefinition[] = [
  TOOL_GET_STOCK_DATA,
  TOOL_GET_INDICATORS,
];

export const SOCIAL_ANALYST_TOOLS: ToolDefinition[] = [
  TOOL_GET_NEWS,
];

export const NEWS_ANALYST_TOOLS: ToolDefinition[] = [
  TOOL_GET_NEWS,
  TOOL_GET_GLOBAL_NEWS,
  TOOL_GET_INSIDER_TRANSACTIONS,
];

export const FUNDAMENTALS_ANALYST_TOOLS: ToolDefinition[] = [
  TOOL_GET_FUNDAMENTALS,
  TOOL_GET_BALANCE_SHEET,
  TOOL_GET_CASHFLOW,
  TOOL_GET_INCOME_STATEMENT,
];

// ================================================================
// 工具执行器（统一入口，route 到 dataflows/interface）
// ================================================================

/**
 * 执行工具调用 — 将 LLM 的 tool_call 参数路由到实际数据源
 *
 * 注意：Python 原版 tool 名 `get_news` 在 interface.ts 中映射为 `get_ticker_news`
 */
export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    switch (name) {
      case 'get_stock_data':
        return await routeToVendor('get_stock_data',
          args.symbol as string, args.start_date as string, args.end_date as string);

      case 'get_indicators': {
        // Python 原版：LLM 可能传逗号分隔，逐个调用
        const indicator = args.indicator as string;
        const indicators = indicator.split(',').map(s => s.trim()).filter(Boolean);
        const results: string[] = [];
        for (const ind of indicators) {
          const r = await routeToVendor('get_indicators',
            args.symbol as string, ind, args.curr_date as string,
            args.look_back_days as number | undefined);
          results.push(r);
        }
        return results.join('\n\n');
      }

      case 'get_news':
        // Python tool 名是 get_news，内部映射到 get_ticker_news
        return await routeToVendor('get_ticker_news',
          args.ticker as string, args.start_date as string, args.end_date as string);

      case 'get_global_news':
        return await routeToVendor('get_global_news',
          args.curr_date as string,
          (args.look_back_days as number) ?? 7,
          (args.limit as number) ?? 5);

      case 'get_insider_transactions':
        return await routeToVendor('get_insider_transactions', args.ticker as string);

      case 'get_fundamentals':
        // 对齐 Python: route_to_vendor("get_fundamentals", ticker, curr_date)
        return await routeToVendor('get_fundamentals',
          args.ticker as string, args.curr_date as string | undefined);

      case 'get_balance_sheet':
        // 对齐 Python: route_to_vendor("get_balance_sheet", ticker, freq, curr_date)
        return await routeToVendor('get_balance_sheet',
          args.ticker as string, (args.freq as string) ?? 'quarterly', args.curr_date as string | undefined);

      case 'get_cashflow':
        return await routeToVendor('get_cashflow',
          args.ticker as string, (args.freq as string) ?? 'quarterly', args.curr_date as string | undefined);

      case 'get_income_statement':
        return await routeToVendor('get_income_statement',
          args.ticker as string, (args.freq as string) ?? 'quarterly', args.curr_date as string | undefined);

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err: any) {
    return `Error executing tool ${name}: ${err.message || String(err)}`;
  }
}
