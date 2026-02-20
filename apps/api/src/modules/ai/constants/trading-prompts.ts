/**
 * 产品B (AI Auto Trading / NoFx port) — 提示词与格式化工具
 *
 * 包含:
 * - 快速模式系统提示 (QUICK_MODE_SYSTEM_PROMPT)
 * - 市场数据格式化 (formatMarketDataPrompt)
 * - 安全警告格式化 (formatSafetyWarnings)
 * - 进化 Tier 提示 (EVOLUTION_TIER_PROMPTS)
 */

import { AIRole, AI_ROLES, ANALYSIS_OUTPUT_FORMAT } from './models';

// ==================== 市场数据格式化模板 ====================

export function formatMarketDataPrompt(data: {
  symbol: string;
  currentPrice: number;
  change24h?: number;
  volume24h?: number;
  ohlcv?: Array<{ open: number; high: number; low: number; close: number; volume: number }>;
  indicators?: Record<string, any>;
  openInterest?: number;
  fundingRate?: number;
  existingPositions?: Array<{ side: string; entryPrice: number; size: number; pnlPercent: number; peakPnlPercent?: number }>;
  marketRanking?: {
    topGainers?: Array<{ symbol: string; change24h: number }>;
    topLosers?: Array<{ symbol: string; change24h: number }>;
    topVolume?: Array<{ symbol: string; volume24h: number }>;
    targetRank?: { priceRank: number; volumeRank: number };
    totalCoins?: number;
  };
}): string {
  const lines: string[] = [
    `=== MARKET DATA: ${data.symbol} ===`,
    `Current Price: ${data.currentPrice}`,
  ];

  if (data.change24h !== undefined) {
    lines.push(`24h Change: ${data.change24h > 0 ? '+' : ''}${data.change24h.toFixed(2)}%`);
  }
  if (data.volume24h !== undefined) {
    lines.push(`24h Volume: ${data.volume24h.toLocaleString()}`);
  }

  // 技术指标
  if (data.indicators) {
    lines.push('', '--- Technical Indicators ---');
    const ind = data.indicators;
    if (ind.rsi7 !== undefined) lines.push(`RSI(7): ${ind.rsi7.toFixed(1)}`);
    if (ind.rsi14 !== undefined) lines.push(`RSI(14): ${ind.rsi14.toFixed(1)}`);
    if (ind.macd !== undefined) {
      lines.push(`MACD Line: ${ind.macd.toFixed(4)}`);
      if (ind.macdSignal !== undefined) lines.push(`MACD Signal: ${ind.macdSignal.toFixed(4)}`);
      if (ind.macdHistogram !== undefined) lines.push(`MACD Histogram: ${ind.macdHistogram.toFixed(4)}`);
    }
    if (ind.ema7 !== undefined) lines.push(`EMA(7): ${ind.ema7.toFixed(2)}`);
    if (ind.ema25 !== undefined) lines.push(`EMA(25): ${ind.ema25.toFixed(2)}`);
    if (ind.ema99 !== undefined) lines.push(`EMA(99): ${ind.ema99.toFixed(2)}`);
    if (ind.atr3 !== undefined) lines.push(`ATR(3): ${ind.atr3.toFixed(4)}`);
    if (ind.atr14 !== undefined) lines.push(`ATR(14): ${ind.atr14.toFixed(4)}`);
    if (ind.atr3 !== undefined && ind.atr14 !== undefined && ind.atr14 > 0) {
      const ratio = ind.atr3 / ind.atr14;
      lines.push(`ATR Ratio (3/14): ${ratio.toFixed(2)} ${ratio > 2.0 ? '⚠ HIGH VOLATILITY' : ratio > 1.5 ? '⚡ ELEVATED' : '✓ NORMAL'}`);
    }
    if (ind.donchianUpper !== undefined) {
      lines.push(`Donchian Upper: ${ind.donchianUpper.toFixed(2)}`);
      lines.push(`Donchian Mid: ${ind.donchianMid?.toFixed(2) || 'N/A'}`);
      lines.push(`Donchian Lower: ${ind.donchianLower?.toFixed(2) || 'N/A'}`);
    }
  }

  // 合约数据
  if (data.openInterest !== undefined || data.fundingRate !== undefined) {
    lines.push('', '--- Derivatives Data ---');
    if (data.openInterest !== undefined) {
      lines.push(`Open Interest: ${data.openInterest.toLocaleString()}`);
    }
    if (data.fundingRate !== undefined) {
      const fr = data.fundingRate;
      const frLabel = Math.abs(fr) > 0.001 ? '⚠ EXTREME' : Math.abs(fr) > 0.0005 ? '⚡ HIGH' : '✓ NORMAL';
      lines.push(`Funding Rate (8h): ${(fr * 100).toFixed(4)}% ${frLabel}`);
    }
  }

  // 市场排名（对齐 NoFx RankingDataType）
  if (data.marketRanking) {
    const r = data.marketRanking;
    lines.push('', '--- Market Ranking ---');
    if (r.topGainers && r.topGainers.length > 0) {
      lines.push('Top Gainers (24h): ' + r.topGainers.map((g) => `${g.symbol.split('/')[0]} ${g.change24h > 0 ? '+' : ''}${g.change24h}%`).join(', '));
    }
    if (r.topLosers && r.topLosers.length > 0) {
      lines.push('Top Losers (24h): ' + r.topLosers.map((l) => `${l.symbol.split('/')[0]} ${l.change24h}%`).join(', '));
    }
    if (r.targetRank && r.totalCoins) {
      if (r.targetRank.priceRank > 0) {
        lines.push(`Target Price Rank: #${r.targetRank.priceRank}/${r.totalCoins}`);
      }
      if (r.targetRank.volumeRank > 0) {
        lines.push(`Target Volume Rank: #${r.targetRank.volumeRank}/${r.totalCoins}`);
      }
    }
  }

  // 现有持仓
  if (data.existingPositions && data.existingPositions.length > 0) {
    lines.push('', '--- Existing Positions ---');
    for (const pos of data.existingPositions) {
      const peakPart = pos.peakPnlPercent !== undefined ? ` | PeakPnL: +${pos.peakPnlPercent.toFixed(2)}%` : '';
      lines.push(`  ${pos.side.toUpperCase()} @ ${pos.entryPrice} | Size: ${pos.size} | PnL: ${pos.pnlPercent > 0 ? '+' : ''}${pos.pnlPercent.toFixed(2)}%${peakPart}`);
    }
  } else {
    lines.push('', '--- Existing Positions ---');
    lines.push('  No open positions');
  }

  return lines.join('\n');
}

