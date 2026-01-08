import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, setToken, getToken, setRefreshToken, clearTokens } from '@/lib/api';
import { getCachedFingerprint } from '@/lib/fingerprint';

interface User {
  id: string;
  email: string;
  vipLevel: number;
  role?: string; // 'user' | 'admin' | 'super_admin'
  agentId?: string | null; // 所属代理商 ID（如果是代理商推荐的用户）
  isAgent?: boolean; // 是否是代理商
  status?: string;
  inviteCode?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  _hasHydrated: boolean; // 标记 store 是否已从 localStorage hydrate

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, inviteCode?: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      _hasHydrated: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          // 收集设备指纹
          let fingerprint;
          try {
            fingerprint = await getCachedFingerprint();
          } catch (err) {
            console.warn('设备指纹收集失败:', err);
          }

          const response = await authApi.login(email, password, fingerprint);
          // 后端返回 accessToken 和 refreshToken (camelCase)
          const token = response.data.accessToken || response.data.access_token;
          const refreshToken = response.data.refreshToken;
          if (response.code === 0 && token) {
            setToken(token);
            if (refreshToken) {
              setRefreshToken(refreshToken);
            }

            // 检查是否有可疑设备警告
            if (response.data.fingerprintCheck?.isSuspicious) {
              console.warn('设备安全警告:', response.data.fingerprintCheck.suspiciousReason);
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

      register: async (email: string, password: string, inviteCode?: string) => {
        set({ isLoading: true });
        try {
          // 收集设备指纹
          let fingerprint;
          try {
            fingerprint = await getCachedFingerprint();
          } catch (err) {
            console.warn('设备指纹收集失败:', err);
          }

          const response = await authApi.register(email, password, inviteCode, fingerprint);
          if (response.code !== 0) {
            throw new Error(response.message || '注册失败');
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
            // 后端返回的是 camelCase（UserResponseDto），类型断言为 User
            const userData = response.data as unknown as User;
            set({
              user: userData,
              isAuthenticated: true,
            });
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
      name: 'quantfi-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        // 当从 localStorage 恢复状态后，标记已 hydrate
        state?.setHasHydrated(true);
      },
    }
  )
);
