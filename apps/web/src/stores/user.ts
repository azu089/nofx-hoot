/**
 * 用户状态管理
 * 使用 Zustand
 */

// TODO: 安装 zustand 后启用
// import { create } from 'zustand';
// import { persist } from 'zustand/middleware';

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

// Zustand store 占位
// export const useUserStore = create<UserState>()(
//   persist(
//     (set) => ({
//       user: null,
//       token: null,
//       isAuthenticated: false,
//       setUser: (user, token) => set({ user, token, isAuthenticated: true }),
//       clearUser: () => set({ user: null, token: null, isAuthenticated: false }),
//     }),
//     {
//       name: 'quantfi-user',
//     }
//   )
// );

export {};
