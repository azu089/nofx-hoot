// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package coinglass

// client.go — Coinglass Open API v3 HTTP client.
//
// Fetches funding rates, open interest, long/short ratios, liquidations,
// and taker buy/sell volume from the Coinglass data API.
// Converts raw API responses into CoinglassData for the signal engine.

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"nofx/logger"
	"strings"
	"sync"
	"time"
)

const (
	cgBaseURL    = "https://open-api-v3.coinglass.com"
	cgTimeout    = 8 * time.Second
	cgMaxRetries = 1

	// When funding rate history is unavailable, estimate 7d average as
	// current_rate * this factor. Conservative: assumes rate has been
	// slightly lower on average.
	fundingAvgEstimateFactor = 0.85
)

// TopSymbols lists the futures symbols tracked for per-symbol data.
var TopSymbols = []string{"BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"}

// ─── API Response Types ────────────────────────────────────────────────────

type cgResponse struct {
	Code string          `json:"code"`
	Msg  string          `json:"msg"`
	Data json.RawMessage `json:"data"`
}

func (r *cgResponse) ok() bool { return r.Code == "0" || r.Code == "200" }

// CoinMarketItem represents one symbol from the coin markets endpoint.
type CoinMarketItem struct {
	Symbol               string  `json:"symbol"`
	Price                float64 `json:"price"`
	OpenInterest         float64 `json:"openInterest"`
	OIChangePercent24h   float64 `json:"oiChangePercent24h"`
	AvgFundingRateByOI   float64 `json:"avgFundingRateByOI"`
	AvgFundingRateByVol  float64 `json:"avgFundingRateByVol"`
	PriceChangePercent24 float64 `json:"priceChangePercent24"`
	VolUSD               float64 `json:"volUsd"`
	LongVolUSD1h         float64 `json:"longVolUsd"`
	ShortVolUSD1h        float64 `json:"shortVolUsd"`
	LongLiquidation24h   float64 `json:"longLiqUsd"`
	ShortLiquidation24h  float64 `json:"shortLiqUsd"`
}

// LSRHistoryItem is one long/short ratio history entry.
type LSRHistoryItem struct {
	Time           int64   `json:"time"`
	LongAccount    float64 `json:"longAccount"`
	ShortAccount   float64 `json:"shortAccount"`
	LongShortRatio float64 `json:"longShortRatio"`
}

// ─── Client ────────────────────────────────────────────────────────────────

// Client fetches market data from Coinglass Open API v3.
type Client struct {
	apiKey string
	http   *http.Client
}

// NewClient creates a Coinglass API client.
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		http:   &http.Client{Timeout: cgTimeout},
	}
}

// FetchAll retrieves all Coinglass data and returns CoinglassData + price changes per symbol.
// Non-critical failures (LSR, taker volume) degrade gracefully.
func (c *Client) FetchAll() (map[string]CoinglassData, map[string]float64, error) {
	// Step 1: Coin markets overview (critical)
	overview, err := c.fetchCoinMarkets()
	if err != nil {
		return nil, nil, fmt.Errorf("coin markets: %w", err)
	}

	// Index by normalized symbol
	idx := make(map[string]*CoinMarketItem, len(overview))
	for i := range overview {
		sym := NormalizeSymbol(overview[i].Symbol)
		idx[sym] = &overview[i]
	}

	// Step 2: LSR for top symbols (non-critical, parallel)
	lsrMap := c.fetchLSRParallel()

	// Step 3: Build CoinglassData per symbol
	result := make(map[string]CoinglassData)
	priceChanges := make(map[string]float64)

	for _, base := range TopSymbols {
		sym := base + "USDT"
		item := idx[sym]
		if item == nil {
			item = idx[base]
		}
		if item == nil {
			continue
		}

		result[sym] = buildDataFromMarketItem(item, lsrMap[base])
		priceChanges[sym] = item.PriceChangePercent24 / 100.0
	}

	logger.Infof("[COINGLASS] Fetched %d overview items, built %d signal sets", len(overview), len(result))
	return result, priceChanges, nil
}

// ─── Endpoint Calls ────────────────────────────────────────────────────────

func (c *Client) fetchCoinMarkets() ([]CoinMarketItem, error) {
	body, err := c.doGet("/api/futures/coins-markets", nil)
	if err != nil {
		return nil, err
	}
	var items []CoinMarketItem
	if err := json.Unmarshal(body, &items); err != nil {
		return nil, fmt.Errorf("parse coin markets: %w", err)
	}
	return items, nil
}

