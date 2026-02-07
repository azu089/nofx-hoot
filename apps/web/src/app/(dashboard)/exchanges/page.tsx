'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobileExchangesPage } from '@/components/ui-v3/mobile/mobile-exchanges-page';
import { ExchangesPageV3 } from '@/components/ui-v3/exchanges/exchanges-page-v3';
import type { Exchange } from '@/components/ui-v3/exchanges/exchanges-page-v3';
import api from '@/lib/api';

export default function ExchangesPage() {
  const router = useRouter();
  const [exchanges, setExchanges] = useState<Exchange[] | undefined>();

  useEffect(() => {
    api.get<Exchange[]>('/exchanges')
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setExchanges(res.data);
        }
      })
      .catch(() => {
        // API 不可用时使用硬编码兜底（组件内置默认值）
      });
  }, []);

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <ExchangesPageV3 exchanges={exchanges} />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileExchangesPage
          onBack={() => router.push('/dashboard')}
          exchanges={exchanges}
        />
      </div>
    </>
  );
}
