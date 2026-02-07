"use client";

import * as React from "react";
import {
  ArrowLeft,
  Lock,
  Mail,
  Globe,
  Palette,
  Bell,
  X,
  ChevronRight,
  ChevronDown,
  Check,
  Send,
  Wallet,
  Gift,
  Link2,
  CheckCircle2,
  User,
} from "lucide-react";
import { CustomSwitch } from "@/components/custom-switch";
import { useLocale, useTranslations } from "@/i18n/provider";
import { localeNames } from "@/i18n/config";
import { useTheme } from "@/lib/theme";

// 绑定奖励配置
const BIND_REWARDS = {
  telegram: 10,  // 绑定 TG +10 HOOT
  wallet: 10,    // 绑定钱包 +10 HOOT
  email: 15,     // 绑定邮箱 +15 HOOT
}

interface BindingStatus {
  telegram?: { bound: boolean; username?: string }
  wallet?: { bound: boolean; address?: string }
  email?: { bound: boolean; address?: string; verified?: boolean }
}

interface MobileSettingsPageProps {
  onBack?: () => void
  bindingStatus?: BindingStatus
  onBindTelegram?: () => void
  onBindWallet?: () => void
}

export function MobileSettingsPage({
  onBack,
  bindingStatus = {
    telegram: { bound: false },
    wallet: { bound: false },
    email: { bound: true, address: 'user@example.com', verified: true }
  },
  onBindTelegram,
  onBindWallet
}: MobileSettingsPageProps) {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
  const [isUsernameModalOpen, setIsUsernameModalOpen] = React.useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = React.useState(false);
  const { locale, setLocale, locales } = useLocale();
  const { theme, setTheme } = useTheme(); // 使用全局主题
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');

  // 从 i18n 配置获取语言列表
  const languages = locales.map(code => ({
    code,
    name: localeNames[code].name,
    flag: localeNames[code].flag
  }));

  // States
  const [email] = React.useState("user@example.com");
  const [username, setUsername] = React.useState("CryptoTrader_Pro");
  const [newUsername, setNewUsername] = React.useState("");
  const [pushNotifications, setPushNotifications] = React.useState(true);
  const [emailNotifications, setEmailNotifications] = React.useState(true);
  const [tradingAlerts, setTradingAlerts] = React.useState(true);

  // Password form state
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 调用修改密码 API
    setIsPasswordModalOpen(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleUsernameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUsername.trim() && newUsername.trim().length >= 3) {
      setUsername(newUsername.trim());
      setIsUsernameModalOpen(false);
      setNewUsername("");
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-6">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-lg border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            aria-label={tCommon('back')}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-semibold text-white">{t('title')}</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* 账户设置 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="divide-y divide-[#1E1E2E]/50">
            {/* 修改用户名 */}
            <button
              type="button"
              onClick={() => {
                setNewUsername(username);
                setIsUsernameModalOpen(true);
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-purple-500/10 rounded-xl flex items-center justify-center">
                  <User className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <span className="text-sm text-white">{tAuth('username')}</span>
                  <p className="text-xs text-[#94A3B8]">{username}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
            </button>

            {/* 修改密码 */}
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                  <Lock className="w-4 h-4 text-cyan-500" />
                </div>
                <span className="text-sm text-white">{t('changePassword')}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
            </button>

            {/* 绑定邮箱 */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                  <Mail className="w-4 h-4 text-cyan-500" />
                </div>
                <div>
                  <span className="text-sm text-white">{tAuth('email')}</span>
                  <p className="text-xs text-[#94A3B8]">{email}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
            </div>
          </div>
        </div>

        {/* 账户绑定 - 赚取 HOOT */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E1E2E]/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link2 className="w-4 h-4 text-[#9090A0]" />
              <span className="text-sm text-white">{t('accountBinding')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <Gift className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span className="text-[#06B6D4]">{t('bindToEarn')}</span>
            </div>
          </div>

          <div className="divide-y divide-[#1E1E2E]/50">
            {/* 绑定 Telegram */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0088cc]/20 flex items-center justify-center">
                  <Send className="w-4 h-4 text-[#0088cc]" />
                </div>
                <div>
                  <span className="text-sm text-white">Telegram</span>
                  {bindingStatus.telegram?.bound ? (
                    <p className="text-xs text-[#22C55E]">@{bindingStatus.telegram.username || 'user'}</p>
                  ) : (
                    <p className="text-xs text-[#06B6D4]">+{BIND_REWARDS.telegram} HOOT</p>
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
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#06B6D4]/20 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-[#06B6D4]" />
                </div>
                <div>
                  <span className="text-sm text-white">{t('web3Wallet')}</span>
                  {bindingStatus.wallet?.bound ? (
                    <p className="text-xs text-[#22C55E]">{bindingStatus.wallet.address?.slice(0, 6)}...{bindingStatus.wallet.address?.slice(-4)}</p>
                  ) : (
                    <p className="text-xs text-[#06B6D4]">+{BIND_REWARDS.wallet} HOOT</p>
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

            {/* 邮箱验证 */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/20 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-[#8B5CF6]" />
                </div>
                <div>
                  <span className="text-sm text-white">{tAuth('verifyEmail')}</span>
                  {bindingStatus.email?.verified ? (
                    <p className="text-xs text-[#22C55E]">{bindingStatus.email.address}</p>
                  ) : (
                    <p className="text-xs text-[#06B6D4]">+{BIND_REWARDS.email} HOOT</p>
                  )}
                </div>
              </div>
              {bindingStatus.email?.verified ? (
                <div className="flex items-center gap-1.5 text-[#22C55E]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs">{t('bound')}</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-medium bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-lg transition-colors"
                >
                  {t('bindNow')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 偏好设置 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="divide-y divide-[#1E1E2E]/50">
            {/* 语言 */}
            <div className="flex items-center justify-between p-4 relative">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#1A1A24] rounded-xl flex items-center justify-center">
                  <Globe className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-white">{t('language')}</span>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1A24] border border-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors"
                >
                  <span className="text-base">{localeNames[locale]?.flag}</span>
                  <span className="text-sm text-white">{localeNames[locale]?.name}</span>
                  <ChevronDown className={`w-4 h-4 text-[#94A3B8] transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showLanguageDropdown && (
                  <div className="absolute right-0 mt-2 w-44 max-h-[280px] overflow-y-auto bg-[#1A1A24] border border-[#1E1E2E] rounded-lg shadow-xl z-50">
                    {languages.map(lang => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setLocale(lang.code); // 真实切换语言，会触发页面刷新
                          setShowLanguageDropdown(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-sm hover:bg-[#2A2A3A] transition-colors flex items-center gap-2 ${
                          locale === lang.code ? 'text-cyan-400 bg-cyan-500/10' : 'text-white'
                        }`}
                      >
                        <span className="text-base">{lang.flag}</span>
                        <span className="flex-1 truncate">{lang.name}</span>
                        {locale === lang.code && <Check className="w-4 h-4 flex-shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 主题 */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#1A1A24] rounded-xl flex items-center justify-center">
                  <Palette className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-white">{t('theme')}</span>
              </div>
              <div className="flex gap-1.5">
                {([
                  { value: "dark", label: t('themeDark') },
                  { value: "light", label: t('themeLight') },
                  { value: "system", label: t('themeSystem') },
                ] as const).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTheme(item.value)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      theme === item.value
                        ? "bg-cyan-500 text-white"
                        : "bg-[#1A1A24] text-[#94A3B8]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 推送通知 */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#1A1A24] rounded-xl flex items-center justify-center">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-white">{t('pushNotifications')}</span>
              </div>
              <CustomSwitch
                checked={pushNotifications}
                onCheckedChange={setPushNotifications}
              />
            </div>

            {/* 邮件通知 */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#1A1A24] rounded-xl flex items-center justify-center">
                  <Mail className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-white">{t('emailNotifications')}</span>
              </div>
              <CustomSwitch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>

            {/* 交易提醒 */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#1A1A24] rounded-xl flex items-center justify-center">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-white">{t('tradingAlerts')}</span>
              </div>
              <CustomSwitch
                checked={tradingAlerts}
                onCheckedChange={setTradingAlerts}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 修改密码模态框 */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setIsPasswordModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-[#12121A] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">{t('changePassword')}</h2>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                aria-label={tCommon('cancel')}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1A1A24]"
              >
                <X className="w-5 h-5 text-[#94A3B8]" />
              </button>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-500/50"
                placeholder={t('currentPassword')}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-500/50"
                placeholder={t('newPassword')}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-500/50"
                placeholder={t('confirmNewPassword')}
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-[#1E1E2E] text-sm text-white font-medium hover:bg-[#1A1A24]"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-cyan-500 text-sm text-white font-medium hover:bg-cyan-600"
                >
                  {tCommon('confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 修改用户名模态框 */}
      {isUsernameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setIsUsernameModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-[#12121A] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">{tAuth('username')}</h2>
              <button
                type="button"
                onClick={() => setIsUsernameModalOpen(false)}
                aria-label={tCommon('cancel')}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1A1A24]"
              >
                <X className="w-5 h-5 text-[#94A3B8]" />
              </button>
            </div>
            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#94A3B8] focus:outline-none focus:border-purple-500/50"
                  placeholder={tAuth('usernamePlaceholder')}
                  minLength={3}
                  maxLength={20}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUsernameModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-[#1E1E2E] text-sm text-white font-medium hover:bg-[#1A1A24]"
                >
                  {tCommon('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!newUsername.trim() || newUsername.trim().length < 3}
                  className="flex-1 py-3 rounded-xl bg-purple-500 text-sm text-white font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {tCommon('confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
