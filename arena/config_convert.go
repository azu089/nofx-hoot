package arena

import "nofx/store"

// ArenaConfigFromStore 将 store.ArenaStrategyConfig 转换为 arena.ArenaConfig
// 策略层只包含辩论配置；AI模型/杠杆/仓位大小由交易员层在运行时填充
func ArenaConfigFromStore(sc *store.ArenaStrategyConfig) *ArenaConfig {
	if sc == nil {
		return DefaultArenaConfig()
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

	return cfg
}
