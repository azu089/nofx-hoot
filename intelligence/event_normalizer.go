package intelligence

// event_normalizer.go — Event text analysis and classification.
//
// Uses keyword rules to infer category, severity, direction, scope,
// and affected symbols from raw event text.

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"nofx/store"
)

// ─── Keyword Rules ──────────────────────────────────────────────────────────

type keywordRule struct {
	keywords  []string
	category  string
	severity  int
	direction string // "risk_off" | "risk_on" | "neutral"
}

var categoryRules = []keywordRule{
	// Macro (economic events)
	{[]string{"cpi", "consumer price"}, "macro", 4, "risk_off"},
	{[]string{"gdp", "gross domestic"}, "macro", 3, "neutral"},
	{[]string{"fomc", "federal reserve", "fed meeting"}, "macro", 5, "risk_off"},
	{[]string{"rate hike", "rate cut", "interest rate"}, "macro", 4, "risk_off"},
	{[]string{"inflation"}, "macro", 3, "risk_off"},
	{[]string{"employment", "jobs report", "nonfarm", "unemployment"}, "macro", 3, "neutral"},

	// Regulation
	{[]string{"sec ", "securities and exchange"}, "regulation", 4, "risk_off"},
	{[]string{"cftc"}, "regulation", 3, "risk_off"},
	{[]string{"ban", "prohibit", "crackdown"}, "regulation", 5, "risk_off"},
	{[]string{"lawsuit", "sued", "enforcement"}, "regulation", 3, "risk_off"},
	{[]string{"regulation", "regulatory"}, "regulation", 2, "neutral"},
	{[]string{"compliance", "license", "approved"}, "regulation", 2, "risk_on"},

	// Geopolitics
	{[]string{"war", "military", "invasion"}, "geopolitics", 5, "risk_off"},
	{[]string{"sanction"}, "geopolitics", 4, "risk_off"},
	{[]string{"conflict", "tension", "escalation"}, "geopolitics", 3, "risk_off"},

	// Exchange
	{[]string{"hack", "stolen", "breach", "exploit"}, "exchange", 5, "risk_off"},
	{[]string{"delist", "delisting"}, "exchange", 3, "risk_off"},
	{[]string{"maintenance", "downtime", "outage"}, "exchange", 2, "neutral"},

	// Protocol
	{[]string{"exploit", "vulnerability", "bug", "rug"}, "protocol", 4, "risk_off"},
	{[]string{"upgrade", "hard fork", "fork"}, "protocol", 2, "neutral"},
}

// Symbol keyword mapping
var symbolKeywords = map[string][]string{
	"BTCUSDT": {"bitcoin", "btc"},
	"ETHUSDT": {"ethereum", "eth"},
	"SOLUSDT": {"solana", "sol"},
	"BNBUSDT": {"binance coin", "bnb"},
	"XRPUSDT": {"ripple", "xrp"},
	"DOGEUSDT": {"doge", "dogecoin"},
	"ADAUSDT": {"cardano", "ada"},
	"AVAXUSDT": {"avalanche", "avax"},
	"LINKUSDT": {"chainlink", "link"},
}

// ─── NormalizedResult ───────────────────────────────────────────────────────

// NormalizedResult holds the output of event normalization.
type NormalizedResult struct {
	Item    store.EventItem
	Signals []store.EventSignalRecord
}

// ─── NormalizeFetchedItem ───────────────────────────────────────────────────

// NormalizeFetchedItem converts a fetched event into a DB item + inferred signals.
func NormalizeFetchedItem(source store.EventSource, fetched FetchedEventItem) NormalizedResult {
	// Build dedup hash
	hashInput := fmt.Sprintf("%d|%s|%s", source.ID, fetched.Title, fetched.Link)
	h := sha1.Sum([]byte(hashInput))
	hash := hex.EncodeToString(h[:])

	pubAt := fetched.PublishedAt
	if pubAt.IsZero() {
		pubAt = time.Now().UTC()
	}

	item := store.EventItem{
		SourceID:    source.ID,
		Title:       fetched.Title,
		Content:     fetched.Content,
		PublishedAt: pubAt,
		Hash:        hash,
	}

	// Infer signals from text
	signals := inferSignals(source, fetched.Title, fetched.Content)

	return NormalizedResult{Item: item, Signals: signals}
}

// inferSignals analyzes title + content text against keyword rules.
func inferSignals(source store.EventSource, title, body string) []store.EventSignalRecord {
	text := strings.ToLower(title + " " + body)

	var signals []store.EventSignalRecord

	for _, rule := range categoryRules {
		matched := false
		for _, kw := range rule.keywords {
			if strings.Contains(text, kw) {
				matched = true
				break
			}
		}
		if !matched {
			continue
		}

		// Determine scope and affected symbols
		scope := "market"
		var affected []string
		for sym, keywords := range symbolKeywords {
			for _, kw := range keywords {
				if strings.Contains(text, kw) {
					affected = append(affected, sym)
					scope = "symbol"
					break
				}
			}
		}

		now := time.Now().UTC()
		decayMinutes := 60
		if rule.severity >= 4 {
			decayMinutes = 240 // 4h for high-severity events
		}

		sig := store.EventSignalRecord{
			Category:     rule.category,
			Severity:     rule.severity,
			Direction:    rule.direction,
			Scope:        scope,
			Confidence:   0.6, // keyword-based inference has moderate confidence
			SourceType:   source.Type,
			SourceName:   source.Name,
			Summary:      truncate(title, 200),
			Status:       store.EventSignalStatusActive,
			StartsAt:     now,
			EndsAt:       now.Add(time.Duration(decayMinutes) * time.Minute),
			DecayMinutes: decayMinutes,
		}
		sig.SetAffectedSymbolsList(affected)

		signals = append(signals, sig)
		break // one rule per item to avoid duplicate signals
	}

	return signals
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
