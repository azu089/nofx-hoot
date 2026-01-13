import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// API 基础 URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api';

// 创建 axios 实例
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token 管理
const TOKEN_KEY = 'quantfi_token';
const REFRESH_TOKEN_KEY = 'quantfi_refresh_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function removeRefreshToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// 清除所有 token
export function clearTokens(): void {
  removeToken();
  removeRefreshToken();
}

// 正在刷新 token 的标志
let isRefreshing = false;
// 等待刷新的请求队列
let refreshSubscribers: Array<(token: string) => void> = [];

// 订阅 token 刷新
function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

// 通知所有订阅者
function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers = [];
}

// 刷新 token
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken,
    });

    const { accessToken, refreshToken: newRefreshToken } = response.data.data;
    setToken(accessToken);
    setRefreshToken(newRefreshToken);
    return accessToken;
  } catch {
    // 刷新失败，清除所有 token
    clearTokens();
    return null;
  }
}

// 请求拦截器：添加 token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：处理错误和自动刷新 token
api.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError<{ code: number; message: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // 401 未授权，尝试刷新 token
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 如果是刷新 token 的请求失败，直接跳转登录
      if (originalRequest.url?.includes('/auth/refresh')) {
        clearTokens();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      // 标记为已重试
      originalRequest._retry = true;

      // 如果正在刷新，等待刷新完成
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const newToken = await refreshAccessToken();
        isRefreshing = false;

        if (newToken) {
          // 通知其他等待的请求
          onTokenRefreshed(newToken);
          // 重试原始请求
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return api(originalRequest);
        } else {
          // 刷新失败，跳转登录
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
        }
      } catch {
        isRefreshing = false;
        clearTokens();
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }

    // 返回统一错误格式
    const message = error.response?.data?.message || error.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

// API 响应类型
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  request_id?: string;
}

// 设备指纹类型
export interface DeviceFingerprintData {
  hash: string;
  components?: {
    userAgent?: string;
    language?: string;
    platform?: string;
    timezone?: string;
    screenResolution?: string;
    colorDepth?: number;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    canvas?: string;
    webgl?: string;
  };
}

// Auth API
export const authApi = {
  login: (email: string, password: string, fingerprint?: DeviceFingerprintData) =>
    api.post<never, ApiResponse<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      access_token?: string;
      user: { id: string; email: string; vipLevel: number };
      fingerprintCheck?: {
        isNew: boolean;
        isSuspicious: boolean;
        suspiciousReason?: string;
        riskLevel: 'low' | 'medium' | 'high';
      };
    }>>('/auth/login', { email, password, fingerprint }),

  register: (email: string, password: string, verificationCode: string, inviteCode?: string, fingerprint?: DeviceFingerprintData) =>
    api.post<never, ApiResponse<{ id: string; email: string }>>('/auth/register', {
      email,
      password,
      verificationCode,
      inviteCode,
      fingerprint,
    }),

  me: () => api.get<never, ApiResponse<{ id: string; email: string; vip_level: number }>>('/auth/me'),

  refresh: (refreshToken: string) =>
    api.post<never, ApiResponse<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>>('/auth/refresh', { refreshToken }),

  // 2FA 相关
  getTotpStatus: () =>
    api.get<never, ApiResponse<{ enabled: boolean; enabledAt?: string }>>('/auth/totp/status'),

  setupTotp: () =>
    api.get<never, ApiResponse<{ secret: string; uri: string; qrCode: string }>>('/auth/totp/setup'),

  enableTotp: (token: string, secret: string) =>
    api.post<never, ApiResponse<void>>('/auth/totp/enable', { token, secret }),

  disableTotp: (token: string, password: string) =>
    api.post<never, ApiResponse<void>>('/auth/totp/disable', { token, password }),

  verifyTotp: (token: string) =>
    api.post<never, ApiResponse<{ verified: boolean }>>('/auth/totp/verify', { token }),

  // 设备管理
  getDevices: () =>
    api.get<never, ApiResponse<Array<{
      hash: string;
      createdAt: string;
      lastSeenAt: string;
      loginCount: number;
      browser: string;
      os: string;
    }>>>('/auth/devices'),

  removeDevice: (hash: string) =>
    api.post<never, ApiResponse<void>>('/auth/devices/remove', { hash }),

  clearAllDevices: () =>
    api.post<never, ApiResponse<void>>('/auth/devices/clear'),
};

// User API
export const userApi = {
  getProfile: () =>
    api.get<never, ApiResponse<{
      id: string;
      email: string;
      vip_level: number;
      vip_expires_at: string | null;
      usdt_balance: string;
      point_balance: string;
    }>>('/users/profile'),

  updateProfile: (data: { password?: string }) =>
    api.patch<never, ApiResponse<void>>('/users/profile', data),

  getWallet: () =>
    api.get<never, ApiResponse<{
      id: string;
      usdt_balance: string;
      usdt_frozen: string;
      card_balance: string;
      points_balance: string;
      points_frozen: string;
      points_locked: string;
      token_balance: string;
      token_locked: string;
      token_vesting: string;
    }>>('/wallets/me'),

  // 邀请返佣相关
  getInviteInfo: () =>
    api.get<never, ApiResponse<{
      inviteCode: string;
      inviteLink: string;
    }>>('/users/referral/info'),

  getInviteStats: () =>
    api.get<never, ApiResponse<{
      totalInvites: number;
      activeUsers: number;
      totalCommission: string;
      pendingCommission: string;
      recentInvites: Array<{
        id: string;
        email: string;
        createdAt: string;
        status: string;
        commission: string;
      }>;
    }>>('/users/referral/stats'),

  getInvitedUsers: () =>
    api.get<never, ApiResponse<Array<{
      id: string;
      email: string;
      createdAt: string;
      status: string;
      totalSpent: string;
      totalCommission: string;
    }>>>('/users/referral/list'),

  // 获取团队成员（一级/二级）
  getTeamMembers: (level?: number) =>
    api.get<never, ApiResponse<{
      level1: Array<{
        id: string;
        email: string;
        status: string;
        vipLevel: number;
        createdAt: string;
        commission: string;
        level: number;
      }>;
      level2: Array<{
        id: string;
        email: string;
        status: string;
        vipLevel: number;
        createdAt: string;
        commission: string;
        level: number;
        referrerEmail?: string;
      }>;
      total: number;
      level1Count: number;
      level2Count: number;
    }>>(`/users/referral/team${level ? `?level=${level}` : ''}`),

  getLoginLogs: () =>
    api.get<never, ApiResponse<Array<{
      id: string;
      ip: string;
      device: string;
      location: string;
      time: string;
      status: string;
    }>>>('/users/login-logs'),

  // 获取公告列表（用户端）
  getAnnouncements: () =>
    api.get<never, ApiResponse<Array<{
      id: string;
      title: string;
      content: string;
      type: string;
      publishedAt: string | null;
      createdAt: string;
    }>>>('/announcements'),
};

