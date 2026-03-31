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
  // 阿里云 / DashScope：账号欠费或无访问权限（"400 Access denied, account is not in good standing"）
  { pattern: /400.*[Aa]ccess [Dd]enied|[Aa]ccess [Dd]enied.*account|overdue.?payment|account.*good standing/i, key: 'llmQuotaExceeded' },
  // class-validator 参数验证错误
  { pattern: /property .+ should not exist|must be a string|must not be less than|must be an? |Validation failed|Bad Request/i, key: 'validationFailed' },
];

// ─── 交易所订单错误翻译（Binance / OKX / CCXT 原始错误消息） ───────────

/**
 * OKX 错误码 → i18n key 映射
 * OKX 错误格式: {"code":"1","data":[{"sCode":"51000","sMsg":"Parameter xxx error",...}],...}
 * 注意：OKX 将具体错误放在 data[0].sCode / data[0].sMsg，顶层 code 固定为 "1"
 */
const OKX_SCODE_TO_KEY: Record<string, string> = {
  '51000': 'orderParamInvalid',     // Parameter xxx error（如 clOrdId 格式不对）
  '51001': 'badSymbol',             // Instrument does not exist
  '51002': 'badSymbol',             // Instrument ID does not exist
  '51004': 'orderMinNotional',      // Order amount below minimum
  '51006': 'orderPriceInvalid',     // Order price error
  '51008': 'insufficientFunds',     // Insufficient balance
  '51010': 'okxAccountMode',         // You can't complete this under your current account mode（账户未开通合约）
  '51020': 'marginInsufficient',    // Margin not enough
  '51100': 'orderMaxCount',         // Trade count exceeds the limit
  '51116': 'orderMinQty',           // Order quantity too small
  '51131': 'orderMinNotional',      // Order amount less than minimum
  '50001': 'authFailed',            // Authentication failed
  '50011': 'rateLimited',           // Rate limit reached
  '50013': 'exchangeUnavailable',   // System busy
  '58350': 'insufficientFunds',     // Insufficient funds
};

/**
 * Binance 错误码 → i18n key 映射
 * 错误码来源: Binance API 返回 {"code":-XXXX,"msg":"..."}
 */
const EXCHANGE_CODE_TO_KEY: Record<number, string> = {
  // 订单相关
  '-1013': 'orderMinNotional',     // MIN_NOTIONAL: 最小名义价值不足
  '-4131': 'orderMinNotional',     // MIN_NOTIONAL (USDT-M Futures)
  '-2019': 'marginInsufficient',   // Margin is insufficient
  '-1102': 'orderParamInvalid',    // Mandatory parameter was not sent
  '-1111': 'orderPrecision',       // Precision is over the maximum defined
  '-2022': 'orderReduceOnly',      // ReduceOnly Order is rejected
  '-4164': 'orderMinQty',          // MIN_QTY: 最小数量不足
  '-1121': 'badSymbol',            // Invalid symbol
  '-4003': 'orderQtyInvalid',      // Quantity less than zero
  '-4014': 'orderPriceInvalid',    // Price less than min price
  '-4015': 'orderPriceInvalid',    // Price greater than max price
  '-2018': 'insufficientFunds',    // Balance is insufficient
  '-1015': 'rateLimited',          // Too many orders
  '-4061': 'orderPositionSide',    // BOTH position side not allowed with hedgeMode
};

/**
 * 交易所原始 msg 文本匹配 → i18n key
 * 兜底：无错误码但有英文消息时使用
 */
const EXCHANGE_MSG_PATTERNS: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /notional must be no smaller than|MIN_NOTIONAL/i, key: 'orderMinNotional' },
  { pattern: /Margin is insufficient/i, key: 'marginInsufficient' },
  { pattern: /insufficient.*balance|Balance is insufficient/i, key: 'insufficientFunds' },
  { pattern: /ReduceOnly.*rejected/i, key: 'orderReduceOnly' },
  { pattern: /Precision is over/i, key: 'orderPrecision' },
  { pattern: /Quantity.*less.*zero|qty.*invalid/i, key: 'orderQtyInvalid' },
  { pattern: /Price.*less.*min|Price.*greater.*max/i, key: 'orderPriceInvalid' },
  { pattern: /position side/i, key: 'orderPositionSide' },
  { pattern: /Too many.*order|rate.?limit/i, key: 'rateLimited' },
  { pattern: /Invalid symbol|symbol.*not.*found/i, key: 'badSymbol' },
  { pattern: /Mandatory parameter/i, key: 'orderParamInvalid' },
  { pattern: /MAX_NUM_ORDERS/i, key: 'orderMaxCount' },
  { pattern: /LOT_SIZE/i, key: 'orderLotSize' },
  { pattern: /PRICE_FILTER/i, key: 'orderPriceInvalid' },
];

