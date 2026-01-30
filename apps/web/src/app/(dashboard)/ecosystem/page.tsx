'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { EcosystemPageV3 } from '@/components/ui-v3/ecosystem/ecosystem-page-v3';

export default function EcosystemPage() {
  const queryClient = useQueryClient();

  // 获取质押信息（后续接入时移除下划线前缀）
  const { data: _stakingInfo, isLoading: _isLoading } = useQuery({
    queryKey: ['staking', 'info'],
    queryFn: async () => {
      const response = await api.get<{
        totalStaked: string;
        stakingRecords: Array<{
          id: string;
          amount: string;
          type: string;
          lockDays: number;
          weight: string;
          startDate: string;
          endDate: string;
          status: string;
        }>;
        pendingRewards: string;
        totalRewardsClaimed: string;
      }>('/staking/my');
      return response.data;
    },
  });

  // 质押
  const stakeMutation = useMutation({
    mutationFn: async (data: { amount: number; lockDays: number }) => {
      const response = await api.post('/staking', {
        amount: String(data.amount),
        lockDays: data.lockDays,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staking'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      alert('质押成功');
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : '质押失败');
    },
  });

  // 解除质押
  const unstakeMutation = useMutation({
    mutationFn: async (recordId: string) => {
      const response = await api.post(`/staking/${recordId}/unstake`, {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staking'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      alert('解押成功');
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : '解押失败');
    },
  });

  // 领取奖励
  const claimRewardsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/staking/claim', {});
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staking'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'balance'] });
      alert('奖励领取成功');
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : '领取失败');
    },
  });

  // 后续接入真实数据时移除
  void _stakingInfo;
  void _isLoading;

  return (
    <EcosystemPageV3
      onStake={(amount, periodDays) => stakeMutation.mutate({ amount, lockDays: periodDays })}
      onUnstake={(id) => unstakeMutation.mutate(id)}
      onClaimRewards={() => claimRewardsMutation.mutate()}
      // 传递真实数据
      // stakingInfo={stakingInfo}
      // isLoading={isLoading}
    />
  );
}
