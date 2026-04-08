package trader

import "testing"

func TestResolvePartialPct_Defaults(t *testing.T) {
	cases := []struct {
		in  float64
		out float64
	}{
		{0, defaultPartialPct},
		{-0.1, defaultPartialPct},
		{0.5, 0.5},
		{0.99, 0.99},
		{1.0, 1.0},
		{1.5, 1.0},  // clamp
		{100, 1.0},  // clamp
	}
	for _, c := range cases {
		if got := resolvePartialPct(c.in); got != c.out {
			t.Errorf("resolvePartialPct(%v) = %v, 期望 %v", c.in, got, c.out)
		}
	}
}

func TestIsSizedAdjustAction(t *testing.T) {
	yes := []string{"reduce_long", "reduce_short", "scale_long", "scale_short"}
	no := []string{"open_long", "open_short", "close_long", "close_short", "hold", "wait", "", "place_buy_limit"}

	for _, a := range yes {
		if !IsSizedAdjustAction(a) {
			t.Errorf("%q 应被识别为 sized adjust action", a)
		}
	}
	for _, a := range no {
		if IsSizedAdjustAction(a) {
			t.Errorf("%q 不应被识别为 sized adjust action", a)
		}
	}
}
