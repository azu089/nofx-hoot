'use client'

import { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, Wallet, Zap } from 'lucide-react'

interface LoginPageProps {
  onLogin?: (email: string, password: string) => void
  onWalletConnect?: () => void
  onRegister?: () => void
  onForgotPassword?: () => void
}

export function LoginPage({
  onLogin,
  onWalletConnect,
  onRegister,
  onForgotPassword,
}: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await onLogin?.(email, password)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0A0A0F]">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-20 blur-3xl bg-[#06B6D4]" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-15 blur-3xl bg-[#06B6D4]" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl bg-[#06B6D4]" />
      </div>

      {/* Glass morphism card */}
      <div className="relative w-full max-w-md">
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-8 shadow-[0_0_50px_rgba(6,182,212,0.1)]">
          {/* Logo and app name */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-lg shadow-cyan-500/25">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#F8F8FC]">Hoot</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email input */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-[#9090A0]"
              >
                邮箱
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-[#606070]" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#0A0A0F] border border-[#2A2A3A] rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all duration-200"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            {/* Password input */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-[#9090A0]"
              >
                密码
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-[#606070]" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-[#0A0A0F] border border-[#2A2A3A] rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all duration-200"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-[#606070] hover:text-[#9090A0] transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-[#606070] hover:text-[#9090A0] transition-colors" />
                  )}
                </button>
              </div>
            </div>

            {/* Forgot password link */}
            <div className="text-right">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                忘记密码？
              </button>
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl font-semibold text-black bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '登录中...' : '登录'}
            </button>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#2A2A3A]" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-[#12121A] text-sm text-[#606070]">
                  或
                </span>
              </div>
            </div>

            {/* Wallet connect button */}
            <button
              type="button"
              onClick={onWalletConnect}
              className="w-full py-3.5 px-4 rounded-xl font-semibold border border-[#2A2A3A] bg-[#0A0A0F] hover:bg-[#1E1E2E] hover:border-[#3A3A4A] text-[#F8F8FC] focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Wallet className="w-5 h-5" />
              <span>钱包登录</span>
            </button>
          </form>

          {/* Register link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-[#9090A0]">
              还没有账户？{' '}
              <button
                type="button"
                onClick={onRegister}
                className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                立即注册
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