// ==================== 安全提示注入 ====================

export function formatSafetyWarnings(warnings: string[]): string {
  if (!warnings || warnings.length === 0) return '';

  const lines = [
    '',
    '=== SAFETY WARNINGS ===',
    'The risk management system has flagged the following concerns:',
    '',
  ];

  for (const w of warnings) {
    lines.push(`  ⚠ ${w}`);
  }

  lines.push('');
  lines.push('Consider these warnings in your analysis. If a hard limit is reached, your open actions may be blocked.');

  return lines.join('\n');
}

// ==================== 快速模式系统提示（对齐 NoFx prompt_builder.go） ====================

export const QUICK_MODE_SYSTEM_PROMPT = `你是一个专业的量化交易AI助手，负责分析市场数据并做出交易决策。

## 你的任务

1. **分析账户状态**: 评估当前风险水平、保证金使用率、持仓情况
2. **分析当前持仓**: 判断是否需要止盈、止损、加仓或持有
3. **分析市场数据**: 评估交易机会，结合技术分析和资金流向
4. **做出决策**: 输出明确的交易决策，包含详细的推理过程

## 决策原则

### 风险优先
- 保证金使用率不得超过30%
- 单个持仓亏损达到-5%必须止损
- 优先保护资本，再考虑盈利

### 跟踪止盈
- 当持仓盈亏从峰值回撤30%时，考虑部分或全部止盈
- 例如：Peak PnL +5%，Current PnL +3.5% → 回撤了30%，应该止盈

### 顺势交易
- 只在多个时间框架趋势一致时进场
- 结合持仓量(OI)变化判断资金流向真实性
- OI增加+价格上涨 = 强多头趋势
- OI减少+价格上涨 = 空头平仓（可能反转）

### 分批操作
- 分批建仓：第一次开仓不超过目标仓位的50%（positionSizePercent 建议 3-5%）
- 分批止盈：盈利3%平33%，盈利5%平50%，盈利8%全平
- 只在盈利仓位上加仓，永远不要追亏损

### 技术分析要点
- EMA排列: EMA(7) > EMA(25) > EMA(99) 为多头排列，反之为空头
- RSI(7): < 30 超卖，> 70 超买；关注与价格的背离
- MACD: 金叉(MACD上穿Signal)做多确认，死叉做空确认
- ATR(3)/ATR(14): > 2.0 高波动率（谨慎），> 3.0 极端（避免入场）
- Funding Rate: |FR| > 0.05% 为拥挤交易警告
- Donchian Channel: 价格触及上轨（强势），下轨（弱势），中轨（中性）

## 6-Action 决策映射

根据当前持仓状态选择合适的 action:

### 无持仓时
- **open_long**: 开新多仓（看涨信号明确，≥3个技术指标确认）
- **open_short**: 开新空仓（看跌信号明确，≥3个技术指标确认）
- **wait**: 信号不明确，等待更好机会

### 有多头持仓时
- **open_long**: 加仓（仅限盈利仓位，用小的 positionSizePercent 表示加仓量）
- **close_long**: 平多仓（部分止盈用小 positionSizePercent，全部平仓用大 positionSizePercent）
- **hold**: 持有当前仓位，趋势完好

### 有空头持仓时
- **open_short**: 加仓（仅限盈利仓位）
- **close_short**: 平空仓（部分或全部）
- **hold**: 持有当前仓位，趋势完好

## 重要提醒

1. **永远不要**混淆已实现盈亏和未实现盈亏
2. **永远记得**考虑杠杆对盈亏的放大作用
3. **永远关注**Peak PnL，这是判断止盈的关键指标
4. **永远结合**持仓量(OI)变化来判断趋势真实性
5. **永远遵守**风险管理规则，保护资本是第一位的
6. **止损必须设置**: 不提供 stopLoss 的交易建议是不合格的
7. **Risk/Reward ≥ 1.5:1**: 止盈/止损比例至少 1.5 倍

{EVOLUTION_CONTEXT}

{MEMORY_CONTEXT}

${ANALYSIS_OUTPUT_FORMAT}
`;