// Instances API
export const instancesApi = {
  list: () =>
    api.get<never, ApiResponse<Array<{
      id: string;
      status: string;
      ip_address: string;
      region: string;
      cpu_usage: string | null;
      memory_usage: string | null;
      last_heartbeat: string | null;
    }>>>('/instances'),

  detail: (id: string) =>
    api.get<never, ApiResponse<{
      id: string;
      status: string;
      ip_address: string;
      region: string;
      cpu_usage: string | null;
      memory_usage: string | null;
      disk_usage: string | null;
      current_strategy: string | null;
      created_at: string;
      last_heartbeat: string | null;
    }>>(`/instances/${id}`),

  // 购买订阅（唯一入口，VPS 自动创建）
  subscribe: (region?: string, usePoints?: boolean) =>
    api.post<never, ApiResponse<{
      subscription: { vipLevel: number; expiresAt: string; fee: string };
      instance: { id: string; status: string };
    }>>('/instances/subscribe', { region, usePoints }),

  // 心跳上报（VPS 内部调用）
  heartbeat: (id: string, data: { cpu_usage?: string; memory_usage?: string }) =>
    api.post<never, ApiResponse<{ id: string }>>(`/instances/${id}/heartbeat`, data),

  // Freqtrade 状态
  getStatus: (id: string) =>
    api.get<never, ApiResponse<{
      state: string;
      runmode: string;
      strategy: string;
      available_balance?: number;
      stake_amount?: number;
      max_open_trades?: number;
    }>>(`/instances/${id}/status`),

  getBalance: (id: string) =>
    api.get<never, ApiResponse<{
      currencies: Array<{
        currency: string;
        free: number;
        balance: number;
        used: number;
        est_stake: number;
      }>;
      total: number;
    }>>(`/instances/${id}/balance`),

  getTrades: (id: string) =>
    api.get<never, ApiResponse<Array<{
      trade_id: number;
      pair: string;
      is_open: boolean;
      fee_open: number;
      fee_close: number;
      open_rate: number;
      close_rate: number | null;
      amount: number;
      stake_amount: number;
      close_profit: number | null;
      close_profit_abs: number | null;
      open_date: string;
      close_date: string | null;
    }>>>(`/instances/${id}/trades`),

  // === 紧急操作（Panic 功能保留）===

  // 强制平仓单个交易
  forceExit: (id: string, tradeId?: string) =>
    api.post<never, ApiResponse<{ trade_id: string }>>(`/instances/${id}/force-exit`, {
      trade_id: tradeId,
    }),

  // 停止单个实例
  stop: (id: string) =>
    api.post<never, ApiResponse<{ id: string; status: string }>>(`/instances/${id}/stop`),

  // 启动单个实例
  start: (id: string) =>
    api.post<never, ApiResponse<{ id: string; status: string }>>(`/instances/${id}/start`),

  // 重启单个实例
  restart: (id: string) =>
    api.post<never, ApiResponse<{ id: string; status: string }>>(`/instances/${id}/restart`),

  // 销毁实例
  destroy: (id: string) =>
    api.delete<never, ApiResponse<{ id: string }>>(`/instances/${id}`),

  // 一键清仓（Panic Sell）
  panicSell: () =>
    api.post<never, ApiResponse<{
      success: boolean;
      message: string;
      instancesProcessed: number;
      successCount: number;
      failedCount: number;
      results: Array<{
        instanceId: string;
        success: boolean;
        trades?: unknown;
        error?: string;
      }>;
    }>>('/instances/panic-sell'),

  // 停止所有实例
  stopAll: () =>
    api.post<never, ApiResponse<{
      success: boolean;
      stoppedCount: number;
      failedCount: number;
      results: Array<{
        instanceId: string;
        success: boolean;
        error?: string;
      }>;
    }>>('/instances/stop-all'),

  // === K 线数据下载 ===

  // 下载历史 K 线数据
  downloadKline: (
    id: string,
    data: {
      pairs: string[];
      timeframes: string[];
      startDate?: string;
      exchange?: string;
    }
  ) =>
    api.post<never, ApiResponse<{
      status: string;
      taskId?: string;
    }>>(`/instances/${id}/download-kline`, data),

  // 获取 K 线下载状态
  getKlineStatus: (id: string, taskId?: string) =>
    api.get<never, ApiResponse<{
      status: 'idle' | 'downloading' | 'completed' | 'error';
      progress?: number;
      message?: string;
      lastUpdated?: string;
      availablePairs?: string[];
    }>>(`/instances/${id}/kline-status`, { params: { taskId } }),

  // 获取已下载的 K 线数据
  getKlineData: (id: string) =>
    api.get<never, ApiResponse<{
      exchange: string;
      pairs: Array<{
        pair: string;
        timeframes: string[];
        dataRange?: { start: string; end: string };
      }>;
    }>>(`/instances/${id}/kline-data`),
};

// Billing API
export const billingApi = {
  getTodayPnL: () =>
    api.get<never, ApiResponse<{
      todayPnl: string;
      todayProfit: string;
      todayLoss: string;
      todayTrades: number;
      todayWinRate: string;
      todayGasFee: string;
    }>>('/billing/today-pnl'),

  getMonthlyPnL: () =>
    api.get<never, ApiResponse<{
      monthlyPnl: string;
      monthlyTrades: number;
      monthlyWinRate: string;
    }>>('/billing/monthly-pnl'),

  getPnLCurve: (days?: number) =>
    api.get<never, ApiResponse<{
      curve: Array<{ date: string; pnl: string; cumulativePnl: string; trades: number }>;
      totalPnl: string;
      maxDrawdown: string;
    }>>('/billing/pnl-curve', { params: { days } }),

  getLogs: (params?: { type?: string; limit?: number; offset?: number }) =>
    api.get<never, ApiResponse<{
      logs: Array<{
        id: string;
        type: string;
        amount: string;
        balance_after: string;
        description: string;
        created_at: string;
      }>;
      total: number;
    }>>('/billing/logs', { params }),

  getStats: () =>
    api.get<never, ApiResponse<{
      totalIncome: string;
      totalExpense: string;
      vpsExpense: string;
      gasFeeExpense: string;
    }>>('/billing/stats'),
};

// Deposits API
export const depositsApi = {
  create: (amount: string, method: string) =>
    api.post<never, ApiResponse<{ id: string; status: string }>>('/deposits', { amount, method }),

  list: () =>
    api.get<never, ApiResponse<Array<{
      id: string;
      amount: string;
      method: string;
      status: string;
      created_at: string;
    }>>>('/deposits'),

  // 获取充值地址
  getDepositAddress: (chain: 'TRC20' | 'ERC20' | 'BEP20') =>
    api.get<never, ApiResponse<{
      address: string;
      chain: string;
      qrCode?: string;
    }>>('/wallet/deposit-address', { params: { chain } }),
};

// Withdrawals API
export const withdrawalsApi = {
  create: (amount: string, chain: string, toAddress: string) =>
    api.post<never, ApiResponse<{ id: string; status: string }>>('/withdrawals', {
      amount,
      chain,
      toAddress,
    }),

  list: () =>
    api.get<never, ApiResponse<Array<{
      id: string;
      amount: string;
      chain: string;
      to_address: string;
      status: string;
      created_at: string;
    }>>>('/withdrawals'),
};

// Backups API
export const backupsApi = {
  list: (instanceId?: string) =>
    api.get<never, ApiResponse<Array<{
      id: string;
      instanceId: string;
      s3Key: string;
      sizeBytes: number;
      status: string;
      createdAt: string;
    }>>>('/backups', { params: instanceId ? { instanceId } : undefined }),

  backup: (instanceId: string) =>
    api.post<never, ApiResponse<{ backupId: string; s3Key: string }>>(`/backups/instance/${instanceId}`),

  restore: (instanceId: string) =>
    api.post<never, ApiResponse<{ restored: boolean; backupId?: string }>>(`/backups/restore/${instanceId}`),
};

// Strategy 类型定义
interface StrategyPerformanceStats {
  live?: {
    win_rate?: number;
    total_pnl?: number;
    total_trades?: number;
    last_updated?: string;
  };
  backtest?: {
    win_rate?: number;
    max_drawdown?: number;
    sharpe_ratio?: number;
    profit_factor?: number;
    total_trades?: number;
  };
}

interface StrategyConfig {
  riskLevel?: string;
  minInvestment?: number;
  tags?: string[];
  [key: string]: unknown;
}

export interface Strategy {
  id: string;
  name: string;
  description: string | null;
  owner_type: string;
  is_public: boolean;
  config: StrategyConfig | null;
  performance_stats: StrategyPerformanceStats | null;
  created_at: string;
}

