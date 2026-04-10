// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package binance_data

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// tickerStat is a slim view of /fapi/v1/ticker/24hr.
// Tags use ,string so callers may unmarshal Binance JSON directly without
// going through rawTicker. Existing fetchAllTickers still uses rawTicker
// (kept for backwards compatibility) — these tags are for future direct use.
type tickerStat struct {
	Symbol             string  `json:"symbol"`
	LastPrice          float64 `json:"lastPrice,string"`
	PriceChangePercent float64 `json:"priceChangePercent,string"`
	QuoteVolume        float64 `json:"quoteVolume,string"`
}

// rawTicker is the literal JSON shape returned by Binance.
type rawTicker struct {
	Symbol             string `json:"symbol"`
	LastPrice          string `json:"lastPrice"`
	PriceChangePercent string `json:"priceChangePercent"`
	QuoteVolume        string `json:"quoteVolume"`
}

// fetchAllTickers returns all USDT-perp 24h tickers.
func (c *Client) fetchAllTickers() ([]tickerStat, error) {
	var raw []rawTicker
	if err := c.doGet("/fapi/v1/ticker/24hr", &raw); err != nil {
		return nil, err
	}

	out := make([]tickerStat, 0, len(raw))
	for _, r := range raw {
		// Only USDT perps; skip BUSD/coin-margined etc.
		if !strings.HasSuffix(r.Symbol, "USDT") {
			continue
		}
		last, _ := strconv.ParseFloat(r.LastPrice, 64)
		pct, _ := strconv.ParseFloat(r.PriceChangePercent, 64)
		qv, _ := strconv.ParseFloat(r.QuoteVolume, 64)
		out = append(out, tickerStat{
			Symbol:             r.Symbol,
			LastPrice:          last,
			PriceChangePercent: pct,
			QuoteVolume:        qv,
		})
	}
	return out, nil
}

// getTopVolumeSymbols returns the top-N symbols by 24h quote volume.
func (c *Client) getTopVolumeSymbols(n int) ([]tickerStat, error) {
	all, err := c.fetchAllTickers()
	if err != nil {
		return nil, err
	}
	sort.Slice(all, func(i, j int) bool {
		return all[i].QuoteVolume > all[j].QuoteVolume
	})
	if n > len(all) {
		n = len(all)
	}
	return all[:n], nil
}

// klineSummary is a tiny container for the close price at a window boundary.
type klineSummary struct {
	OpenTime  int64
	Open      float64
	Close     float64
	CloseTime int64
}

// fetchKlinesClose computes a price change over the last `lookback` candles
// of the given interval. Used to back-fill durations like 4h/24h that the
// 24h ticker alone cannot answer.
func (c *Client) fetchKlinesClose(symbol, interval string, lookback int) (priceDelta float64, lastClose float64, err error) {
	// Fetch lookback+2 so we can drop the last (in-progress) bar and still
	// have lookback+1 closed bars spanning exactly `lookback * interval`.
	path := fmt.Sprintf("/fapi/v1/klines?symbol=%s&interval=%s&limit=%d", symbol, interval, lookback+2)
	var raw [][]interface{}
	if err := c.doGet(path, &raw); err != nil {
		return 0, 0, err
	}
	if len(raw) < 2 {
		return 0, 0, fmt.Errorf("insufficient klines for %s", symbol)
	}
	// Drop the last (in-progress) bar — its close is the latest tick, not a
	// closed-bar value, which previously caused 0~1-bar drift in the delta.
	if len(raw) >= 2 {
		raw = raw[:len(raw)-1]
	}
	parseClose := func(row []interface{}) float64 {
		if len(row) < 5 {
			return 0
		}
		switch v := row[4].(type) {
		case string:
			f, _ := strconv.ParseFloat(v, 64)
			return f
		case float64:
			return v
		case json.Number:
			f, _ := v.Float64()
			return f
		}
		return 0
	}
	first := parseClose(raw[0])
	last := parseClose(raw[len(raw)-1])
	if first == 0 {
		return 0, last, nil
	}
	return (last - first) / first, last, nil
}

// intervalFor maps a duration code to a (Binance kline interval, lookback)
// tuple usable with fetchKlinesClose.
func intervalFor(duration string) (interval string, lookback int) {
	switch strings.ToLower(strings.TrimSpace(duration)) {
	case "1h":
		return "5m", 12
	case "4h":
		return "15m", 16
	case "8h":
		return "30m", 16
	case "12h":
		return "1h", 12
	case "24h", "1d":
		return "1h", 24
	default:
		return "5m", 12
	}
}

