'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Mail, Lock, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

// 三个步骤
type Step = 'email' | 'code' | 'password' | 'success';

// Step 1: 邮箱验证
const emailSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
});

// Step 2: 验证码验证
const codeSchema = z.object({
  code: z.string().length(6, '验证码必须为 6 位'),
});

// Step 3: 设置新密码
const passwordSchema = z.object({
  password: z.string().min(8, '密码至少 8 位'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次密码不一致',
  path: ['confirmPassword'],
});

type EmailForm = z.infer<typeof emailSchema>;
type CodeForm = z.infer<typeof codeSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: 邮箱表单
  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
  });

  // Step 2: 验证码表单
  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
  });

  // Step 3: 密码表单
  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  // 发送验证码
  const handleSendCode = async (data: EmailForm) => {
    setError(null);
    setIsLoading(true);

    try {
      // TODO: 调用 API - POST /api/auth/forgot-password/send-code
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setEmail(data.email);
      setStep('code');
      setCountdown(60);

      // 倒计时
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 验证验证码
  const handleVerifyCode = async (data: CodeForm) => {
    setError(null);
    setIsLoading(true);

    try {
      // TODO: 调用 API - POST /api/auth/forgot-password/verify-code
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码错误');
    } finally {
      setIsLoading(false);
    }
  };

  // 重设密码
  const handleResetPassword = async (data: PasswordForm) => {
    setError(null);
    setIsLoading(true);

    try {
      // TODO: 调用 API - POST /api/auth/forgot-password/reset
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 密码强度检测
  const getPasswordStrength = (password: string): { strength: number; text: string; color: string } => {
    if (!password) return { strength: 0, text: '', color: '' };

    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) return { strength: 33, text: '弱', color: 'bg-danger' };
    if (strength === 3) return { strength: 66, text: '中', color: 'bg-warning' };
    return { strength: 100, text: '强', color: 'bg-success' };
  };

  const password = passwordForm.watch('password') || '';
  const passwordStrength = getPasswordStrength(password);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">重置密码</CardTitle>
        <p className="text-text-secondary mt-2">
          {step === 'email' && '输入您的邮箱地址'}
          {step === 'code' && '输入验证码'}
          {step === 'password' && '设置新密码'}
          {step === 'success' && '密码重置成功'}
        </p>
      </CardHeader>

      <CardContent>
        {/* 步骤指示器 */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step !== 'email' ? 'bg-brand-primary text-white' : 'bg-border-secondary text-text-secondary'
            }`}>
              1
            </div>
            <div className={`w-12 h-0.5 ${step !== 'email' ? 'bg-brand-primary' : 'bg-border-secondary'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === 'password' || step === 'success' ? 'bg-brand-primary text-white' : 'bg-border-secondary text-text-secondary'
            }`}>
              2
            </div>
            <div className={`w-12 h-0.5 ${step === 'success' ? 'bg-brand-primary' : 'bg-border-secondary'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === 'success' ? 'bg-brand-primary text-white' : 'bg-border-secondary text-text-secondary'
            }`}>
              3
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm mb-4">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Step 1: 输入邮箱 */}
        {step === 'email' && (
          <form onSubmit={emailForm.handleSubmit(handleSendCode)} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <Input
                {...emailForm.register('email')}
                type="email"
                placeholder="请输入您的邮箱地址"
                className="pl-10"
                error={emailForm.formState.errors.email?.message}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              发送验证码
            </Button>

            <div className="text-center">
              <Link href="/login" className="text-sm text-brand-primary hover:text-brand-primary/80 inline-flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" />
                返回登录
              </Link>
            </div>
          </form>
        )}

        {/* Step 2: 输入验证码 */}
        {step === 'code' && (
          <form onSubmit={codeForm.handleSubmit(handleVerifyCode)} className="space-y-4">
            <div className="text-center text-sm text-text-secondary mb-4">
              验证码已发送至 <span className="text-text-primary">{email}</span>
            </div>

            <Input
              {...codeForm.register('code')}
              type="text"
              placeholder="请输入 6 位验证码"
              maxLength={6}
              className="text-center text-2xl tracking-widest"
              error={codeForm.formState.errors.code?.message}
            />

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              验证
            </Button>

            <div className="text-center text-sm">
              {countdown > 0 ? (
                <span className="text-text-secondary">
                  {countdown}秒后可重新发送
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendCode({ email })}
                  className="text-brand-primary hover:text-brand-primary/80"
                >
                  重新发送验证码
                </button>
              )}
            </div>
          </form>
        )}

        {/* Step 3: 设置新密码 */}
        {step === 'password' && (
          <form onSubmit={passwordForm.handleSubmit(handleResetPassword)} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <Input
                {...passwordForm.register('password')}
                type="password"
                placeholder="请输入新密码（至少 8 位）"
                className="pl-10"
                error={passwordForm.formState.errors.password?.message}
              />
            </div>

            {/* 密码强度指示器 */}
            {password && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary">密码强度</span>
                  <span className={`font-medium ${
                    passwordStrength.strength === 33 ? 'text-danger' :
                    passwordStrength.strength === 66 ? 'text-warning' :
                    'text-success'
                  }`}>
                    {passwordStrength.text}
                  </span>
                </div>
                <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${passwordStrength.color}`}
                    style={{ width: `${passwordStrength.strength}%` }}
                  />
                </div>
              </div>
            )}

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <Input
                {...passwordForm.register('confirmPassword')}
                type="password"
                placeholder="请再次输入新密码"
                className="pl-10"
                error={passwordForm.formState.errors.confirmPassword?.message}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              重置密码
            </Button>
          </form>
        )}

        {/* Step 4: 成功 */}
        {step === 'success' && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-success" />
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-text-primary mb-2">密码重置成功</h3>
              <p className="text-text-secondary text-sm">您现在可以使用新密码登录</p>
            </div>

            <Button
              onClick={() => router.push('/login')}
              className="w-full"
              size="lg"
            >
              返回登录
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
