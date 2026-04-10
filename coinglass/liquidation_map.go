// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package coinglass

// liquidation_map.go — Liquidation heatmap engine.
//
// Builds a spatial model of where liquidations are concentrated relative
// to the current price, identifying squeeze risk zones.

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

// ─── Types ──────────────────────────────────────────────────────────────────

// LiqHeatmapBucket represents one price level in the heatmap.
type LiqHeatmapBucket struct {
	PriceLow   float64 // lower bound of the bucket
	PriceHigh  float64 // upper bound
	PriceMid   float64 // midpoint
	LongLiqUSD float64 // estimated long liquidations in this zone
	ShortLiqUSD float64 // estimated short liquidations in this zone
	TotalUSD   float64 // total liquidations
	Density    float64 // 0-1 normalized density (relative to max bucket)
	Side       string  // "long" | "short" | "mixed" — dominant side
}

// LiqCluster represents a contiguous zone of high liquidation density.
type LiqCluster struct {
	PriceLow    float64
	PriceHigh   float64
	TotalUSD    float64
	AvgDensity  float64
	BucketCount int
	Side        string // "long_wall" | "short_wall"
}

// SqueezeIntelligence holds squeeze probability scores.
type SqueezeIntelligence struct {
	ShortSqueezeProbability float64 // 0-100: probability of shorts being squeezed
	LongSqueezeProbability  float64 // 0-100: probability of longs being squeezed
	NearestShortWall       float64 // price of nearest short liquidation wall
	NearestLongWall        float64 // price of nearest long liquidation wall
	DistanceToShortWall    float64 // % distance to nearest short wall
	DistanceToLongWall     float64 // % distance to nearest long wall
}

// LiquidationMap is the complete heatmap output for one symbol.
type LiquidationMap struct {
	Symbol    string
	Heatmap   []LiqHeatmapBucket
	Clusters  []LiqCluster
	Squeeze   SqueezeIntelligence
	Summary   string
}

// LiqMapParams configures the heatmap construction.
type LiqMapParams struct {
	ATRMultiplier float64 // range = ±ATR * multiplier (default 3.0)
	BucketCount   int     // number of price levels (default 20)
	ClusterMinDensity float64 // minimum density to form a cluster (default 0.40)
}

