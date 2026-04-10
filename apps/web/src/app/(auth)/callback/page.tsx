'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

const TOKEN_KEY = 'hoot_token';
const USER_KEY = 'hoot_user';
const COOKIE_MAX_AGE = 86400; // 24 小时

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setErrorMsg('登录链接无效，请重新从 Telegram 登录');
      setStatus('error');
      return;
    }

    const handleCallback = async () => {
      try {
        // 1. 写入 localStorage 供 AuthProvider 初始化读取
        localStorage.setItem(TOKEN_KEY, token);

        // 2. 写入 Cookie 供 Next.js Middleware 路由守卫使用
        document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;

        // 3. 设置 API 请求头后获取用户信息
        api.setToken(token);
        const response = await api.get<{
          id: string;
          email: string;
          nickname: string;
          telegramId?: string;
          telegramUsername?: string;
          walletAddress?: string;
          emailVerified?: boolean;
        }>('/auth/profile');

        localStorage.setItem(USER_KEY, JSON.stringify(response.data));

        // 4. 跳转到仪表盘
        router.replace('/profile');
      } catch {
        // token 无效或过期
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        document.cookie = `${TOKEN_KEY}=; path=/; max-age=0; SameSite=Lax`;
        setErrorMsg('登录已过期，请重新从 Telegram 登录');
        setStatus('error');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-[#EF4444]/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">登录失败</h1>
          <p className="text-[#94A3B8] mb-6 text-sm">{errorMsg}</p>
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="px-6 py-2.5 bg-[#06B6D4] hover:bg-[#0891B2] text-white rounded-xl transition-colors text-sm font-medium"
          >
            返回登录页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-[#06B6D4] animate-spin mx-auto mb-4" />
        <p className="text-[#94A3B8] text-sm">正在登录，请稍候...</p>
      </div>
    </div>
  );
}
