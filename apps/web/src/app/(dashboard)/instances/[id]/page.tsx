'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { instancesApi, backupsApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import {
  Server,
  ArrowLeft,
  RefreshCw,
  Power,
  Activity,
  HardDrive,
  Cpu,
  AlertCircle,
  Clock,
  MapPin,
  CheckCircle,
  Loader2,
  XCircle,
  Trash2,
  Plus,
  Wrench,
} from 'lucide-react';

interface Instance {
  id: string;
  status: string;
  ip_address: string | null;
  region: string;
  cpu_usage?: string | null;
  memory_usage?: string | null;
  disk_usage?: string | null;
  current_strategy?: string | null;
  created_at: string;
  last_heartbeat?: string | null;
  droplet_id?: string | null;
  provisioned_at?: string | null;
  destroy_reason?: string | null;
  destroyed_at?: string | null;
}

interface Backup {
  id: string;
  instanceId: string;
  s3Key: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
}

export default function InstanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const instanceId = params.id as string;

  const [instance, setInstance] = useState<Instance | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (showRefreshFeedback = false) => {
    if (showRefreshFeedback) {
      setRefreshing(true);
    }
    try {
      const [instanceRes, backupsRes] = await Promise.all([
        instancesApi.detail(instanceId),
        backupsApi.list(instanceId),
      ]);

      setInstance(instanceRes.data);
      setBackups(backupsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch instance:', error);
      alert('加载失败');
      router.push('/instances');
    } finally {
      setLoading(false);
      if (showRefreshFeedback) {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
    // 每 30 秒刷新一次数据
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [instanceId]);

  // 硬重启 VPS
  const handleReboot = async () => {
    if (!confirm('确定要重启 VPS 吗？重启过程约 2-3 分钟。')) return;

    setActionLoading('reboot');
    try {
      await instancesApi.reboot(instanceId);
      alert('VPS 重启指令已发送，请等待 2-3 分钟后刷新页面查看状态。');
      setTimeout(() => fetchData(), 30000);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'VPS 重启失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 销毁 VPS
  const handleDestroy = async () => {
    if (!confirm('确定要销毁此 VPS 吗？此操作不可恢复。')) return;

    setActionLoading('destroy');
    try {
      await instancesApi.destroyVps(instanceId);
      alert('VPS 已销毁');
      await fetchData();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'VPS 销毁失败');
    } finally {
      setActionLoading(null);
    }
  };

  // 创建新 VPS
  const handleCreateVps = async () => {
    setActionLoading('create');
    try {
      await instancesApi.create('sgp1');
      alert('VPS 创建中，请等待 5-8 分钟');
      router.push('/instances');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'VPS 创建失败');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      running: 'bg-success/20 text-success',
      pending: 'bg-brand-primary/20 text-brand-primary',
      provisioning: 'bg-warning/20 text-warning',
      stopped: 'bg-bg-tertiary text-text-secondary',
      destroyed: 'bg-text-tertiary/20 text-text-tertiary',
      zombie: 'bg-danger/20 text-danger',
      unhealthy: 'bg-warning/20 text-warning',
      destroying: 'bg-warning/20 text-warning',
      error: 'bg-danger/20 text-danger',
    };

    const labels: Record<string, string> = {
      running: '运行中',
      pending: '等待创建',
      provisioning: '创建中',
      stopped: '已停止',
      destroyed: '已销毁',
      zombie: '僵尸节点',
      unhealthy: '异常修复中',
      destroying: '销毁中',
      error: '创建失败',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs ${styles[status] || styles.error}`}>
        {labels[status] || status}
      </span>
    );
  };

  // 计算心跳状态
  const getHeartbeatStatus = () => {
    if (!instance?.last_heartbeat) return { status: 'unknown', message: '尚无心跳记录' };

    const lastBeat = new Date(instance.last_heartbeat).getTime();
    const now = Date.now();
    const diffMinutes = (now - lastBeat) / 60000;

    if (diffMinutes < 5) {
      return { status: 'healthy', message: '正常' };
    } else if (diffMinutes < 10) {
      return { status: 'warning', message: `${Math.round(diffMinutes)} 分钟前` };
    } else if (diffMinutes < 15) {
      return { status: 'critical', message: `${Math.round(diffMinutes)} 分钟前 (即将超时)` };
    } else {
      return { status: 'timeout', message: '已超时' };
    }
  };

  // 计算创建进度
  const getProvisioningProgress = () => {
    if (!instance) return 0;

    const status = instance.status;
    if (status === 'running') return 100;
    if (status === 'error' || status === 'destroyed') return 0;

    if (status === 'pending') return 20;

    if (status === 'provisioning') {
      if (instance.provisioned_at) {
        const elapsed = (Date.now() - new Date(instance.provisioned_at).getTime()) / 1000;
        const progress = Math.min(20 + (elapsed / 120) * 70, 90);
        return Math.round(progress);
      }
      return 50;
    }

    return 0;
  };

  const calculateUptime = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}小时${minutes}分钟`;
  };

  // 计算预计销毁时间（从最后心跳算起 15 分钟）
  const getEstimatedDestroyTime = () => {
    if (!instance?.last_heartbeat) return null;
    const lastBeat = new Date(instance.last_heartbeat).getTime();
    const destroyTime = lastBeat + 15 * 60 * 1000;
    return new Date(destroyTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-bg-tertiary rounded w-1/4" />
          <div className="h-48 bg-bg-tertiary rounded-xl" />
          <div className="h-64 bg-bg-tertiary rounded-xl" />
        </div>
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="text-center py-12">
        <Server className="w-16 h-16 mx-auto mb-4 text-text-disabled" />
        <h3 className="text-lg font-medium text-white mb-2">实例不存在</h3>
        <Button onClick={() => router.push('/instances')}>返回列表</Button>
      </div>
    );
  }

  // 判断是否可以显示操作按钮
  const canShowReboot = ['running', 'unhealthy', 'zombie'].includes(instance.status);
  const canShowDestroy = ['running', 'unhealthy', 'zombie', 'stopped'].includes(instance.status);
  const canShowCreate = instance.status === 'destroyed';
  const isProcessing = ['pending', 'provisioning', 'destroying'].includes(instance.status);

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/instances')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
            <h1 className="text-2xl font-bold text-white">实例详情</h1>
          </div>
          {getStatusBadge(instance.status)}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline ml-2">{refreshing ? '刷新中...' : '刷新'}</span>
        </Button>
      </div>

      {/* ========== VPS 状态卡片 ========== */}
      <Card className={
        instance.status === 'running' ? 'border-success/30' :
        instance.status === 'unhealthy' ? 'border-warning/30' :
        instance.status === 'destroyed' ? 'border-text-tertiary/30' :
        'border-border-primary'
      }>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-brand-primary" />
            VPS 状态
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 状态：running（正常） */}
          {instance.status === 'running' && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-white font-medium">运行中</p>
                  <p className="text-text-secondary text-sm">VPS 运行正常</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-text-tertiary">IP 地址</p>
                  <p className="text-white font-mono">{instance.ip_address || '分配中...'}</p>
                </div>
                <div>
                  <p className="text-text-tertiary">最后心跳</p>
                  <p className="text-white">{instance.last_heartbeat ? formatDateTime(instance.last_heartbeat) : '无'}</p>
                </div>
                <div>
                  <p className="text-text-tertiary">运行时长</p>
                  <p className="text-white">{calculateUptime(instance.created_at)}</p>
                </div>
                <div>
                  <p className="text-text-tertiary">区域</p>
                  <p className="text-white">{instance.region}</p>
                </div>
              </div>
            </>
          )}

          {/* 状态：unhealthy（异常修复中） */}
          {instance.status === 'unhealthy' && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-warning animate-pulse" />
                </div>
                <div>
                  <p className="text-warning font-medium">检测到异常 - 正在自动修复</p>
                  <p className="text-text-secondary text-sm">系统正在自动诊断并修复，无需您操作。</p>
                </div>
              </div>
              <div className="p-3 bg-warning/10 rounded-lg text-sm">
                <p className="text-warning">
                  如修复失败，将在 <span className="font-medium">{getEstimatedDestroyTime()}</span> 自动销毁。
                </p>
                <p className="text-text-tertiary mt-1">💡 不想等待？您可以立即销毁并重建。</p>
              </div>
            </>
          )}

          {/* 状态：zombie（僵尸节点） */}
          {instance.status === 'zombie' && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-danger/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-danger" />
                </div>
                <div>
                  <p className="text-danger font-medium">VPS 无响应</p>
                  <p className="text-text-secondary text-sm">SSH 连接失败，等待自动销毁或手动处理。</p>
                </div>
              </div>
              <div className="p-3 bg-danger/10 rounded-lg text-sm">
                <p className="text-danger">
                  将在 <span className="font-medium">{getEstimatedDestroyTime()}</span> 自动销毁。
                </p>
              </div>
            </>
          )}

          {/* 状态：destroyed（已销毁） */}
          {instance.status === 'destroyed' && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-text-tertiary/20 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-text-tertiary" />
                </div>
                <div>
                  <p className="text-text-secondary font-medium">VPS 已销毁</p>
                  <p className="text-text-tertiary text-sm">
                    {instance.destroy_reason || '用户手动销毁'}
                  </p>
                </div>
              </div>
              {instance.destroyed_at && (
                <div className="text-sm text-text-tertiary">
                  销毁时间: {formatDateTime(instance.destroyed_at)}
                </div>
              )}
            </>
          )}

          {/* 状态：pending/provisioning（创建中） */}
          {(instance.status === 'pending' || instance.status === 'provisioning') && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-brand-primary animate-spin" />
                </div>
                <div>
                  <p className="text-brand-primary font-medium">VPS 正在创建中</p>
                  <p className="text-text-secondary text-sm">
                    {instance.status === 'pending' ? '正在初始化资源...' : '正在配置服务器环境...'}
                  </p>
                </div>
              </div>
              {/* 进度条 */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-text-secondary">创建进度</span>
                  <span className="text-brand-primary">{getProvisioningProgress()}%</span>
                </div>
                <div className="w-full bg-bg-tertiary rounded-full h-2">
                  <div
                    className="bg-brand-primary h-2 rounded-full transition-all duration-500"
                    style={{ width: `${getProvisioningProgress()}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-text-tertiary">
                预计需要 5-8 分钟，请耐心等待。
              </p>
            </>
          )}

          {/* 状态：destroying（销毁中） */}
          {instance.status === 'destroying' && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-warning animate-spin" />
              </div>
              <div>
                <p className="text-warning font-medium">VPS 正在销毁中</p>
                <p className="text-text-secondary text-sm">请稍候...</p>
              </div>
            </div>
          )}

          {/* 状态：error（创建失败） */}
          {instance.status === 'error' && (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-danger/20 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-danger" />
                </div>
                <div>
                  <p className="text-danger font-medium">VPS 创建失败</p>
                  <p className="text-text-secondary text-sm">
                    {instance.destroy_reason || '未知错误，请联系客服'}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* 操作按钮 */}
          {!isProcessing && (
            <div className="flex flex-wrap gap-3 pt-4 border-t border-border-primary">
              {canShowReboot && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReboot}
                  disabled={actionLoading !== null}
                  isLoading={actionLoading === 'reboot'}
                >
                  <Power className="w-4 h-4 mr-2" />
                  重启 VPS
                </Button>
              )}
              {canShowDestroy && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDestroy}
                  disabled={actionLoading !== null}
                  isLoading={actionLoading === 'destroy'}
                  className="border-danger/30 text-danger hover:bg-danger/10"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  销毁 VPS
                </Button>
              )}
              {canShowCreate && (
                <Button
                  size="sm"
                  onClick={handleCreateVps}
                  disabled={actionLoading !== null}
                  isLoading={actionLoading === 'create'}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  创建新 VPS
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 基本信息卡片 */}
      {instance.status !== 'destroyed' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-4 h-4 text-brand-primary" />
              详细信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-text-tertiary mb-1">实例 ID</p>
                <p className="text-white font-mono text-xs break-all">{instance.id}</p>
              </div>
              <div>
                <p className="text-text-tertiary mb-1">Droplet ID</p>
                <p className="text-white font-mono text-xs">{instance.droplet_id || '未分配'}</p>
              </div>
              <div>
                <p className="text-text-tertiary mb-1">IP 地址</p>
                <p className="text-white font-mono">{instance.ip_address || '分配中...'}</p>
              </div>
              <div>
                <p className="text-text-tertiary mb-1">区域</p>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-text-tertiary" />
                  <p className="text-white">{instance.region}</p>
                </div>
              </div>
              <div>
                <p className="text-text-tertiary mb-1">创建时间</p>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-text-tertiary" />
                  <p className="text-white">{formatDateTime(instance.created_at)}</p>
                </div>
              </div>
              <div>
                <p className="text-text-tertiary mb-1">当前策略</p>
                <p className="text-white">{instance.current_strategy || '未运行'}</p>
              </div>
            </div>

            {/* 心跳状态 */}
            {instance.last_heartbeat && (
              <div className="mt-4 pt-4 border-t border-border-primary">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        getHeartbeatStatus().status === 'healthy'
                          ? 'bg-success'
                          : getHeartbeatStatus().status === 'warning'
                            ? 'bg-warning'
                            : getHeartbeatStatus().status === 'critical'
                              ? 'bg-danger animate-pulse'
                              : 'bg-text-tertiary'
                      }`}
                    />
                    <span className="text-text-secondary text-sm">最后心跳</span>
                  </div>
                  <span className="text-white text-sm">{formatDateTime(instance.last_heartbeat)}</span>
                </div>
                {getHeartbeatStatus().status !== 'healthy' && (
                  <p className={`text-xs mt-1 ${
                    getHeartbeatStatus().status === 'critical' ? 'text-danger' : 'text-warning'
                  }`}>
                    {getHeartbeatStatus().message}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 资源监控 */}
      {instance.status === 'running' && (instance.cpu_usage || instance.memory_usage || instance.disk_usage) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-4 h-4 text-brand-primary" />
              资源监控
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* CPU 使用率 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-text-tertiary" />
                  <span className="text-text-secondary text-sm">CPU</span>
                </div>
                <span className="text-white text-sm">{instance.cpu_usage || '-'}%</span>
              </div>
              <div className="w-full bg-bg-tertiary rounded-full h-1.5">
                <div
                  className="bg-brand-primary h-1.5 rounded-full"
                  style={{ width: `${instance.cpu_usage || 0}%` }}
                />
              </div>
            </div>

            {/* 内存使用率 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-text-tertiary" />
                  <span className="text-text-secondary text-sm">内存</span>
                </div>
                <span className="text-white text-sm">{instance.memory_usage || '-'}%</span>
              </div>
              <div className="w-full bg-bg-tertiary rounded-full h-1.5">
                <div
                  className="bg-success h-1.5 rounded-full"
                  style={{ width: `${instance.memory_usage || 0}%` }}
                />
              </div>
            </div>

            {/* 磁盘使用率 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-text-tertiary" />
                  <span className="text-text-secondary text-sm">磁盘</span>
                </div>
                <span className="text-white text-sm">{instance.disk_usage || '-'}%</span>
              </div>
              <div className="w-full bg-bg-tertiary rounded-full h-1.5">
                <div
                  className="bg-warning h-1.5 rounded-full"
                  style={{ width: `${instance.disk_usage || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
