package arena

import "nofx/store"

// ArenaConfigFromStore 将 store.ArenaStrategyConfig 转换为 arena.ArenaConfig
// 策略层只包含辩论配置；AI模型/仓位大小由交易员层在运行时填充
// rc 是父层 StrategyConfig.RiskControl，用于映射 MaxLeverage（可为 nil）
func ArenaConfigFromStore(sc *store.ArenaStrategyConfig, rc *store.RiskControlConfig) *ArenaConfig {
	if sc == nil {
		cfg := DefaultArenaConfig()
		applyRiskControlLeverage(cfg, rc)
		return cfg
	}

	cfg := &ArenaConfig{
		Symbols:           sc.Symbols,
		SelectedAnalysts:  sc.SelectedAnalysts,
		MaxDebateRounds:   sc.MaxDebateRounds,
		MaxRiskRounds:     sc.MaxRiskRounds,
		RiskPreference:    sc.RiskPreference,
		MaxPositions:      sc.MaxPositions,
		PositionSizeRatio: sc.PositionSizeRatio,
		MaxMarginUsage:    sc.MaxMarginUsage,
		MinRiskReward:     sc.MinRiskReward,
		MinConfidence:     sc.MinConfidence,
	}

	// 填充缺省值
	if len(cfg.Symbols) == 0 {
		cfg.Symbols = []string{"BTCUSDT"}
	}
	if len(cfg.SelectedAnalysts) == 0 {
		cfg.SelectedAnalysts = []string{AnalystMarket, AnalystSocial, AnalystNews, AnalystFundamentals}
	}
	if cfg.MaxDebateRounds <= 0 {
		cfg.MaxDebateRounds = 1
	}
	if cfg.MaxRiskRounds <= 0 {
		cfg.MaxRiskRounds = 1
	}
	if cfg.RiskPreference == "" {
		cfg.RiskPreference = RiskBalanced
	}
	// 风控约束默认值
	if cfg.MaxPositions <= 0 {
		cfg.MaxPositions = 3
	}
	if cfg.PositionSizeRatio <= 0 {
		cfg.PositionSizeRatio = 0.3
	}
	if cfg.MaxMarginUsage <= 0 {
		cfg.MaxMarginUsage = 0.8
	}
	if cfg.MinRiskReward <= 0 {
		cfg.MinRiskReward = 1.5
	}
	if cfg.MinConfidence <= 0 {
		cfg.MinConfidence = 60
	}

	// 以下字段使用默认值，运行时由交易员层覆盖
	cfg.IntervalMinutes = 30
	cfg.DeepThinkModel = "gpt-4o"
	cfg.QuickThinkModel = "gpt-4o-mini"
	cfg.MaxLeverage = 3
	cfg.PositionSizeUSD = 1000
	cfg.OutputLanguage = "Chinese"

	// 从父层 RiskControl 映射 leverage 上限，覆盖默认 3
	applyRiskControlLeverage(cfg, rc)

	return cfg
}

// applyRiskControlLeverage 从 RiskControl 映射 leverage 上限到 ArenaConfig。
// 优先 BTC/ETH 杠杆(Arena 通常交易主流币)，否则 altcoin 杠杆，再否则保留传入默认。
// 最终双重保险：如果 MaxLeverage 仍 <= 0，兜底为 3。
func applyRiskControlLeverage(cfg *ArenaConfig, rc *store.RiskControlConfig) {
	if rc != nil {
		if rc.BTCETHMaxLeverage > 0 {
			cfg.MaxLeverage = rc.BTCETHMaxLeverage
		} else if rc.AltcoinMaxLeverage > 0 {
			cfg.MaxLeverage = rc.AltcoinMaxLeverage
		}
	}
	if cfg.MaxLeverage <= 0 {
		cfg.MaxLeverage = 3
	}
}