// ==================== 进化 Tier 提示模板 ====================

export const EVOLUTION_TIER_PROMPTS: Record<number, string> = {
  0: '', // Tier 0: 暂停，不应运行
  1: '=== EVOLUTION CONTEXT ===\nRecent trading performance is POOR (Sharpe Ratio: {sharpe}). Trade CONSERVATIVELY:\n- Prefer "hold" or "wait" unless signals are extremely clear\n- Require confidence ≥ 80 for any open action\n- Reduce suggested position sizes by 50%\n- Prioritize capital preservation over profit',
  2: '=== EVOLUTION CONTEXT ===\nTrading performance is NORMAL (Sharpe Ratio: {sharpe}). Trade with standard parameters.\n- Follow standard confidence thresholds\n- Standard position sizing applies',
  3: '=== EVOLUTION CONTEXT ===\nRecent trading performance is EXCELLENT (Sharpe Ratio: {sharpe}). You may trade more aggressively:\n- Accept setups with confidence ≥ 55 (normally ≥ 65)\n- Allow slightly larger position sizes (up to 8% of portfolio)\n- Consider taking additional setups you would normally skip',
};

// ==================== NoFx-Aligned 短角色提示词 (Product B 辩论专用) ====================
// 对齐 NoFx debate/engine.go getPersonalityDescription()
// Product B 已有 8-section PromptBuilder 提供完整交易上下文，
// 角色提示只需定义性格倾向 (~3 行)。

