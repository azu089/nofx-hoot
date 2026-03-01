'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LandingPage } from '@/components/ui-v3'

export default function Home() {
  const router = useRouter()

  // 在 Telegram Mini App 内打开时，自动跳到登录页完成 initData 自动登录
  useEffect(() => {
    const tgWebApp = (window as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
    if (tgWebApp !== undefined) {
      router.replace('/login');
    }
  }, [router]);

  return (
    <LandingPage
      onLogin={() => router.push('/login')}
      onRegister={() => router.push('/register')}
      onStartTrading={() => router.push('/register')}
      onWatchDemo={() => router.push('/login')}
      onViewStrategies={() => router.push('/strategies')}
    />
  )
}
