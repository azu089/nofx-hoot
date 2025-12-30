import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, setToken, getToken, setRefreshToken, clearTokens } from '@/lib/api';

interface User {
  id: string;
  email: string;
  role: string; // 'admin' | 'super_admin'
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAdminAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await authApi.login(email, password);
          const token = response.data.accessToken;
          const refreshToken = response.data.refreshToken;

          if (response.code === 0 && token) {
            setToken(token);
            if (refreshToken) {
              setRefreshToken(refreshToken);
            }

            // 获取用户信息
            await get().checkAuth();
          } else {
            throw new Error(response.message || '登录失败');
          }
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        clearTokens();
        set({ user: null, isAuthenticated: false });
      },

      checkAuth: async () => {
        const token = getToken();
        if (!token) {
          set({ user: null, isAuthenticated: false });
          return;
        }

        set({ isLoading: true });
        try {
          const response = await authApi.me();
          if (response.code === 0 && response.data) {
            const userData = response.data as User;

            // 验证角色是否为管理员
            if (userData.role === 'admin' || userData.role === 'super_admin') {
              set({
                user: userData,
                isAuthenticated: true,
              });
            } else {
              // 非管理员，清除认证
              clearTokens();
              set({ user: null, isAuthenticated: false });
            }
          } else {
            clearTokens();
            set({ user: null, isAuthenticated: false });
          }
        } catch {
          clearTokens();
          set({ user: null, isAuthenticated: false });
        } finally {
          set({ isLoading: false });
        }
      },

      setUser: (user: User | null) => {
        set({ user, isAuthenticated: !!user });
      },
    }),
    {
      name: 'quantfi-admin-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
