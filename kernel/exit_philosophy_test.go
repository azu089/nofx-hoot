package kernel

import (
	"strings"
	"testing"

	"nofx/store"
)

func TestGetExitGuidanceZH_DefaultsToMechanical(t *testing.T) {
	// 空字符串应回退到 mechanical
	if got := getExitGuidanceZH(""); !strings.Contains(got, "EMA趋势反转") {
		t.Errorf("空 philosophy 应回退 mechanical（含 EMA 趋势反转）, got: %q", got[:80])
	}
	if got := getExitGuidanceZH("nope"); !strings.Contains(got, "EMA趋势反转") {
		t.Error("未知 philosophy 应回退 mechanical")
	}
}

func TestGetExitGuidanceZH_SignalDriven(t *testing.T) {
	got := getExitGuidanceZH("signal_driven")
	if !strings.Contains(got, "禁止") {
		t.Error("signal_driven 应包含禁止机械平仓")
	}
	if !strings.Contains(got, "趋势完好") {
		t.Error("signal_driven 应强调趋势持有")
	}
}

func TestGetExitGuidanceZH_Hybrid(t *testing.T) {
	got := getExitGuidanceZH("hybrid")
	if !strings.Contains(got, "硬止损底线") {
		t.Error("hybrid 应包含硬止损底线")
	}
	if !strings.Contains(got, "信号驱动") {
		t.Error("hybrid 应包含信号驱动")
	}
}

func TestGetExitGuidanceEN_DefaultsToMechanical(t *testing.T) {
	if got := getExitGuidanceEN(""); !strings.Contains(got, "Signal-Driven Exit") {
		t.Error("空 philosophy 应回退 mechanical")
	}
}

func TestGetExitGuidanceEN_SignalDriven(t *testing.T) {
	got := getExitGuidanceEN("signal_driven")
	if !strings.Contains(got, "Never") {
		t.Error("signal_driven 应包含 Never 关键字")
	}
}

func TestGetExitGuidanceEN_Hybrid(t *testing.T) {
	got := getExitGuidanceEN("hybrid")
	if !strings.Contains(got, "Hard stop floor") {
		t.Error("hybrid 应包含 Hard stop floor")
	}
}

func TestPromptBuilder_WithPhilosophy(t *testing.T) {
	pb := NewPromptBuilder(LangChinese)
	if pb.effectivePhilosophy() != "mechanical" {
		t.Error("默认应为 mechanical")
	}

	pb.WithPhilosophy("signal_driven")
	if pb.effectivePhilosophy() != "signal_driven" {
		t.Error("WithPhilosophy 设置后应生效")
	}

	pb.WithPhilosophy("nonsense")
	if pb.effectivePhilosophy() != "mechanical" {
		t.Error("无效值应回退 mechanical")
	}
}

func TestPromptBuilder_BuildSystemPrompt_PhilosophyApplied(t *testing.T) {
	pbZH := NewPromptBuilder(LangChinese).WithPhilosophy("signal_driven")
	got := pbZH.BuildSystemPrompt()
	if !strings.Contains(got, "禁止") {
		t.Error("system prompt 应包含 signal_driven 关键字")
	}
	if strings.Contains(got, "__EXIT_GUIDANCE_ZH__") {
		t.Error("占位符应被替换")
	}

	pbEN := NewPromptBuilder(LangEnglish).WithPhilosophy("hybrid")
	gotEN := pbEN.BuildSystemPrompt()
	if !strings.Contains(gotEN, "Hard stop floor") {
		t.Error("EN system prompt 应包含 hybrid 关键字")
	}
	if strings.Contains(gotEN, "__EXIT_GUIDANCE_EN__") {
		t.Error("EN 占位符应被替换")
	}
}

func TestPromptBuilder_BuildSystemPrompt_DefaultMechanical(t *testing.T) {
	pb := NewPromptBuilder(LangChinese) // 不调 WithPhilosophy
	got := pb.BuildSystemPrompt()
	if !strings.Contains(got, "EMA趋势反转") {
		t.Error("默认应包含 mechanical 文本")
	}
	if strings.Contains(got, "__EXIT_GUIDANCE_") {
		t.Error("占位符必须被替换")
	}
}

// TestStrategyEngine_ExitPhilosophyInjection 验证 engine_prompt.go 的注入路径
func TestStrategyEngine_ExitPhilosophyInjection(t *testing.T) {
	signalDriven := "signal_driven"
	cfg := &store.StrategyConfig{
		Language:       "en",
		ExitPhilosophy: &signalDriven,
	}
	engine := NewStrategyEngine(cfg)
	prompt := engine.BuildSystemPrompt(1000.0, "")

	if !strings.Contains(prompt, "Exit Philosophy") {
		t.Error("启用 ExitPhilosophy 时 system prompt 应含 Exit Philosophy 段")
	}
	if !strings.Contains(prompt, "Never") {
		t.Error("signal_driven 内容应被注入")
	}
}

func TestStrategyEngine_ExitPhilosophyDefaultNoInjection(t *testing.T) {
	cfg := &store.StrategyConfig{
		Language: "en",
		// ExitPhilosophy: nil
	}
	engine := NewStrategyEngine(cfg)
	prompt := engine.BuildSystemPrompt(1000.0, "")

	if strings.Contains(prompt, "Exit Philosophy") {
		t.Error("nil ExitPhilosophy 时不应注入新段")
	}
}

func TestStrategyEngine_ExitPhilosophyMechanicalNoInjection(t *testing.T) {
	mech := "mechanical"
	cfg := &store.StrategyConfig{
		Language:       "en",
		ExitPhilosophy: &mech,
	}
	engine := NewStrategyEngine(cfg)
	prompt := engine.BuildSystemPrompt(1000.0, "")

	if strings.Contains(prompt, "Exit Philosophy") {
		t.Error("mechanical 时不应注入新段（避免重复）")
	}
}
