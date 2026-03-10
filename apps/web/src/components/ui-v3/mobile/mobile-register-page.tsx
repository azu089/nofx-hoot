'use client'

import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import { Mail, User, Lock, Eye, EyeOff, Gift, Loader2, Wallet, Check } from 'lucide-react'
import { useTranslations } from '@/i18n/provider'

interface MobileRegisterPageProps {
  onRegister?: (data: RegisterData) => void | Promise<void>
  onWalletConnect?: () => void | Promise<void>
  onTelegramLogin?: () => void | Promise<void>
  onLogin?: () => void
  defaultReferralCode?: string
}

interface RegisterData {
  email: string
  username: string
  password: string
  confirmPassword: string
  referralCode?: string
  agreedToTerms: boolean
}

interface FormErrors {
  email?: string
  username?: string
  password?: string
  confirmPassword?: string
  referralCode?: string
  terms?: string
}

export function MobileRegisterPage({
  onRegister,
  onWalletConnect,
  onTelegramLogin,
  onLogin,
  defaultReferralCode = ''
}: MobileRegisterPageProps) {
  const t = useTranslations('auth')
  const tErrors = useTranslations('errors')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [referralCode, setReferralCode] = useState(defaultReferralCode)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})

  const validateEmail = (v: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
  }

  const validateUsername = (v: string): boolean => {
    return /^[a-zA-Z0-9_]{3,}$/.test(v)
  }

  const validatePassword = (v: string): boolean => {
    return v.length >= 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /[0-9]/.test(v)
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!email) {
      newErrors.email = tErrors('emailRequired')
    } else if (!validateEmail(email)) {
      newErrors.email = tErrors('invalidEmail')
    }

    if (!username) {
      newErrors.username = tErrors('usernameRequired')
    } else if (!validateUsername(username)) {
      newErrors.username = tErrors('usernameInvalid')
    }

    if (!password) {
      newErrors.password = tErrors('passwordRequired')
    } else if (!validatePassword(password)) {
      newErrors.password = tErrors('passwordTooWeak')
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = tErrors('passwordRequired')
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = tErrors('passwordMismatch')
    }

    // 邀请码选填，不做强制校验

    if (!agreedToTerms) {
      newErrors.terms = tErrors('termsRequired')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsLoading(true)
    try {
      await onRegister?.({
        email,
        username,
        password,
        confirmPassword,
        referralCode: referralCode || undefined,
        agreedToTerms
      })
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Registration error:', error)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleWalletConnect = async () => {
    setIsLoading(true)
    try {
      await onWalletConnect?.()
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Wallet connection error:', error)
      }
    } finally {
      setIsLoading(false)
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

      {/* 注册卡片 */}
      <div className="relative w-full max-w-md z-10">
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <div className="w-24 h-24">
                <Image
                  src="/icons/hoot/token.png"
                  alt="HOOT"
                  width={96}
                  height={96}
                  className="w-full h-full rounded-full object-cover drop-shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                  priority
                  unoptimized
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-[#06B6D4] mb-2">{t('joinHoot')}</h1>
          </div>

          {/* 表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 邮箱 */}
            <div>
              <div className="glass-border-glow rounded-xl overflow-hidden">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })) }}
                    placeholder={t('emailPlaceholder')}
                    className="w-full h-12 pl-11 pr-4 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-white placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent transition-all"
                    aria-label={t('email')}
                    disabled={isLoading}
                  />
                </div>
              </div>
              {errors.email && <p className="mt-1.5 text-sm text-[#EF4444] pl-1">{errors.email}</p>}
            </div>

            {/* 用户名 */}
            <div>
              <div className="glass-border-glow rounded-xl overflow-hidden">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setErrors((p) => ({ ...p, username: undefined })) }}
                    placeholder={t('usernamePlaceholder')}
                    className="w-full h-12 pl-11 pr-4 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-white placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent transition-all"
                    aria-label={t('username')}
                    disabled={isLoading}
                  />
                </div>
              </div>
              {errors.username && <p className="mt-1.5 text-sm text-[#EF4444] pl-1">{errors.username}</p>}
            </div>

            {/* 密码 */}
            <div>
              <div className="glass-border-glow rounded-xl overflow-hidden">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })) }}
                    placeholder={t('passwordPlaceholder')}
                    className="w-full h-12 pl-11 pr-12 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-white placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent transition-all"
                    aria-label={t('password')}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              {errors.password && <p className="mt-1.5 text-sm text-[#EF4444] pl-1">{errors.password}</p>}
            </div>

            {/* 确认密码 */}
            <div>
              <div className="glass-border-glow rounded-xl overflow-hidden">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: undefined })) }}
                    placeholder={t('confirmPassword')}
                    className="w-full h-12 pl-11 pr-12 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-white placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent transition-all"
                    aria-label={t('confirmPassword')}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] transition-colors"
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              {errors.confirmPassword && <p className="mt-1.5 text-sm text-[#EF4444] pl-1">{errors.confirmPassword}</p>}
            </div>

            {/* 邀请码 */}
            <div>
              <div className={`glass-border-glow rounded-xl overflow-hidden ${errors.referralCode ? 'ring-1 ring-red-500' : ''}`}>
                <div className="relative">
                  <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => { setReferralCode(e.target.value); setErrors((p) => ({ ...p, referralCode: undefined })) }}
                    placeholder={t('inviteCodePlaceholder')}
                    className="w-full h-12 pl-11 pr-4 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-white placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent transition-all"
                    aria-label={t('inviteCode')}
                    disabled={isLoading}
                  />
                </div>
              </div>
              {errors.referralCode && <p className="mt-1.5 text-sm text-[#EF4444] pl-1">{errors.referralCode}</p>}
            </div>

            {/* 服务条款 */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => { setAgreedToTerms(e.target.checked); setErrors((p) => ({ ...p, terms: undefined })) }}
                    className="sr-only"
                    disabled={isLoading}
                  />
                  <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${
                    agreedToTerms
                      ? 'bg-[#06B6D4] border-[#06B6D4]'
                      : errors.terms
                        ? 'border-[#EF4444] bg-transparent'
                        : 'border-[#2A2A3A] bg-transparent group-hover:border-[#06B6D4]/50'
                  }`}>
                    {agreedToTerms && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <span className="text-sm text-[#94A3B8] leading-relaxed">
                  {t('agreeTerms')}{' '}
                  <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="text-[#06B6D4] hover:text-[#0891B2] transition-colors underline" onClick={(e) => e.stopPropagation()}>
                    {t('termsOfService')}
                  </a>{' '}
                  {t('and')}{' '}
                  <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-[#06B6D4] hover:text-[#0891B2] transition-colors underline" onClick={(e) => e.stopPropagation()}>
                    {t('privacyPolicy')}
                  </a>
                </span>
              </label>
              {errors.terms && <p className="mt-1.5 text-sm text-[#EF4444] pl-1">{errors.terms}</p>}
            </div>

            {/* 创建账户按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-gradient-to-r from-[#06B6D4] to-[#0891B2] hover:from-[#0891B2] hover:to-[#0E7490] text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t('registering')}</span>
                </>
              ) : (
                t('createAccount')
              )}
            </button>
          </form>

          {/* 分隔线 */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1E1E2E]" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#0A0A0F]/60 px-4 text-xs text-[#64748B] tracking-widest">{t('or')}</span>
            </div>
          </div>

          {/* Telegram */}
          <button
            type="button"
            onClick={() => onTelegramLogin?.()}
            disabled={isLoading}
            className="w-full h-12 bg-[#0088cc] hover:bg-[#0077bb] active:bg-[#006699] text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,136,204,0.25)]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.26 14.4l-2.94-.917c-.638-.203-.65-.638.136-.944l11.49-4.43c.53-.194.994.131.948.112z"/>
            </svg>
            <span>{t('continueWithTelegram')}</span>
          </button>

          {/* 钱包注册 */}
          <button
            type="button"
            onClick={handleWalletConnect}
            disabled={isLoading}
            className="mt-3 w-full h-12 bg-[#1A1A24] hover:bg-[#1E1E2E] border border-cyan-500/20 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Wallet className="w-5 h-5" />
            <span>{t('walletRegister')}</span>
          </button>

          {/* 底部登录链接 */}
          <div className="mt-5 text-center">
            <p className="text-sm text-[#94A3B8]">
              {t('hasAccount')}{' '}
              <button
                type="button"
                onClick={onLogin}
                className="text-[#06B6D4] hover:text-[#0891B2] font-medium transition-colors"
              >
                {t('loginNow')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
