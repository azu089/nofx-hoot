// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package kernel

// ai_generator.go — AI-based candidate generator.
//
// The AI acts as a "candidate generator" producing up to 3 proposals
// (including possibly a wait). The Gatekeeper then evaluates them.
//
// Key changes vs the original flow:
//   - System prompt tells AI it is NOT the final executor
//   - AI must output {"candidates": [...]} (with fallback to old [...] format)
//   - Tags and Invalidation fields are requested
//   - Each candidate must include structured reasoning

import (
	"encoding/json"
	"fmt"
	"nofx/logger"
	"nofx/mcp"
	"strings"
)

// ─── Candidate JSON wrapper ─────────────────────────────────────────────────

type aiCandidatesWrapper struct {
	Candidates []aiCandidateJSON `json:"candidates"`
}

type aiCandidateJSON struct {
	Action          string   `json:"action"`
	Symbol          string   `json:"symbol"`
	Leverage        int      `json:"leverage,omitempty"`
	PositionSizeUSD float64  `json:"position_size_usd,omitempty"`
	StopLoss        float64  `json:"stop_loss,omitempty"`
	TakeProfit      float64  `json:"take_profit,omitempty"`
	Confidence      int      `json:"confidence,omitempty"`
	RiskUSD         float64  `json:"risk_usd,omitempty"`
	Tags            []string `json:"tags,omitempty"`
	Why             string   `json:"why,omitempty"`
	Invalidation    string   `json:"invalidation,omitempty"`
	Reasoning       string   `json:"reasoning,omitempty"` // backward compat
}

// ─── GenerateCandidatesFromAI ───────────────────────────────────────────────

// GenerateCandidatesFromAI calls the AI with a modified prompt that requests
// top-K candidates in the new JSON format. Falls back to legacy format.
func GenerateCandidatesFromAI(
	ctx *Context,
	engine *StrategyEngine,
	mcpClient mcp.AIClient,
	topK int,
) ([]CandidateDecision, string, error) {
	if topK <= 0 {
		topK = 3
	}

	// Build prompts using existing engine with candidate mode overlay
	systemPrompt := buildCandidateSystemPrompt(engine, ctx.Account.TotalEquity, topK)
	userPrompt := engine.BuildUserPrompt(ctx)

	logger.Infof("🤖 [AIGenerator] Requesting top-%d candidates from AI...", topK)

	aiResponse, err := mcpClient.CallWithMessages(systemPrompt, userPrompt)
	if err != nil {
		return nil, aiResponse, fmt.Errorf("AI API call failed: %w", err)
	}

	candidates, err := parseAICandidates(aiResponse)
	if err != nil {
		logger.Warnf("⚠️ [AIGenerator] Failed to parse candidates: %v", err)
		return nil, aiResponse, err
	}

	logger.Infof("✅ [AIGenerator] Received %d candidates from AI", len(candidates))
	for i, c := range candidates {
		logger.Infof("   [%d] %s %s conf=%d tags=%v", i+1, c.Symbol, c.Action, c.Confidence, c.Tags)
	}

	return candidates, aiResponse, nil
}

