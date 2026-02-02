'use client';

import { useRouter } from 'next/navigation';
// import { useQuery } from '@tanstack/react-query';
// import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { DashboardV3 } from '@/components/ui-v3/dashboard/dashboard-v3';
import { MobileDashboardV3 } from '@/components/ui-v3/mobile/mobile-dashboard-v3';

// TODO: 后端实现 /dashboard 接口后启用
// interface DashboardData {
//   totalAssets: string;
//   todayPnl: string;
//   todayPnlPercent: string;
//   activeStrategies: number;
//   totalTrades: number;
//   winRate: string;
//   usdtBalance: string;
//   hootBalance: string;
// }

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // TODO: 后端实现 /dashboard 接口后启用
  // const { data, isLoading, error } = useQuery({
  //   queryKey: ['dashboard'],
  //   queryFn: async () => {
  //     const response = await api.get<DashboardData>('/dashboard');
  //     return response.data;
  //   },
  //   enabled: isAuthenticated,
  //   retry: false,
  // });

  // TODO: 后端实现后启用
  // const { data: balance } = useQuery({
  //   queryKey: ['wallet', 'balance'],
  //   queryFn: async () => {
  //     const response = await api.get<{ usdt: string; hoot: string }>('/wallet/balance');
  //     return response.data;
  //   },
  //   enabled: isAuthenticated,
  //   retry: false,
  // });

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
