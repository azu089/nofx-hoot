// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package kernel

// event_signals.go — Event signal system for macro/regulatory/exchange intelligence.
//
// EventSignal represents a discrete market event (macro, regulation, geopolitics,
// exchange incident, protocol vulnerability) with severity, scope, and time decay.
//
// The Gatekeeper uses event signals to:
//   - Block all opens during severe macro/regulatory events (blocked_open)
//   - Raise thresholds for moderate events (threshold_raised)
//   - Allow normal trading otherwise (normal)

import (
	"fmt"
	"nofx/market"
	"sort"
	"strings"
	"time"
)

// ─── EventSignal ────────────────────────────────────────────────────────────

// EventSignal describes a single market event with severity and time window.
type EventSignal struct {
	ID              int64     // unique identifier
	Category        string    // "macro" | "regulation" | "exchange" | "protocol" | "geopolitics"
	Severity        int       // 1-5 (1=minor, 5=critical)
	Direction       string    // "risk_off" | "risk_on" | "neutral"
	Scope           string    // "market" (affects all) | "symbol" (affects specific coins)
	AffectedSymbols []string  // symbols affected (when scope="symbol")
	Confidence      float64   // 0.0-1.0 confidence in the signal
	SourceType      string    // "rss" | "manual" | "api"
	SourceName      string    // source identifier
	Summary         string    // human-readable summary
	StartsAt        time.Time // event window start
	EndsAt          time.Time // event window end (including decay)
	DecayMinutes    int       // how long the event decays after peak
	Status          string    // "active" | "decaying" | "expired"
}

// IsActive returns true if the event is within its active time window.
func (e EventSignal) IsActive(now time.Time) bool {
	if e.StartsAt.IsZero() || e.EndsAt.IsZero() {
		return false
	}
	if e.Status != "" && e.Status != "active" && e.Status != "decaying" {
		return false
	}
	return !now.Before(e.StartsAt) && !now.After(e.EndsAt)
}

// AffectsSymbol returns true if the event affects the given symbol.
// Market-scope events affect all symbols.
func (e EventSignal) AffectsSymbol(symbol string) bool {
	if e.Scope == "market" {
		return true
	}
	target := market.Normalize(symbol)
	for _, affected := range e.AffectedSymbols {
		if market.Normalize(affected) == target {
			return true
		}
	}
	return false
}

// ─── Risk Mode Derivation ───────────────────────────────────────────────────

// DeriveEventRiskMode determines the trading risk mode from active events.
//
// Returns:
//   - "blocked_open": severity ≥ 4 macro/regulation/geopolitics → block all new positions
//   - "threshold_raised": severity ≥ 3 → raise confidence/score thresholds
//   - "normal": no significant events
func DeriveEventRiskMode(events []EventSignal, severityThreshold int) string {
	if len(events) == 0 {
		return "normal"
	}
	now := time.Now().UTC()
	highest := 0
	for _, event := range events {
		if !event.IsActive(now) {
			continue
		}
		if event.Severity > highest {
			highest = event.Severity
		}
		if isEventBlackout(event) || isSymbolIncident(event) {
			return "blocked_open"
		}
	}
	minThreshold := 3
	if severityThreshold > 0 && severityThreshold-1 > minThreshold {
		minThreshold = severityThreshold - 1
	}
	if highest >= minThreshold {
		return "threshold_raised"
	}
	return "normal"
}

// ─── Prompt Formatting ──────────────────────────────────────────────────────

// FormatEventSignalsForAI formats active events as an AI prompt section.
func FormatEventSignalsForAI(events []EventSignal, lang Language, maxItems int, riskMode string) string {
	if len(events) == 0 || maxItems <= 0 {
		return ""
	}
	now := time.Now().UTC()

	// Filter active events
	active := make([]EventSignal, 0, len(events))
	for _, event := range events {
		if event.IsActive(now) {
			active = append(active, event)
		}
	}
	if len(active) == 0 {
		return ""
	}

	// Sort by severity desc, then confidence desc
	sort.SliceStable(active, func(i, j int) bool {
		if active[i].Severity != active[j].Severity {
			return active[i].Severity > active[j].Severity
		}
		return active[i].Confidence > active[j].Confidence
	})
	if len(active) > maxItems {
		active = active[:maxItems]
	}

	var sb strings.Builder
	if lang == LangChinese {
		sb.WriteString("## 事件情报\n")
		sb.WriteString(fmt.Sprintf("风险模式: %s\n", riskMode))
	} else {
		sb.WriteString("## Event Intelligence\n")
		sb.WriteString(fmt.Sprintf("Risk Mode: %s\n", riskMode))
	}

	for idx, event := range active {
		scope := event.Scope
		if scope == "" {
			scope = "market"
		}
		affected := "ALL"
		if len(event.AffectedSymbols) > 0 {
			affected = strings.Join(event.AffectedSymbols, ",")
		}
		sb.WriteString(fmt.Sprintf("%d. [%s/%s] severity=%d confidence=%.0f%% affected=%s summary=%s\n",
			idx+1, event.Category, scope, event.Severity, event.Confidence*100, affected, event.Summary))
	}

	if lang == LangChinese {
		sb.WriteString("请将该事件摘要视为风险过滤与阈值调整依据，不要仅凭事件文本直接追单。\n\n")
	} else {
		sb.WriteString("Treat this as a risk filter / threshold-raising input, not a direct chase trigger.\n\n")
	}
	return sb.String()
}

// ─── Event Classification Helpers ───────────────────────────────────────────

// isEventBlackout returns true for market-wide severe macro/regulatory/geopolitical events.
func isEventBlackout(event EventSignal) bool {
	if event.Scope != "market" {
		return false
	}
	if event.Severity < 4 {
		return false
	}
	switch event.Category {
	case "macro", "regulation", "geopolitics":
		return true
	default:
		return false
	}
}

// isSymbolIncident returns true for severe exchange/protocol incidents.
func isSymbolIncident(event EventSignal) bool {
	if event.Severity < 4 {
		return false
	}
	switch event.Category {
	case "exchange", "protocol", "onchain_incident":
		return true
	default:
		return false
	}
}

// ─── EventDecisionAudit ─────────────────────────────────────────────────────

// EventDecisionAudit records a Gatekeeper decision influenced by events (for audit trail).
type EventDecisionAudit struct {
	Symbol       string
	Stage        string // "gatekeeper" | "position_manager"
	Decision     string // "block_open" | "threshold_raise" | "allow"
	RuleCode     string
	EventSignals []EventSignal
	Before       map[string]interface{}
	After        map[string]interface{}
}

// EventDecisionLogger is a callback for recording event-influenced decisions.
type EventDecisionLogger func(EventDecisionAudit)
