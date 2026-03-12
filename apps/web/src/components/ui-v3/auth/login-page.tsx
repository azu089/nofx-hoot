'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Eye, EyeOff, Mail, Lock, Wallet, Send } from 'lucide-react'
import { useTranslations } from '@/i18n/provider'

interface LoginPageProps {
  onLogin?: (email: string, password: string, rememberMe?: boolean) => void
  onWalletConnect?: () => void
  onTelegramLogin?: () => void
  onRegister?: () => void
  onForgotPassword?: () => void
  initialShowEmailForm?: boolean  // 初始是否显示邮箱表单
}

const REMEMBERED_EMAIL_KEY = 'hoot_remembered_email'

export function LoginPage({
  onLogin,
  onWalletConnect,
  onTelegramLogin,
  onRegister,
  onForgotPassword,
  initialShowEmailForm = false,
}: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(initialShowEmailForm)
  const t = useTranslations('auth')

  // 从 localStorage 恢复记住的邮箱
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBERED_EMAIL_KEY)
    if (saved) {
      setEmail(saved)
      setRememberMe(true)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      // 记住邮箱
      if (rememberMe) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email)
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY)
      }
      await onLogin?.(email, password, rememberMe)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0A0A0F]">
      {/* Background glow effects - 与首页同步 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse" />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[200px] opacity-5" />
      </div>

      {/* Glass morphism card */}
      <div className="relative w-full max-w-md">
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
          {/* Logo and app name */}
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <div className="w-24 h-24 rounded-full overflow-hidden drop-shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                <Image
                  src="/icons/hoot/token.png"
                  alt="HOOT"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover rounded-full"
                  priority
                  unoptimized
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-[#06B6D4]">{t('welcomeBack')}</h1>
          </div>

          <div className="space-y-5">
            {/* Telegram Login - 主推按钮 */}
            <button
              type="button"
              onClick={onTelegramLogin}
              className="w-full py-4 px-4 rounded-xl font-semibold text-white bg-[#0088cc] hover:bg-[#0099dd] focus:outline-none focus:ring-2 focus:ring-[#0088cc]/50 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-[#0088cc]/25 flex items-center justify-center gap-3"
            >
              <Send className="w-6 h-6" />
              <span className="text-lg">{t('continueWithTelegram')}</span>
            </button>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#2A2A3A]" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-[#12121A] text-sm text-[#606070]">
                  {t('or')}
                </span>
              </div>
            </div>

            {/* Secondary options - 钱包 | 邮箱 */}
            {!showEmailForm ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={onWalletConnect}
                  className="py-3 px-4 rounded-xl font-medium border border-cyan-500/20 bg-[#1A1A24] hover:bg-[#1E1E2E] text-[#F8F8FC] focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Wallet className="w-5 h-5" />
                  <span>{t('walletLogin')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailForm(true)}
                  className="py-3 px-4 rounded-xl font-medium border border-cyan-500/20 bg-[#1A1A24] hover:bg-[#1E1E2E] text-[#F8F8FC] focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Mail className="w-5 h-5" />
                  <span>{t('emailLogin')}</span>
                </button>
              </div>
            ) : (
              /* Email login form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Back button */}
                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors mb-2"
                >
                  ← {t('back')}
                </button>

                {/* Email input */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-[#9090A0]">
                    {t('email')}
                  </label>
                  <div className="glass-border-glow rounded-xl overflow-hidden">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-[#606070]" />
                      </div>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all duration-200"
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Password input */}
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-[#9090A0]">
                    {t('password')}
                  </label>
                  <div className="glass-border-glow rounded-xl overflow-hidden">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-[#606070]" />
                      </div>
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-12 py-3 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all duration-200"
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
                </div>

                {/* Remember me + Forgot password */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-cyan-500/30 bg-[#1A1A24] text-cyan-500 focus:ring-cyan-500/30 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-sm text-[#9090A0]">{t('rememberPassword')}</span>
                  </label>
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    {t('forgotPassword')}
                  </button>
                </div>

                {/* Login button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-xl font-semibold text-black bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? t('loggingIn') : t('login')}
                </button>
              </form>
            )}
          </div>

          {/* Register link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-[#9090A0]">
              {t('noAccount')}{' '}
              <button
                type="button"
                onClick={onRegister}
                className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {t('registerNow')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
