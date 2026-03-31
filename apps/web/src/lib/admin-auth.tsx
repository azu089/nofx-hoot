'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

/* ─────────────────────────────────────────
 * Admin 专用 API 客户端
 * 与用户端 api.ts 完全隔离，避免 Token 冲突
 * ───────────────────────────────────────── */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api';

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  request_id: string;
}

const ADMIN_TOKEN_KEY = 'hoot_admin_token';
const ADMIN_USER_KEY = 'hoot_admin_user';

/** Cookie 最大有效期：24 小时（秒） */
const ADMIN_COOKIE_MAX_AGE = 86400;

/** 同步写入 hoot_admin_token cookie（供 Next.js Middleware 读取） */
function setAdminAuthCookie(token: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${ADMIN_TOKEN_KEY}=${token}; path=/; max-age=${ADMIN_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** 清除 hoot_admin_token cookie */
function clearAdminAuthCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${ADMIN_TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`;
}

class AdminApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // 从 localStorage 恢复 token
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(ADMIN_TOKEN_KEY);
    }
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const url = `${this.baseUrl}${endpoint}`;

    let response: Response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch {
      throw new Error('无法连接到服务器，请检查网络连接');
    }

    if (!response.ok) {
      // Admin 401: 清除 admin token, 跳转 /admin-login
      if (response.status === 401 && !endpoint.startsWith('/admin/auth/login')) {
        this.clearToken();
        if (typeof window !== 'undefined') {
          localStorage.removeItem(ADMIN_TOKEN_KEY);
          localStorage.removeItem(ADMIN_USER_KEY);
          if (!window.location.pathname.includes('admin-login')) {
            window.location.href = '/admin-login';
          }
        }
        throw new Error('管理员登录已过期，请重新登录');
      }

      let error: { message?: string } = {};
      try {
        error = await response.json();
      } catch {
        // 非 JSON 响应
      }
      throw new Error(error.message || 'API 请求失败');
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

/** 管理后台专用 API 实例 — 独立于用户端 api，Token 互不干扰 */
export const adminApi = new AdminApiClient(API_URL);

/* ─────────────────────────────────────────
 * Admin Auth Context
 * ───────────────────────────────────────── */

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  totpEnabled: boolean;
}

interface AdminAuthContextType {
  admin: AdminUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string, totpCode?: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(ADMIN_TOKEN_KEY);
    const storedAdmin = localStorage.getItem(ADMIN_USER_KEY);

    if (storedToken) {
      // Cookie/localStorage 一致性修复：
      // Cookie 24h 过期但 localStorage 永不过期，cookie 消失后
      // middleware 拦截 /admin 路由 → 重定向 /admin-login，
      // 但 AdminAuthProvider 读 localStorage 认为已登录 → 死循环转圈
      // 修复：从 localStorage 恢复 cookie（token 本身可能仍有效）
      const cookieHasToken = document.cookie.includes(ADMIN_TOKEN_KEY + '=');
      if (!cookieHasToken) {
        setAdminAuthCookie(storedToken);
      }

      setToken(storedToken);
      adminApi.setToken(storedToken);
    }

    if (storedAdmin) {
      try {
        setAdmin(JSON.parse(storedAdmin));
      } catch {
        // ignore
      }
    }

    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string, totpCode?: string) => {
    const response = await adminApi.post<{
      token: string;
      accessToken?: string;
      admin: AdminUser;
    }>('/admin/auth/login', { username, password, totpCode });

    const { admin: adminData } = response.data;
    const accessToken = (response.data.token || response.data.accessToken) as string;

    setToken(accessToken);
    setAdmin(adminData);
    adminApi.setToken(accessToken);

    localStorage.setItem(ADMIN_TOKEN_KEY, accessToken);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(adminData));
    // 同步写入 cookie，供 Next.js Middleware 管理员路由守卫使用
    setAdminAuthCookie(accessToken);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setAdmin(null);
    adminApi.clearToken();
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
    // 同步清除 cookie，确保 Next.js Middleware 立即生效
    clearAdminAuthCookie();
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        token,
        isLoading,
        isAuthenticated: !!token,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
