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

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError<{ code: number; message: string }>) => {
    // 401 未授权，跳转登录
    if (error.response?.status === 401) {
      removeToken();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/sign-in')) {
        window.location.href = '/sign-in';
      }
    }

    // 返回统一错误格式
    const message = error.response?.data?.message || error.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

export default api;
