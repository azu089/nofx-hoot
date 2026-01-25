'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Gift,
  RefreshCw,
  Check,
  Users,
  DollarSign,
  TrendingUp,
  Coins,
  Zap,
  Wallet,
  Fuel,
  Building2,
  ToggleLeft,
  ToggleRight,
  Save,
} from 'lucide-react';
import { adminApi } from '@/lib/api';
import { toast } from 'sonner';

// 返佣类型配置
interface ReferralTypeConfig {
  key: string;
  label: string;
  description: string;
  icon: typeof Gift;
  returnType: 'points' | 'usdt';
  switchKey: string;
  l1RateKey: string;
  l2RateKey: string;
  defaultL1: number;
  defaultL2: number;
}

const referralTypes: ReferralTypeConfig[] = [
  {
    key: 'subscription',
    label: '订阅费返佣',
    description: '被邀请人订阅 VPS 时，邀请人获得积分返佣',
    icon: Zap,
    returnType: 'points',
    switchKey: 'referral.subscription_enabled',
    l1RateKey: 'referral.subscription_l1_rate',
    l2RateKey: 'referral.subscription_l2_rate',
    defaultL1: 10,
    defaultL2: 5,
  },
  {
    key: 'card_purchase',
    label: '点卡购买返佣',
    description: '被邀请人购买点卡时，邀请人获得积分返佣',
    icon: Wallet,
    returnType: 'points',
    switchKey: 'referral.card_purchase_enabled',
    l1RateKey: 'referral.card_purchase_l1_rate',
    l2RateKey: 'referral.card_purchase_l2_rate',
    defaultL1: 10,
    defaultL2: 5,
  },
  {
    key: 'trade_points',
    label: '交易挖矿返佣',
    description: '被邀请人交易挖矿获得积分时，邀请人获得积分返佣',
    icon: Coins,
    returnType: 'points',
    switchKey: 'referral.trade_points_enabled',
    l1RateKey: 'referral.trade_points_l1_rate',
    l2RateKey: 'referral.trade_points_l2_rate',
    defaultL1: 5,
    defaultL2: 2.5,
  },
  {
    key: 'gas_fee',
    label: '燃油费返佣',
    description: '被邀请人盈利扣燃油费时，邀请人获得 USDT 返佣',
    icon: Fuel,
    returnType: 'usdt',
    switchKey: 'referral.gas_fee_enabled',
    l1RateKey: 'referral.gas_fee_l1_rate',
    l2RateKey: 'referral.gas_fee_l2_rate',
    defaultL1: 10,
    defaultL2: 5,
  },
];

const agentConfig: ReferralTypeConfig = {
  key: 'agent',
  label: '代理商返佣',
  description: '下级用户消费时，代理商获得 USDT 返佣',
  icon: Building2,
  returnType: 'usdt',
  switchKey: 'agent.enabled',
  l1RateKey: 'agent.level_1_rate',
  l2RateKey: 'agent.level_2_rate',
  defaultL1: 10,
  defaultL2: 5,
};

interface ConfigItem {
  configKey: string;
  configValue: string | number | boolean;
  configType: string;
  category: string;
  label: string;
  description?: string;
  isPublic: boolean;
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

  // 获取返佣配置
  const { data: referralConfigsRes, isLoading: referralLoading } = useQuery({
    queryKey: ['admin', 'configs', 'referral'],
    queryFn: () => adminApi.getConfigs('referral'),
  });
  const referralConfigs = referralConfigsRes?.data || [];

  // 获取代理商配置
  const { data: agentConfigsRes, isLoading: agentLoading } = useQuery({
    queryKey: ['admin', 'configs', 'agent'],
    queryFn: () => adminApi.getConfigs('agent'),
  });
  const agentConfigs = agentConfigsRes?.data || [];

  const allConfigs = [...referralConfigs, ...agentConfigs];