/**
 * 翻译交易所原始订单错误（适用于 timeline card 中的执行结果错误）
 *
 * 输入格式：
 *   - CCXT 透传: `binanceusdm {"code":-1013,"msg":"Order's notional must be no smaller than 20..."}`
 *   - 纯 JSON: `{"code":-2019,"msg":"Margin is insufficient."}`
 *   - 纯文本: `InsufficientFunds: insufficient balance`
 *
 * @param rawError 交易所原始错误字符串
 * @param t i18n 翻译函数 — 必须是 useTranslations('errors') 返回的
 * @returns 翻译后的用户友好错误消息
 */
export function translateExchangeOrderError(
  rawError: string | null | undefined,
  t: (key: string) => string,
): string {
  if (!rawError) return t('unknownError');

  // 1. 提取 Binance 错误码（负数）
  const codeMatch = rawError.match(/"code":\s*(-?\d+)/);
  if (codeMatch) {
    const code = parseInt(codeMatch[1]);
    const key = EXCHANGE_CODE_TO_KEY[code];
    if (key) return t(key);
  }

  // 1.5. OKX 错误：从 data[].sCode 提取
  // 格式: {"code":"1","data":[{"sCode":"51000","sMsg":"Parameter clOrdId error",...}],...}
  const sCodeMatch = rawError.match(/"sCode"\s*:\s*"(\d+)"/);
  if (sCodeMatch) {
    const sCode = sCodeMatch[1];
    const sMsgMatch = rawError.match(/"sMsg"\s*:\s*"([^"]*)"/);
    const sMsg = sMsgMatch ? sMsgMatch[1] : '';
    const okxKey = OKX_SCODE_TO_KEY[sCode];
    if (okxKey) return t(okxKey);
    // 无精确映射 — 尝试用 sMsg 做模式匹配
    for (const { pattern, key } of EXCHANGE_MSG_PATTERNS) {
      if (sMsg && pattern.test(sMsg)) return t(key);
    }
    // sMsg 非空则显示截断文本，否则继续
    if (sMsg) return sMsg.slice(0, 60);
  }

  // 2. 提取 "msg":"..." 内容后做模式匹配
  const msgMatch = rawError.match(/"msg"\s*:\s*"([^"]+)"/);
  const msgText = msgMatch ? msgMatch[1] : rawError;

  for (const { pattern, key } of EXCHANGE_MSG_PATTERNS) {
    if (pattern.test(msgText)) {
      return t(key);
    }
  }

  // 3. 对整个原始字符串尝试通用 FALLBACK_PATTERNS
  for (const { pattern, key } of FALLBACK_PATTERNS) {
    if (pattern.test(rawError)) {
      return t(key);
    }
  }

  // 3.5. 后端分类前缀兜底（来自 classifyExchangeError() 添加的中文标签）
  if (/\[认证失败\]/.test(rawError)) return t('authFailed');
  if (/\[API限流\]/.test(rawError)) return t('rateLimited');
  if (/\[网络问题\]/.test(rawError)) return t('networkError');
  if (/\[风控限制\]/.test(rawError)) return t('exchangeRestricted');
  if (/\[PostOnly拒绝\]/.test(rawError)) return t('postOnlyRejected');
  if (/\[交易所拒绝\]/.test(rawError)) return t('invalidOrder');

  // 4. 无匹配 — 返回提取的 msg 或截断的原始文本
  const displayMsg = msgMatch
    ? msgMatch[1].slice(0, 60)
    : rawError.replace(/^binanceusdm\s*/, '').replace(/^okx\s*/, '').slice(0, 60);
  return displayMsg || t('unknownError');
}

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
