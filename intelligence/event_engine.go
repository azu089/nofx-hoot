package intelligence

// event_engine.go — Event intelligence engine.
//
// Three-stage lifecycle:
//   1. RefreshEnabledSources — fetch from all enabled providers
//   2. NormalizeAndStore — standardize + dedup + persist
//   3. GetActiveSignals — query active signals for trading decisions

import (
	"context"
	"fmt"
	"time"

	"nofx/kernel"
	"nofx/logger"
	"nofx/store"
)

// ─── EventEngine ────────────────────────────────────────────────────────────

// EventEngine manages the event intelligence lifecycle.
type EventEngine struct {
	eventStore *store.EventStore
	providers  map[string]EventProvider // type → provider
}

// NewEventEngine creates a new event engine.
func NewEventEngine(eventStore *store.EventStore) *EventEngine {
	return &EventEngine{
		eventStore: eventStore,
		providers: map[string]EventProvider{
			store.EventSourceTypeManual: ManualProvider{},
			store.EventSourceTypeRSS:    NewRSSProvider(),
		},
	}
}

// ─── RefreshResult ──────────────────────────────────────────────────────────

// RefreshResult summarizes the outcome of a source refresh cycle.
type RefreshResult struct {
	SourcesChecked int
	ItemsFetched   int
	ItemsNew       int
	SignalsCreated int
	Errors         []string
}

// ─── Stage 1: Refresh ───────────────────────────────────────────────────────

// RefreshEnabledSources fetches from all enabled event sources.
func (e *EventEngine) RefreshEnabledSources(ctx context.Context) RefreshResult {
	result := RefreshResult{}

	sources, err := e.eventStore.ListSources()
	if err != nil {
		result.Errors = append(result.Errors, fmt.Sprintf("list sources: %v", err))
		return result
	}

	for _, source := range sources {
		if !source.Enabled {
			continue
		}

		provider, ok := e.providers[source.Type]
		if !ok {
			continue
		}

		result.SourcesChecked++

		items, err := provider.Fetch(ctx, source)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("source %s: %v", source.Name, err))
			continue
		}

		result.ItemsFetched += len(items)

		// Stage 2: Normalize and store
		for _, fetched := range items {
			normalized := NormalizeFetchedItem(source, fetched)

			// Dedup check
			exists, err := e.eventStore.ItemExistsByHash(normalized.Item.Hash)
			if err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("dedup check: %v", err))
				continue
			}
			if exists {
				continue
			}

			// Store item
			if err := e.eventStore.CreateItem(&normalized.Item); err != nil {
				result.Errors = append(result.Errors, fmt.Sprintf("create item: %v", err))
				continue
			}

			result.ItemsNew++

			// Store signals
			for i := range normalized.Signals {
				normalized.Signals[i].ItemID = normalized.Item.ID
				if err := e.eventStore.CreateSignal(&normalized.Signals[i]); err != nil {
					result.Errors = append(result.Errors, fmt.Sprintf("create signal: %v", err))
					continue
				}
				result.SignalsCreated++
			}
		}

		// Update provider cache
		_ = e.eventStore.UpsertProviderCache(source.ID, "", "")
	}

	if result.SignalsCreated > 0 {
		logger.Infof("📰 [EventEngine] Refreshed: %d sources, %d items fetched, %d new, %d signals",
			result.SourcesChecked, result.ItemsFetched, result.ItemsNew, result.SignalsCreated)
	}

	return result
}

// ─── Stage 3: Query ─────────────────────────────────────────────────────────

// GetActiveSignals returns currently active event signals as kernel.EventSignal.
func (e *EventEngine) GetActiveSignals(now time.Time) ([]kernel.EventSignal, error) {
	records, err := e.eventStore.ListActiveSignals(now)
	if err != nil {
		return nil, fmt.Errorf("list active signals: %w", err)
	}

	signals := make([]kernel.EventSignal, 0, len(records))
	for _, r := range records {
		signals = append(signals, recordToKernelSignal(r))
	}
	return signals, nil
}

