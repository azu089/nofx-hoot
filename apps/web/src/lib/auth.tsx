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
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname?: string) => Promise<void>;
  logout: () => Promise<void> | void;
  sendVerificationCode: (email: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  /** 钱包登录：接收已验证的 accessToken 和用户信息，写入认证状态 */
  walletLogin: (accessToken: string, user: User, refreshToken?: string) => void;
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

  // 在客户端挂载后从 localStorage 读取认证状态
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

    // 标记加载完成
    setIsLoading(false);
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

  const register = async (email: string, password: string, nickname?: string) => {
    await api.post('/auth/register', { email, password, nickname });
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
    await api.post('/auth/verify-email', { email, code });
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
        login,
        register,
        logout,
        sendVerificationCode,
        verifyEmail,
        walletLogin,
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
