/**
 * 交易上下文 prompt 构建器
 * 将 nofx-ts 的账户/持仓/风控数据格式化为可注入各角色 prompt 的文本
 */

import type { TradingContextForArena } from '../types/state.js';

/**
 * 为 Trader 构建交易上下文（账户 + 持仓 + 风控约束）
 */
export function buildTraderTradingContext(ctx: TradingContextForArena): string {
  const parts: string[] = [];

  parts.push('--- LIVE TRADING CONTEXT ---');

  // 账户信息
  parts.push(`\nAccount: Equity ${ctx.account_equity.toFixed(2)} USDT | Available ${ctx.available_balance.toFixed(2)} USDT | Margin Used ${ctx.margin_used_pct.toFixed(1)}% | Positions ${ctx.position_count}/${ctx.max_positions}`);

  // 当前持仓
  if (ctx.positions.length > 0) {
    parts.push('\nCurrent Positions:');
    for (const p of ctx.positions) {
      parts.push(`  - ${p.symbol} ${p.side.toUpperCase()} | Entry ${p.entry_price} → Now ${p.mark_price} | Qty ${p.quantity} | PnL ${p.unrealized_pnl_pct >= 0 ? '+' : ''}${p.unrealized_pnl_pct.toFixed(2)}% | ${p.leverage}x leverage`);
    }
  } else {
    parts.push('\nNo open positions.');
  }

  // 风控硬约束
  parts.push('\nRisk Constraints (CODE ENFORCED — backend will reject violations):');
  parts.push(`  - Max Positions: ${ctx.max_positions} coins simultaneously`);
  parts.push(`  - Max Leverage: BTC/ETH ${ctx.btc_eth_max_leverage}x | Altcoins ${ctx.altcoin_max_leverage}x`);
  parts.push(`  - Max Position Value: BTC/ETH ${ctx.btc_eth_max_position_value.toFixed(0)} USDT | Altcoins ${ctx.altcoin_max_position_value.toFixed(0)} USDT`);
  parts.push(`  - Min Position Size: ${ctx.min_position_size} USDT`);
  parts.push(`  - Max Margin Usage: ${ctx.max_margin_usage_pct.toFixed(0)}%`);

  // 推荐约束
  parts.push('\nGuidelines (AI RECOMMENDED):');
  parts.push(`  - Min Risk-Reward Ratio: 1:${ctx.min_risk_reward_ratio.toFixed(1)}`);
  parts.push(`  - Min Confidence: ${ctx.min_confidence}%`);

  parts.push('\n--- END TRADING CONTEXT ---');
  return parts.join('\n');
}

/**
 * 为 Risk Debaters 构建交易上下文（账户 + 持仓 + 风控 + 统计）
 */
export function buildRiskTradingContext(ctx: TradingContextForArena): string {
  const parts: string[] = [];

  parts.push('--- PORTFOLIO STATUS & RISK LIMITS ---');

  // 账户状态
  parts.push(`\nAccount: Equity ${ctx.account_equity.toFixed(2)} USDT | Available ${ctx.available_balance.toFixed(2)} USDT | Total PnL ${ctx.total_pnl_pct >= 0 ? '+' : ''}${ctx.total_pnl_pct.toFixed(2)}% | Margin ${ctx.margin_used_pct.toFixed(1)}%`);

  // 持仓
  if (ctx.positions.length > 0) {
    parts.push(`\nOpen Positions (${ctx.position_count}/${ctx.max_positions}):`);
    for (const p of ctx.positions) {
      parts.push(`  - ${p.symbol} ${p.side.toUpperCase()} | Entry ${p.entry_price} → ${p.mark_price} | PnL ${p.unrealized_pnl_pct >= 0 ? '+' : ''}${p.unrealized_pnl_pct.toFixed(2)}% | ${p.leverage}x`);
    }
  }

  // 风控边界
  parts.push(`\nRisk Limits: Max margin ${ctx.max_margin_usage_pct.toFixed(0)}% | Max leverage BTC/ETH ${ctx.btc_eth_max_leverage}x, Alt ${ctx.altcoin_max_leverage}x | Max positions ${ctx.max_positions}`);

  // 交易统计
  if (ctx.win_rate !== undefined || ctx.profit_factor !== undefined) {
    parts.push('\nHistorical Performance:');
    if (ctx.win_rate !== undefined) parts.push(`  - Win Rate: ${ctx.win_rate.toFixed(1)}%`);
    if (ctx.profit_factor !== undefined) parts.push(`  - Profit Factor: ${ctx.profit_factor.toFixed(2)}`);
    if (ctx.max_drawdown_pct !== undefined) parts.push(`  - Max Drawdown: ${ctx.max_drawdown_pct.toFixed(1)}%`);
  }

  parts.push('\n--- END PORTFOLIO STATUS ---');
  return parts.join('\n');
}

/**
 * 为 Portfolio Manager 构建交易上下文（全部数据）
 */
export function buildPMTradingContext(ctx: TradingContextForArena): string {
  const parts: string[] = [];

  parts.push('--- FULL PORTFOLIO CONTEXT ---');

  // 账户
  parts.push(`\nAccount: Equity ${ctx.account_equity.toFixed(2)} USDT | Available ${ctx.available_balance.toFixed(2)} USDT | Total PnL ${ctx.total_pnl_pct >= 0 ? '+' : ''}${ctx.total_pnl_pct.toFixed(2)}% | Margin ${ctx.margin_used_pct.toFixed(1)}% | Positions ${ctx.position_count}/${ctx.max_positions}`);

  // 持仓详情
  if (ctx.positions.length > 0) {
    parts.push('\nOpen Positions:');
    for (const p of ctx.positions) {
      parts.push(`  - ${p.symbol} ${p.side.toUpperCase()} | Entry ${p.entry_price} → Now ${p.mark_price} | Qty ${p.quantity} | PnL ${p.unrealized_pnl_pct >= 0 ? '+' : ''}${p.unrealized_pnl_pct.toFixed(2)}% | ${p.leverage}x leverage`);
    }
  } else {
    parts.push('\nNo open positions.');
  }

  // 风控约束
  parts.push(`\nRisk Constraints: Max positions ${ctx.max_positions} | Max leverage BTC/ETH ${ctx.btc_eth_max_leverage}x / Alt ${ctx.altcoin_max_leverage}x | Max position BTC/ETH ${ctx.btc_eth_max_position_value.toFixed(0)} / Alt ${ctx.altcoin_max_position_value.toFixed(0)} USDT | Max margin ${ctx.max_margin_usage_pct.toFixed(0)}% | Min size ${ctx.min_position_size} USDT | Min R:R 1:${ctx.min_risk_reward_ratio.toFixed(1)} | Min confidence ${ctx.min_confidence}%`);

  // 历史统计
  if (ctx.win_rate !== undefined || ctx.profit_factor !== undefined) {
    const stats: string[] = [];
    if (ctx.win_rate !== undefined) stats.push(`Win ${ctx.win_rate.toFixed(1)}%`);
    if (ctx.profit_factor !== undefined) stats.push(`PF ${ctx.profit_factor.toFixed(2)}`);
    if (ctx.max_drawdown_pct !== undefined) stats.push(`MaxDD ${ctx.max_drawdown_pct.toFixed(1)}%`);
    parts.push(`\nTrading Stats: ${stats.join(' | ')}`);
  }

  parts.push('\n\nUse this real portfolio data to ground your final decision in actual account constraints.');
  parts.push('\n--- END PORTFOLIO CONTEXT ---');
  return parts.join('\n');
}
