// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package market

import (
	"math"
	"testing"
)

// 构造一组合理的 K 线数据用于 ATR 测试
func buildKlinesForATR(n int) []Kline {
	klines := make([]Kline, n)
	for i := 0; i < n; i++ {
		base := 100.0 + float64(i)*0.5
		klines[i] = Kline{
			Open:  base,
			High:  base + 2,
			Low:   base - 2,
			Close: base + 0.5,
		}
	}
	return klines
}

// TestCalculateATRSeries_NotEnoughKlines 验证 K 线不足时返回 nil
func TestCalculateATRSeries_NotEnoughKlines(t *testing.T) {
	if got := calculateATRSeries(buildKlinesForATR(10), 14); got != nil {
		t.Errorf("klines<period+1 应返回 nil, 实际 %v", got)
	}
	if got := calculateATRSeries(buildKlinesForATR(14), 14); got != nil {
		t.Errorf("klines==period 应返回 nil, 实际 %v", got)
	}
}

// TestCalculateATRSeries_LengthMatches 验证序列长度 = len(klines) - period
func TestCalculateATRSeries_LengthMatches(t *testing.T) {
	klines := buildKlinesForATR(50)
	period := 14
	series := calculateATRSeries(klines, period)
	expected := len(klines) - period
	if len(series) != expected {
		t.Errorf("序列长度期望 %d, 实际 %d", expected, len(series))
	}
}

// TestCalculateATRSeries_LastEqualsLatest 验证序列最后一个值 == calculateATR
func TestCalculateATRSeries_LastEqualsLatest(t *testing.T) {
	klines := buildKlinesForATR(80)
	period := 14
	series := calculateATRSeries(klines, period)
	latest := calculateATR(klines, period)

	if len(series) == 0 {
		t.Fatal("series 不应为空")
	}
	last := series[len(series)-1]
	if math.Abs(last-latest) > 1e-9 {
		t.Errorf("序列末值 %.10f 应等于 latest %.10f", last, latest)
	}
}

// TestCalculateATRSeries_AllPositive 验证所有 ATR 值非负
func TestCalculateATRSeries_AllPositive(t *testing.T) {
	klines := buildKlinesForATR(60)
	series := calculateATRSeries(klines, 14)
	for i, v := range series {
		if v < 0 {
			t.Errorf("ATR 序列 [%d] 不应为负: %.4f", i, v)
		}
	}
}

// TestIntradaySeries_HasATR14Values 验证 IntradayData 包含 ATR14Values
func TestIntradaySeries_HasATR14Values(t *testing.T) {
	klines := buildKlinesForATR(60)
	data := calculateIntradaySeries(klines)
	if data == nil {
		t.Fatal("calculateIntradaySeries 不应返回 nil")
	}
	if len(data.ATR14Values) == 0 {
		t.Error("IntradayData.ATR14Values 应有值")
	}
	if data.ATR14 <= 0 {
		t.Error("ATR14 latest 应为正")
	}
	// 末值应等于 latest
	last := data.ATR14Values[len(data.ATR14Values)-1]
	if math.Abs(last-data.ATR14) > 1e-9 {
		t.Errorf("ATR14Values 末值 %.6f 应等于 ATR14 %.6f", last, data.ATR14)
	}
}

// TestTimeframeSeries_HasATR14Values 验证 TimeframeSeriesData 包含 ATR14Values
func TestTimeframeSeries_HasATR14Values(t *testing.T) {
	klines := buildKlinesForATR(80)
	data := calculateTimeframeSeries(klines, "15m", 30)
	if data == nil {
		t.Fatal("calculateTimeframeSeries 不应返回 nil")
	}
	if len(data.ATR14Values) == 0 {
		t.Error("TimeframeSeriesData.ATR14Values 应有值")
	}
	if data.ATR14 <= 0 {
		t.Error("ATR14 latest 应为正")
	}
	// 末值应等于 latest
	last := data.ATR14Values[len(data.ATR14Values)-1]
	if math.Abs(last-data.ATR14) > 1e-9 {
		t.Errorf("ATR14Values 末值 %.6f 应等于 ATR14 %.6f", last, data.ATR14)
	}
}
