/**
 * API 客户端配置
 * 用于与后端 NestJS API 通信
 * 支持多语言参数传递
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api';

// 前端语言到后端语言的映射（处理差异）
const LOCALE_MAP: Record<string, string> = {
  'zh-TW': 'zh-HK', // 前端繁体使用 zh-TW，后端使用 zh-HK
};

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  request_id: string;
}

// 从 cookie 读取 locale（同步执行，无需等待 React）
function getLocaleFromCookie(): string {
  if (typeof document === 'undefined') return 'zh-CN';
  const value = `; ${document.cookie}`;
  const parts = value.split('; NEXT_LOCALE=');
  if (parts.length === 2) {
    const locale = parts.pop()?.split(';').shift();
    if (locale) return locale;
  }
  return 'zh-CN';
}

// 公开端点前缀（无需 token 即可访问）
// 公开前缀：无需 token 即可访问
const PUBLIC_PREFIXES = ['/auth/', '/market/', '/config/'];

// 虽然路径前缀在 PUBLIC_PREFIXES 中，但这些具体端点仍需认证（触发 401 自动续期）
const PROTECTED_PREFIXES = [
  '/auth/bind/',              // 绑定邮箱/钱包
  '/auth/logout',             // 登出
  '/auth/profile',            // 用户资料
  '/auth/change-password',    // 修改密码
  '/auth/telegram/bind-code', // 生成 TG 绑定码
];

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private _locale: string | null = null; // null 表示尚未初始化，使用 cookie
  private refreshPromise: Promise<boolean> | null = null;
  private authFailed = false; // 401 短路：防止 token 失效后并发请求刷屏 console

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * 获取当前 locale（优先使用显式设置的值，否则从 cookie 读取）
   */
  private get locale(): string {
    // 如果已经显式设置了 locale，使用它
    if (this._locale !== null) {
      return this._locale;
    }
    // 否则从 cookie 读取（每次请求时都检查，确保始终使用最新值）
    return getLocaleFromCookie();
  }

  setToken(token: string) {
    this.token = token;
    this.authFailed = false; // 登录成功，重置短路标记
  }

  hasToken(): boolean {
    return !!this.token;
  }

  clearToken() {
    this.clearAllTokens();
  }

  /**
   * 清除所有 token（access token + refresh token）
   */
  clearAllTokens() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('hoot_token');
      localStorage.removeItem('hoot_user');
      localStorage.removeItem('hoot_refresh_token');
    }
  }

  /**
   * 尝试用 refresh token 换取新的 access token
   * 使用并发锁防止多个 401 同时触发 refresh
   */
  private async tryRefreshToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this._doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * 实际执行 refresh 请求（使用原生 fetch 避免循环 401）
   */
  private async _doRefresh(): Promise<boolean> {
    const refreshToken =
      typeof window !== 'undefined'
        ? localStorage.getItem('hoot_refresh_token')
        : null;

    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      const result = data.data || data;

      if (result.accessToken && result.refreshToken) {
        this.token = result.accessToken;
        if (typeof window !== 'undefined') {
          localStorage.setItem('hoot_token', result.accessToken);
          localStorage.setItem('hoot_refresh_token', result.refreshToken);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 设置当前语言（通常由 LocaleProvider 调用）
   */
  setLocale(locale: string) {
    this._locale = locale;
  }

  /**
   * 获取当前语言（转换为后端格式）
   */
  getBackendLocale(): string {
    return LOCALE_MAP[this.locale] || this.locale;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const isPublic = PUBLIC_PREFIXES.some(p => endpoint.startsWith(p))
      && !PROTECTED_PREFIXES.some(p => endpoint.startsWith(p));

    // 短路 1：auth 已失败（token 过期 + refresh 失败），非公开请求直接拦截，不再发网络请求
    if (this.authFailed && !isPublic) {
      throw new Error('登录已过期，请重新登录');
    }

    // 短路 2：无 token 且非公开端点，不发请求
    if (!this.token && !isPublic) {
      throw new Error('未登录');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept-Language': this.getBackendLocale(),
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    // 自动添加 locale 参数到 URL
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (!url.searchParams.has('locale')) {
      url.searchParams.set('locale', this.getBackendLocale());
    }

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        ...options,
        headers,
      });
    } catch {
      // 网络错误（后端未启动、断网等）
      throw new Error('无法连接到服务器，请检查网络连接');
    }

    if (!response.ok) {
      // 401 处理：先尝试 refresh token 续期，再决定是否跳转登录
      if (response.status === 401 && !isPublic) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          // 续期成功，重试原请求（更新 Authorization 头）
          (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
          const retryResponse = await fetch(url.toString(), { ...options, headers });
          if (retryResponse.ok) {
            return retryResponse.json();
          }
        }
        // refresh 失败或重试仍失败，标记 auth 失败 + 清除 token + 跳转登录
        this.authFailed = true;
        this.clearAllTokens();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        throw new Error('登录已过期，请重新登录');
      }

      let error: { message?: string } = {};
      try {
        error = await response.json();
      } catch {
        // 响应体非 JSON
      }
      throw new Error(error.message || 'API 请求失败');
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async patch<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient(API_URL);
export default api;
