'use client'

import { useState, type FormEvent } from 'react'
import Image from 'next/image'
import { Mail, User, Lock, Eye, EyeOff, Gift, Loader2, Wallet } from 'lucide-react'

interface MobileRegisterPageProps {
  onRegister?: (data: RegisterData) => void | Promise<void>
  onWalletConnect?: () => void | Promise<void>
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
  terms?: string
}

export function MobileRegisterPage({
  onRegister,
  onWalletConnect,
  onLogin,
  defaultReferralCode = ''
}: MobileRegisterPageProps) {
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

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validateUsername = (username: string): boolean => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,}$/
    return usernameRegex.test(username)
  }

  const validatePassword = (password: string): boolean => {
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    return password.length >= 8 && hasUpperCase && hasLowerCase && hasNumber
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!email) {
      newErrors.email = '请输入邮箱'
    } else if (!validateEmail(email)) {
      newErrors.email = '邮箱格式不正确'
    }

    if (!username) {
      newErrors.username = '请输入用户名'
    } else if (!validateUsername(username)) {
      newErrors.username = '用户名至少3个字符，只能包含字母、数字和下划线'
    }

    if (!password) {
      newErrors.password = '请输入密码'
    } else if (!validatePassword(password)) {
      newErrors.password = '密码至少8个字符，必须包含大小写字母和数字'
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = '请确认密码'
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = '两次密码输入不一致'
    }

    if (!agreedToTerms) {
      newErrors.terms = '请阅读并同意服务条款和隐私政策'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const registerData: RegisterData = {
        email,
        username,
        password,
        confirmPassword,
        referralCode: referralCode || undefined,
        agreedToTerms
      }

      await onRegister?.(registerData)
    } catch (error) {
      console.error('Registration error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleWalletConnect = async () => {
    setIsLoading(true)
    try {
      await onWalletConnect?.()
    } catch (error) {
      console.error('Wallet connection error:', error)
    } finally {
      setIsLoading(false)
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

      {/* 注册卡片 */}
      <div className="relative w-full max-w-md z-10">
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
          {/* Logo 区域 */}
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <div className="w-24 h-24">
                <Image
                  src="/icons/hoot/logo.png?v=2"
                  alt="HOOT"
                  width={96}
                  height={96}
                  className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                  unoptimized
                />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to HOOT</h1>
            <p className="text-[#94A3B8] text-sm">创建您的交易账户</p>
          </div>

          {/* 注册表单 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 邮箱输入框 */}
            <div>
              <div className="glass-border-glow rounded-xl overflow-hidden">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setErrors((prev) => ({ ...prev, email: undefined }))
                    }}
                    placeholder="邮箱地址"
                    className="w-full h-12 pl-11 pr-4 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-white placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent transition-all"
                    aria-label="邮箱地址"
                    disabled={isLoading}
                  />
                </div>
              </div>
              {errors.email && (
                <p className="mt-1.5 text-sm text-[#EF4444] pl-1">{errors.email}</p>
              )}
            </div>

            {/* 用户名输入框 */}
            <div>
              <div className="glass-border-glow rounded-xl overflow-hidden">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      setErrors((prev) => ({ ...prev, username: undefined }))
                    }}
                    placeholder="用户名"
                    className="w-full h-12 pl-11 pr-4 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-white placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent transition-all"
                    aria-label="用户名"
                    disabled={isLoading}
                  />
                </div>
              </div>
              {errors.username && (
                <p className="mt-1.5 text-sm text-[#EF4444] pl-1">{errors.username}</p>
              )}
            </div>

            {/* 密码输入框 */}
            <div>
              <div className="glass-border-glow rounded-xl overflow-hidden">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setErrors((prev) => ({ ...prev, password: undefined }))
                    }}
                    placeholder="密码"
                    className="w-full h-12 pl-11 pr-12 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-white placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent transition-all"
                    aria-label="密码"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#94A3B8] transition-colors"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-sm text-[#EF4444] pl-1">{errors.password}</p>
              )}
            </div>

            {/* 确认密码输入框 */}
            <div>
              <div className="glass-border-glow rounded-xl overflow-hidden">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value)
                      setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
                    }}
                    placeholder="确认密码"
                    className="w-full h-12 pl-11 pr-12 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-white placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent transition-all"
                    aria-label="确认密码"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#94A3B8] transition-colors"
                    aria-label={showConfirmPassword ? '隐藏确认密码' : '显示确认密码'}
                    disabled={isLoading}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1.5 text-sm text-[#EF4444] pl-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* 邀请码输入框 */}
            <div>
              <div className="glass-border-glow rounded-xl overflow-hidden">
                <div className="relative">
                  <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    placeholder="邀请码（可选）"
                    className="w-full h-12 pl-11 pr-4 bg-[#1A1A24] border border-cyan-500/20 rounded-xl text-white placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent transition-all"
                    aria-label="邀请码"
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            {/* 服务条款复选框 */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center mt-0.5">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => {
                      setAgreedToTerms(e.target.checked)
                      setErrors((prev) => ({ ...prev, terms: undefined }))
                    }}
                    className="w-5 h-5 rounded border-2 border-[#1E1E2E] bg-[#1A1A24] checked:bg-[#06B6D4] checked:border-[#06B6D4] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] focus:ring-offset-2 focus:ring-offset-[#12121A] transition-all cursor-pointer"
                    aria-label="同意服务条款"
                    disabled={isLoading}
                  />
                </div>
                <span className="text-sm text-[#94A3B8] leading-relaxed">
                  我已阅读并同意{' '}
                  <button
                    type="button"
                    className="text-[#06B6D4] hover:text-[#0891B2] transition-colors underline"
                    onClick={(e) => {
                      e.preventDefault()
                      // 打开服务条款
                    }}
                  >
                    服务条款
                  </button>{' '}
                  和{' '}
                  <button
                    type="button"
                    className="text-[#06B6D4] hover:text-[#0891B2] transition-colors underline"
                    onClick={(e) => {
                      e.preventDefault()
                      // 打开隐私政策
                    }}
                  >
                    隐私政策
                  </button>
                </span>
              </label>
              {errors.terms && (
                <p className="mt-1.5 text-sm text-[#EF4444] pl-1">{errors.terms}</p>
              )}
            </div>

            {/* 创建账户按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-gradient-to-r from-[#06B6D4] to-[#0891B2] hover:from-[#0891B2] hover:to-[#0E7490] text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              aria-label="创建账户"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>创建中...</span>
                </>
              ) : (
                '创建账户'
              )}
            </button>
          </form>

          {/* 分隔线 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1E1E2E]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#12121A] px-3 text-[#94A3B8]">或</span>
            </div>
          </div>

          {/* 钱包注册按钮 */}
          <div className="glass-border-glow rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={handleWalletConnect}
              disabled={isLoading}
              className="w-full h-12 bg-[#1A1A24] hover:bg-[#1E1E2E] border border-cyan-500/20 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              aria-label="使用钱包注册"
            >
              <Wallet className="w-5 h-5" />
              <span>使用钱包注册</span>
            </button>
          </div>

          {/* 底部登录链接 */}
          <div className="mt-6 text-center">
            <p className="text-sm text-[#94A3B8]">
              已有账户？{' '}
              <button
                type="button"
                onClick={onLogin}
                className="text-[#06B6D4] hover:text-[#0891B2] font-medium transition-colors"
              >
                立即登录
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
