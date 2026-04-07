package execution

// simulator.go — Trade execution simulator with slippage, fee, and latency models.
//
// All functions are pure (stateless, deterministic, concurrency-safe).

import "math"

// ─── SimConfig ──────────────────────────────────────────────────────────────

// SimConfig configures the simulation model.
type SimConfig struct {
	// Slippage model: "fixed" | "proportional" | "impact"
	SlippageModel string

	// Fixed slippage in basis points (1 bps = 0.01%)
	BaseSlippagePct float64 // default: 0.05% (5 bps)
	MaxSlippagePct  float64 // cap: default 0.5%

	// Fee rates
	FeeRateTaker float64 // market order fee (default: 0.0004 = 4 bps)
	FeeRateMaker float64 // limit order fee (default: 0.0002 = 2 bps)

	// Order size limits
	MaxOrderNotionalUSD float64 // max single order (default: $500,000)
	MinOrderNotionalUSD float64 // min notional (default: $10)

	// Liquidity depth for impact model (USD)
	LiquidityDepthUSD float64 // default: $5M

	// Latency estimation
	BaseLatencyMs int64 // default: 50ms
	JitterMs      int64 // default: 20ms
}

// DefaultSimConfig returns a balanced simulation configuration.
func DefaultSimConfig() SimConfig {
	return SimConfig{
		SlippageModel:       "proportional",
		BaseSlippagePct:     0.05,
		MaxSlippagePct:      0.50,
		FeeRateTaker:        0.0004,
		FeeRateMaker:        0.0002,
		MaxOrderNotionalUSD: 500_000,
		MinOrderNotionalUSD: 10,
		LiquidityDepthUSD:   5_000_000,
		BaseLatencyMs:       50,
		JitterMs:            20,
	}
}

// AggressiveSimConfig uses optimistic assumptions (low slippage, high liquidity).
func AggressiveSimConfig() SimConfig {
	return SimConfig{
		SlippageModel:       "fixed",
		BaseSlippagePct:     0.02,
		MaxSlippagePct:      0.20,
		FeeRateTaker:        0.0004,
		FeeRateMaker:        0.0002,
		MaxOrderNotionalUSD: 1_000_000,
		MinOrderNotionalUSD: 5,
		LiquidityDepthUSD:   10_000_000,
		BaseLatencyMs:       30,
		JitterMs:            10,
	}
}

// ConservativeSimConfig uses pessimistic assumptions (higher slippage, lower liquidity).
func ConservativeSimConfig() SimConfig {
	return SimConfig{
		SlippageModel:       "impact",
		BaseSlippagePct:     0.10,
		MaxSlippagePct:      1.00,
		FeeRateTaker:        0.0005,
		FeeRateMaker:        0.0003,
		MaxOrderNotionalUSD: 200_000,
		MinOrderNotionalUSD: 20,
		LiquidityDepthUSD:   2_000_000,
		BaseLatencyMs:       80,
		JitterMs:            40,
	}
}

// ─── SimulationResult ───────────────────────────────────────────────────────

// SimulationResult holds the outcome of a simulated execution.
type SimulationResult struct {
	Symbol         string
	FilledPrice    float64
	FilledQuantity float64
	Slippage       float64 // price units
	SlippagePct    float64 // percentage
	FeeUSD         float64
	FeeRate        float64
	EstLatencyMs   int64
	Feasible       bool
	RejectReason   string
	ImpactPct      float64 // market impact percentage
	EffectiveCost  float64 // total cost as percentage (slippage + fees)
}

// ─── SimulateExecution ──────────────────────────────────────────────────────