// GetPriceRanking computes price ranking (top gainers / losers) over one or
// more durations using a top-volume universe.
func (c *Client) GetPriceRanking(durations string, limit int) (*PriceRanking, error) {
	if limit <= 0 {
		limit = 10
	}
	if durations == "" {
		durations = "1h"
	}
	durList := strings.Split(durations, ",")

	uniSize := 40
	if limit*3 > uniSize {
		uniSize = limit * 3
	}
	universe, err := c.getTopVolumeSymbols(uniSize)
	if err != nil {
		return nil, fmt.Errorf("price ranking universe: %w", err)
	}

	out := &PriceRanking{
		Durations: make(map[string]*PriceRankingDuration),
		FetchedAt: time.Now(),
	}

	for _, d := range durList {
		d = strings.TrimSpace(d)
		if d == "" {
			continue
		}

		// 1h shortcut: derive from 24h ticker priceChangePercent / 24 is wrong;
		// instead always use kline-based delta for accuracy.
		interval, lookback := intervalFor(d)

		// Parallelize per-symbol kline fetch (previously serial ~12s/cycle).
		var wg sync.WaitGroup
		sem := make(chan struct{}, 6)
		results := make([]PriceRankingItem, len(universe))
		valid := make([]bool, len(universe))

		for i, t := range universe {
			wg.Add(1)
			sem <- struct{}{}
			go func(i int, ticker tickerStat) {
				defer wg.Done()
				defer func() { <-sem }()
				delta, last, err := c.fetchKlinesClose(ticker.Symbol, interval, lookback)
				if err != nil {
					return
				}
				price := last
				if price == 0 {
					price = ticker.LastPrice
				}
				results[i] = PriceRankingItem{
					Pair:       ticker.Symbol,
					Symbol:     strings.TrimSuffix(ticker.Symbol, "USDT"),
					PriceDelta: delta,
					Price:      price,
				}
				valid[i] = true
			}(i, t)
		}
		wg.Wait()

		items := make([]PriceRankingItem, 0, len(universe))
		for i, v := range valid {
			if v {
				items = append(items, results[i])
			}
		}

		dur := &PriceRankingDuration{}
		sort.Slice(items, func(i, j int) bool { return items[i].PriceDelta > items[j].PriceDelta })
		if len(items) > limit {
			dur.Top = append(dur.Top, items[:limit]...)
		} else {
			dur.Top = append(dur.Top, items...)
		}
		sort.Slice(items, func(i, j int) bool { return items[i].PriceDelta < items[j].PriceDelta })
		if len(items) > limit {
			dur.Low = append(dur.Low, items[:limit]...)
		} else {
			dur.Low = append(dur.Low, items...)
		}
		out.Durations[d] = dur
	}

	return out, nil
}

// FormatPriceRankingForAI renders a price ranking payload as Markdown.
func FormatPriceRankingForAI(data *PriceRanking, lang Language) string {
	if data == nil || len(data.Durations) == 0 {
		return ""
	}
	if lang == LangChinese {
		return formatPriceRankingZH(data)
	}
	return formatPriceRankingEN(data)
}

func formatPriceRankingZH(data *PriceRanking) string {
	var sb strings.Builder
	sb.WriteString("## 涨跌幅排行\n\n")
	for _, d := range []string{"1h", "4h", "24h"} {
		dur, ok := data.Durations[d]
		if !ok || dur == nil {
			continue
		}
		sb.WriteString(fmt.Sprintf("### %s 涨跌幅\n\n", d))
		if len(dur.Top) > 0 {
			sb.WriteString("**涨幅榜**\n| 币种 | 涨幅 | 价格 |\n|------|------|------|\n")
			for _, it := range dur.Top {
				sb.WriteString(fmt.Sprintf("| %s | %+.2f%% | $%.4f |\n", it.Symbol, it.PriceDelta*100, it.Price))
			}
			sb.WriteString("\n")
		}
		if len(dur.Low) > 0 {
			sb.WriteString("**跌幅榜**\n| 币种 | 跌幅 | 价格 |\n|------|------|------|\n")
			for _, it := range dur.Low {
				sb.WriteString(fmt.Sprintf("| %s | %.2f%% | $%.4f |\n", it.Symbol, it.PriceDelta*100, it.Price))
			}
			sb.WriteString("\n")
		}
	}
	return sb.String()
}

func formatPriceRankingEN(data *PriceRanking) string {
	var sb strings.Builder
	sb.WriteString("## Price Gainers/Losers\n\n")
	for _, d := range []string{"1h", "4h", "24h"} {
		dur, ok := data.Durations[d]
		if !ok || dur == nil {
			continue
		}
		sb.WriteString(fmt.Sprintf("### %s Price Change\n\n", d))
		if len(dur.Top) > 0 {
			sb.WriteString("**Top Gainers**\n| Symbol | Change | Price |\n|--------|--------|-------|\n")
			for _, it := range dur.Top {
				sb.WriteString(fmt.Sprintf("| %s | %+.2f%% | $%.4f |\n", it.Symbol, it.PriceDelta*100, it.Price))
			}
			sb.WriteString("\n")
		}
		if len(dur.Low) > 0 {
			sb.WriteString("**Top Losers**\n| Symbol | Change | Price |\n|--------|--------|-------|\n")
			for _, it := range dur.Low {
				sb.WriteString(fmt.Sprintf("| %s | %.2f%% | $%.4f |\n", it.Symbol, it.PriceDelta*100, it.Price))
			}
			sb.WriteString("\n")
		}
	}
	return sb.String()
}
