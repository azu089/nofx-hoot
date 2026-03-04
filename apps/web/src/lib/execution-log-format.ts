/**
 * 执行日志格式化工具
 * 后端返回英文 key，前端通过此工具映射到 i18n 翻译 + badge 样式
 */

/** action key → badge CSS class */
export const ACTION_STYLE: Record<string, string> = {
  open_long: 'bg-green-400/10 text-green-400',
  open_short: 'bg-red-400/10 text-red-400',
  close: 'bg-cyan-400/10 text-cyan-400',
  close_long: 'bg-cyan-400/10 text-cyan-400',
  close_short: 'bg-cyan-400/10 text-cyan-400',
  hold: 'bg-[#9090A0]/10 text-[#9090A0]',
  wait: 'bg-[#9090A0]/10 text-[#9090A0]',
  skip: 'bg-yellow-400/10 text-yellow-400',
  fail: 'bg-red-400/10 text-red-400',
  execute: 'bg-blue-400/10 text-blue-400',
  adjust_grid: 'bg-emerald-400/10 text-emerald-400',
  place_buy_limit: 'bg-green-400/10 text-green-400',
  place_sell_limit: 'bg-red-400/10 text-red-400',
  pause_grid: 'bg-yellow-400/10 text-yellow-400',
  resume_grid: 'bg-green-400/10 text-green-400',
  reduce: 'bg-orange-400/10 text-orange-400',
  add: 'bg-blue-400/10 text-blue-400',
};

/** action key → i18n key (ai 命名空间，实际路径 ai.detail.xxx) */
const ACTION_I18N: Record<string, string> = {
  open_long: 'detail.actionOpenLong',
  open_short: 'detail.actionOpenShort',
  close_long: 'detail.actionCloseLong',
  close_short: 'detail.actionCloseShort',
  close: 'detail.actionClose',
  hold: 'detail.actionHold',
  wait: 'detail.actionWait',
  skip: 'detail.actionSkip',
  fail: 'detail.actionFail',
  execute: 'detail.actionExecute',
  adjust_grid: 'detail.actionGridAdjust',
  place_buy_limit: 'detail.actionGridPlaceBuy',
  place_sell_limit: 'detail.actionGridPlaceSell',
  pause_grid: 'detail.actionGridPause',
  resume_grid: 'detail.actionGridResume',
  reduce: 'detail.actionReduce',
  add: 'detail.actionAdd',
};

/** closeReason key → i18n key (trading.closeReason 命名空间) */
const CLOSE_REASON_I18N: Record<string, string> = {
  stop_loss: 'stopLoss',
  take_profit: 'takeProfit',
  trailing_stop: 'trailingStop',
  ai_decision: 'aiDecision',
  ai_stop_loss: 'aiStopLoss',
  ai_take_profit: 'aiTakeProfit',
  signal: 'signal',
  manual: 'manual',
  manual_cleanup: 'manualCleanup',
  black_swan: 'blackSwan',
  daily_loss_limit: 'dailyLossLimit',
  drawdown_limit: 'drawdownLimit',
  not_found_on_exchange: 'notFoundOnExchange',
  position_sync: 'positionSync',
  liquidation: 'liquidation',
};

/** 获取 action 的 badge 样式 */
export function getActionBadgeStyle(action: string): string {
  return ACTION_STYLE[action] || 'bg-yellow-400/10 text-yellow-400';
}

/** 获取 action 的 i18n 显示文字 (t 来自 useTranslations('ai')) */
export function getActionText(action: string, t: (k: string) => string): string {
  const key = ACTION_I18N[action];
  return key ? t(key) : action;
}

/** 获取 closeReason 的 i18n 显示文字 (t 来自 useTranslations('trading')) */
export function getCloseReasonText(reason: string, t: (k: string) => string): string {
  const key = CLOSE_REASON_I18N[reason];
  return key ? t(`closeReason.${key}`) : reason;
}

/**
 * 格式化 gridSummary: "3B/2S/1C" → "3买/2卖/撤1" (跟随语言)
 * t 来自 useTranslations('ai')
 */
export function formatGridSummary(raw: string, t: (k: string, params?: Record<string, string | number>) => string): string {
  if (!raw) return '';
  return raw
    .replace(/(\d+)B/g, (_, n) => t('detail.gridBuy', { count: n }))
    .replace(/(\d+)S/g, (_, n) => t('detail.gridSell', { count: n }))
    .replace(/(\d+)C/g, (_, n) => t('detail.gridCancel', { count: n }))
    .replace(/(\d+)ops/g, (_, n) => t('detail.gridOps', { count: n }))
    .replace(/place_buy_limit/g, t('detail.actionGridPlaceBuy'))
    .replace(/place_sell_limit/g, t('detail.actionGridPlaceSell'))
    .replace(/adjust_grid/g, t('detail.actionGridAdjust'))
    .replace(/pause_grid/g, t('detail.actionGridPause'))
    .replace(/resume_grid/g, t('detail.actionGridResume'))
    .replace(/hold/g, t('detail.actionHold'))
    .replace(/reduce_position/g, t('detail.actionReduce'))
    .replace(/adjust_direction/g, t('detail.actionGridDirection'))
    .replace(/close_all/g, t('detail.actionGridCloseAll'));
}

/**
 * 翻译 log.message 字段中的英文 action 名
 * 后端格式: "AI: place_buy_limit SOL/USDT 1B/1S"
 */
export function formatLogMessage(
  message: string,
  t: (k: string, params?: Record<string, string | number>) => string,
): string {
  if (!message) return message;
  return message
    .replace(/\bplace_buy_limit\b/g, t('detail.actionGridPlaceBuy'))
    .replace(/\bplace_sell_limit\b/g, t('detail.actionGridPlaceSell'))
    .replace(/\badjust_grid\b/g, t('detail.actionGridAdjust'))
    .replace(/\bpause_grid\b/g, t('detail.actionGridPause'))
    .replace(/\bresume_grid\b/g, t('detail.actionGridResume'))
    .replace(/\bopen_long\b/g, t('detail.actionOpenLong'))
    .replace(/\bopen_short\b/g, t('detail.actionOpenShort'))
    .replace(/\bclose_long\b/g, t('detail.actionCloseLong'))
    .replace(/\bclose_short\b/g, t('detail.actionCloseShort'))
    .replace(/(\d+)B\b/g, (_, n) => t('detail.gridBuy', { count: n }))
    .replace(/(\d+)S\b/g, (_, n) => t('detail.gridSell', { count: n }));
}
