// 已弃用登录/注册 — 此 Context 仅作为兼容 stub，自动返回已登录的 admin 用户。
// 真实身份由后端 cookie / token / 单租户部署模式管理。
import React, { createContext, useContext } from 'react'

interface User {
  id: string
  email: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (...args: any[]) => Promise<{ success: boolean; message?: string }>
  loginAdmin: (...args: any[]) => Promise<{ success: boolean; message?: string }>
  register: (...args: any[]) => Promise<{ success: boolean; message?: string }>
  resetPassword: (...args: any[]) => Promise<{ success: boolean; message?: string }>
  logout: () => void
  isLoading: boolean
}

const STUB_USER: User = { id: 'admin', email: 'admin@hoot.local' }
const STUB_TOKEN = 'stub-auto-login'

const value: AuthContextType = {
  user: STUB_USER,
  token: STUB_TOKEN,
  login: async () => ({ success: true }),
  loginAdmin: async () => ({ success: true }),
  register: async () => ({ success: false, message: 'registration disabled' }),
  resetPassword: async () => ({ success: false, message: 'password reset disabled' }),
  logout: () => {},
  isLoading: false,
}

const AuthContext = createContext<AuthContextType>(value)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