// DefaultLiqMapParams returns default parameters.
func DefaultLiqMapParams() LiqMapParams {
	return LiqMapParams{
		ATRMultiplier:     3.0,
		BucketCount:       20,
		ClusterMinDensity: 0.40,
	}
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

// BuildLiquidationMap constructs a heatmap from raw liquidation data.
func BuildLiquidationMap(symbol string, raw RawLiquidationData, currentPrice, atr float64, params LiqMapParams) LiquidationMap {
	lm := LiquidationMap{Symbol: symbol}

	if currentPrice <= 0 || atr <= 0 {
		lm.Summary = "insufficient data (price or ATR missing)"
		return lm
	}

	if params.ATRMultiplier <= 0 {
		params.ATRMultiplier = 3.0
	}
	if params.BucketCount <= 0 {
		params.BucketCount = 20
	}
	if params.ClusterMinDensity <= 0 {
		params.ClusterMinDensity = 0.40
	}

	// Build price grid: ±ATR*multiplier
	rangeSize := atr * params.ATRMultiplier
	priceLow := currentPrice - rangeSize
	priceHigh := currentPrice + rangeSize
	bucketSize := (priceHigh - priceLow) / float64(params.BucketCount)

	// Initialize buckets
	heatmap := make([]LiqHeatmapBucket, params.BucketCount)
	for i := range heatmap {
		low := priceLow + float64(i)*bucketSize
		high := low + bucketSize
		heatmap[i] = LiqHeatmapBucket{
			PriceLow:  low,
			PriceHigh: high,
			PriceMid:  (low + high) / 2,
		}
	}

	// Distribute liquidations using triangular model
	// Longs get liquidated below current price, shorts above
	distributeLiq(heatmap, currentPrice, raw.Long24h, "long", rangeSize)
	distributeLiq(heatmap, currentPrice, raw.Short24h, "short", rangeSize)

	// Calculate totals and classify sides
	for i := range heatmap {
		heatmap[i].TotalUSD = heatmap[i].LongLiqUSD + heatmap[i].ShortLiqUSD
		if heatmap[i].LongLiqUSD > heatmap[i].ShortLiqUSD*1.5 {
			heatmap[i].Side = "long"
		} else if heatmap[i].ShortLiqUSD > heatmap[i].LongLiqUSD*1.5 {
			heatmap[i].Side = "short"
		} else {
			heatmap[i].Side = "mixed"
		}
	}

	// Normalize density
	normalizeDensity(heatmap)

	lm.Heatmap = heatmap

	// Identify clusters
	lm.Clusters = identifyClusters(heatmap, params.ClusterMinDensity)

	// Compute squeeze intelligence
	lm.Squeeze = computeSqueezeIntelligence(heatmap, lm.Clusters, currentPrice)

	// Build summary
	lm.Summary = buildLiqSummary(lm)

	return lm
}

// BuildMultiSymbolLiqMaps processes multiple symbols.
func BuildMultiSymbolLiqMaps(rawMap map[string]RawLiquidationData, priceBySymbol map[string]float64, atrBySymbol map[string]float64) map[string]LiquidationMap {
	result := make(map[string]LiquidationMap, len(rawMap))
	params := DefaultLiqMapParams()
	for sym, raw := range rawMap {
		price := priceBySymbol[sym]
		atr := atrBySymbol[sym]
		result[sym] = BuildLiquidationMap(sym, raw, price, atr, params)
	}
	return result
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// distributeLiq distributes liquidation USD across buckets using a triangular model.
// For "long": liquidations concentrate below currentPrice (longs get stopped out below).
// For "short": liquidations concentrate above currentPrice.
func distributeLiq(heatmap []LiqHeatmapBucket, currentPrice, totalUSD float64, side string, rangeSize float64) {
	if totalUSD <= 0 || rangeSize <= 0 {
		return
	}

	// Calculate weights: triangular distribution peaking near current price
	weights := make([]float64, len(heatmap))
	var totalWeight float64

	for i, b := range heatmap {
		dist := math.Abs(b.PriceMid - currentPrice) / rangeSize
		if dist > 1.0 {
			continue
		}

		var w float64
		if side == "long" && b.PriceMid < currentPrice {
			// Long liquidations: triangle peaking just below current price
			w = math.Max(0, 1.0-dist*0.8) // gentle decay
		} else if side == "short" && b.PriceMid > currentPrice {
			// Short liquidations: triangle peaking just above current price
			w = math.Max(0, 1.0-dist*0.8)
		} else {
			// Small spillover to the other side
			w = math.Max(0, 0.2-dist*0.3)
		}

		weights[i] = w
		totalWeight += w
	}

	if totalWeight <= 0 {
		return
	}

	// Distribute proportionally
	for i := range heatmap {
		share := totalUSD * (weights[i] / totalWeight)
		if side == "long" {
			heatmap[i].LongLiqUSD += share
		} else {
			heatmap[i].ShortLiqUSD += share
		}
	}
}

func normalizeDensity(heatmap []LiqHeatmapBucket) {
	maxTotal := 0.0
	for _, b := range heatmap {
		if b.TotalUSD > maxTotal {
			maxTotal = b.TotalUSD
		}
	}
	if maxTotal <= 0 {
		return
	}
	for i := range heatmap {
		heatmap[i].Density = heatmap[i].TotalUSD / maxTotal
	}
}

func identifyClusters(heatmap []LiqHeatmapBucket, minDensity float64) []LiqCluster {
	var clusters []LiqCluster

	i := 0
	for i < len(heatmap) {
		if heatmap[i].Density < minDensity {
			i++
			continue
		}

		// Start a cluster
		cluster := LiqCluster{
			PriceLow:  heatmap[i].PriceLow,
			PriceHigh: heatmap[i].PriceHigh,
		}
		var densitySum float64
		j := i
		for j < len(heatmap) && heatmap[j].Density >= minDensity {
			cluster.PriceHigh = heatmap[j].PriceHigh
			cluster.TotalUSD += heatmap[j].TotalUSD
			densitySum += heatmap[j].Density
			cluster.BucketCount++
			j++
		}
		cluster.AvgDensity = densitySum / float64(cluster.BucketCount)

		// Classify as long_wall or short_wall based on dominant side
		var longTotal, shortTotal float64
		for k := i; k < j; k++ {
			longTotal += heatmap[k].LongLiqUSD
			shortTotal += heatmap[k].ShortLiqUSD
		}
		if longTotal > shortTotal {
			cluster.Side = "long_wall"
		} else {
			cluster.Side = "short_wall"
		}

		clusters = append(clusters, cluster)
		i = j
	}

	// Sort by total USD descending
	sort.Slice(clusters, func(i, j int) bool {
		return clusters[i].TotalUSD > clusters[j].TotalUSD
	})

	return clusters
}

func computeSqueezeIntelligence(heatmap []LiqHeatmapBucket, clusters []LiqCluster, currentPrice float64) SqueezeIntelligence {
	si := SqueezeIntelligence{}

	// Find nearest walls
	for _, c := range clusters {
		mid := (c.PriceLow + c.PriceHigh) / 2
		distPct := math.Abs(mid-currentPrice) / currentPrice * 100

		if c.Side == "short_wall" && mid > currentPrice {
			if si.NearestShortWall == 0 || distPct < si.DistanceToShortWall {
				si.NearestShortWall = mid
				si.DistanceToShortWall = distPct
			}
		}
		if c.Side == "long_wall" && mid < currentPrice {
			if si.NearestLongWall == 0 || distPct < si.DistanceToLongWall {
				si.NearestLongWall = mid
				si.DistanceToLongWall = distPct
			}
		}
	}

	// Squeeze probability: inverse of distance (closer wall = higher probability)
	// Max probability at 0.5% distance, min at 5%+ distance
	if si.DistanceToShortWall > 0 {
		si.ShortSqueezeProbability = math.Max(0, math.Min(100, (5.0-si.DistanceToShortWall)*22))
	}
	if si.DistanceToLongWall > 0 {
		si.LongSqueezeProbability = math.Max(0, math.Min(100, (5.0-si.DistanceToLongWall)*22))
	}

	return si
}

func buildLiqSummary(lm LiquidationMap) string {
	var parts []string

	if lm.Squeeze.ShortSqueezeProbability > 50 {
		parts = append(parts, fmt.Sprintf("SHORT_SQUEEZE_RISK=%.0f%% (wall at %.2f, %.1f%% away)",
			lm.Squeeze.ShortSqueezeProbability, lm.Squeeze.NearestShortWall, lm.Squeeze.DistanceToShortWall))
	}
	if lm.Squeeze.LongSqueezeProbability > 50 {
		parts = append(parts, fmt.Sprintf("LONG_SQUEEZE_RISK=%.0f%% (wall at %.2f, %.1f%% away)",
			lm.Squeeze.LongSqueezeProbability, lm.Squeeze.NearestLongWall, lm.Squeeze.DistanceToLongWall))
	}

	if len(lm.Clusters) > 0 {
		parts = append(parts, fmt.Sprintf("%d liquidation clusters detected", len(lm.Clusters)))
	}

	if len(parts) == 0 {
		return "no significant liquidation clusters"
	}
	return strings.Join(parts, "; ")
}
