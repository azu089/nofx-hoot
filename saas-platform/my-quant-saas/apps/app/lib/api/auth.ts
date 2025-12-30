import { api } from './client';
import { ApiResponse, User } from './types';

/**
 * 认证相关 API
 */
export const authApi = {
  /**
   * 登录
   */
  login: (email: string, password: string) =>
    api.post<never, ApiResponse<{ access_token: string }>>('/auth/login', { email, password }),

  /**
   * 注册
   */
  register: (email: string, password: string, inviteCode?: string) =>
    api.post<never, ApiResponse<{ id: string; email: string }>>('/auth/register', {
      email,
      password,
      invite_code: inviteCode,
    }),

  /**
   * 获取当前用户信息
   */
  me: () => api.get<never, ApiResponse<User>>('/auth/me'),
};
