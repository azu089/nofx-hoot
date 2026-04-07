package trader

// arena_record_adapter.go — 将 arena.ArenaDecisionRecordData 映射到 store.ArenaDecisionRecord 并持久化。
//
// 解耦设计：
//   - arena 包定义接口 ArenaRecordSaver（不引用 store）
//   - trader 包实现 ArenaRecordSaverAdapter（同时 import arena + store，无循环依赖）

import (
	"nofx/arena"
	"nofx/store"
)

// 编译期检查：确保 ArenaRecordSaverAdapter 实现了 arena.ArenaRecordSaver 接口
var _ arena.ArenaRecordSaver = (*ArenaRecordSaverAdapter)(nil)

// ArenaRecordSaverAdapter 适配器：arena.ArenaRecordSaver → store.ArenaRecordStore
type ArenaRecordSaverAdapter struct {
	storeRecord *store.ArenaRecordStore
}

// NewArenaRecordSaverAdapter 创建适配器实例
func NewArenaRecordSaverAdapter(storeRecord *store.ArenaRecordStore) *ArenaRecordSaverAdapter {
	return &ArenaRecordSaverAdapter{storeRecord: storeRecord}
}

// SaveRecord 将 arena 包的数据结构映射为 store 模型并写入数据库
func (a *ArenaRecordSaverAdapter) SaveRecord(record *arena.ArenaDecisionRecordData) error {
	if record == nil || a.storeRecord == nil {
		return nil
	}

	dbRecord := &store.ArenaDecisionRecord{
		TraderID:           record.TraderID,
		Symbol:             record.Symbol,
		Signal:             record.Signal,
		Confidence:         record.Confidence,
		Action:             record.Action,
		ActionExecuted:     record.ActionExecuted,
		RejectReason:       record.RejectReason,
		MarketReport:       record.MarketReport,
		SentimentReport:    record.SentimentReport,
		NewsReport:         record.NewsReport,
		FundamentalsReport: record.FundamentalsReport,
		BullArgument:       record.BullArgument,
		BearArgument:       record.BearArgument,
		TraderPlan:         record.TraderPlan,
		RiskDebate:         record.RiskDebate,
		FinalDecision:      record.FinalDecision,
		EntryPrice:         record.EntryPrice,
		StopLoss:           record.StopLoss,
		TakeProfit:         record.TakeProfit,
		Quantity:           record.Quantity,
		PositionSizeUSD:    record.PositionSizeUSD,
		Leverage:           record.Leverage,
		RiskRewardRatio:    record.RiskRewardRatio,
		SystemPrompt:       record.SystemPrompt,
		UserPrompt:         record.UserPrompt,
		CoTTrace:           record.CoTTrace,
		ExecutionLog:       record.ExecutionLog,
		ErrorMessage:       record.ErrorMessage,
		CycleNumber:        record.CycleNumber,
		AICallDurationMs:   record.AICallDurationMs,
		DebateDurationMs:   record.DebateDurationMs,
	}

	return a.storeRecord.SaveRecord(dbRecord)
}
