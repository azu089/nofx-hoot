package audit

import (
	"sync"
	"testing"
)

// captureSink 测试用：把所有事件存到 slice
type captureSink struct {
	mu     sync.Mutex
	events []Event
}

func (c *captureSink) Consume(evt Event) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.events = append(c.events, evt)
}

func (c *captureSink) Count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.events)
}

// panicSink 测试用：永远 panic
type panicSink struct{}

func (panicSink) Consume(Event) {
	panic("intentional panic for test")
}

func TestSnapshot_Basic(t *testing.T) {
	cap := &captureSink{}
	SetSinks(cap)
	defer Reset()

	Snapshot("trader1", "strat1", "context_built", map[string]any{"positions": 3})

	if cap.Count() != 1 {
		t.Errorf("期望 1 个事件，实际 %d", cap.Count())
	}
	evt := cap.events[0]
	if evt.TraderID != "trader1" || evt.StrategyID != "strat1" || evt.Phase != "context_built" {
		t.Errorf("事件字段错误: %+v", evt)
	}
	if evt.Payload["positions"] != 3 {
		t.Errorf("payload 错误: %+v", evt.Payload)
	}
}

func TestSnapshot_MultipleSinks(t *testing.T) {
	a := &captureSink{}
	b := &captureSink{}
	SetSinks(a, b)
	defer Reset()

	Snapshot("t", "s", "phase", nil)

	if a.Count() != 1 || b.Count() != 1 {
		t.Errorf("两个 sink 都应收到事件: a=%d b=%d", a.Count(), b.Count())
	}
}

func TestSnapshot_AddSink(t *testing.T) {
	a := &captureSink{}
	SetSinks(a)
	defer Reset()

	b := &captureSink{}
	AddSink(b)
	AddSink(nil) // 应被忽略

	Snapshot("t", "s", "phase", nil)

	if a.Count() != 1 || b.Count() != 1 {
		t.Errorf("AddSink 后两个都应收到: a=%d b=%d", a.Count(), b.Count())
	}
}

func TestSnapshot_PanicRecovered(t *testing.T) {
	defer Reset()

	cap := &captureSink{}
	SetSinks(panicSink{}, cap)

	// 不应抛 panic
	Snapshot("t", "s", "phase", nil)

	// 后续 sink 应正常消费
	if cap.Count() != 1 {
		t.Errorf("panic sink 不应阻塞后续 sink: cap=%d", cap.Count())
	}
}

func TestSnapshot_Disabled(t *testing.T) {
	cap := &captureSink{}
	SetSinks(cap)
	defer Reset()

	Disable()
	Snapshot("t", "s", "phase", nil)
	if cap.Count() != 0 {
		t.Error("disabled 时不应记录")
	}

	Enable()
	Snapshot("t", "s", "phase", nil)
	if cap.Count() != 1 {
		t.Error("enable 后应恢复记录")
	}
}

func TestSnapshot_EmptySinks(t *testing.T) {
	defer Reset()
	SetSinks() // 清空
	// 不应崩溃
	Snapshot("t", "s", "phase", nil)
}

func TestSnapshot_NilPayload(t *testing.T) {
	cap := &captureSink{}
	SetSinks(cap)
	defer Reset()

	Snapshot("t", "s", "phase", nil)
	if cap.Count() != 1 {
		t.Error("nil payload 应正常记录")
	}
}
