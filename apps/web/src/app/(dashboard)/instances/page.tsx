'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MobileHeader } from '@/components/ui/MobileBackButton';
import { instancesApi, backupsApi, gamefiApi } from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';
import {
  Server,
  RefreshCw,
  Activity,
  HardDrive,
  Cpu,
  AlertCircle,
  X,
  Coins,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  Clock,
  CreditCard,
  Eye,
  Info,
} from 'lucide-react';

interface Instance {
  id: string;
  status: string;
  ip_address: string;
  region: string;
  cpu_usage: string | null;
  memory_usage: string | null;
  last_heartbeat: string | null;
}

interface Backup {
  id: string;
  instanceId: string;
  s3Key: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
}

const SUBSCRIPTION_FEE = 25;

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [usePoints, setUsePoints] = useState(true);
  const [pointsBalance, setPointsBalance] = useState('0');
  const [showHelp, setShowHelp] = useState(false);
  const [showBackupSection, setShowBackupSection] = useState(false);

  const fetchData = async () => {
    try {
      const [instancesRes, backupsRes] = await Promise.all([
        instancesApi.list(),
        backupsApi.list(),
      ]);
      setInstances(instancesRes.data || []);
      setBackups(backupsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openSubscribeModal = async () => {
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
    try {
      await instancesApi.subscribe('sgp1', usePoints);
      setShowSubscribeModal(false);
      fetchData();
      alert('订阅成功，VPS 已自动创建');
    } catch (error) {
      alert(error instanceof Error ? error.message : '订阅失败');
    } finally {
      setSubscribing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      running: 'bg-success/20 text-success',
      provisioning: 'bg-warning/20 text-warning',
      stopped: 'bg-bg-tertiary text-text-secondary',
      destroyed: 'bg-danger/20 text-danger',
      zombie: 'bg-warning/20 text-warning',
      error: 'bg-danger/20 text-danger',
    };
    const labels: Record<string, string> = {
      running: '运行中',
      provisioning: '创建中',
      stopped: '已停止',
      destroyed: '已销毁',
      zombie: '僵尸节点',
      error: '错误',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${styles[status] || styles.error}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <MobileHeader title="实例管理" />
        <div className="px-4 pt-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-bg-secondary rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const activeInstances = instances.filter((i) => i.status !== 'destroyed');
  const hasActiveInstance = activeInstances.length > 0;

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <MobileHeader
        title="实例管理"
        rightAction={
          <div className="flex gap-2">
            <button onClick={fetchData} className="p-2 text-text-secondary">
              <RefreshCw className="w-4 h-4" />
            </button>
            {!hasActiveInstance && (
              <button
                onClick={openSubscribeModal}
                className="px-3 py-1.5 bg-brand-primary text-white text-sm rounded-lg"
              >
                购买
              </button>
            )}
          </div>
        }
      />

      {/* ========== VPS 实例列表 ========== */}
      {activeInstances.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-bg-secondary rounded-full flex items-center justify-center">
            <Server className="w-10 h-10 text-text-tertiary" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">暂无 VPS 实例</h3>
          <p className="text-text-secondary text-sm mb-6">购买订阅后，系统将自动为您创建专属 VPS</p>
          <button
            onClick={openSubscribeModal}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-xl"
          >
            <CreditCard className="w-5 h-5" />
            购买订阅
          </button>
        </div>
      ) : (
        <div className="space-y-px">
          {activeInstances.map((instance) => (
            <div key={instance.id} className="bg-bg-secondary">
              <div className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center',
                      instance.status === 'running' ? 'bg-success/20' : 'bg-bg-tertiary'
                    )}>
                      <Server className={cn(
                        'w-6 h-6',
                        instance.status === 'running' ? 'text-success' : 'text-text-tertiary'
                      )} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">
                          {instance.ip_address || '分配中...'}
                        </span>
                        {getStatusBadge(instance.status)}
                      </div>
                      <p className="text-text-tertiary text-xs mt-0.5">
                        {instance.region} · ID: {instance.id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <a
                    href={`/instances/${instance.id}`}
                    className="p-2 bg-bg-tertiary rounded-lg text-text-secondary"
                  >
                    <Eye className="w-5 h-5" />
                  </a>
                </div>

                {/* 运行中显示资源使用 */}
                {instance.status === 'running' && (instance.cpu_usage || instance.memory_usage) && (
                  <div className="mt-3 pt-3 border-t border-border-primary flex gap-6">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-text-tertiary" />
                      <span className="text-text-secondary text-sm">CPU</span>
                      <span className="text-white text-sm">{instance.cpu_usage || '-'}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-text-tertiary" />
                      <span className="text-text-secondary text-sm">内存</span>
                      <span className="text-white text-sm">{instance.memory_usage || '-'}%</span>
                    </div>
                  </div>
                )}

                {/* 状态提示 */}
                {instance.status === 'zombie' && (
                  <div className="mt-3 p-3 bg-warning/10 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-warning" />
                    <span className="text-warning text-xs">超过 15 分钟无心跳，将被自动销毁</span>
                  </div>
                )}
                {instance.status === 'provisioning' && (
                  <div className="mt-3 p-3 bg-brand-primary/10 rounded-lg flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-brand-primary animate-spin" />
                    <span className="text-brand-primary text-xs">VPS 正在创建中，请稍候...</span>
                  </div>
                )}
                {instance.status === 'error' && (
                  <div className="mt-3 p-3 bg-danger/10 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-danger" />
                      <span className="text-danger text-xs font-medium">VPS 创建失败</span>
                    </div>
                    <p className="text-danger/70 text-xs mt-1">请联系客服处理，订阅费用不会被扣除</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========== 备份记录 - 可收起 ========== */}
      <div className="px-4 mt-6">
        <button
          onClick={() => setShowBackupSection(!showBackupSection)}
          className="flex items-center justify-between w-full py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-brand-primary" />
            <span className="text-sm text-white">备份记录</span>
            {backups.length > 0 && (
              <span className="text-text-tertiary text-xs">({backups.length})</span>
            )}
          </div>
          {showBackupSection ? (
            <ChevronUp className="w-4 h-4 text-text-tertiary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-tertiary" />
          )}
        </button>

        {showBackupSection && (
          <div className="pb-4">
            {backups.length === 0 ? (
              <div className="py-8 text-center">
                <HardDrive className="w-10 h-10 mx-auto mb-2 text-text-tertiary/30" />
                <p className="text-text-tertiary text-xs">暂无备份记录</p>
                <p className="text-text-tertiary/70 text-xs mt-1">VPS 销毁时系统会自动备份</p>
              </div>
            ) : (
              <div className="space-y-2">
                {backups.slice(0, 10).map((backup) => (
                  <div key={backup.id} className="flex items-center justify-between p-3 bg-bg-secondary rounded-xl">
                    <div>
                      <p className="text-white text-sm">实例: {backup.instanceId.slice(0, 8)}...</p>
                      <p className="text-text-tertiary text-xs">
                        {formatDateTime(backup.createdAt)} · {(backup.sizeBytes / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs',
                      backup.status === 'completed' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                    )}>
                      {backup.status === 'completed' ? '已完成' : backup.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========== VPS 说明 - 可收起 ========== */}
      <div className="px-4">
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="flex items-center justify-between w-full py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-warning" />
            <span className="text-sm text-text-secondary">VPS 说明</span>
          </div>
          {showHelp ? (
            <ChevronUp className="w-4 h-4 text-text-tertiary" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-tertiary" />
          )}
        </button>

        {showHelp && (
          <div className="pb-4 space-y-3 text-xs text-text-tertiary">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-warning" />
              <span>订阅后自动开启，无需手动操作</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-brand-primary" />
              <span>仅查看权限，VPS 由系统自动管理</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-success" />
              <span>独立隔离，安全运行</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-text-tertiary" />
              <span>到期自动销毁并备份数据</span>
            </div>
            <p className="pt-2 border-t border-border-primary">
              订阅费 {SUBSCRIPTION_FEE} USDT/月，可用积分抵扣
            </p>
          </div>
        )}
      </div>

      {/* ========== 购买订阅弹窗 ========== */}
      {showSubscribeModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
          <div className="w-full max-w-lg bg-bg-secondary rounded-t-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between px-4 py-4 border-b border-border-primary">
              <h3 className="text-lg font-medium text-white">购买 VPS 订阅</h3>
              <button onClick={() => setShowSubscribeModal(false)} className="p-1 text-text-tertiary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="p-3 bg-brand-primary/10 rounded-xl">
                <p className="text-brand-primary text-sm">
                  购买后系统将自动创建专属 VPS，到期后自动销毁并备份数据
                </p>
              </div>

              <div className="p-4 bg-bg-tertiary rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-text-secondary text-sm">订阅费用</span>
                  <span className="text-white font-medium">{SUBSCRIPTION_FEE} USDT/月</span>
                </div>
                <p className="text-text-tertiary text-xs">首月订阅费将从您的账户扣除</p>
              </div>

              <div className="p-4 bg-bg-tertiary rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="w-4 h-4 text-warning" />
                  <span className="text-text-secondary text-sm">积分余额</span>
                  <span className="text-warning font-medium ml-auto">
                    {parseFloat(pointsBalance).toFixed(2)} 积分
                  </span>
                </div>
                <p className="text-text-tertiary text-xs">1 积分 = 1 USDT，可用于抵扣订阅费</p>
              </div>

              <label className="flex items-center gap-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePoints}
                  onChange={(e) => setUsePoints(e.target.checked)}
                  className="w-5 h-5 rounded border-border-secondary bg-bg-tertiary text-brand-primary"
                />
                <span className="text-white text-sm">使用积分抵扣</span>
              </label>

              {usePoints && parseFloat(pointsBalance) > 0 && (
                <div className="p-4 bg-brand-primary/10 rounded-xl">
                  <h4 className="text-brand-primary text-sm font-medium mb-2">费用明细</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">订阅费用</span>
                      <span className="text-white">{SUBSCRIPTION_FEE} USDT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">积分抵扣</span>
                      <span className="text-warning">
                        -{Math.min(parseFloat(pointsBalance), SUBSCRIPTION_FEE).toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="border-t border-brand-primary/20 my-2"></div>
                    <div className="flex justify-between font-medium">
                      <span className="text-text-secondary">实际支付</span>
                      <span className="text-success">
                        {Math.max(SUBSCRIPTION_FEE - parseFloat(pointsBalance), 0).toFixed(2)} USDT
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-4 py-4 pb-8 border-t border-border-primary">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSubscribeModal(false)}
                  className="flex-1 py-3 bg-bg-tertiary text-white rounded-xl"
                >
                  取消
                </button>
                <button
                  onClick={handleSubscribe}
                  disabled={subscribing}
                  className="flex-1 py-3 bg-brand-primary text-white rounded-xl disabled:opacity-50"
                >
                  {subscribing ? '订阅中...' : '确认订阅'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
