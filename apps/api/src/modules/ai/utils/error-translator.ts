/**
 * 交易所/LLM 错误码映射
 *
 * 后端职责: 将英文技术错误映射为**错误码** (如 EXCHANGE_RESTRICTED)
 * 前端职责: 将错误码通过 i18n 翻译为用户当前语言
 *
 * 格式: `[ERROR_CODE]` — 前端匹配 [] 前缀自动走 i18n
 * 无匹配时: 返回原始 message（前端兜底显示）
 */

interface ErrorPattern {
  pattern: RegExp;
  code: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // ── 交易所地区限制 ──
  { pattern: /restricted location|451|Eligibility|geographically/i, code: 'EXCHANGE_RESTRICTED' },
  // ── 交易所认证 ──
  { pattern: /AuthenticationError|Invalid API|api.?key|signature.*invalid|401/i, code: 'AUTH_FAILED' },
  { pattern: /PermissionDenied|permission|403.*forbidden/i, code: 'PERMISSION_DENIED' },
  // ── 余额/资金 ──
  { pattern: /InsufficientFunds|insufficient.*balance|not enough/i, code: 'INSUFFICIENT_FUNDS' },
  // ── 频率限制 ──
  { pattern: /RateLimitExceeded|rate.?limit|429|Too Many Requests|too.?frequent/i, code: 'RATE_LIMITED' },
  // ── 网络问题 ──
  { pattern: /ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|NetworkError|network.*error|timeout|socket hang up/i, code: 'NETWORK_ERROR' },
  { pattern: /ExchangeNotAvailable|Service.*Unavailable|503|502|maintenance/i, code: 'EXCHANGE_UNAVAILABLE' },
  // ── 订单相关 ──
  { pattern: /InvalidOrder|MIN_NOTIONAL|Quantity.*less|Precision.*over/i, code: 'INVALID_ORDER' },
  { pattern: /OrderNotFound|order.*not.*found/i, code: 'ORDER_NOT_FOUND' },
  // ── LLM 相关 ──
  { pattern: /model.*not.*found|model.*does not exist/i, code: 'MODEL_NOT_FOUND' },
  { pattern: /quota.*exceeded|billing.*limit|credit.*exhausted|insufficient_quota/i, code: 'LLM_QUOTA_EXCEEDED' },
  { pattern: /content.*filter|safety.*filter|moderation/i, code: 'LLM_CONTENT_FILTERED' },
  { pattern: /context.*length.*exceeded|max.*tokens|token.*limit/i, code: 'LLM_CONTEXT_TOO_LONG' },
  // ── 市场数据 ──
  { pattern: /BadSymbol|symbol.*not.*found|market.*not.*found/i, code: 'BAD_SYMBOL' },
  { pattern: /exchangeInfo|loadMarkets/i, code: 'MARKET_INFO_FAILED' },
];

/**
 * 中文错误消息映射 — 仅用于后端 logger 输出（开发者看的日志）
 */
const ERROR_CODE_CN: Record<string, string> = {
  EXCHANGE_RESTRICTED: '交易所地区限制',
  AUTH_FAILED: 'API Key 认证失败',
  PERMISSION_DENIED: 'API Key 权限不足',
  INSUFFICIENT_FUNDS: '余额不足',
  RATE_LIMITED: '请求频率超限',
  NETWORK_ERROR: '网络连接失败',
  EXCHANGE_UNAVAILABLE: '交易所不可用',
  INVALID_ORDER: '订单参数无效',
  ORDER_NOT_FOUND: '订单不存在',
  MODEL_NOT_FOUND: 'AI 模型不可用',
  LLM_QUOTA_EXCEEDED: 'AI 额度用完',
  LLM_CONTENT_FILTERED: 'AI 内容过滤',
  LLM_CONTEXT_TOO_LONG: 'AI 上下文超限',
  BAD_SYMBOL: '交易对不存在',
  MARKET_INFO_FAILED: '市场信息获取失败',
};

/**
 * 将英文技术错误转为错误码（用于用户可见的 DB/WS 存储）
 * 返回格式: `[ERROR_CODE]` — 前端识别后走 i18n
 * 无匹配时: 返回原始 message
 */
export function translateExchangeError(errorMsg: string): string {
  if (!errorMsg) return '[UNKNOWN_ERROR]';

  for (const { pattern, code } of ERROR_PATTERNS) {
    if (pattern.test(errorMsg)) {
      return `[${code}]`;
    }
  }

  // 无匹配 — 返回原始消息（前端直接显示）
  return errorMsg;
}

/**
 * 将英文技术错误转为中文（仅用于后端 logger 日志）
 */
export function translateForLogger(errorMsg: string): string {
  if (!errorMsg) return '未知错误';

  for (const { pattern, code } of ERROR_PATTERNS) {
    if (pattern.test(errorMsg)) {
      return ERROR_CODE_CN[code] || code;
    }
  }

  return errorMsg;
}
