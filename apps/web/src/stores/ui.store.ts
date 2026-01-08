import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'dark' | 'light' | 'system';

interface UiStore {
  // 状态
  themeMode: ThemeMode;  // 用户选择的主题模式
  resolvedTheme: 'dark' | 'light';  // 实际应用的主题
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;  // 侧边栏是否折叠
  mobileMenuOpen: boolean;
  // 公告未读数
  unreadAnnouncementsCount: number;
  // 已读公告 ID 列表
  readAnnouncementIds: string[];
  // hydration 状态
  _hasHydrated: boolean;

  // 操作
  setThemeMode: (mode: ThemeMode) => void;
  setResolvedTheme: (theme: 'dark' | 'light') => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  // 公告操作
  setUnreadCount: (count: number) => void;
  markAnnouncementAsRead: (id: string) => void;
  markAllAnnouncementsAsRead: () => void;
  // 应用主题到 DOM
  applyTheme: () => void;
  setHasHydrated: (state: boolean) => void;
}

// 获取系统主题
const getSystemTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useUiStore = create<UiStore>()(
  persist(
    (set, get) => ({
      // 默认暗黑主题
      themeMode: 'dark',
      resolvedTheme: 'dark',
      sidebarOpen: true,
      sidebarCollapsed: false,
      mobileMenuOpen: false,
      unreadAnnouncementsCount: 0,
      readAnnouncementIds: [],
      _hasHydrated: false,

      setThemeMode: (mode) => {
        const resolved = mode === 'system' ? getSystemTheme() : mode;
        set({ themeMode: mode, resolvedTheme: resolved });
        get().applyTheme();
      },

      setResolvedTheme: (theme) => {
        set({ resolvedTheme: theme });
        get().applyTheme();
      },

      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      toggleSidebarCollapsed: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),

      setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

      toggleMobileMenu: () => set({ mobileMenuOpen: !get().mobileMenuOpen }),

      setUnreadCount: (count) => set({ unreadAnnouncementsCount: count }),

      markAnnouncementAsRead: (id) => {
        const { readAnnouncementIds, unreadAnnouncementsCount } = get();
        if (!readAnnouncementIds.includes(id)) {
          set({
            readAnnouncementIds: [...readAnnouncementIds, id],
            unreadAnnouncementsCount: Math.max(0, unreadAnnouncementsCount - 1),
          });
        }
      },

      markAllAnnouncementsAsRead: () =>
        set({ unreadAnnouncementsCount: 0 }),

      applyTheme: () => {
        if (typeof window === 'undefined') return;
        const { resolvedTheme } = get();
        document.documentElement.setAttribute('data-theme', resolvedTheme);
      },

      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },
    }),
    {
      name: 'quantfi-ui-store', // localStorage key
      partialize: (state) => ({
        themeMode: state.themeMode,
        sidebarOpen: state.sidebarOpen,
        sidebarCollapsed: state.sidebarCollapsed,
        readAnnouncementIds: state.readAnnouncementIds,
      }),
      onRehydrateStorage: () => (state) => {
        // 恢复后立即应用主题并标记已 hydrate
        if (state) {
          const resolved = state.themeMode === 'system' ? getSystemTheme() : state.themeMode;
          state.resolvedTheme = resolved;
          state.applyTheme();
          state.setHasHydrated(true);
        }
      },
    }
  )
);
