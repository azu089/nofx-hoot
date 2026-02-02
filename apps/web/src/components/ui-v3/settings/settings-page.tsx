'use client'

import { useState } from 'react'
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Bell,
  Globe,
  Moon,
  Sun,
  Monitor,
  Lock,
  Eye,
  EyeOff,
  X,
  Check,
  Link2,
  Send,
  Wallet,
  Mail,
  Gift,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { useLocale, useTranslations } from '@/i18n/provider'
import { localeNames, type Locale } from '@/i18n/config'
import { useTheme } from '@/lib/theme'

// 绑定奖励配置（与后端 airdrop.dto.ts 保持一致）
const BIND_REWARDS = {
  telegram: 10,  // 绑定 TG +10 HOOT
  wallet: 10,    // 绑定钱包 +10 HOOT
  email: 15,     // 绑定邮箱 +15 HOOT
}

interface BindingStatus {
  telegram?: {
    bound: boolean
    username?: string
    rewardClaimed?: boolean
  }
  wallet?: {
    bound: boolean
    address?: string
    rewardClaimed?: boolean
  }
  email?: {
    bound: boolean
    address?: string
    verified?: boolean
    rewardClaimed?: boolean
  }
}

interface SettingsPageProps {
  onNavigate?: (path: string) => void
  userEmail?: string
  initialSettings?: {
    language: string
    theme: 'light' | 'dark' | 'system'
    pushNotifications: boolean
    emailNotifications: boolean
    tradingAlerts: boolean
  }
  bindingStatus?: BindingStatus
  onSettingChange?: (key: string, value: boolean | string) => void
  onChangePassword?: (oldPassword: string, newPassword: string) => void
  onChangeEmail?: (newEmail: string, password: string) => void
  onBindTelegram?: () => void
  onBindWallet?: () => void
  onBindEmail?: (email: string) => void
}

