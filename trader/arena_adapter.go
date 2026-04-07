package trader

import (
	"fmt"
	"nofx/arena"
	"strings"
)

// ArenaTraderAdapter 将 nofx Trader 接口适配为 arena.TraderInterface
// 解耦 arena 包与 trader 包的直接依赖。
//
// 关键修复（2026-04-07）:
//   - position map 的 key 是 camelCase（positionAmt/entryPrice/unRealizedProfit/leverage/markPrice）
//     之前错用了 snake_case 导致所有字段永远为 0
//   - balance map 的 key 也是 camelCase（totalWalletBalance/availableBalance/totalUnrealizedProfit）
type ArenaTraderAdapter struct {
	trader       Trader // nofx 现有的 Trader 接口 (types.Trader)
	exchangeType string // 交易所类型（binance/okx/bybit/...），NewArenaTraderAdapter 时传入
}

// 编译期检查：确保 ArenaTraderAdapter 实现了 arena.TraderInterface
var _ arena.TraderInterface = (*ArenaTraderAdapter)(nil)

// NewArenaTraderAdapter 创建适配器
// exchangeType 用于 Arena 日志展示和 AI prompt 的 ExchangeType 字段
func NewArenaTraderAdapter(t Trader, exchangeType string) *ArenaTraderAdapter {
	return &ArenaTraderAdapter{trader: t, exchangeType: strings.ToLower(exchangeType)}
}

func (a *ArenaTraderAdapter) GetExchangeType() string {
	return a.exchangeType
}

func (a *ArenaTraderAdapter) OpenLong(symbol string, quantity float64) error {
	// leverage=0 → 底层 trader 会使用上次 SetLeverage 的值，或交易所默认值
	_, err := a.trader.OpenLong(symbol, quantity, 0)
	return err
}

func (a *ArenaTraderAdapter) OpenShort(symbol string, quantity float64) error {
	_, err := a.trader.OpenShort(symbol, quantity, 0)
	return err
}

func (a *ArenaTraderAdapter) CloseLong(symbol string, quantity float64) error {
	_, err := a.trader.CloseLong(symbol, quantity)
	return err
}

func (a *ArenaTraderAdapter) CloseShort(symbol string, quantity float64) error {
	_, err := a.trader.CloseShort(symbol, quantity)
	return err
}

// GetAccountInfo 返回完整账户快照
//
// Binance Futures GetBalance() 返回 map 的 camelCase key：
//   - totalWalletBalance (float64): 钱包余额
//   - availableBalance (float64): 可用保证金
//   - totalUnrealizedProfit (float64): 总未实现 PnL
//   - total_equity (float64): wallet + unrealizedPnL (特殊 snake_case，grid 用)
//
// 其他交易所（OKX/Bybit）若字段命名不同，需要在各自的 trader 实现里对齐 map key
func (a *ArenaTraderAdapter) GetAccountInfo() (arena.AccountInfo, error) {
	balMap, err := a.trader.GetBalance()
	if err != nil {
		return arena.AccountInfo{}, err
	}

	info := arena.AccountInfo{}

	// 优先读 camelCase（Binance 标准），fallback snake_case（grid 兼容）
	info.WalletBalance = getFloatKeys(balMap, "totalWalletBalance", "total_wallet_balance", "total_balance")
	info.AvailableBalance = getFloatKeys(balMap, "availableBalance", "available_balance")
	info.TotalUnrealizedProfit = getFloatKeys(balMap, "totalUnrealizedProfit", "total_unrealized_profit", "unrealized_profit")
	info.TotalEquity = getFloatKeys(balMap, "total_equity", "totalEquity")

	// 如果 total_equity 缺失，用 wallet + unrealized 计算
	if info.TotalEquity == 0 && info.WalletBalance > 0 {
		info.TotalEquity = info.WalletBalance + info.TotalUnrealizedProfit
	}

	// 保证金使用率 = (wallet - available) / wallet
	if info.WalletBalance > 0 && info.AvailableBalance > 0 {
		used := info.WalletBalance - info.AvailableBalance
		if used < 0 {
			used = 0
		}
		info.MarginUsedPct = used / info.WalletBalance
	}

	// 兜底：如果 WalletBalance 还是 0（map 里完全没有这些 key），返回错误
	if info.WalletBalance == 0 && info.AvailableBalance == 0 {
		return info, fmt.Errorf("cannot extract balance from trader response (map keys: %v)", mapKeys(balMap))
	}

	return info, nil
}

// GetPositions 返回所有持仓的规范化快照
//
// Binance Futures 返回 map 的 camelCase key：
//   - symbol (string)
//   - side (string): "long" | "short"
//   - positionAmt (float64): 持仓数量（正数）
//   - entryPrice (float64)
//   - markPrice (float64)
//   - unRealizedProfit (float64): 注意大写 R
//   - leverage (float64): 杠杆倍数
//   - liquidationPrice (float64)
func (a *ArenaTraderAdapter) GetPositions() ([]arena.PositionInfo, error) {
	posMaps, err := a.trader.GetPositions()
	if err != nil {
		return nil, err
	}

	var result []arena.PositionInfo
	for _, pm := range posMaps {
		pi := arena.PositionInfo{
			Symbol: getString(pm, "symbol"),
			Side:   strings.ToUpper(getString(pm, "side")), // 统一成 LONG/SHORT
		}

		// 数量：Binance 用 positionAmt，其他交易所可能用 quantity
		pi.Quantity = getFloatKeys(pm, "positionAmt", "quantity", "position_amt")
		if pi.Quantity < 0 {
			pi.Quantity = -pi.Quantity // Binance 空头 positionAmt 是负数
		}

		pi.EntryPrice = getFloatKeys(pm, "entryPrice", "entry_price")
		pi.MarkPrice = getFloatKeys(pm, "markPrice", "mark_price")
		pi.UnrealizedPnL = getFloatKeys(pm, "unRealizedProfit", "unrealized_profit", "unrealizedPnl")

		// 杠杆
		if lev := getFloatKeys(pm, "leverage"); lev > 0 {
			pi.Leverage = int(lev)
		}

		// 保证金占用 = (数量 × 入场价) / 杠杆
		if pi.Leverage > 0 && pi.Quantity > 0 && pi.EntryPrice > 0 {
			pi.MarginUsed = (pi.Quantity * pi.EntryPrice) / float64(pi.Leverage)
		}

		if pi.Quantity > 0 {
			result = append(result, pi)
		}
	}
	return result, nil
}

func (a *ArenaTraderAdapter) SetLeverage(symbol string, leverage int) error {
	return a.trader.SetLeverage(symbol, leverage)
}

// --- 辅助函数 ---

// getFloatKeys 依次尝试多个 key，返回第一个非零值
// 兼容不同交易所返回格式（Binance camelCase / 其他 snake_case）
func getFloatKeys(m map[string]interface{}, keys ...string) float64 {
	for _, key := range keys {
		if v, ok := m[key]; ok {
			switch n := v.(type) {
			case float64:
				if n != 0 {
					return n
				}
			case int:
				if n != 0 {
					return float64(n)
				}
			case int64:
				if n != 0 {
					return float64(n)
				}
			}
		}
	}
	// 所有 key 都缺失，返回第一个存在的 key 的值（即使是 0）
	for _, key := range keys {
		if v, ok := m[key]; ok {
			switch n := v.(type) {
			case float64:
				return n
			case int:
				return float64(n)
			case int64:
				return float64(n)
			}
		}
	}
	return 0
}

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func mapKeys(m map[string]interface{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
