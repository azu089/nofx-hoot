import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, setToken, getToken, setRefreshToken, clearTokens } from '@/lib/api';

interface User {
  id: string;
  email: string;
  role: string; // 'admin' | 'super_admin' | 'user'
  isAgent?: boolean; // 是否是代理商
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  _hasHydrated: boolean; // 标记 store 是否已从 localStorage hydrate

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAdminAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      _hasHydrated: false,

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

        // 优化：如果已有有效的用户信息，跳过 API 调用
        const currentUser = get().user;
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.isAgent)) {
          // 用户信息已存在且角色有效（管理员或代理商），直接返回
          set({ isAuthenticated: true });
          return;
        }

        set({ isLoading: true });
        try {
          const response = await authApi.me();
          if (response.code === 0 && response.data) {
            const userData = response.data as User;

            // 验证角色是否为管理员或代理商
            if (userData.role === 'admin' || userData.role === 'super_admin' || userData.isAgent) {
              set({
                user: userData,
                isAuthenticated: true,
              });
            } else {
              // 非管理员/代理商，清除认证
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

      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },
    }),
    {
      name: 'quantfi-admin-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        // 当从 localStorage 恢复状态后，标记已 hydrate
        state?.setHasHydrated(true);
      },
    }
  )
);
