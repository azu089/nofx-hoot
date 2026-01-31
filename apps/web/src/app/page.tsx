'use client'

import { useRouter } from 'next/navigation'
import { LandingPage } from '@/components/ui-v3'

export default function Home() {
  const router = useRouter()

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
