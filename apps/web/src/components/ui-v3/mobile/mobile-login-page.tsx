'use client'

import React from "react"

import { useState } from 'react'
import Image from 'next/image'
import { Mail, Lock, Eye, EyeOff, Wallet, Send } from 'lucide-react'
import { useTranslations } from '@/i18n/provider'

interface MobileLoginPageProps {
  onLogin?: (email: string, password: string) => Promise<void> | void
  onWalletConnect?: () => Promise<void> | void
  onTelegramLogin?: () => void
  onRegister?: () => void
  onForgotPassword?: () => void
}

export function MobileLoginPage({
  onLogin,
  onWalletConnect,
  onTelegramLogin,
  onRegister,
  onForgotPassword,
}: MobileLoginPageProps) {
  const t = useTranslations('auth')
  const tCommon = useTranslations('common')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
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
      {/* 背景装饰 */}
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
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <div className="w-24 h-24 rounded-full overflow-hidden">
              <Image
                src="/icons/hoot/token.png"
                alt="HOOT"
                width={96}
                height={96}
                className="w-full h-full object-cover drop-shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                priority
                unoptimized
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-[#06B6D4]">HOOT</h1>
        </div>

        <div className="space-y-5">
          {/* Telegram 登录 */}
          <button
            type="button"
            onClick={onTelegramLogin}
            title={t('continueWithTelegram')}
            aria-label={t('continueWithTelegram')}
            className="w-full py-4 px-4 rounded-xl font-semibold text-white bg-[#0088cc] hover:bg-[#0099dd] active:scale-[0.98] transition-all shadow-lg shadow-[#0088cc]/25 flex items-center justify-center gap-3"
          >
            <Send className="w-6 h-6" />
            <span className="text-lg">{t('continueWithTelegram')}</span>
          </button>

          {/* 分隔线 */}
          <div className="flex items-center">
            <div className="flex-1 h-px bg-[#1E1E2E]" />
            <span className="px-4 text-sm text-[#94A3B8]">{t('or')}</span>
            <div className="flex-1 h-px bg-[#1E1E2E]" />
          </div>

          {/* 钱包 | 邮箱 备选按钮 */}
          {!showEmailForm ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleWalletConnect}
                disabled={isWalletLoading}
                title={t('walletLogin')}
                aria-label={t('walletLogin')}
                className="py-3 px-4 rounded-xl font-medium border border-cyan-500/20 bg-[#1A1A24] hover:bg-[#1E1E2E] text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Wallet className="w-5 h-5" />
                {isWalletLoading ? tCommon('loading') : t('walletLogin')}
              </button>
              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                title={t('emailLogin')}
                aria-label={t('emailLogin')}
                className="py-3 px-4 rounded-xl font-medium border border-cyan-500/20 bg-[#1A1A24] hover:bg-[#1E1E2E] text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Mail className="w-5 h-5" />
                {t('emailLogin')}
              </button>
            </div>
          ) : (
            /* 邮箱登录表单 */
            <form onSubmit={handleSubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => setShowEmailForm(false)}
                className="text-sm text-[#06B6D4] hover:text-[#0891B2] transition-colors"
              >
                ← {t('back')}
              </button>

              {/* 邮箱 */}
              <div className="glass-border-glow rounded-xl overflow-hidden">
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('emailPlaceholder')}
                    aria-label={t('email')}
                    className="w-full bg-[#1A1A24] border border-cyan-500/20 rounded-xl pl-12 pr-4 py-3.5 text-white placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              {/* 密码 */}
              <div className="glass-border-glow rounded-xl overflow-hidden">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('passwordPlaceholder')}
                    aria-label={t('password')}
                    className="w-full bg-[#1A1A24] border border-cyan-500/20 rounded-xl pl-12 pr-12 py-3.5 text-white placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* 忘记密码 */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-sm text-[#06B6D4] hover:text-[#0891B2] transition-colors"
                >
                  {t('forgotPassword')}
                </button>
              </div>

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={isLoading}
                title={t('login')}
                aria-label={t('login')}
                className="w-full bg-gradient-to-r from-[#06B6D4] to-[#0891B2] text-[#0A0A0F] font-semibold py-3.5 rounded-xl hover:shadow-lg hover:shadow-[#06B6D4]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? t('loggingIn') : t('login')}
              </button>
            </form>
          )}
        </div>

        {/* 底部注册链接 */}
        <div className="mt-6 text-center text-sm">
          <span className="text-[#94A3B8]">{t('noAccount')}</span>
          <button
            type="button"
            onClick={onRegister}
            title={t('registerNow')}
            aria-label={t('registerNow')}
            className="ml-1 text-[#06B6D4] hover:text-[#0891B2] font-semibold transition-colors"
          >
            {t('registerNow')}
          </button>
        </div>
      </div>
    </div>
  )
}
