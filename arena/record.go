package arena

// record.go — Arena 决策持久化接口（在 arena 包内定义，避免循环依赖）
//
// arena 包不能直接引用 store 包（会形成 arena→store→... 循环依赖）。
// 通过接口 ArenaRecordSaver 解耦：
//   - arena 包只知道接口
//   - trader 包实现适配器（ArenaRecordSaverAdapter），将 arena 数据映射到 store.ArenaDecisionRecord

// ArenaDecisionRecordData 持久化数据（arena 包内，字段对齐 store.ArenaDecisionRecord）
type ArenaDecisionRecordData struct {
	TraderID       string
	Symbol         string
	Signal         string  // BUY/OVERWEIGHT/HOLD/UNDERWEIGHT/SELL
	Confidence     int     // 0-100
	Action         string  // open_long/open_short/close_long/close_short/hold
	ActionExecuted bool    // 是否真正下单
	RejectReason   string  // Gatekeeper 拒绝原因（未拒绝时为空）

	// 辩论摘要（来自 ArenaSignal）
	MarketReport       string
	SentimentReport    string
	NewsReport         string
	FundamentalsReport string
	BullArgument       string
	BearArgument       string
	TraderPlan         string
	RiskDebate         string
	FinalDecision      string

	// 执行结果（下单成功后填写）
	EntryPrice      float64
	StopLoss        float64
	TakeProfit      float64
	Quantity        float64
	PositionSizeUSD float64
	Leverage        int
	RiskRewardRatio float64

	// 开发者信息
	SystemPrompt string
	UserPrompt   string
	CoTTrace     string

	// 执行/错误/cycle
	ExecutionLog     string
	ErrorMessage     string
	CycleNumber      int64
	AICallDurationMs int64

	// 耗时（毫秒）
	DebateDurationMs int64
}

// ArenaRecordSaver 持久化接口（由 trader 包的 ArenaRecordSaverAdapter 实现）
type ArenaRecordSaver interface {
	SaveRecord(record *ArenaDecisionRecordData) error
}
