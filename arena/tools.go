// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package arena

import (
	"strings"

	"nofx/mcp"
)

// ---------------------------------------------------------------------------
// tools.go — 10 个工具的 mcp.Tool 定义
//
// Tool catalogue (matches TradingAgents ICAIF 2024 tool naming):
//   get_stock_data, get_indicators
//   get_fundamentals, get_balance_sheet, get_cashflow, get_income_statement
//   get_news, get_global_news, get_insider_transactions
//
// Parameter schemas mirror the original @tool decorator annotations.
// Tool names retain stock/ticker semantics; crypto normalization is handled in the executor layer.
// ---------------------------------------------------------------------------

// ============================================================================
// 核心数据工具 (core_stock_tools.py)
// ============================================================================

var ToolGetStockData = mcp.Tool{
	Type: "function",
	Function: mcp.FunctionDef{
		Name: "get_stock_data",
		Description: "Retrieve stock price data (OHLCV) for a given ticker symbol. " +
			"Uses the configured core_stock_apis vendor. " +
			"Returns a formatted dataframe containing the stock price data for the specified ticker symbol in the specified date range.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"symbol": map[string]any{
					"type":        "string",
					"description": "ticker symbol of the company",
				},
				"start_date": map[string]any{
					"type":        "string",
					"description": "Start date in yyyy-mm-dd format",
				},
				"end_date": map[string]any{
					"type":        "string",
					"description": "End date in yyyy-mm-dd format",
				},
			},
			"required": []string{"symbol", "start_date", "end_date"},
		},
	},
}

// ============================================================================
// 技术指标工具 (technical_indicators_tools.py)
// ============================================================================

var ToolGetIndicators = mcp.Tool{
	Type: "function",
	Function: mcp.FunctionDef{
		Name: "get_indicators",
		Description: "Retrieve a single technical indicator for a given ticker symbol. " +
			"Uses the configured technical_indicators vendor. " +
			"Call this tool once per indicator. " +
			"Supported indicators: close_10_ema, macd, rsi, boll, boll_ub, boll_lb, atr. " +
			"Returns a formatted dataframe containing the technical indicators for the specified ticker symbol and indicator.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"symbol": map[string]any{
					"type":        "string",
					"description": "ticker symbol of the company",
				},
				"indicator": map[string]any{
					"type":        "string",
					"description": "technical indicator to get the analysis and report of",
				},
				"curr_date": map[string]any{
					"type":        "string",
					"description": "The current trading date you are trading on, YYYY-mm-dd",
				},
				"look_back_days": map[string]any{
					"type":        "integer",
					"description": "how many days to look back",
					"default":     30,
				},
			},
			"required": []string{"symbol", "indicator", "curr_date"},
		},
	},
}

// ============================================================================
// 基本面工具 (fundamental_data_tools.py)
// ============================================================================

var ToolGetFundamentals = mcp.Tool{
	Type: "function",
	Function: mcp.FunctionDef{
		Name: "get_fundamentals",
		Description: "Retrieve comprehensive fundamental data for a given ticker symbol. " +
			"Uses the configured fundamental_data vendor. " +
			"Returns a formatted report containing comprehensive fundamental data.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"ticker": map[string]any{
					"type":        "string",
					"description": "ticker symbol",
				},
				"curr_date": map[string]any{
					"type":        "string",
					"description": "current date you are trading at, yyyy-mm-dd",
				},
			},
			"required": []string{"ticker", "curr_date"},
		},
	},
}

var ToolGetBalanceSheet = mcp.Tool{
	Type: "function",
	Function: mcp.FunctionDef{
		Name: "get_balance_sheet",
		Description: "Retrieve balance sheet data for a given ticker symbol. " +
			"Uses the configured fundamental_data vendor. " +
			"Returns a formatted report containing balance sheet data.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"ticker": map[string]any{
					"type":        "string",
					"description": "ticker symbol",
				},
				"freq": map[string]any{
					"type":        "string",
					"description": "reporting frequency: annual/quarterly",
					"default":     "quarterly",
				},
				"curr_date": map[string]any{
					"type":        "string",
					"description": "current date you are trading at, yyyy-mm-dd",
				},
			},
			"required": []string{"ticker"},
		},
	},
}

