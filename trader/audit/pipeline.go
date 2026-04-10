// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

// Package audit 提供结构化决策审计管道
//
// 设计目标:
//   - 主循环关键阶段（context_built / budget_check / token_guard / ai_call_done / orders_executed 等）
//     调用 Snapshot(phase, payload) 记录审计事件
//   - 默认 sink 输出到 logger（保留可读性）
//   - 可注入自定义 sink: Telegram、BullMQ worker、Sentry 等
//   - 事件管道 + 结构化字段 + 可插拔 sink
//   - 不与 DecisionRecord 耦合：审计事件独立于决策记录
package audit

import (
	"sync"
	"time"

	"nofx/logger"
)

// Event 单条审计事件
type Event struct {
	Timestamp  time.Time
	TraderID   string
	StrategyID string
	Phase      string         // e.g. "context_built", "budget_check", "ai_call_done"
	Payload    map[string]any // 任意结构化字段
}

// Sink 审计事件消费者接口
// 实现需做到非阻塞 / 异常吞掉 / 不抛错（审计永远不能影响主流程）
type Sink interface {
	Consume(evt Event)
}

// LoggerSink 默认实现：输出到 logger.Infof
type LoggerSink struct{}

func (LoggerSink) Consume(evt Event) {
	logger.Infof("📋 [AUDIT] [%s] trader=%s strategy=%s phase=%s payload=%v",
		evt.Timestamp.Format("15:04:05"), evt.TraderID, evt.StrategyID, evt.Phase, evt.Payload)
}

// NoopSink 测试用空实现
type NoopSink struct{}

func (NoopSink) Consume(evt Event) {}

var (
	mu       sync.RWMutex
	sinks    = []Sink{LoggerSink{}}
	disabled bool
)

// SetSinks 替换全局 sinks 列表（启动期或运行时切换）
// 传 nil 或空切片等同于禁用审计
func SetSinks(s ...Sink) {
	mu.Lock()
	defer mu.Unlock()
	if len(s) == 0 {
		sinks = nil
		return
	}
	sinks = append([]Sink{}, s...)
}

// AddSink 追加一个 sink（不替换现有的）
func AddSink(s Sink) {
	if s == nil {
		return
	}
	mu.Lock()
	defer mu.Unlock()
	sinks = append(sinks, s)
}

// Disable 全局关闭审计（测试 / 故障切断）
func Disable() {
	mu.Lock()
	defer mu.Unlock()
	disabled = true
}

// Enable 重新启用
func Enable() {
	mu.Lock()
	defer mu.Unlock()
	disabled = false
}

// Reset 测试用：恢复默认 LoggerSink 并启用
func Reset() {
	mu.Lock()
	defer mu.Unlock()
	sinks = []Sink{LoggerSink{}}
	disabled = false
}

// Snapshot 记录一条审计事件
//
// 调用方式应宽容失败：内部 panic / sink 异常都会被吞掉
// payload 推荐传只读 map，避免后续修改导致并发问题
func Snapshot(traderID, strategyID, phase string, payload map[string]any) {
	mu.RLock()
	if disabled || len(sinks) == 0 {
		mu.RUnlock()
		return
	}
	snapshot := make([]Sink, len(sinks))
	copy(snapshot, sinks)
	mu.RUnlock()

	evt := Event{
		Timestamp:  time.Now(),
		TraderID:   traderID,
		StrategyID: strategyID,
		Phase:      phase,
		Payload:    payload,
	}

	for _, sink := range snapshot {
		func(s Sink) {
			defer func() {
				if r := recover(); r != nil {
					logger.Warnf("[audit] sink panic recovered: %v", r)
				}
			}()
			s.Consume(evt)
		}(sink)
	}
}
