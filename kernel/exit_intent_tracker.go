// kernel/exit_intent_tracker.go — v1.1 真实策略审计修复
//
// 🌟 HOOT 独有能力：连续平仓意图逃生阀
//
// 解决的真实生产痛点:
//
//	原版 Gatekeeper EXIT_G1/G2/G3 规则会阻止 AI 的 close 提案，当 AI 看到
//	危险信号（局部反转、量能背离）连续多次要求平仓，但系统仍用 HTF EMA / OI
//	顺势判断强制持有，最终导致 SL/TP 被动触发时浮亏已扩大。
//
//	真实案例 (2026-04-08 ETHUSDT LONG):
//	  16:25:24 open_long → 16:54 起 AI 连续 5 次 close_long 全被拦
//	  最终 18:34 交易所 sync 关闭 -35 USDT
//
// 解决方案:
//
//	当 AI 在 escapeWindow 时间内连续 minAttempts 次请求同 symbol+side 平仓
//	被拦时，判定为"AI 有强信号"，**强制放行**下一次 close 请求。
//
//	- minAttempts:  默认 3 次（约 45 分钟持续警告，充分说明不是抖动）
//	- escapeWindow: 默认 60 分钟（超过窗口重置计数，避免长期误触）
//
// 与 nofx改版的差异:
//
//	改版没有这个能力，它只做了 EXIT_G3 sync 豁免 + EXIT_G1 价格同向
//	HOOT 在对齐改版的基础上增加这个逃生阀，直接解决 EXIT_G2 过度保护
//
// 灰度控制:
//
//	feature_flag: HOOT_FF_exit_escape=off → 禁用逃生阀（沿用原版拦截行为）
//	默认启用，因为这是真实生产亏损的修复
//
// 线程安全: sync.RWMutex
//
// 任务: 真实策略审计修复 (HOOT nofx 2026-04-08)
package kernel

import (
	"sync"
	"time"

	"nofx/feature_flag"
)

// 默认配置
const (
	defaultExitEscapeMinAttempts  = 3
	defaultExitEscapeWindowMinute = 60
)

// exitIntentEntry 单条 (trader, symbol, side) 的被拦记录
type exitIntentEntry struct {
	attempts   int       // 当前窗口内被拦次数
	firstBlock time.Time // 窗口起点
	lastBlock  time.Time // 最近一次被拦时间
	lastCode   string    // 最近一次拦截 code
	escapeUsed bool      // 本轮逃生阀已用过（避免反复 true）
}

// ExitIntentTracker 连续平仓意图追踪器
type ExitIntentTracker struct {
	mu      sync.RWMutex
	entries map[string]*exitIntentEntry
	// 可配参数（测试时可覆盖）
	MinAttempts int
	Window      time.Duration
}

var (
	globalExitIntentTracker = &ExitIntentTracker{
		entries:     map[string]*exitIntentEntry{},
		MinAttempts: defaultExitEscapeMinAttempts,
		Window:      defaultExitEscapeWindowMinute * time.Minute,
	}
)

// GlobalExitIntentTracker 返回包级单例
func GlobalExitIntentTracker() *ExitIntentTracker {
	return globalExitIntentTracker
}

// key 统一 key 构造
func (t *ExitIntentTracker) key(traderID, symbol, side string) string {
	return traderID + "|" + symbol + "|" + side
}

