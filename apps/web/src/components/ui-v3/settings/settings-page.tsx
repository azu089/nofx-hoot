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
  Mail,
  Eye,
  EyeOff,
  X,
  Check
} from 'lucide-react'

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
  onSettingChange?: (key: string, value: boolean | string) => void
  onChangePassword?: (oldPassword: string, newPassword: string) => void
  onChangeEmail?: (newEmail: string, password: string) => void
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
  onSettingChange,
  onChangePassword,
  onChangeEmail
}: SettingsPageProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false)

  // 弹窗状态
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)

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

  const languages = [
    { code: '简体中文', flag: '🇨🇳' },
    { code: 'English', flag: '🇺🇸' },
    { code: '繁體中文', flag: '🇭🇰' },
    { code: '日本語', flag: '🇯🇵' }
  ]
  const themes = [
    { value: 'dark', label: '深色', icon: Moon },
    { value: 'light', label: '浅色', icon: Sun },
    { value: 'system', label: '跟随系统', icon: Monitor }
  ] as const

  const handleToggle = (key: keyof typeof settings) => {
    const newValue = !settings[key]
    setSettings(prev => ({ ...prev, [key]: newValue }))
    onSettingChange?.(key, newValue)
  }

  const handleLanguageChange = (langCode: string) => {
    setSettings(prev => ({ ...prev, language: langCode }))
    setShowLanguageDropdown(false)
    onSettingChange?.('language', langCode)
  }

  const getCurrentLanguageFlag = () => {
    const lang = languages.find(l => l.code === settings.language)
    return lang?.flag || '🌐'
  }

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    setSettings(prev => ({ ...prev, theme }))
    onSettingChange?.('theme', theme)
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

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8F8FC] p-4 md:p-6">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            aria-label="返回"
            onClick={() => onNavigate?.('/me')}
            className="p-2 -ml-2 hover:bg-[#1E1E2E] rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[#9090A0]" />
          </button>
          <h1 className="text-xl font-bold">设置</h1>
        </div>

        {/* 账户安全 */}
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E1E2E]/50 flex items-center gap-3">
            <Lock className="w-5 h-5 text-[#9090A0]" />
            <span>账户安全</span>
          </div>

          {/* 修改密码 */}
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-[#1E1E2E]/50 hover:bg-[#1E1E2E]/30 transition-colors"
          >
            <span className="text-sm">修改密码</span>
            <ChevronRight className="w-4 h-4 text-[#606070]" />
          </button>

          {/* 绑定邮箱 */}
          <button
            type="button"
            onClick={() => setShowEmailModal(true)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1E1E2E]/30 transition-colors"
          >
            <div className="flex flex-col items-start">
              <span className="text-sm">绑定邮箱</span>
              <span className="text-xs text-[#606070]">{userEmail}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#606070]" />
          </button>
        </div>

        {/* 语言 */}
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4 relative z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-[#9090A0]" />
              <span>语言</span>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors"
              >
                <span className="text-base">{getCurrentLanguageFlag()}</span>
                <span className="text-sm">{settings.language}</span>
                <ChevronDown className={`w-4 h-4 text-[#9090A0] transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showLanguageDropdown && (
                <div className="absolute right-0 mt-2 w-40 bg-[#1E1E2E] border border-[#2A2A3A] rounded-lg shadow-xl z-50 overflow-hidden">
                  {languages.map(lang => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full px-3 py-2.5 text-left text-sm hover:bg-[#2A2A3A] transition-colors flex items-center gap-2 ${
                        settings.language === lang.code ? 'text-[#06B6D4] bg-[#06B6D4]/10' : ''
                      }`}
                    >
                      <span className="text-base">{lang.flag}</span>
                      <span className="flex-1">{lang.code}</span>
                      {settings.language === lang.code && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 主题 */}
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <Moon className="w-5 h-5 text-[#9090A0]" />
            <span>主题</span>
          </div>
          <div className="flex gap-2">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleThemeChange(value)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                  settings.theme === value
                    ? 'bg-[#06B6D4] text-white'
                    : 'bg-[#1E1E2E] text-[#9090A0] hover:bg-[#2A2A3A]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 通知 */}
        <div className="backdrop-blur-xl bg-[#12121A]/80 border border-[#1E1E2E] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E1E2E]/50 flex items-center gap-3">
            <Bell className="w-5 h-5 text-[#9090A0]" />
            <span>通知</span>
          </div>

          {[
            { key: 'pushNotifications', label: '推送通知' },
            { key: 'emailNotifications', label: '邮件通知' },
            { key: 'tradingAlerts', label: '交易提醒' }
          ].map((item, index, arr) => (
            <div
              key={item.key}
              className={`flex items-center justify-between px-4 py-3 ${
                index < arr.length - 1 ? 'border-b border-[#1E1E2E]/50' : ''
              }`}
            >
              <span className="text-sm">{item.label}</span>
              <button
                type="button"
                aria-label={`${item.label} ${settings[item.key as keyof typeof settings] ? '已开启' : '已关闭'}`}
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
              <h3 className="text-lg font-bold">修改密码</h3>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setShowPasswordModal(false)}
                className="p-1.5 hover:bg-[#1E1E2E] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#9090A0]" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-[#9090A0] block mb-1">当前密码</label>
                <div className="relative">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={passwordForm.old}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, old: e.target.value }))}
                    className="w-full px-3 py-2.5 pr-10 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                    placeholder="输入当前密码"
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
                <label className="text-sm text-[#9090A0] block mb-1">新密码</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                    className="w-full px-3 py-2.5 pr-10 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                    placeholder="输入新密码"
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
                <label className="text-sm text-[#9090A0] block mb-1">确认新密码</label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                  placeholder="再次输入新密码"
                />
              </div>

              <div>
                <label className="text-sm text-[#9090A0] block mb-1">邮箱验证码</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={passwordForm.verifyCode}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, verifyCode: e.target.value }))}
                    className="flex-1 px-3 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                    placeholder="输入6位验证码"
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
                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </button>
                </div>
                {codeSent && countdown > 0 && (
                  <p className="text-xs text-[#606070] mt-1">验证码已发送至 {userEmail}</p>
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
                  取消
                </button>
                <button
                  type="button"
                  onClick={handlePasswordSubmit}
                  className="flex-1 py-2.5 bg-[#06B6D4] hover:bg-[#0891B2] text-white rounded-lg transition-colors text-sm font-medium"
                >
                  确认修改
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
              <h3 className="text-lg font-bold">更换邮箱</h3>
              <button
                type="button"
                aria-label="关闭"
                onClick={() => setShowEmailModal(false)}
                className="p-1.5 hover:bg-[#1E1E2E] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#9090A0]" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-[#1E1E2E]/50 border border-[#2A2A3A]">
                <p className="text-xs text-[#9090A0]">当前邮箱</p>
                <p className="text-sm mt-0.5">{userEmail}</p>
              </div>

              <div>
                <label className="text-sm text-[#9090A0] block mb-1">新邮箱地址</label>
                <input
                  type="email"
                  value={emailForm.email}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                  placeholder="输入新邮箱地址"
                />
              </div>

              <div>
                <label className="text-sm text-[#9090A0] block mb-1">账户密码</label>
                <div className="relative">
                  <input
                    type={showEmailPassword ? 'text' : 'password'}
                    value={emailForm.password}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2.5 pr-10 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                    placeholder="输入当前密码验证"
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
                <label className="text-sm text-[#9090A0] block mb-1">新邮箱验证码</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={emailForm.verifyCode}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, verifyCode: e.target.value }))}
                    className="flex-1 px-3 py-2.5 rounded-lg bg-[#1E1E2E] border border-[#2A2A3A] text-sm focus:outline-none focus:border-[#06B6D4]"
                    placeholder="输入6位验证码"
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
                    {emailCountdown > 0 ? `${emailCountdown}s` : '获取验证码'}
                  </button>
                </div>
                {emailCodeSent && emailCountdown > 0 && (
                  <p className="text-xs text-[#606070] mt-1">验证码已发送至 {emailForm.email}</p>
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
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleEmailSubmit}
                  className="flex-1 py-2.5 bg-[#06B6D4] hover:bg-[#0891B2] text-white rounded-lg transition-colors text-sm font-medium"
                >
                  确认更换
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
