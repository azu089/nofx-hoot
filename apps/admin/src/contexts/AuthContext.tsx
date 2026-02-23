/**
 * 认证上下文
 * 管理管理员登录状态
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { API_URL } from '../lib/config';

interface AdminUser {
  username: string;
  nickname?: string;
  role: string;
  loginTime: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AdminUser | null;
  token: string | null;
  login: (token: string, user: AdminUser) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 初始化时检查登录状态
  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('admin_token');
      const userStr = localStorage.getItem('admin_user');

      if (savedToken && userStr) {
        try {
          // 验证 token 是否有效
          const response = await fetch(`${API_URL}/admin/auth/me`, {
            headers: {
              Authorization: `Bearer ${savedToken}`,
            },
          });

          if (response.ok) {
            const userData = JSON.parse(userStr);
            setUser(userData);
            setToken(savedToken);
            setIsAuthenticated(true);
          } else {
            // Token 无效，清除
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');
          }
        } catch {
          // 网络错误时，清除缓存，要求重新登录（安全优先）
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
        }
      }

      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = (newToken: string, userData: AdminUser) => {
    localStorage.setItem('admin_token', newToken);
    localStorage.setItem('admin_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
