'use client'

import { useState } from 'react'
import {
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  Wallet,
  Gift,
  Zap,
  Check,
  Loader2
} from 'lucide-react'

interface RegisterData {
  email: string
  username: string
  password: string
  referralCode?: string
}

interface RegisterPageProps {
  onRegister?: (data: RegisterData) => void
  onWalletConnect?: () => void
  onLogin?: () => void
  defaultReferralCode?: string
}

interface FormErrors {
  email?: string
  username?: string
  password?: string
  confirmPassword?: string
  terms?: string
}

export function RegisterPage({
  onRegister,
  onWalletConnect,
  onLogin,
  defaultReferralCode = ''
}: RegisterPageProps) {
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

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    // Email validation
    if (!formData.email) {
      newErrors.email = '邮箱不能为空'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址'
    }

    // Username validation
    if (!formData.username) {
      newErrors.username = '用户名不能为空'
    } else if (formData.username.length < 3) {
      newErrors.username = '用户名至少需要3个字符'
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = '用户名只能包含字母、数字和下划线'
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = '密码不能为空'
    } else if (formData.password.length < 8) {
      newErrors.password = '密码至少需要8个字符'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = '密码必须包含大小写字母和数字'
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = '请确认密码'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致'
    }

    // Terms validation
    if (!formData.acceptTerms) {
      newErrors.terms = '请同意服务条款'
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
          {/* Top gradient highlight line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
          {/* Logo and Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-cyan-400/20 rounded-2xl mb-4 border border-[#2A2A3A]">
              <Zap className="w-8 h-8 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-[#F8F8FC]">
              Welcome to Hoot
            </h1>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-[#9090A0] mb-2">
                邮箱
              </label>
              <div className={`glass-border-glow relative rounded-xl overflow-hidden ${errors.email ? 'ring-1 ring-red-500' : ''}`}>
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#606070] z-10" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#1A1A24] border border-cyan-500/[0.08] rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all"
                  placeholder="your@email.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-400">{errors.email}</p>
              )}
            </div>

            {/* Username Field */}
            <div>
              <label className="block text-sm font-medium text-[#9090A0] mb-2">
                用户名
              </label>
              <div className={`glass-border-glow relative rounded-xl overflow-hidden ${errors.username ? 'ring-1 ring-red-500' : ''}`}>
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#606070] z-10" />
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#1A1A24] border border-cyan-500/[0.08] rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all"
                  placeholder="选择一个用户名"
                />
              </div>
              {errors.username && (
                <p className="mt-1 text-sm text-red-400">{errors.username}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-[#9090A0] mb-2">
                密码
              </label>
              <div className={`glass-border-glow relative rounded-xl overflow-hidden ${errors.password ? 'ring-1 ring-red-500' : ''}`}>
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#606070] z-10" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-[#1A1A24] border border-cyan-500/[0.08] rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#606070] hover:text-[#9090A0] transition-colors z-10"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-400">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-medium text-[#9090A0] mb-2">
                确认密码
              </label>
              <div className={`glass-border-glow relative rounded-xl overflow-hidden ${errors.confirmPassword ? 'ring-1 ring-red-500' : ''}`}>
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#606070] z-10" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-[#1A1A24] border border-cyan-500/[0.08] rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#606070] hover:text-[#9090A0] transition-colors z-10"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-400">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Referral Code Field */}
            <div>
              <label className="block text-sm font-medium text-[#9090A0] mb-2">
                邀请码 <span className="text-[#606070]">(可选)</span>
              </label>
              <div className="glass-border-glow relative rounded-xl overflow-hidden">
                <Gift className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#606070] z-10" />
                <input
                  type="text"
                  value={formData.referralCode}
                  onChange={(e) => handleInputChange('referralCode', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#1A1A24] border border-cyan-500/[0.08] rounded-xl text-[#F8F8FC] placeholder-[#606070] focus:outline-none focus:ring-1 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all"
                  placeholder="输入邀请码获得奖励"
                />
              </div>
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
                  我已阅读并同意
                  <button type="button" className="text-cyan-400 hover:text-cyan-300 ml-1">
                    服务条款
                  </button>
                  和
                  <button type="button" className="text-cyan-400 hover:text-cyan-300 ml-1">
                    隐私政策
                  </button>
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
                  <span>创建账户中...</span>
                </div>
              ) : (
                '创建账户'
              )}
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

            {/* Wallet Connect Button */}
            <button
              type="button"
              onClick={onWalletConnect}
              className="w-full py-3.5 px-4 rounded-xl font-semibold border border-[#2A2A3A] bg-[#0A0A0F] hover:bg-[#1E1E2E] hover:border-[#3A3A4A] text-[#F8F8FC] focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Wallet className="w-5 h-5" />
              <span>钱包注册</span>
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-[#9090A0]">
              已有账户？{' '}
              <button
                type="button"
                onClick={onLogin}
                className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
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
