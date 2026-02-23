/**
 * 用户状态管理
 *
 * 当前认证状态由 lib/auth.tsx (React Context) 管理。
 * 此文件仅导出共享类型定义。
 */

export interface User {
  id: string;
  email: string;
  nickname?: string;
}

export interface UserState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User, token: string) => void;
  clearUser: () => void;
}
