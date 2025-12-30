'use client';

import { useEffect, useState } from 'react';
import type { Metadata } from 'next';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';

// Metadata for this page (will be defined in layout or parent server component)
// export const metadata: Metadata = {
//   title: 'VPS 实例 | QuantFi',
//   description: '管理您的 VPS 实例，监控运行状态、查看资源使用和备份记录',
// };
import { instancesApi, backupsApi, gamefiApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import {
  Server,
  Plus,
  Trash2,
  RefreshCw,
  Power,
  Activity,
  HardDrive,
  Cpu,
  AlertCircle,
  X,
  Coins,
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

const SUBSCRIPTION_FEE = 25; // 订阅费 25 USDT

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // 创建对话框状态
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [usePoints, setUsePoints] = useState(true);
  const [pointsBalance, setPointsBalance] = useState('0');

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

  // 打开创建对话框
  const openCreateModal = async () => {
    setShowCreateModal(true);
    try {
      const res = await gamefiApi.getPointsBalance();
      setPointsBalance(res.data?.available || '0');
    } catch {
      setPointsBalance('0');
    }
  };

  // 确认创建实例
  const handleCreate = async () => {
    setCreating(true);
    try {
      await instancesApi.create('sgp1', usePoints);
      setShowCreateModal(false);
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDestroy = async (id: string) => {
    if (!confirm('确定要销毁此实例吗？销毁前会自动备份数据。')) return;

    setActionLoading(id);
    try {
      await instancesApi.destroy(id);
      fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '销毁失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBackup = async (id: string) => {
    setActionLoading(id);
    try {
      await backupsApi.backup(id);
      fetchData();
      alert('备份成功');
    } catch (error) {
      alert(error instanceof Error ? error.message : '备份失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStart = async (id: string) => {
    setActionLoading(id);
    try {
      await instancesApi.start(id);
      fetchData();
      alert('策略已启动');
    } catch (error) {
      alert(error instanceof Error ? error.message : '启动失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (id: string) => {
    if (!confirm('确定要停止策略吗？')) return;

    setActionLoading(id);
    try {
      await instancesApi.stop(id);
      fetchData();
      alert('策略已停止');
    } catch (error) {
      alert(error instanceof Error ? error.message : '停止失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async (id: string) => {
    if (!confirm('确定要重启实例吗？')) return;

    setActionLoading(id);
    try {
      await instancesApi.restart(id);
      fetchData();
      alert('实例重启中...');
    } catch (error) {
      alert(error instanceof Error ? error.message : '重启失败');
    } finally {
      setActionLoading(null);
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
      <span className={`px-2 py-1 rounded text-xs ${styles[status] || styles.error}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">VPS 实例</h1>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-bg-tertiary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const activeInstances = instances.filter(
    (i) => i.status !== 'destroyed'
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">VPS 实例</h1>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          <Button onClick={openCreateModal} isLoading={creating}>
            <Plus className="w-4 h-4 mr-2" />
            创建实例
          </Button>
        </div>
      </div>

      {/* 创建实例对话框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-xl p-6 w-full max-w-md mx-4 border border-border-secondary">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">创建 VPS 实例</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-text-secondary hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 费用说明 */}
            <div className="space-y-4">
              <div className="bg-bg-tertiary rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-text-secondary">订阅费用</span>
                  <span className="text-white font-medium">{SUBSCRIPTION_FEE} USDT/月</span>
                </div>
                <p className="text-text-tertiary text-sm">
                  首月订阅费将从您的账户扣除
                </p>
              </div>

              {/* 积分余额 */}
              <div className="bg-bg-tertiary rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-4 h-4 text-warning" />
                  <span className="text-text-secondary">积分余额</span>
                  <span className="text-warning font-medium ml-auto">
                    {parseFloat(pointsBalance).toFixed(2)} 积分
                  </span>
                </div>
                <p className="text-text-tertiary text-sm">
                  1 积分 = 1 USDT，可用于抵扣订阅费
                </p>
              </div>

              {/* 使用积分选项 */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePoints}
                  onChange={(e) => setUsePoints(e.target.checked)}
                  className="w-5 h-5 rounded border-border-secondary bg-bg-tertiary text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-white">使用积分抵扣</span>
              </label>

              {/* 费用明细 */}
              {usePoints && parseFloat(pointsBalance) > 0 && (
                <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-lg p-4">
                  <h4 className="text-brand-primary font-medium mb-2">费用明细</h4>
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
                    <div className="border-t border-border-secondary my-2"></div>
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

            {/* 操作按钮 */}
            <div className="flex gap-3 mt-6">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setShowCreateModal(false)}
              >
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreate}
                isLoading={creating}
              >
                确认创建
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 实例列表 */}
      {activeInstances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Server className="w-16 h-16 mx-auto mb-4 text-text-disabled" />
            <h3 className="text-lg font-medium text-white mb-2">暂无 VPS 实例</h3>
            <p className="text-text-secondary mb-6">
              创建一个 VPS 实例来运行您的量化策略
            </p>
            <Button onClick={openCreateModal} isLoading={creating}>
              <Plus className="w-4 h-4 mr-2" />
              创建实例
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeInstances.map((instance) => (
            <Card key={instance.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        instance.status === 'running'
                          ? 'bg-success/20'
                          : 'bg-bg-tertiary'
                      }`}
                    >
                      <Server
                        className={`w-6 h-6 ${
                          instance.status === 'running'
                            ? 'text-success'
                            : 'text-text-secondary'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-white font-medium">
                          {instance.ip_address || '分配中...'}
                        </h3>
                        {getStatusBadge(instance.status)}
                      </div>
                      <p className="text-text-tertiary text-sm">
                        {instance.region} • ID: {instance.id.slice(0, 8)}...
                      </p>
                      {instance.last_heartbeat && (
                        <p className="text-text-tertiary text-xs mt-1">
                          最后心跳: {formatDateTime(instance.last_heartbeat)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {instance.status === 'running' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStart(instance.id)}
                          disabled={actionLoading === instance.id}
                        >
                          <Power className="w-4 h-4 mr-1" />
                          启动策略
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStop(instance.id)}
                          disabled={actionLoading === instance.id}
                        >
                          <Power className="w-4 h-4 mr-1" />
                          停止策略
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestart(instance.id)}
                          disabled={actionLoading === instance.id}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          重启
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleBackup(instance.id)}
                          disabled={actionLoading === instance.id}
                        >
                          <HardDrive className="w-4 h-4 mr-1" />
                          备份
                        </Button>
                      </>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDestroy(instance.id)}
                      disabled={actionLoading === instance.id}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      销毁
                    </Button>
                  </div>
                </div>

                {/* 资源使用 */}
                {instance.status === 'running' && (
                  <div className="mt-4 pt-4 border-t border-border-primary grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-text-tertiary" />
                      <span className="text-text-secondary text-sm">CPU:</span>
                      <span className="text-white text-sm">
                        {instance.cpu_usage ? `${instance.cpu_usage}%` : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-text-tertiary" />
                      <span className="text-text-secondary text-sm">内存:</span>
                      <span className="text-white text-sm">
                        {instance.memory_usage ? `${instance.memory_usage}%` : '-'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 警告 */}
                {instance.status === 'zombie' && (
                  <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-warning" />
                    <span className="text-warning text-sm">
                      此实例已超过 15 分钟无心跳，将被自动销毁
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 备份列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-brand-primary" />
            备份记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无备份记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.slice(0, 10).map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-3 bg-bg-tertiary/50 rounded-lg"
                >
                  <div>
                    <p className="text-white text-sm font-medium">
                      实例: {backup.instanceId.slice(0, 8)}...
                    </p>
                    <p className="text-text-tertiary text-xs">
                      {formatDateTime(backup.createdAt)} •{' '}
                      {(backup.sizeBytes / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      backup.status === 'completed'
                        ? 'bg-success/20 text-success'
                        : 'bg-warning/20 text-warning'
                    }`}
                  >
                    {backup.status === 'completed' ? '已完成' : backup.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
