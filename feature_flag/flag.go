// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

// Package feature_flag 提供通用功能开关框架
//
// 设计目标:
//   - 支持 per-strategy / per-trader / 百分比灰度 / 全局开关
//   - 内存查询零开销
//   - 后续可扩展 Redis/DB backend 而不破坏调用方
//
// 配置来源（按优先级）:
//  1. env 变量: HOOT_FF_<flag_key>=<spec>  (前缀固定，变量名不变)
//  2. SetSpec() 运行时设置
//  3. 默认值（未注册即 false）
//
// spec 格式:
//
//	"on"                    全局打开
//	"off"                   全局关闭
//	"pct:50"                50% 灰度（按 strategy_id hash 稳定取模）
//	"strategies:s1,s2"      仅指定策略打开
//	"traders:t1,t2"         仅指定 trader 打开
//	"shadow"                自定义字符串模式（调用方自行解析 Mode()）
package feature_flag

import (
	"hash/fnv"
	"os"
	"strconv"
	"strings"
	"sync"
)

// EvalCtx 求值上下文
type EvalCtx struct {
	StrategyID string
	TraderID   string
}

// Spec 单个 flag 的规格
type Spec struct {
	// raw 原始 spec 字符串，用于 Mode() 自定义返回
	raw string
	// kind: on / off / pct / strategies / traders / custom
	kind string
	// pct kind 的灰度百分比 0..100
	pct int
	// strategies / traders kind 的白名单
	allowlist map[string]struct{}
}

// envPrefix 环境变量前缀
const envPrefix = "HOOT_FF_"

var (
	mu    sync.RWMutex
	specs = map[string]*Spec{}
)

// init 启动时从 env 加载所有 HOOT_FF_* 环境变量
func init() {
	for _, kv := range os.Environ() {
		if !strings.HasPrefix(kv, envPrefix) {
			continue
		}
		eq := strings.IndexByte(kv, '=')
		if eq < 0 {
			continue
		}
		key := strings.ToLower(kv[len(envPrefix):eq])
		val := kv[eq+1:]
		if key == "" || val == "" {
			continue
		}
		SetSpec(key, val)
	}
}

// SetSpec 运行时设置 flag spec（测试 / 管理后台用）
func SetSpec(key, raw string) {
	s := parse(raw)
	mu.Lock()
	specs[strings.ToLower(key)] = s
	mu.Unlock()
}

// Reset 清空所有 flag（测试用）
func Reset() {
	mu.Lock()
	specs = map[string]*Spec{}
	mu.Unlock()
}

// Enabled 查询 flag 是否启用
//   - 未注册 → false
//   - on → true
//   - off → false
//   - pct → 按 ctx.StrategyID 稳定 hash 灰度
//   - strategies → ctx.StrategyID ∈ 白名单
//   - traders → ctx.TraderID ∈ 白名单
//   - custom → 视为 true（具体语义由 Mode() 解析）
func Enabled(key string, ctx EvalCtx) bool {
	mu.RLock()
	s := specs[strings.ToLower(key)]
	mu.RUnlock()
	if s == nil {
		return false
	}
	switch s.kind {
	case "on":
		return true
	case "off":
		return false
	case "pct":
		if ctx.StrategyID == "" {
			return false
		}
		return hashBucket(ctx.StrategyID) < s.pct
	case "strategies":
		if ctx.StrategyID == "" {
			return false
		}
		_, ok := s.allowlist[ctx.StrategyID]
		return ok
	case "traders":
		if ctx.TraderID == "" {
			return false
		}
		_, ok := s.allowlist[ctx.TraderID]
		return ok
	case "custom":
		return true
	}
	return false
}

// Mode 返回 flag 的原始 spec（供调用方解析自定义模式如 "shadow" / "partial"）
// 未注册返回空串
func Mode(key string) string {
	mu.RLock()
	defer mu.RUnlock()
	if s := specs[strings.ToLower(key)]; s != nil {
		return s.raw
	}
	return ""
}

// parse 解析 spec 字符串
func parse(raw string) *Spec {
	s := &Spec{raw: raw}
	r := strings.TrimSpace(raw)
	switch {
	case r == "on" || r == "true" || r == "1":
		s.kind = "on"
	case r == "off" || r == "false" || r == "0" || r == "":
		s.kind = "off"
	case strings.HasPrefix(r, "pct:"):
		s.kind = "pct"
		n, _ := strconv.Atoi(strings.TrimPrefix(r, "pct:"))
		if n < 0 {
			n = 0
		}
		if n > 100 {
			n = 100
		}
		s.pct = n
	case strings.HasPrefix(r, "strategies:"):
		s.kind = "strategies"
		s.allowlist = parseList(strings.TrimPrefix(r, "strategies:"))
	case strings.HasPrefix(r, "traders:"):
		s.kind = "traders"
		s.allowlist = parseList(strings.TrimPrefix(r, "traders:"))
	default:
		// 自定义字符串模式，视为 enabled，调用方用 Mode() 取值
		s.kind = "custom"
	}
	return s
}

func parseList(s string) map[string]struct{} {
	out := map[string]struct{}{}
	for _, item := range strings.Split(s, ",") {
		item = strings.TrimSpace(item)
		if item != "" {
			out[item] = struct{}{}
		}
	}
	return out
}

// hashBucket 用 fnv32 把 id 稳定映射到 0..99
func hashBucket(id string) int {
	h := fnv.New32a()
	_, _ = h.Write([]byte(id))
	return int(h.Sum32() % 100)
}
