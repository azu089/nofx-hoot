'use client'

import React from "react"

import { useState } from 'react'
import { Mail, Lock, Eye, EyeOff, Wallet, Zap } from 'lucide-react'

interface MobileLoginPageProps {
  onLogin?: (email: string, password: string) => Promise<void> | void
  onWalletConnect?: () => Promise<void> | void
  onRegister?: () => void
  onForgotPassword?: () => void
}

export function MobileLoginPage({
  onLogin,
  onWalletConnect,
  onRegister,
  onForgotPassword,
}: MobileLoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isWalletLoading, setIsWalletLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!onLogin || isLoading) return

    setIsLoading(true)
    try {
      await onLogin(email, password)
    } finally {
      setIsLoading(false)
    }
  }

  const handleWalletConnect = async () => {
    if (!onWalletConnect || isWalletLoading) return

    setIsWalletLoading(true)
    try {
      await onWalletConnect()
    } finally {
      setIsWalletLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#0A0A0F] flex items-center justify-center p-4 relative overflow-hidden">
      {/* 背景装饰 - 与首页同步的动态光晕效果 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[100px] opacity-20 animate-pulse" />
        <div
          className="absolute -bottom-32 -left-32 w-80 h-80 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[100px] opacity-20 animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[150px] opacity-5" />
      </div>

      {/* 毛玻璃登录卡片 */}
      <div className="w-full max-w-md glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden z-10">
        {/* 顶部渐变高光线 */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
        {/* Logo区域 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#06B6D4] to-[#0891B2] flex items-center justify-center mb-4 shadow-lg shadow-[#06B6D4]/20">
            <Zap className="w-8 h-8 text-[#0A0A0F]" />
          </div>
          <h1 className="text-3xl font-bold text-white">Hoot</h1>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 邮箱输入框 */}
          <div>
            <label htmlFor="email" className="sr-only">
              邮箱地址
            </label>
            <div className="glass-border-glow relative rounded-xl overflow-hidden">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8] z-10" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                aria-label="邮箱地址"
                className="w-full bg-[#1A1A24] border border-cyan-500/[0.08] rounded-xl pl-12 pr-4 py-3.5 text-white placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          {/* 密码输入框 */}
          <div>
            <label htmlFor="password" className="sr-only">
              密码
            </label>
            <div className="glass-border-glow relative rounded-xl overflow-hidden">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8] z-10" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                aria-label="密码"
                className="w-full bg-[#1A1A24] border border-cyan-500/[0.08] rounded-xl pl-12 pr-12 py-3.5 text-white placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? '隐藏密码' : '显示密码'}
                aria-label={showPassword ? '隐藏密码' : '显示密码'}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#94A3B8] transition-colors z-10"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* 忘记密码链接 */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onForgotPassword}
              title="忘记密码"
              aria-label="忘记密码"
              className="text-sm text-[#06B6D4] hover:text-[#0891B2] transition-colors"
            >
              忘记密码？
            </button>
          </div>

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={isLoading}
            title="登录"
            aria-label="登录"
            className="w-full bg-gradient-to-r from-[#06B6D4] to-[#0891B2] text-[#0A0A0F] font-semibold py-3.5 rounded-xl hover:shadow-lg hover:shadow-[#06B6D4]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>

        {/* 分隔线 */}
        <div className="flex items-center my-6">
          <div className="flex-1 h-px bg-[#1E1E2E]" />
          <span className="px-4 text-sm text-[#94A3B8]">或</span>
          <div className="flex-1 h-px bg-[#1E1E2E]" />
        </div>

        {/* 钱包登录按钮 */}
        <button
          type="button"
          onClick={handleWalletConnect}
          disabled={isWalletLoading}
          title="钱包登录"
          aria-label="钱包登录"
          className="w-full border-2 border-[#1E1E2E] text-white font-semibold py-3.5 rounded-xl hover:border-[#06B6D4] hover:bg-[#06B6D4]/5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Wallet className="w-5 h-5" />
          {isWalletLoading ? '连接中...' : '钱包登录'}
        </button>

        {/* 底部注册链接 */}
        <div className="mt-6 text-center text-sm">
          <span className="text-[#94A3B8]">还没有账户？</span>
          <button
            type="button"
            onClick={onRegister}
            title="立即注册"
            aria-label="立即注册"
            className="ml-1 text-[#06B6D4] hover:text-[#0891B2] font-semibold transition-colors"
          >
            立即注册
          </button>
        </div>
      </div>
    </div>
  )
}
