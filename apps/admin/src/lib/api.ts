/**
 * API 工具函数
 * 处理带认证的 API 请求
 */

import { API_URL } from './config';

// 获取 token
const getToken = () => localStorage.getItem('admin_token');

// 基础请求函数
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
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

  // 后端返回格式: { code, message, data }
  if (!response.ok || result.code !== 0) {
    throw new Error(result.message || '请求失败');
  }

  // 返回实际数据
  return result.data;
}

// API 方法
export const api = {
  // GET 请求
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),

  // POST 请求
  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  // PUT 请求
  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  // DELETE 请求
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

// 导出 API URL
export { API_URL };