// Strategies API
export const strategiesApi = {
  list: (params?: { type?: string; source?: string; sort?: string }) =>
    api.get<never, ApiResponse<Strategy[]>>('/strategies', { params }),

  getDetail: (id: string) =>
    api.get<never, ApiResponse<Strategy & { content?: string }>>(`/strategies/${id}`),

  subscribe: (id: string) =>
    api.post<never, ApiResponse<{ id: string }>>(`/strategies/${id}/subscribe`),

  unsubscribe: (id: string) =>
    api.post<never, ApiResponse<{ id: string }>>(`/strategies/${id}/unsubscribe`),

  getMyStrategies: () =>
    api.get<never, ApiResponse<Array<{
      id: string;
      strategy_id: string;
      strategy_name: string;
      status: string;
      allocated_capital: string;
      total_pnl: string;
      subscribed_at: string;
    }>>>('/strategies/my'),

  /** 获取我的策略配置列表（包含详细配置参数） */
  getMyConfigs: () =>
    api.get<never, ApiResponse<Array<{
      id: string;
      user_id: string;
      strategy_id: string;
      instance_id: string | null;
      stake_amount: string;
      max_open_trades: number;
      leverage: number;
      stoploss: string;
      trailing_stop: boolean;
      trailing_stop_positive: string | null;
      blacklist: string[];
      custom_config: Record<string, unknown>;
      is_active: boolean;
      created_at: string;
      updated_at: string;
      strategy: {
        id: string;
        name: string;
        description: string | null;
        is_public: boolean;
      };
    }>>>('/strategies/my-configs/list'),

  /** 创建策略配置（保存到我的策略） */
  createConfig: (data: {
    strategy_id: string;
    stake_amount: string;
    max_open_trades: number;
    leverage: number;
    stoploss?: number; // 可选，跟随策略代码时不传
    trailing_stop?: boolean;
    trailing_stop_positive?: number;
    trailing_stop_positive_offset?: number;
    trailing_only_offset_is_reached?: boolean;
    timeframe?: string;
    minimal_roi?: Array<{ minutes: number; roi: number }>;
    stoploss_on_exchange?: boolean;
    exchange?: string;
    pair_whitelist?: string[];
    blacklist?: string[];
    custom_config?: Record<string, unknown>;
    follow_strategy_code?: boolean; // 跟随策略代码（止损/止盈/K线/追踪止损使用代码中的值）
  }) =>
    api.post<never, ApiResponse<{
      id: string;
      strategy_id: string;
      stake_amount: string;
      max_open_trades: number;
      leverage: number;
      stoploss: string;
      trailing_stop: boolean;
      is_active: boolean;
      created_at: string;
    }>>('/strategies/configs', data),

  /** 更新策略配置 */
  updateConfig: (id: string, data: {
    stake_amount?: string;
    max_open_trades?: number;
    leverage?: number;
    stoploss?: number;
    trailing_stop?: boolean;
    trailing_stop_positive?: number;
    timeframe?: string;
    pair_whitelist?: string[];
    blacklist?: string[];
    custom_config?: Record<string, unknown>;
  }) =>
    api.patch<never, ApiResponse<{
      id: string;
      updated_at: string;
    }>>(`/strategies/configs/${id}`, data),

  /** 删除策略配置 */
  deleteConfig: (id: string) =>
    api.delete<never, ApiResponse<{ message: string }>>(`/strategies/configs/${id}`),

  /** 启动策略 */
  startStrategy: (configId: string) =>
    api.post<never, ApiResponse<{ message: string }>>(`/strategies/configs/${configId}/start`),

  /** 停止策略 */
  stopStrategy: (configId: string) =>
    api.post<never, ApiResponse<{ message: string }>>(`/strategies/configs/${configId}/stop`),

  // ===== Phase 16.5: 策略上传与收益分成 =====

  /** 上传策略 */
  upload: (data: {
    name: string;
    description?: string;
    content: string;
    backtestStartDate: string;
    backtestEndDate: string;
    backtestInitialCapital: number;
    backtestPairs: string[];
  }) =>
    api.post<never, ApiResponse<{
      strategyId: string;
      reviewStatus: string;
      autoCheckPassed: boolean;
      warnings: string[];
      backtestSummary: {
        totalReturn: number;
        winRate: number;
        maxDrawdown: number;
        sharpeRatio: number;
      };
    }>>('/strategies/upload', data),

  /** 获取我上传的策略列表 */
  getMyUploads: () =>
    api.get<never, ApiResponse<Array<{
      id: string;
      name: string;
      description: string | null;
      reviewStatus: string;
      createdAt: string;
      totalUsers: number;
      totalProfit: string;
      avgWinRate: string | null;
      revenueShareRate: string | null;
      revenueShareEnabled: boolean;
    }>>>('/strategies/my-uploads'),

  /** 获取策略收益统计 */
  getRevenueStats: () =>
    api.get<never, ApiResponse<{
      totalRevenue: string;
      pendingRevenue: string;
      settledRevenue: string;
      revenueByStrategy: Array<{
        strategyId: string;
        strategyName: string;
        revenue: string;
        users: number;
        tier: string;
      }>;
    }>>('/strategies/revenue/stats'),

  /** 获取策略收益明细 */
  getRevenueLogs: (params?: {
    page?: number;
    limit?: number;
    strategyId?: string;
  }) =>
    api.get<never, ApiResponse<{
      logs: Array<{
        id: string;
        strategyName: string;
        userName: string;
        baseAmount: string;
        revenueAmount: string;
        revenueShareRate: string;
        status: string;
        createdAt: string;
      }>;
      total: number;
      page: number;
      totalPages: number;
    }>>('/strategies/revenue/logs', { params }),

  /** 提现策略收益 */
  withdrawRevenue: (amount: number) =>
    api.post<never, ApiResponse<{
      withdrawalId: string;
      amount: string;
      status: string;
    }>>('/strategies/revenue/withdraw', { amount }),

  /** 获取策略升级进度 */
  getUpgradeProgress: (strategyId: string) =>
    api.get<never, ApiResponse<{
      currentTier: string;
      currentRate: string;
      nextTier?: {
        level: string;
        requiredUsers: number;
        requiredProfit: number;
        requiredWinRate: number;
        progressUsers: number;
        progressProfit: number;
        progressWinRate: number;
      };
    }>>(`/strategies/${strategyId}/upgrade-progress`),

  /** 提交策略上架申请（从我的策略提交到市场） */
  submitForReview: (strategyId: string, data?: {
    description?: string;
    autoCheckResult?: {
      backtestReturn: number | null;
      backtestWinRate: number | null;
      backtestDrawdown: number | null;
    };
  }) =>
    api.post<never, ApiResponse<{
      strategyId: string;
      reviewStatus: string;
      message: string;
    }>>(`/strategies/${strategyId}/submit-for-review`, data),

  /** 代码回测 - 在用户 VPS Freqtrade 上执行 */
  runCodeBacktest: (data: {
    code: string;
    pairs: string[];
    startDate: string;
    endDate: string;
    initialCapital: number;
  }) =>
    api.post<never, ApiResponse<{
      total_return: number;
      win_rate: number;
      total_trades: number;
      max_drawdown: number;
      sharpe_ratio: number;
      profit_factor: number;
      avg_profit: number;
      avg_loss: number;
      trades: Array<{
        pair: string;
        side: string;
        entry_price: number;
        exit_price: number;
        pnl: number;
        entry_time: string;
        exit_time: string;
      }>;
    }>>('/strategies/backtest/code', data),

  /**
   * 执行策略回测（Freqtrade）
   *
   * 在用户 VPS 上通过 Freqtrade 执行回测
   * 要求：用户必须有活跃的 VPS 实例
   */
  backtest: (data: {
    strategyId: string;
    pairs: string[];
    startDate: string;
    endDate: string;
    initialCapital: number;
    stoploss?: number;
    takeprofit?: number;
    timeframe?: string;
    leverage?: number;
    maxOpenTrades?: number;
    followStrategyCode?: boolean; // 跟随策略代码（止损/止盈/K线/追踪止损使用代码中的值）
  }) =>
    api.post<never, ApiResponse<{
      totalReturn: number;
      winRate: number;
      maxDrawdown: number;
      sharpeRatio: number;
      totalTrades: number;
      avgProfit: number;
      avgLoss: number;
      profitFactor: number;
      curve: Array<{ date: string; value: number }>;
      strategyName: string;
      startDate: string;
      endDate: string;
      initialCapital: number;
      pairs: string[];
    }>>('/strategies/backtest', data),
};

// API Keys API
export const apiKeysApi = {
  list: () =>
    api.get<never, ApiResponse<Array<{
      id: string;
      exchange: string;
      label: string;
      api_key_masked: string;
      is_valid: boolean;
      created_at: string;
      last_verified_at: string | null;
    }>>>('/api-keys'),

  create: (data: { exchange: string; label: string; apiKey: string; secretKey: string; passphrase?: string }) =>
    api.post<never, ApiResponse<{ id: string }>>('/api-keys', data),

  delete: (id: string) =>
    api.delete<never, ApiResponse<{ id: string }>>(`/api-keys/${id}`),

  verify: (id: string) =>
    api.post<never, ApiResponse<{ valid: boolean; balances?: Record<string, string> }>>(`/api-keys/${id}/verify`),
};

// Trading API
export const tradingApi = {
  getPositions: () =>
    api.get<never, ApiResponse<Array<{
      id: string;
      symbol: string;
      side: string;
      size: string;
      entry_price: string;
      current_price: string;
      unrealized_pnl: string;
      leverage: number;
    }>>>('/trading/positions'),

  getOrders: (status?: string) =>
    api.get<never, ApiResponse<Array<{
      id: string;
      symbol: string;
      side: string;
      type: string;
      size: string;
      price: string;
      status: string;
      created_at: string;
    }>>>('/trading/orders', { params: { status } }),

  // 交易历史（从 /trades 接口，支持服务端筛选和分页）
  getTrades: (params?: {
    instance_id?: string;
    pair?: string;
    pnl_status?: 'all' | 'profit' | 'loss';
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }) =>
    api.get<never, ApiResponse<{
      trades: Array<{
        id: string;
        instance_id: string;
        pair: string;
        side: string;
        amount: string;
        price: string;
        pnl: string;
        fee: string;
        executed_at: string;
      }>;
      total: number;
      limit: number;
      offset: number;
      has_more: boolean;
    }>>('/trades', { params }),

  getStats: () =>
    api.get<never, ApiResponse<{
      totalTrades: number;
      winRate: string;
      totalPnl: string;
      avgProfit: string;
      avgLoss: string;
      bestTrade: string;
      worstTrade: string;
    }>>('/trades/stats'),

  // 按时间段获取盈亏统计
  getStatsByPeriod: (params: {
    period: 'today' | 'week' | 'month' | 'custom';
    start_date?: string;
    end_date?: string;
  }) =>
    api.get<never, ApiResponse<{
      period: string;
      start_date: string;
      end_date: string;
      total_trades: number;
      win_trades: number;
      loss_trades: number;
      win_rate: string;
      total_pnl: string;
      total_profit: string;
      total_loss: string;
      best_trade: string;
      worst_trade: string;
      avg_pnl_per_trade: string;
      total_gas_fee: string;
    }>>('/trades/stats/period', { params }),

  startBot: (strategyId: string, config?: Record<string, unknown>) =>
    api.post<never, ApiResponse<{ id: string; status: string }>>('/trading/bot/start', {
      strategy_id: strategyId,
      config,
    }),

  stopBot: () =>
    api.post<never, ApiResponse<{ status: string }>>('/trading/bot/stop'),

  getBotStatus: () =>
    api.get<never, ApiResponse<{
      running: boolean;
      strategy_id?: string;
      uptime?: number;
      trades_today?: number;
    }>>('/trading/bot/status'),

  /** 获取 Freqtrade 完整运行配置 */
  getConfig: () =>
    api.get<never, ApiResponse<{
      strategy?: string;
      timeframe?: string;
      stake_currency?: string;
      stake_amount?: string | number;
      max_open_trades?: number;
      dry_run?: boolean;
      exchange?: { name: string };
      pair_whitelist?: string[];
      pair_blacklist?: string[];
      stoploss?: number;
      trailing_stop?: boolean;
      trailing_stop_positive?: number;
      minimal_roi?: Record<string, number>;
    }>>('/trading/config'),

  /** 获取账户余额 */
  getBalance: () =>
    api.get<never, ApiResponse<{
      currencies: Array<{
        currency: string;
        free: number;
        balance: number;
        used: number;
        est_stake: number;
      }>;
      total: number;
      stake_currency: string;
    }>>('/trading/balance'),

  /** 强制平仓单个交易 */
  forceExit: (tradeId: string) =>
    api.post<never, ApiResponse<{ status: string }>>('/trading/force-exit', {
      trade_id: tradeId,
    }),

  /** 紧急全部平仓 */
  forceExitAll: () =>
    api.post<never, ApiResponse<{ status: string }>>('/trading/force-exit-all'),
};

