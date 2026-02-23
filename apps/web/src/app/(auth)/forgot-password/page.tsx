'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, AlertCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 返回按钮 */}
        <button
          onClick={() => router.push('/login')}
          className="flex items-center gap-2 text-[#9090A0] hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={20} />
          <span>返回登录</span>
        </button>

        {/* 卡片 */}
        <div className="bg-[#12121A] border border-[#1E1E2E] rounded-2xl p-8">
          {/* 图标 */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-[#1E1E2E] flex items-center justify-center">
              <Mail size={28} className="text-cyan-400" />
            </div>
          </div>

          {/* 标题 */}
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            忘记密码
          </h1>

          {/* 功能开发中提示 */}
          <div className="bg-[#1A1A24] border border-[#2A2A3A] rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[#F8F8FC] text-sm font-medium mb-1">
                  功能开发中
                </p>
                <p className="text-[#9090A0] text-sm leading-relaxed">
                  密码重置功能正在开发中，请联系客服协助重置密码。
                </p>
              </div>
            </div>
          </div>

          {/* 邮箱输入（占位，暂不可用） */}
          <div className="mb-4">
            <label className="block text-sm text-[#9090A0] mb-2">
              注册邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入注册邮箱"
              disabled
              className="w-full px-4 py-3 bg-[#1A1A24] border border-[#2A2A3A] rounded-xl text-white placeholder-[#5E5E6E] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* 发送按钮（禁用） */}
          <button
            disabled
            className="w-full py-3 bg-cyan-500/30 text-cyan-300/50 rounded-xl font-medium cursor-not-allowed"
          >
            发送重置链接（即将上线）
          </button>

          {/* 联系客服 */}
          <div className="mt-6 text-center">
            <p className="text-[#9090A0] text-sm">
              需要帮助？请联系{' '}
              <a
                href="https://t.me/HootQuantBot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Telegram 客服
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
