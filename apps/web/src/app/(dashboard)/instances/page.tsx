'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MobileHeader } from '@/components/ui/MobileBackButton';
import { instancesApi, backupsApi, userApi } from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import {
  Server,
  RefreshCw,
  Activity,
  HardDrive,
  Cpu,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  Clock,
  Eye,
  Info,
  Plus,
  RotateCcw,
  Trash2,
  Crown,
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
  const router = useRouter();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showBackupSection, setShowBackupSection] = useState(false);

  // 新增状态
  const [isVip, setIsVip] = useState(false);
  const [showNeedSubscribeModal, setShowNeedSubscribeModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [destroying, setDestroying] = useState(false);
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);

  const fetchData = async (showRefreshFeedback = false) => {
    if (showRefreshFeedback) {
      setRefreshing(true);
    }
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
      if (showRefreshFeedback) {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
    checkVipStatus();
  }, []);

  // 获取 VIP 状态
  const checkVipStatus = async () => {
    try {
      const res = await userApi.getProfile();
      const vipExpiresAt = res.data?.vip_expires_at;
      setIsVip(!!(vipExpiresAt && new Date(vipExpiresAt) > new Date()));
    } catch {
      setIsVip(false);
    }
  };

  // 创建 VPS
  const handleCreate = async () => {
    if (!isVip) {
      setShowNeedSubscribeModal(true);
      return;
    }
    setCreating(true);
    try {
      await instancesApi.create('sgp1');
      fetchData();
      alert('VPS 创建中，请等待 5-8 分钟');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'VPS 创建失败');
    } finally {
      setCreating(false);
    }
  };

  // 重启 VPS
  const handleRestart = async (instanceId: string) => {
    setRestarting(true);
    try {
      await instancesApi.restart(instanceId);
      fetchData();
      alert('VPS 重启中...');
    } catch (error) {
      alert(error instanceof Error ? error.message : '重启失败');
    } finally {
      setRestarting(false);
    }
  };

  // 销毁 VPS
  const handleDestroy = async (instanceId: string) => {
    setDestroying(true);
    try {
      await instancesApi.destroy(instanceId);
      fetchData();
      setShowDestroyConfirm(false);
      alert('VPS 已销毁');
    } catch (error) {
      alert(error instanceof Error ? error.message : '销毁失败');
    } finally {
      setDestroying(false);
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
  const activeInstance = activeInstances[0] || null;

  // 按钮启用/禁用逻辑
  const canCreate = !hasActiveInstance && !creating;
  const canRestart = activeInstance && activeInstance.status === 'running' && !restarting;
  const canDestroy = activeInstance && ['zombie', 'error'].includes(activeInstance.status) && !destroying;

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      <MobileHeader
        title="实例管理"
        rightAction={
          <div className="flex gap-2 items-center">
            {/* 刷新按钮 */}
            <button
              onClick={() => fetchData(true)}
              className="p-2 text-text-secondary"
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* 创建按钮 - 有 VPS 时禁用 */}
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg flex items-center gap-1',
                canCreate
                  ? 'bg-brand-primary text-white'
                  : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              {creating ? '创建中...' : '创建'}
            </button>

            {/* 重启按钮 - 无 VPS 或非 running 时禁用 */}
            <button
              onClick={() => activeInstance && handleRestart(activeInstance.id)}
              disabled={!canRestart}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg flex items-center gap-1',
                canRestart
                  ? 'bg-warning/20 text-warning'
                  : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
              )}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {restarting ? '重启中...' : '重启'}
            </button>

            {/* 销毁按钮 - 无 VPS 或状态正常时禁用（防手贱） */}
            <button
              onClick={() => setShowDestroyConfirm(true)}
              disabled={!canDestroy}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg flex items-center gap-1',
                canDestroy
                  ? 'bg-danger/20 text-danger'
                  : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
              销毁
            </button>
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
          <p className="text-text-secondary text-sm">
            {isVip
              ? '点击右上角「创建」按钮创建 VPS'
              : '完成会员订阅后即可创建专属 VPS'}
          </p>
          {!isVip && (
            <button
              onClick={() => router.push('/subscription')}
              className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-xl"
            >
              <Crown className="w-5 h-5" />
              去订阅
            </button>
          )}
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
                    <span className="text-warning text-xs">心跳超时，等待恢复中</span>
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

      {/* ========== 需要订阅提示弹窗 ========== */}
      {showNeedSubscribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-bg-secondary rounded-2xl p-6">
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-warning/20 rounded-full flex items-center justify-center">
                <Crown className="w-8 h-8 text-warning" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">需要会员订阅</h3>
              <p className="text-text-secondary text-sm">
                完成会员订阅后即可创建 VPS
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNeedSubscribeModal(false)}
                className="flex-1 py-3 bg-bg-tertiary text-white rounded-xl"
              >
                取消
              </button>
              <button
                onClick={() => router.push('/subscription')}
                className="flex-1 py-3 bg-brand-primary text-white rounded-xl"
              >
                去订阅
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 销毁确认弹窗 ========== */}
      {showDestroyConfirm && activeInstance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-bg-secondary rounded-2xl p-6">
            <div className="text-center mb-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-danger/20 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-danger" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">确认销毁 VPS？</h3>
              <p className="text-text-secondary text-sm">
                销毁后数据将自动备份，您可以稍后重新创建
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDestroyConfirm(false)}
                className="flex-1 py-3 bg-bg-tertiary text-white rounded-xl"
              >
                取消
              </button>
              <button
                onClick={() => handleDestroy(activeInstance.id)}
                disabled={destroying}
                className="flex-1 py-3 bg-danger text-white rounded-xl disabled:opacity-50"
              >
                {destroying ? '销毁中...' : '确认销毁'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