// 市场数据 API
export const marketApi = {
  // 搜索交易对
  searchSymbols: (search?: string, limit?: number) =>
    api.get<never, ApiResponse<string[]>>('/market/symbols', {
      params: { search, limit },
    }),

  // 获取热门交易对
  getPopularSymbols: () =>
    api.get<never, ApiResponse<string[]>>('/market/symbols/popular'),
};

// 生态中心 API - 匹配后端 /api/gamefi/* 路由
// 注：API 路由保持 /api/gamefi 不变，仅变量命名更新为 ecosystemApi
export const ecosystemApi = {
  // 生态中心概览
  getOverview: () =>
    api.get<never, ApiResponse<{
      points: {
        available: string;
        frozen: string;
        total: string;
        todayEarned: string;
      };
      staking: {
        totalStaked: string;
        totalReward: string;
        activeCount: number;
        averageWeight: string;
      };
      tokens: {
        available: string;
        locked: string;
        vesting: string;
        total: string;
      };
      rewards: {
        claimable: string;
        claimed: string;
        nextReleaseAmount: string;
        nextReleaseDate: string | null;
      };
    }>>('/gamefi/overview'),

  // 积分
  getPointsBalance: () =>
    api.get<never, ApiResponse<{
      available: string;
      frozen: string;
      total: string;
    }>>('/gamefi/points'),

  getPointsHistory: (limit?: number) =>
    api.get<never, ApiResponse<{
      history: Array<{
        id: string;
        userId: string;
        uniqueOrderId: string;
        billingType: string;
        amount: string;
        referenceType: string | null;
        referenceId: string | null;
        description: string | null;
        status: string;
        createdAt: string;
      }>;
      total: number;
    }>>('/gamefi/points/history', { params: { limit } }),

  // 代币
  getTokenBalance: () =>
    api.get<never, ApiResponse<{
      available: string;
      locked: string;
      vesting: string;
      total: string;
    }>>('/gamefi/tokens/balance'),

  exchangeTokens: (data: { points: string; mode: 'standard' | 'fast' }) =>
    api.post<never, ApiResponse<{
      orderId: string;
      tokensReceived: string;
      tokensPending: string;
      tokensBurned: string;
      message: string;
    }>>('/gamefi/tokens/exchange', data),

  getVestingProgress: () =>
    api.get<never, ApiResponse<{
      totalVesting: string;
      released: string;
      pending: string;
      nextReleaseAmount: string;
      nextReleaseDate: string | null;
      vestingOrders: Array<{
        orderId: string;
        tokensTotal: string;
        tokensReleased: string;
        tokensPending: string;
        vestingMode: string;
        vestingStartAt: string;
        vestingEndAt: string;
        lastReleaseAt: string;
        progress: number;
        daysRemaining: number;
      }>;
    }>>('/gamefi/tokens/vesting'),

  getTokenOrders: () =>
    api.get<never, ApiResponse<Array<{
      id: string;
      pointsUsed: string;
      tokensTotal: string;
      mode: string;
      status: string;
      createdAt: string;
    }>>>('/gamefi/tokens/orders'),

  // 质押
  getStakes: () =>
    api.get<never, ApiResponse<{
      stakes: Array<{
        id: string;
        stake_type: string;
        amount: string;
        start_time: string;
        lock_period_days: number;
        end_time: string;
        weight_multiplier: string;
        accumulated_reward: string;
        claimable_reward: string;
        status: string;
        early_unstake_at: string | null;
        penalty_amount: string;
        created_at: string;
        can_unstake: boolean;
        early_penalty?: string;
        return_preview?: string;
      }>;
      total_staked: string;
      total_reward: string;
    }>>('/gamefi/stakes'),

  getStakingStats: () =>
    api.get<never, ApiResponse<{
      total_accumulated: string;
      claimable: string;
      claimed: string;
      staked_amount: string;
      average_weight: string;
    }>>('/gamefi/stakes/stats'),

  stake: (data: { type: 'A' | 'B'; amount: string; lockDays?: number }) =>
    api.post<never, ApiResponse<{
      id: string;
      stake_type: string;
      amount: string;
      weight_multiplier: string;
      can_unstake: boolean;
    }>>('/gamefi/stake', {
      stake_type: data.type,
      amount: data.amount,
      lock_days: data.lockDays || 0,
    }),

  unstake: (id: string) =>
    api.post<never, ApiResponse<{
      stake: {
        id: string;
        status: string;
        amount: string;
      };
      penalty: string;
    }>>(`/gamefi/unstake/${id}`),

  claimRewards: () =>
    api.post<never, ApiResponse<{
      amount: string;
      stakes: number;
    }>>('/gamefi/claim'),

  // 排行榜
  getLeaderboard: (params?: { period?: 'day' | 'week' | 'month' | 'all'; limit?: number; offset?: number }) =>
    api.get<never, ApiResponse<{
      entries: Array<{
        rank: number;
        userId: string;
        email: string;
        totalPoints: string;
        todayPoints: string;
        vipLevel: number;
      }>;
      total: number;
      myRank: number;
      myPoints: string;
      period: string;
    }>>('/gamefi/leaderboard', { params }),
};

// 向后兼容导出（保留 gamefiApi）
export const gamefiApi = ecosystemApi;

