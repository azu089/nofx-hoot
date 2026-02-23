/**
 * AI 错误消息前端翻译 — 将后端错误码/原始错误转为当前语言
 *
 * 后端存储格式:
 *   - 错误码: `[ERROR_CODE]` (如 `[EXCHANGE_RESTRICTED]`)
 *   - 旧数据/未匹配: 原始英文/中文 message
 *
 * 前端翻译逻辑:
 *   1. 检测 `[ERROR_CODE]` 格式 → 查 i18n key
 *   2. 模式匹配英文关键词 → 查 i18n key (兼容旧数据)
 *   3. 无匹配 → 原样返回
 *
 * 使用方式:
 *   const te = useTranslations('errors');
 *   translateErrorForDisplay(errorMsg, te);
 */

// 错误码 → i18n key 映射（key 相对于 errors 命名空间）
const CODE_TO_KEY: Record<string, string> = {
  EXCHANGE_RESTRICTED: 'exchangeRestricted',
  AUTH_FAILED: 'authFailed',
  PERMISSION_DENIED: 'permissionDenied',
  INSUFFICIENT_FUNDS: 'insufficientFunds',
  RATE_LIMITED: 'rateLimited',
  NETWORK_ERROR: 'networkError',
  EXCHANGE_UNAVAILABLE: 'exchangeUnavailable',
  INVALID_ORDER: 'invalidOrder',
  ORDER_NOT_FOUND: 'orderNotFound',
  MODEL_NOT_FOUND: 'modelNotFound',
  LLM_QUOTA_EXCEEDED: 'llmQuotaExceeded',
  LLM_CONTENT_FILTERED: 'llmContentFiltered',
  LLM_CONTEXT_TOO_LONG: 'llmContextTooLong',
  BAD_SYMBOL: 'badSymbol',
  MARKET_INFO_FAILED: 'marketInfoFailed',
  UNKNOWN_ERROR: 'unknownError',
};

// 英文/中文模式匹配 — 兼容旧数据（后端未转错误码的历史数据）
const FALLBACK_PATTERNS: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /restricted location|451|Eligibility|地区不可用/i, key: 'exchangeRestricted' },
  { pattern: /AuthenticationError|Invalid API|api.?key|认证失败/i, key: 'authFailed' },
  { pattern: /PermissionDenied|403.*forbidden|权限不足/i, key: 'permissionDenied' },
  { pattern: /InsufficientFunds|insufficient.*balance|余额不足/i, key: 'insufficientFunds' },
  { pattern: /RateLimitExceeded|rate.?limit|429|频率超限/i, key: 'rateLimited' },
  { pattern: /ETIMEDOUT|ECONNRESET|NetworkError|timeout|socket hang up|fetch failed|网络连接失败|获取价格失败/i, key: 'networkError' },
  { pattern: /ExchangeNotAvailable|Service.*Unavailable|503|502|暂时不可用/i, key: 'exchangeUnavailable' },
  { pattern: /InvalidOrder|MIN_NOTIONAL|订单参数无效/i, key: 'invalidOrder' },
  { pattern: /model.*not.*found|模型不可用/i, key: 'modelNotFound' },
  { pattern: /quota.*exceeded|insufficient_quota|额度已用完/i, key: 'llmQuotaExceeded' },
  { pattern: /BadSymbol|symbol.*not.*found|交易对不存在/i, key: 'badSymbol' },
  { pattern: /exchangeInfo|loadMarkets|市场信息.*失败/i, key: 'marketInfoFailed' },
];

/**
 * 将错误消息翻译为用户当前语言
 * @param errorMsg 后端返回的 errorMessage 字段
 * @param t i18n 翻译函数 — 必须是 useTranslations('errors') 返回的
 * @returns 翻译后的用户友好错误消息
 */
export function translateErrorForDisplay(
  errorMsg: string | null | undefined,
  t: (key: string) => string,
): string {
  if (!errorMsg) return t('unknownError');

  // 1. 检测 [ERROR_CODE] 格式（精确匹配整个字符串）
  const codeMatch = errorMsg.match(/^\[([A-Z_]+)\]$/);
  if (codeMatch) {
    const key = CODE_TO_KEY[codeMatch[1]];
    if (key) return t(key);
  }

  // 2. 检测嵌入的 [ERROR_CODE]（如 "获取市场数据失败: [EXCHANGE_RESTRICTED]"）
  const embeddedMatch = errorMsg.match(/\[([A-Z_]+)\]/);
  if (embeddedMatch) {
    const key = CODE_TO_KEY[embeddedMatch[1]];
    if (key) return t(key);
  }

  // 3. 英文/中文模式匹配（兼容旧数据）
  for (const { pattern, key } of FALLBACK_PATTERNS) {
    if (pattern.test(errorMsg)) {
      return t(key);
    }
  }

  // 4. 无匹配 — 脱敏后返回（移除 URL、API 路径等技术细节）
  return errorMsg
    .replace(/https?:\/\/[^\s]+/g, '')      // 移除 URL
    .replace(/\b[A-Z]+ \/[^\s]+/g, '')      // 移除 "GET /api/..." 路径
    .replace(/\s{2,}/g, ' ')                 // 合并多余空格
    .trim() || t('unknownError');
}
