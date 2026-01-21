'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 生态中心 = 质押大厅，直接重定向
export default function TgEcosystemPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/tg/ecosystem/staking');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-pulse text-text-secondary">加载中...</div>
    </div>
  );
}
