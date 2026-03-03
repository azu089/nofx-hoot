'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import { LandingPage } from '@/components/ui-v3'
import Image from 'next/image'

export default function Home() {
  const router = useRouter()
  const { isAuthenticated, isLoading, tgAutoLoginError } = useAuth()

  // 已认证（TG 自动登录成功 或 已有 token）→ 直接跳到仪表盘
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard')
    }
  }, [isLoading, isAuthenticated, router])

  // TG 自动登录失败 → 跳到登录页（让用户手动选择登录方式）
  useEffect(() => {
    if (!isLoading && tgAutoLoginError) {
      router.replace('/login')
    }
  }, [isLoading, tgAutoLoginError, router])

  // 加载中 / 已认证（等待跳转）/ TG 错误（等待跳转） → 全屏 HOOT loading 画面
  // 覆盖所有 TG 场景：自动登录中 / 跳转前 → 用户永远不会看到 Landing Page
  if (isLoading || isAuthenticated || tgAutoLoginError) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <Image
            src="/icons/hoot/logo.png"
            alt="HOOT"
            width={80}
            height={80}
            className="rounded-full"
          />
          <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  // 未认证且确认非 TG 环境 → 显示 Landing Page
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