export const TRADING_ROLE_PROMPTS: Record<AIRole, string> = {
  [AI_ROLES.BULL]: 'Aggressive Bull - You are optimistic and look for long opportunities. You believe in upward momentum and trend continuation. Focus on bullish signals and support levels.',
  [AI_ROLES.BEAR]: 'Cautious Bear - You are skeptical and focus on risks. You look for short opportunities and warning signs. Question bullish narratives and highlight resistance levels.',
  [AI_ROLES.ANALYST]: 'Data Analyst - You are neutral and purely data-driven. Present technical analysis without bias. Let the indicators speak for themselves.',
  [AI_ROLES.CONTRARIAN]: 'Contrarian - You challenge majority opinions and look for overlooked opportunities. Question consensus views and find alternative interpretations of the data.',
  [AI_ROLES.RISK_MANAGER]: 'Risk Manager - You focus on position sizing, stop losses, and capital preservation. Evaluate risk/reward ratios and warn about potential downsides.',
};

export const PERSONALITY_EMOJIS: Record<AIRole, string> = {
  [AI_ROLES.BULL]: '🐂',
  [AI_ROLES.BEAR]: '🐻',
  [AI_ROLES.ANALYST]: '📊',
  [AI_ROLES.CONTRARIAN]: '🔄',
  [AI_ROLES.RISK_MANAGER]: '🛡️',
};

// ==================== 投票阶段输出格式 (对齐 NoFx <final_vote>) ====================

export const VOTING_OUTPUT_FORMAT = `
### CRITICAL: Output your votes in STRICT JSON ARRAY format (one vote per coin):
<final_vote>
[
  {"symbol": "BTCUSDT", "action": "open_long", "confidence": 75, "leverage": 5, "position_pct": 0.3, "stop_loss": 0.02, "take_profit": 0.04, "reasoning": "BTC final vote reason"},
  {"symbol": "ETHUSDT", "action": "open_short", "confidence": 80, "leverage": 3, "position_pct": 0.2, "stop_loss": 0.03, "take_profit": 0.06, "reasoning": "ETH final vote reason"}
]
</final_vote>

### IMPORTANT: action field MUST be exactly one of:
- "open_long" (Open a new LONG position)
- "open_short" (Open a new SHORT position)
- "close_long" (Close an existing LONG position)
- "close_short" (Close an existing SHORT position)
- "hold" (Keep current positions unchanged)
- "wait" (Not enough clarity, wait for better setup)

### Fields:
- symbol: Trading pair (e.g. "BTCUSDT")
- action: One of the 6 actions above
- confidence: 0-100 (how confident you are)
- leverage: 1-20 (recommended leverage, default 5)
- position_pct: 0.1-1.0 (fraction of available balance, default 0.2)
- stop_loss: 0.01-0.10 (stop loss as decimal percentage, e.g. 0.03 = 3%)
- take_profit: 0.01-0.20 (take profit as decimal percentage, e.g. 0.06 = 6%)
- reasoning: Brief explanation for this vote
`;

// ==================== 投票阶段 Prompt 构建 (对齐 NoFx buildVotingSystemPrompt) ====================

/**
 * 构建投票阶段系统提示词
 * 对齐 NoFx debate/engine.go buildVotingSystemPrompt()
 */
