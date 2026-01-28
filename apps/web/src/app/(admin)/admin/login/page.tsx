'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { Mail, Lock, AlertCircle, ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// 登录表单验证
const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少 6 位'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

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
      // 登录成功后检查角色
      const currentUser = useAuthStore.getState().user;
      if (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') {
        router.push('/admin');
      } else {
        setError('您没有管理员权限，请使用管理员账号登录');
        // 清除登录状态
        useAuthStore.getState().logout();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查账号密码');
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-danger/30">
        <CardHeader className="text-center border-b border-danger/20 bg-danger/5">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ShieldAlert className="w-6 h-6 text-danger" />
            <CardTitle className="text-xl text-danger">管理员登录</CardTitle>
          </div>
          <p className="text-text-secondary text-sm">
            请使用管理员账号登录后台管理系统
          </p>
        </CardHeader>

        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* 错误提示 */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 邮箱输入 */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <Input
                {...register('email')}
                type="email"
                placeholder="管理员邮箱"
                className="pl-10 bg-bg-tertiary border-border-primary focus:border-danger"
                error={errors.email?.message}
              />
            </div>

            {/* 密码输入 */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <Input
                {...register('password')}
                type="password"
                placeholder="密码"
                className="pl-10 bg-bg-tertiary border-border-primary focus:border-danger"
                error={errors.password?.message}
              />
            </div>

            {/* 登录按钮 - 红色主题 */}
            <Button
              type="submit"
              className="w-full bg-danger hover:bg-danger/90 text-white"
              size="lg"
              isLoading={isLoading}
            >
              登录管理后台
            </Button>

            {/* 返回用户端 */}
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-text-secondary hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回用户端登录
            </Link>

            {/* 安全提示 */}
            <div className="mt-6 p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <div className="flex gap-2 text-warning text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium">安全提示:</p>
                  <ul className="space-y-0.5 text-text-tertiary">
                    <li>请勿在公共设备上登录</li>
                    <li>所有管理操作将被审计</li>
                    <li>异常登录将触发告警</li>
                  </ul>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
