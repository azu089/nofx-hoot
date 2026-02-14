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

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private _locale: string | null = null; // null 表示尚未初始化，使用 cookie

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
  }

  clearToken() {
    this.token = null;
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
      // 401 处理：token 过期或无效，清除本地状态并跳转登录页
      if (response.status === 401 && !endpoint.startsWith('/auth/')) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('hoot_token');
          localStorage.removeItem('hoot_user');
          this.token = null;
          // 避免重复跳转
          if (!window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
          }
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
