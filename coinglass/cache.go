// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package coinglass

// cache.go — TTL-based in-memory cache for Coinglass data.
//
// Three-tier fallback strategy:
//   1. Fresh cache (age ≤ TTL) — return immediately
//   2. Stale cache (TTL < age ≤ maxStale) — used when live fetch fails
//   3. Mock data — static neutral signals, never crashes the pipeline
//
// Thread-safe for concurrent access from multiple trader goroutines.

import (
	"nofx/logger"
	"os"
	"sync"
	"time"
)

const (
	defaultCacheTTL      = 5 * time.Minute
	defaultMaxStaleAge   = 30 * time.Minute
	defaultFetchCooldown = 30 * time.Second
)

// Cache wraps Client with caching and fallback.
type Cache struct {
	client *Client

	mu           sync.RWMutex
	cachedData   map[string]CoinglassData
	cachedPrices map[string]float64
	cachedAt     time.Time
	lastFetchAt  time.Time

	ttl      time.Duration
	maxStale time.Duration
	cooldown time.Duration
}

// NewCache creates a cache around the given client.
func NewCache(client *Client) *Cache {
	return &Cache{
		client:   client,
		ttl:      defaultCacheTTL,
		maxStale: defaultMaxStaleAge,
		cooldown: defaultFetchCooldown,
	}
}

// GetSignalData returns CoinglassData for all tracked symbols.
// Returns: data, priceChanges, source ("LIVE"|"CACHE"|"STALE"|"MOCK").
func (cc *Cache) GetSignalData() (map[string]CoinglassData, map[string]float64, string) {
	if os.Getenv("COINGLASS_DISABLED") == "1" {
		return MockData(), nil, "MOCK"
	}

	now := time.Now()

	// Fast path: fresh cache
	cc.mu.RLock()
	if cc.cachedData != nil && now.Sub(cc.cachedAt) <= cc.ttl {
		data, prices := cc.cachedData, cc.cachedPrices
		cc.mu.RUnlock()
		return data, prices, "CACHE"
	}
	cc.mu.RUnlock()

	// Cooldown: set lastFetchAt before fetch to prevent concurrent goroutines
	// from all attempting live fetches. If fetch fails, cooldown still applies
	// (intentional: reduces API pressure during outages).
	cc.mu.Lock()
	if now.Sub(cc.lastFetchAt) < cc.cooldown && cc.cachedData != nil {
		data, prices := cc.cachedData, cc.cachedPrices
		cc.mu.Unlock()
		return data, prices, "CACHE"
	}
	cc.lastFetchAt = now
	cc.mu.Unlock()

	// Live fetch
	data, prices, err := cc.client.FetchAll()
	if err != nil {
		logger.Warnf("[COINGLASS_CACHE] Live fetch failed: %v", err)

		// Stale fallback
		cc.mu.RLock()
		if cc.cachedData != nil && now.Sub(cc.cachedAt) <= cc.maxStale {
			data, prices := cc.cachedData, cc.cachedPrices
			cc.mu.RUnlock()
			logger.Infof("[COINGLASS_CACHE] Using stale cache (age: %s)", now.Sub(cc.cachedAt).Round(time.Second))
			return data, prices, "STALE"
		}
		cc.mu.RUnlock()

		// Mock fallback
		logger.Warnf("[COINGLASS_CACHE] No cache available, using mock data")
		return MockData(), nil, "MOCK"
	}

	// Update cache
	cc.mu.Lock()
	cc.cachedData = data
	cc.cachedPrices = prices
	cc.cachedAt = now
	cc.mu.Unlock()

	return data, prices, "LIVE"
}

// MockData returns neutral signals for all top symbols.
func MockData() map[string]CoinglassData {
	result := make(map[string]CoinglassData, len(TopSymbols))
	for _, base := range TopSymbols {
		sym := base + "USDT"
		result[sym] = CoinglassData{
			OI:       &RawOIData{Symbol: sym, OIChangePct: 0},
			Funding:  &RawFundingData{Symbol: sym, Rate: 0.0001},
			Liquidation: &RawLiquidationData{Symbol: sym},
			LongShort:   &RawLongShortData{Symbol: sym, LongRatio: 0.50},
		}
	}
	return result
}
