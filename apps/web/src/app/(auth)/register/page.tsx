'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { useAuthStore } from '@/stores/auth.store';
import { Mail, Lock, Gift, AlertCircle, CheckCircle, ArrowLeft, Shield } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api';

// 步骤 1：邮箱验证
const emailSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
});

// 步骤 2：验证码
const codeSchema = z.object({
  code: z.string().length(6, '验证码必须是 6 位数字'),
});

// 步骤 3：设置密码
const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, '密码至少 8 位')
      .regex(/[A-Z]/, '密码必须包含大写字母')
      .regex(/[a-z]/, '密码必须包含小写字母')
      .regex(/[0-9]/, '密码必须包含数字'),
    confirmPassword: z.string(),
    inviteCode: z.string().optional(),
    agree: z.boolean().refine((val) => val === true, '请同意服务条款'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次密码不一致',
    path: ['confirmPassword'],
  });

type EmailForm = z.infer<typeof emailSchema>;
type CodeForm = z.infer<typeof codeSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isLoading } = useAuthStore();

  // 步骤控制
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 倒计时
  const [countdown, setCountdown] = useState(0);
  const [sendingCode, setSendingCode] = useState(false);

  // 步骤 1 表单
  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
  });

  // 步骤 2 表单
  const codeForm = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
  });

  // 步骤 3 表单
  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      agree: false,
    },
  });

  // 倒计时效果
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 发送验证码
  const sendVerificationCode = useCallback(async (emailAddress: string) => {
    setSendingCode(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddress, type: 'register' }),
      });

      const data = await res.json();

      if (data.code === 0) {
        setCountdown(60);
        return true;
      } else {
        setError(data.message || '发送验证码失败');
        if (data.data?.retryAfter) {
          setCountdown(data.data.retryAfter);
        }
        return false;
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
      return false;
    } finally {
      setSendingCode(false);
    }
  }, []);

  // 步骤 1：提交邮箱
  const onEmailSubmit = async (data: EmailForm) => {
    setError(null);
    const sent = await sendVerificationCode(data.email);
    if (sent) {
      setEmail(data.email);
      setStep(2);
    }
  };

  // 步骤 2：验证验证码
  const onCodeSubmit = async (data: CodeForm) => {
    setError(null);

    try {
      const res = await fetch(`${API_URL}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: data.code, type: 'register' }),
      });

      const result = await res.json();

      if (result.code === 0 && result.data?.verified) {
        setVerificationCode(data.code);
        setStep(3);
      } else {
        setError(result.message || '验证码错误');
      }
    } catch (err) {
      setError('网络错误，请稍后重试');
    }
  };

  // 步骤 3：完成注册
  const onPasswordSubmit = async (data: PasswordForm) => {
    setError(null);

    try {
      await registerUser(email, data.password, verificationCode, data.inviteCode);
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    }
  };

  // 返回上一步
  const goBack = () => {
    setError(null);
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    }
  };

  // 注册成功
  if (success) {
    return (
      <Card variant="glass" className="w-full max-w-md glow-border glow-border-success">
        <CardContent className="py-12 text-center">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-4 animate-scale-in" />
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
    <Card variant="glass" className="w-full max-w-md glow-border glow-border-primary">
      <CardHeader className="text-center relative">
        {step > 1 && (
          <button
            onClick={goBack}
            className="absolute left-0 top-1/2 -translate-y-1/2 p-2 text-text-secondary hover:text-white transition-colors"
            aria-label="返回上一步"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <CardTitle className="text-2xl">注册</CardTitle>
        <p className="text-text-secondary mt-2">
          {step === 1 && '输入邮箱获取验证码'}
          {step === 2 && '输入验证码'}
          {step === 3 && '设置密码完成注册'}
        </p>
        {/* 步骤指示器 */}
        <div className="flex justify-center gap-2 mt-4">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-colors ${
                s === step ? 'bg-brand-primary' : s < step ? 'bg-success' : 'bg-border-primary'
              }`}
            />
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* 步骤 1：输入邮箱 */}
        {step === 1 && (
          <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <Input
                {...emailForm.register('email')}
                type="email"
                placeholder="邮箱地址"
                className="pl-10"
                error={emailForm.formState.errors.email?.message}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={sendingCode}
              disabled={countdown > 0}
            >
              {countdown > 0 ? `${countdown}秒后可重发` : '获取验证码'}
            </Button>

            <p className="text-center text-text-secondary text-sm">
              已有账户？{' '}
              <Link href="/login" className="text-brand-primary hover:text-brand-primary/80">
                立即登录
              </Link>
            </p>
          </form>
        )}

        {/* 步骤 2：输入验证码 */}
        {step === 2 && (
          <form onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="space-y-4">
            <p className="text-sm text-text-secondary text-center mb-4">
              验证码已发送至 <span className="text-white">{email}</span>
            </p>

            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <Input
                {...codeForm.register('code')}
                type="text"
                placeholder="6 位验证码"
                className="pl-10 text-center text-xl tracking-widest"
                maxLength={6}
                error={codeForm.formState.errors.code?.message}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              验证
            </Button>

            <button
              type="button"
              onClick={() => sendVerificationCode(email)}
              disabled={countdown > 0 || sendingCode}
              className="w-full text-center text-sm text-text-secondary hover:text-white transition-colors disabled:opacity-50"
            >
              {countdown > 0 ? `${countdown}秒后可重发` : '重新发送验证码'}
            </button>
          </form>
        )}

        {/* 步骤 3：设置密码 */}
        {step === 3 && (
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <Input
                {...passwordForm.register('password')}
                type="password"
                placeholder="密码（至少 8 位，含大小写字母和数字）"
                className="pl-10"
                error={passwordForm.formState.errors.password?.message}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <Input
                {...passwordForm.register('confirmPassword')}
                type="password"
                placeholder="确认密码"
                className="pl-10"
                error={passwordForm.formState.errors.confirmPassword?.message}
              />
            </div>

            <div className="relative">
              <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
              <Input
                {...passwordForm.register('inviteCode')}
                type="text"
                placeholder="邀请码（可选）"
                className="pl-10"
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                {...passwordForm.register('agree')}
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
            {passwordForm.formState.errors.agree && (
              <p className="text-sm text-danger">{passwordForm.formState.errors.agree.message}</p>
            )}

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              完成注册
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