// Admin API（管理后台）
export const adminApi = {
  // 平台统计
  getStats: () =>
    api.get<never, ApiResponse<{
      users: { total: number; activeToday: number; newThisWeek: number };
      instances: { total: number; running: number; stopped: number };
      revenue: { today: string; thisMonth: string; total: string };
      trades: { today: number; successRate: number };
    }>>('/admin/stats'),

  // 最近活动
  getActivities: () =>
    api.get<never, ApiResponse<Array<{
      id: string;
      type: string;
      action: string;
      user?: string;
      amount?: string;
      instanceId?: string;
      time: string;
    }>>>('/admin/activities'),

  // 系统告警
  getAlerts: () =>
    api.get<never, ApiResponse<Array<{
      id: number;
      level: string;
      message: string;
      time: string;
    }>>>('/admin/alerts'),

  // 用户列表
  getUsers: (params?: { page?: number; search?: string; status?: string }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        email: string;
        vipLevel: number;
        balance: string;
        pointsBalance: string;
        cardBalance: string;
        tokenBalance: string;
        status: string;
        instanceCount: number;
        totalTrades: number;
        createdAt: string;
        lastLogin: string | null;
      }>;
      total: number;
      page: number;
      totalPages: number;
    }>>('/admin/users', { params }),

  // 封禁用户
  banUser: (userId: string) =>
    api.post<never, ApiResponse<{ success: boolean; newStatus: string }>>(`/admin/users/${userId}/ban`),

  // 重置密码
  resetPassword: (userId: string) =>
    api.post<never, ApiResponse<{ success: boolean; tempPassword: string }>>(`/admin/users/${userId}/reset-password`),

  // 调整用户资产
  adjustUserBalance: (userId: string, data: { type: string; amount: string; reason: string }) =>
    api.post<never, ApiResponse<{ success: boolean }>>(`/admin/users/${userId}/adjust-balance`, data),

  // 财务统计
  getFinanceStats: (period?: string) =>
    api.get<never, ApiResponse<{
      totalRevenue: string;
      totalExpense: string;
      netProfit: string;
      growthRate: number;
      breakdown: {
        subscription: string;
        gasFee: string;
        deposit: string;
        withdrawal: string;
      };
      revenueDistribution: {
        operations: string;
        buyback: string;
        reserve: string;
      };
    }>>('/admin/finance/stats', { params: { period } }),

  // 财务交易记录
  getFinanceTransactions: (page?: number) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        type: string;
        amount: string;
        user: string;
        time: string;
        status: string;
      }>;
      total: number;
    }>>('/admin/finance/transactions', { params: { page } }),

  // 用户详情
  getUserDetail: (id: string) =>
    api.get<never, ApiResponse<{
      id: string;
      email: string;
      vipLevel: number;
      balance: string;
      status: string;
      createdAt: string;
      lastLogin: string;
    }>>(`/admin/users/${id}`),

  updateUser: (id: string, data: { email?: string; status?: string; vipLevel?: number }) =>
    api.patch<never, ApiResponse<{ success: boolean }>>(`/admin/users/${id}`, data),

  updateUserVip: (id: string, vipLevel: number) =>
    api.patch<never, ApiResponse<{ success: boolean }>>(`/admin/users/${id}/vip`, { vipLevel }),

  getUserTrades: (id: string, page?: number) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        pair: string;
        side: string;
        amount: string;
        price: string;
        pnl: string;
        executedAt: string;
      }>;
      total: number;
    }>>(`/admin/users/${id}/trades`, { params: { page } }),

  getUserInstances: (id: string) =>
    api.get<never, ApiResponse<Array<{
      id: string;
      status: string;
      ipAddress: string;
      region: string;
      createdAt: string;
    }>>>(`/admin/users/${id}/instances`),

  getUserBilling: (id: string, page?: number) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        type: string;
        amount: string;
        description: string;
        createdAt: string;
      }>;
      total: number;
    }>>(`/admin/users/${id}/billing`, { params: { page } }),

  getUserLoginLogs: (id: string, page?: number) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        ip: string;
        device: string;
        location: string;
        createdAt: string;
      }>;
      total: number;
    }>>(`/admin/users/${id}/login-logs`, { params: { page } }),

  // 公告管理
  getAnnouncements: (page?: number) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        title: string;
        content: string;
        type: string;
        status: string;
        publishedAt: string | null;
        views: number;
        createdAt: string;
      }>;
      total: number;
    }>>('/admin/announcements', { params: { page } }),

  createAnnouncement: (data: { title: string; content: string; type: string; status?: string }) =>
    api.post<never, ApiResponse<{ id: string }>>('/admin/announcements', data),

  updateAnnouncement: (id: string, data: { title?: string; content?: string; type?: string; status?: string }) =>
    api.patch<never, ApiResponse<{ success: boolean }>>(`/admin/announcements/${id}`, data),

  deleteAnnouncement: (id: string) =>
    api.delete<never, ApiResponse<{ success: boolean }>>(`/admin/announcements/${id}`),

  toggleAnnouncementStatus: (id: string) =>
    api.post<never, ApiResponse<{ success: boolean; newStatus: string }>>(`/admin/announcements/${id}/toggle`),

  // 策略管理
  getAdminStrategies: (page?: number) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        name: string;
        description: string;
        type: string;
        status: string;
        subscribers: number;
        monthlyReturn: string;
        riskLevel: string;
        createdAt: string;
      }>;
      total: number;
    }>>('/admin/strategies', { params: { page } }),

  createStrategy: (data: { name: string; description: string; type: string; code: string; riskLevel: string }) =>
    api.post<never, ApiResponse<{ id: string }>>('/admin/strategies', data),

  getAdminStrategy: (id: string) =>
    api.get<never, ApiResponse<{
      id: string;
      name: string;
      description: string;
      type: string;
      code: string;
      status: string;
      riskLevel: string;
    }>>(`/admin/strategies/${id}`),

  updateStrategy: (id: string, data: { name?: string; description?: string; type?: string; code?: string; status?: string; riskLevel?: string }) =>
    api.patch<never, ApiResponse<{ success: boolean }>>(`/admin/strategies/${id}`, data),

  deleteStrategy: (id: string) =>
    api.delete<never, ApiResponse<{ success: boolean }>>(`/admin/strategies/${id}`),

  toggleStrategyStatus: (id: string) =>
    api.post<never, ApiResponse<{ success: boolean; newStatus: string }>>(`/admin/strategies/${id}/toggle`),

  // 审计日志
  getAuditLogs: (params?: { type?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        operator: string;
        operatorEmail: string;
        action: string;
        target: string;
        details: string;
        ip: string;
        createdAt: string;
      }>;
      total: number;
    }>>('/admin/audit-logs', { params }),

  // ==================== VPS 监控 ====================
  getAdminInstances: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        userId: string;
        userEmail: string;
        ip: string;
        region: string;
        status: string;
        cpu: number;
        memory: number;
        disk: number;
        uptime: string;
        lastHeartbeat: string;
        strategy: string;
        createdAt: string;
      }>;
      total: number;
      running: number;
      stopped: number;
      zombie: number;
    }>>('/admin/instances', { params }),

  stopInstance: (instanceId: string) =>
    api.post<never, ApiResponse<{ id: string; status: string }>>(`/admin/instances/${instanceId}/stop`),

  restartInstance: (instanceId: string) =>
    api.post<never, ApiResponse<{ id: string; status: string }>>(`/admin/instances/${instanceId}/restart`),

  destroyInstance: (instanceId: string) =>
    api.delete<never, ApiResponse<{ id: string }>>(`/admin/instances/${instanceId}`),

  // Kill Switch
  getKillSwitchStatus: () =>
    api.get<never, ApiResponse<{
      lastActivatedAt: string | null;
      lastActivatedBy: string | null;
      lastReason: string | null;
      totalInstances: number;
      runningInstances: number;
      stoppedInstances: number;
    }>>('/admin/kill-switch/status'),

  activateKillSwitch: (reason: string) =>
    api.post<never, ApiResponse<{
      success: boolean;
      message: string;
      stoppedCount: number;
      failedCount: number;
    }>>('/admin/kill-switch', { reason }),

  // 代理商提现审核
  getAgentWithdrawals: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        agentId: string;
        agentEmail: string;
        agentName: string;
        amount: string;
        status: string;
        createdAt: string;
        processedAt: string | null;
        processedBy: string | null;
        txHash: string | null;
        rejectReason: string | null;
      }>;
      total: number;
      pending: number;
    }>>('/admin/agents/withdrawals', { params }),

  approveAgentWithdrawal: (id: string, txHash?: string) =>
    api.post<never, ApiResponse<{ id: string; status: string }>>(`/admin/agents/withdrawals/${id}/approve`, { txHash }),

  rejectAgentWithdrawal: (id: string, reason?: string) =>
    api.post<never, ApiResponse<{ id: string; status: string }>>(`/admin/agents/withdrawals/${id}/reject`, { reason }),

  // ==================== 配置中心 ====================
  getConfigs: (category?: string) =>
    api.get<never, ApiResponse<Array<{
      configKey: string;
      configValue: string | number | boolean;
      configType: string;
      category: string;
      label: string;
      description?: string;
      isPublic: boolean;
      updatedAt: string;
    }>>>('/admin/configs', { params: { category } }),

  updateConfig: (key: string, data: { value: string | number | boolean; description?: string; isPublic?: boolean }) =>
    api.put<never, ApiResponse<{ configKey: string; configValue: string | number | boolean }>>(`/admin/configs/${key}`, data),

  initConfigs: () =>
    api.post<never, ApiResponse<{ created: number; skipped: number }>>('/admin/configs/init'),

  // ==================== CMS 内容管理 ====================
  getCmsContents: (params?: { page?: number; limit?: number; locale?: string }) =>
    api.get<never, ApiResponse<{
      items: Array<{
        id: string;
        content_key: string;
        content_type: string;
        title: string | null;
        content: string;
        locale: string;
        is_published: boolean;
        sort_order: number;
        created_at: string;
        updated_at: string;
        users?: { id: string; email: string };
      }>;
      total: number;
      page: number;
      totalPages: number;
    }>>('/admin/cms/contents', { params }),

  createCmsContent: (data: {
    contentKey: string;
    contentType: string;
    title?: string;
    content: string;
    locale?: string;
    isPublished?: boolean;
    sortOrder?: number;
  }) =>
    api.post<never, ApiResponse<{ id: string }>>('/admin/cms/contents', data),

  updateCmsContent: (id: string, data: {
    title?: string;
    content?: string;
    isPublished?: boolean;
    sortOrder?: number;
  }) =>
    api.put<never, ApiResponse<{ id: string }>>(`/admin/cms/contents/${id}`, data),

  deleteCmsContent: (id: string) =>
    api.delete<never, ApiResponse<{ message: string }>>(`/admin/cms/contents/${id}`),

  // ==================== CMS Banner 管理 ====================
  getCmsBanners: (params?: { page?: number; limit?: number; position?: string }) =>
    api.get<never, ApiResponse<{
      items: Array<{
        id: string;
        position: string;
        title: string;
        subtitle: string | null;
        image_url: string;
        link_url: string | null;
        link_target: string;
        button_text: string | null;
        is_active: boolean;
        start_at: string | null;
        end_at: string | null;
        sort_order: number;
        created_at: string;
        users?: { id: string; email: string };
      }>;
      total: number;
      page: number;
      totalPages: number;
    }>>('/admin/cms/banners', { params }),

  createCmsBanner: (data: {
    position: string;
    title: string;
    subtitle?: string;
    imageUrl: string;
    linkUrl?: string;
    linkTarget?: string;
    buttonText?: string;
    isActive?: boolean;
    startAt?: string;
    endAt?: string;
    sortOrder?: number;
  }) =>
    api.post<never, ApiResponse<{ id: string }>>('/admin/cms/banners', data),

  updateCmsBanner: (id: string, data: {
    title?: string;
    subtitle?: string;
    imageUrl?: string;
    linkUrl?: string;
    linkTarget?: string;
    buttonText?: string;
    isActive?: boolean;
    startAt?: string;
    endAt?: string;
    sortOrder?: number;
  }) =>
    api.put<never, ApiResponse<{ id: string }>>(`/admin/cms/banners/${id}`, data),

  deleteCmsBanner: (id: string) =>
    api.delete<never, ApiResponse<{ message: string }>>(`/admin/cms/banners/${id}`),

  // ==================== CMS 帮助文档 ====================
  getCmsHelpDocs: (params?: { page?: number; limit?: number; category?: string }) =>
    api.get<never, ApiResponse<{
      items: Array<{
        id: string;
        category: string;
        title: string;
        slug: string;
        summary: string | null;
        content: string;
        tags: string[];
        is_published: boolean;
        view_count: number;
        sort_order: number;
        created_at: string;
        users?: { id: string; email: string };
      }>;
      total: number;
      page: number;
      totalPages: number;
    }>>('/admin/cms/help-docs', { params }),

  createCmsHelpDoc: (data: {
    category: string;
    title: string;
    slug: string;
    summary?: string;
    content: string;
    tags?: string[];
    isPublished?: boolean;
    sortOrder?: number;
  }) =>
    api.post<never, ApiResponse<{ id: string }>>('/admin/cms/help-docs', data),

  updateCmsHelpDoc: (id: string, data: {
    category?: string;
    title?: string;
    summary?: string;
    content?: string;
    tags?: string[];
    isPublished?: boolean;
    sortOrder?: number;
  }) =>
    api.put<never, ApiResponse<{ id: string }>>(`/admin/cms/help-docs/${id}`, data),

  deleteCmsHelpDoc: (id: string) =>
    api.delete<never, ApiResponse<{ message: string }>>(`/admin/cms/help-docs/${id}`),

  // ==================== 充值管理 ====================
  getDeposits: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        userId: string;
        userEmail: string;
        amount: string;
        currency: string;
        method: string;
        chain: string | null;
        fromAddress: string | null;
        txHash: string | null;
        proofImageUrl: string | null;
        status: string;
        rejectReason: string | null;
        reviewedBy: string | null;
        reviewedAt: string | null;
        createdAt: string;
      }>;
      total: number;
      pending: number;
      page: number;
      totalPages: number;
    }>>('/admin/deposits', { params }),

  approveDeposit: (id: string) =>
    api.post<never, ApiResponse<{ success: boolean; depositId: string }>>(`/admin/deposits/${id}/approve`),

  rejectDeposit: (id: string, reason?: string) =>
    api.post<never, ApiResponse<{ success: boolean; depositId: string }>>(`/admin/deposits/${id}/reject`, { reason }),

  // ==================== 余额调整 ====================
  adjustBalance: (userId: string, data: { type: 'add' | 'deduct'; amount: string; reason: string }) =>
    api.post<never, ApiResponse<{
      success: boolean;
      userId: string;
      previousBalance: string;
      newBalance: string;
      adjustment: string;
    }>>(`/admin/users/${userId}/adjust-balance`, data),

  getBalanceAdjustments: (params?: { page?: number; limit?: number; userId?: string }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        userId: string;
        userEmail: string;
        type: 'add' | 'deduct';
        amount: string;
        reason: string;
        operatorId: string;
        createdAt: string;
      }>;
      total: number;
      page: number;
      totalPages: number;
    }>>('/admin/balance-adjustments', { params }),

  // ==================== 代理商管理 ====================
  getAgents: (params?: { page?: number; limit?: number; search?: string; status?: string }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        code: string;
        name: string;
        email: string;
        level: number;
        commissionRate: string;
        totalUsers: number;
        actualUsers: number;
        totalCommission: string;
        status: string;
        parentAgentId: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
      total: number;
      page: number;
      totalPages: number;
    }>>('/admin/agents', { params }),

  getAgentDetail: (id: string) =>
    api.get<never, ApiResponse<{
      id: string;
      code: string;
      name: string;
      email: string;
      level: number;
      commissionRate: string;
      totalUsers: number;
      actualUsers: number;
      totalCommission: string;
      status: string;
      parentAgentId: string | null;
      createdAt: string;
      updatedAt: string;
      stats: {
        totalCommissions: number;
        totalWithdrawals: number;
        pendingWithdrawals: number;
      };
      recentCommissions: Array<{
        id: string;
        userId: string;
        userEmail: string;
        amount: string;
        source: string;
        status: string;
        createdAt: string;
      }>;
      recentWithdrawals: Array<{
        id: string;
        amount: string;
        status: string;
        createdAt: string;
      }>;
    }>>(`/admin/agents/${id}`),

  updateAgent: (id: string, data: { commissionRate?: string; status?: string; name?: string }) =>
    api.patch<never, ApiResponse<{
      success: boolean;
      agent: {
        id: string;
        code: string;
        name: string;
        commissionRate: string;
        status: string;
      };
    }>>(`/admin/agents/${id}`, data),

  // ==================== 质押管理 ====================
  getStakingStats: () =>
    api.get<never, ApiResponse<{
      activeStakes: number;
      totalStaked: string;
      totalRewards: string;
      byType: Array<{
        type: string;
        count: number;
        amount: string;
      }>;
    }>>('/admin/staking/stats'),

  getStakes: (params?: { page?: number; limit?: number; status?: string; stakeType?: string; userId?: string }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        userId: string;
        userEmail: string;
        stakeType: string;
        amount: string;
        startTime: string;
        endTime: string;
        lockPeriodDays: number;
        weightMultiplier: string;
        accumulatedReward: string;
        claimableReward: string;
        status: string;
        earlyUnstakeAt: string | null;
        penaltyAmount: string;
        createdAt: string;
      }>;
      total: number;
      page: number;
      totalPages: number;
    }>>('/admin/staking', { params }),

  // ==================== 报表导出 ====================
  getTradeReport: (params?: { startDate?: string; endDate?: string; userId?: string }) =>
    api.get<never, ApiResponse<{
      stats: {
        totalTrades: number;
        totalVolume: number;
        totalPnl: number;
        totalFees: number;
        winCount: number;
        lossCount: number;
      };
      trades: Array<{
        id: string;
        userId: string;
        userEmail: string;
        instanceId: string | null;
        symbol: string;
        side: string;
        quantity: string;
        price: string;
        pnl: string;
        fee: string;
        createdAt: string;
      }>;
    }>>('/admin/reports/trades', { params }),

  getRevenueReport: (params?: { startDate?: string; endDate?: string; billingType?: string }) =>
    api.get<never, ApiResponse<{
      stats: {
        totalRecords: number;
        totalRevenue: number;
        byType: Array<{
          type: string;
          count: number;
          amount: string;
        }>;
      };
      records: Array<{
        id: string;
        userId: string;
        userEmail: string;
        type: string;
        amount: string;
        description: string;
        createdAt: string;
      }>;
    }>>('/admin/reports/revenue', { params }),

  // ==================== 用户转代理商 ====================
  /** 将用户设置为代理商 */
  promoteUserToAgent: (userId: string, data: { name: string; commissionRate?: string }) =>
    api.post<never, ApiResponse<{
      success: boolean;
      agent: {
        id: string;
        code: string;
        name: string;
        email: string;
        commissionRate: string;
        status: string;
      };
    }>>(`/admin/users/${userId}/promote-to-agent`, data),

  /** 撤销用户的代理商身份 */
  revokeAgentStatus: (userId: string) =>
    api.post<never, ApiResponse<{
      success: boolean;
      message: string;
    }>>(`/admin/users/${userId}/revoke-agent`),

  /** 检查用户是否为代理商 */
  checkUserAgentStatus: (userId: string) =>
    api.get<never, ApiResponse<{
      isAgent: boolean;
      agent?: {
        id: string;
        code: string;
        name: string;
        commissionRate: string;
        totalUsers: number;
        status: string;
      };
    }>>(`/admin/users/${userId}/agent-status`),

  // ==================== 黑名单管理 ====================
  getBlacklist: (params?: { page?: number; search?: string; type?: string }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        type: string;
        value: string;
        reason: string | null;
        expiresAt: string | null;
        isActive: boolean;
        createdAt: string;
        createdBy: string | null;
      }>;
      stats: Record<string, number>;
      total: number;
      totalPages: number;
    }>>('/admin/blacklist', { params }),

  addToBlacklist: (data: { type: string; value: string; reason?: string; expiresAt?: string }) =>
    api.post<never, ApiResponse<{ id: string }>>('/admin/blacklist', data),

  removeFromBlacklist: (id: string) =>
    api.delete<never, ApiResponse<{ success: boolean }>>(`/admin/blacklist/${id}`),

  updateBlacklist: (id: string, data: { reason?: string; expiresAt?: string; isActive?: boolean }) =>
    api.patch<never, ApiResponse<{ success: boolean }>>(`/admin/blacklist/${id}`, data),

  // ==================== 会话管理 ====================
  getSessions: (params?: { page?: number; userId?: string; activeOnly?: boolean }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        userId: string;
        userEmail: string;
        deviceType: string | null;
        deviceName: string | null;
        ipAddress: string | null;
        location: string | null;
        lastActiveAt: string;
        createdAt: string;
        isExpired: boolean;
      }>;
      stats: { activeSessions: number; mobileCount: number; desktopCount: number };
      total: number;
      totalPages: number;
    }>>('/admin/sessions', { params }),

  revokeSession: (sessionId: string) =>
    api.post<never, ApiResponse<{ success: boolean }>>(`/admin/sessions/${sessionId}/revoke`),

  revokeAllSessions: (userId: string, excludeSessionId?: string) =>
    api.post<never, ApiResponse<{ success: boolean; revokedCount: number }>>('/admin/sessions/revoke-all', {
      userId,
      excludeSessionId,
    }),

  // ==================== 2FA 管理 ====================
  reset2FA: (userId: string) =>
    api.post<never, ApiResponse<{ success: boolean }>>(`/admin/users/${userId}/reset-2fa`),

  // ==================== API Key 监管 ====================
  getAllApiKeys: (params?: { page?: number; userId?: string; exchange?: string }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        userId: string;
        userEmail: string;
        exchange: string;
        label: string;
        permissions: string[];
        isActive: boolean;
        lastUsedAt: string | null;
        createdAt: string;
        riskLevel: string;
      }>;
      stats: { total: number; active: number; highRisk: number; revoked: number };
      total: number;
      totalPages: number;
    }>>('/admin/api-keys', { params }),

  revokeApiKey: (keyId: string) =>
    api.post<never, ApiResponse<{ success: boolean }>>(`/admin/api-keys/${keyId}/revoke`),

  // ==================== 弹窗公告 ====================
  getPopups: () =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        title: string;
        content: string;
        type: string;
        targetAudience: string;
        priority: number;
        imageUrl: string | null;
        actionUrl: string | null;
        actionLabel: string | null;
        isActive: boolean;
        startAt: string | null;
        endAt: string | null;
        showOnce: boolean;
        createdAt: string;
        readCount: number;
      }>;
    }>>('/admin/popups'),

  createPopup: (data: {
    title: string;
    content: string;
    type?: string;
    targetAudience?: string;
    priority?: number;
    imageUrl?: string;
    actionUrl?: string;
    actionLabel?: string;
    startAt?: string;
    endAt?: string;
    showOnce?: boolean;
  }) =>
    api.post<never, ApiResponse<{ id: string }>>('/admin/popups', data),

  updatePopup: (id: string, data: Partial<{
    title: string;
    content: string;
    type: string;
    targetAudience: string;
    priority: number;
    imageUrl: string;
    actionUrl: string;
    actionLabel: string;
    isActive: boolean;
    startAt: string;
    endAt: string;
    showOnce: boolean;
  }>) =>
    api.patch<never, ApiResponse<{ success: boolean }>>(`/admin/popups/${id}`, data),

  deletePopup: (id: string) =>
    api.delete<never, ApiResponse<{ success: boolean }>>(`/admin/popups/${id}`),

  // ==================== 品牌配置 ====================
  getBrandConfigs: () =>
    api.get<never, ApiResponse<{
      data: Array<{
        key: string;
        value: string;
        category: string;
        description: string;
      }>;
    }>>('/admin/brand-configs'),

  updateBrandConfigs: (configs: Array<{ key: string; value: string }>) =>
    api.post<never, ApiResponse<{ success: boolean }>>('/admin/brand-configs/batch', { configs }),

  // ==================== VPS 性能监控 ====================
  getInstanceMetrics: (params?: { search?: string; status?: string }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        instanceId: string;
        instanceName: string;
        userId: string;
        userEmail: string;
        cpuUsage: number;
        memoryUsage: number;
        diskUsage: number;
        networkIn: number;
        networkOut: number;
        status: string;
        lastHeartbeat: string;
        uptimeSeconds: number;
      }>;
    }>>('/admin/instances/metrics', { params }),

  // ==================== 登录告警 ====================
  getLoginAlerts: (params?: { page?: number; userId?: string; severity?: string; status?: string }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        userId: string;
        userEmail: string;
        alertType: string;
        severity: string;
        description: string;
        ipAddress: string;
        location: string | null;
        deviceInfo: string | null;
        status: string;
        createdAt: string;
        reviewedAt: string | null;
        reviewedBy: string | null;
      }>;
      stats: { total: number; pending: number; critical: number; today: number };
      total: number;
      totalPages: number;
    }>>('/admin/login-alerts', { params }),

  reviewLoginAlert: (id: string, status: string) =>
    api.post<never, ApiResponse<{ success: boolean }>>(`/admin/login-alerts/${id}/review`, { status }),

  // ==================== RBAC 权限管理 ====================
  getRoles: () =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        name: string;
        displayName: string;
        description: string | null;
        permissions: string[];
        isSystem: boolean;
        userCount: number;
        createdAt: string;
      }>;
    }>>('/admin/rbac/roles'),

  createRole: (data: { name: string; displayName: string; description?: string; permissions: string[] }) =>
    api.post<never, ApiResponse<{ id: string }>>('/admin/rbac/roles', data),

  updateRole: (id: string, data: Partial<{ displayName: string; description: string; permissions: string[] }>) =>
    api.patch<never, ApiResponse<{ success: boolean }>>(`/admin/rbac/roles/${id}`, data),

  deleteRole: (id: string) =>
    api.delete<never, ApiResponse<{ success: boolean }>>(`/admin/rbac/roles/${id}`),

  getAdminUsers: (params?: { search?: string }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        email: string;
        roles: string[];
        lastLogin: string | null;
      }>;
    }>>('/admin/rbac/users', { params }),

  assignRole: (userId: string, roleId: string) =>
    api.post<never, ApiResponse<{ success: boolean }>>('/admin/rbac/assign', { userId, roleId }),

  removeRole: (userId: string, roleId: string) =>
    api.post<never, ApiResponse<{ success: boolean }>>('/admin/rbac/remove', { userId, roleId }),

  // ==================== 用户提现审核 ====================
  getWithdrawals: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        userId: string;
        userEmail: string;
        amount: string;
        address: string;
        chain: string;
        status: string;
        createdAt: string;
      }>;
      total: number;
      page: number;
      totalPages: number;
    }>>('/admin/withdrawals', { params }),

  approveWithdrawal: (id: string, txHash?: string) =>
    api.post<never, ApiResponse<{ success: boolean; withdrawalId: string; newStatus: string }>>(`/admin/withdrawals/${id}/approve`, { txHash }),

  rejectWithdrawal: (id: string, reason?: string) =>
    api.post<never, ApiResponse<{ success: boolean; withdrawalId: string; newStatus: string }>>(`/admin/withdrawals/${id}/reject`, { reason }),

  // ==================== 策略审核 ====================
  getPendingStrategies: (params?: { page?: number; limit?: number }) =>
    api.get<never, ApiResponse<{
      strategies: Array<{
        id: string;
        name: string;
        description: string | null;
        owner_type: string;
        uploader_id: string | null;
        review_status: string;
        auto_check_passed: boolean;
        auto_check_warnings: string[] | null;
        created_at: string;
        updated_at: string;
      }>;
      total: number;
      page: number;
      totalPages: number;
    }>>('/admin/strategies/pending-review', { params }),

  approveStrategy: (id: string) =>
    api.post<never, ApiResponse<{ id: string; review_status: string }>>(`/admin/strategies/${id}/approve`),

  rejectStrategy: (id: string, reason: string) =>
    api.post<never, ApiResponse<{ id: string; review_status: string }>>(`/admin/strategies/${id}/reject`, { reason }),
};