export function buildVotingSystemPrompt(
  role: AIRole,
  basePrompt: string,
): string {
  const personality = TRADING_ROLE_PROMPTS[role] || 'Market Analyst - Provide balanced technical analysis.';
  const emoji = PERSONALITY_EMOJIS[role] || '📈';

  return `## FINAL VOTE

You are ${emoji} ${role}. The debate has concluded.

Your personality: ${personality}

Review all the arguments presented and cast your final vote for ALL coins discussed.

Consider:
- The strength of technical arguments
- Data-driven evidence presented
- Risk/reward analysis
- Market timing considerations

You may vote differently from your earlier position if convinced by others' arguments.

${VOTING_OUTPUT_FORMAT}

---

${basePrompt}`;
}

/**
 * 构建投票阶段用户提示词（辩论摘要）
 * 对齐 NoFx debate/engine.go buildVotingUserPrompt()
 */
export function buildVotingUserPrompt(
  allEntries: Array<{
    role: string;
    round: number;
    direction: string;
    confidence: number;
    arguments?: any;
  }>,
): string {
  const lines: string[] = ['## Debate Summary\n'];

  // 按角色分组
  const byRole: Record<string, typeof allEntries> = {};
  for (const entry of allEntries) {
    if (!byRole[entry.role]) byRole[entry.role] = [];
    byRole[entry.role].push(entry);
  }

  for (const [role, entries] of Object.entries(byRole)) {
    if (entries.length === 0) continue;
    const emoji = PERSONALITY_EMOJIS[role as AIRole] || '📈';
    lines.push(`### ${emoji} ${role}:`);
    for (const e of entries) {
      lines.push(`- Round ${e.round}: ${e.direction} (Confidence: ${e.confidence}%)`);
    }
    lines.push('');
  }

  lines.push('Cast your final vote based on the debate above.');
  return lines.join('\n');
}

// ==================== 网格交易 AI 提示词（对齐 NoFx grid_engine.go） ====================

/**
 * 网格交易 AI 上下文类型
 * 对齐 NoFx grid_engine.go GridContext
 */
export interface GridContext {
  symbol: string;
  currentTime: string;
  currentPrice: number;
  gridCount: number;
  totalInvestment: number;
  leverage: number;
  upperPrice: number;
  lowerPrice: number;
  gridSpacing: number;
  distribution: string;
  levels: Array<{
    price: number;
    side: 'buy' | 'sell';
    quantity: number;
    state: 'pending' | 'filled' | 'cancelled';
    orderId?: string;
    fillPrice?: number;
    profit?: number;
  }>;
  activeOrderCount: number;
  filledLevelCount: number;
  isPaused: boolean;
  // 技术指标
  atr14: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  bollingerWidth: number;
  ema20: number;
  ema50: number;
  emaDistance: number;
  rsi14: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  fundingRate: number;
  volume24h: number;
  priceChange1h: number;
  priceChange4h: number;
  // 账户
  totalEquity: number;
  availableBalance: number;
  currentPosition: number;
  unrealizedPnl: number;
  // 绩效
  totalProfit: number;
  totalTrades: number;
  winningTrades: number;
  maxDrawdown: number;
  dailyPnl: number;
  // 箱体数据
  boxData?: {
    shortUpper: number;
    shortLower: number;
    midUpper: number;
    midLower: number;
    longUpper: number;
    longLower: number;
  };
  currentDirection: string;
}

/**
 * 网格交易系统提示词
 * 对齐 NoFx grid_engine.go buildGridSystemPrompt()
 */
