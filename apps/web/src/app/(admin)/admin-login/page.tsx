'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useAdminAuth } from '@/lib/admin-auth';
import { toast } from 'sonner';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAdminAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showTotp, setShowTotp] = useState(false);
  const [loading, setLoading] = useState(false);

  // 已登录则跳转
  if (isAuthenticated) {
    router.push('/admin');
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('请输入用户名和密码');
      return;
    }

    setLoading(true);
    try {
      await login(username, password, totpCode || undefined);
      toast.success('登录成功');
      router.push('/admin');
    } catch (error: unknown) {
      const msg = (error as Error).message || '登录失败';
      if (msg.includes('TOTP') || msg.includes('两步')) {
        setShowTotp(true);
        toast.info('请输入两步验证码');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full overflow-hidden mb-4 drop-shadow-[0_0_16px_rgba(6,182,212,0.3)]">
            <Image src="/icons/hoot/token.png" alt="HOOT" width={64} height={64} className="w-full h-full object-cover rounded-full" />
          </div>
          <h1 className="text-2xl font-bold text-white">Hoot Admin</h1>
          <p className="text-sm text-[#9090A0] mt-1">管理后台登录</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[#9090A0] mb-1.5">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-white placeholder-[#5E5E6E] focus:outline-none focus:border-cyan-400/50 transition-colors"
              placeholder="admin"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm text-[#9090A0] mb-1.5">密码</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-white placeholder-[#5E5E6E] focus:outline-none focus:border-cyan-400/50 transition-colors pr-10"
                placeholder="********"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9090A0] hover:text-white"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {showTotp && (
            <div>
              <label className="block text-sm text-[#9090A0] mb-1.5">两步验证码</label>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-3 py-2.5 bg-[#12121A] border border-[#1E1E2E] rounded-lg text-white placeholder-[#5E5E6E] focus:outline-none focus:border-cyan-400/50 transition-colors text-center text-xl tracking-widest"
                placeholder="000000"
                maxLength={6}
                autoFocus
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/50 text-black font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                登录中...
              </>
            ) : (
              '登 录'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-[#5E5E6E] mt-6">
          Hoot 管理后台 &copy; 2026
        </p>
      </div>
    </div>
  );
}
