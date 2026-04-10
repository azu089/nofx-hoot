// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package trader

// arena_data_provider.go — implements arena.DataProvider for the ArenaRunner.
//
// ArenaDataProvider bridges the trader layer's market data facilities into the
// arena package without creating a circular dependency. All methods are nil-safe
// and return empty values rather than errors when optional data is unavailable.

import (
	"nofx/arena"
	"nofx/kernel"
	"nofx/logger"
	"nofx/market"
)

// Compile-time check: ArenaDataProvider must implement arena.DataProvider.
var _ arena.DataProvider = (*ArenaDataProvider)(nil)

// ArenaDataProvider implements arena.DataProvider using market.GetWithTimeframes
// for market data, and optional injected functions for signals/events.
type ArenaDataProvider struct {
	// timeframes used when fetching market data (mirrors strategy config)
	timeframes  []string
	primaryTF   string
	klineCount  int

	// optional injected functions — nil means return empty/default
	getSignals func() *kernel.MarketSignals
	getEvents  func() []kernel.EventSignal

	// name for logging
	traderName string
}

// NewArenaDataProvider creates a data provider that fetches live market data.
// timeframes, primaryTF, klineCount should come from the strategy config.
// If primaryTF is empty, defaults to "1h".
// If klineCount is 0, defaults to 30.
func NewArenaDataProvider(
	timeframes []string,
	primaryTF string,
	klineCount int,
	traderName string,
) *ArenaDataProvider {
	if len(timeframes) == 0 {
		timeframes = []string{"1h"}
	}
	if primaryTF == "" {
		primaryTF = timeframes[0]
	}
	if klineCount <= 0 {
		klineCount = 30
	}
	return &ArenaDataProvider{
		timeframes: timeframes,
		primaryTF:  primaryTF,
		klineCount: klineCount,
		traderName: traderName,
	}
}

// SetSignalsFunc injects a function that returns current market signals.
// Optional — if not set, GetMarketSignals returns an empty MarketSignals.
func (p *ArenaDataProvider) SetSignalsFunc(fn func() *kernel.MarketSignals) {
	p.getSignals = fn
}

// SetEventsFunc injects a function that returns active event signals.
// Optional — if not set, GetActiveEvents returns nil (empty slice).
func (p *ArenaDataProvider) SetEventsFunc(fn func() []kernel.EventSignal) {
	p.getEvents = fn
}

// GetMarketData fetches live multi-timeframe market data for the given symbol.
// Implements arena.DataProvider.
func (p *ArenaDataProvider) GetMarketData(symbol string) (*market.Data, error) {
	data, err := market.GetWithTimeframes(symbol, p.timeframes, p.primaryTF, p.klineCount)
	if err != nil {
		logger.Warnf("⚠️ [ArenaDataProvider][%s] GetMarketData(%s) failed: %v", p.traderName, symbol, err)
		return nil, err
	}
	return data, nil
}

// GetMarketSignals returns current market signals.
// Returns an empty (non-nil) MarketSignals if no function is injected, so callers
// can use it without nil checks.
// Implements arena.DataProvider.
func (p *ArenaDataProvider) GetMarketSignals() (*kernel.MarketSignals, error) {
	if p.getSignals != nil {
		sig := p.getSignals()
		if sig != nil {
			return sig, nil
		}
	}
	return kernel.NewMarketSignals(), nil
}

// GetActiveEvents returns currently active event signals.
// Returns nil (empty) if no function is injected — callers should treat nil as
// "no active events" rather than an error.
// Implements arena.DataProvider.
func (p *ArenaDataProvider) GetActiveEvents() ([]kernel.EventSignal, error) {
	if p.getEvents != nil {
		return p.getEvents(), nil
	}
	return nil, nil
}
