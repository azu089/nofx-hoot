// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package trader

// binance_user_stream.go — Binance Futures WebSocket user data stream.
//
// Monitors account updates (balance, positions, orders) in real-time
// via Binance's listenKey mechanism. Replaces polling for instant feedback.
//
// Lifecycle:
//   Start() → creates listenKey → connects WebSocket → starts keepAlive goroutine
//   Stop()  → closes WebSocket → stops keepAlive
//
// Auto-reconnect with exponential backoff (max 60s).

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"nofx/logger"

	"github.com/gorilla/websocket"
)

// ─── Callback Types ─────────────────────────────────────────────────────────

// OrderUpdateEvent is fired when an order changes state.
type OrderUpdateEvent struct {
	Symbol        string  `json:"symbol"`
	OrderID       string  `json:"order_id"`
	Side          string  `json:"side"` // "BUY" | "SELL"
	OrderType     string  `json:"order_type"`
	Status        string  `json:"status"` // "NEW" | "FILLED" | "CANCELED" | ...
	FilledQty     float64 `json:"filled_qty"`
	FilledPrice   float64 `json:"filled_price"`
	Commission    float64 `json:"commission"`
	RealizedPnL   float64 `json:"realized_pnl"`
	PositionSide  string  `json:"position_side"`
	ReduceOnly    bool    `json:"reduce_only"`
}

// AccountUpdateEvent is fired when balance or positions change.
type AccountUpdateEvent struct {
	EventReason string                 `json:"event_reason"`
	Balances    []BalanceUpdate        `json:"balances"`
	Positions   []PositionUpdateEvent  `json:"positions"`
}

type BalanceUpdate struct {
	Asset  string  `json:"asset"`
	Balance float64 `json:"balance"`
	CrossWalletBalance float64 `json:"cross_wallet_balance"`
}

type PositionUpdateEvent struct {
	Symbol       string  `json:"symbol"`
	Side         string  `json:"side"`
	Quantity     float64 `json:"quantity"`
	EntryPrice   float64 `json:"entry_price"`
	UnrealizedPnL float64 `json:"unrealized_pnl"`
	MarginType   string  `json:"margin_type"`
}

// ─── BinanceUserStream ──────────────────────────────────────────────────────

// BinanceUserStream manages a WebSocket connection to Binance's user data stream.
type BinanceUserStream struct {
	apiKey    string
	apiSecret string
	baseURL   string // "https://fapi.binance.com" or "https://demo-fapi.binance.com"
	wsURL     string // "wss://fstream.binance.com" or "wss://demo-fstream.binance.com"

	listenKey string
	conn      *websocket.Conn
	stopCh    chan struct{}
	wg        sync.WaitGroup
	mu        sync.Mutex

	// Callbacks (set by caller before Start)
	OnOrderUpdate   func(OrderUpdateEvent)
	OnAccountUpdate func(AccountUpdateEvent)
}

// NewBinanceUserStream creates a new user stream manager.
func NewBinanceUserStream(apiKey, apiSecret string, testnet bool) *BinanceUserStream {
	baseURL := "https://fapi.binance.com"
	wsURL := "wss://fstream.binance.com"
	if testnet {
		baseURL = "https://demo-fapi.binance.com"
		wsURL = "wss://demo-fstream.binance.com"
	}

	return &BinanceUserStream{
		apiKey:    apiKey,
		apiSecret: apiSecret,
		baseURL:   baseURL,
		wsURL:     wsURL,
		stopCh:    make(chan struct{}),
	}
}

// Start creates a listenKey, connects WebSocket, and begins listening.
func (s *BinanceUserStream) Start() error {
	// Create listenKey
	key, err := s.createListenKey()
	if err != nil {
		return fmt.Errorf("failed to create listen key: %w", err)
	}
	s.listenKey = key
	logger.Infof("🔌 [UserStream] Listen key created: %s...", key[:8])

	// Connect WebSocket
	if err := s.connect(); err != nil {
		return fmt.Errorf("failed to connect WebSocket: %w", err)
	}

	// Start keepAlive goroutine (every 30 minutes)
	s.wg.Add(1)
	go s.keepAlive()

	// Start message reader goroutine
	s.wg.Add(1)
	go s.readMessages()

	logger.Infof("🔌 [UserStream] Started successfully")
	return nil
}

// Stop gracefully closes the user stream.
func (s *BinanceUserStream) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	select {
	case <-s.stopCh:
		return // already stopped
	default:
		close(s.stopCh)
	}

	if s.conn != nil {
		s.conn.Close()
	}
	s.wg.Wait()
	logger.Infof("🔌 [UserStream] Stopped")
}

// ─── Internal: WebSocket lifecycle ──────────────────────────────────────────

func (s *BinanceUserStream) connect() error {
	url := fmt.Sprintf("%s/ws/%s", s.wsURL, s.listenKey)

	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		return fmt.Errorf("websocket dial failed: %w", err)
	}

	s.mu.Lock()
	s.conn = conn
	s.mu.Unlock()

	logger.Infof("🔌 [UserStream] WebSocket connected")
	return nil
}

