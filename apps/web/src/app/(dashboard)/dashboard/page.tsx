'use client';

import { useRouter } from 'next/navigation';
import { DashboardV3 } from '@/components/ui-v3/dashboard/dashboard-v3';
import { MobileDashboardV3 } from '@/components/ui-v3/mobile/mobile-dashboard-v3';

// Dashboard 组件内部通过 useHomepageData() 获取市场数据。
// 如需展示用户级统计（余额/PnL/策略数），可使用以下已有后端接口：
//   GET /wallet/balance          — USDT/HOOT 余额
//   GET /trading/positions/pnl-stats — 今日/周/月收益
//   GET /health/stats            — 平台统计（用户数、策略数、持仓数）
// 届时需扩展 DashboardV3Props 以接收这些数据。

export default function DashboardPage() {
  const router = useRouter();

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:block">
        <DashboardV3 onNavigate={handleNavigate} />
      </div>

      {/* 移动端 */}
      <div className="block md:hidden">
        <MobileDashboardV3 onNavigate={handleNavigate} />
      </div>
    </>
  );
}