func (c *Client) fetchLSR(symbol string) (float64, error) {
	params := map[string]string{
		"symbol":   symbol,
		"exchange": "Binance",
		"interval": "1h",
		"limit":    "1",
	}
	body, err := c.doGet("/api/futures/globalLongShortAccountRatio/history", params)
	if err != nil {
		return 0, err
	}
	var items []LSRHistoryItem
	if err := json.Unmarshal(body, &items); err != nil {
		return 0, fmt.Errorf("parse LSR: %w", err)
	}
	if len(items) == 0 {
		return 0.5, nil
	}
	lr := items[0].LongAccount
	if lr > 1 {
		lr /= 100.0
	}
	return lr, nil
}

func (c *Client) fetchLSRParallel() map[string]float64 {
	result := make(map[string]float64)
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, sym := range TopSymbols {
		wg.Add(1)
		go func(s string) {
			defer wg.Done()
			lr, err := c.fetchLSR(s)
			if err != nil {
				logger.Warnf("[COINGLASS] LSR fetch degraded for %s: %v", s, err)
				return
			}
			mu.Lock()
			result[s] = lr
			mu.Unlock()
		}(sym)
	}
	wg.Wait()
	return result
}

// ─── HTTP Helper ───────────────────────────────────────────────────────────

func (c *Client) doGet(path string, params map[string]string) (json.RawMessage, error) {
	reqURL := cgBaseURL + path
	if len(params) > 0 {
		q := url.Values{}
		for k, v := range params {
			q.Set(k, v)
		}
		reqURL += "?" + q.Encode()
	}

	var lastErr error
	for attempt := 0; attempt <= cgMaxRetries; attempt++ {
		req, err := http.NewRequest("GET", reqURL, nil)
		if err != nil {
			return nil, fmt.Errorf("build request: %w", err)
		}
		req.Header.Set("CG-API-KEY", c.apiKey)
		req.Header.Set("Accept", "application/json")

		resp, err := c.http.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("HTTP error: %w", err)
			continue
		}
		bodyBytes, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("read body: %w", err)
			continue
		}

		if resp.StatusCode == 429 {
			retryAfter := resp.Header.Get("Retry-After")
			lastErr = fmt.Errorf("rate limited (429), Retry-After: %s", retryAfter)
			time.Sleep(2 * time.Second)
			continue
		}
		if resp.StatusCode != 200 {
			lastErr = fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(bodyBytes))
			continue
		}

		var cgResp cgResponse
		if err := json.Unmarshal(bodyBytes, &cgResp); err != nil {
			return nil, fmt.Errorf("parse response wrapper: %w", err)
		}
		if !cgResp.ok() {
			return nil, fmt.Errorf("API error code=%s msg=%s", cgResp.Code, cgResp.Msg)
		}
		return cgResp.Data, nil
	}
	return nil, lastErr
}

// ─── Data Conversion ───────────────────────────────────────────────────────

func buildDataFromMarketItem(item *CoinMarketItem, longRatio float64) CoinglassData {
	sym := NormalizeSymbol(item.Symbol)

	fundingRate := item.AvgFundingRateByOI
	if fundingRate == 0 {
		fundingRate = item.AvgFundingRateByVol
	}

	data := CoinglassData{
		OI: &RawOIData{
			Symbol:        sym,
			OIValue:       item.OpenInterest,
			OIChange24Pct: item.OIChangePercent24h,
			OIChangePct:   item.OIChangePercent24h / 24.0, // estimate 1h from 24h
		},
		Funding: &RawFundingData{
			Symbol:      sym,
			Rate:        fundingRate,
			AverageRate: fundingRate * fundingAvgEstimateFactor,
		},
		Liquidation: &RawLiquidationData{
			Symbol:  sym,
			Long24h: item.LongLiquidation24h,
			Short24h: item.ShortLiquidation24h,
			Long1h:  item.LongLiquidation24h / 24.0,
			Short1h: item.ShortLiquidation24h / 24.0,
		},
	}

	if longRatio > 0 {
		data.LongShort = &RawLongShortData{
			Symbol:    sym,
			LongRatio: longRatio,
		}
	}

	// Taker volume → exchange flow proxy.
	// Coinglass longVolUsd = taker buy volume (bullish), shortVolUsd = taker sell volume (bearish).
	// Mapping: sell volume → Inflow (selling pressure), buy volume → Outflow (accumulation).
	// NetFlow positive = net selling pressure.
	if item.LongVolUSD1h > 0 || item.ShortVolUSD1h > 0 {
		data.ExchangeFlow = &RawExchangeFlowData{
			Symbol:  sym,
			Inflow:  item.ShortVolUSD1h,
			Outflow: item.LongVolUSD1h,
			NetFlow: item.ShortVolUSD1h - item.LongVolUSD1h,
		}
	}

	return data
}

// NormalizeSymbol ensures the symbol ends with USDT.
func NormalizeSymbol(s string) string {
	s = strings.ToUpper(strings.TrimSpace(s))
	if strings.HasSuffix(s, "USDT") || strings.HasSuffix(s, "USD") {
		return s
	}
	if len(s) > 6 {
		return s
	}
	return s + "USDT"
}
