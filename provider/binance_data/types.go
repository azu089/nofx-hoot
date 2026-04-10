// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

// Package binance_data provides direct Binance Futures public market data,
// replacing the deprecated nofxos.ai gateway. All endpoints used here are
// public (no authentication required) and rate-limit safe for typical
// strategy polling cadences.
package binance_data

import (
	"fmt"
	"strings"
	"time"
)

// Language for output formatting (kept compatible with prior nofxos.Language).
type Language string

const (
	LangChinese Language = "zh-CN"
	LangEnglish Language = "en-US"
)

// ============================================================================
// Open Interest ranking types
// ============================================================================

// OIPosition represents open interest data for a single coin.
type OIPosition struct {
	Symbol            string  `json:"symbol"`
	Rank              int     `json:"rank"`
	Price             float64 `json:"price"`
	CurrentOI         float64 `json:"current_oi"`
	OIDelta           float64 `json:"oi_delta"`
	OIDeltaPercent    float64 `json:"oi_delta_percent"`    // already x100 (5.0 == 5%)
	OIDeltaValue      float64 `json:"oi_delta_value"`      // USDT notional change
	PriceDeltaPercent float64 `json:"price_delta_percent"` // already x100
	PriceDeltaValid   bool    `json:"price_delta_valid"`   // false when kline fetch failed
	NetLong           float64 `json:"net_long"`
	NetShort          float64 `json:"net_short"`
}

// OIRanking holds top/low OI rankings for a single duration window.
type OIRanking struct {
	TimeRange    string       `json:"time_range"`
	Duration     string       `json:"duration"`
	TopPositions []OIPosition `json:"top_positions"`
	LowPositions []OIPosition `json:"low_positions"`
	FetchedAt    time.Time    `json:"fetched_at"`
}

// OIRankingData is an alias kept for drop-in compatibility with the previous
// nofxos.OIRankingData type used across kernel/.
type OIRankingData = OIRanking

// ============================================================================
// Price ranking types
// ============================================================================

// PriceRankingItem represents a single coin entry in the price gainers/losers
// ranking.
type PriceRankingItem struct {
	Pair         string  `json:"pair"`
	Symbol       string  `json:"symbol"`
	PriceDelta   float64 `json:"price_delta"` // decimal (0.0723 == 7.23%)
	Price        float64 `json:"price"`
	FutureFlow   float64 `json:"future_flow"`
	SpotFlow     float64 `json:"spot_flow"`
	OI           float64 `json:"oi"`
	OIDelta      float64 `json:"oi_delta"`
	OIDeltaValue float64 `json:"oi_delta_value"`
}

// PriceRankingDuration holds top gainers and losers for a single duration.
type PriceRankingDuration struct {
	Top []PriceRankingItem `json:"top"`
	Low []PriceRankingItem `json:"low"`
}

// PriceRanking is the multi-duration price ranking payload.
type PriceRanking struct {
	Durations map[string]*PriceRankingDuration `json:"durations"`
	FetchedAt time.Time                        `json:"fetched_at"`
}

// PriceRankingData is the legacy alias, kept for drop-in compatibility.
type PriceRankingData = PriceRanking

// ============================================================================
// Funding rate / Long-Short ratio types (used by data enrichment)
// ============================================================================

// FundingRate is the latest perpetual funding rate for a symbol.
type FundingRate struct {
	Symbol      string  `json:"symbol"`
	Rate        float64 `json:"rate"`        // last funding rate (decimal)
	MarkPrice   float64 `json:"mark_price"`  // current mark price
	NextFunding int64   `json:"next_funding"` // unix ms
}

// LongShortRatio captures long/short account ratio for a symbol/period.
type LongShortRatio struct {
	Symbol     string  `json:"symbol"`
	LongRatio  float64 `json:"long_ratio"`
	ShortRatio float64 `json:"short_ratio"`
	Ratio      float64 `json:"ratio"` // long/short
	Timestamp  int64   `json:"timestamp"`
}

// ============================================================================
// Helpers
// ============================================================================

// NormalizeSymbol normalizes a symbol to the BASE+USDT canonical form used
// across the kernel layer (e.g. "btc" -> "BTCUSDT").
func NormalizeSymbol(symbol string) string {
	s := strings.ToUpper(strings.TrimSpace(symbol))
	if s == "" {
		return s
	}
	if strings.HasSuffix(s, "USDT") {
		return s
	}
	return s + "USDT"
}

// formatValue renders a numeric value with sign and K/M/B suffix.
func formatValue(v float64) string {
	sign := "+"
	if v < 0 {
		sign = ""
	}
	abs := v
	if abs < 0 {
		abs = -abs
	}
	switch {
	case abs >= 1e9:
		return fmt.Sprintf("%s%.2fB", sign, v/1e9)
	case abs >= 1e6:
		return fmt.Sprintf("%s%.2fM", sign, v/1e6)
	case abs >= 1e3:
		return fmt.Sprintf("%s%.2fK", sign, v/1e3)
	default:
		return fmt.Sprintf("%s%.2f", sign, v)
	}
}
