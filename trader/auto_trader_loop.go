package trader

import (
	"encoding/json"
	"fmt"
	"nofx/kernel"
	"nofx/logger"
	"nofx/market"
	"nofx/store"
	"nofx/trader/ai_budget"
	"nofx/trader/audit"
	"nofx/trader/token_guard"
	"strings"
	"time"
)

// runCycle runs one trading cycle (using AI full decision-making)
func (at *AutoTrader) runCycle() error {
	at.callCount++

	logger.Info("\n" + strings.Repeat("=", 70) + "\n")
	logger.Infof("⏰ %s - AI decision cycle #%d", time.Now().Format("2006-01-02 15:04:05"), at.callCount)
	logger.Info(strings.Repeat("=", 70))

	// 0. Check if trader is stopped (early exit to prevent trades after Stop() is called)
	at.isRunningMutex.RLock()
	running := at.isRunning
	at.isRunningMutex.RUnlock()
	if !running {
		logger.Infof("⏹ Trader is stopped, aborting cycle #%d", at.callCount)
		return nil
	}

	// Create decision record
	record := &store.DecisionRecord{
		ExecutionLog: []string{},
		Success:      true,
	}

	// 1. Check if trading needs to be stopped
	if time.Now().Before(at.stopUntil) {
		remaining := at.stopUntil.Sub(time.Now())
		logger.Infof("⏸ Risk control: Trading paused, remaining %.0f minutes", remaining.Minutes())
		record.Success = false
		record.ErrorMessage = fmt.Sprintf("Risk control paused, remaining %.0f minutes", remaining.Minutes())
		at.saveDecision(record)
		return nil
	}

	// 2. Reset daily P&L (reset every day)
	if time.Since(at.lastResetTime) > 24*time.Hour {
		at.dailyPnL = 0
		at.lastResetTime = time.Now()
		logger.Info("📅 Daily P&L reset")
	}

	// 4. Collect trading context
	ctx, err := at.buildTradingContext()
	if err != nil {
		record.Success = false
		record.ErrorMessage = fmt.Sprintf("Failed to build trading context: %v", err)
		// [HOOT v1.1 P1-3] 审计：context 构建失败
		audit.Snapshot(at.id, at.strategyID, "context_build_failed", map[string]any{
			"cycle": at.callCount,
			"error": err.Error(),
		})
		at.saveDecision(record)
		return fmt.Errorf("failed to build trading context: %w", err)
	}

	// [HOOT v1.1 P1-3] 审计：context 构建完成
	audit.Snapshot(at.id, at.strategyID, "context_built", map[string]any{
		"cycle":      at.callCount,
		"positions":  len(ctx.Positions),
		"candidates": len(ctx.CandidateCoins),
		"equity":     ctx.Account.TotalEquity,
	})

	// Save equity snapshot independently (decoupled from AI decision, used for drawing profit curve)
	// NOTE: Must be called BEFORE candidate coins check to ensure equity is always recorded
	at.saveEquitySnapshot(ctx)

	// [HOOT] Inject enhanced data into context
	ctx.TraderID = at.id
	ctx.StrategyConfig = at.config.StrategyConfig // v1.1 P2-2: 让 formatter 读取动态阈值配置
	at.injectMarketRegime(ctx)                    // B1: Market regime detection per symbol
	at.injectEventSignals(ctx)                    // B3: Event signal injection
	at.syncPositionLifecycles(ctx)                // Lifecycle: register/advance positions
	at.syncRiskGuardPositions(ctx)                // Sync positions to real-time risk guard
	ctx.RecentRiskEvents = at.consumeRiskEvents() // Consume risk events for AI awareness

	// If no candidate coins available, log but do not error
	if len(ctx.CandidateCoins) == 0 {
		logger.Infof("ℹ️  No candidate coins available, skipping this cycle")
		record.Success = true // Not an error, just no candidate coins
		record.ExecutionLog = append(record.ExecutionLog, "No candidate coins available, cycle skipped")
		record.AccountState = store.AccountSnapshot{
			TotalBalance:          ctx.Account.TotalEquity,
			AvailableBalance:      ctx.Account.AvailableBalance,
			TotalUnrealizedProfit: ctx.Account.UnrealizedPnL,
			PositionCount:         ctx.Account.PositionCount,
			InitialBalance:        at.initialBalance,
		}
		at.saveDecision(record)
		return nil
	}

	logger.Info(strings.Repeat("=", 70))
	for _, coin := range ctx.CandidateCoins {
		record.CandidateCoins = append(record.CandidateCoins, coin.Symbol)
	}

	logger.Infof("📊 Account equity: %.2f USDT | Available: %.2f USDT | Positions: %d",
		ctx.Account.TotalEquity, ctx.Account.AvailableBalance, ctx.Account.PositionCount)

	// [HOOT] Cost guard: skip AI call when no positions and in cooldown (env-driven, trader-level legacy guard)
	if at.costGuard != nil && at.costGuard.ShouldSkipAI(len(ctx.Positions)) {
		record.Success = true
		record.ExecutionLog = append(record.ExecutionLog, "Cost guard: skipped AI call (no positions, in cooldown)")
		at.saveDecision(record)
		return nil
	}

	// [HOOT v1.1 P1-1] Strategy AI Budget: per-strategy cooldown / daily limit
	// Configured via StrategyConfig.AIBudgetPolicy. Skipped if policy nil or disabled.
	// Positions held → always allowed (must manage existing positions).
	if at.config.StrategyConfig != nil {
		if skip, reason := ai_budget.Check(at.strategyID, at.config.StrategyConfig.AIBudgetPolicy, len(ctx.Positions)); skip {
			record.Success = true
			record.ExecutionLog = append(record.ExecutionLog, fmt.Sprintf("AI Budget: skipped AI call (%s)", reason))
			logger.Infof("💰 [%s] AI Budget skip: %s", at.name, reason)
			at.saveDecision(record)
			return nil
		}
	}

	// [HOOT v1.1 P1-2] Token Budget Guard: 运行时 prompt 预算评估
	// 评估当前策略配置在目标 provider 下的 token 占用，超硬阈值阻止本轮调用
	// 不阻塞策略运行：仅跳过本轮 AI 调用，下轮重新评估（用户应缩减币种/周期/K线数）
	if at.config.StrategyConfig != nil {
		verdict := token_guard.Evaluate(at.config.StrategyConfig, at.aiModel)
		switch verdict.Level {
		case token_guard.LevelWarning:
			logger.Warnf("⚠️ [%s] Token budget warning: %s", at.name, verdict.Reason)
			record.ExecutionLog = append(record.ExecutionLog, fmt.Sprintf("Token guard warn: %s", verdict.Reason))
		case token_guard.LevelDanger:
			logger.Errorf("🚨 [%s] Token budget DANGER (skipping AI this cycle): %s", at.name, verdict.Reason)
			record.Success = true
			record.ExecutionLog = append(record.ExecutionLog, fmt.Sprintf("Token guard BLOCK: %s", verdict.Reason))
			at.saveDecision(record)
			return nil
		}
	}

	// 5. Use strategy engine to call AI for decision
	logger.Infof("🤖 Requesting AI analysis and decision... [Strategy Engine]")
	aiDecision, err := kernel.GetFullDecisionWithStrategy(ctx, at.mcpClient, at.strategyEngine, "balanced")

	if aiDecision != nil && aiDecision.AIRequestDurationMs > 0 {
		record.AIRequestDurationMs = aiDecision.AIRequestDurationMs
		logger.Infof("⏱️ AI call duration: %.2f seconds", float64(record.AIRequestDurationMs)/1000)
		record.ExecutionLog = append(record.ExecutionLog,
			fmt.Sprintf("AI call duration: %d ms", record.AIRequestDurationMs))
	}

	// Save chain of thought, decisions, and input prompt even if there's an error (for debugging)
	if aiDecision != nil {
		record.SystemPrompt = aiDecision.SystemPrompt // Save system prompt
		record.InputPrompt = aiDecision.UserPrompt
		record.CoTTrace = aiDecision.CoTTrace
		record.RawResponse = aiDecision.RawResponse // Save raw AI response for debugging
		if len(aiDecision.Decisions) > 0 {
			decisionJSON, _ := json.MarshalIndent(aiDecision.Decisions, "", "  ")
			record.DecisionJSON = string(decisionJSON)
		}
	}

	// Record AI charge (track cost regardless of decision outcome)
	if aiDecision != nil && at.store != nil {
		if chargeErr := at.store.AICharge().Record(at.id, at.aiModel, at.config.AIModel); chargeErr != nil {
			logger.Warnf("⚠️ Failed to record AI charge: %v", chargeErr)
		}
	}

	if err != nil {
		at.consecutiveAIFailures++
		record.Success = false
		record.ErrorMessage = fmt.Sprintf("Failed to get AI decision: %v", err)

		// Activate safe mode after 3 consecutive failures
		if at.consecutiveAIFailures >= 3 && !at.safeMode {
			at.safeMode = true
			at.safeModeReason = fmt.Sprintf("AI failed %d consecutive times: %v", at.consecutiveAIFailures, err)
			logger.Errorf("🛡️ [%s] SAFE MODE ACTIVATED — AI failed %d times in a row. No new positions will be opened. Existing positions are protected with current stop-loss settings.",
				at.name, at.consecutiveAIFailures)
			logger.Errorf("🛡️ [%s] Reason: %v", at.name, err)
			logger.Errorf("🛡️ [%s] Action: Will keep trying AI each cycle. Safe mode auto-deactivates when AI recovers.", at.name)
		}

		// Print system prompt and AI chain of thought (output even with errors for debugging)
		if aiDecision != nil {
			logger.Info("\n" + strings.Repeat("=", 70) + "\n")
			logger.Infof("📋 System prompt (error case)")
			logger.Info(strings.Repeat("=", 70))
			logger.Info(aiDecision.SystemPrompt)
			logger.Info(strings.Repeat("=", 70))

			if aiDecision.CoTTrace != "" {
				logger.Info("\n" + strings.Repeat("-", 70) + "\n")
				logger.Info("💭 AI chain of thought analysis (error case):")
				logger.Info(strings.Repeat("-", 70))
				logger.Info(aiDecision.CoTTrace)
				logger.Info(strings.Repeat("-", 70))
			}
		}

		at.saveDecision(record)

		// In safe mode, don't return error — keep the loop running to retry next cycle
		if at.safeMode {
			logger.Warnf("🛡️ [%s] Safe mode: skipping this cycle, will retry in %v", at.name, at.config.ScanInterval)
			return nil
		}

		return fmt.Errorf("failed to get AI decision: %w", err)
	}

	// [HOOT] Record successful AI call for cost guard cooldown
	if at.costGuard != nil {
		at.costGuard.RecordAICall()
	}
	// [HOOT v1.1 P1-1] Record successful AI call for strategy budget
	if at.strategyID != "" && at.config.StrategyConfig != nil && at.config.StrategyConfig.AIBudgetPolicy != nil && at.config.StrategyConfig.AIBudgetPolicy.Enabled {
		ai_budget.Record(at.strategyID)
	}
	// [HOOT v1.1 P1-3] 审计：AI 调用完成
	audit.Snapshot(at.id, at.strategyID, "ai_call_done", map[string]any{
		"cycle":       at.callCount,
		"duration_ms": record.AIRequestDurationMs,
		"decision_count": func() int {
			if aiDecision != nil {
				return len(aiDecision.Decisions)
			}
			return 0
		}(),
	})

	// AI succeeded — reset failure counter and deactivate safe mode
	if at.consecutiveAIFailures > 0 {
		logger.Infof("✅ [%s] AI recovered after %d consecutive failures", at.name, at.consecutiveAIFailures)
	}
	at.consecutiveAIFailures = 0
	if at.safeMode {
		logger.Infof("🛡️ [%s] SAFE MODE DEACTIVATED — AI is working again. Resuming normal trading.", at.name)
		at.safeMode = false
		at.safeModeReason = ""
	}

	// // 5. Print system prompt
	// logger.Infof("\n" + strings.Repeat("=", 70))
	// logger.Infof("📋 System prompt [template: %s]", at.systemPromptTemplate)
	// logger.Info(strings.Repeat("=", 70))
	// logger.Info(decision.SystemPrompt)
	// logger.Infof(strings.Repeat("=", 70) + "\n")

	// 6. Print AI chain of thought
	// logger.Infof("\n" + strings.Repeat("-", 70))
	// logger.Info("💭 AI chain of thought analysis:")
	// logger.Info(strings.Repeat("-", 70))
	// logger.Info(decision.CoTTrace)
	// logger.Infof(strings.Repeat("-", 70) + "\n")

	// 7. Print AI decisions
	// logger.Infof("📋 AI decision list (%d items):\n", len(kernel.Decisions))
	// for i, d := range kernel.Decisions {
	//     logger.Infof("  [%d] %s: %s - %s", i+1, d.Symbol, d.Action, d.Reasoning)
	//     if d.Action == "open_long" || d.Action == "open_short" {
	//        logger.Infof("      Leverage: %dx | Position: %.2f USDT | Stop loss: %.4f | Take profit: %.4f",
	//           d.Leverage, d.PositionSizeUSD, d.StopLoss, d.TakeProfit)
	//     }
	// }
	logger.Info()
	logger.Info(strings.Repeat("-", 70))
	// 8. Sort decisions: ensure close positions first, then open positions (prevent position stacking overflow)
	logger.Info(strings.Repeat("-", 70))

	// [HOOT] Step D: Gatekeeper filtering (before sort, filter invalid candidates).
	// Always runs when strategyEngine is set; gateFilterDecisions handles nil Signals internally.
	if at.strategyEngine != nil {
		aiDecision.Decisions = at.gateFilterDecisions(aiDecision.Decisions, ctx)
	}

	// [HOOT] Step E: PositionManager — evaluate existing positions
	// v1.1 P3-2: 通过 InstitutionalPipeline 灰度合并 AI + PM 决策
	// 默认 mode=off → 行为完全等同于原版（PM append 到 AI 末尾）
	// shadow / partial / full 通过 strategy config 或 feature flag 灰度启用
	if len(ctx.Positions) > 0 {
		pmDecisions := at.runPositionManagement(ctx)
		if len(pmDecisions) > 0 {
			logger.Infof("📊 [%s] PositionManager generated %d actions", at.name, len(pmDecisions))
		}
		aiDecision.Decisions = at.ApplyInstitutionalPipeline(aiDecision.Decisions, pmDecisions)
	}

	// [HOOT v1.1 P4-1] CandidateRanker: 当 open 候选超过可用 slot 时按质量排序裁剪
	// 默认 disabled via feature_flag 'candidate_ranker'，原样返回零行为变化
	aiDecision.Decisions = at.applyCandidateRanker(aiDecision.Decisions, len(ctx.Positions))

	// 8. Sort decisions: ensure close positions first, then open positions (prevent position stacking overflow)
	sortedDecisions := sortDecisionsByPriority(aiDecision.Decisions)

	logger.Info("🔄 Execution order (optimized): Close positions first → Open positions later")
	for i, d := range sortedDecisions {
		logger.Infof("  [%d] %s %s", i+1, d.Symbol, d.Action)
	}
	logger.Info()

	// Check if trader is stopped before executing any decisions (prevent trades after Stop())
	at.isRunningMutex.RLock()
	running = at.isRunning
	at.isRunningMutex.RUnlock()
	if !running {
		logger.Infof("⏹ Trader stopped before decision execution, aborting cycle #%d", at.callCount)
		return nil
	}

	// Safe mode: filter out new-risk actions, only allow close/reduce/hold
	// v1.1 审计修复 Bug #1: scale_* 也引入新风险必须拦截
	if at.safeMode {
		filtered := make([]kernel.Decision, 0)
		for _, d := range sortedDecisions {
			if isOpenAction(d.Action) || isScaleAction(d.Action) {
				logger.Warnf("🛡️ [%s] Safe mode: BLOCKED %s %s (no new risk allowed)", at.name, d.Action, d.Symbol)
				continue
			}
			filtered = append(filtered, d)
		}
		sortedDecisions = filtered
		if len(sortedDecisions) == 0 {
			logger.Infof("🛡️ [%s] Safe mode: all decisions were open/scale, nothing to execute", at.name)
		}
	}

	// Execute decisions and record results
	for _, d := range sortedDecisions {
		// Check if trader is stopped before each decision (allow immediate stop during execution)
		at.isRunningMutex.RLock()
		running = at.isRunning
		at.isRunningMutex.RUnlock()
		if !running {
			logger.Infof("⏹ Trader stopped during decision execution, aborting remaining decisions")
			break
		}

		actionRecord := store.DecisionAction{
			Action:     d.Action,
			Symbol:     d.Symbol,
			Quantity:   0,
			Leverage:   d.Leverage,
			Price:      0,
			StopLoss:   d.StopLoss,
			TakeProfit: d.TakeProfit,
			Confidence: d.Confidence,
			Reasoning:  d.Reasoning,
			Timestamp:  time.Now().UTC(),
			Success:    false,
		}

		if err := at.executeDecisionWithRecord(&d, &actionRecord); err != nil {
			logger.Infof("❌ Failed to execute decision (%s %s): %v", d.Symbol, d.Action, err)
			actionRecord.Error = err.Error()
			record.ExecutionLog = append(record.ExecutionLog, fmt.Sprintf("❌ %s %s failed: %v", d.Symbol, d.Action, err))
		} else {
			actionRecord.Success = true
			record.ExecutionLog = append(record.ExecutionLog, fmt.Sprintf("✓ %s %s succeeded", d.Symbol, d.Action))

			// [HOOT] Track close events for OpenGate
			// v1.1 P1-4: sided cooldown 隔离
			// v1.1 审计修复 Bug #3: 用 sideFromAction 正确识别 reduce_short / close_short
			if isCloseAction(d.Action) {
				side := sideFromAction(d.Action) // "LONG" | "SHORT"
				sidedKey := "long"
				if side == "SHORT" {
					sidedKey = "short"
				}
				if at.openGate != nil {
					at.openGate.MarkCloseSided(at.id, d.Symbol, sidedKey)
				}
				// v1.1 审计修复 Bug #2: 只在完全平仓时注销 lifecycle
				// reduce 是部分平仓，持仓仍在，lifecycle 必须保留
				if isFullCloseAction(d.Action) {
					kernel.GlobalLifecycleManager().Unregister(at.id, d.Symbol, side)
				}
			}

			// Brief delay after successful execution
			time.Sleep(1 * time.Second)
		}

		record.Decisions = append(record.Decisions, actionRecord)
	}

	// 9. Save decision record
	if err := at.saveDecision(record); err != nil {
		logger.Infof("⚠ Failed to save decision record: %v", err)
	}

	return nil
}

