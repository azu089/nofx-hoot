package kernel

import (
	"strings"
	"testing"

	"nofx/store"
)

// TestSystemPrompt_DefaultExcludesSizedActions 验证默认 prompt 不暴露 sized actions
// 任务: P2-5 System Prompt 重构 (HOOT nofx 升级 2026-04)
//
// 关键回归：旧策略不能因为 schema 扩展而 prompt 变化
func TestSystemPrompt_DefaultExcludesSizedActions(t *testing.T) {
	cfg := &store.StrategyConfig{Language: "en"}
	engine := NewStrategyEngine(cfg)
	prompt := engine.BuildSystemPrompt(1000.0, "")

	if strings.Contains(prompt, "reduce_long") {
		t.Error("默认配置 prompt 不应包含 reduce_long")
	}
	if strings.Contains(prompt, "scale_short") {
		t.Error("默认配置 prompt 不应包含 scale_short")
	}
	if strings.Contains(prompt, "partial_pct") {
		t.Error("默认配置 prompt 不应包含 partial_pct")
	}
}

func TestSystemPrompt_EnableSizedActionsExposesSchema(t *testing.T) {
	enabled := true
	cfg := &store.StrategyConfig{
		Language:           "en",
		EnableSizedActions: &enabled,
	}
	engine := NewStrategyEngine(cfg)
	prompt := engine.BuildSystemPrompt(1000.0, "")

	for _, kw := range []string{"reduce_long", "reduce_short", "scale_long", "scale_short", "partial_pct"} {
		if !strings.Contains(prompt, kw) {
			t.Errorf("启用 EnableSizedActions 后 prompt 应包含 %q", kw)
		}
	}
}

func TestSystemPrompt_DisabledSizedActionsExcludesSchema(t *testing.T) {
	disabled := false
	cfg := &store.StrategyConfig{
		Language:           "en",
		EnableSizedActions: &disabled,
	}
	engine := NewStrategyEngine(cfg)
	prompt := engine.BuildSystemPrompt(1000.0, "")

	if strings.Contains(prompt, "reduce_long") {
		t.Error("EnableSizedActions=false 时 prompt 不应包含 reduce_long")
	}
}
