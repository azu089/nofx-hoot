'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';

interface User {
  id: string;
  uid?: number;
  email: string;
  nickname: string;
  telegramId?: string;
  telegramUsername?: string;
  walletAddress?: string;
  emailVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** TG Mini App 自动登录失败的错误信息（非空时可在 UI 上展示） */
  tgAutoLoginError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname?: string, inviteCode?: string) => Promise<void>;
  logout: () => Promise<void> | void;
  sendVerificationCode: (email: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  /** 钱包登录：接收已验证的 accessToken 和用户信息，写入认证状态 */
  walletLogin: (accessToken: string, user: User, refreshToken?: string) => void;
  /** TG WebApp 登录：用 Telegram Mini App 的 initData 直接登录/注册 */
  telegramWebAppLogin: (initData: string) => Promise<void>;
  /** 更新本地用户状态（保存资料后刷新 context + localStorage） */
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'hoot_token';
const USER_KEY = 'hoot_user';

/** Cookie 最大有效期：24 小时（秒） */
const COOKIE_MAX_AGE = 86400;

/** 同步写入 hoot_token cookie（供 Next.js Middleware 读取） */
function setAuthCookie(token: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** 清除 hoot_token cookie */
function clearAuthCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * 从 URL hash 或 query string 中提取 tgWebAppData（initData 原始字符串）。
 * Telegram 所有平台（Desktop / iOS / Android / Web）打开 Mini App 时，
 * 均会在 URL 中携带这个参数，无需任何 CDN 脚本。
 *
 * 格式示例：
 *   hash:  #tgWebAppData=query_id%3D...%26user%3D...&tgWebAppVersion=8
 *   query: ?tgWebAppData=query_id%3D...%26user%3D...&tgWebAppVersion=8
 */
function getTgInitDataFromUrl(): string | undefined {
  // hash 优先（Telegram Desktop、iOS、Android 均使用 hash 格式）
  const hash = window.location.hash;
  if (hash.includes('tgWebAppData')) {
    try {
      const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
      const data = params.get('tgWebAppData');
      if (data) return data;
    } catch {
      // 忽略解析错误
    }
  }

  // query string 备选（部分 Telegram Web 版本）
  const search = window.location.search;
  if (search.includes('tgWebAppData')) {
    try {
      const params = new URLSearchParams(search);
      const data = params.get('tgWebAppData');
      if (data) return data;
    } catch {
      // 忽略解析错误
    }
  }

  return undefined;
}

/**
 * 判断当前是否处于 Telegram Mini App 环境。
 * 不依赖 CDN 脚本，通过原生 bridge 对象 / URL 参数检测。
 */
function isTelegramEnv(): boolean {
  const url = window.location.href;
  // URL 中含有任意 tgWebApp 参数（最可靠）
  if (url.includes('tgWebApp')) return true;
  // 原生 Telegram WebView 注入了 TelegramWebviewProxy（Desktop/iOS/Android）
  if ((window as { TelegramWebviewProxy?: unknown }).TelegramWebviewProxy) return true;
  // CDN 脚本已加载（部分场景）
  if ((window as { Telegram?: { WebApp?: unknown } }).Telegram?.WebApp) return true;
  return false;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tgAutoLoginError, setTgAutoLoginError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- 从 localStorage 初始化状态是合理的一次性副作用
  useEffect(() => {
    // ── Step 1: 读取本地缓存 ────────────────────────────────────────────────
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken) {
      setToken(storedToken);
      api.setToken(storedToken);
    }
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        // 忽略解析错误
      }
    }

    if (storedToken) {
      setIsLoading(false);
      return;
    }

    // ── Step 2: TG Mini App 静默自动登录 ────────────────────────────────────
    // 方法1：直接从 URL hash/query 读取 tgWebAppData（所有平台通用，无 CDN 依赖）
    let initDataRaw = getTgInitDataFromUrl();

    // 方法2：CDN 脚本已加载时，从 window.Telegram.WebApp.initData 读取
    if (!initDataRaw) {
      initDataRaw =
        (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData ||
        undefined;
    }

    // 不在 Telegram 环境 → 直接显示正常页面
    if (!initDataRaw && !isTelegramEnv()) {
      setIsLoading(false);
      return;
    }

    // ── Step 3: 已确认在 TG 环境，但 initData 暂不可用 ──────────────────────
    // 部分原生客户端通过 native bridge 异步注入，最长等待 3 秒
    const doTgLogin = (data: string) => {
      // 通知 Telegram 客户端页面已准备好（如果 CDN SDK 已加载）
      try {
        (window as { Telegram?: { WebApp?: { ready?: () => void } } }).Telegram?.WebApp?.ready?.();
      } catch {
        // 忽略
      }

      api
        .post<{ accessToken: string; refreshToken?: string; user: User }>(
          '/auth/telegram/webapp-login',
          { initData: data },
        )
        .then((response) => {
          const { accessToken, refreshToken: rt, user: userData } = response.data;
          setToken(accessToken);
          setUser(userData);
          api.setToken(accessToken);
          localStorage.setItem(TOKEN_KEY, accessToken);
          localStorage.setItem(USER_KEY, JSON.stringify(userData));
          if (rt) localStorage.setItem('hoot_refresh_token', rt);
          setAuthCookie(accessToken);
        })
        .catch((err: unknown) => {
          const errMsg = err instanceof Error ? err.message : '自动登录失败';
          console.error('[TG Mini App 自动登录失败]', errMsg);
          setTgAutoLoginError(errMsg);
        })
        .finally(() => {
          setIsLoading(false);
        });
    };

    if (initDataRaw) {
      // 已有 initData，直接登录
      doTgLogin(initDataRaw);
      return;
    }

    // 在 TG 环境但 initData 尚未就绪 → 轮询等待（最长 3 秒）
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // 30 × 100ms = 3 秒

    const poll = () => {
      const data =
        getTgInitDataFromUrl() ||
        (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData;

      if (data) {
        doTgLogin(data);
        return;
      }
      attempts++;
      if (attempts < MAX_ATTEMPTS) {
        setTimeout(poll, 100);
      } else {
        // 3 秒仍无 initData，提示用户手动登录
        setTgAutoLoginError('Telegram 初始化超时，请关闭后重新打开');
        setIsLoading(false);
      }
    };

    poll();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post<{
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
      user: User;
    }>('/auth/login', { email, password });

    const { accessToken, refreshToken: rt, user: userData } = response.data;

    setToken(accessToken);
    setUser(userData);
    api.setToken(accessToken);

    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    if (rt) localStorage.setItem('hoot_refresh_token', rt);
    setAuthCookie(accessToken);
  };

  const register = async (email: string, password: string, nickname?: string, inviteCode?: string) => {
    await api.post('/auth/register', { email, password, nickname, inviteCode });
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // 忽略失败
    }
    setToken(null);
    setUser(null);
    api.clearAllTokens();
    clearAuthCookie();
  };

  const sendVerificationCode = async (email: string) => {
    await api.post('/auth/send-verification', { email });
  };

  const verifyEmail = async (email: string, code: string) => {
    const response = await api.post<{
      message: string;
      accessToken: string;
      refreshToken: string;
      user: User;
    }>('/auth/verify-email', { email, code });

    const { accessToken, refreshToken: rt, user: userData } = response.data;
    setToken(accessToken);
    setUser(userData);
    api.setToken(accessToken);
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    if (rt) localStorage.setItem('hoot_refresh_token', rt);
    setAuthCookie(accessToken);
  };

  const telegramWebAppLogin = async (initData: string) => {
    const response = await api.post<{
      accessToken: string;
      refreshToken?: string;
      user: User;
    }>('/auth/telegram/webapp-login', { initData });

    const { accessToken, refreshToken: rt, user: userData } = response.data;

    setToken(accessToken);
    setUser(userData);
    api.setToken(accessToken);
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    if (rt) localStorage.setItem('hoot_refresh_token', rt);
    setAuthCookie(accessToken);
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const walletLogin = (accessToken: string, userData: User, refreshToken?: string) => {
    setToken(accessToken);
    setUser(userData);
    api.setToken(accessToken);
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    if (refreshToken) localStorage.setItem('hoot_refresh_token', refreshToken);
    setAuthCookie(accessToken);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        tgAutoLoginError,
        login,
        register,
        logout,
        sendVerificationCode,
        verifyEmail,
        walletLogin,
        telegramWebAppLogin,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
