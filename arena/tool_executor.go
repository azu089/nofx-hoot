package arena

import (
	"encoding/json"
	"fmt"
	"nofx/kernel"
	"nofx/market"
	"nofx/mcp"
	"sort"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// tool_executor.go — 10 个工具的执行器
//
// LLM 发起工具调用后，这里根据工具名分发到对应的执行函数。
// 数据从 ToolContext 里取（nofx 的 market.Data / MarketSignals / EventSignal），
// 格式化后作为字符串返回给 LLM（role="tool" 消息的 content）。
//
// 加密货币适配：
//   - get_stock_data / get_indicators / get_fundamentals / get_news / get_global_news
//     映射到 nofx 现有数据源
//   - get_balance_sheet / get_cashflow / get_income_statement / get_insider_transactions
//     加密货币无对应数据，返回 "Not applicable for crypto" 提示，LLM 会自行跳过
// ---------------------------------------------------------------------------

// ToolContext 工具调用上下文
// 由 agents.go 在调用 tool calling 循环前构造，保存当前辩论周期的所有数据源引用
type ToolContext struct {
	Symbol     string
	TradeDate  string
	MarketData *market.Data
	Signals    *kernel.MarketSignals
	Events     []kernel.EventSignal
}

// ExecuteToolCall 根据工具名分发执行
// 参数：LLM 返回的 ToolCall 结构 + 上下文
// 返回：格式化后的字符串（作为 role="tool" 消息的 content 返回给 LLM）
func ExecuteToolCall(tc mcp.ToolCall, ctx *ToolContext) (string, error) {
	// 解析参数 JSON
	var args map[string]any
	if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil {
		return "", fmt.Errorf("failed to parse tool arguments: %w", err)
	}

	// 统一规范化 symbol/ticker 参数（Python 原版靠 vendor 做这件事；Go 版显式做）
	// 处理 LLM 可能传入的各种格式：BTC / btcusdt / BTC_USDT / BTC-USDT-SWAP / BTCUSDT
	// 全部规范化为 nofx 内部格式（BTCUSDT）
	if mismatchErr := normalizeSymbolArgs(args, ctx); mismatchErr != "" {
		// 如果 LLM 传的 symbol 与当前辩论周期的 symbol 不一致，返回明确提示
		// 让 LLM 自行纠正（不中断辩论）
		return mismatchErr, nil
	}

	// 按工具名分发
	switch tc.Function.Name {
	case "get_stock_data":
		return execGetStockData(args, ctx)
	case "get_indicators":
		return execGetIndicators(args, ctx)
	case "get_fundamentals":
		return execGetFundamentals(args, ctx)
	case "get_balance_sheet":
		return execGetBalanceSheet(args, ctx)
	case "get_cashflow":
		return execGetCashflow(args, ctx)
	case "get_income_statement":
		return execGetIncomeStatement(args, ctx)
	case "get_news":
		return execGetNews(args, ctx)
	case "get_global_news":
		return execGetGlobalNews(args, ctx)
	case "get_insider_transactions":
		return execGetInsiderTransactions(args, ctx)
	default:
		return fmt.Sprintf("Unknown tool: %s", tc.Function.Name), nil
	}
}

// normalizeSymbolArgs 规范化 LLM 传入的 symbol/ticker 参数
//
// 处理的格式（全部规范化为 nofx 内部标准 "BTCUSDT" 格式）：
//   - "BTC" → "BTCUSDT"
//   - "btcusdt" → "BTCUSDT"
//   - "BTC_USDT" → "BTCUSDT"
//   - "BTC-USDT-SWAP" → "BTCUSDT"
//   - "BTCUSDT" → "BTCUSDT"（保持）
//
// 如果规范化后与当前辩论周期的 ctx.Symbol 不一致，返回错误提示字符串，
// 让 LLM 自行纠正 —— 这对应 Python 原版 build_instrument_context 里
// "Use this exact ticker in every tool call" 的软约束。
//
// 返回空字符串表示一切正常；非空字符串表示错误消息（直接作为 tool result 返回给 LLM）。
func normalizeSymbolArgs(args map[string]any, ctx *ToolContext) string {
	// 两个可能的参数名：symbol（get_stock_data / get_indicators）和 ticker（其他工具）
	for _, key := range []string{"symbol", "ticker"} {
		raw, ok := args[key].(string)
		if !ok || raw == "" {
			continue
		}
		normalized := market.Normalize(raw)
		// 写回规范化后的值
		args[key] = normalized

		// 与当前辩论周期的 symbol 对比（ctx.Symbol 本身就应该是已规范化的）
		expected := market.Normalize(ctx.Symbol)
		if normalized != expected {
			return fmt.Sprintf(
				"Error: You requested data for '%s' (normalized to '%s'), but the current debate cycle is analyzing '%s'. "+
					"Please use the exact ticker '%s' in all tool calls for this analysis session. "+
					"If you want to reference another asset, note it in your report's written analysis only.",
				raw, normalized, expected, expected,
			)
		}
	}
	return ""
}

// ============================================================================
// 核心数据工具 — get_stock_data
// ============================================================================

// execGetStockData 返回 OHLCV K 线数据（DataFrame 风格）
// nofx 数据源：market.Data.TimeframeData["1h"/"4h"].Klines
// Python 原版返回格式示例：
//
//	## Price data for AAPL from 2024-01-01 to 2024-01-31
//	Date        Open    High    Low     Close   Volume
//	2024-01-02  187.15  188.44  183.89  185.64  82488671
//	...
func execGetStockData(args map[string]any, ctx *ToolContext) (string, error) {
	symbol, _ := args["symbol"].(string)
	startDate, _ := args["start_date"].(string)
	endDate, _ := args["end_date"].(string)

	if ctx.MarketData == nil {
		return fmt.Sprintf("No market data available for %s", symbol), nil
	}

	// 选择合适的时间框架：日期范围越长用越大的时间框架
	tf := selectTimeframe(startDate, endDate)
	tsData := ctx.MarketData.TimeframeData[tf]
	if tsData == nil || len(tsData.Klines) == 0 {
		// 回退到任意可用的时间框架
		for _, alt := range []string{"1h", "4h", "15m", "5m", "1m"} {
			if ts, ok := ctx.MarketData.TimeframeData[alt]; ok && len(ts.Klines) > 0 {
				tsData = ts
				tf = alt
				break
			}
		}
	}
	if tsData == nil || len(tsData.Klines) == 0 {
		return fmt.Sprintf("No kline data available for %s in range %s to %s", symbol, startDate, endDate), nil
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("## Price data for %s from %s to %s (timeframe: %s)\n", symbol, startDate, endDate, tf))
	b.WriteString("Date                     Open         High         Low          Close        Volume\n")

	// 取最近 100 根（避免过长）
	klines := tsData.Klines
	start := 0
	if len(klines) > 100 {
		start = len(klines) - 100
	}
	for _, k := range klines[start:] {
		t := time.UnixMilli(k.Time).UTC().Format("2006-01-02 15:04:05")
		b.WriteString(fmt.Sprintf("%-24s %-12.4f %-12.4f %-12.4f %-12.4f %-12.2f\n",
			t, k.Open, k.High, k.Low, k.Close, k.Volume))
	}
	b.WriteString(fmt.Sprintf("\n%d bars total (showing last %d).\n", len(klines), len(klines)-start))

	return b.String(), nil
}

// ============================================================================
// 技术指标工具 — get_indicators
// ============================================================================

// execGetIndicators 返回单个技术指标序列
// Python 原版支持的指标名称 → nofx 数据字段映射：
//
//	close_50_sma / close_200_sma → 不支持（nofx 没预计算 SMA）→ 返回提示
//	close_10_ema → EMA20Values（近似，nofx 没有 EMA10）
//	macd / macds / macdh → MACDValues（nofx 只有主 MACD 线）
//	rsi → RSI14Values（默认用 14），或 RSI7Values
//	boll / boll_ub / boll_lb → BOLLMiddle / BOLLUpper / BOLLLower
//	atr → ATR14
//	vwma → 不支持
func execGetIndicators(args map[string]any, ctx *ToolContext) (string, error) {
	symbol, _ := args["symbol"].(string)
	indicator, _ := args["indicator"].(string)
	currDate, _ := args["curr_date"].(string)
	lookBack := 30
	if v, ok := args["look_back_days"].(float64); ok {
		lookBack = int(v)
	}

	// Python 原版支持逗号分隔多个指标，也对应处理
	indicators := strings.Split(indicator, ",")
	var results []string
	for _, ind := range indicators {
		ind = strings.TrimSpace(ind)
		if ind == "" {
			continue
		}
		results = append(results, formatSingleIndicator(symbol, ind, currDate, lookBack, ctx))
	}
	return strings.Join(results, "\n\n"), nil
}

func formatSingleIndicator(symbol, indicator, currDate string, lookBack int, ctx *ToolContext) string {
	if ctx.MarketData == nil {
		return fmt.Sprintf("No market data available for %s", symbol)
	}

	// 对无序列 / 未映射 / 不支持的指标提前返回
	switch strings.ToLower(indicator) {
	case "close_50_sma":
		return fmt.Sprintf("Indicator '%s' not precomputed in nofx. Consider using close_10_ema (EMA20) or close_200_sma alternatives.", indicator)
	case "close_200_sma":
		return fmt.Sprintf("Indicator '%s' not precomputed in nofx. Consider using EMA50 via close_10_ema instead.", indicator)
	case "macds", "macd_signal":
		return "MACD signal line not separately computed in nofx. MACD line is available via indicator=macd."
	case "macdh", "macd_histogram":
		return "MACD histogram not separately computed in nofx. MACD line is available via indicator=macd."
	case "vwma":
		return fmt.Sprintf("Indicator '%s' not available in nofx.", indicator)
	}

	// 选择初始时间框架（按 lookBack 自适应）+ fallback 链
	primaryTf := selectIndicatorTimeframe(lookBack)
	tf, tsData := findTimeframeWithIndicatorData(ctx.MarketData.TimeframeData, primaryTf, indicator)
	if tsData == nil {
		return fmt.Sprintf("No data available for indicator '%s' on %s (no timeframe in the current dataset has this indicator populated).", indicator, symbol)
	}

	// ATR 是单值不是序列，特殊处理
	if ind := strings.ToLower(indicator); ind == "atr" || ind == "atr14" {
		return fmt.Sprintf("## ATR14 for %s at %s (timeframe %s)\nCurrent ATR14: %.4f (single value, not a series)\n", symbol, currDate, tf, tsData.ATR14)
	}

	var values []float64
	var description string

	switch strings.ToLower(indicator) {
	case "close_10_ema":
		values = tsData.EMA20Values
		description = "EMA20 (substitute for close_10_ema)"
	case "ema20":
		values = tsData.EMA20Values
		description = "EMA20"
	case "ema50":
		values = tsData.EMA50Values
		description = "EMA50"
	case "macd":
		values = tsData.MACDValues
		description = "MACD line"
	case "rsi", "rsi14":
		values = tsData.RSI14Values
		description = "RSI14"
	case "rsi7":
		values = tsData.RSI7Values
		description = "RSI7"
	case "boll", "boll_middle", "boll_mid":
		values = tsData.BOLLMiddle
		description = "Bollinger Middle Band (20-period SMA)"
	case "boll_ub", "boll_upper":
		values = tsData.BOLLUpper
		description = "Bollinger Upper Band"
	case "boll_lb", "boll_lower":
		values = tsData.BOLLLower
		description = "Bollinger Lower Band"
	default:
		return fmt.Sprintf("Unknown indicator '%s'. Supported: close_10_ema, ema20, ema50, macd, rsi, rsi7, boll, boll_ub, boll_lb, atr.", indicator)
	}

	if len(values) == 0 {
		return fmt.Sprintf("No data available for indicator '%s' on %s", indicator, symbol)
	}

	// 取最近 lookBack 个值
	start := 0
	if len(values) > lookBack {
		start = len(values) - lookBack
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("## %s for %s (timeframe %s, last %d values)\n", description, symbol, tf, len(values)-start))
	for i, v := range values[start:] {
		b.WriteString(fmt.Sprintf("  [%d] %.6f\n", i+1, v))
	}
	return b.String()
}

// selectIndicatorTimeframe 根据 look_back_days 选择初始时间框架
// 对应 Python 原版 get_indicators 的语义：日期回望越长，用越大的时间框架
func selectIndicatorTimeframe(lookBackDays int) string {
	switch {
	case lookBackDays <= 2:
		return "5m"
	case lookBackDays <= 7:
		return "15m"
	case lookBackDays <= 30:
		return "1h"
	default:
		return "4h"
	}
}

// findTimeframeWithIndicatorData 在 fallback 链中查找第一个真正有该指标数据的时间框架
//
// nofx 的 TimeframeData map 里哪些 tf 存在取决于策略配置（不一定有 4h/1h 等）。
// 即使 tf 存在，某些指标字段可能也是空的（例如只有 Klines 但没算 BOLL）。
// 这个函数做三层检查：1) tf 存在  2) ts 非 nil  3) 指标字段真的有数据。
func findTimeframeWithIndicatorData(
	tsMap map[string]*market.TimeframeSeriesData,
	primaryTf string,
	indicator string,
) (string, *market.TimeframeSeriesData) {
	order := []string{primaryTf, "1h", "4h", "15m", "5m", "1m"}
	seen := map[string]bool{}
	for _, tf := range order {
		if seen[tf] {
			continue
		}
		seen[tf] = true
		ts := tsMap[tf]
		if ts == nil {
			continue
		}
		if hasIndicatorSeries(ts, indicator) {
			return tf, ts
		}
	}
	return "", nil
}

// hasIndicatorSeries 检查某个时间框架的数据是否真的包含该指标
func hasIndicatorSeries(ts *market.TimeframeSeriesData, indicator string) bool {
	switch strings.ToLower(indicator) {
	case "close_10_ema", "ema20":
		return len(ts.EMA20Values) > 0
	case "ema50":
		return len(ts.EMA50Values) > 0
	case "macd":
		return len(ts.MACDValues) > 0
	case "rsi", "rsi14":
		return len(ts.RSI14Values) > 0
	case "rsi7":
		return len(ts.RSI7Values) > 0
	case "boll", "boll_middle", "boll_mid":
		return len(ts.BOLLMiddle) > 0
	case "boll_ub", "boll_upper":
		return len(ts.BOLLUpper) > 0
	case "boll_lb", "boll_lower":
		return len(ts.BOLLLower) > 0
	case "atr", "atr14":
		return ts.ATR14 != 0
	}
	return false
}

// selectTimeframe 根据日期范围选择合适的时间框架
func selectTimeframe(startDate, endDate string) string {
	layout := "2006-01-02"
	start, err1 := time.Parse(layout, startDate)
	end, err2 := time.Parse(layout, endDate)
	if err1 != nil || err2 != nil {
		return "1h" // 默认
	}
	days := end.Sub(start).Hours() / 24
	switch {
	case days <= 2:
		return "5m"
	case days <= 7:
		return "15m"
	case days <= 30:
		return "1h"
	default:
		return "4h"
	}
}

// ============================================================================
// 基本面工具 — get_fundamentals / get_balance_sheet / get_cashflow / get_income_statement
// ============================================================================

// execGetFundamentals 加密货币基本面：OI / 资金费率 / 成交量 / 市场状态
func execGetFundamentals(args map[string]any, ctx *ToolContext) (string, error) {
	ticker, _ := args["ticker"].(string)
	currDate, _ := args["curr_date"].(string)

	if ctx.MarketData == nil {
		return fmt.Sprintf("No fundamentals data available for %s", ticker), nil
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("## Fundamentals for %s as of %s\n\n", ticker, currDate))
	b.WriteString(fmt.Sprintf("Note: %s is a cryptocurrency. Traditional equity fundamentals do not apply; ", ticker))
	b.WriteString("crypto fundamentals use derivatives market data, on-chain metrics, and market regime.\n\n")

	data := ctx.MarketData
	b.WriteString("### Derivatives Market\n")
	b.WriteString(fmt.Sprintf("- Current Price: %.4f USDT\n", data.CurrentPrice))
	b.WriteString(fmt.Sprintf("- Funding Rate: %.6f\n", data.FundingRate))
	if data.OpenInterest != nil {
		b.WriteString(fmt.Sprintf("- Open Interest (Latest): %.2f\n", data.OpenInterest.Latest))
		b.WriteString(fmt.Sprintf("- Open Interest (Average): %.2f\n", data.OpenInterest.Average))
		if data.OpenInterest.Average > 0 {
			b.WriteString(fmt.Sprintf("- OI vs Average: %.2fx\n", data.OpenInterest.Latest/data.OpenInterest.Average))
		}
	}

	if data.LongerTermContext != nil {
		ltc := data.LongerTermContext
		b.WriteString("\n### 4-Hour Context\n")
		b.WriteString(fmt.Sprintf("- EMA20: %.4f\n", ltc.EMA20))
		b.WriteString(fmt.Sprintf("- EMA50: %.4f\n", ltc.EMA50))
		b.WriteString(fmt.Sprintf("- ATR14: %.4f (volatility measure)\n", ltc.ATR14))
		b.WriteString(fmt.Sprintf("- Current Volume: %.2f\n", ltc.CurrentVolume))
		b.WriteString(fmt.Sprintf("- Average Volume: %.2f\n", ltc.AverageVolume))
		if ltc.AverageVolume > 0 {
			b.WriteString(fmt.Sprintf("- Volume vs Average: %.2fx\n", ltc.CurrentVolume/ltc.AverageVolume))
		}
	}

	b.WriteString("\n### Momentum Indicators (current)\n")
	b.WriteString(fmt.Sprintf("- EMA20: %.4f\n", data.CurrentEMA20))
	b.WriteString(fmt.Sprintf("- MACD: %.4f\n", data.CurrentMACD))
	b.WriteString(fmt.Sprintf("- RSI7: %.2f\n", data.CurrentRSI7))
	b.WriteString(fmt.Sprintf("- 1h Price Change: %.2f%%\n", data.PriceChange1h))
	b.WriteString(fmt.Sprintf("- 4h Price Change: %.2f%%\n", data.PriceChange4h))

	if ctx.Signals != nil {
		if regime, ok := ctx.Signals.Regime[ticker]; ok {
			b.WriteString(fmt.Sprintf("\n### Market Regime\n- %s\n", string(regime)))
		}
	}

	return b.String(), nil
}

// execGetBalanceSheet 加密货币无对应
func execGetBalanceSheet(args map[string]any, _ *ToolContext) (string, error) {
	ticker, _ := args["ticker"].(string)
	return fmt.Sprintf(
		"Balance sheet data is not applicable for cryptocurrency asset %s. "+
			"Cryptocurrencies do not have traditional financial statements. "+
			"For crypto fundamentals, use get_fundamentals which provides OI, funding rate, volume, and regime data.",
		ticker), nil
}

// execGetCashflow 加密货币无对应
func execGetCashflow(args map[string]any, _ *ToolContext) (string, error) {
	ticker, _ := args["ticker"].(string)
	return fmt.Sprintf(
		"Cash flow statement is not applicable for cryptocurrency asset %s. "+
			"Cryptocurrencies do not have traditional financial statements. "+
			"Use get_fundamentals for crypto-specific metrics.",
		ticker), nil
}

// execGetIncomeStatement 加密货币无对应
func execGetIncomeStatement(args map[string]any, _ *ToolContext) (string, error) {
	ticker, _ := args["ticker"].(string)
	return fmt.Sprintf(
		"Income statement is not applicable for cryptocurrency asset %s. "+
			"Cryptocurrencies do not generate revenue or earnings in the traditional sense. "+
			"Use get_fundamentals for crypto-specific metrics.",
		ticker), nil
}

// ============================================================================
// 新闻工具 — get_news / get_global_news / get_insider_transactions
// ============================================================================

// execGetNews 币种相关新闻/事件
func execGetNews(args map[string]any, ctx *ToolContext) (string, error) {
	ticker, _ := args["ticker"].(string)
	startDate, _ := args["start_date"].(string)
	endDate, _ := args["end_date"].(string)

	if len(ctx.Events) == 0 {
		return fmt.Sprintf("No news data available for %s in range %s to %s", ticker, startDate, endDate), nil
	}

	// 过滤：symbol 相关 + 在日期窗口内
	var matched []kernel.EventSignal
	for _, ev := range ctx.Events {
		if ev.AffectsSymbol(ticker) {
			matched = append(matched, ev)
		}
	}

	// 按 severity 排序
	sort.Slice(matched, func(i, j int) bool {
		return matched[i].Severity > matched[j].Severity
	})

	if len(matched) == 0 {
		return fmt.Sprintf("No news found for %s in range %s to %s. (Total %d events checked, none affect this symbol.)",
			ticker, startDate, endDate, len(ctx.Events)), nil
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("## News for %s from %s to %s\n\n", ticker, startDate, endDate))
	for i, ev := range matched {
		if i >= 15 {
			b.WriteString(fmt.Sprintf("... and %d more events.\n", len(matched)-15))
			break
		}
		b.WriteString(fmt.Sprintf("### [%d] [%s] Severity:%d Direction:%s\n", i+1, ev.Category, ev.Severity, ev.Direction))
		b.WriteString(fmt.Sprintf("- **Summary**: %s\n", ev.Summary))
		b.WriteString(fmt.Sprintf("- **Source**: %s (%s)\n", ev.SourceName, ev.SourceType))
		b.WriteString(fmt.Sprintf("- **Time**: %s to %s\n", ev.StartsAt.Format("2006-01-02 15:04"), ev.EndsAt.Format("2006-01-02 15:04")))
		b.WriteString(fmt.Sprintf("- **Confidence**: %.2f\n", ev.Confidence))
		if len(ev.AffectedSymbols) > 0 {
			b.WriteString(fmt.Sprintf("- **Affected**: %s\n", strings.Join(ev.AffectedSymbols, ", ")))
		}
		b.WriteString("\n")
	}
	return b.String(), nil
}

// execGetGlobalNews 宏观新闻
func execGetGlobalNews(args map[string]any, ctx *ToolContext) (string, error) {
	currDate, _ := args["curr_date"].(string)
	lookBack := 7
	if v, ok := args["look_back_days"].(float64); ok {
		lookBack = int(v)
	}
	limit := 5
	if v, ok := args["limit"].(float64); ok {
		limit = int(v)
	}

	// 过滤 scope=="market" 的宏观事件
	var macroEvents []kernel.EventSignal
	for _, ev := range ctx.Events {
		if ev.Scope == "market" {
			macroEvents = append(macroEvents, ev)
		}
	}

	sort.Slice(macroEvents, func(i, j int) bool {
		return macroEvents[i].Severity > macroEvents[j].Severity
	})

	if len(macroEvents) == 0 {
		return fmt.Sprintf("No global macro news available as of %s (looking back %d days)", currDate, lookBack), nil
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("## Global Macro News as of %s (last %d days, top %d)\n\n", currDate, lookBack, limit))
	for i, ev := range macroEvents {
		if i >= limit {
			break
		}
		b.WriteString(fmt.Sprintf("### [%d] [%s] Severity:%d\n", i+1, ev.Category, ev.Severity))
		b.WriteString(fmt.Sprintf("- **Direction**: %s\n", ev.Direction))
		b.WriteString(fmt.Sprintf("- **Summary**: %s\n", ev.Summary))
		b.WriteString(fmt.Sprintf("- **Source**: %s\n", ev.SourceName))
		b.WriteString(fmt.Sprintf("- **Time**: %s\n", ev.StartsAt.Format("2006-01-02 15:04 UTC")))
		b.WriteString("\n")
	}
	return b.String(), nil
}

// execGetInsiderTransactions 加密货币无对应
func execGetInsiderTransactions(args map[string]any, _ *ToolContext) (string, error) {
	ticker, _ := args["ticker"].(string)
	return fmt.Sprintf(
		"Insider transactions are not applicable for cryptocurrency asset %s. "+
			"Cryptocurrencies are not traded on traditional stock exchanges and do not have corporate insiders. "+
			"For on-chain insight into large holder activity, whale wallet tracking would be the closest equivalent "+
			"(not currently available in this environment). For now, rely on news and sentiment analysis instead.",
		ticker), nil
}
