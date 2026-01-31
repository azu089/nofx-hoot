'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { VerifyEmailPage as VerifyEmailPageUI } from '@/components/ui-v3/auth/verify-email-page';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sendVerificationCode, verifyEmail, isAuthenticated, isLoading } = useAuth();

  // 直接从 URL 参数获取邮箱（避免 useEffect 中 setState）
  const email = searchParams.get('email') || '';

  // 没有邮箱参数时跳转到注册页
  useEffect(() => {
    if (!email) {
      router.push('/register');
    }
  }, [email, router]);

  // 已登录跳转到仪表盘
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  const handleVerify = async (code: string) => {
    await verifyEmail(email, code);
  };

  const handleResend = async () => {
    await sendVerificationCode(email);
  };

  const handleSuccess = () => {
    // 验证成功后跳转到登录页
    router.push('/login?verified=true');
  };

  const handleBack = () => {
    router.push('/register');
  };

  if (isLoading || !email) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <VerifyEmailPageUI
      email={email}
      onVerify={handleVerify}
      onResend={handleResend}
      onBack={handleBack}
      onSuccess={handleSuccess}
    />
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