// SimulateExecution runs a single order through the simulation model.
func SimulateExecution(req ExecutionRequest, cfg SimConfig) SimulationResult {
	result := SimulationResult{
		Symbol:         req.Symbol,
		FilledQuantity: req.Quantity,
	}

	price := req.Price
	if price <= 0 {
		result.Feasible = false
		result.RejectReason = "price must be > 0"
		return result
	}

	notional := req.NotionalUSD
	if notional <= 0 && req.Quantity > 0 {
		notional = req.Quantity * price
	}

	// Liquidity check
	if cfg.MaxOrderNotionalUSD > 0 && notional > cfg.MaxOrderNotionalUSD {
		result.Feasible = false
		result.RejectReason = "order exceeds max notional"
		return result
	}
	if cfg.MinOrderNotionalUSD > 0 && notional < cfg.MinOrderNotionalUSD {
		result.Feasible = false
		result.RejectReason = "order below min notional"
		return result
	}

	// Calculate slippage
	var slippagePct float64
	switch cfg.SlippageModel {
	case "fixed":
		slippagePct = cfg.BaseSlippagePct / 100.0
	case "proportional":
		// Slippage scales linearly with order size relative to liquidity
		if cfg.LiquidityDepthUSD > 0 {
			sizeRatio := notional / cfg.LiquidityDepthUSD
			slippagePct = (cfg.BaseSlippagePct / 100.0) * (1.0 + sizeRatio*10)
		} else {
			slippagePct = cfg.BaseSlippagePct / 100.0
		}
	case "impact":
		// Square-root market impact model
		if cfg.LiquidityDepthUSD > 0 {
			impactFactor := math.Sqrt(notional / cfg.LiquidityDepthUSD)
			slippagePct = impactFactor * (cfg.BaseSlippagePct / 100.0) * 5
		} else {
			slippagePct = cfg.BaseSlippagePct / 100.0
		}
	default:
		slippagePct = cfg.BaseSlippagePct / 100.0
	}

	// Cap slippage
	maxSlip := cfg.MaxSlippagePct / 100.0
	if maxSlip > 0 && slippagePct > maxSlip {
		slippagePct = maxSlip
	}

	// Apply slippage to fill price
	slippageAmt := price * slippagePct
	if req.Side == "BUY" {
		result.FilledPrice = price + slippageAmt // buy at higher price
	} else {
		result.FilledPrice = price - slippageAmt // sell at lower price
	}
	result.Slippage = slippageAmt
	result.SlippagePct = slippagePct * 100.0
	result.ImpactPct = slippagePct * 100.0

	// Fee calculation
	if req.OrderType == "limit" {
		result.FeeRate = cfg.FeeRateMaker
	} else {
		result.FeeRate = cfg.FeeRateTaker
	}
	result.FeeUSD = notional * result.FeeRate

	// Effective cost
	result.EffectiveCost = (slippagePct + result.FeeRate) * 100.0

	// Latency estimation (deterministic: use order size as seed)
	jitter := int64(math.Mod(notional, float64(cfg.JitterMs+1)))
	result.EstLatencyMs = cfg.BaseLatencyMs + jitter

	result.Feasible = true
	return result
}

// ─── Round-Trip Cost Estimation ─────────────────────────────────────────────

// RoundTripCost describes the total cost of entering and exiting a position.
type RoundTripCost struct {
	EntrySlippagePct float64 // entry slippage %
	ExitSlippagePct  float64 // exit slippage %
	EntryFeeUSD      float64
	ExitFeeUSD       float64
	TotalCostPct     float64 // total round-trip cost as % of notional
	TotalCostUSD     float64
	MinProfitPctToBreakEven float64 // minimum price move to break even
}

// EstimateRoundTripCost calculates the total cost of a round-trip trade.
func EstimateRoundTripCost(notionalUSD, price float64, leverage int, cfg SimConfig) RoundTripCost {
	rt := RoundTripCost{}

	// Entry simulation
	entryReq := ExecutionRequest{
		Side:        "BUY",
		OrderType:   "market",
		Price:       price,
		NotionalUSD: notionalUSD,
	}
	entryResult := SimulateExecution(entryReq, cfg)
	rt.EntrySlippagePct = entryResult.SlippagePct
	rt.EntryFeeUSD = entryResult.FeeUSD

	// Exit simulation
	exitReq := ExecutionRequest{
		Side:        "SELL",
		OrderType:   "market",
		Price:       price,
		NotionalUSD: notionalUSD,
	}
	exitResult := SimulateExecution(exitReq, cfg)
	rt.ExitSlippagePct = exitResult.SlippagePct
	rt.ExitFeeUSD = exitResult.FeeUSD

	// Total costs
	rt.TotalCostUSD = rt.EntryFeeUSD + rt.ExitFeeUSD + (entryResult.Slippage+exitResult.Slippage)*notionalUSD/price
	if notionalUSD > 0 {
		rt.TotalCostPct = (rt.TotalCostUSD / notionalUSD) * 100.0
	}

	// Break-even: minimum price move to cover costs (amplified by leverage)
	if leverage > 0 {
		rt.MinProfitPctToBreakEven = rt.TotalCostPct / float64(leverage)
	} else {
		rt.MinProfitPctToBreakEven = rt.TotalCostPct
	}

	return rt
}
