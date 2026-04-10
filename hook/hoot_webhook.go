// Package hook holds outbound integrations from the nofx core to upstream
// platforms. Currently the only consumer is the upstream business layer, which
// expects fire-and-forget JSON webhooks for billing-relevant events.
//
// Design constraints (deliberate, do not "improve" without reading these):
//
//   - Trading is the source of truth. The webhook MUST NOT block or fail the
//     calling code path. Trading correctness comes first; billing is a
//     downstream observer that can be replayed if it ever drops events.
//
//   - The dispatch goroutine takes its OWN context.Background() with a 10s
//     deadline. NEVER use the originating request's gin.Context — it dies the
//     instant the HTTP handler returns, and a stray reuse would cancel the
//     POST mid-flight.
//
//   - Each event carries a uuid v4 event_id. The receiver is expected
//     to upsert by event_id, so retries are safe to do without coordination.
//
//   - HOOT_WEBHOOK_URL empty → dispatcher is a no-op. This is the runtime kill
//     switch: PM sets it to "" and the integration silently disables itself.
package hook

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"nofx/logger"
	"os"
	"time"

	"github.com/google/uuid"
)

// EventType enumerates webhook payload kinds. Adding a new type means the upstream platform
// must be updated in the same release; treat this list as part of the
// cross-process contract.
type EventType string

const (
	EventPositionClosed EventType = "position_closed"
	EventAIUsage        EventType = "ai_usage"
)

// Envelope is the wire format. Receivers should consider this stable; new
// fields go in the typed payload structs below, not here.
type Envelope struct {
	EventID   string      `json:"event_id"`
	Type      EventType   `json:"type"`
	Timestamp string      `json:"timestamp"`
	Payload   interface{} `json:"payload"`
}

// PositionClosedPayload mirrors the data emitted from
// handler_trader_status.handleClosePosition right after the close has been
// durably recorded. Numeric fields are floats since nofx already stores them
// that way; the upstream platform is responsible for converting to its DECIMAL columns.
type PositionClosedPayload struct {
	UserID      string  `json:"user_id"`
	TraderID    string  `json:"trader_id"`
	Symbol      string  `json:"symbol"`
	Side        string  `json:"side"`
	Quantity    float64 `json:"quantity"`
	EntryPrice  float64 `json:"entry_price"`
	ExitPrice   float64 `json:"exit_price"`             // market price at close time, for PnL estimation
	ExitResult  any     `json:"exit_result,omitempty"`   // raw exchange response, may be nil
	ExchangeID  string  `json:"exchange_id"`
}

// AIUsagePayload mirrors the data captured at the AICharge.Record call site
// in auto_trader_loop.go. CostUSD is computed by store.GetModelPrice; nofx
// does not yet break out input/output tokens, so this is intentionally a
// per-call coarse cost.
type AIUsagePayload struct {
	UserID   string  `json:"user_id"`
	TraderID string  `json:"trader_id"`
	Model    string  `json:"model"`
	Provider string  `json:"provider"`
	CostUSD  float64 `json:"cost_usd"`
}

// httpClient is a package-level singleton with reasonable timeouts. Reused so
// goroutines don't pay TLS handshake on every fire.
var httpClient = &http.Client{Timeout: 5 * time.Second}

// Dispatch fires the given event to HOOT in a background goroutine and
// returns immediately. The caller never sees a network error.
//
// Retries: 3 attempts with exponential backoff (200ms, 600ms, 1.8s). Total
// wall-clock budget capped by the goroutine's 10s deadline.
func Dispatch(eventType EventType, payload interface{}) {
	url := os.Getenv("HOOT_WEBHOOK_URL")
	token := os.Getenv("HOOT_INTERNAL_TOKEN")
	if url == "" || token == "" {
		// Kill switch / not yet wired — silently noop.
		return
	}

	env := Envelope{
		EventID:   uuid.New().String(),
		Type:      eventType,
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
		Payload:   payload,
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		body, err := json.Marshal(env)
		if err != nil {
			logger.Warnf("[hoot-webhook] marshal failed type=%s err=%v", eventType, err)
			return
		}

		var lastErr error
		for attempt := 0; attempt < 3; attempt++ {
			if attempt > 0 {
				delay := time.Duration(200*(1<<attempt)) * time.Millisecond
				select {
				case <-ctx.Done():
					logger.Warnf("[hoot-webhook] giving up type=%s event_id=%s reason=ctx-deadline last_err=%v",
						eventType, env.EventID, lastErr)
					return
				case <-time.After(delay):
				}
			}

			req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
			if err != nil {
				lastErr = err
				continue
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Internal-Token", token)

			resp, err := httpClient.Do(req)
			if err != nil {
				lastErr = err
				continue
			}
			// Read & close body so the connection can be reused.
			_ = resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				logger.Infof("[hoot-webhook] delivered type=%s event_id=%s status=%d attempt=%d",
					eventType, env.EventID, resp.StatusCode, attempt+1)
				return
			}
			lastErr = fmt.Errorf("upstream status %d", resp.StatusCode)
			// 4xx are not retryable except 408/429.
			if resp.StatusCode >= 400 && resp.StatusCode < 500 &&
				resp.StatusCode != http.StatusRequestTimeout &&
				resp.StatusCode != http.StatusTooManyRequests {
				break
			}
		}
		logger.Warnf("[hoot-webhook] dropped type=%s event_id=%s last_err=%v",
			eventType, env.EventID, lastErr)
	}()
}