func (s *BinanceUserStream) readMessages() {
	defer s.wg.Done()

	backoff := time.Second
	maxBackoff := 60 * time.Second

	for {
		select {
		case <-s.stopCh:
			return
		default:
		}

		s.mu.Lock()
		conn := s.conn
		s.mu.Unlock()

		if conn == nil {
			time.Sleep(backoff)
			continue
		}

		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure) {
				return
			}

			select {
			case <-s.stopCh:
				return
			default:
			}

			// Reconnect with exponential backoff
			logger.Warnf("🔌 [UserStream] Read error: %v, reconnecting in %v", err, backoff)
			time.Sleep(backoff)
			backoff = time.Duration(float64(backoff) * 1.5)
			if backoff > maxBackoff {
				backoff = maxBackoff
			}

			if err := s.reconnect(); err != nil {
				logger.Warnf("🔌 [UserStream] Reconnect failed: %v", err)
			} else {
				backoff = time.Second // reset on success
			}
			continue
		}

		backoff = time.Second // reset on successful read
		s.handleMessage(message)
	}
}

func (s *BinanceUserStream) handleMessage(data []byte) {
	var msg map[string]interface{}
	if err := json.Unmarshal(data, &msg); err != nil {
		return
	}

	eventType, _ := msg["e"].(string)

	switch eventType {
	case "ORDER_TRADE_UPDATE":
		s.handleOrderUpdate(msg)
	case "ACCOUNT_UPDATE":
		s.handleAccountUpdate(msg)
	}
}

func (s *BinanceUserStream) handleOrderUpdate(msg map[string]interface{}) {
	if s.OnOrderUpdate == nil {
		return
	}

	order, ok := msg["o"].(map[string]interface{})
	if !ok {
		return
	}

	event := OrderUpdateEvent{
		Symbol:       wsGetStr(order, "s"),
		OrderID:      wsGetStr(order, "i"),
		Side:         wsGetStr(order, "S"),
		OrderType:    wsGetStr(order, "o"),
		Status:       wsGetStr(order, "X"),
		FilledQty:    wsGetFloat(order, "l"),
		FilledPrice:  wsGetFloat(order, "L"),
		Commission:   wsGetFloat(order, "n"),
		RealizedPnL:  wsGetFloat(order, "rp"),
		PositionSide: wsGetStr(order, "ps"),
		ReduceOnly:   wsGetStr(order, "R") == "true",
	}

	s.OnOrderUpdate(event)
}

func (s *BinanceUserStream) handleAccountUpdate(msg map[string]interface{}) {
	if s.OnAccountUpdate == nil {
		return
	}

	a, ok := msg["a"].(map[string]interface{})
	if !ok {
		return
	}

	event := AccountUpdateEvent{
		EventReason: wsGetStr(a, "m"),
	}

	// Parse position updates
	if positions, ok := a["P"].([]interface{}); ok {
		for _, p := range positions {
			if pm, ok := p.(map[string]interface{}); ok {
				event.Positions = append(event.Positions, PositionUpdateEvent{
					Symbol:        wsGetStr(pm, "s"),
					Quantity:      wsGetFloat(pm, "pa"),
					EntryPrice:    wsGetFloat(pm, "ep"),
					UnrealizedPnL: wsGetFloat(pm, "up"),
					MarginType:    wsGetStr(pm, "mt"),
				})
			}
		}
	}

	s.OnAccountUpdate(event)
}

// ─── Keep-alive and reconnect ───────────────────────────────────────────────

func (s *BinanceUserStream) keepAlive() {
	defer s.wg.Done()

	ticker := time.NewTicker(30 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			if err := s.extendListenKey(); err != nil {
				logger.Warnf("🔌 [UserStream] Failed to extend listen key: %v", err)
			}
		}
	}
}

func (s *BinanceUserStream) reconnect() error {
	s.mu.Lock()
	if s.conn != nil {
		s.conn.Close()
		s.conn = nil
	}
	s.mu.Unlock()

	// Try to extend existing key first, create new if that fails
	if err := s.extendListenKey(); err != nil {
		key, err := s.createListenKey()
		if err != nil {
			return err
		}
		s.listenKey = key
	}

	return s.connect()
}

// ─── Binance API calls ──────────────────────────────────────────────────────

func (s *BinanceUserStream) createListenKey() (string, error) {
	req, err := http.NewRequest("POST", s.baseURL+"/fapi/v1/listenKey", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("X-MBX-APIKEY", s.apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		ListenKey string `json:"listenKey"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}
	return result.ListenKey, nil
}

func (s *BinanceUserStream) extendListenKey() error {
	body := strings.NewReader("listenKey=" + s.listenKey)
	req, err := http.NewRequest("PUT", s.baseURL+"/fapi/v1/listenKey", body)
	if err != nil {
		return err
	}
	req.Header.Set("X-MBX-APIKEY", s.apiKey)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// ─── JSON helpers ───────────────────────────────────────────────────────────

func wsGetStr(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		switch val := v.(type) {
		case string:
			return val
		case float64:
			return fmt.Sprintf("%.0f", val)
		}
	}
	return ""
}

func wsGetFloat(m map[string]interface{}, key string) float64 {
	if v, ok := m[key]; ok {
		switch val := v.(type) {
		case float64:
			return val
		case string:
			var f float64
			fmt.Sscanf(val, "%f", &f)
			return f
		}
	}
	return 0
}
