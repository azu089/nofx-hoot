package kernel

import (
	"testing"
	"time"

	"nofx/feature_flag"
)

func newTestTracker() *ExitIntentTracker {
	return &ExitIntentTracker{
		entries:     map[string]*exitIntentEntry{},
		MinAttempts: 3,
		Window:      60 * time.Minute,
	}
}

func TestExitIntent_FirstBlockRecords(t *testing.T) {
	feature_flag.Reset()
	tr := newTestTracker()
	tr.RecordBlock("trader1", "BTCUSDT", "LONG", "EXIT_G2_HTF_ALIGNED")

	snap := tr.GetSnapshot("trader1", "BTCUSDT", "LONG")
	if snap == nil {
		t.Fatal("GetSnapshot 应返回条目")
	}
	if snap.Attempts != 1 {
		t.Errorf("期望 attempts=1, 实际 %d", snap.Attempts)
	}
	if snap.LastCode != "EXIT_G2_HTF_ALIGNED" {
		t.Errorf("期望 lastCode=EXIT_G2_HTF_ALIGNED, 实际 %s", snap.LastCode)
	}
}

func TestExitIntent_AccumulatesAttempts(t *testing.T) {
	feature_flag.Reset()
	tr := newTestTracker()
	for i := 0; i < 3; i++ {
		tr.RecordBlock("t1", "BTC", "LONG", "EXIT_G2")
	}
	snap := tr.GetSnapshot("t1", "BTC", "LONG")
	if snap.Attempts != 3 {
		t.Errorf("期望 attempts=3, 实际 %d", snap.Attempts)
	}
}

func TestExitIntent_ShouldEscapeAfterMinAttempts(t *testing.T) {
	feature_flag.Reset()
	tr := newTestTracker()

	// 前 2 次不触发
	tr.RecordBlock("t1", "BTC", "LONG", "G2")
	if tr.ShouldEscape("t1", "BTC", "LONG") {
		t.Error("1 次不应触发")
	}
	tr.RecordBlock("t1", "BTC", "LONG", "G2")
	if tr.ShouldEscape("t1", "BTC", "LONG") {
		t.Error("2 次不应触发")
	}

	// 第 3 次触发
	tr.RecordBlock("t1", "BTC", "LONG", "G2")
	if !tr.ShouldEscape("t1", "BTC", "LONG") {
		t.Error("3 次应触发")
	}

	// 连续触发只放行一次
	if tr.ShouldEscape("t1", "BTC", "LONG") {
		t.Error("已放行过一次不应连续触发")
	}
}

func TestExitIntent_RecordSuccessClears(t *testing.T) {
	feature_flag.Reset()
	tr := newTestTracker()
	for i := 0; i < 3; i++ {
		tr.RecordBlock("t1", "BTC", "LONG", "G2")
	}
	tr.RecordSuccess("t1", "BTC", "LONG")
	if snap := tr.GetSnapshot("t1", "BTC", "LONG"); snap != nil {
		t.Error("RecordSuccess 后条目应被清除")
	}
}

func TestExitIntent_WindowExpiry(t *testing.T) {
	feature_flag.Reset()
	tr := &ExitIntentTracker{
		entries:     map[string]*exitIntentEntry{},
		MinAttempts: 3,
		Window:      10 * time.Millisecond, // 极短窗口便于测试
	}

	tr.RecordBlock("t1", "BTC", "LONG", "G2")
	tr.RecordBlock("t1", "BTC", "LONG", "G2")

	time.Sleep(20 * time.Millisecond) // 超出窗口

	tr.RecordBlock("t1", "BTC", "LONG", "G2")
	snap := tr.GetSnapshot("t1", "BTC", "LONG")
	if snap.Attempts != 1 {
		t.Errorf("超窗口应重置为 1, 实际 %d", snap.Attempts)
	}
}

func TestExitIntent_IsolatesTraderSymbolSide(t *testing.T) {
	feature_flag.Reset()
	tr := newTestTracker()

	tr.RecordBlock("t1", "BTC", "LONG", "G2")
	tr.RecordBlock("t1", "BTC", "LONG", "G2")
	tr.RecordBlock("t1", "BTC", "LONG", "G2")

	// 同 trader 不同 symbol 不受影响
	if tr.ShouldEscape("t1", "ETH", "LONG") {
		t.Error("ETH 不应受 BTC 影响")
	}
	// 同 trader 同 symbol 不同 side 不受影响
	if tr.ShouldEscape("t1", "BTC", "SHORT") {
		t.Error("SHORT 不应受 LONG 影响")
	}
	// 不同 trader 不受影响
	if tr.ShouldEscape("t2", "BTC", "LONG") {
		t.Error("t2 不应受 t1 影响")
	}
	// 真正应触发的
	if !tr.ShouldEscape("t1", "BTC", "LONG") {
		t.Error("t1/BTC/LONG 应触发")
	}
}

func TestExitIntent_FeatureFlagOffDisables(t *testing.T) {
	feature_flag.Reset()
	feature_flag.SetSpec("exit_escape", "off")
	defer feature_flag.Reset()

	tr := newTestTracker()
	for i := 0; i < 10; i++ {
		tr.RecordBlock("t1", "BTC", "LONG", "G2")
	}
	if tr.ShouldEscape("t1", "BTC", "LONG") {
		t.Error("feature flag off 时永远不应触发逃生阀")
	}
}

func TestExitIntent_EmptyInputsNoOp(t *testing.T) {
	feature_flag.Reset()
	tr := newTestTracker()

	// 不应崩溃
	tr.RecordBlock("", "BTC", "LONG", "G2")
	tr.RecordBlock("t1", "", "LONG", "G2")
	tr.RecordBlock("t1", "BTC", "", "G2")
	if tr.ShouldEscape("", "BTC", "LONG") {
		t.Error("空 traderID 应 false")
	}
}

func TestExitIntent_GlobalSingleton(t *testing.T) {
	a := GlobalExitIntentTracker()
	b := GlobalExitIntentTracker()
	if a != b {
		t.Error("GlobalExitIntentTracker 应返回同一单例")
	}
}

func TestExitIntent_SnapshotReturnsNilForUnknown(t *testing.T) {
	feature_flag.Reset()
	tr := newTestTracker()
	if snap := tr.GetSnapshot("nobody", "nothing", "LONG"); snap != nil {
		t.Error("未知条目应返回 nil")
	}
}
