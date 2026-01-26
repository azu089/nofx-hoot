'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Save } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// 返佣类型配置
interface ReferralType {
  key: string;
  label: string;
  returnType: 'points' | 'usdt';
  switchKey: string;
  l1RateKey: string;
  l2RateKey: string;
  defaultL1: number;
  defaultL2: number;
}

const referralTypes: ReferralType[] = [
  { key: 'subscription', label: '订阅费', returnType: 'points', switchKey: 'referral.subscription_enabled', l1RateKey: 'referral.subscription_l1_rate', l2RateKey: 'referral.subscription_l2_rate', defaultL1: 10, defaultL2: 5 },
  { key: 'card_purchase', label: '点卡购买', returnType: 'points', switchKey: 'referral.card_purchase_enabled', l1RateKey: 'referral.card_purchase_l1_rate', l2RateKey: 'referral.card_purchase_l2_rate', defaultL1: 10, defaultL2: 5 },
  { key: 'trade_points', label: '交易挖矿', returnType: 'points', switchKey: 'referral.trade_points_enabled', l1RateKey: 'referral.trade_points_l1_rate', l2RateKey: 'referral.trade_points_l2_rate', defaultL1: 5, defaultL2: 2.5 },
  { key: 'gas_fee', label: '燃油费', returnType: 'usdt', switchKey: 'referral.gas_fee_enabled', l1RateKey: 'referral.gas_fee_l1_rate', l2RateKey: 'referral.gas_fee_l2_rate', defaultL1: 10, defaultL2: 5 },
  { key: 'agent', label: '代理商', returnType: 'usdt', switchKey: 'agent.enabled', l1RateKey: 'agent.level_1_rate', l2RateKey: 'agent.level_2_rate', defaultL1: 10, defaultL2: 5 },
];

interface ConfigItem {
  configKey: string;
  configValue: string | number | boolean;
}

