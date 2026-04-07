package binance_data

import (
	"fmt"
	"nofx/logger"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// openInterestHistEntry mirrors the Binance /futures/data/openInterestHist
// payload (only fields we use).
type openInterestHistEntry struct {
	Symbol               string `json:"symbol"`
	SumOpenInterest      string `json:"sumOpenInterest"`
	SumOpenInterestValue string `json:"sumOpenInterestValue"`
	Timestamp            int64  `json:"timestamp"`
}

// durationToBinancePeriod maps human duration codes to Binance period codes
// accepted by the openInterestHist endpoint.
func durationToBinancePeriod(duration string) (period string, points int) {
	switch strings.ToLower(strings.TrimSpace(duration)) {
	case "5m":
		return "5m", 2
	case "15m":
		return "15m", 2
	case "30m":
		return "30m", 2
	case "1h", "":
		return "1h", 2
	case "2h":
		return "2h", 2
	case "4h":
		return "4h", 2
	case "6h":
		return "6h", 2
	case "12h":
		return "12h", 2
	case "24h", "1d":
		return "1d", 2
	default:
		return "1h", 2
	}
}

// GetOIRanking computes a market-wide OI ranking by sampling the top-volume
// USDT-perp symbols and comparing the latest two openInterestHist samples for
// each. Top = highest positive OI delta %, Low = highest negative OI delta %.
//
// Note: Binance does not expose a single "ranking" endpoint, so we approximate
// by enumerating universe and computing locally. This is the best public
// substitute for the previous nofxos endpoint.
func (c *Client) GetOIRanking(duration string, limit int) (*OIRanking, error) {
	if limit <= 0 {
		limit = 10
	}
	period, _ := durationToBinancePeriod(duration)

	uniSize := 50
	if limit*3 > uniSize {
		uniSize = limit * 3
	}
	universe, err := c.getTopVolumeSymbols(uniSize)
	if err != nil {
		return nil, fmt.Errorf("oi ranking universe: %w", err)
	}

	// Pre-fetch per-symbol price delta aligned to the SAME window as OI, so
	// the "OI Change %" and "Price Change %" columns are comparable. Previously
	// PriceDeltaPercent was taken from the 24h ticker, which made the two
	// columns 24x off and produced misleading "bulls/bears" interpretations.
	interval, lookback := intervalFor(duration)
	priceDeltaMap := make(map[string]float64, len(universe))
	priceDeltaValidMap := make(map[string]bool, len(universe))
	{
		var pwg sync.WaitGroup
		psem := make(chan struct{}, 6)
		var pmu sync.Mutex
		for _, t := range universe {
			pwg.Add(1)
			psem <- struct{}{}
			go func(ticker tickerStat) {
				defer pwg.Done()
				defer func() { <-psem }()
				delta, _, err := c.fetchKlinesClose(ticker.Symbol, interval, lookback)
				if err != nil {
					return
				}
				pmu.Lock()
				priceDeltaMap[ticker.Symbol] = delta * 100.0 // to percent, matches PriceDeltaPercent scale
				priceDeltaValidMap[ticker.Symbol] = true
				pmu.Unlock()
			}(t)
		}
		pwg.Wait()
	}

	type sample struct {
		pos OIPosition
		err error
	}

	results := make([]sample, len(universe))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 6) // soft cap on parallelism

	for i, t := range universe {
		wg.Add(1)
		sem <- struct{}{}
		go func(i int, ticker tickerStat) {
			defer wg.Done()
			defer func() { <-sem }()
			pdPct := priceDeltaMap[ticker.Symbol] // 0 if missing
			pdOk := priceDeltaValidMap[ticker.Symbol]
			pos, err := c.fetchSymbolOIDelta(ticker, period, pdPct, pdOk)
			results[i] = sample{pos: pos, err: err}
		}(i, t)
	}
	wg.Wait()

	positions := make([]OIPosition, 0, len(results))
	for _, r := range results {
		if r.err != nil {
			continue
		}
		positions = append(positions, r.pos)
	}

	// Warn when kline-based price delta failed for some symbols (those rows
	// will render as "N/A" in the prompt instead of misleading "+0.00%").
	missing := 0
	for _, p := range positions {
		if !p.PriceDeltaValid {
			missing++
		}
	}
	if missing > 0 {
		logger.Warnf("OI ranking: %d/%d symbols missing price delta (kline fetch failed)", missing, len(positions))
	}

	// Top = sorted by OIDeltaPercent desc.
	sort.Slice(positions, func(i, j int) bool {
		return positions[i].OIDeltaPercent > positions[j].OIDeltaPercent
	})
	top := make([]OIPosition, 0, limit)
	for i := 0; i < len(positions) && len(top) < limit; i++ {
		if positions[i].OIDeltaPercent > 0 {
			p := positions[i]
			p.Rank = len(top) + 1
			top = append(top, p)
		}
	}

	// Low = sorted by OIDeltaPercent asc (most negative first).
	sort.Slice(positions, func(i, j int) bool {
		return positions[i].OIDeltaPercent < positions[j].OIDeltaPercent
	})
	low := make([]OIPosition, 0, limit)
	for i := 0; i < len(positions) && len(low) < limit; i++ {
		if positions[i].OIDeltaPercent < 0 {
			p := positions[i]
			p.Rank = len(low) + 1
			low = append(low, p)
		}
	}

	return &OIRanking{
		Duration:     period,
		TimeRange:    period,
		TopPositions: top,
		LowPositions: low,
		FetchedAt:    time.Now(),
	}, nil
}