// ─── Manual Signal Creation ─────────────────────────────────────────────────

// ManualSignalInput is the input for creating a manual event signal.
type ManualSignalInput struct {
	Category        string
	Severity        int
	Direction       string // "risk_off" | "risk_on" | "neutral"
	Scope           string // "market" | "symbol"
	AffectedSymbols []string
	Summary         string
	DurationMinutes int
}

// CreateManualSignal creates a manual event signal (from API/admin panel).
func (e *EventEngine) CreateManualSignal(input ManualSignalInput) (*store.EventSignalRecord, error) {
	if input.Category == "" {
		return nil, fmt.Errorf("category is required")
	}
	if input.Severity < 1 || input.Severity > 5 {
		return nil, fmt.Errorf("severity must be 1-5")
	}
	if input.DurationMinutes <= 0 {
		input.DurationMinutes = 60
	}
	if input.Direction == "" {
		input.Direction = "neutral"
	}
	if input.Scope == "" {
		input.Scope = "market"
	}

	now := time.Now().UTC()
	sig := &store.EventSignalRecord{
		Category:     input.Category,
		Severity:     input.Severity,
		Direction:    input.Direction,
		Scope:        input.Scope,
		Confidence:   1.0, // manual = full confidence
		SourceType:   store.EventSourceTypeManual,
		SourceName:   "MANUAL_DESK",
		Summary:      input.Summary,
		Status:       store.EventSignalStatusActive,
		StartsAt:     now,
		EndsAt:       now.Add(time.Duration(input.DurationMinutes) * time.Minute),
		DecayMinutes: input.DurationMinutes,
	}
	sig.SetAffectedSymbolsList(input.AffectedSymbols)

	if err := e.eventStore.CreateSignal(sig); err != nil {
		return nil, fmt.Errorf("failed to create manual signal: %w", err)
	}

	logger.Infof("📰 [EventEngine] Manual signal created: category=%s severity=%d scope=%s",
		input.Category, input.Severity, input.Scope)

	return sig, nil
}

// ─── Decision Logging ───────────────────────────────────────────────────────

// LogGateDecision records a Gatekeeper decision influenced by events.
func (e *EventEngine) LogGateDecision(traderID string, audit kernel.EventDecisionAudit) {
	if e.eventStore == nil {
		return
	}

	// Find the first relevant signal ID
	var signalID int64
	if len(audit.EventSignals) > 0 {
		signalID = audit.EventSignals[0].ID
	}

	log := &store.EventDecisionLog{
		SignalID: signalID,
		TraderID: traderID,
		Symbol:   audit.Symbol,
		Action:   audit.Decision,
		RuleCode: audit.RuleCode,
		Before:   store.EncodeJSONString(audit.Before),
		After:    store.EncodeJSONString(audit.After),
	}

	if err := e.eventStore.CreateDecisionLog(log); err != nil {
		logger.Warnf("⚠️ [EventEngine] Failed to log gate decision: %v", err)
	}
}

// ─── Conversion ─────────────────────────────────────────────────────────────

// recordToKernelSignal converts a store record to kernel.EventSignal.
func recordToKernelSignal(r store.EventSignalRecord) kernel.EventSignal {
	return kernel.EventSignal{
		ID:              r.ID,
		Category:        r.Category,
		Severity:        r.Severity,
		Direction:       r.Direction,
		Scope:           r.Scope,
		AffectedSymbols: r.GetAffectedSymbolsList(),
		Confidence:      r.Confidence,
		SourceType:      r.SourceType,
		SourceName:      r.SourceName,
		Summary:         r.Summary,
		StartsAt:        r.StartsAt,
		EndsAt:          r.EndsAt,
		DecayMinutes:    r.DecayMinutes,
		Status:          r.Status,
	}
}
