package binance_data

import (
	"fmt"
	"strconv"
)

// rawPremiumIndex maps /fapi/v1/premiumIndex.
type rawPremiumIndex struct {
	Symbol          string `json:"symbol"`
	MarkPrice       string `json:"markPrice"`
	LastFundingRate string `json:"lastFundingRate"`
	NextFundingTime int64  `json:"nextFundingTime"`
}

// GetFundingRate returns the latest funding rate for a single symbol.
func (c *Client) GetFundingRate(symbol string) (*FundingRate, error) {
	if symbol == "" {
		return nil, fmt.Errorf("symbol is required")
	}
	path := fmt.Sprintf("/fapi/v1/premiumIndex?symbol=%s", symbol)
	var raw rawPremiumIndex
	if err := c.doGet(path, &raw); err != nil {
		return nil, err
	}
	rate, _ := strconv.ParseFloat(raw.LastFundingRate, 64)
	mark, _ := strconv.ParseFloat(raw.MarkPrice, 64)
	return &FundingRate{
		Symbol:      raw.Symbol,
		Rate:        rate,
		MarkPrice:   mark,
		NextFunding: raw.NextFundingTime,
	}, nil
}