// buildTradingContext builds trading context
func (at *AutoTrader) buildTradingContext() (*kernel.Context, error) {
	// 1. Get account information
	balance, err := at.trader.GetBalance()
	if err != nil {
		return nil, fmt.Errorf("failed to get account balance: %w", err)
	}

	// Get account fields
	totalWalletBalance := 0.0
	totalUnrealizedProfit := 0.0
	availableBalance := 0.0
	totalEquity := 0.0

	if wallet, ok := balance["totalWalletBalance"].(float64); ok {
		totalWalletBalance = wallet
	}
	if unrealized, ok := balance["totalUnrealizedProfit"].(float64); ok {
		totalUnrealizedProfit = unrealized
	}
	if avail, ok := balance["availableBalance"].(float64); ok {
		availableBalance = avail
	}

	// Use totalEquity directly if provided by trader (more accurate)
	if eq, ok := balance["totalEquity"].(float64); ok && eq > 0 {
		totalEquity = eq
	} else {
		// Fallback: Total Equity = Wallet balance + Unrealized profit
		totalEquity = totalWalletBalance + totalUnrealizedProfit
	}

	// 2. Get position information
	positions, err := at.trader.GetPositions()
	if err != nil {
		return nil, fmt.Errorf("failed to get positions: %w", err)
	}

	// [HOOT] Reconcile DB trader_positions against exchange truth BEFORE building
	// the AI context. This ensures ctx.RecentOrders / ctx.TradingStats reflect
	// reality (manual closes via nofx UI or exchange native UI get surfaced in
	// history, ghost partial-close records get marked CLOSED).
	// Rollback: env NOFX_RECONCILE_DISABLED=1
	at.reconcileDBPositions(positions)

	var positionInfos []kernel.PositionInfo
	totalMarginUsed := 0.0

	// Current position key set (for cleaning up closed position records)
	currentPositionKeys := make(map[string]bool)

	for _, pos := range positions {
		symbol := pos["symbol"].(string)
		side := pos["side"].(string)
		entryPrice := pos["entryPrice"].(float64)
		markPrice := pos["markPrice"].(float64)
		quantity := pos["positionAmt"].(float64)
		if quantity < 0 {
			quantity = -quantity // Short position quantity is negative, convert to positive
		}

		// Skip closed positions (quantity = 0), prevent "ghost positions" from being passed to AI
		if quantity == 0 {
			continue
		}

		unrealizedPnl := pos["unRealizedProfit"].(float64)
		liquidationPrice := pos["liquidationPrice"].(float64)

		// Calculate margin used (estimated)
		leverage := 10 // Default value, should actually be fetched from position info
		if lev, ok := pos["leverage"].(float64); ok {
			leverage = int(lev)
		}
		marginUsed := (quantity * markPrice) / float64(leverage)
		totalMarginUsed += marginUsed

		// Calculate P&L percentage (based on margin, considering leverage)
		pnlPct := calculatePnLPercentage(unrealizedPnl, marginUsed)

		// Get position open time from exchange (preferred) or fallback to local tracking
		posKey := symbol + "_" + side
		currentPositionKeys[posKey] = true

		var updateTime int64
		// Priority 1: Get from database (trader_positions table) - most accurate
		if at.store != nil {
			if dbPos, err := at.store.Position().GetOpenPositionBySymbol(at.id, symbol, side); err == nil && dbPos != nil {
				if dbPos.EntryTime > 0 {
					updateTime = dbPos.EntryTime
				}
			}
		}
		// Priority 2: Get from exchange API (Bybit: createdTime, OKX: createdTime)
		if updateTime == 0 {
			if createdTime, ok := pos["createdTime"].(int64); ok && createdTime > 0 {
				updateTime = createdTime
			}
		}
		// Priority 3: Fallback to local tracking
		if updateTime == 0 {
			if _, exists := at.positionFirstSeenTime[posKey]; !exists {
				at.positionFirstSeenTime[posKey] = time.Now().UnixMilli()
			}
			updateTime = at.positionFirstSeenTime[posKey]
		}

		// Get peak profit rate for this position
		at.peakPnLCacheMutex.RLock()
		peakPnlPct := at.peakPnLCache[posKey]
		at.peakPnLCacheMutex.RUnlock()

		positionInfos = append(positionInfos, kernel.PositionInfo{
			Symbol:           symbol,
			Side:             side,
			EntryPrice:       entryPrice,
			MarkPrice:        markPrice,
			Quantity:         quantity,
			Leverage:         leverage,
			UnrealizedPnL:    unrealizedPnl,
			UnrealizedPnLPct: pnlPct,
			PeakPnLPct:       peakPnlPct,
			LiquidationPrice: liquidationPrice,
			MarginUsed:       marginUsed,
			UpdateTime:       updateTime,
		})
	}

	// Clean up closed position records
	for key := range at.positionFirstSeenTime {
		if !currentPositionKeys[key] {
			delete(at.positionFirstSeenTime, key)
		}
	}

	// 3. Use strategy engine to get candidate coins (must have strategy engine)
	var candidateCoins []kernel.CandidateCoin
	if at.strategyEngine == nil {
		logger.Infof("⚠️ [%s] No strategy engine configured, skipping candidate coins", at.name)
	} else {
		coins, err := at.strategyEngine.GetCandidateCoins()
		if err != nil {
			// Log warning but don't fail - equity snapshot should still be saved
			logger.Infof("⚠️ [%s] Failed to get candidate coins: %v (will use empty list)", at.name, err)
		} else {
			candidateCoins = coins
			logger.Infof("📋 [%s] Strategy engine fetched candidate coins: %d", at.name, len(candidateCoins))
		}
	}

	// 4. Calculate total P&L
	totalPnL := totalEquity - at.initialBalance
	totalPnLPct := 0.0
	if at.initialBalance > 0 {
		totalPnLPct = (totalPnL / at.initialBalance) * 100
	}

	marginUsedPct := 0.0
	if totalEquity > 0 {
		marginUsedPct = (totalMarginUsed / totalEquity) * 100
	}

	// 5. Get leverage from strategy config
	strategyConfig := at.strategyEngine.GetConfig()
	btcEthLeverage := strategyConfig.RiskControl.BTCETHMaxLeverage
	altcoinLeverage := strategyConfig.RiskControl.AltcoinMaxLeverage
	logger.Infof("📋 [%s] Strategy leverage config: BTC/ETH=%dx, Altcoin=%dx", at.name, btcEthLeverage, altcoinLeverage)

	// 6. Build context
	ctx := &kernel.Context{
		CurrentTime:     time.Now().UTC().Format("2006-01-02 15:04:05 UTC"),
		RuntimeMinutes:  int(time.Since(at.startTime).Minutes()),
		CallCount:       at.callCount,
		BTCETHLeverage:  btcEthLeverage,
		AltcoinLeverage: altcoinLeverage,
		Account: kernel.AccountInfo{
			TotalEquity:      totalEquity,
			AvailableBalance: availableBalance,
			UnrealizedPnL:    totalUnrealizedProfit,
			TotalPnL:         totalPnL,
			TotalPnLPct:      totalPnLPct,
			MarginUsed:       totalMarginUsed,
			MarginUsedPct:    marginUsedPct,
			PositionCount:    len(positionInfos),
		},
		Positions:      positionInfos,
		CandidateCoins: candidateCoins,
	}

	// 7. Add recent closed trades (if store is available)
	if at.store != nil {
		// Get recent 10 closed trades for AI context
		recentTrades, err := at.store.Position().GetRecentTrades(at.id, 10)
		if err != nil {
			logger.Infof("⚠️ [%s] Failed to get recent trades: %v", at.name, err)
		} else {
			logger.Infof("📊 [%s] Found %d recent closed trades for AI context", at.name, len(recentTrades))
			for _, trade := range recentTrades {
				// Convert Unix timestamps to formatted strings for AI readability
				entryTimeStr := ""
				if trade.EntryTime > 0 {
					entryTimeStr = time.Unix(trade.EntryTime, 0).UTC().Format("01-02 15:04 UTC")
				}
				exitTimeStr := ""
				if trade.ExitTime > 0 {
					exitTimeStr = time.Unix(trade.ExitTime, 0).UTC().Format("01-02 15:04 UTC")
				}

				ctx.RecentOrders = append(ctx.RecentOrders, kernel.RecentOrder{
					Symbol:       trade.Symbol,
					Side:         trade.Side,
					EntryPrice:   trade.EntryPrice,
					ExitPrice:    trade.ExitPrice,
					RealizedPnL:  trade.RealizedPnL,
					PnLPct:       trade.PnLPct,
					EntryTime:    entryTimeStr,
					ExitTime:     exitTimeStr,
					HoldDuration: trade.HoldDuration,
				})
			}
		}
		// Get trading statistics for AI context
		stats, err := at.store.Position().GetFullStats(at.id)
		if err != nil {
			logger.Infof("⚠️ [%s] Failed to get trading stats: %v", at.name, err)
		} else if stats == nil {
			logger.Infof("⚠️ [%s] GetFullStats returned nil", at.name)
		} else if stats.TotalTrades == 0 {
			logger.Infof("⚠️ [%s] GetFullStats returned 0 trades (traderID=%s)", at.name, at.id)
		} else {
			ctx.TradingStats = &kernel.TradingStats{
				TotalTrades:    stats.TotalTrades,
				WinRate:        stats.WinRate,
				ProfitFactor:   stats.ProfitFactor,
				SharpeRatio:    stats.SharpeRatio,
				TotalPnL:       stats.TotalPnL,
				AvgWin:         stats.AvgWin,
				AvgLoss:        stats.AvgLoss,
				MaxDrawdownPct: stats.MaxDrawdownPct,
			}
			logger.Infof("📈 [%s] Trading stats: %d trades, %.1f%% win rate, PF=%.2f, Sharpe=%.2f, DD=%.1f%%",
				at.name, stats.TotalTrades, stats.WinRate, stats.ProfitFactor, stats.SharpeRatio, stats.MaxDrawdownPct)
		}
	} else {
		logger.Infof("⚠️ [%s] Store is nil, cannot get recent trades", at.name)
	}

	// 8. Quant data fetching is disabled: FetchQuantData is a no-op stub after
	// nofxos retirement. Skip the fetch+log block entirely (stub mode).
	_ = strategyConfig.Indicators.EnableQuantData

	// 9. Get OI ranking data (market-wide position changes)
	if strategyConfig.Indicators.EnableOIRanking {
		logger.Infof("📊 [%s] Fetching OI ranking data...", at.name)
		ctx.OIRankingData = at.strategyEngine.FetchOIRankingData()
		if ctx.OIRankingData != nil {
			logger.Infof("📊 [%s] OI ranking data ready: %d top, %d low positions",
				at.name, len(ctx.OIRankingData.TopPositions), len(ctx.OIRankingData.LowPositions))
		}
	}

	// 10. (NetFlow ranking removed with nofxos retirement.)

	// 11. Get Price ranking data (market-wide gainers/losers)
	if strategyConfig.Indicators.EnablePriceRanking {
		logger.Infof("📈 [%s] Fetching Price ranking data...", at.name)
		ctx.PriceRankingData = at.strategyEngine.FetchPriceRankingData()
		if ctx.PriceRankingData != nil {
			logger.Infof("📈 [%s] Price ranking data ready for %d durations",
				at.name, len(ctx.PriceRankingData.Durations))
		}
	}

	// 12. [HOOT] Pre-fill MarketDataMap so injectMarketRegime / syncPositionLifecycles
	// / runPositionManagement / gateFilterDecisions all have market data available
	// before GetFullDecisionWithStrategy is called. Failures are non-fatal (skip symbol).
	at.prefillMarketDataMap(ctx, strategyConfig)

	return ctx, nil
}

