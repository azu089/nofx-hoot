package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// ---------------------------------------------------------------------------
// Arena 策略 API 端点
// ---------------------------------------------------------------------------

// handleGetArenaSignals GET /api/arena/signals — 获取所有 Arena 策略的最新信号
func (s *Server) handleGetArenaSignals(c *gin.Context) {
	traders := s.traderManager.GetAllTraders()
	signals := make([]gin.H, 0)

	for _, t := range traders {
		runner := t.GetArenaRunner()
		if runner == nil {
			continue
		}
		for symbol, sig := range runner.GetAllSignals() {
			signals = append(signals, gin.H{
				"trader_id":  t.GetID(),
				"trader_name": t.GetName(),
				"symbol":     symbol,
				"signal":     sig.Signal,
				"confidence": sig.Confidence,
				"timestamp":  sig.Timestamp,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"signals": signals})
}

// handleGetArenaSignalBySymbol GET /api/arena/signals/:symbol — 获取指定币种的最新信号
func (s *Server) handleGetArenaSignalBySymbol(c *gin.Context) {
	symbol := c.Param("symbol")
	traders := s.traderManager.GetAllTraders()
	signals := make([]gin.H, 0)

	for _, t := range traders {
		runner := t.GetArenaRunner()
		if runner == nil {
			continue
		}
		sig := runner.GetLastSignal(symbol)
		if sig != nil {
			signals = append(signals, gin.H{
				"trader_id":          t.GetID(),
				"trader_name":        t.GetName(),
				"symbol":             sig.Symbol,
				"signal":             sig.Signal,
				"confidence":         sig.Confidence,
				"bull_argument":      sig.BullArgument,
				"bear_argument":      sig.BearArgument,
				"risk_debate_summary": sig.RiskDebateSummary,
				"portfolio_decision": sig.PortfolioDecision,
				"timestamp":          sig.Timestamp,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"signals": signals})
}

// handleGetArenaRecords GET /api/arena/records/:traderID — 获取 Arena 决策历史
func (s *Server) handleGetArenaRecords(c *gin.Context) {
	traderID := c.Param("traderID")
	limitStr := c.DefaultQuery("limit", "20")
	limit, _ := strconv.Atoi(limitStr)
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	records, err := s.store.ArenaRecord().GetRecordsByTrader(traderID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get arena records"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"records": records})
}

// handleGetArenaLatestRecord GET /api/arena/records/:traderID/latest — 获取最新一条决策记录
func (s *Server) handleGetArenaLatestRecord(c *gin.Context) {
	traderID := c.Param("traderID")
	symbol := c.Query("symbol")
	if symbol == "" {
		symbol = "BTCUSDT"
	}

	record, err := s.store.ArenaRecord().GetLatestRecord(traderID, symbol)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get arena record"})
		return
	}
	if record == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no arena records found"})
		return
	}

	c.JSON(http.StatusOK, record)
}

// handleTriggerArenaRun POST /api/arena/run/:traderID — 手动触发一次 Arena 辩论
func (s *Server) handleTriggerArenaRun(c *gin.Context) {
	traderID := c.Param("traderID")

	autoTrader, err := s.traderManager.GetTrader(traderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "trader not found"})
		return
	}

	runner := autoTrader.GetArenaRunner()
	if runner == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "trader is not an arena strategy"})
		return
	}

	// 从请求体获取 symbol（可选）
	var req struct {
		Symbol string `json:"symbol"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Symbol == "" {
		req.Symbol = "BTCUSDT"
	}

	// 异步执行（不阻塞 API 响应）
	go func() {
		_ = runner.RunOneRound(req.Symbol)
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Arena debate triggered",
		"symbol":  req.Symbol,
	})
}