// Agent API（代理商后台）
export const agentApi = {
  // 代理商资料
  getProfile: () =>
    api.get<never, ApiResponse<{
      id: string;
      code: string;           // 邀请码
      name: string;           // 代理商名称
      email: string;          // 邮箱
      commission_rate: string; // 返佣比例
      total_users: number;    // 下级总数
      total_commission: string; // 累计佣金
      status: string;         // 状态
      created_at: string;
      updated_at: string;
    }>>('/agents/profile'),

  // 邀请码
  getInviteCode: () =>
    api.get<never, ApiResponse<{ inviteCode: string }>>('/agents/invite-code'),

  // 下级用户列表
  getReferrals: (params?: { limit?: number; offset?: number }) =>
    api.get<never, ApiResponse<Array<{
      id: string;
      email: string;
      vip_level: number;
      created_at: string;
      totalSpent: string;
      totalCommission: string;
    }>>>('/agents/referrals', { params }),

  // 佣金明细
  getCommissions: (params?: { limit?: number }) =>
    api.get<never, ApiResponse<Array<{
      id: string;
      agent_id: string;
      user_id: string;
      user_email?: string;
      source_type: string;
      base_amount: string;
      commission_rate: string;
      commission_amount: string;
      status: string;
      settled_at?: string;
      created_at: string;
    }>>>('/agents/commissions', { params }),

  // 统计数据
  getStats: () =>
    api.get<never, ApiResponse<{
      totalUsers: number;
      totalCommission: string;
      pendingCommission: string;
      paidCommission: string;
      monthlyUsers: number;
      monthlyCommission: string;
      todayUsers: number;
      todayCommission: string;
    }>>('/agents/stats'),

  // 佣金提现
  withdraw: (data: { amount: string }) =>
    api.post<never, ApiResponse<{
      agentId: string;
      amount: string;
      availableAmount: string;
      status: string;
      message: string;
    }>>('/agents/withdraw', data),

  // 代理商概览（含 profile + stats）
  getOverview: () =>
    api.get<never, ApiResponse<{
      profile: {
        id: string;
        code: string;
        name: string;
        email: string;
        commission_rate: string;
        total_users: number;
        total_commission: string;
        status: string;
        created_at: string;
        updated_at: string;
      };
      stats: {
        totalUsers: number;
        totalCommission: string;
        pendingCommission: string;
        paidCommission: string;
        monthlyUsers: number;
        monthlyCommission: string;
        todayUsers: number;
        todayCommission: string;
      };
    }>>('/agents/overview'),
};

