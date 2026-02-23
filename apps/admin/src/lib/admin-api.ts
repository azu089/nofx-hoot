/**
 * Admin API 客户端
 * 基于 axios 风格的响应格式
 */

import { API_URL } from './config';

// 获取 token
const getToken = () => localStorage.getItem('admin_token');

// 响应包装
interface ApiResponse<T = unknown> {
  data: {
    code: number;
    message: string;
    data: T;
  };
  status: number;
}

// 基础请求函数
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // 处理 401 未授权
  if (response.status === 401) {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/login';
    throw new Error('登录已过期，请重新登录');
  }

  const result = await response.json();

  // 返回 axios 风格的响应
  return {
    data: result,
    status: response.status,
  };
}

// Admin API 实例
export const adminApi = {
  // GET 请求
  get: <T = unknown>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),

  // POST 请求
  post: <T = unknown>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  // PUT 请求
  put: <T = unknown>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  // PATCH 请求
  patch: <T = unknown>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),

  // DELETE 请求
  delete: <T = unknown>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

// 导出 API URL
export { API_URL };
