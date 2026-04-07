package intelligence

// event_summary.go — Event summary formatting for admin/API display.

import (
	"fmt"
	"nofx/kernel"
	"strings"
)

// BuildAdminEventSummary formats active event signals as a human-readable summary.
func BuildAdminEventSummary(events []kernel.EventSignal) string {
	if len(events) == 0 {
		return "No active events"
	}

	var parts []string
	for _, e := range events {
		scope := e.Scope
		if scope == "" {
			scope = "market"
		}
		parts = append(parts, fmt.Sprintf("[%s/%s] sev=%d %s", e.Category, scope, e.Severity, e.Summary))
	}
	return strings.Join(parts, "\n")
}