// RecordBlock 记录一次被 Gatekeeper 拦截的 close 意图
//
// 被拦意图 → 计数 +1，超窗口自动重置
// reason: 被拦的 RejectCode（用于审计）
func (t *ExitIntentTracker) RecordBlock(traderID, symbol, side, reason string) {
	if traderID == "" || symbol == "" || side == "" {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	t.recordBlockLocked(traderID, symbol, side, reason)
}

// recordBlockLocked 内部实现（需持有 t.mu）
func (t *ExitIntentTracker) recordBlockLocked(traderID, symbol, side, reason string) {
	k := t.key(traderID, symbol, side)
	now := time.Now()
	e := t.entries[k]

	if e == nil {
		e = &exitIntentEntry{
			attempts:   1,
			firstBlock: now,
			lastBlock:  now,
			lastCode:   reason,
		}
		t.entries[k] = e
		return
	}

	// 超窗口重置
	if now.Sub(e.firstBlock) > t.Window {
		e.attempts = 1
		e.firstBlock = now
		e.escapeUsed = false
	} else {
		e.attempts++
	}
	e.lastBlock = now
	e.lastCode = reason
}

// RecordBlockAndCheckEscape 原子版本: 记录一次被拦 + 判断本次是否应逃生
//
// 返回 true 表示"**本次**"应该直接放行，不用再返回拦截结果。
// 这是正确的时序——调用方应该先 record + check 一起做，再决定是否真的拦截。
//
// 内部会:
//  1. 检查 feature flag (默认启用)
//  2. 累加 attempts 计数
//  3. 判断 attempts >= MinAttempts && !escapeUsed
//  4. 触发时设 escapeUsed=true
func (t *ExitIntentTracker) RecordBlockAndCheckEscape(traderID, symbol, side, reason string) bool {
	if feature_flag.Mode("exit_escape") == "off" {
		// 仅 record 不逃生
		t.RecordBlock(traderID, symbol, side, reason)
		return false
	}
	if traderID == "" || symbol == "" || side == "" {
		return false
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	t.recordBlockLocked(traderID, symbol, side, reason)

	e := t.entries[t.key(traderID, symbol, side)]
	if e == nil {
		return false
	}

	// 超窗口（理论上 record 已重置 escapeUsed，但双重保险）
	if time.Since(e.firstBlock) > t.Window {
		return false
	}

	if e.attempts >= t.MinAttempts && !e.escapeUsed {
		e.escapeUsed = true
		return true
	}
	return false
}

// ShouldEscape 评估是否应触发逃生阀放行本次 close
//
// 条件:
//  1. feature_flag exit_escape 未显式关闭 (默认启用)
//  2. 当前 (trader|symbol|side) 条目存在
//  3. 当前窗口内 attempts >= MinAttempts
//  4. 本轮逃生阀未触发过（避免连续多条放行）
//
// 触发后自动重置 escapeUsed=true，下次 RecordBlock 或 RecordSuccess 重置
func (t *ExitIntentTracker) ShouldEscape(traderID, symbol, side string) bool {
	// feature flag 检查：默认启用，显式 off 可禁用
	if feature_flag.Mode("exit_escape") == "off" {
		return false
	}

	if traderID == "" || symbol == "" || side == "" {
		return false
	}

	t.mu.Lock()
	defer t.mu.Unlock()

	e := t.entries[t.key(traderID, symbol, side)]
	if e == nil {
		return false
	}

	// 超窗口不触发
	if time.Since(e.firstBlock) > t.Window {
		return false
	}

	// 未达最小次数
	if e.attempts < t.MinAttempts {
		return false
	}

	// 已用过逃生阀（避免连续放行）
	if e.escapeUsed {
		return false
	}

	e.escapeUsed = true
	return true
}

// RecordSuccess 标记成功执行了 close（或 open 新单），清空该条目
//
// 调用时机: AI 成功 close_long / close_short / reduce / 新开仓位后
func (t *ExitIntentTracker) RecordSuccess(traderID, symbol, side string) {
	if traderID == "" || symbol == "" || side == "" {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.entries, t.key(traderID, symbol, side))
}

// Snapshot 获取某条目的当前状态（调试 / 观测用）
type ExitIntentSnapshot struct {
	TraderID   string
	Symbol     string
	Side       string
	Attempts   int
	FirstBlock time.Time
	LastBlock  time.Time
	LastCode   string
	EscapeUsed bool
}

// GetSnapshot 查询当前状态
func (t *ExitIntentTracker) GetSnapshot(traderID, symbol, side string) *ExitIntentSnapshot {
	t.mu.RLock()
	defer t.mu.RUnlock()
	e := t.entries[t.key(traderID, symbol, side)]
	if e == nil {
		return nil
	}
	return &ExitIntentSnapshot{
		TraderID:   traderID,
		Symbol:     symbol,
		Side:       side,
		Attempts:   e.attempts,
		FirstBlock: e.firstBlock,
		LastBlock:  e.lastBlock,
		LastCode:   e.lastCode,
		EscapeUsed: e.escapeUsed,
	}
}

// Reset 清空所有条目（测试用）
func (t *ExitIntentTracker) Reset() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.entries = map[string]*exitIntentEntry{}
}
