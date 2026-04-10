// Copyright (c) 2026 nofx contributors
// License: AGPL-3.0

package store

import (
	"time"

	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// ArenaDecisionRecord 存储 Arena 策略的辩论过程和决策结果
// ---------------------------------------------------------------------------

// ArenaDecisionRecord Arena 策略决策记录（DB 模型）
type ArenaDecisionRecord struct {
	ID             int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	TraderID       string    `gorm:"column:trader_id;not null;index:idx_arena_records_trader_time" json:"trader_id"`
	Symbol         string    `gorm:"not null" json:"symbol"`
	Signal         string    `json:"signal"`     // BUY/OVERWEIGHT/HOLD/UNDERWEIGHT/SELL
	Confidence     int       `json:"confidence"` // 0-100
	Action         string    `json:"action"`     // open_long/open_short/close_long/hold
	ActionExecuted bool      `json:"action_executed"`
	RejectReason   string    `json:"reject_reason,omitempty"`

	// 辩论摘要
	MarketReport       string `gorm:"type:text" json:"market_report"`
	SentimentReport    string `gorm:"type:text" json:"sentiment_report"`
	NewsReport         string `gorm:"type:text" json:"news_report"`
	FundamentalsReport string `gorm:"type:text" json:"fundamentals_report"`
	BullArgument       string `gorm:"type:text" json:"bull_argument"`
	BearArgument       string `gorm:"type:text" json:"bear_argument"`
	TraderPlan         string `gorm:"type:text" json:"trader_plan"`
	RiskDebate         string `gorm:"type:text" json:"risk_debate"`
	FinalDecision      string `gorm:"type:text" json:"final_decision"`

	// 执行结果
	EntryPrice      float64 `json:"entry_price,omitempty"`
	StopLoss        float64 `json:"stop_loss,omitempty"`
	TakeProfit      float64 `json:"take_profit,omitempty"`
	Quantity        float64 `json:"quantity,omitempty"`
	PositionSizeUSD float64 `json:"position_size_usd,omitempty"`
	Leverage        int     `json:"leverage,omitempty"`
	RiskRewardRatio float64 `json:"risk_reward_ratio,omitempty"`

	// 开发者信息（prompt + chain-of-thought）
	SystemPrompt string `gorm:"type:text" json:"system_prompt,omitempty"`
	UserPrompt   string `gorm:"type:text" json:"user_prompt,omitempty"`
	CoTTrace     string `gorm:"type:text" json:"cot_trace,omitempty"`

	// 执行/错误信息
	ExecutionLog     string `gorm:"type:text" json:"execution_log,omitempty"`
	ErrorMessage     string `json:"error_message,omitempty"`
	CycleNumber      int64  `json:"cycle_number,omitempty"`
	AICallDurationMs int64  `gorm:"column:ai_call_duration_ms" json:"ai_call_duration_ms,omitempty"`

	// 时间
	DebateDurationMs int64     `gorm:"column:debate_duration_ms" json:"debate_duration_ms"`
	CreatedAt        time.Time `gorm:"autoCreateTime;index:idx_arena_records_trader_time,sort:desc" json:"created_at"`
}

func (ArenaDecisionRecord) TableName() string { return "arena_decision_records" }

// ---------------------------------------------------------------------------
// ArenaRecordStore 存储操作
// ---------------------------------------------------------------------------

// ArenaRecordStore Arena 决策记录存储
type ArenaRecordStore struct {
	gdb *gorm.DB
}

// NewArenaRecordStore 创建实例
func NewArenaRecordStore(gdb *gorm.DB) *ArenaRecordStore {
	return &ArenaRecordStore{gdb: gdb}
}

// InitTables 自动建表
func (s *ArenaRecordStore) InitTables() error {
	return s.gdb.AutoMigrate(&ArenaDecisionRecord{})
}

// SaveRecord 保存一条决策记录
func (s *ArenaRecordStore) SaveRecord(record *ArenaDecisionRecord) error {
	return s.gdb.Create(record).Error
}

// GetRecordsByTrader 获取某 trader 的决策历史（按时间倒序）
func (s *ArenaRecordStore) GetRecordsByTrader(traderID string, limit int) ([]ArenaDecisionRecord, error) {
	if limit <= 0 {
		limit = 20
	}
	var records []ArenaDecisionRecord
	err := s.gdb.Where("trader_id = ?", traderID).
		Order("created_at DESC").
		Limit(limit).
		Find(&records).Error
	return records, err
}

// GetLatestRecord 获取某 trader+symbol 的最新一条记录
func (s *ArenaRecordStore) GetLatestRecord(traderID, symbol string) (*ArenaDecisionRecord, error) {
	var record ArenaDecisionRecord
	err := s.gdb.Where("trader_id = ? AND symbol = ?", traderID, symbol).
		Order("created_at DESC").
		First(&record).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &record, nil
}

// GetRecordsBySymbol 获取某 symbol 的所有记录（跨 trader）
func (s *ArenaRecordStore) GetRecordsBySymbol(symbol string, limit int) ([]ArenaDecisionRecord, error) {
	if limit <= 0 {
		limit = 20
	}
	var records []ArenaDecisionRecord
	err := s.gdb.Where("symbol = ?", symbol).
		Order("created_at DESC").
		Limit(limit).
		Find(&records).Error
	return records, err
}

// CleanOldRecords 清理超过指定天数的旧记录
func (s *ArenaRecordStore) CleanOldRecords(daysToKeep int) (int64, error) {
	cutoff := time.Now().AddDate(0, 0, -daysToKeep)
	result := s.gdb.Where("created_at < ?", cutoff).Delete(&ArenaDecisionRecord{})
	return result.RowsAffected, result.Error
}
