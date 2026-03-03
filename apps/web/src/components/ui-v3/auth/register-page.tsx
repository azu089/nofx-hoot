'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  Wallet,
  Gift,
  Check,
  Loader2,
  Send
} from 'lucide-react'
import { useTranslations } from '@/i18n/provider'

interface RegisterData {
  email: string
  username: string
  password: string
  referralCode?: string
}

interface RegisterPageProps {
  onRegister?: (data: RegisterData) => void
  onWalletConnect?: () => void
  onTelegramLogin?: () => void
  onLogin?: () => void
  defaultReferralCode?: string
}

interface FormErrors {
  email?: string
  username?: string
  password?: string
  confirmPassword?: string
  referralCode?: string
  terms?: string
}

export function RegisterPage({
  onRegister,
  onWalletConnect,
  onTelegramLogin,
  onLogin,
  defaultReferralCode = ''
}: RegisterPageProps) {
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    referralCode: defaultReferralCode,
    acceptTerms: false
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const t = useTranslations('auth')
  const tErrors = useTranslations('errors')

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // Email validation
    if (!formData.email) {
      newErrors.email = tErrors('emailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = tErrors('invalidEmail')
    }

    // Username validation
    if (!formData.username) {
      newErrors.username = tErrors('usernameRequired')
    } else if (formData.username.length < 3) {
      newErrors.username = tErrors('usernameTooShort')
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = tErrors('usernameInvalid')
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = tErrors('passwordRequired')
    } else if (formData.password.length < 8) {
      newErrors.password = tErrors('invalidPassword')
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = tErrors('passwordTooWeak')
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('confirmPassword')
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = tErrors('passwordMismatch')
    }

    // Referral code validation（选填，填写时不做额外格式校验）

    // Terms validation
    if (!formData.acceptTerms) {
      newErrors.terms = tErrors('termsRequired')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)

    try {
      await onRegister?.({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        referralCode: formData.referralCode || undefined
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects - 与首页同步 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse" />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#06B6D4] rounded-full mix-blend-multiply filter blur-[200px] opacity-5" />
      </div>

      {/* Main Card */}
      <div className="relative w-full max-w-md">
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
          {/* Logo and Header */}
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <div className="w-24 h-24 rounded-full overflow-hidden">
                <Image
                  src="/icons/hoot/logo.png?v=2"
                  alt="HOOT"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover drop-shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                  priority
                  unoptimized
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-[#F8F8FC]">
              {t('joinHoot')}
            </h1>
          </div>

          <div className="space-y-5">
            {/* Telegram Register - 主推按钮 */}
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
                  <span>{t('walletRegister')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailForm(true)}
                  className="py-3 px-4 rounded-xl font-medium border border-cyan-500/20 bg-[#1A1A24] hover:bg-[#1E1E2E] text-[#F8F8FC] focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Mail className="w-5 h-5" />
                  <span>{t('emailRegister')}</span>
                </button>
              </div>
            ) : (
              /* Email Registration Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Back button */}
                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors mb-2"
                >
                  ← {t('back')}
                </button>

                {/* Email Field */}
                <div>
                  <label className="block text-sm font-medium text-[#9090A0] mb-2">
                    {t('email')}
                  </label>
                  <div className={`glass-border-glow rounded-xl overflow-hidden ${errors.email ? 'ring-1 ring-red-500' : ''}`}>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#606070]" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-400">{errors.email}</p>
                  )}
                </div>

                {/* Username Field */}
                <div>
                  <label className="block text-sm font-medium text-[#9090A0] mb-2">
                    {t('username')}
                  </label>
                  <div className={`glass-border-glow rounded-xl overflow-hidden ${errors.username ? 'ring-1 ring-red-500' : ''}`}>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#606070]" />
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => handleInputChange('username', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all"
                        placeholder={t('usernamePlaceholder')}
                      />
                    </div>
                  </div>
                  {errors.username && (
                    <p className="mt-1 text-sm text-red-400">{errors.username}</p>
                  )}
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-sm font-medium text-[#9090A0] mb-2">
                    {t('password')}
                  </label>
                  <div className={`glass-border-glow rounded-xl overflow-hidden ${errors.password ? 'ring-1 ring-red-500' : ''}`}>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#606070]" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        className="w-full pl-10 pr-12 py-3 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#606070] hover:text-[#9090A0] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-400">{errors.password}</p>
                  )}
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label className="block text-sm font-medium text-[#9090A0] mb-2">
                    {t('confirmPassword')}
                  </label>
                  <div className={`glass-border-glow rounded-xl overflow-hidden ${errors.confirmPassword ? 'ring-1 ring-red-500' : ''}`}>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#606070]" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        className="w-full pl-10 pr-12 py-3 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#606070] hover:text-[#9090A0] transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-400">{errors.confirmPassword}</p>
                  )}
                </div>

                {/* Referral Code Field（必填） */}
                <div>
                  <div className={`glass-border-glow rounded-xl overflow-hidden ${errors.referralCode ? 'ring-1 ring-red-500' : ''}`}>
                    <div className="relative">
                      <Gift className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#606070]" />
                      <input
                        type="text"
                        value={formData.referralCode}
                        onChange={(e) => handleInputChange('referralCode', e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all"
                        placeholder={t('inviteCodePlaceholder')}
                      />
                    </div>
                  </div>
                  {errors.referralCode && (
                    <p className="mt-1 text-sm text-red-400">{errors.referralCode}</p>
                  )}
                </div>

                {/* Terms Checkbox */}
                <div>
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={formData.acceptTerms}
                        onChange={(e) => handleInputChange('acceptTerms', e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${
                        formData.acceptTerms
                          ? 'bg-cyan-500 border-cyan-500'
                          : errors.terms
                            ? 'border-red-500'
                            : 'border-[#2A2A3A]'
                      }`}>
                        {formData.acceptTerms && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-[#9090A0] leading-5">
                      {t('agreeTerms')}
                      <a
                        href="/legal/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 ml-1 underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t('termsOfService')}
                      </a>
                      {t('and')}
                      <a
                        href="/legal/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 ml-1 underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t('privacyPolicy')}
                      </a>
                    </span>
                  </label>
                  {errors.terms && (
                    <p className="mt-1 text-sm text-red-400">{errors.terms}</p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-xl font-semibold text-black bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>{t('registering')}</span>
                    </div>
                  ) : (
                    t('createAccount')
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Login Link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-[#9090A0]">
              {t('hasAccount')}{' '}
              <button
                type="button"
                onClick={onLogin}
                className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
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
