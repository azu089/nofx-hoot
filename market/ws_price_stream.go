// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package market

// ws_price_stream.go — WebSocket real-time price stream.
//
// Connects to Binance USDM markPrice stream for real-time price monitoring.
// Used by the RealtimeRiskGuard to detect risk conditions between runCycle intervals.

import (
	"encoding/json"
	"fmt"
	"strconv"
	"sync"
	"time"

	"nofx/logger"

	"github.com/gorilla/websocket"
)

// ─── PriceStream ────────────────────────────────────────────────────────────

// PriceStream manages a WebSocket connection to the exchange's markPrice stream.
type PriceStream struct {
	wsURL  string // e.g. "wss://fstream.binance.com"
	conn   *websocket.Conn
	stopCh chan struct{}
	wg     sync.WaitGroup
	mu     sync.Mutex

	// Symbol filter — only process these symbols (nil = all)
	subscribedMu sync.RWMutex
	subscribed   map[string]bool

	// Callback
	OnPriceUpdate func(symbol string, price float64, timestamp int64)

	// Health monitoring
	lastMessageAt  time.Time
	lastMessageMu  sync.Mutex
	healthTimeout  time.Duration // default 30s
}

// NewPriceStream creates a new price stream. Set testnet=true for demo endpoints.
func NewPriceStream(testnet bool) *PriceStream {
	wsURL := "wss://fstream.binance.com"
	if testnet {
		wsURL = "wss://demo-fstream.binance.com"
	}
	return &PriceStream{
		wsURL:         wsURL,
		stopCh:        make(chan struct{}),
		subscribed:    make(map[string]bool),
		healthTimeout: 30 * time.Second,
	}
}

// SubscribeSymbols sets the symbol filter. Only prices for these symbols will be dispatched.
func (ps *PriceStream) SubscribeSymbols(symbols []string) {
	ps.subscribedMu.Lock()
	defer ps.subscribedMu.Unlock()
	ps.subscribed = make(map[string]bool, len(symbols))
	for _, s := range symbols {
		ps.subscribed[s] = true
	}
}

// Start connects to the markPrice stream and begins reading.
func (ps *PriceStream) Start() error {
	if err := ps.connect(); err != nil {
		return err
	}

	ps.wg.Add(1)
	go ps.readLoop()

	ps.wg.Add(1)
	go ps.healthCheck()

	logger.Infof("📡 [PriceStream] Started (%s)", ps.wsURL)
	return nil
}

// Stop gracefully closes the price stream.
func (ps *PriceStream) Stop() {
	ps.mu.Lock()
	defer ps.mu.Unlock()

	select {
	case <-ps.stopCh:
		return
	default:
		close(ps.stopCh)
	}

	if ps.conn != nil {
		ps.conn.Close()
	}
	ps.wg.Wait()
	logger.Infof("📡 [PriceStream] Stopped")
}

// ─── Connection management ──────────────────────────────────────────────────

func (ps *PriceStream) connect() error {
	// Binance aggregated markPrice stream: all contracts, 1s interval
	url := ps.wsURL + "/ws/!markPrice@arr@1s"

	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		return fmt.Errorf("websocket dial failed: %w", err)
	}

	ps.mu.Lock()
	ps.conn = conn
	ps.mu.Unlock()

	ps.lastMessageMu.Lock()
	ps.lastMessageAt = time.Now()
	ps.lastMessageMu.Unlock()

	logger.Infof("📡 [PriceStream] WebSocket connected to markPrice stream")
	return nil
}

func (ps *PriceStream) readLoop() {
	defer ps.wg.Done()

	backoff := time.Second
	maxBackoff := 60 * time.Second

	for {
		select {
		case <-ps.stopCh:
			return
		default:
		}

		ps.mu.Lock()
		conn := ps.conn
		ps.mu.Unlock()

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
			case <-ps.stopCh:
				return
			default:
			}

			logger.Warnf("📡 [PriceStream] Read error: %v, reconnecting in %v", err, backoff)
			time.Sleep(backoff)
			backoff = time.Duration(float64(backoff) * 2)
			if backoff > maxBackoff {
				backoff = maxBackoff
			}

			if err := ps.reconnect(); err != nil {
				logger.Warnf("📡 [PriceStream] Reconnect failed: %v", err)
			} else {
				backoff = time.Second
			}
			continue
		}

		backoff = time.Second
		ps.lastMessageMu.Lock()
		ps.lastMessageAt = time.Now()
		ps.lastMessageMu.Unlock()

		ps.handleMessage(message)
	}
}

// handleMessage parses the markPrice array message.
// Format: [{"e":"markPriceUpdate","s":"BTCUSDT","p":"69500.00","T":1234567890000}, ...]
func (ps *PriceStream) handleMessage(data []byte) {
	if ps.OnPriceUpdate == nil {
		return
	}

	var items []markPriceItem
	if err := json.Unmarshal(data, &items); err != nil {
		// Try single object (some streams send single updates)
		var single markPriceItem
		if err2 := json.Unmarshal(data, &single); err2 == nil {
			items = []markPriceItem{single}
		} else {
			return
		}
	}

	ps.subscribedMu.RLock()
	filterActive := len(ps.subscribed) > 0
	ps.subscribedMu.RUnlock()

	for _, item := range items {
		if filterActive {
			ps.subscribedMu.RLock()
			wanted := ps.subscribed[item.Symbol]
			ps.subscribedMu.RUnlock()
			if !wanted {
				continue
			}
		}

		price, err := strconv.ParseFloat(item.Price, 64)
		if err != nil || price <= 0 {
			continue
		}

		// Non-blocking callback (must be fast)
		ps.OnPriceUpdate(item.Symbol, price, item.Time)
	}
}

func (ps *PriceStream) healthCheck() {
	defer ps.wg.Done()

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ps.stopCh:
			return
		case <-ticker.C:
			ps.lastMessageMu.Lock()
			last := ps.lastMessageAt
			ps.lastMessageMu.Unlock()

			if !last.IsZero() && time.Since(last) > ps.healthTimeout {
				logger.Warnf("📡 [PriceStream] No message for %v, reconnecting", ps.healthTimeout)
				if err := ps.reconnect(); err != nil {
					logger.Warnf("📡 [PriceStream] Health reconnect failed: %v", err)
				}
			}
		}
	}
}

func (ps *PriceStream) reconnect() error {
	ps.mu.Lock()
	if ps.conn != nil {
		ps.conn.Close()
		ps.conn = nil
	}
	ps.mu.Unlock()

	return ps.connect()
}

// ─── Message types ──────────────────────────────────────────────────────────

type markPriceItem struct {
	Event  string `json:"e"` // "markPriceUpdate"
	Symbol string `json:"s"` // "BTCUSDT"
	Price  string `json:"p"` // "69500.00"
	Time   int64  `json:"T"` // timestamp ms
}
