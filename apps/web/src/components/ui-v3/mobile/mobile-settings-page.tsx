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
} from "lucide-react";
import { CustomSwitch } from "@/components/custom-switch";

interface MobileSettingsPageProps {
  onBack?: () => void
}

const languages = [
  { code: "简体中文", flag: "🇨🇳" },
  { code: "English", flag: "🇺🇸" },
  { code: "繁體中文", flag: "🇭🇰" },
  { code: "日本語", flag: "🇯🇵" },
];

export function MobileSettingsPage({ onBack }: MobileSettingsPageProps) {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = React.useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = React.useState(false);

  // States
  const [email] = React.useState("user@example.com");
  const [language, setLanguage] = React.useState("简体中文");
  const [theme, setTheme] = React.useState<"dark" | "light" | "system">("dark");
  const [pushNotifications, setPushNotifications] = React.useState(true);
  const [emailNotifications, setEmailNotifications] = React.useState(true);
  const [tradingAlerts, setTradingAlerts] = React.useState(true);

  // Password form state
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("修改密码");
    setIsPasswordModalOpen(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-6">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-10 bg-[#0A0A0F]/95 backdrop-blur-xl border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-medium text-white">设置</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* 账户设置 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="divide-y divide-[#1E1E2E]/50">
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
                <span className="text-sm text-white">修改密码</span>
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
                  <span className="text-sm text-white">邮箱</span>
                  <p className="text-xs text-[#94A3B8]">{email}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
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
                <span className="text-sm text-white">语言</span>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1A24] border border-[#1E1E2E] hover:bg-[#2A2A3A] rounded-lg transition-colors"
                >
                  <span className="text-base">{languages.find(l => l.code === language)?.flag}</span>
                  <span className="text-sm text-white">{language}</span>
                  <ChevronDown className={`w-4 h-4 text-[#94A3B8] transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showLanguageDropdown && (
                  <div className="absolute right-0 mt-2 w-40 bg-[#1A1A24] border border-[#1E1E2E] rounded-lg shadow-xl z-50 overflow-hidden">
                    {languages.map(lang => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setLanguage(lang.code);
                          setShowLanguageDropdown(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-sm hover:bg-[#2A2A3A] transition-colors flex items-center gap-2 ${
                          language === lang.code ? 'text-cyan-400 bg-cyan-500/10' : 'text-white'
                        }`}
                      >
                        <span className="text-base">{lang.flag}</span>
                        <span className="flex-1">{lang.code}</span>
                        {language === lang.code && <Check className="w-4 h-4" />}
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
                <span className="text-sm text-white">主题</span>
              </div>
              <div className="flex gap-1.5">
                {([
                  { value: "dark", label: "深色" },
                  { value: "light", label: "浅色" },
                  { value: "system", label: "系统" },
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
                <span className="text-sm text-white">推送通知</span>
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
                <span className="text-sm text-white">邮件通知</span>
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
                <span className="text-sm text-white">交易提醒</span>
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
              <h2 className="text-lg font-semibold text-white">修改密码</h2>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                aria-label="关闭"
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
                placeholder="旧密码"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-500/50"
                placeholder="新密码"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#0A0A0F] border border-[#1E1E2E] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#94A3B8] focus:outline-none focus:border-cyan-500/50"
                placeholder="确认密码"
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-[#1E1E2E] text-sm text-white font-medium hover:bg-[#1A1A24]"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-cyan-500 text-sm text-white font-medium hover:bg-cyan-600"
                >
                  确认
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
