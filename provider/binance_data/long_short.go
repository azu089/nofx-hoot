package binance_data

import (
	"fmt"
	"strconv"
)

// rawLSR maps /futures/data/globalLongShortAccountRatio entries.
type rawLSR struct {
	Symbol         string `json:"symbol"`
	LongAccount    string `json:"longAccount"`
	ShortAccount   string `json:"shortAccount"`
	LongShortRatio string `json:"longShortRatio"`
	Timestamp      int64  `json:"timestamp"`
}

// GetLongShortRatio returns the latest global long/short account ratio for
// a single symbol over a given period (e.g. "5m", "15m", "1h", "4h", "1d").
func (c *Client) GetLongShortRatio(symbol, period string) (*LongShortRatio, error) {
	if symbol == "" {
		return nil, fmt.Errorf("symbol is required")
	}
	if period == "" {
		period = "1h"
	}
	path := fmt.Sprintf("/futures/data/globalLongShortAccountRatio?symbol=%s&period=%s&limit=1", symbol, period)
	var raw []rawLSR
	if err := c.doGet(path, &raw); err != nil {
		return nil, err
	}
	if len(raw) == 0 {
		return nil, fmt.Errorf("no LSR data for %s", symbol)
	}
	r := raw[len(raw)-1]
	long, _ := strconv.ParseFloat(r.LongAccount, 64)
	short, _ := strconv.ParseFloat(r.ShortAccount, 64)
	ratio, _ := strconv.ParseFloat(r.LongShortRatio, 64)
	return &LongShortRatio{
		Symbol:     r.Symbol,
		LongRatio:  long,
		ShortRatio: short,
		Ratio:      ratio,
		Timestamp:  r.Timestamp,
	}, nil
}
