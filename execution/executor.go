package execution

// executor.go — Execution layer abstraction.
//
// Provides a unified Executor interface with three modes:
//   ModeLive     — real exchange execution (not implemented here, lives in trader/)
//   ModeSimulate — simulated execution with slippage/fee model
//   ModeDryRun   — log-only, no execution

import (
	"fmt"
	"time"
)

// ─── ExecutionMode ──────────────────────────────────────────────────────────

type ExecutionMode string

const (
	ModeLive     ExecutionMode = "LIVE"
	ModeSimulate ExecutionMode = "SIMULATE"
	ModeDryRun   ExecutionMode = "DRYRUN"
)

// ─── ExecutionRequest ───────────────────────────────────────────────────────

// ExecutionRequest describes a trade to execute.
type ExecutionRequest struct {
	RequestID   string    // unique request ID for tracking
	Symbol      string    // trading pair (e.g. "BTCUSDT")
	Side        string    // "BUY" | "SELL"
	Action      string    // "open_long" | "open_short" | "close_long" | "close_short"
	OrderType   string    // "market" | "limit"
	Quantity    float64   // order quantity in base asset
	Price       float64   // limit price (0 for market orders)
	Leverage    int       // leverage multiplier
	NotionalUSD float64   // notional value in USD
	Reason      string    // why this trade is being placed
	Timestamp   time.Time // when the request was created
}

// ─── ExecutionReport ────────────────────────────────────────────────────────

// ExecutionReport describes the outcome of an execution.
type ExecutionReport struct {
	RequestID   string  // matches the request
	Success     bool    // whether execution succeeded
	FilledQty   float64 // actual filled quantity
	FilledPrice float64 // average fill price
	OrderID     string  // exchange order ID (empty for sim/dryrun)
	Fee         float64 // total fees in USD
	Slippage    float64 // slippage in price units
	SlippagePct float64 // slippage as percentage
	LatencyMs   int64   // execution latency
	Error       string  // error message if failed
	Mode        ExecutionMode
}

// ─── Executor Interface ─────────────────────────────────────────────────────

// Executor is the unified execution interface.
type Executor interface {
	Execute(req ExecutionRequest) ExecutionReport
	Mode() ExecutionMode
	IsAvailable() bool
}

// ─── SimExecutor ────────────────────────────────────────────────────────────

// SimExecutor runs executions through the simulator.
type SimExecutor struct {
	config SimConfig
}

// NewSimExecutor creates a simulated executor with the given config.
func NewSimExecutor(config SimConfig) *SimExecutor {
	return &SimExecutor{config: config}
}

func (e *SimExecutor) Mode() ExecutionMode  { return ModeSimulate }
func (e *SimExecutor) IsAvailable() bool    { return true }

func (e *SimExecutor) Execute(req ExecutionRequest) ExecutionReport {
	result := SimulateExecution(req, e.config)
	return ExecutionReport{
		RequestID:   req.RequestID,
		Success:     result.Feasible,
		FilledQty:   result.FilledQuantity,
		FilledPrice: result.FilledPrice,
		Fee:         result.FeeUSD,
		Slippage:    result.Slippage,
		SlippagePct: result.SlippagePct,
		LatencyMs:   result.EstLatencyMs,
		Error:       result.RejectReason,
		Mode:        ModeSimulate,
	}
}

// ─── DryRunExecutor ─────────────────────────────────────────────────────────

// DryRunExecutor logs the request but does not execute anything.
type DryRunExecutor struct{}

// NewDryRunExecutor creates a dry-run executor.
func NewDryRunExecutor() *DryRunExecutor {
	return &DryRunExecutor{}
}

func (e *DryRunExecutor) Mode() ExecutionMode  { return ModeDryRun }
func (e *DryRunExecutor) IsAvailable() bool    { return true }

func (e *DryRunExecutor) Execute(req ExecutionRequest) ExecutionReport {
	return ExecutionReport{
		RequestID:   req.RequestID,
		Success:     true,
		FilledQty:   req.Quantity,
		FilledPrice: req.Price,
		Fee:         0,
		Slippage:    0,
		LatencyMs:   0,
		Mode:        ModeDryRun,
	}
}

// ─── NewExecutor ────────────────────────────────────────────────────────────

// NewExecutor creates an executor for the given mode.
func NewExecutor(mode ExecutionMode, simConfig ...SimConfig) (Executor, error) {
	switch mode {
	case ModeSimulate:
		cfg := DefaultSimConfig()
		if len(simConfig) > 0 {
			cfg = simConfig[0]
		}
		return NewSimExecutor(cfg), nil
	case ModeDryRun:
		return NewDryRunExecutor(), nil
	case ModeLive:
		return nil, fmt.Errorf("live executor must be created through the trader package")
	default:
		return nil, fmt.Errorf("unknown execution mode: %s", mode)
	}
}
