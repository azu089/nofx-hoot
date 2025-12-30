'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

// Metadata for this page (will be defined in layout or parent server component)
// export const metadata: Metadata = {
//   title: '注册 | QuantFi',
//   description: '注册 QuantFi 账户，开启量化交易之旅，7×24 小时自动赚取收益',
// };
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { Mail, Lock, Gift, AlertCircle, CheckCircle } from 'lucide-react';

// 注册表单验证
const registerSchema = z
  .object({
    email: z.string().email('请输入有效的邮箱地址'),
    password: z.string().min(8, '密码至少 8 位'),
    confirmPassword: z.string(),
    inviteCode: z.string().optional(),
    agree: z.boolean().refine((val) => val === true, '请同意服务条款'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次密码不一致',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      agree: false,
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    setError(null);
    try {
      await registerUser(data.email, data.password, data.inviteCode);
      setSuccess(true);
      // 注册成功后 3 秒跳转到登录页
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    }
  };

  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">注册成功！</h2>
          <p className="text-text-secondary mb-4">您的账户已创建，正在跳转到登录页面...</p>
          <Link href="/login">
            <Button>立即登录</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">注册</CardTitle>
        <p className="text-text-secondary mt-2">创建账户，开启量化之旅</p>
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
              placeholder="密码（至少 8 位）"
              className="pl-10"
              error={errors.password?.message}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
            <Input
              {...register('confirmPassword')}
              type="password"
              placeholder="确认密码"
              className="pl-10"
              error={errors.confirmPassword?.message}
            />
          </div>

          <div className="relative">
            <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
            <Input
              {...register('inviteCode')}
              type="text"
              placeholder="邀请码（可选）"
              className="pl-10"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              {...register('agree')}
              className="mt-1 rounded bg-bg-tertiary border-border-primary"
            />
            <span>
              我已阅读并同意{' '}
              <Link href="/terms" className="text-brand-primary hover:text-brand-primary/80">
                服务条款
              </Link>{' '}
              和{' '}
              <Link href="/privacy" className="text-brand-primary hover:text-brand-primary/80">
                隐私政策
              </Link>
            </span>
          </label>
          {errors.agree && (
            <p className="text-sm text-danger">{errors.agree.message}</p>
          )}

          <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
            注册
          </Button>

          <p className="text-center text-text-secondary text-sm">
            已有账户？{' '}
            <Link href="/login" className="text-brand-primary hover:text-brand-primary/80">
              立即登录
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
