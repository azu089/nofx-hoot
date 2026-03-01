'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';

interface User {
  id: string;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tgAutoLoginError, setTgAutoLoginError] = useState<string | null>(null);

  // 在客户端挂载后从 localStorage 读取认证状态，或在 TG Mini App 环境中静默自动登录
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 从 localStorage 初始化状态是合理的一次性副作用
  useEffect(() => {
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
      // 已有本地 token，直接标记加载完成
      setIsLoading(false);
      return;
    }

    // ── TG Mini App 静默自动登录 ──────────────────────────────────────────────
    // telegram-web-app.js 使用 beforeInteractive 加载，此处 window.Telegram.WebApp 已存在。
    // 但原生客户端（Mac / iOS / Android）通过 native bridge 异步注入 initData，
    // 需要轮询等待，最长 3 秒（每 100ms × 30 次）。
    type TgWebApp = { initData?: string; ready?: () => void };

    const tgWebApp = (window as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;

    if (tgWebApp === undefined) {
      // Telegram SDK 未加载（极少数情况，beforeInteractive 失败），直接显示登录页
      setIsLoading(false);
      return;
    }

    // SDK 已加载（在 Telegram 环境中），等待 initData 就绪
    const doTgLogin = () => {
      const initData = (window as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp?.initData;
      if (!initData) {
        setIsLoading(false);
        return;
      }
      // 通知 Telegram 客户端页面已准备好
      (window as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp?.ready?.();
      api
        .post<{ accessToken: string; refreshToken?: string; user: User }>(
          '/auth/telegram/webapp-login',
          { initData },
        )
        .then((response) => {
          const { accessToken, refreshToken: rt, user: userData } = response.data;
          setToken(accessToken);
          setUser(userData);
          api.setToken(accessToken);
          localStorage.setItem(TOKEN_KEY, accessToken);
          localStorage.setItem(USER_KEY, JSON.stringify(userData));
          if (rt) {
            localStorage.setItem('hoot_refresh_token', rt);
          }
          setAuthCookie(accessToken);
        })
        .catch((err: unknown) => {
          // initData 无效或过期，降级显示正常登录页面，并暴露错误信息方便调试
          const errMsg = err instanceof Error ? err.message : '自动登录失败';
          console.error('[TG Mini App 自动登录失败]', errMsg);
          setTgAutoLoginError(errMsg);
        })
        .finally(() => {
          setIsLoading(false);
        });
    };

    // initData 已立即就绪（Telegram Web 场景，从 URL hash 解析）
    if (tgWebApp.initData) {
      doTgLogin();
      return;
    }

    // initData 尚未就绪（原生 App native bridge 异步注入），轮询等待
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // 30 × 100ms = 3 秒

    const pollForInitData = () => {
      const data = (window as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp?.initData;
      if (data) {
        doTgLogin();
        return;
      }
      attempts++;
      if (attempts < MAX_ATTEMPTS) {
        setTimeout(pollForInitData, 100);
      } else {
        // 3 秒仍无 initData，认为不在正式 Mini App 上下文（如测试/开发链接）
        setIsLoading(false);
      }
    };

    pollForInitData();
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
    if (rt) {
      localStorage.setItem('hoot_refresh_token', rt);
    }
    // 同步写入 cookie，供 Next.js Middleware 路由守卫使用
    setAuthCookie(accessToken);
  };

  const register = async (email: string, password: string, nickname?: string, inviteCode?: string) => {
    await api.post('/auth/register', { email, password, nickname, inviteCode });
    // 注册后不自动登录，需要先验证邮箱
  };

  const logout = async () => {
    // 先通知后端撤销所有 refresh token（忽略失败，本地状态照常清除）
    try {
      await api.post('/auth/logout', {});
    } catch {
      // 即使后端调用失败，也要清除本地状态
    }

    setToken(null);
    setUser(null);
    api.clearAllTokens();
    // 同步清除 cookie，确保 Next.js Middleware 立即生效
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

    // 验证成功后自动写入登录态，不再需要手动登录
    const { accessToken, refreshToken: rt, user: userData } = response.data;
    setToken(accessToken);
    setUser(userData);
    api.setToken(accessToken);
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    if (rt) {
      localStorage.setItem('hoot_refresh_token', rt);
    }
    setAuthCookie(accessToken);
  };

  /**
   * TG WebApp 登录：传入 Telegram Mini App initData，后端验签后返回 JWT
   */
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
    if (rt) {
      localStorage.setItem('hoot_refresh_token', rt);
    }
    setAuthCookie(accessToken);
  };

  /**
   * 更新本地用户状态（例如修改昵称后同步到 context + localStorage）
   */
  const updateUser = (updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  /**
   * 钱包登录完成后写入认证状态
   * 由 useWallet.walletLogin 完成 nonce→签名→后端验证后调用
   */
  const walletLogin = (accessToken: string, userData: User, refreshToken?: string) => {
    setToken(accessToken);
    setUser(userData);
    api.setToken(accessToken);
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    if (refreshToken) {
      localStorage.setItem('hoot_refresh_token', refreshToken);
    }
    // 同步写入 cookie，供 Next.js Middleware 路由守卫使用
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
