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

// Token 管理（使用不同的 key 以区分用户前端）
const TOKEN_KEY = 'quantfi_admin_token';
const REFRESH_TOKEN_KEY = 'quantfi_admin_refresh_token';

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

// 别名函数（用于 admin-auth.store.ts）
export const getAdminToken = getToken;
export const setAdminToken = setToken;
export const clearAdminTokens = clearTokens;

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

// Auth API（管理员登录 - 使用统一登录接口）
export const authApi = {
  login: (email: string, password: string) =>
    api.post<never, ApiResponse<{
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      user: { id: string; email: string; role: string; vipLevel: number };
    }>>('/auth/login', { email, password }),

  me: () =>
    api.get<never, ApiResponse<{ id: string; email: string; role: string; vipLevel: number }>>('/auth/me'),

  logout: () =>
    api.post<never, ApiResponse<void>>('/auth/logout'),
};

// 管理员认证 API（admin-auth.store.ts 使用）
export const adminAuthApi = authApi;

// Admin API（完整复制）
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
        status: string;
        instanceCount: number;
        totalTrades: number;
        createdAt: string;
        lastLogin: string;
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

  // ==================== 提现管理 ====================
  getWithdrawals: (params?: { page?: number; status?: string }) =>
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
    }>>('/admin/withdrawals', { params }),

  approveWithdrawal: (id: string) =>
    api.post<never, ApiResponse<{ success: boolean }>>(`/admin/withdrawals/${id}/approve`),

  rejectWithdrawal: (id: string, reason: string) =>
    api.post<never, ApiResponse<{ success: boolean }>>(`/admin/withdrawals/${id}/reject`, { reason }),

  // ==================== VPS 实例管理 ====================
  getInstances: (params?: { page?: number; status?: string }) =>
    api.get<never, ApiResponse<{
      data: Array<{
        id: string;
        userId: string;
        userEmail: string;
        status: string;
        ipAddress: string;
        region: string;
        strategyName: string;
        cpu: number;
        memory: number;
        createdAt: string;
        lastHeartbeat: string;
      }>;
      total: number;
    }>>('/admin/instances', { params }),

  restartInstance: (id: string) =>
    api.post<never, ApiResponse<{ success: boolean }>>(`/admin/instances/${id}/restart`),

  destroyInstance: (id: string) =>
    api.post<never, ApiResponse<{ success: boolean }>>(`/admin/instances/${id}/destroy`),

  // ==================== Kill Switch 紧急开关 ====================
  activateKillSwitch: (type: string, reason: string) =>
    api.post<never, ApiResponse<{ success: boolean }>>('/admin/kill-switch/activate', { type, reason }),

  deactivateKillSwitch: (type: string) =>
    api.post<never, ApiResponse<{ success: boolean }>>('/admin/kill-switch/deactivate', { type }),

  getKillSwitchStatus: () =>
    api.get<never, ApiResponse<{
      enabled: boolean;
      runningInstances: number;
      stoppedInstances: number;
      totalInstances: number;
      lastTriggered: {
        adminId: string;
        reason: string;
        stoppedCount: number;
        triggeredAt: string;
      } | null;
    }>>('/admin/kill-switch/status'),
};

export default api;