// prefillMarketDataMap populates ctx.MarketDataMap before the HOOT injection hooks run.
// This ensures injectMarketRegime / syncPositionLifecycles / runPositionManagement /
// gateFilterDecisions all have live market data available.
// Failures are non-fatal: the symbol is skipped, and GetFullDecisionWithStrategy will
// re-fetch any missing symbols via fetchMarketDataWithStrategy.
func (at *AutoTrader) prefillMarketDataMap(ctx *kernel.Context, strategyConfig *store.StrategyConfig) {
	if ctx.MarketDataMap != nil && len(ctx.MarketDataMap) > 0 {
		return // already populated (e.g., injected in tests)
	}

	// Resolve timeframes from strategy config (mirrors fetchMarketDataWithStrategy logic)
	timeframes := strategyConfig.Indicators.Klines.SelectedTimeframes
	primaryTF := strategyConfig.Indicators.Klines.PrimaryTimeframe
	klineCount := strategyConfig.Indicators.Klines.PrimaryCount

	if len(timeframes) == 0 {
		if primaryTF != "" {
			timeframes = append(timeframes, primaryTF)
		} else {
			timeframes = append(timeframes, "1h")
		}
		if strategyConfig.Indicators.Klines.LongerTimeframe != "" {
			timeframes = append(timeframes, strategyConfig.Indicators.Klines.LongerTimeframe)
		}
	}
	if primaryTF == "" && len(timeframes) > 0 {
		primaryTF = timeframes[0]
	}
	if klineCount <= 0 {
		klineCount = 30
	}

	// Collect all symbols: candidate coins + open positions
	symbolsToFetch := make(map[string]bool)
	for _, coin := range ctx.CandidateCoins {
		symbolsToFetch[coin.Symbol] = true
	}
	for _, pos := range ctx.Positions {
		symbolsToFetch[pos.Symbol] = true
	}

	if len(symbolsToFetch) == 0 {
		return
	}

	ctx.MarketDataMap = make(map[string]*market.Data, len(symbolsToFetch))

	fetched := 0
	for sym := range symbolsToFetch {
		data, err := market.GetWithTimeframes(sym, timeframes, primaryTF, klineCount)
		if err != nil {
			logger.Infof("⚠️ [%s] prefillMarketDataMap: failed to fetch %s: %v", at.name, sym, err)
			continue
		}
		ctx.MarketDataMap[sym] = data
		fetched++
	}

	logger.Infof("📊 [%s] prefillMarketDataMap: filled %d/%d symbols (timeframes=%v primary=%s)",
		at.name, fetched, len(symbolsToFetch), timeframes, primaryTF)
}

