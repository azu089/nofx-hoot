package pretrade

import "testing"

func TestDefaultSimulator_Allow(t *testing.T) {
	sim := NewDefaultSimulator()
	v := sim.Simulate(SimRequest{
		Symbol:          "BTCUSDT",
		Side:            "long",
		Quantity:        0.01,
		Price:           60000,
		Leverage:        5,
		AvailableMargin: 1000,
		MarkPrice:       60000,
	})
	if !v.Allow {
		t.Errorf("正常请求应放行, 实际拒绝: %s", v.Reason)
	}
	if v.EstMarginUSD == 0 {
		t.Error("EstMarginUSD 应被填充")
	}
}

func TestDefaultSimulator_RejectInvalidInput(t *testing.T) {
	sim := NewDefaultSimulator()
	if v := sim.Simulate(SimRequest{Quantity: 0, Price: 100}); v.Allow {
		t.Error("Quantity=0 应拒绝")
	}
	if v := sim.Simulate(SimRequest{Quantity: 1, Price: 0}); v.Allow {
		t.Error("Price=0 应拒绝")
	}
}

func TestDefaultSimulator_RejectExcessiveLeverage(t *testing.T) {
	sim := &DefaultSimulator{MaxLeverage: 20}
	v := sim.Simulate(SimRequest{
		Quantity: 0.01,
		Price:    60000,
		Leverage: 50,
	})
	if v.Allow {
		t.Error("超过 MaxLeverage 应拒绝")
	}
}

func TestDefaultSimulator_RejectBelowMinOrder(t *testing.T) {
	sim := NewDefaultSimulator() // MinOrderUSD = 5
	v := sim.Simulate(SimRequest{
		Quantity:        0.0001,
		Price:           10, // notional 0.001 < 5
		Leverage:        1,
		AvailableMargin: 1000,
	})
	if v.Allow {
		t.Error("低于 MinOrderUSD 应拒绝")
	}
}

func TestDefaultSimulator_RejectInsufficientMargin(t *testing.T) {
	sim := NewDefaultSimulator()
	v := sim.Simulate(SimRequest{
		Quantity:        1, // notional = 60000
		Price:           60000,
		Leverage:        1, // requiredMargin = 60000
		AvailableMargin: 1000,
	})
	if v.Allow {
		t.Errorf("保证金不足应拒绝, 实际放行 EstMargin=%.2f", v.EstMarginUSD)
	}
}

func TestDefaultSimulator_MarginBuffer(t *testing.T) {
	sim := NewDefaultSimulator() // 0.95 buffer
	// requiredMargin = 100, available = 100, buffer 0.95 → required > 95 → reject
	v := sim.Simulate(SimRequest{
		Quantity:        1,
		Price:           1000,
		Leverage:        10,
		AvailableMargin: 100,
	})
	if v.Allow {
		t.Error("保证金 == required 但 buffer 不够应拒绝")
	}
}

func TestDefaultSimulator_NoAvailableMarginPasses(t *testing.T) {
	// AvailableMargin == 0 → 跳过 margin 检查（用于测试 / 上游未提供）
	sim := NewDefaultSimulator()
	v := sim.Simulate(SimRequest{
		Quantity: 0.01,
		Price:    60000,
		Leverage: 5,
		// AvailableMargin: 0
	})
	if !v.Allow {
		t.Errorf("AvailableMargin=0 时应跳过 margin 检查放行: %s", v.Reason)
	}
}

func TestNoopSimulator(t *testing.T) {
	sim := NoopSimulator{}
	v := sim.Simulate(SimRequest{Quantity: 0, Price: 0}) // 输入再差也放行
	if !v.Allow {
		t.Error("NoopSimulator 应永远放行")
	}
}

func TestDefaultSimulator_LeverageZeroDefaultsToOne(t *testing.T) {
	sim := NewDefaultSimulator()
	v := sim.Simulate(SimRequest{
		Quantity:        0.01,
		Price:           60000,
		Leverage:        0, // → 默认 1
		AvailableMargin: 1000,
	})
	// notional 600, leverage 1, requiredMargin 600 > 1000*0.95=950 → allow
	if !v.Allow {
		t.Errorf("Leverage=0 应当作 1 处理: %s", v.Reason)
	}
}