var ToolGetCashflow = mcp.Tool{
	Type: "function",
	Function: mcp.FunctionDef{
		Name: "get_cashflow",
		Description: "Retrieve cash flow statement data for a given ticker symbol. " +
			"Uses the configured fundamental_data vendor. " +
			"Returns a formatted report containing cash flow statement data.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"ticker": map[string]any{
					"type":        "string",
					"description": "ticker symbol",
				},
				"freq": map[string]any{
					"type":        "string",
					"description": "reporting frequency: annual/quarterly",
					"default":     "quarterly",
				},
				"curr_date": map[string]any{
					"type":        "string",
					"description": "current date you are trading at, yyyy-mm-dd",
				},
			},
			"required": []string{"ticker"},
		},
	},
}

var ToolGetIncomeStatement = mcp.Tool{
	Type: "function",
	Function: mcp.FunctionDef{
		Name: "get_income_statement",
		Description: "Retrieve income statement data for a given ticker symbol. " +
			"Uses the configured fundamental_data vendor. " +
			"Returns a formatted report containing income statement data.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"ticker": map[string]any{
					"type":        "string",
					"description": "ticker symbol",
				},
				"freq": map[string]any{
					"type":        "string",
					"description": "reporting frequency: annual/quarterly",
					"default":     "quarterly",
				},
				"curr_date": map[string]any{
					"type":        "string",
					"description": "current date you are trading at, yyyy-mm-dd",
				},
			},
			"required": []string{"ticker"},
		},
	},
}

// ============================================================================
// 新闻工具 (news_data_tools.py)
// ============================================================================

var ToolGetNews = mcp.Tool{
	Type: "function",
	Function: mcp.FunctionDef{
		Name: "get_news",
		Description: "Retrieve news data for a given ticker symbol. " +
			"Uses the configured news_data vendor. " +
			"Returns a formatted string containing news data.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"ticker": map[string]any{
					"type":        "string",
					"description": "Ticker symbol",
				},
				"start_date": map[string]any{
					"type":        "string",
					"description": "Start date in yyyy-mm-dd format",
				},
				"end_date": map[string]any{
					"type":        "string",
					"description": "End date in yyyy-mm-dd format",
				},
			},
			"required": []string{"ticker", "start_date", "end_date"},
		},
	},
}

var ToolGetGlobalNews = mcp.Tool{
	Type: "function",
	Function: mcp.FunctionDef{
		Name: "get_global_news",
		Description: "Retrieve global news data. " +
			"Uses the configured news_data vendor. " +
			"Returns a formatted string containing global news data.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"curr_date": map[string]any{
					"type":        "string",
					"description": "Current date in yyyy-mm-dd format",
				},
				"look_back_days": map[string]any{
					"type":        "integer",
					"description": "Number of days to look back",
					"default":     7,
				},
				"limit": map[string]any{
					"type":        "integer",
					"description": "Maximum number of articles to return",
					"default":     5,
				},
			},
			"required": []string{"curr_date"},
		},
	},
}

var ToolGetInsiderTransactions = mcp.Tool{
	Type: "function",
	Function: mcp.FunctionDef{
		Name: "get_insider_transactions",
		Description: "Retrieve insider transaction information about a company. " +
			"Uses the configured news_data vendor. " +
			"Returns a report of insider transaction data.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"ticker": map[string]any{
					"type":        "string",
					"description": "ticker symbol of the company",
				},
			},
			"required": []string{"ticker"},
		},
	},
}

// ============================================================================
// 分析师 → 工具集映射
// ============================================================================

// AnalystToolSets 每个分析师绑定的工具列表
var AnalystToolSets = map[string][]mcp.Tool{
	AnalystMarket: {
		ToolGetStockData,
		ToolGetIndicators,
	},
	AnalystSocial: {
		ToolGetNews,
	},
	AnalystNews: {
		ToolGetNews,
		ToolGetGlobalNews,
		// news_analyst only uses get_news + get_global_news.
		// get_insider_transactions is defined but not assigned to any analyst.
	},
	AnalystFundamentals: {
		ToolGetFundamentals,
		ToolGetBalanceSheet,
		ToolGetCashflow,
		ToolGetIncomeStatement,
	},
}

// ToolNamesForAnalyst 返回分析师的工具名称列表（逗号分隔）
// 用于填充 system prompt 里的 {tool_names} 占位符
func ToolNamesForAnalyst(analyst string) string {
	tools := AnalystToolSets[analyst]
	names := make([]string, len(tools))
	for i, t := range tools {
		names[i] = t.Function.Name
	}
	return strings.Join(names, ", ")
}
