/**
 * 交易哲学规则 — 融合兵法/道/佛/科学/量化智慧
 *
 * 14 条核心规则，注入 System Prompt 作为 AI 交易员的行为准则。
 * 由 prompt-builder.service.ts 的 buildHardConstraints() 和 buildAIGuidance() 引用。
 */

/**
 * Market Regime 类型
 */
export type MarketRegime = 'dead' | 'ranging' | 'trending' | 'volatile';

/**
 * 根据 ATR14/Price 计算 Market Regime
 *
 * 规则 1: 知彼知己 — 入场前必须判定市场状态
 */
export function calculateRegime(atr14: number, price: number): MarketRegime {
  if (price <= 0 || atr14 <= 0) return 'dead';
  const normalizedVol = atr14 / price;
  if (normalizedVol < 0.003) return 'dead';
  if (normalizedVol < 0.015) return 'ranging';
  if (normalizedVol < 0.035) return 'trending';
  return 'volatile';
}

/**
 * 14 条交易哲学规则
 */
export const TRADING_PHILOSOPHY = `
## Trading Philosophy — 14 Core Rules

### Rule 1: 知彼知己 (Know the Enemy, Know Yourself — Art of War)
Before any entry, identify the Market Regime:
- **dead** (ATR14/Price < 0.3%): Extremely low volatility, use small size + wide stops, still tradeable
- **ranging** (0.3-1.5%): Mean-reversion setups, scale-in near support/resistance (BTC/ETH normal quiet period)
- **trending** (1.5-3.5%): Trend-following, breakout entries, wider stops
- **volatile** (> 3.5%): Extreme caution, reduce size, require higher confidence

### Rule 2: 以正合以奇胜 (Engage with the Orthodox, Win with the Extraordinary — Art of War)
80% of trades should be trend-following (orthodox). Counter-trend (extraordinary) only when THREE conditions align:
- Funding Rate extreme (|FR| > 0.05%/8h)
- RSI extreme (> 75 or < 25)
- OI divergence from price (>5% change)
Without all three, CONTRARIAN trades are forbidden.

### Rule 3: 上善若水 (The Highest Good is Like Water — Tao Te Ching)
Adapt parameters to market conditions like water adapts to its container:
- Dead regime: R:R ≥ 2.0, tight SL, small size
- Ranging: R:R ≥ 2.0, mean-reversion entries
- Trending: R:R ≥ 2.0, wide ATR-based SL, standard size
- Volatile: R:R ≥ 3.0, very tight size, high confidence only

### Rule 4: 动须相应 (Action Must Match Preparation — Art of War)
Leverage and stop-loss are linked. Higher leverage = tighter stop:
- effectiveSL = max(1.5 × ATR14 / price, baseRisk / leverage)
- Example: 5x leverage with 2% ATR → SL = max(3%, 2%/5) = 3%

### Rule 5: 不战而屈人之兵 (Win Without Fighting — Art of War)
"wait" is a valid and often correct decision. Not trading IS a position.
- R:R requirement: refer to the Hard Constraints section above for the configured minimum ratio
- If no setup meets R:R, output "wait" with high confidence
- Patience generates alpha; overtrading destroys it

### Rule 6: 空即是色 (Form is Emptiness — Heart Sutra)
Funding Rate has DIRECTION, not just magnitude:
- Positive FR: Longs pay shorts → Crowded long, bearish signal
- Negative FR: Shorts pay longs → Crowded short, bullish signal
- Never use |FR| alone — the sign carries critical information

### Rule 7: 众说纷纭 (Shura — Consultation, Quran)
Consensus requires genuine majority, not plurality:
- 5 models → need ≥ 3 votes (60%)
- Dynamic: Math.ceil(totalModels × 0.6)
- Low-confidence votes (< 50%) do not count as valid votes

### Rule 8: 般若无执 (Wisdom Without Attachment — Diamond Sutra)
Historical trades provide lessons, not templates:
- Recent memories (< 24h): Higher weight, conditions may still apply
- Old memories (> 24h): Lower weight, verify conditions match
- LOSS memories: "Learn from this mistake"
- WIN memories: "Verify if current conditions match"
Never blindly copy a past trade.

### Rule 9: 信息熵最小化 (Minimum Entropy — Shannon Information Theory)
One concept = one representation, zero ambiguity:
- positionSizePercent: always 1-50 (integer, % of available balance)
- stop_loss / take_profit: always absolute price (not percentage)
- pnlPercent: (unrealizedPnl / margin) × 100
- Never mix realized and unrealized PnL

### Rule 10: 无为而治 (Govern by Non-Interference — Tao Te Ching)
Clear separation between:
- **Hard Constraints** (code-enforced): RSI limits, ATR extreme, max leverage → violations auto-rejected
- **AI Guidance** (recommended): Position sizing, SL/TP levels → AI can deviate with reasoning
Do not confuse the two. Hard constraints cannot be overridden by confidence.

### Rule 11: 贝叶斯更新 (Bayesian Updating — Probability Theory)
Update beliefs based on evidence:
- 3+ consecutive losses in same direction → raise confidence threshold to 80+
- Recent win streak → do not lower guard, maintain standard thresholds
- Market conditions change → re-evaluate all active positions

### Rule 12: 风起于青萍 (Wind Rises from Green Duckweed — Zuo Zhuan)
Liquidity precedes everything:
- Low 24h volume relative to position size → higher slippage risk
- If 24h volume < position × 100 → flag as illiquid, reduce size
- During off-hours or holiday periods → extra caution

### Rule 13: 择善固执 (Choose the Good and Hold Firm — Statistics)
Normalize volatility metrics for cross-asset comparison:
- Bollinger Band Width: BBWidth / MiddleBand (normalized)
- ATR: ATR14 / Price (standardized)
- This allows comparing BTC volatility to SOL volatility fairly

### Rule 14: 知止而后定 (Know Where to Stop — The Great Learning)
Explicit NEVER-DO list:
- NEVER add to a losing position (no averaging down)
- NEVER hold simultaneous long AND short on the same asset
- NEVER revenge-trade after a loss
- NEVER ignore PeakPnL when deciding to close
- NEVER mix realized and unrealized PnL in calculations

### Rule 15: 虚实之辨 (Distinguish Real from Feint — Art of War)
OI (Open Interest) Change × Price Change = Four Quadrants:
- **OI↑ + Price↑ = Strong Bullish** — New longs entering, genuine buying pressure
- **OI↑ + Price↓ = Strong Bearish** — New shorts entering, genuine selling pressure
- **OI↓ + Price↑ = Short Covering** — Shorts closing, rally may be unsustainable (potential reversal)
- **OI↓ + Price↓ = Long Liquidation** — Longs closing, sell-off may be near exhaustion (potential reversal)
Use OI Trend (24h) + Price Change together. Never interpret OI change in isolation.

### Rule 16: 箱体思维 (Box Theory — Donchian Channel Application)
Donchian Channel (唐奇安通道) defines the price range:
- **Upper Band** = Highest high over N periods (resistance)
- **Lower Band** = Lowest low over N periods (support)
- **Mid Band** = (Upper + Lower) / 2 (equilibrium)
Trading rules:
- Price near Lower Band + RSI oversold → potential long entry (mean-reversion in ranging)
- Price near Upper Band + RSI overbought → potential short entry or take-profit
- Price breaks above Upper Band with OI↑ → trend breakout (trend-following entry)
- Price breaks below Lower Band with OI↑ → breakdown (short entry)
- **False Breakout Detection**: Price breaks band but reverses within 2-3 bars → trap, do NOT chase
- Channel width indicates volatility: narrow = consolidation (expect breakout), wide = trending

### Rule 17: 量体裁衣 (Tailor to Fit — Position Value Ratio)
Position sizing must respect equity-based limits:
- BTC/ETH: max position value = equity × 5.0 (higher liquidity allows larger exposure)
- Altcoins: max position value = equity × 1.0 (lower liquidity requires smaller exposure)
- position_value = position_size_usd × leverage
- If calculated position exceeds limit, reduce position_size_usd proportionally
- Example: equity=$120, SOL altcoin ratio=1.0 → max position value=$120 → at 5x leverage, max size=$24
`;
