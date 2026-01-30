'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DashboardV3 } from '@/components/ui-v3/dashboard/dashboard-v3';

interface DashboardData {
  totalAssets: string;
  todayPnl: string;
  todayPnlPercent: string;
  activeStrategies: number;
  totalTrades: number;
  winRate: string;
  usdtBalance: string;
  hootBalance: string;
}

export default function DashboardPage() {
  const router = useRouter();

  // 获取仪表盘数据
  const { data: _data, isLoading: _isLoading, error: _error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get<DashboardData>('/dashboard');
      return response.data;
    },
  });

  // 获取余额
  const { data: _balance } = useQuery({
    queryKey: ['wallet', 'balance'],
    queryFn: async () => {
      const response = await api.get<{ usdt: string; hoot: string }>('/wallet/balance');
      return response.data;
    },
  });

  // 后续接入真实数据时移除下划线前缀
  void _data;
  void _isLoading;
  void _error;
  void _balance;

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  return (
    <DashboardV3
      onNavigate={handleNavigate}
      // 传递真实数据（如果后端有对应接口）
      // data={data}
      // balance={balance}
      // isLoading={isLoading}
    />
  );
}