// fetchSymbolOIDelta fetches the latest two openInterestHist points for a
// single symbol and computes a delta vs the prior point.
func (c *Client) fetchSymbolOIDelta(t tickerStat, period string, priceDeltaPct float64, priceDeltaValid bool) (OIPosition, error) {
	path := fmt.Sprintf("/futures/data/openInterestHist?symbol=%s&period=%s&limit=2", t.Symbol, period)
	var hist []openInterestHistEntry
	if err := c.doGet(path, &hist); err != nil {
		return OIPosition{}, err
	}
	if len(hist) < 2 {
		return OIPosition{}, fmt.Errorf("insufficient OI history for %s", t.Symbol)
	}

	prev, err := strconv.ParseFloat(hist[0].SumOpenInterest, 64)
	if err != nil || prev <= 0 {
		return OIPosition{}, fmt.Errorf("invalid prev OI for %s: %v", t.Symbol, err)
	}
	curr, err := strconv.ParseFloat(hist[1].SumOpenInterest, 64)
	if err != nil || curr < 0 {
		return OIPosition{}, fmt.Errorf("invalid curr OI for %s: %v", t.Symbol, err)
	}
	currVal, err := strconv.ParseFloat(hist[1].SumOpenInterestValue, 64)
	if err != nil {
		logger.Warnf("OI: invalid curr OI value for %s: %v", t.Symbol, err)
	}
	prevVal, err := strconv.ParseFloat(hist[0].SumOpenInterestValue, 64)
	if err != nil {
		logger.Warnf("OI: invalid prev OI value for %s: %v", t.Symbol, err)
	}

	delta := curr - prev
	deltaPct := 0.0
	if prev > 0 {
		deltaPct = (delta / prev) * 100.0
	}

	return OIPosition{
		Symbol:            t.Symbol,
		Price:             t.LastPrice,
		CurrentOI:         curr,
		OIDelta:           delta,
		OIDeltaPercent:    deltaPct,
		OIDeltaValue:      currVal - prevVal,
		PriceDeltaPercent: priceDeltaPct,
		PriceDeltaValid:   priceDeltaValid,
	}, nil
}

// GetOITopPositions returns the top OI gainers (legacy compat).
func (c *Client) GetOITopPositions() ([]OIPosition, error) {
	r, err := c.GetOIRanking("1h", 20)
	if err != nil {
		return nil, err
	}
	return r.TopPositions, nil
}

// GetOILowPositions returns the top OI losers (legacy compat).
func (c *Client) GetOILowPositions() ([]OIPosition, error) {
	r, err := c.GetOIRanking("1h", 20)
	if err != nil {
		return nil, err
	}
	return r.LowPositions, nil
}

// GetOITopSymbols returns the symbols of the top OI gainers.
func (c *Client) GetOITopSymbols() ([]string, error) {
	pos, err := c.GetOITopPositions()
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(pos))
	for _, p := range pos {
		out = append(out, NormalizeSymbol(p.Symbol))
	}
	return out, nil
}

// GetOILowSymbols returns the symbols of the top OI losers.
func (c *Client) GetOILowSymbols() ([]string, error) {
	pos, err := c.GetOILowPositions()
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(pos))
	for _, p := range pos {
		out = append(out, NormalizeSymbol(p.Symbol))
	}
	return out, nil
}