// Token API (链上功能)
export const tokenApi = {
  // 获取代币统计（公开）
  getStats: () =>
    api.get<never, ApiResponse<{
      totalSupply: string;
      circulatingSupply: string;
      totalBurned: string;
      monthlyBuybackUsdt: string;
      monthlyBurnedQfi: string;
      currentPrice: string;
    }>>('/tokens/stats'),

  // 获取回购历史（公开）
  getBuybackHistory: (limit?: number) =>
    api.get<never, ApiResponse<Array<{
      id: string;
      usdtSpent: string;
      qfiBought: string;
      price: string;
      txHash: string;
      boughtAt: string;
    }>>>('/tokens/buyback-history', { params: { limit } }),

  // 链上提现
  withdrawOnchain: (amount: string, toAddress: string) =>
    api.post<never, ApiResponse<{
      id: string;
      amount: string;
      fee: string;
      netAmount: string;
      toAddress: string;
      status: string;
    }>>('/tokens/withdraw-onchain', { amount, toAddress }),

  // 获取提现记录
  getWithdrawals: (limit?: number) =>
    api.get<never, ApiResponse<Array<{
      id: string;
      amount: string;
      fee: string;
      toAddress: string;
      txHash: string | null;
      status: string;
      createdAt: string;
    }>>>('/tokens/withdrawals', { params: { limit } }),
};

