// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package intelligence

// event_policy.go — Event risk policy snapshot builder.

import "nofx/kernel"

// EventPolicySnapshot captures the current risk posture from active events.
type EventPolicySnapshot struct {
	MaxSeverity      int
	ActiveCategories []string
	EventIDs         []int64
	RiskMode         string // "normal" | "threshold_raised" | "blocked_open"
}

// BuildPolicySnapshot derives a risk mode snapshot from active event signals.
func BuildPolicySnapshot(events []kernel.EventSignal, severityThreshold int) EventPolicySnapshot {
	snap := EventPolicySnapshot{
		RiskMode: kernel.DeriveEventRiskMode(events, severityThreshold),
	}

	catSet := make(map[string]bool)
	for _, e := range events {
		if e.Severity > snap.MaxSeverity {
			snap.MaxSeverity = e.Severity
		}
		catSet[e.Category] = true
		snap.EventIDs = append(snap.EventIDs, e.ID)
	}
	for cat := range catSet {
		snap.ActiveCategories = append(snap.ActiveCategories, cat)
	}

	return snap
}