export default function ReferralsPage() {
  const queryClient = useQueryClient();
  const [pendingChanges, setPendingChanges] = useState<Record<string, string | number | boolean>>({});

  // 获取返佣统计
  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'referrals', 'stats'],
    queryFn: () => adminApi.getReferralStats(),
  });
  const stats = statsRes?.data;

  // 获取配置
  const { data: referralConfigsRes } = useQuery({
    queryKey: ['admin', 'configs', 'referral'],
    queryFn: () => adminApi.getConfigs('referral'),
  });
  const { data: agentConfigsRes } = useQuery({
    queryKey: ['admin', 'configs', 'agent'],
    queryFn: () => adminApi.getConfigs('agent'),
  });

  const allConfigs = [...(referralConfigsRes?.data || []), ...(agentConfigsRes?.data || [])];

  // 更新配置
  const updateMutation = useMutation({
    mutationFn: async (changes: Record<string, string | number | boolean>) => {
      const promises = Object.entries(changes).map(([key, value]) =>
        adminApi.updateConfig(key, { value })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('已保存');
      queryClient.invalidateQueries({ queryKey: ['admin', 'configs'] });
      setPendingChanges({});
    },
    onError: () => toast.error('保存失败'),
  });

  // 获取配置值
  const getConfigValue = (key: string, defaultValue: string | number | boolean) => {
    if (pendingChanges[key] !== undefined) return pendingChanges[key];
    const config = allConfigs.find((c: ConfigItem) => c.configKey === key);
    if (!config) return defaultValue;
    if (typeof defaultValue === 'boolean') return config.configValue === 'true' || config.configValue === true;
    if (typeof defaultValue === 'number') return parseFloat(String(config.configValue)) || defaultValue;
    return config.configValue;
  };

  const setConfigValue = (key: string, value: string | number | boolean) => {
    setPendingChanges((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (Object.keys(pendingChanges).length === 0) return;
    updateMutation.mutate(pendingChanges);
  };

  const hasChanges = Object.keys(pendingChanges).length > 0;
  const globalEnabled = getConfigValue('referral.enabled', true) as boolean;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">返佣管理</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['admin', 'referrals'] });
              queryClient.invalidateQueries({ queryKey: ['admin', 'configs'] });
            }}
            className="p-2 text-text-secondary hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-3 py-1.5 bg-brand-primary text-white text-sm rounded hover:bg-brand-secondary transition-colors flex items-center gap-1.5"
            >
              {updateMutation.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              保存
            </button>
          )}
        </div>
      </div>

      {/* 统计数据 - 单行紧凑显示 */}
      <div className="flex items-center gap-6 text-sm">
        <div>
          <span className="text-text-secondary">今日</span>
          <span className="text-white font-medium ml-2">
            {statsLoading ? '-' : parseFloat(stats?.today || '0').toFixed(0)}
          </span>
        </div>
        <div className="w-px h-4 bg-border-primary" />
        <div>
          <span className="text-text-secondary">本月</span>
          <span className="text-white font-medium ml-2">
            {statsLoading ? '-' : parseFloat(stats?.month || '0').toFixed(0)}
          </span>
        </div>
        <div className="w-px h-4 bg-border-primary" />
        <div>
          <span className="text-text-secondary">累计</span>
          <span className="text-white font-medium ml-2">
            {statsLoading ? '-' : parseFloat(stats?.total || '0').toFixed(0)}
          </span>
        </div>
        <div className="w-px h-4 bg-border-primary" />
        <div>
          <span className="text-text-secondary">邀请人</span>
          <span className="text-white font-medium ml-2">
            {statsLoading ? '-' : stats?.activeReferrers || 0}
          </span>
        </div>
      </div>

      {/* 全局开关 */}
      <div className="flex items-center justify-between py-3 border-b border-border-primary">
        <span className="text-white font-medium">全局返佣</span>
        <Switch
          checked={globalEnabled}
          onChange={() => setConfigValue('referral.enabled', !globalEnabled)}
        />
      </div>

      {/* 返佣配置表格 */}
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary text-text-secondary">
              <th className="text-left py-3 px-4 font-medium">类型</th>
              <th className="text-center py-3 px-4 font-medium">返佣币种</th>
              <th className="text-center py-3 px-4 font-medium">一级 %</th>
              <th className="text-center py-3 px-4 font-medium">二级 %</th>
              <th className="text-center py-3 px-4 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {referralTypes.map((type) => {
              const enabled = getConfigValue(type.switchKey, true) as boolean;
              const l1Rate = (getConfigValue(type.l1RateKey, type.defaultL1 / 100) as number) * 100;
              const l2Rate = (getConfigValue(type.l2RateKey, type.defaultL2 / 100) as number) * 100;
              const isDisabled = !globalEnabled;

              return (
                <tr
                  key={type.key}
                  className={cn(
                    'border-b border-border-primary last:border-0',
                    isDisabled && 'opacity-50'
                  )}
                >
                  <td className="py-3 px-4 text-white">{type.label}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs',
                      type.returnType === 'usdt' ? 'bg-warning/10 text-warning' : 'bg-brand-primary/10 text-brand-primary'
                    )}>
                      {type.returnType === 'usdt' ? 'USDT' : '积分'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <input
                      type="number"
                      value={l1Rate}
                      onChange={(e) => setConfigValue(type.l1RateKey, (parseFloat(e.target.value) || 0) / 100)}
                      disabled={isDisabled || !enabled}
                      min={0}
                      max={100}
                      step={0.1}
                      className="w-16 bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-brand-primary disabled:opacity-50"
                    />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <input
                      type="number"
                      value={l2Rate}
                      onChange={(e) => setConfigValue(type.l2RateKey, (parseFloat(e.target.value) || 0) / 100)}
                      disabled={isDisabled || !enabled}
                      min={0}
                      max={100}
                      step={0.1}
                      className="w-16 bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-brand-primary disabled:opacity-50"
                    />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Switch
                      checked={enabled}
                      onChange={() => setConfigValue(type.switchKey, !enabled)}
                      disabled={isDisabled}
                      size="sm"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 代理商最低提现 */}
      <div className="flex items-center justify-between py-3">
        <span className="text-text-secondary text-sm">代理商最低提现</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={getConfigValue('agent.min_withdraw', 50) as number}
            onChange={(e) => setConfigValue('agent.min_withdraw', parseFloat(e.target.value) || 0)}
            disabled={!globalEnabled}
            min={0}
            step={1}
            className="w-20 bg-bg-tertiary border border-border-primary rounded px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-brand-primary disabled:opacity-50"
          />
          <span className="text-text-secondary text-sm">USDT</span>
        </div>
      </div>
    </div>
  );
}

// 极简开关组件
function Switch({
  checked,
  onChange,
  disabled,
  size = 'md',
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const sizes = {
    sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', translate: 'left-4' },
    md: { track: 'w-10 h-5', thumb: 'w-4 h-4', translate: 'left-5' },
  };
  const s = sizes[size];

  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative rounded-full transition-colors',
        s.track,
        checked ? 'bg-success' : 'bg-bg-tertiary',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <div
        className={cn(
          'absolute top-0.5 rounded-full bg-white transition-all',
          s.thumb,
          checked ? s.translate : 'left-0.5'
        )}
      />
    </button>
  );
}
