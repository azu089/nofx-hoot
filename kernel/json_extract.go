package kernel

import (
	"bytes"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
)

// ErrNoJSONFound is returned when no valid JSON payload can be extracted.
var ErrNoJSONFound = errors.New("no JSON found in text")

// Regex patterns for JSON extraction (unique to this file; reDecisionTag is in engine_analysis.go)
var (
	reFencedJSONBlock = regexp.MustCompile("(?is)```\\s*json\\s*\\n(.*?)\\n```")
	reFencedPlain     = regexp.MustCompile("(?is)```\\s*\\n(.*?)\\n```")
)

// ExtractFirstJSON extracts the first valid JSON object or array from noisy LLM output.
// Priority:
//  1. ```json ... ``` fenced block
//  2. <decision> ... </decision> section (then try fenced / raw)
//  3. Balanced brace/bracket scan over full text
//  4. Full JSON validation on result
func ExtractFirstJSON(raw string) (string, error) {
	if raw == "" {
		return "", ErrNoJSONFound
	}

	// Layer 1: fenced ```json block
	if s, ok := extractFenced(raw); ok && isValidJSON(s) {
		return s, nil
	}

	// Layer 2: <decision> section
	if dec, ok := extractDecision(raw); ok {
		if s, ok2 := extractFenced(dec); ok2 && isValidJSON(s) {
			return s, nil
		}
		if s, ok2 := scanBalanced(dec); ok2 && isValidJSON(s) {
			return s, nil
		}
	}

	// Layer 3: scan entire text for balanced JSON
	if s, ok := scanBalanced(raw); ok && isValidJSON(s) {
		return s, nil
	}

	return "", ErrNoJSONFound
}

// extractFenced finds the first ```json ... ``` or ``` ... ``` block.
func extractFenced(s string) (string, bool) {
	if m := reFencedJSONBlock.FindStringSubmatch(s); len(m) >= 2 {
		return strings.TrimSpace(m[1]), true
	}
	if m := reFencedPlain.FindStringSubmatch(s); len(m) >= 2 {
		candidate := strings.TrimSpace(m[1])
		if strings.HasPrefix(candidate, "{") || strings.HasPrefix(candidate, "[") {
			return candidate, true
		}
	}
	return "", false
}

// extractDecision returns inner content of <decision>...</decision>.
func extractDecision(s string) (string, bool) {
	if m := reDecisionTag.FindStringSubmatch(s); len(m) >= 2 {
		return strings.TrimSpace(m[1]), true
	}
	return "", false
}

// scanBalanced scans text and returns the first balanced JSON object/array substring.
// Handles string escapes so braces inside quoted strings don't break balance.
func scanBalanced(s string) (string, bool) {
	start := -1
	var open, close byte
	for i := 0; i < len(s); i++ {
		if s[i] == '{' {
			start = i
			open, close = '{', '}'
			break
		}
		if s[i] == '[' {
			start = i
			open, close = '[', ']'
			break
		}
	}
	if start < 0 {
		return "", false
	}

	depth := 0
	inString := false
	escape := false

	for i := start; i < len(s); i++ {
		ch := s[i]

		if inString {
			if escape {
				escape = false
				continue
			}
			if ch == '\\' {
				escape = true
				continue
			}
			if ch == '"' {
				inString = false
			}
			continue
		}

		switch ch {
		case '"':
			inString = true
		case open:
			depth++
		case close:
			depth--
			if depth == 0 {
				return strings.TrimSpace(s[start : i+1]), true
			}
		}
	}

	return "", false
}

// isValidJSON checks if a string is a complete, valid JSON value.
func isValidJSON(s string) bool {
	s = strings.TrimSpace(s)
	if s == "" {
		return false
	}
	if !(strings.HasPrefix(s, "{") || strings.HasPrefix(s, "[")) {
		return false
	}

	dec := json.NewDecoder(bytes.NewReader([]byte(s)))
	var v any
	if err := dec.Decode(&v); err != nil {
		return false
	}
	// Ensure no trailing content
	if dec.More() {
		return false
	}
	return true
}