// AI API
export const aiApi = {
  // 查询 AI 生成配额
  getQuota: () =>
    api.get<never, ApiResponse<{
      remaining: number;
      limit: number;
    }>>('/ai/generation-quota'),

  // 生成策略
  generateStrategy: (data: { description: string; riskLevel: 'low' | 'medium' | 'high'; tradingPair?: string }) =>
    api.post<never, ApiResponse<{
      name: string;
      code: string;
      explanation: string;
    }>>('/ai/generate-strategy', data),

  // 分析交易
  analyzeTrades: (timeRange: '7d' | '30d' | '90d') =>
    api.post<never, ApiResponse<{
      summary: string;
      strengths: string[];
      weaknesses: string[];
      suggestions: string[];
      emotionalScore: number;
      riskScore: number;
    }>>('/ai/analyze-trades', { timeRange }),

  // 获取生成历史
  getHistory: (type?: 'strategy' | 'analysis', limit?: number) =>
    api.get<never, ApiResponse<Array<{
      id: string;
      type: string;
      input: string;
      output: string;
      tokens_used: number;
      model: string;
      created_at: string;
    }>>>('/ai/generation-history', { params: { type, limit } }),

  // 解读单笔交易（智能投顾）
  interpretTrade: (data: {
    pair: string;
    side: string;
    amount: string;
    price: string;
    pnl: string;
    executed_at: string;
  }) =>
    api.post<never, ApiResponse<{
      trigger: string;
      trend: string;
      action: string;
      explanation: string;
      sentiment: 'bullish' | 'bearish' | 'neutral';
    }>>('/ai/interpret-trade', data),
};

// ==================== 公开 CMS API（无需登录）====================
export const publicApi = {
  // 获取公开配置
  getConfigs: () =>
    api.get<never, ApiResponse<Record<string, any>>>('/configs/public'),

  // 获取公开内容
  getContents: (locale?: string) =>
    api.get<never, ApiResponse<Array<{
      content_key: string;
      content_type: string;
      title: string | null;
      content: string;
      metadata: Record<string, any> | null;
    }>>>('/cms/contents', { params: { locale } }),

  // 获取单个内容
  getContentByKey: (key: string, locale?: string) =>
    api.get<never, ApiResponse<{
      content_key: string;
      content_type: string;
      title: string | null;
      content: string;
      metadata: Record<string, any> | null;
    }>>(`/cms/contents/${key}`, { params: { locale } }),

  // 获取活跃 Banner
  getBanners: (position?: string) =>
    api.get<never, ApiResponse<Array<{
      id: string;
      position: string;
      title: string;
      subtitle: string | null;
      image_url: string;
      link_url: string | null;
      link_target: string;
      button_text: string | null;
    }>>>('/cms/banners', { params: { position } }),

  // 获取帮助文档列表
  getHelpDocs: (category?: string) =>
    api.get<never, ApiResponse<Array<{
      id: string;
      category: string;
      title: string;
      slug: string;
      summary: string | null;
      tags: string[];
    }>>>('/cms/help-docs', { params: { category } }),

  // 获取帮助文档详情
  getHelpDocBySlug: (slug: string) =>
    api.get<never, ApiResponse<{
      id: string;
      category: string;
      title: string;
      slug: string;
      summary: string | null;
      content: string;
      tags: string[];
    }>>(`/cms/help-docs/${slug}`),
};

// K 线数据 API
export const klineApi = {
  // 获取 K 线数据
  get: (symbol: string, interval: string = '1h', limit: number = 500) =>
    api.get<never, ApiResponse<Array<{
      time: number;       // Unix timestamp
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>>>('/market/kline', { params: { symbol, interval, limit } }),
};

// 资产兑换 API（闪兑）
export const exchangeApi = {
  // 获取支持的兑换对
  getPairs: () =>
    api.get<never, ApiResponse<{
      pairs: Array<{
        from: string;
        to: string;
        rate: string;
        fee_rate: string;
        min_amount: string;
        max_amount: string;
      }>;
    }>>('/exchange/pairs'),

  // 获取兑换报价
  getQuote: (data: {
    from_asset: 'usdt' | 'card' | 'points' | 'token';
    to_asset: 'usdt' | 'card' | 'points' | 'token';
    amount: string;
    mode?: 'standard' | 'instant';
  }) =>
    api.post<never, ApiResponse<{
      quote_id: string;
      from_asset: string;
      from_amount: string;
      to_asset: string;
      to_amount: string;
      exchange_rate: string;
      fee_rate: string;
      fee_amount: string;
      expires_at: string;
      // 积分兑换专用
      instant_amount?: string;
      vesting_amount?: string;
      vesting_days?: number;
      burned_amount?: string;
    }>>('/exchange/quote', data),

  // 执行兑换
  convert: (data: { quote_id: string }) =>
    api.post<never, ApiResponse<{
      success: boolean;
      transaction_id: string;
      from_asset: string;
      from_amount: string;
      to_asset: string;
      to_amount: string;
      new_from_balance: string;
      new_to_balance: string;
    }>>('/exchange/convert', data),

  // 获取兑换历史
  getHistory: (params?: { page?: number; limit?: number }) =>
    api.get<never, ApiResponse<{
      items: Array<{
        id: string;
        from_asset: string;
        from_amount: string;
        to_asset: string;
        to_amount: string;
        exchange_rate: string;
        fee_amount: string;
        mode?: string;
        status: string;
        created_at: string;
      }>;
      total: number;
      page: number;
      limit: number;
    }>>('/exchange/history', { params }),
};

// ==================== 交易所推广链接 API ====================
export const exchangeLinksApi = {
  /** 获取所有启用的交易所链接（公开接口） */
  getActiveLinks: () =>
    api.get<never, ApiResponse<Array<{
      id: string;
      exchange_id: string;
      name: string;
      logo: string;
      rebate: string;
      link: string;
      description: string | null;
      features: string[];
    }>>>('/exchange-links'),

  /** 获取所有交易所链接（管理员） */
  getAllLinks: () =>
    api.get<never, ApiResponse<Array<{
      id: string;
      exchange_id: string;
      name: string;
      logo: string;
      rebate: string;
      link: string;
      description: string | null;
      features: string[];
      is_active: boolean;
      sort_order: number;
      created_at: string;
      updated_at: string;
    }>>>('/exchange-links/all'),

  /** 创建交易所链接（管理员） */
  createLink: (data: {
    exchange_id: string;
    name: string;
    logo: string;
    rebate: string;
    link: string;
    description?: string;
    features?: string[];
    is_active?: boolean;
    sort_order?: number;
  }) =>
    api.post<never, ApiResponse<{ id: string }>>('/exchange-links', data),

  /** 更新交易所链接（管理员） */
  updateLink: (id: string, data: {
    exchange_id?: string;
    name?: string;
    logo?: string;
    rebate?: string;
    link?: string;
    description?: string;
    features?: string[];
    is_active?: boolean;
    sort_order?: number;
  }) =>
    api.put<never, ApiResponse<{ message: string }>>(`/exchange-links/${id}`, data),

  /** 删除交易所链接（管理员） */
  deleteLink: (id: string) =>
    api.delete<never, ApiResponse<{ message: string }>>(`/exchange-links/${id}`),
};

export default api;