export function GRID_SYSTEM_PROMPT(
  symbol: string,
  gridCount: number,
  totalInvestment: number,
  leverage: number,
  distribution: string,
): string {
  return `你是一个专业的网格交易 AI 引擎，负责管理 ${symbol} 的网格策略。

## 网格参数
- 交易对: ${symbol}
- 网格层数: ${gridCount}
- 总投资额: ${totalInvestment} USDT
- 杠杆倍数: ${leverage}x
- 分布方式: ${distribution}（uniform=等间距, gaussian=中间密集, pyramid=底部加重）

## 你的职责

1. **订单管理**: 根据当前市场状态，决定在哪些价位放置限价买/卖单
2. **风险控制**: 监控回撤、日内亏损，必要时暂停网格
3. **方向调整**: 根据趋势变化动态调整多空比例
4. **仓位管理**: 确保总仓位不超过投资限额 × 杠杆

## 决策规则

### 网格运行原则
- 价格在网格范围内时：维持正常网格运作，已成交层级翻转方向
- 价格接近边界时：适当减少边界附近的订单密度
- 价格突破网格范围时：根据突破方向调整策略

### 市场状态判断
- **窄幅震荡** (Bollinger 带宽 < 2%): 增加网格密度，适合网格交易
- **正常震荡** (2-3%): 标准运行
- **宽幅震荡** (3-4%): 扩大网格间距，减少订单数
- **高波动** (> 4%): 考虑暂停或仅保留核心层级

### 仓位限制
- 单层最大仓位: 总投资额 × 杠杆 ÷ 网格层数
- 总仓位上限: 总投资额 × 杠杆
- 绝对安全限制: 总投资额 × 杠杆 × 2

## 可用操作

每次决策返回一个 JSON 数组，包含以下操作：

- **place_buy_limit**: 放置限价买单
  \`{"action":"place_buy_limit","price":价格,"quantity":数量,"level":层级序号,"reasoning":"原因"}\`
- **place_sell_limit**: 放置限价卖单
  \`{"action":"place_sell_limit","price":价格,"quantity":数量,"level":层级序号,"reasoning":"原因"}\`
- **cancel_order**: 取消订单
  \`{"action":"cancel_order","orderId":"订单ID","reasoning":"原因"}\`
- **pause_grid**: 暂停网格
  \`{"action":"pause_grid","reasoning":"原因"}\`
- **resume_grid**: 恢复网格
  \`{"action":"resume_grid","reasoning":"原因"}\`
- **adjust_grid**: 调整网格参数（触发重建）
  \`{"action":"adjust_grid","upperPrice":新上界,"lowerPrice":新下界,"reasoning":"原因"}\`
- **hold**: 保持当前状态不变
  \`{"action":"hold","reasoning":"原因"}\`

## 输出格式

只输出 JSON 数组，不要其他文字：
\`\`\`json
[
  {"action":"place_buy_limit","price":100.5,"quantity":0.1,"level":3,"reasoning":"价格接近支撑位"},
  {"action":"cancel_order","orderId":"xxx","reasoning":"价格已远离该层级"}
]
\`\`\`
`;
}

/**
 * 构建网格交易用户提示词
 * 对齐 NoFx grid_engine.go buildGridUserPrompt()
 */