export function SettingsPage({
  onNavigate,
  userEmail = 'user@example.com',
  initialSettings = {
    language: '简体中文',
    theme: 'dark',
    pushNotifications: true,
    emailNotifications: true,
    tradingAlerts: true
  },
  bindingStatus = {
    telegram: { bound: false },
    wallet: { bound: false },
    email: { bound: true, address: 'user@example.com', verified: true, rewardClaimed: true }
  },
  onSettingChange,
  onChangePassword,
  onChangeEmail,
  onBindTelegram,
  onBindWallet,
  onBindEmail
}: SettingsPageProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)
  const { locale, setLocale, locales } = useLocale()
  const { theme, setTheme } = useTheme()
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const ta = useTranslations('auth')

  // 弹窗状态
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showBindEmailModal, setShowBindEmailModal] = useState(false)
  const [bindEmailForm, setBindEmailForm] = useState({ email: '', verifyCode: '' })
  const [bindEmailCountdown, setBindEmailCountdown] = useState(0)

  // 表单状态
  const [passwordForm, setPasswordForm] = useState({ old: '', new: '', confirm: '', verifyCode: '' })
  const [emailForm, setEmailForm] = useState({ email: '', password: '', verifyCode: '' })
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showEmailPassword, setShowEmailPassword] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [emailCountdown, setEmailCountdown] = useState(0)

  // 从 i18n 配置获取语言列表
  const languages = locales.map(code => ({
    code,
    name: localeNames[code].name,
    flag: localeNames[code].flag
  }))
  const themes = [
    { value: 'dark', labelKey: 'themeDark', icon: Moon },
    { value: 'light', labelKey: 'themeLight', icon: Sun },
    { value: 'system', labelKey: 'themeSystem', icon: Monitor }
  ] as const

  const handleToggle = (key: keyof typeof settings) => {
    const newValue = !settings[key]
    setSettings(prev => ({ ...prev, [key]: newValue }))
    onSettingChange?.(key, newValue)
  }

  const handleLanguageChange = (langCode: Locale) => {
    setLocale(langCode) // 这会触发页面刷新
    setShowLanguageDropdown(false)
    onSettingChange?.('language', langCode)
  }

  const getCurrentLanguageFlag = () => {
    return localeNames[locale]?.flag || '🌐'
  }

  const getCurrentLanguageName = () => {
    return localeNames[locale]?.name || locale
  }

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme) // 使用全局主题切换
    onSettingChange?.('theme', newTheme)
  }

  // 发送密码修改验证码
  const handleSendPasswordCode = () => {
    if (countdown > 0) return
    setCodeSent(true)
    setCountdown(60)
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    // 实际调用发送验证码 API
    console.log('发送密码修改验证码到:', userEmail)
  }

  // 发送邮箱更换验证码
  const handleSendEmailCode = () => {
    if (emailCountdown > 0) return
    setEmailCodeSent(true)
    setEmailCountdown(60)
    const timer = setInterval(() => {
      setEmailCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    // 实际调用发送验证码 API
    console.log('发送邮箱更换验证码到:', emailForm.email)
  }

  const handlePasswordSubmit = () => {
    if (passwordForm.new !== passwordForm.confirm) {
      alert('两次输入的密码不一致')
      return
    }
    if (!passwordForm.verifyCode) {
      alert('请输入邮箱验证码')
      return
    }
    onChangePassword?.(passwordForm.old, passwordForm.new)
    setShowPasswordModal(false)
    setPasswordForm({ old: '', new: '', confirm: '', verifyCode: '' })
    setCodeSent(false)
    setCountdown(0)
  }

  const handleEmailSubmit = () => {
    if (!emailForm.verifyCode) {
      alert('请输入邮箱验证码')
      return
    }
    onChangeEmail?.(emailForm.email, emailForm.password)
    setShowEmailModal(false)
    setEmailForm({ email: '', password: '', verifyCode: '' })
    setEmailCodeSent(false)
    setEmailCountdown(0)
  }

  // 发送绑定邮箱验证码
  const handleSendBindEmailCode = () => {
    if (bindEmailCountdown > 0 || !bindEmailForm.email) return
    setBindEmailCountdown(60)
    const timer = setInterval(() => {
      setBindEmailCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    console.log('发送绑定邮箱验证码到:', bindEmailForm.email)
  }

  const handleBindEmailSubmit = () => {
    if (!bindEmailForm.verifyCode) {
      alert('请输入验证码')
      return
    }
    onBindEmail?.(bindEmailForm.email)
    setShowBindEmailModal(false)
    setBindEmailForm({ email: '', verifyCode: '' })
    setBindEmailCountdown(0)
  }

  // 格式化钱包地址
  const formatAddress = (address: string) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] p-4 md:p-6">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            aria-label={tc('back')}
            onClick={() => onNavigate?.('/profile')}
            className="p-2 -ml-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[#9090A0]" />
          </button>
          <h1 className="text-xl font-bold">{t('title')}</h1>
        </div>

        {/* 账户安全 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset]">
          <div className="px-4 py-3 border-b border-[#1E1E2E]/50 flex items-center gap-3">
            <Lock className="w-5 h-5 text-[#9090A0]" />
            <span>{t('accountSecurity')}</span>
          </div>

          {/* 修改密码 */}
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-[#1E1E2E]/50 hover:bg-[#1E1E2E]/30 transition-colors"
          >
            <span className="text-sm">{t('changePassword')}</span>
            <ChevronRight className="w-4 h-4 text-[#606070]" />
          </button>

          {/* 更换邮箱 */}
          <button
            type="button"
            onClick={() => setShowEmailModal(true)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1E1E2E]/30 transition-colors"
          >
            <div className="flex flex-col items-start">
              <span className="text-sm">{t('changeEmail')}</span>
              <span className="text-xs text-[#606070]">{userEmail}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#606070]" />
          </button>
        </div>

        {/* 账户绑定 - 赚取 HOOT */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset]">
          <div className="px-4 py-3 border-b border-[#1E1E2E]/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link2 className="w-5 h-5 text-[#9090A0]" />
              <span>{t('accountBinding')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <Gift className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span className="text-[#06B6D4]">{t('bindToEarn')}</span>
            </div>
          </div>

          {/* 绑定 Telegram */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E1E2E]/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#0088cc]/20 flex items-center justify-center">
                <Send className="w-4 h-4 text-[#0088cc]" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm">{t('telegram')}</span>
                {bindingStatus.telegram?.bound ? (
                  <span className="text-xs text-[#22C55E]">@{bindingStatus.telegram.username || 'user'}</span>
                ) : (
                  <span className="text-xs text-[#06B6D4]">+{BIND_REWARDS.telegram} HOOT</span>
                )}
              </div>
            </div>
            {bindingStatus.telegram?.bound ? (
              <div className="flex items-center gap-1.5 text-[#22C55E]">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs">{t('bound')}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onBindTelegram}
                className="px-3 py-1.5 text-xs font-medium bg-[#0088cc] hover:bg-[#0099dd] text-white rounded-lg transition-colors"
              >
                {t('bindNow')}
              </button>
            )}
          </div>

          {/* 绑定钱包 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E1E2E]/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#06B6D4]/20 flex items-center justify-center">
                <Wallet className="w-4 h-4 text-[#06B6D4]" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm">{t('wallet')}</span>
                {bindingStatus.wallet?.bound ? (
                  <span className="text-xs text-[#22C55E]">{formatAddress(bindingStatus.wallet.address || '')}</span>
                ) : (
                  <span className="text-xs text-[#06B6D4]">+{BIND_REWARDS.wallet} HOOT</span>
                )}
              </div>
            </div>
            {bindingStatus.wallet?.bound ? (
              <div className="flex items-center gap-1.5 text-[#22C55E]">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs">{t('bound')}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onBindWallet}
                className="px-3 py-1.5 text-xs font-medium bg-[#06B6D4] hover:bg-[#0891B2] text-white rounded-lg transition-colors"
              >
                {t('bindNow')}
              </button>
            )}
          </div>

          {/* 绑定邮箱 */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#8B5CF6]/20 flex items-center justify-center">
                <Mail className="w-4 h-4 text-[#8B5CF6]" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm">{ta('email')}</span>
                {bindingStatus.email?.bound ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-[#22C55E]">{bindingStatus.email.address}</span>
                    {bindingStatus.email.verified && (
                      <CheckCircle2 className="w-3 h-3 text-[#22C55E]" />
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-[#06B6D4]">+{BIND_REWARDS.email} HOOT</span>
                )}
              </div>
            </div>
            {bindingStatus.email?.bound ? (
              <div className="flex items-center gap-1.5 text-[#22C55E]">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs">{t('bound')}</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowBindEmailModal(true)}
                className="px-3 py-1.5 text-xs font-medium bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-lg transition-colors"
              >
                {t('bindNow')}
              </button>
            )}
          </div>
        </div>

        {/* 语言 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-4 z-30 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-[#9090A0]" />
              <span>{t('language')}</span>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors"
              >
                <span className="text-base">{getCurrentLanguageFlag()}</span>
                <span className="text-sm">{getCurrentLanguageName()}</span>
                <ChevronDown className={`w-4 h-4 text-[#9090A0] transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showLanguageDropdown && (
                <div className="absolute right-0 mt-2 w-40 bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg shadow-xl z-[100] overflow-hidden">
                  {languages.map(lang => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full px-3 py-2.5 text-left text-sm hover:bg-[#2A2A3A] transition-colors flex items-center gap-2 ${
                        locale === lang.code ? 'text-[#06B6D4] bg-[#06B6D4]/10' : ''
                      }`}
                    >
                      <span className="text-base">{lang.flag}</span>
                      <span className="flex-1">{lang.name}</span>
                      {locale === lang.code && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 主题 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset] overflow-hidden">
          <div className="flex items-center gap-3 mb-3">
            <Moon className="w-5 h-5 text-[#9090A0]" />
            <span>{t('theme')}</span>
          </div>
          <div className="flex gap-2">
            {themes.map(({ value, labelKey, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleThemeChange(value)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                  theme === value
                    ? 'bg-[#06B6D4] text-white'
                    : 'bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{t(labelKey as keyof typeof t)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 通知 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.02)_inset]">
          <div className="px-4 py-3 border-b border-[#1E1E2E]/50 flex items-center gap-3">
            <Bell className="w-5 h-5 text-[#9090A0]" />
            <span>{t('notifications')}</span>
          </div>

          {[
            { key: 'pushNotifications', labelKey: 'pushNotifications' },
            { key: 'emailNotifications', labelKey: 'emailNotifications' },
            { key: 'tradingAlerts', labelKey: 'tradingAlerts' }
          ].map((item, index, arr) => (
            <div
              key={item.key}
              className={`flex items-center justify-between px-4 py-3 ${
                index < arr.length - 1 ? 'border-b border-[#1E1E2E]/50' : ''
              }`}
            >
              <span className="text-sm">{t(item.labelKey as keyof typeof t)}</span>
              <button
                type="button"
                aria-label={`${t(item.labelKey as keyof typeof t)}`}
                onClick={() => handleToggle(item.key as keyof typeof settings)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings[item.key as keyof typeof settings] ? 'bg-[#06B6D4]' : 'bg-[#2A2A3A]'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  settings[item.key as keyof typeof settings] ? 'left-5' : 'left-0.5'
                }`} />
              </button>
            </div>
          ))}
        </div>

        {/* Bottom Spacer */}
        <div className="h-20 md:h-0" />
      </div>

      {/* 修改密码弹窗 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{t('changePassword')}</h3>
              <button
                type="button"
                aria-label={tc('cancel')}
                onClick={() => setShowPasswordModal(false)}
                className="p-1.5 hover:bg-[#1E1E2E] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#9090A0]" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-[#9090A0] block mb-1">{t('currentPassword')}</label>
                <div className="relative">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={passwordForm.old}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, old: e.target.value }))}
                    className="w-full px-3 py-2.5 pr-10 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                    placeholder={ta('passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070]"
                  >
                    {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-[#9090A0] block mb-1">{t('newPassword')}</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                    className="w-full px-3 py-2.5 pr-10 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                    placeholder={ta('passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070]"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-[#9090A0] block mb-1">{t('confirmNewPassword')}</label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                  placeholder={ta('passwordPlaceholder')}
                />
              </div>

              <div>
                <label className="text-sm text-[#9090A0] block mb-1">{t('emailVerificationCode')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={passwordForm.verifyCode}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, verifyCode: e.target.value }))}
                    className="flex-1 px-3 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                    placeholder={ta('enterCode')}
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={handleSendPasswordCode}
                    disabled={countdown > 0}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      countdown > 0
                        ? 'bg-[#1E1E2E] text-[#606070] cursor-not-allowed'
                        : 'bg-[#06B6D4] hover:bg-[#0891B2] text-white'
                    }`}
                  >
                    {countdown > 0 ? `${countdown}s` : ta('sendCode')}
                  </button>
                </div>
                {codeSent && countdown > 0 && (
                  <p className="text-xs text-[#606070] mt-1">{ta('codeSent')} {userEmail}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false)
                    setCodeSent(false)
                    setCountdown(0)
                  }}
                  className="flex-1 py-2.5 border border-[#2A2A3A] text-[#9090A0] rounded-lg hover:bg-[#1E1E2E] transition-colors text-sm"
                >
                  {tc('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handlePasswordSubmit}
                  className="flex-1 py-2.5 bg-[#06B6D4] hover:bg-[#0891B2] text-white rounded-lg transition-colors text-sm font-medium"
                >
                  {tc('confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 更换邮箱弹窗 */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{t('changeEmail')}</h3>
              <button
                type="button"
                aria-label={tc('cancel')}
                onClick={() => setShowEmailModal(false)}
                className="p-1.5 hover:bg-[#1E1E2E] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#9090A0]" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-[#1E1E2E]/50 border border-[#2A2A3A]">
                <p className="text-xs text-[#9090A0]">{t('currentEmail')}</p>
                <p className="text-sm mt-0.5">{userEmail}</p>
              </div>

              <div>
                <label className="text-sm text-[#9090A0] block mb-1">{t('newEmail')}</label>
                <input
                  type="email"
                  value={emailForm.email}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                  placeholder={ta('emailPlaceholder')}
                />
              </div>

              <div>
                <label className="text-sm text-[#9090A0] block mb-1">{ta('password')}</label>
                <div className="relative">
                  <input
                    type={showEmailPassword ? 'text' : 'password'}
                    value={emailForm.password}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2.5 pr-10 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                    placeholder={ta('passwordPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmailPassword(!showEmailPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#606070]"
                  >
                    {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-[#9090A0] block mb-1">{t('emailVerificationCode')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={emailForm.verifyCode}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, verifyCode: e.target.value }))}
                    className="flex-1 px-3 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                    placeholder={ta('enterCode')}
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={handleSendEmailCode}
                    disabled={emailCountdown > 0 || !emailForm.email}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      emailCountdown > 0 || !emailForm.email
                        ? 'bg-[#1E1E2E] text-[#606070] cursor-not-allowed'
                        : 'bg-[#06B6D4] hover:bg-[#0891B2] text-white'
                    }`}
                  >
                    {emailCountdown > 0 ? `${emailCountdown}s` : ta('sendCode')}
                  </button>
                </div>
                {emailCodeSent && emailCountdown > 0 && (
                  <p className="text-xs text-[#606070] mt-1">{ta('codeSent')} {emailForm.email}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailModal(false)
                    setEmailCodeSent(false)
                    setEmailCountdown(0)
                  }}
                  className="flex-1 py-2.5 border border-[#2A2A3A] text-[#9090A0] rounded-lg hover:bg-[#1E1E2E] transition-colors text-sm"
                >
                  {tc('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleEmailSubmit}
                  className="flex-1 py-2.5 bg-[#06B6D4] hover:bg-[#0891B2] text-white rounded-lg transition-colors text-sm font-medium"
                >
                  {tc('confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 绑定邮箱弹窗（未绑定邮箱时使用） */}
      {showBindEmailModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">{t('bindEmail')}</h3>
                <span className="px-2 py-0.5 text-xs bg-[#06B6D4]/20 text-[#06B6D4] rounded-full">
                  +{BIND_REWARDS.email} HOOT
                </span>
              </div>
              <button
                type="button"
                aria-label={tc('cancel')}
                onClick={() => setShowBindEmailModal(false)}
                className="p-1.5 hover:bg-[#1E1E2E] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#9090A0]" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-[#06B6D4]/10 border border-[#06B6D4]/20">
                <p className="text-xs text-[#06B6D4] flex items-center gap-2">
                  <Gift className="w-4 h-4" />
                  {t('bindEmailReward', { reward: BIND_REWARDS.email })}
                </p>
              </div>

              <div>
                <label className="text-sm text-[#9090A0] block mb-1">{ta('email')}</label>
                <input
                  type="email"
                  value={bindEmailForm.email}
                  onChange={(e) => setBindEmailForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                  placeholder={ta('emailPlaceholder')}
                />
              </div>

              <div>
                <label className="text-sm text-[#9090A0] block mb-1">{t('emailVerificationCode')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={bindEmailForm.verifyCode}
                    onChange={(e) => setBindEmailForm(prev => ({ ...prev, verifyCode: e.target.value }))}
                    className="flex-1 px-3 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                    placeholder={ta('enterCode')}
                    maxLength={6}
                  />
                  <button
                    type="button"
                    onClick={handleSendBindEmailCode}
                    disabled={bindEmailCountdown > 0 || !bindEmailForm.email}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      bindEmailCountdown > 0 || !bindEmailForm.email
                        ? 'bg-[#1E1E2E] text-[#606070] cursor-not-allowed'
                        : 'bg-[#06B6D4] hover:bg-[#0891B2] text-white'
                    }`}
                  >
                    {bindEmailCountdown > 0 ? `${bindEmailCountdown}s` : ta('sendCode')}
                  </button>
                </div>
                {bindEmailCountdown > 0 && (
                  <p className="text-xs text-[#606070] mt-1">{ta('codeSent')} {bindEmailForm.email}</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBindEmailModal(false)
                    setBindEmailCountdown(0)
                  }}
                  className="flex-1 py-2.5 border border-[#2A2A3A] text-[#9090A0] rounded-lg hover:bg-[#1E1E2E] transition-colors text-sm"
                >
                  {tc('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleBindEmailSubmit}
                  className="flex-1 py-2.5 bg-[#06B6D4] hover:bg-[#0891B2] text-white rounded-lg transition-colors text-sm font-medium"
                >
                  {tc('confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
