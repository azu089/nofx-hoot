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
  logout: () => void;
  sendVerificationCode: (email: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'hoot_token';
const USER_KEY = 'hoot_user';

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
      user: User;
    }>('/auth/login', { email, password });

    const { accessToken, user: userData } = response.data;

    setToken(accessToken);
    setUser(userData);
    api.setToken(accessToken);

    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  };

  const register = async (email: string, password: string, nickname?: string) => {
    await api.post('/auth/register', { email, password, nickname });
    // 注册后不自动登录，需要先验证邮箱
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    api.clearToken();

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  const sendVerificationCode = async (email: string) => {
    await api.post('/auth/send-verification', { email });
  };

  const verifyEmail = async (email: string, code: string) => {
    await api.post('/auth/verify-email', { email, code });
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