// buildCandidateSystemPrompt creates system prompt for candidate generation mode.
func buildCandidateSystemPrompt(engine *StrategyEngine, accountEquity float64, topK int) string {
	base := engine.BuildSystemPrompt(accountEquity, "")

	var sb strings.Builder
	sb.WriteString(base)
	sb.WriteString("\n\n")
	sb.WriteString("# INSTITUTIONAL MODE: You Are a CANDIDATE GENERATOR\n\n")
	sb.WriteString("**IMPORTANT: You are NOT the final decision maker.**\n")
	sb.WriteString("A downstream rules engine (Gatekeeper) will evaluate your proposals.\n\n")
	sb.WriteString(fmt.Sprintf("Your role: generate up to %d diverse, well-reasoned trade candidates.\n\n", topK))
	sb.WriteString("## Output Format (REQUIRED)\n\n")
	sb.WriteString("<reasoning>\nYour analysis here...\n</reasoning>\n\n")
	sb.WriteString("<decision>\n```json\n")
	sb.WriteString(`{"candidates": [
  {
    "action": "open_long|open_short|close_long|close_short|wait",
    "symbol": "BTCUSDT",
    "leverage": 3,
    "position_size_usd": 100,
    "stop_loss": 65000,
    "take_profit": 70000,
    "confidence": 78,
    "tags": ["trend_follow", "oi_expansion"],
    "why": "Brief reason for this candidate",
    "invalidation": "Conditions that would cancel this trade"
  }
]}`)
	sb.WriteString("\n```\n</decision>\n\n")
	sb.WriteString("## Candidate Rules\n\n")
	sb.WriteString(fmt.Sprintf("1. Generate up to %d candidates — include 'wait' if signals are weak\n", topK))
	sb.WriteString("2. Include `tags` from: trend_follow, mean_revert, breakout, squeeze\n")
	sb.WriteString("3. Include `invalidation` — when would this trade be wrong?\n")
	sb.WriteString("4. If uncertain, OUTPUT WAIT — do NOT force a trade\n")
	sb.WriteString("5. All values must be calculated numbers, NOT formulas or ranges\n")

	return sb.String()
}

// ─── parseAICandidates ──────────────────────────────────────────────────────

// parseAICandidates tries the new {"candidates":[...]} format first,
// then falls back to the legacy [...] format.
func parseAICandidates(response string) ([]CandidateDecision, error) {
	// Use the four-layer JSON extractor
	jsonContent, err := ExtractFirstJSON(response)
	if err != nil {
		return nil, fmt.Errorf("no JSON found in AI response: %w", err)
	}

	// Try new {"candidates": [...]} format
	candidates, err := parseCandidatesWrapper(jsonContent)
	if err == nil && len(candidates) > 0 {
		return candidates, nil
	}

	// Fall back to legacy flat array
	var legacyDecisions []Decision
	if legacyErr := json.Unmarshal([]byte(jsonContent), &legacyDecisions); legacyErr != nil {
		return nil, fmt.Errorf("candidates format: %v; legacy format: %v", err, legacyErr)
	}

	candidates = make([]CandidateDecision, 0, len(legacyDecisions))
	for _, d := range legacyDecisions {
		c := CandidateFromDecision(d, "ai")
		c.Tags = []string{TagAIGen}
		candidates = append(candidates, c)
	}
	return candidates, nil
}

func parseCandidatesWrapper(jsonStr string) ([]CandidateDecision, error) {
	trimmed := strings.TrimSpace(jsonStr)

	var wrapper aiCandidatesWrapper

	if strings.HasPrefix(trimmed, "{") {
		if err := json.Unmarshal([]byte(trimmed), &wrapper); err != nil {
			return nil, err
		}
	} else if strings.HasPrefix(trimmed, "[") {
		var items []aiCandidateJSON
		if err := json.Unmarshal([]byte(trimmed), &items); err != nil {
			return nil, err
		}
		wrapper.Candidates = items
	} else {
		return nil, fmt.Errorf("not a JSON object or array")
	}

	if len(wrapper.Candidates) == 0 {
		return nil, fmt.Errorf("empty candidates array")
	}

	out := make([]CandidateDecision, 0, len(wrapper.Candidates))
	for _, ai := range wrapper.Candidates {
		why := ai.Why
		if why == "" {
			why = ai.Reasoning
		}
		tags := ai.Tags
		if len(tags) == 0 {
			tags = []string{TagAIGen}
		} else {
			tags = append(tags, TagAIGen)
		}
		c := CandidateDecision{
			Action:          ai.Action,
			Symbol:          ai.Symbol,
			Leverage:        ai.Leverage,
			StopLoss:        ai.StopLoss,
			TakeProfit:      ai.TakeProfit,
			PositionSizeUSD: ai.PositionSizeUSD,
			Confidence:      ai.Confidence,
			RiskUSD:         ai.RiskUSD,
			Tags:            tags,
			Source:          "ai",
			ReasonStruct: CandidateReason{
				Why:          why,
				Invalidation: ai.Invalidation,
			},
			ScoreBreakdown: make(map[string]float64),
		}
		out = append(out, c)
	}
	return out, nil
}
