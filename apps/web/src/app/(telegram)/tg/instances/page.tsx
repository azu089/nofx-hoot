'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { instancesApi, gamefiApi } from '@/lib/api';
import {
  Server,
  RefreshCw,
  Activity,
  Cpu,
  HardDrive,
  AlertCircle,
  Plus,
  ChevronRight,
  Clock,
  Zap,
  Coins,
  X,
} from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh';

interface Instance {
  id: string;
  status: string;
  ip_address: string;
  region: string;
  cpu_usage: string | null;
  memory_usage: string | null;
  last_heartbeat: string | null;
}

const SUBSCRIPTION_FEE = 25;

export default function TgInstancesPage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [usePoints, setUsePoints] = useState(true);
  const [pointsBalance, setPointsBalance] = useState('0');

  const fetchData = async () => {
    try {
      const res = await instancesApi.list();
      setInstances(res.data || []);
    } catch (error) {
      console.error('Failed to fetch instances:', error);
    } finally {
      setLoading(false);
    }
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      haptic('impact_light');
      await fetchData();
      haptic('notification_success');
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const openSubscribeModal = async () => {
    haptic('impact_medium');
    setShowSubscribeModal(true);
    try {
      const res = await gamefiApi.getPointsBalance();
      setPointsBalance(res.data?.available || '0');
    } catch {
      setPointsBalance('0');
    }
  };

  const handleSubscribe = async () => {
    setSubscribing(true);
    haptic('impact_medium');
    try {
      await instancesApi.subscribe('sgp1', usePoints);
      setShowSubscribeModal(false);
      await fetchData();
      haptic('notification_success');
      alert('订阅成功，VPS 已自动创建');
    } catch (error) {
      haptic('notification_error');
      alert(error instanceof Error ? error.message : '订阅失败');
    } finally {
      setSubscribing(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; bg: string; label: string }> = {
      running: { color: 'text-success', bg: 'bg-success/20', label: '运行中' },
      provisioning: { color: 'text-warning', bg: 'bg-warning/20', label: '创建中' },
      stopped: { color: 'text-text-secondary', bg: 'bg-bg-tertiary', label: '已停止' },
      destroyed: { color: 'text-danger', bg: 'bg-danger/20', label: '已销毁' },
      zombie: { color: 'text-warning', bg: 'bg-warning/20', label: '僵尸节点' },
      error: { color: 'text-danger', bg: 'bg-danger/20', label: '错误' },
    };
    return configs[status] || configs.error;
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-bg-tertiary/50 rounded-lg w-32" />
        <div className="h-24 bg-bg-tertiary/50 rounded-xl" />
        {[1, 2].map((i) => (
          <div key={i} className="h-28 bg-bg-tertiary/50 rounded-xl" />
        ))}
      </div>
    );
  }

  const activeInstances = instances.filter((i) => i.status !== 'destroyed');
  const hasActiveInstance = activeInstances.length > 0;

  return (
    <>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="space-y-4 pb-24">
        {/* 顶部 */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium text-white">实例管理</h1>
          <button onClick={fetchData} className="p-2 text-text-secondary">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* 订阅入口 */}
        {!hasActiveInstance && (
          <div className="bg-gradient-to-r from-brand-primary/20 to-brand-secondary/20 border border-brand-primary/30 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center">
                <Server className="w-5 h-5 text-brand-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-medium">开通专属 VPS</h3>
                <p className="text-text-tertiary text-xs">独立云服务器，7x24 稳定运行</p>
              </div>
            </div>
            <div className="flex items-center justify-between mb-3 p-2 bg-bg-tertiary/50 rounded-lg">
              <span className="text-text-secondary text-sm">月费</span>
              <span className="text-warning font-bold">${SUBSCRIPTION_FEE}/月</span>
            </div>
            <button
              onClick={openSubscribeModal}
              className="w-full py-3 bg-brand-primary text-white font-medium rounded-lg flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              立即开通
            </button>
          </div>
        )}

        {/* 实例列表 */}
        {hasActiveInstance ? (
          <div className="space-y-3">
            <h3 className="text-white font-medium">我的实例</h3>
            {activeInstances.map((instance) => {
              const statusConfig = getStatusConfig(instance.status);
              const cpuUsage = parseFloat(instance.cpu_usage || '0');
              const memUsage = parseFloat(instance.memory_usage || '0');

              return (
                <Link
                  key={instance.id}
                  href={`/tg/instances/${instance.id}`}
                  onClick={() => haptic('selection')}
                  className="block bg-bg-secondary border border-border-primary rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full ${statusConfig.bg} flex items-center justify-center`}>
                        <Server className={`w-5 h-5 ${statusConfig.color}`} />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">
                          {instance.ip_address || '分配中...'}
                        </p>
                        <p className="text-text-tertiary text-xs">{instance.region}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${statusConfig.bg} ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-text-tertiary" />
                    </div>
                  </div>

                  {/* 资源使用 */}
                  {instance.status === 'running' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-brand-primary" />
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-text-tertiary">CPU</span>
                            <span className="text-white">{cpuUsage.toFixed(0)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-bg-tertiary rounded-full">
                            <div
                              className="h-full bg-brand-primary rounded-full"
                              style={{ width: `${Math.min(cpuUsage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-success" />
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-text-tertiary">内存</span>
                            <span className="text-white">{memUsage.toFixed(0)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-bg-tertiary rounded-full">
                            <div
                              className="h-full bg-success rounded-full"
                              style={{ width: `${Math.min(memUsage, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 心跳状态 */}
                  {instance.last_heartbeat && (
                    <div className="mt-3 pt-3 border-t border-border-primary flex items-center gap-2 text-xs text-text-tertiary">
                      <Activity className="w-3 h-3" />
                      <span>最后心跳: {new Date(instance.last_heartbeat).toLocaleTimeString('zh-CN')}</span>
                    </div>
                  )}
                </Link>
              );
            })}

            {/* 新增实例按钮 */}
            <button
              onClick={openSubscribeModal}
              className="w-full py-3 bg-bg-secondary border border-border-primary rounded-xl flex items-center justify-center gap-2 text-text-secondary"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">新增实例</span>
            </button>
          </div>
        ) : (
          <div className="py-8 text-center">
            <Server className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
            <p className="text-text-secondary">暂无实例</p>
            <p className="text-text-tertiary text-xs mt-1">开通 VPS 后可运行策略</p>
          </div>
        )}

        {/* 帮助说明 */}
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
          <h4 className="text-white font-medium text-sm mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-brand-primary" />
            什么是 VPS？
          </h4>
          <ul className="text-text-tertiary text-xs space-y-1">
            <li>• 专属云服务器，7x24 小时稳定运行</li>
            <li>• 支持多策略并行运行</li>
            <li>• 自动备份，数据安全</li>
            <li>• 15 分钟无心跳自动销毁退款</li>
          </ul>
        </div>
      </div>

      {/* 订阅弹窗 */}
      {showSubscribeModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setShowSubscribeModal(false)}
        >
          <div
            className="w-full bg-bg-secondary rounded-t-2xl p-6 pb-10 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">开通 VPS 服务</h3>
              <button
                onClick={() => { setShowSubscribeModal(false); haptic('selection'); }}
                className="p-1 text-text-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 费用说明 */}
            <div className="p-4 bg-bg-tertiary rounded-xl mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-secondary">月费</span>
                <span className="text-2xl font-bold text-warning">${SUBSCRIPTION_FEE}</span>
              </div>
              <p className="text-text-tertiary text-xs">包含独立 VPS + 自动备份 + 技术支持</p>
            </div>

            {/* 支付方式 */}
            <div className="space-y-2 mb-4">
              <p className="text-sm text-text-secondary">支付方式</p>
              <button
                onClick={() => { setUsePoints(true); haptic('selection'); }}
                className={`w-full p-3 rounded-xl border flex items-center justify-between ${
                  usePoints ? 'border-brand-primary bg-brand-primary/10' : 'border-border-primary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Coins className="w-5 h-5 text-warning" />
                  <div className="text-left">
                    <p className="text-white text-sm">积分抵扣</p>
                    <p className="text-text-tertiary text-xs">
                      余额: {parseFloat(pointsBalance).toLocaleString()} 积分
                    </p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  usePoints ? 'border-brand-primary bg-brand-primary' : 'border-text-tertiary'
                }`}>
                  {usePoints && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
              <button
                onClick={() => { setUsePoints(false); haptic('selection'); }}
                className={`w-full p-3 rounded-xl border flex items-center justify-between ${
                  !usePoints ? 'border-brand-primary bg-brand-primary/10' : 'border-border-primary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-brand-primary" />
                  <div className="text-left">
                    <p className="text-white text-sm">USDT 支付</p>
                    <p className="text-text-tertiary text-xs">从钱包余额扣除</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  !usePoints ? 'border-brand-primary bg-brand-primary' : 'border-text-tertiary'
                }`}>
                  {!usePoints && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </button>
            </div>

            <button
              onClick={handleSubscribe}
              disabled={subscribing}
              className="w-full py-4 bg-brand-primary text-white font-medium rounded-xl disabled:opacity-50"
            >
              {subscribing ? '开通中...' : '确认开通'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
