// kernel/global_blacklist.go — v1.1 P3-3 全局共享黑名单
//
// 与原版 AdaptiveState 的差异:
//   - AdaptiveState 是 per-trader 实例，黑名单只影响单个 trader
//   - GlobalBlacklist 是包级单例，所有 trader 共享
//   - 用例: 管理员手动 ban / 紧急熔断 / 集中风控
//
// 设计:
//   - 包级 map + sync.RWMutex
//   - 支持 ban/unban/list/check
//   - 支持 per-strategy override（某些策略可豁免全局禁令）
//   - 通过 feature_flag 启停: HOOT_FF_global_blacklist=on
//
// 任务: P3-3 Global Blacklist Layer (HOOT nofx 升级 2026-04)
package kernel

import (
	"sync"
	"time"

	"nofx/feature_flag"
	"nofx/market"
)

// BlacklistEntry 单条黑名单条目
type BlacklistEntry struct {
	Symbol     string
	Reason     string
	BannedAt   time.Time
	ExpiresAt  time.Time // 零值 = 永久
	BannedBy   string    // "admin" | "auto" | trader_id
	Exemptions []string  // 豁免的 strategy_id 列表
}

var (
	globalBlMu      sync.RWMutex
	globalBlacklist = map[string]*BlacklistEntry{}
)

// BanGlobal 加入全局黑名单
//
// expiresAt 零值表示永久；reason 用于审计
func BanGlobal(symbol, reason, bannedBy string, expiresAt time.Time) {
	if symbol == "" {
		return
	}
	sym := market.Normalize(symbol)
	globalBlMu.Lock()
	defer globalBlMu.Unlock()
	globalBlacklist[sym] = &BlacklistEntry{
		Symbol:    sym,
		Reason:    reason,
		BannedAt:  time.Now(),
		ExpiresAt: expiresAt,
		BannedBy:  bannedBy,
	}
}

// UnbanGlobal 从全局黑名单移除
func UnbanGlobal(symbol string) {
	if symbol == "" {
		return
	}
	sym := market.Normalize(symbol)
	globalBlMu.Lock()
	defer globalBlMu.Unlock()
	delete(globalBlacklist, sym)
}

// AddExemption 给某策略豁免全局禁令
func AddExemption(symbol, strategyID string) {
	if symbol == "" || strategyID == "" {
		return
	}
	sym := market.Normalize(symbol)
	globalBlMu.Lock()
	defer globalBlMu.Unlock()
	entry := globalBlacklist[sym]
	if entry == nil {
		return
	}
	for _, ex := range entry.Exemptions {
		if ex == strategyID {
			return // 已存在
		}
	}
	entry.Exemptions = append(entry.Exemptions, strategyID)
}

// IsGloballyBlacklisted 检查 symbol 是否被全局禁
//
// 检查项:
//  1. feature_flag global_blacklist 启用 (默认禁用 → 永远 false)
//  2. symbol 在 globalBlacklist 中
//  3. 未过期 (ExpiresAt 非零且未过)
//  4. strategyID 不在 Exemptions 列表中
func IsGloballyBlacklisted(symbol, strategyID string) bool {
	// feature flag 检查（默认 disable → 完全 no-op）
	if !feature_flag.Enabled("global_blacklist", feature_flag.EvalCtx{StrategyID: strategyID}) {
		return false
	}
	if symbol == "" {
		return false
	}
	sym := market.Normalize(symbol)

	globalBlMu.RLock()
	defer globalBlMu.RUnlock()
	entry := globalBlacklist[sym]
	if entry == nil {
		return false
	}
	// 过期检查
	if !entry.ExpiresAt.IsZero() && time.Now().After(entry.ExpiresAt) {
		return false
	}
	// 豁免检查
	for _, ex := range entry.Exemptions {
		if ex == strategyID {
			return false
		}
	}
	return true
}

// ListGlobalBlacklist 返回所有当前 active 的黑名单条目（调试 / 管理后台用）
func ListGlobalBlacklist() []BlacklistEntry {
	globalBlMu.RLock()
	defer globalBlMu.RUnlock()
	now := time.Now()
	out := make([]BlacklistEntry, 0, len(globalBlacklist))
	for _, e := range globalBlacklist {
		if !e.ExpiresAt.IsZero() && now.After(e.ExpiresAt) {
			continue
		}
		out = append(out, *e)
	}
	return out
}

// ResetGlobalBlacklist 清空（测试用）
func ResetGlobalBlacklist() {
	globalBlMu.Lock()
	defer globalBlMu.Unlock()
	globalBlacklist = map[string]*BlacklistEntry{}
}