// sortDecisionsByPriority sorts decisions: close positions first, then open positions, finally hold/wait
// This avoids position stacking overflow when changing positions
func sortDecisionsByPriority(decisions []kernel.Decision) []kernel.Decision {
	if len(decisions) <= 1 {
		return decisions
	}

	// Define priority
	// v1.1 审计修复 Bug #4: 补 reduce/scale 4 个新 action
	// - reduce_*  → 1（与 close 同优先级，释放保证金）
	// - scale_*   → 2（与 open 同优先级，追加风险）
	getActionPriority := func(action string) int {
		switch action {
		case "close_long", "close_short", "reduce_long", "reduce_short":
			return 1 // 最高：释放保证金/平仓
		case "open_long", "open_short", "scale_long", "scale_short":
			return 2 // 次高：新开/加仓
		case "hold", "wait":
			return 3 // 最低
		default:
			return 999 // 未知 action 放最后
		}
	}

	// Copy decision list
	sorted := make([]kernel.Decision, len(decisions))
	copy(sorted, decisions)

	// Sort by priority
	for i := 0; i < len(sorted)-1; i++ {
		for j := i + 1; j < len(sorted); j++ {
			if getActionPriority(sorted[i].Action) > getActionPriority(sorted[j].Action) {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	return sorted
}

// checkClaw402Balance was removed with the claw402 payment provider retirement.
