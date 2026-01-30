'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { api } from './api';

interface User {
  id: string;
  email: string;
  nickname: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'hoot_token';
const USER_KEY = 'hoot_user';

// 从 localStorage 获取初始值的辅助函数
function getInitialToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function getInitialUser(): User | null {
  if (typeof window === 'undefined') return null;
  const storedUser = localStorage.getItem(USER_KEY);
  if (storedUser) {
    try {
      return JSON.parse(storedUser);
    } catch {
      return null;
    }
  }
  return null;
}

// 初始化函数 - 设置 api token 并返回 loading 状态
function initializeAuth(): boolean {
  if (typeof window === 'undefined') return true;
  const storedToken = localStorage.getItem(TOKEN_KEY);
  if (storedToken) {
    api.setToken(storedToken);
  }
  return false; // 初始化完成，不再 loading
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getInitialUser);
  const [token, setToken] = useState<string | null>(getInitialToken);
  const [isLoading] = useState(initializeAuth);

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
    // 注册成功后自动登录
    await login(email, password);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    api.clearToken();

    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
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