// FormatOIRankingForAI renders an OI ranking payload as Markdown for prompts.
func FormatOIRankingForAI(data *OIRanking, lang Language) string {
	if data == nil {
		return ""
	}
	if lang == LangChinese {
		return formatOIRankingZH(data)
	}
	return formatOIRankingEN(data)
}

func formatOIRankingZH(data *OIRanking) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## 持仓量变化排行 (%s)\n\n", data.Duration))
	if len(data.TopPositions) > 0 {
		sb.WriteString("### 持仓增加榜\n")
		sb.WriteString("| 排名 | 币种 | 持仓变化(USDT) | OI变化% | 价格变化% |\n")
		sb.WriteString("|------|------|----------------|---------|-----------|\n")
		for _, p := range data.TopPositions {
			priceStr := "N/A"
			if p.PriceDeltaValid {
				priceStr = fmt.Sprintf("%+.2f%%", p.PriceDeltaPercent)
			}
			sb.WriteString(fmt.Sprintf("| %d | %s | %s | %+.2f%% | %s |\n",
				p.Rank, p.Symbol, formatValue(p.OIDeltaValue), p.OIDeltaPercent, priceStr))
		}
		sb.WriteString("\n")
	}
	if len(data.LowPositions) > 0 {
		sb.WriteString("### 持仓减少榜\n")
		sb.WriteString("| 排名 | 币种 | 持仓变化(USDT) | OI变化% | 价格变化% |\n")
		sb.WriteString("|------|------|----------------|---------|-----------|\n")
		for _, p := range data.LowPositions {
			priceStr := "N/A"
			if p.PriceDeltaValid {
				priceStr = fmt.Sprintf("%+.2f%%", p.PriceDeltaPercent)
			}
			sb.WriteString(fmt.Sprintf("| %d | %s | %s | %+.2f%% | %s |\n",
				p.Rank, p.Symbol, formatValue(p.OIDeltaValue), p.OIDeltaPercent, priceStr))
		}
		sb.WriteString("\n")
	}
	sb.WriteString(fmt.Sprintf("（OI 与价格均为 %s 窗口）\n", data.Duration))
	sb.WriteString("**解读**: OI增+价涨=多头主导 | OI增+价跌=空头主导 | OI减+价涨=空头平仓 | OI减+价跌=多头平仓\n\n")
	return sb.String()
}

func formatOIRankingEN(data *OIRanking) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## Open Interest Changes (%s)\n\n", data.Duration))
	if len(data.TopPositions) > 0 {
		sb.WriteString("### OI Increase Ranking\n")
		sb.WriteString("| Rank | Symbol | OI Change (USDT) | OI Change % | Price Change % |\n")
		sb.WriteString("|------|--------|------------------|-------------|----------------|\n")
		for _, p := range data.TopPositions {
			priceStr := "N/A"
			if p.PriceDeltaValid {
				priceStr = fmt.Sprintf("%+.2f%%", p.PriceDeltaPercent)
			}
			sb.WriteString(fmt.Sprintf("| %d | %s | %s | %+.2f%% | %s |\n",
				p.Rank, p.Symbol, formatValue(p.OIDeltaValue), p.OIDeltaPercent, priceStr))
		}
		sb.WriteString("\n")
	}
	if len(data.LowPositions) > 0 {
		sb.WriteString("### OI Decrease Ranking\n")
		sb.WriteString("| Rank | Symbol | OI Change (USDT) | OI Change % | Price Change % |\n")
		sb.WriteString("|------|--------|------------------|-------------|----------------|\n")
		for _, p := range data.LowPositions {
			priceStr := "N/A"
			if p.PriceDeltaValid {
				priceStr = fmt.Sprintf("%+.2f%%", p.PriceDeltaPercent)
			}
			sb.WriteString(fmt.Sprintf("| %d | %s | %s | %+.2f%% | %s |\n",
				p.Rank, p.Symbol, formatValue(p.OIDeltaValue), p.OIDeltaPercent, priceStr))
		}
		sb.WriteString("\n")
	}
	sb.WriteString(fmt.Sprintf("(Both OI and price aligned to %s window)\n", data.Duration))
	sb.WriteString("**Key**: OI up + Price up = Bulls | OI up + Price down = Bears | OI down + Price up = Short cover | OI down + Price down = Long liquidation\n\n")
	return sb.String()
}
