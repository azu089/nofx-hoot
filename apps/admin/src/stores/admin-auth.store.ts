import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { adminAuthApi, setAdminToken, getAdminToken, clearAdminTokens } from '@/lib/api';

interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'super_admin';
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AdminAuthState {
  user: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  checkAdminAuth: () => boolean;
  setUser: (user: AdminUser | null) => void;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isAdmin: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await adminAuthApi.login(email, password);
          // 后端返回 accessToken
          const token = response.data.accessToken;

          if (response.code === 0 && token) {
            setAdminToken(token);

            // 获取用户信息并验证管理员权限
            await get().checkAuth();

            // 验证是否为管理员
            const isAdmin = get().checkAdminAuth();
            if (!isAdmin) {
              // 不是管理员，清理登录状态
              get().logout();
              throw new Error('无管理员权限，访问被拒绝');
            }
          } else {
            throw new Error(response.message || '登录失败');
          }
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        clearAdminTokens();
        set({
          user: null,
          isAuthenticated: false,
          isAdmin: false,
        });
      },

      checkAuth: async () => {
        const token = getAdminToken();
        if (!token) {
          set({
            user: null,
            isAuthenticated: false,
            isAdmin: false,
          });
          return;
        }

        set({ isLoading: true });
        try {
          const response = await adminAuthApi.me();
          if (response.code === 0 && response.data) {
            // 验证角色
            const userData = response.data as unknown as AdminUser;
            const isAdminRole = userData.role === 'admin' || userData.role === 'super_admin';

            if (!isAdminRole) {
              // 不是管理员角色，清除登录状态
              clearAdminTokens();
              set({
                user: null,
                isAuthenticated: false,
                isAdmin: false,
              });
              return;
            }

            set({
              user: userData,
              isAuthenticated: true,
              isAdmin: true,
            });
          } else {
            clearAdminTokens();
            set({
              user: null,
              isAuthenticated: false,
              isAdmin: false,
            });
          }
        } catch {
          clearAdminTokens();
          set({
            user: null,
            isAuthenticated: false,
            isAdmin: false,
          });
        } finally {
          set({ isLoading: false });
        }
      },

      checkAdminAuth: () => {
        const { user } = get();
        return !!(user && (user.role === 'admin' || user.role === 'super_admin'));
      },

      setUser: (user: AdminUser | null) => {
        const isAdminRole = user ? (user.role === 'admin' || user.role === 'super_admin') : false;
        set({
          user,
          isAuthenticated: !!user,
          isAdmin: isAdminRole,
        });
      },
    }),
    {
      name: 'quantfi_admin_auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin,
      }),
    }
  )
);
