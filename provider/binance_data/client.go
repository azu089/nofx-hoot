package binance_data

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

const (
	// FAPIBaseURL is Binance USDⓈ-M futures public REST root.
	FAPIBaseURL = "https://fapi.binance.com"
	// DefaultTimeout for individual HTTP requests.
	DefaultTimeout = 15 * time.Second
)

// Client is a tiny wrapper around the Binance public futures REST API.
// All endpoints used by this package are unauthenticated and rate-limited
// per IP, so a single shared client is fine for most callers.
type Client struct {
	BaseURL string
	HTTP    *http.Client
	mu      sync.RWMutex
}

var (
	defaultClient *Client
	clientOnce    sync.Once
)

// DefaultClient returns the package-wide singleton client.
func DefaultClient() *Client {
	clientOnce.Do(func() {
		defaultClient = NewClient("")
	})
	return defaultClient
}

// NewClient builds a new client. Empty baseURL defaults to FAPIBaseURL.
func NewClient(baseURL string) *Client {
	if baseURL == "" {
		baseURL = FAPIBaseURL
	}
	return &Client{
		BaseURL: baseURL,
		HTTP: &http.Client{
			Timeout: DefaultTimeout,
			Transport: &http.Transport{
				MaxIdleConns:        200,
				MaxIdleConnsPerHost: 64,
				MaxConnsPerHost:     64,
				IdleConnTimeout:     90 * time.Second,
				DisableCompression:  false,
			},
		},
	}
}

// isRetryableStatus reports whether an HTTP status code should trigger a single retry.
func isRetryableStatus(code int) bool {
	switch code {
	case 429, 500, 502, 503, 504:
		return true
	}
	return false
}

// SetTimeout updates the underlying HTTP client timeout.
func (c *Client) SetTimeout(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.HTTP.Timeout = d
}

// doGet issues a GET against base+path and decodes the JSON response into out.
func (c *Client) doGet(path string, out interface{}) error {
	c.mu.RLock()
	url := c.BaseURL + path
	httpClient := c.HTTP
	c.mu.RUnlock()

	// One-shot backoff retry for transient failures (network errors or 429/5xx).
	var resp *http.Response
	var body []byte
	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		if attempt > 0 {
			time.Sleep(500 * time.Millisecond)
		}
		var err error
		resp, err = httpClient.Get(url)
		if err != nil {
			lastErr = fmt.Errorf("binance_data GET %s: %w", path, err)
			continue
		}
		body, err = io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("binance_data read body: %w", err)
			continue
		}
		if isRetryableStatus(resp.StatusCode) {
			lastErr = fmt.Errorf("binance_data %s: HTTP %d: %s", path, resp.StatusCode, truncate(string(body), 200))
			continue
		}
		lastErr = nil
		break
	}
	if lastErr != nil {
		return lastErr
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("binance_data %s: HTTP %d: %s", path, resp.StatusCode, truncate(string(body), 200))
	}

	if out == nil {
		return nil
	}
	if err := json.Unmarshal(body, out); err != nil {
		return fmt.Errorf("binance_data decode %s: %w", path, err)
	}
	return nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
