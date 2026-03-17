"use client";

import Image from "next/image";
import {
  ArrowLeft,
  FileText,
  Shield,
  AlertTriangle,
  Globe,
  MessageCircle,
  Mail,
  ChevronRight
} from "lucide-react";

interface MobileAboutPageProps {
  onBack?: () => void
  onNavigate?: (path: string) => void
}

export function MobileAboutPage({ onBack, onNavigate }: MobileAboutPageProps) {
  const legalItems = [
    {
      icon: FileText,
      title: "用户协议",
      href: "/legal/terms",
    },
    {
      icon: Shield,
      title: "隐私政策",
      href: "/legal/privacy",
    },
    {
      icon: AlertTriangle,
      title: "风险提示",
      href: "/legal/risk",
    },
  ];

  const contactItems = [
    {
      icon: Globe,
      title: "官方网站",
      href: "https://hoot.trade",
      value: "hoot.trade",
    },
    {
      icon: MessageCircle,
      title: "Telegram",
      href: "https://t.me/hoot",
      value: "@hoot",
    },
    {
      icon: "twitter" as const,
      title: "Twitter",
      href: "https://twitter.com/hoot",
      value: "@hoot_trade",
    },
    {
      icon: Mail,
      title: "邮箱",
      href: "mailto:support@hoot.trade",
      value: "support@hoot.trade",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white pb-8">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-50 bg-[#0A0A0F] [transform:translateZ(0)] border-b border-[#1E1E2E]">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            type="button"
            onClick={onBack}
            aria-label="返回"
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[#12121A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-base font-semibold text-white">关于 Hoot</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="px-4 pt-6 space-y-4">
        {/* Logo 卡片 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden p-6">
          <div className="flex flex-col items-center text-center space-y-3">
            {/* Logo */}
            <div className="w-20 h-20">
              <Image
                src="/icons/hoot/token.png"
                alt="Hoot Logo"
                width={80}
                height={80}
                className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              />
            </div>

            {/* App 名称和标语 */}
            <div>
              <h2 className="text-2xl font-bold">Hoot</h2>
              <p className="text-xs text-[#94A3B8] mt-1">AI驱动的量化交易平台</p>
            </div>

            {/* 版本 */}
            <span className="text-xs text-[#94A3B8]">v1.19.0</span>
          </div>
        </div>

        {/* 法律条款 + 联系方式 合并卡片 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="divide-y divide-[#1E1E2E]/50">
            {legalItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.title}
                  type="button"
                  aria-label={item.title}
                  onClick={() => onNavigate?.(item.href)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors"
                >
                  <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                    <Icon className="w-4 h-4 text-cyan-500" />
                  </div>
                  <span className="flex-1 text-left text-sm">{item.title}</span>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                </button>
              );
            })}
          </div>
        </div>

        {/* 联系方式 */}
        <div className="glass-border-glow relative bg-[#12121A]/30 backdrop-blur-[72px] border border-cyan-500/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
          <div className="divide-y divide-[#1E1E2E]/50">
            {contactItems.map((item) => {
              const isTwitter = item.icon === "twitter";
              return (
                <a
                  key={item.title}
                  href={item.href}
                  aria-label={item.title}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors"
                >
                  <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                    {isTwitter ? (
                      <svg className="w-4 h-4 text-cyan-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    ) : (
                      (() => {
                        const Icon = item.icon as typeof Globe;
                        return <Icon className="w-4 h-4 text-cyan-500" />;
                      })()
                    )}
                  </div>
                  <span className="flex-1 text-sm">{item.title}</span>
                  <span className="text-xs text-[#94A3B8]">{item.value}</span>
                </a>
              );
            })}
          </div>
        </div>

        {/* 底部版权 */}
        <p className="text-center text-xs text-[#606070] py-4">© 2024-2026 Hoot</p>
      </div>
    </div>
  );
}