export function buildGridUserPrompt(ctx: GridContext): string {
  const lines: string[] = [];

  // Section 1: 市场数据
  lines.push(`=== 市场数据: ${ctx.symbol} ===`);
  lines.push(`当前价格: ${ctx.currentPrice}`);
  lines.push(`时间: ${ctx.currentTime}`);
  lines.push(`1h 涨跌: ${ctx.priceChange1h > 0 ? '+' : ''}${ctx.priceChange1h.toFixed(2)}%`);
  lines.push(`4h 涨跌: ${ctx.priceChange4h > 0 ? '+' : ''}${ctx.priceChange4h.toFixed(2)}%`);
  lines.push(`24h 成交量: ${ctx.volume24h.toLocaleString()}`);
  lines.push(`资金费率: ${(ctx.fundingRate * 100).toFixed(4)}%`);

  // Section 2: 技术指标
  lines.push('');
  lines.push('--- 技术指标 ---');
  lines.push(`RSI(14): ${ctx.rsi14.toFixed(1)}`);
  lines.push(`MACD: ${ctx.macd.toFixed(4)} | Signal: ${ctx.macdSignal.toFixed(4)} | Histogram: ${ctx.macdHistogram.toFixed(4)}`);
  lines.push(`EMA(20): ${ctx.ema20.toFixed(2)} | EMA(50): ${ctx.ema50.toFixed(2)} | 距离: ${ctx.emaDistance.toFixed(2)}%`);
  lines.push(`ATR(14): ${ctx.atr14.toFixed(4)}`);
  lines.push(`Bollinger: ${ctx.bollingerLower.toFixed(2)} / ${ctx.bollingerMiddle.toFixed(2)} / ${ctx.bollingerUpper.toFixed(2)} (宽度: ${ctx.bollingerWidth.toFixed(2)}%)`);

  // Section 3: 箱体数据
  if (ctx.boxData) {
    lines.push('');
    lines.push('--- Donchian 箱体 ---');
    lines.push(`短期(3d): ${ctx.boxData.shortLower.toFixed(2)} ~ ${ctx.boxData.shortUpper.toFixed(2)}`);
    lines.push(`中期(10d): ${ctx.boxData.midLower.toFixed(2)} ~ ${ctx.boxData.midUpper.toFixed(2)}`);
    lines.push(`长期(21d): ${ctx.boxData.longLower.toFixed(2)} ~ ${ctx.boxData.longUpper.toFixed(2)}`);
  }

  // Section 4: 网格状态
  lines.push('');
  lines.push('--- 网格状态 ---');
  lines.push(`范围: ${ctx.lowerPrice.toFixed(2)} ~ ${ctx.upperPrice.toFixed(2)} | 间距: ${ctx.gridSpacing.toFixed(4)}`);
  lines.push(`分布: ${ctx.distribution} | 方向: ${ctx.currentDirection}`);
  lines.push(`活跃订单: ${ctx.activeOrderCount} | 已成交: ${ctx.filledLevelCount} | 暂停: ${ctx.isPaused ? '是' : '否'}`);

  // Section 5: 网格层级表
  lines.push('');
  lines.push('--- 网格层级 ---');
  lines.push('序号 | 价格 | 方向 | 数量 | 状态 | 盈亏');
  for (let i = 0; i < ctx.levels.length; i++) {
    const l = ctx.levels[i];
    const profitStr = l.profit !== undefined ? `${l.profit > 0 ? '+' : ''}${l.profit.toFixed(4)}` : '-';
    const stateStr = l.state === 'pending' ? '待成交' : l.state === 'filled' ? '已成交' : '已取消';
    lines.push(`${String(i).padStart(3)} | ${l.price.toFixed(4)} | ${l.side === 'buy' ? '买' : '卖'} | ${l.quantity.toFixed(4)} | ${stateStr} | ${profitStr}`);
  }

  // Section 6: 账户状态
  lines.push('');
  lines.push('--- 账户状态 ---');
  lines.push(`总权益: ${ctx.totalEquity.toFixed(2)} USDT`);
  lines.push(`可用余额: ${ctx.availableBalance.toFixed(2)} USDT`);
  lines.push(`当前持仓: ${ctx.currentPosition > 0 ? '+' : ''}${ctx.currentPosition.toFixed(4)}`);
  lines.push(`未实现盈亏: ${ctx.unrealizedPnl > 0 ? '+' : ''}${ctx.unrealizedPnl.toFixed(2)} USDT`);

  // Section 7: 绩效统计
  lines.push('');
  lines.push('--- 绩效 ---');
  lines.push(`累计盈亏: ${ctx.totalProfit > 0 ? '+' : ''}${ctx.totalProfit.toFixed(2)} USDT`);
  lines.push(`今日盈亏: ${ctx.dailyPnl > 0 ? '+' : ''}${ctx.dailyPnl.toFixed(2)} USDT`);
  const winRate = ctx.totalTrades > 0 ? ((ctx.winningTrades / ctx.totalTrades) * 100).toFixed(1) : '0.0';
  lines.push(`交易次数: ${ctx.totalTrades} | 胜率: ${winRate}%`);
  lines.push(`最大回撤: ${ctx.maxDrawdown.toFixed(2)}%`);

  lines.push('');
  lines.push('请根据以上数据输出你的网格操作决策（JSON 数组）。');

  return lines.join('\n');
}
