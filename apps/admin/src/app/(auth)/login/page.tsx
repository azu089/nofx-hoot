'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { useAdminAuthStore } from '@/stores/admin-auth.store';
import { Mail, Lock, AlertCircle, ShieldAlert } from 'lucide-react';

// 登录表单验证
const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少 6 位'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAdminAuthStore();
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
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请检查账号密码');
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="text-center border-b border-danger/20 bg-danger/5">
        <div className="flex items-center justify-center gap-2 mb-2">
          <ShieldAlert className="w-5 h-5 text-danger" />
          <CardTitle className="text-xl text-danger">管理员登录</CardTitle>
        </div>
        <p className="text-text-secondary text-sm">
          请使用管理员账号登录
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

          {/* 记住我 */}
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded bg-bg-tertiary border-border-primary text-danger focus:ring-danger focus:ring-offset-0"
              />
              记住我
            </label>
          </div>

          {/* 登录按钮 - 红色主题 */}
          <Button
            type="submit"
            className="w-full bg-danger hover:bg-danger/90 text-white shadow-danger focus:ring-danger"
            size="lg"
            isLoading={isLoading}
          >
            登录管理后台
          </Button>

          {/* 开发环境测试账号 */}
          {process.env.NODE_ENV === 'development' && (
            <div className="pt-4 border-t border-[#2B3139]">
              <p className="text-center text-[#5E6673] text-xs mb-3">开发测试</p>
              <Button
                type="button"
                variant="outline"
                className="w-full border-[#F23645]/30 text-[#F23645] hover:bg-[#F23645]/10"
                onClick={async () => {
                  setError(null);
                  try {
                    await login('test@example.com', 'Password123');
                    router.push('/dashboard');
                  } catch (err) {
                    setError(err instanceof Error ? err.message : '测试账号登录失败');
                  }
                }}
              >
                快速登录 (test@example.com)
              </Button>
            </div>
          )}

          {/* 安全提示 */}
          <div className="mt-6 p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <div className="flex gap-2 text-warning text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">安全提示:</p>
                <ul className="space-y-0.5 text-text-tertiary">
                  <li>• 请勿在公共设备上登录</li>
                  <li>• 所有管理操作将被审计</li>
                  <li>• 异常登录将触发告警</li>
                </ul>
              </div>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
