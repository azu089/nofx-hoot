/**
 * QuantFi API 客户端
 * 用于 TG Bot 调用后端接口
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4001/api';

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  requestId: string;
}

// 通用请求方法
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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
  return request<PositionInfo[]>(`/positions/telegram/${telegramId}`);
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
