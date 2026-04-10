# Enhanced Fork — Changelog

Enhancements on top of [nofx](https://github.com/NoFxAiOS/nofx) (AGPL-3.0).

## [Unreleased]

### Arena — Multi-AI Consensus Trading (13 files)
Re-implemented in Go from [TradingAgents](https://github.com/TauricResearch/TradingAgents) ([arXiv:2412.20138](https://arxiv.org/abs/2412.20138)), adapted for crypto futures markets.
- 13-role structured debate: Market/Social/News/Fundamentals analysts → Research team → 3 Risk Officers (Conservative/Balanced/Aggressive) → Portfolio Manager → Signal Processor
- 10 MCP tools for analysts: get_stock_data, get_indicators, get_fundamentals, get_balance_sheet, get_cashflow, get_income_statement, get_news, get_global_news, get_insider_transactions
- Tool-calling loop with 20-iteration hardcap per analyst and error recovery
- BM25-Okapi financial memory for historical situation retrieval (no external API)
- Structured JSON output: action, symbol, leverage, position_size_usd, stop_loss, take_profit, confidence, reasoning

### 9-Layer Trade Gatekeeper
- G1: Funding-rate crowding (long >0.1%/8h, short <-0.05%/8h)
- G2: Long/short ratio crowding (>75% long trap, <30% short trap)
- G3: OI divergence (price move vs OI contraction mismatch)
- G4: ATR low-volatility filter
- G5: Liquidation spike direction (block opening against squeeze)
- G6: Symbol blacklist (adaptive, low win-rate recovery)
- G7: Consecutive-loss cooldown (3+ losses)
- G8: Minimum Risk:Reward ratio (default 1.5:1)
- G9: Minimum AI confidence threshold
- EXIT_G1: OI still expanding → hold position
- EXIT_G2: HTF EMA aligned → trend intact, hold
- EXIT_G3: Minimum hold time (default 720s)
- Strategy mode overrides: aggressive / balanced / high_win_rate / institutional

### Position Lifecycle Management
- 5-state machine: New → Maturing → TrendConfirmed → TrendExhaustion → Exiting
- Alpha decay scoring from 6 sub-signals (trend, momentum, OI, volume, ATR, liquidation response)
- Position Manager outputs HOLD / REDUCE / SCALE / EXIT based on lifecycle + decay + strategy profile
- 3 strategy profiles: TrendFollowing (conservative exit), MeanReversion (quick exit), Breakout (moderate)

### Exit Strategy
- 3 exit philosophy templates: mechanical (fixed drawdown + EMA + OI), signal-driven (requires trend reversal + OI collapse + structure break), hybrid (hard stop-loss + signal-driven above)
- ATR-adaptive take profit: dynamic threshold = Multiplier × (ATR/Price) × Leverage, clamped 0.5%-5%

### Market Intelligence
- CoinGlass 5D signal pipeline: OI trend, funding extreme, long ratio, liquidation pressure, ATR state
- Liquidation map clustering: short_squeeze / long_squeeze detection
- Market regime detector: Trending / Ranging / High Volatility / Low Liquidity (via ATR, EMA slope, volume)
- Event intelligence engine: 3-stage lifecycle (RefreshSources → Normalize → GetActiveSignals)
- RSS + Manual event providers with deduplication and severity scoring
- Binance real-time user stream: order/balance/position updates via WebSocket with auto-reconnect

### AI Management
- Per-strategy AI call budget: daily cap + idle-state cooldown (positions bypass cooldown)
- Prompt token budget guard: soft threshold 80% (warning), hard threshold 100% (block)
- Candidate ranking: composite score = confidence(0.5) + risk_reward(0.3) + win_rate(0.2), keeps top K
- Sized adjust actions: reduce_long / reduce_short / scale_long / scale_short with configurable partial_pct
- Institutional pipeline: 4 PM authority modes (off / shadow / partial / full), feature-flagged

### Trading Execution
- Unified executor with 3 modes: Live (real exchange) / Simulate (slippage + fee model) / DryRun (log only)
- AI candidate generator: structured JSON with up to 3 candidates per cycle
- Rule-based generator: R1 Trend+OI expansion, R2 Squeeze confirmation
- Strategy orchestrator: market regime → strategy weight mapping (e.g., Trending = 70% TrendFollow + 30% Breakout)
- Real-time WebSocket risk guard: stop-loss trigger, liquidation warning (5% to liq), grid boundary, exposure limit
- Pre-trade simulator: margin check, min order size, leverage validation (feature-flagged)

### Risk Control
- Sided cooldown: independent long/short frequency gates per symbol
- Minimum hold enforcement per side (EXIT_G3, default 720s)
- Global symbol blacklist with time-limited bans, admin audit trail, per-strategy exemptions
- Adaptive threshold adjustment per symbol based on historical performance

### Infrastructure
- Feature flag framework: "on"/"off"/"pct:50"/"strategies:s1,s2"/"traders:t1,t2" via HOOT_FF_* env vars
- Structured audit pipeline: phase-tagged events (context_built → budget_check → ai_call_done → orders_executed) with pluggable sinks
- Upstream platform webhook: fire-and-forget async dispatch, uuid v4 event_id for idempotent upsert, runtime kill-switch
- Binance data providers: funding rate, long/short ratio, OI, price ranking
- DB migration utilities for schema evolution

### UI
- Nexora design system: dark theme with blue-grey gradients
- Responsive tabs and unified notification bubbles
- Simplified configuration flow (removed login/registration)
- TradingView chart integration with order visualization
- i18n support (Chinese + English)

### Fixed
- Entry time restoration from PositionInfo.UpdateTime across process restarts
- EXIT_G3 minimum hold enforcement with exchange position map fallback
- Gatekeeper over-protection in exit gates (real strategy audit)
- Multiple blocker bugs in trader execution (v1.1 post-merge audit: 5 blockers + 3 quality issues)
