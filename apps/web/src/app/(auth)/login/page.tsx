'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

// Metadata for this page (will be defined in layout or parent server component)
// export const metadata: Metadata = {
//   title: '登录 | QuantFi',
//   description: '登录您的 QuantFi 账户，开启智能量化交易',
// };
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { Mail, Lock, AlertCircle } from 'lucide-react';

// 登录表单验证
const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少 6 位'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [isLocalhost, setIsLocalhost] = useState(false);

  // 客户端检测是否为 localhost（避免水合错误）
  useEffect(() => {
    setIsLocalhost(window.location.hostname === 'localhost');
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    try {
      await login(data.email, data.password);
      // 用户端登录始终跳转到用户仪表盘
      // 管理员需要后台时可通过侧边栏菜单或直接访问 /admin
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    }
  };

  return (
    <Card variant="glass" className="w-full max-w-md glow-border glow-border-primary">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">登录</CardTitle>
        <p className="text-text-secondary mt-2">欢迎回来，请登录您的账户</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
            <Input
              {...register('email')}
              type="email"
              placeholder="邮箱地址"
              className="pl-10"
              error={errors.email?.message}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
            <Input
              {...register('password')}
              type="password"
              placeholder="密码"
              className="pl-10"
              error={errors.password?.message}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-text-secondary">
              <input type="checkbox" className="rounded bg-bg-tertiary border-border-primary" />
              记住我
            </label>
            <Link href="/forgot-password" className="text-brand-primary hover:text-brand-primary/80">
              忘记密码？
            </Link>
          </div>

          <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
            登录
          </Button>

          {/* 开发环境快速登录 - localhost 或开发模式时显示 */}
          {(process.env.NODE_ENV === 'development' || isLocalhost) && (
            <div className="pt-4 border-t border-border-primary">
              <p className="text-center text-text-tertiary text-xs mb-3">开发测试</p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={async () => {
                  setError(null);
                  try {
                    // 测试账号: test@example.com / test123456
                    await login('test@example.com', 'test123456');
                    router.push('/dashboard');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : '测试账号登录失败');
                  }
                }}
              >
                快速登录测试账号
              </Button>
            </div>
          )}

          <p className="text-center text-text-secondary text-sm">
            还没有账户？{' '}
            <Link href="/register" className="text-brand-primary hover:text-brand-primary/80">
              立即注册
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
