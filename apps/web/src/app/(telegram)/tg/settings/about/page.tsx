'use client';

import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import Link from 'next/link';
import {
  ArrowLeft,
  Info,
  FileText,
  Shield,
  ExternalLink,
  Heart,
} from 'lucide-react';

export default function TgAboutPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();

  const links = [
    {
      icon: FileText,
      label: '用户协议',
      href: '/legal/terms',
    },
    {
      icon: Shield,
      label: '隐私政策',
      href: '/legal/privacy',
    },
  ];

  return (
    <div className="space-y-4 pb-24">
      {/* 顶部 */}
      <button
        onClick={() => { haptic('selection'); router.back(); }}
        className="flex items-center gap-2 text-text-secondary"
      >
        <ArrowLeft size={20} />
        <span className="text-lg font-medium text-white">关于应用</span>
      </button>

      {/* Logo 和版本 */}
      <div className="flex flex-col items-center py-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center mb-4">
          <span className="text-white text-3xl font-bold">Q</span>
        </div>
        <h2 className="text-white font-bold text-xl">QuantFi</h2>
        <p className="text-text-tertiary text-sm mt-1">智能量化交易平台</p>
        <p className="text-text-tertiary text-xs mt-3">版本 1.0.0</p>
      </div>

      {/* 功能介绍 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
        <h3 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-brand-primary" />
          关于 QuantFi
        </h3>
        <p className="text-text-secondary text-sm leading-relaxed">
          QuantFi 是一个专业的量化交易平台，提供策略市场、自动化交易、VPS 托管等一站式服务。
          我们致力于让每个人都能享受到专业的量化交易服务。
        </p>
      </div>

      {/* 法律文档链接 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl divide-y divide-border-primary">
        {links.map((link, idx) => {
          const Icon = link.icon;
          return (
            <Link
              key={idx}
              href={link.href}
              onClick={() => haptic('selection')}
              className="flex items-center justify-between p-4"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-text-secondary" />
                <span className="text-white text-sm">{link.label}</span>
              </div>
              <ExternalLink className="w-4 h-4 text-text-tertiary" />
            </Link>
          );
        })}
      </div>

      {/* 底部 */}
      <div className="text-center py-6">
        <p className="text-text-tertiary text-xs flex items-center justify-center gap-1">
          Made with <Heart className="w-3 h-3 text-danger" /> by QuantFi Team
        </p>
        <p className="text-text-tertiary text-xs mt-2">
          © 2024 QuantFi. All rights reserved.
        </p>
      </div>
    </div>
  );
}