  // 更新配置
  const updateMutation = useMutation({
    mutationFn: async (changes: Record<string, string | number | boolean>) => {
      const promises = Object.entries(changes).map(([key, value]) =>
        adminApi.updateConfig(key, { value })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('配置已保存');
      queryClient.invalidateQueries({ queryKey: ['admin', 'configs'] });
      setPendingChanges({});
    },
    onError: () => {
      toast.error('保存失败');
    },
  });

  // 获取配置值
  const getConfigValue = (key: string, defaultValue: string | number | boolean) => {
    if (pendingChanges[key] !== undefined) {
      return pendingChanges[key];
    }
    const config = allConfigs.find((c: ConfigItem) => c.configKey === key);
    if (!config) return defaultValue;

    // 处理布尔值
    if (typeof defaultValue === 'boolean') {
      return config.configValue === 'true' || config.configValue === true;
    }
    // 处理数字
    if (typeof defaultValue === 'number') {
      return parseFloat(String(config.configValue)) || defaultValue;
    }
    return config.configValue;
  };

  // 设置配置值（暂存）
  const setConfigValue = (key: string, value: string | number | boolean) => {
    setPendingChanges((prev) => ({ ...prev, [key]: value }));
  };

  // 保存所有更改
  const handleSave = () => {
    if (Object.keys(pendingChanges).length === 0) {
      toast.info('没有需要保存的更改');
      return;
    }
    updateMutation.mutate(pendingChanges);
  };

  const isLoading = statsLoading || referralLoading || agentLoading;
  const hasChanges = Object.keys(pendingChanges).length > 0;

  // 全局返佣开关
  const globalEnabled = getConfigValue('referral.enabled', true) as boolean;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gift className="w-6 h-6" />
            返佣管理中心
          </h1>
          <p className="text-text-secondary mt-1">管理返佣开关和比例配置</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['admin', 'referrals'] });
              queryClient.invalidateQueries({ queryKey: ['admin', 'configs'] });
            }}
            className="px-4 py-2 bg-bg-tertiary text-white rounded-lg hover:bg-bg-tertiary/80 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              hasChanges
                ? 'bg-brand-primary text-white hover:bg-brand-secondary'
                : 'bg-bg-tertiary text-text-secondary cursor-not-allowed'
            }`}
          >
            {updateMutation.isPending ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            保存更改
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="今日返佣"
          value={stats?.today || '0'}
          unit="积分"
          loading={statsLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="本月返佣"
          value={stats?.month || '0'}
          unit="积分"
          loading={statsLoading}
        />
        <StatCard
          icon={Coins}
          label="累计返佣"
          value={stats?.total || '0'}
          unit="积分"
          loading={statsLoading}
        />
        <StatCard
          icon={Users}
          label="活跃邀请人"
          value={stats?.activeReferrers || 0}
          unit="人"
          loading={statsLoading}
        />
      </div>

      {/* 全局开关 */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-primary/20 flex items-center justify-center">
              <Gift className="w-6 h-6 text-brand-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">全局返佣开关</h3>
              <p className="text-text-secondary text-sm">关闭后所有返佣停止发放</p>
            </div>
          </div>
          <button
            onClick={() => setConfigValue('referral.enabled', !globalEnabled)}
            className={`relative w-14 h-8 rounded-full transition-colors ${
              globalEnabled ? 'bg-success' : 'bg-bg-tertiary'
            }`}
          >
            <div
              className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${
                globalEnabled ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 用户邀请返佣配置 */}
      <div className="glass-card">
        <div className="p-6 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            用户邀请返佣配置
          </h2>
        </div>
        <div className="divide-y divide-border-primary">
          {referralTypes.map((type) => (
            <ReferralTypeCard
              key={type.key}
              config={type}
              enabled={getConfigValue(type.switchKey, true) as boolean}
              l1Rate={(getConfigValue(type.l1RateKey, type.defaultL1 / 100) as number) * 100}
              l2Rate={(getConfigValue(type.l2RateKey, type.defaultL2 / 100) as number) * 100}
              onToggle={() =>
                setConfigValue(type.switchKey, !(getConfigValue(type.switchKey, true) as boolean))
              }
              onL1Change={(v) => setConfigValue(type.l1RateKey, v / 100)}
              onL2Change={(v) => setConfigValue(type.l2RateKey, v / 100)}
              disabled={!globalEnabled}
            />
          ))}
        </div>
      </div>

      {/* 代理商返佣配置 */}
      <div className="glass-card">
        <div className="p-6 border-b border-border-primary">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            代理商返佣配置
          </h2>
        </div>
        <div className="p-6">
          <ReferralTypeCard
            config={agentConfig}
            enabled={getConfigValue(agentConfig.switchKey, true) as boolean}
            l1Rate={(getConfigValue(agentConfig.l1RateKey, agentConfig.defaultL1 / 100) as number) * 100}
            l2Rate={(getConfigValue(agentConfig.l2RateKey, agentConfig.defaultL2 / 100) as number) * 100}
            onToggle={() =>
              setConfigValue(agentConfig.switchKey, !(getConfigValue(agentConfig.switchKey, true) as boolean))
            }
            onL1Change={(v) => setConfigValue(agentConfig.l1RateKey, v / 100)}
            onL2Change={(v) => setConfigValue(agentConfig.l2RateKey, v / 100)}
            disabled={!globalEnabled}
            showMinWithdraw
            minWithdraw={getConfigValue('agent.min_withdraw', 50) as number}
            onMinWithdrawChange={(v) => setConfigValue('agent.min_withdraw', v)}
          />
        </div>
      </div>
    </div>
  );
}

// 统计卡片组件
function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  loading,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string | number;
  unit: string;
  loading?: boolean;
}) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-brand-primary/20 flex items-center justify-center">
          <Icon className="w-6 h-6 text-brand-primary" />
        </div>
        <div>
          <p className="text-text-secondary text-sm">{label}</p>
          {loading ? (
            <div className="h-7 w-20 bg-bg-tertiary animate-pulse rounded mt-1" />
          ) : (
            <p className="text-xl font-bold text-white">
              {typeof value === 'number' ? value.toLocaleString() : parseFloat(value).toFixed(2)}
              <span className="text-text-secondary text-sm ml-1">{unit}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// 返佣类型配置卡片
function ReferralTypeCard({
  config,
  enabled,
  l1Rate,
  l2Rate,
  onToggle,
  onL1Change,
  onL2Change,
  disabled,
  showMinWithdraw,
  minWithdraw,
  onMinWithdrawChange,
}: {
  config: ReferralTypeConfig;
  enabled: boolean;
  l1Rate: number;
  l2Rate: number;
  onToggle: () => void;
  onL1Change: (v: number) => void;
  onL2Change: (v: number) => void;
  disabled?: boolean;
  showMinWithdraw?: boolean;
  minWithdraw?: number;
  onMinWithdrawChange?: (v: number) => void;
}) {
  const Icon = config.icon;

  return (
    <div className={`p-6 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              enabled ? 'bg-success/20' : 'bg-bg-tertiary'
            }`}
          >
            <Icon className={`w-5 h-5 ${enabled ? 'text-success' : 'text-text-secondary'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-medium">{config.label}</h3>
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  config.returnType === 'usdt'
                    ? 'bg-warning/10 text-warning'
                    : 'bg-brand-primary/10 text-brand-primary'
                }`}
              >
                返 {config.returnType === 'usdt' ? 'USDT' : '积分'}
              </span>
            </div>
            <p className="text-text-secondary text-sm mt-1">{config.description}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          disabled={disabled}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            enabled ? 'bg-success' : 'bg-bg-tertiary'
          } ${disabled ? 'cursor-not-allowed' : ''}`}
        >
          <div
            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
              enabled ? 'left-7' : 'left-1'
            }`}
          />
        </button>
      </div>

      {/* 比例配置 */}
      <div className="mt-4 pl-14 grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="text-text-secondary text-sm block mb-1">一级返佣</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={l1Rate}
              onChange={(e) => onL1Change(parseFloat(e.target.value) || 0)}
              disabled={disabled || !enabled}
              min={0}
              max={100}
              step={0.1}
              className="w-20 bg-bg-tertiary border border-border-primary rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-brand-primary disabled:opacity-50"
            />
            <span className="text-text-secondary">%</span>
          </div>
        </div>
        <div>
          <label className="text-text-secondary text-sm block mb-1">二级返佣</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={l2Rate}
              onChange={(e) => onL2Change(parseFloat(e.target.value) || 0)}
              disabled={disabled || !enabled}
              min={0}
              max={100}
              step={0.1}
              className="w-20 bg-bg-tertiary border border-border-primary rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-brand-primary disabled:opacity-50"
            />
            <span className="text-text-secondary">%</span>
          </div>
        </div>
        {showMinWithdraw && onMinWithdrawChange && (
          <div>
            <label className="text-text-secondary text-sm block mb-1">最低提现</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={minWithdraw}
                onChange={(e) => onMinWithdrawChange(parseFloat(e.target.value) || 0)}
                disabled={disabled || !enabled}
                min={0}
                step={1}
                className="w-20 bg-bg-tertiary border border-border-primary rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-brand-primary disabled:opacity-50"
              />
              <span className="text-text-secondary">U</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
