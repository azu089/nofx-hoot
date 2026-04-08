package token_guard

import (
	"testing"

	"nofx/store"
)

func TestEvaluate_NilConfig(t *testing.T) {
	v := Evaluate(nil, "deepseek")
	if v.Level != LevelOK || v.ShouldBlock {
		t.Error("nil config 应返回 ok 且不阻塞")
	}
}

func TestEvaluate_DefaultConfigOK(t *testing.T) {
	cfg := store.GetDefaultStrategyConfig("en")
	v := Evaluate(&cfg, "deepseek")
	if v.ShouldBlock {
		t.Errorf("默认配置不应触发阻塞: %+v", v)
	}
	if v.EstimatedTok <= 0 {
		t.Error("EstimatedTok 应为正")
	}
	if v.ContextLimit <= 0 {
		t.Error("ContextLimit 应为正")
	}
}

func TestEvaluate_UnknownProviderUsesDefault(t *testing.T) {
	cfg := store.GetDefaultStrategyConfig("en")
	v := Evaluate(&cfg, "")
	if v.ContextLimit <= 0 {
		t.Error("未知 provider 应回退到默认 limit")
	}
}

func TestEvaluate_LevelClassification(t *testing.T) {
	// 构造一个夸张配置压爆 token —— 大量静态币种 + 长 K 线 + 全指标
	cfg := store.GetDefaultStrategyConfig("en")
	cfg.CoinSource.SourceType = "static"
	cfg.CoinSource.StaticCoins = make([]string, 500)
	for i := range cfg.CoinSource.StaticCoins {
		cfg.CoinSource.StaticCoins[i] = "COIN" + string(rune('A'+(i%26)))
	}
	cfg.Indicators.Klines.PrimaryCount = 2000
	cfg.Indicators.EnableEMA = true
	cfg.Indicators.EnableMACD = true
	cfg.Indicators.EnableRSI = true
	cfg.Indicators.EnableATR = true
	cfg.Indicators.EnableBOLL = true

	v := Evaluate(&cfg, "deepseek")
	if !v.ShouldBlock {
		t.Errorf("超量 token 应触发 block: %+v", v)
	}
	if v.Level != LevelDanger {
		t.Errorf("超量 token 应为 danger 级，实际 %s", v.Level)
	}
}

func TestVerdict_Reason(t *testing.T) {
	cfg := store.GetDefaultStrategyConfig("en")
	v := Evaluate(&cfg, "deepseek")
	if v.Reason == "" && v.Level != LevelOK {
		t.Error("非 ok 级应有 Reason 描述")
	}
}
