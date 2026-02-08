/**
 * QuantFi API 客户端
 * 用于 TG Bot 调用后端接口
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4001/api';
const BOT_API_SECRET = process.env.TELEGRAM_BOT_API_SECRET || '';

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  requestId: string;
}

// 通用请求方法（自动携带 Bot 密钥）
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(BOT_API_SECRET ? { 'X-Telegram-Bot-Secret': BOT_API_SECRET } : {}),
      ...options.headers,
    },
  });

  const result: ApiResponse<T> = await response.json();

  if (result.code !== 0) {
    throw new Error(result.message);
  }

  return result.data;
}

// 带 Token 的请求
async function authRequest<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {},
): Promise<T> {
  return request<T>(endpoint, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

// ===== API 接口 =====

// 通过 Telegram ID 绑定账户
export interface BindTelegramDto {
  telegramId: string;
  telegramUsername?: string;
  bindCode: string; // 用户在网站上生成的绑定码
}

export interface UserInfo {
  id: string;
  email: string;
  nickname: string;
  usdtBalance: string;
  hootBalance: string;
  pointBalance: string;
  points?: number;
}

export interface EarningsInfo {
  todayPnl: string;
  weekPnl: string;
  monthPnl: string;
  totalPnl: string;
  tradeCount: number;
  winRate: string;
}

export interface PositionInfo {
  id: string;
  symbol: string;
  side: string;
  entryPrice: string;
  amount: string;
  pnl?: string;
  status: string;
}

export interface StrategyInfo {
  id: string;
  name: string;
  description: string;
}

// 绑定 Telegram 账户
export async function bindTelegram(dto: BindTelegramDto): Promise<UserInfo> {
  return request<UserInfo>('/auth/bind-telegram', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

// 通过 Telegram ID 获取用户信息
export async function getUserByTelegramId(
  telegramId: string,
): Promise<UserInfo | null> {
  try {
    return await request<UserInfo>(`/auth/telegram/${telegramId}`);
  } catch {
    return null;
  }
}

// 获取用户持仓（需要 JWT Token，但 TG Bot 用内部 API）
export async function getPositionsByTelegramId(
  telegramId: string,
): Promise<PositionInfo[]> {
  return request<PositionInfo[]>(`/trading/positions/telegram/${telegramId}`);
}

// 获取策略列表
export async function getStrategies(): Promise<StrategyInfo[]> {
  return request<StrategyInfo[]>('/strategies');
}

// 发送交易通知（后端调用此方法推送通知给用户）
export interface TradeNotification {
  telegramId: string;
  type: 'open' | 'close';
  symbol: string;
  side: string;
  price: string;
  amount: string;
  pnl?: string;
}

// 获取用户收益统计
export async function getEarningsByTelegramId(
  telegramId: string,
): Promise<EarningsInfo> {
  try {
    return await request<EarningsInfo>(`/trading/positions/earnings/telegram/${telegramId}`);
  } catch {
    // 如果接口不存在，返回默认值
    return {
      todayPnl: '0',
      weekPnl: '0',
      monthPnl: '0',
      totalPnl: '0',
      tradeCount: 0,
      winRate: '0',
    };
  }
}

// ===== 自动登录 API =====

export interface TelegramLoginDto {
  telegramId: string;
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
  referralCode?: string; // 深度链接邀请码 (start=ref_XXX)
}

export interface LoginResponse {
  accessToken: string;
  user: UserInfo;
  isNewUser?: boolean;
}

// TG 自动登录（如果用户不存在会自动注册）
export async function telegramLogin(dto: TelegramLoginDto): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/telegram/login', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

// 获取完整用户信息（包含绑定状态）
export async function getFullProfile(token: string) {
  return authRequest<{
    id: string;
    email?: string;
    emailVerified: boolean;
    nickname?: string;
    telegramId?: string;
    telegramUsername?: string;
    walletAddress?: string;
    usdtBalance: string;
    hootBalance: string;
    lockedBalance: string;
    availableBalance: string;
    bindings: {
      email: boolean;
      emailVerified: boolean;
      telegram: boolean;
      wallet: boolean;
    };
  }>('/auth/profile', token);
}

// ===== 签到 API =====

export interface CheckinResult {
  success: boolean;
  reward: number;
  streak: number;
  message: string;
}

export interface CheckinStatus {
  checkedInToday: boolean;
  streak: number;
  todayReward: string | null;
  nextReward: string;
}

// 每日签到（通过 TG ID）
export async function checkinByTelegramId(telegramId: string): Promise<CheckinResult> {
  // 先登录获取 token
  const loginResult = await telegramLogin({ telegramId });
  // 调用签到接口
  return authRequest<CheckinResult>('/airdrop/checkin', loginResult.accessToken, {
    method: 'POST',
  });
}

// 获取签到状态
export async function getCheckinStatus(telegramId: string): Promise<CheckinStatus> {
  const loginResult = await telegramLogin({ telegramId });
  return authRequest<CheckinStatus>('/airdrop/checkin/status', loginResult.accessToken);
}

// ===== 邀请 API =====

export interface InviteInfo {
  inviteCode: string;
  inviteLink: string;
  inviteeCount: number;
  totalReward: string;
}

// 获取邀请信息
export async function getInviteInfo(telegramId: string): Promise<InviteInfo> {
  const loginResult = await telegramLogin({ telegramId });
  return authRequest<InviteInfo>('/referral/info', loginResult.accessToken);
}

// ===== 我的订阅 API =====

export interface MySubscription {
  id: string;
  strategy: {
    id: string;
    name: string;
    description: string;
  };
  apiKeyId: string;
  amountPerTrade: string;
  maxPositions: number;
  isActive: boolean;
  createdAt: string;
}

// 获取我的订阅列表
export async function getMySubscriptions(telegramId: string): Promise<MySubscription[]> {
  const loginResult = await telegramLogin({ telegramId });
  return authRequest<MySubscription[]>('/strategies/my/subscriptions', loginResult.accessToken);
}

// 切换订阅状态（启用/停用）
export async function toggleSubscription(
  telegramId: string,
  subscriptionId: string,
  isActive: boolean,
): Promise<{ id: string; isActive: boolean }> {
  const loginResult = await telegramLogin({ telegramId });
  return authRequest<{ id: string; isActive: boolean }>(
    `/strategies/subscription/${subscriptionId}/toggle`,
    loginResult.accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    },
  );
}

// ===== 紧急平仓 API =====

// 关闭所有持仓
export async function closeAllPositions(
  telegramId: string,
  apiKeyId: string,
): Promise<{ closedCount: number; totalProfit?: string }> {
  const loginResult = await telegramLogin({ telegramId });
  return authRequest<{ closedCount: number; totalProfit?: string }>(
    '/trading/positions/close-all',
    loginResult.accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ apiKeyId }),
    },
  );
}

// ===== 交易所余额 API =====

export interface ApiKeyInfo {
  id: string;
  exchange: string;
  label: string;
  maskedKey: string;
  isActive: boolean;
  createdAt: string;
}

export interface ExchangeBalance {
  balance: number;
  spotBalance: number;
  futuresBalance: number;
  valid: boolean;
}

// 获取用户 API Keys 列表
export async function getApiKeys(telegramId: string): Promise<{ items: ApiKeyInfo[]; total: number }> {
  const loginResult = await telegramLogin({ telegramId });
  return authRequest<{ items: ApiKeyInfo[]; total: number }>('/api-keys', loginResult.accessToken);
}

// 获取某个 API Key 的交易所余额
export async function getApiKeyBalance(telegramId: string, apiKeyId: string): Promise<ExchangeBalance> {
  const loginResult = await telegramLogin({ telegramId });
  return authRequest<ExchangeBalance>(`/api-keys/${apiKeyId}/balance`, loginResult.accessToken);
}

// ===== 交易历史 API =====

export interface TradeHistory {
  id: string;
  symbol: string;
  side: string;
  entryPrice: string;
  closePrice: string;
  amount: string;
  pnl: string;
  pnlPercent?: string;
  status: string;
  closedAt: string;
  strategyName?: string;
  closeReason?: string;
}

// 获取交易历史
export async function getTradeHistory(
  telegramId: string,
  limit: number = 10,
): Promise<TradeHistory[]> {
  const loginResult = await telegramLogin({ telegramId });
  return authRequest<TradeHistory[]>(
    `/trading/positions/history?limit=${limit}`,
    loginResult.accessToken,
  );
}

// ===== 执行日志 API =====

export interface TradeLog {
  id: string;
  time: string;
  strategy: string;
  action: string;
  symbol: string;
  status: 'success' | 'warning' | 'error';
  message: string;
}

// 获取执行日志
export async function getTradeLogs(
  telegramId: string,
  limit: number = 20,
): Promise<TradeLog[]> {
  const loginResult = await telegramLogin({ telegramId });
  return authRequest<TradeLog[]>(
    `/trading/positions/logs?limit=${limit}`,
    loginResult.accessToken,
  );
}
