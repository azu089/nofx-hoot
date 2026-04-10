// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package trader

// auto_trader_coinglass.go — Coinglass signal injection for the trading loop.
//
// Initializes a global coinglass.Cache (shared across all traders) and
// populates ctx.Signals with funding, OI, liquidation, LSR, and flow data.
// The coinglass signal engine converts raw API data to structured
// MarketSignals consumed by SignalFilter, CandidateScorer, and Gatekeeper.

import (
	"nofx/coinglass"
	"nofx/kernel"
	"nofx/logger"
	"os"
	"strings"
	"sync"
)

// ─── Global Singleton ──────────────────────────────────────────────────────

var (
	globalCGCache *coinglass.Cache
	cgCacheOnce   sync.Once
)

// initCGCache lazily creates the shared cache on first use.
func initCGCache() *coinglass.Cache {
	cgCacheOnce.Do(func() {
		apiKey := os.Getenv("COINGLASS_API_KEY")
		if apiKey == "" {
			logger.Warnf("[COINGLASS] COINGLASS_API_KEY not set, signals will use mock data")
		}
		client := coinglass.NewClient(apiKey)
		globalCGCache = coinglass.NewCache(client)
		logger.Infof("[COINGLASS] Cache initialized (key present: %v)", apiKey != "")
	})
	return globalCGCache
}

// ─── Injection ─────────────────────────────────────────────────────────────

// injectCoinglassSignals populates ctx.Signals with Coinglass-derived data.
//
// Pipeline:
//  1. Cache.GetSignalData() → raw CoinglassData per symbol
//  2. coinglass.BuildMultiSymbolMetrics() → CoinglassMetrics per symbol
//  3. coinglass.PopulateMarketSignals() → fills ctx.Signals maps
//
// All failures degrade gracefully (mock/stale data), never fatal.
func (at *AutoTrader) injectCoinglassSignals(ctx *kernel.Context) {
	cache := initCGCache()

	rawData, priceChanges, source := cache.GetSignalData()
	if len(rawData) == 0 {
		logger.Debugf("[%s] Coinglass: no data available", at.name)
		return
	}

	if ctx.Signals == nil {
		ctx.Signals = kernel.NewMarketSignals()
	}

	// Filter to relevant symbols for this trader
	relevant := at.collectRelevantCGSymbols()
	filtered := make(map[string]coinglass.CoinglassData)
	filteredPrices := make(map[string]float64)
	for sym, data := range rawData {
		if matchesCGSymbol(sym, relevant) {
			filtered[sym] = data
			filteredPrices[sym] = priceChanges[sym]
		}
	}

	// If no exact matches (arena/multi-symbol), use all
	if len(filtered) == 0 {
		filtered = rawData
		filteredPrices = priceChanges
	}

	// Build metrics + populate signals
	cfg := coinglass.DefaultThresholdsConfig()
	metrics := coinglass.BuildMultiSymbolMetrics(filtered, filteredPrices, cfg)
	coinglass.PopulateMarketSignals(ctx.Signals, metrics)

	// Log summary
	logCGSignalSummary(at.name, metrics, source)
}

// ─── Helpers ───────────────────────────────────────────────────────────────

func (at *AutoTrader) collectRelevantCGSymbols() []string {
	if at.config.StrategyConfig == nil {
		return nil
	}
	var syms []string
	if at.config.StrategyConfig.GridConfig != nil {
		syms = append(syms, at.config.StrategyConfig.GridConfig.Symbol)
	}
	if at.config.StrategyConfig.ArenaConfig != nil {
		syms = append(syms, at.config.StrategyConfig.ArenaConfig.Symbols...)
	}
	return syms
}

func matchesCGSymbol(sym string, relevant []string) bool {
	if len(relevant) == 0 {
		return true
	}
	symUp := strings.ToUpper(sym)
	for _, r := range relevant {
		rUp := strings.ToUpper(r)
		if symUp == rUp || strings.HasPrefix(symUp, rUp) || strings.HasPrefix(rUp, symUp) {
			return true
		}
	}
	return false
}

func logCGSignalSummary(traderName string, metrics map[string]coinglass.CoinglassMetrics, source string) {
	var fundingExtreme, longCrowded, shortCrowded, oiExpansion, oiContraction int
	for _, m := range metrics {
		if m.Funding.Extreme {
			fundingExtreme++
		}
		switch m.LSR.Crowded {
		case "long_crowded":
			longCrowded++
		case "short_crowded":
			shortCrowded++
		}
		switch m.OI.Direction {
		case "expansion":
			oiExpansion++
		case "contraction":
			oiContraction++
		}
	}

	logger.Infof("[COINGLASS_SIGNAL] [%s] source=%s symbols=%d funding_extreme=%d long_crowded=%d short_crowded=%d oi_expansion=%d oi_contraction=%d",
		traderName, source, len(metrics), fundingExtreme, longCrowded, shortCrowded, oiExpansion, oiContraction)
}
