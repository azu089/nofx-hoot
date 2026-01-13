'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
// 直接从源文件导入，避免 barrel export 导致的客户端模块解析问题
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { instancesApi, backupsApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import {
  Server,
  ArrowLeft,
  Trash2,
  RefreshCw,
  Power,
  Activity,
  HardDrive,
  Cpu,
  AlertCircle,
  Clock,
  MapPin,
  Terminal,
  Download,
  CheckCircle,
  Loader2,
  XCircle,
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
}

interface Backup {
  id: string;
  instanceId: string;
  s3Key: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export default function InstanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const instanceId = params.id as string;

  const [instance, setInstance] = useState<Instance | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [instanceRes, backupsRes] = await Promise.all([
        instancesApi.detail(instanceId),
        backupsApi.list(instanceId),
      ]);

      setInstance(instanceRes.data);
      setBackups(backupsRes.data || []);

      // Mock 日志数据
      setLogs([
        { timestamp: new Date().toISOString(), level: 'info', message: '策略已启动' },
        { timestamp: new Date(Date.now() - 60000).toISOString(), level: 'info', message: '连接到币安交易所' },
        { timestamp: new Date(Date.now() - 120000).toISOString(), level: 'warn', message: 'API 速率限制警告' },
        { timestamp: new Date(Date.now() - 180000).toISOString(), level: 'info', message: '开仓 BTC/USDT 做多' },
        { timestamp: new Date(Date.now() - 240000).toISOString(), level: 'error', message: '网络连接超时，正在重试...' },
      ]);
    } catch (error) {
      console.error('Failed to fetch instance:', error);
      alert('加载失败');
      router.push('/instances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // 每 10 秒刷新一次数据
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [instanceId]);

  const handleStart = async () => {
    setActionLoading('start');
    try {
      await instancesApi.start(instanceId);
      await fetchData();
      alert('策略已启动');
    } catch (error) {
      alert(error instanceof Error ? error.message : '启动失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    if (!confirm('确定要停止策略吗？')) return;

    setActionLoading('stop');
    try {
      await instancesApi.stop(instanceId);
      await fetchData();
      alert('策略已停止');
    } catch (error) {
      alert(error instanceof Error ? error.message : '停止失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async () => {
    if (!confirm('确定要重启实例吗？')) return;

    setActionLoading('restart');
    try {
      await instancesApi.restart(instanceId);
      await fetchData();
      alert('实例重启中...');
    } catch (error) {
      alert(error instanceof Error ? error.message : '重启失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDestroy = async () => {
    if (!confirm('确定要销毁此实例吗？销毁前会自动备份数据。')) return;

    setActionLoading('destroy');
    try {
      await instancesApi.destroy(instanceId);
      alert('实例已销毁');
      router.push('/instances');
    } catch (error) {
      alert(error instanceof Error ? error.message : '销毁失败');
      setActionLoading(null);
    }
  };

  const handleBackup = async () => {
    setActionLoading('backup');
    try {
      await backupsApi.backup(instanceId);
      await fetchData();
      alert('备份成功');
    } catch (error) {
      alert(error instanceof Error ? error.message : '备份失败');
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
      destroyed: 'bg-danger/20 text-danger',
      zombie: 'bg-danger/20 text-danger',
      error: 'bg-danger/20 text-danger',
    };

    const labels: Record<string, string> = {
      running: '运行中',
      pending: '等待创建',
      provisioning: '创建中',
      stopped: '已停止',
      destroyed: '已销毁',
      zombie: '僵尸节点',
      error: '创建失败',
    };

    return (
      <span className={`px-2 py-1 rounded text-xs ${styles[status] || styles.error}`}>
        {labels[status] || status}
      </span>
    );
  };

  // 计算心跳是否超时（接近 15 分钟）
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

    if (status === 'pending') {
      return 20; // 数据库记录已创建
    }

    if (status === 'provisioning') {
      // 根据时间估算进度
      if (instance.provisioned_at) {
        const elapsed = (Date.now() - new Date(instance.provisioned_at).getTime()) / 1000;
        // 预估 2 分钟完成
        const progress = Math.min(20 + (elapsed / 120) * 70, 90);
        return Math.round(progress);
      }
      return 50;
    }

    return 0;
  };

  const getLogLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      info: 'text-brand-primary',
      warn: 'text-warning',
      error: 'text-danger',
    };
    return colors[level] || 'text-text-secondary';
  };

  const calculateUptime = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}小时${minutes}分钟`;
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

  return (
    <div className="space-y-6">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/instances')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <h1 className="text-2xl font-bold text-white">实例详情</h1>
          {getStatusBadge(instance.status)}
        </div>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* VPS 创建进度卡片 */}
      {(instance.status === 'pending' || instance.status === 'provisioning') && (
        <Card className="border-brand-primary/30 bg-brand-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-brand-primary/20 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">VPS 正在创建中</h3>
                <p className="text-text-secondary text-sm">
                  {instance.status === 'pending' ? '正在初始化资源...' : '正在配置服务器环境...'}
                </p>
              </div>
            </div>

            {/* 创建进度条 */}
            <div className="mb-4">
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

            {/* 创建步骤 */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-text-secondary">订阅已确认</span>
              </div>
              <div className="flex items-center gap-2">
                {instance.status === 'pending' ? (
                  <Loader2 className="w-4 h-4 text-brand-primary animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-success" />
                )}
                <span className="text-text-secondary">创建云服务器</span>
              </div>
              <div className="flex items-center gap-2">
                {instance.status === 'provisioning' ? (
                  <Loader2 className="w-4 h-4 text-brand-primary animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-text-tertiary" />
                )}
                <span className="text-text-secondary">安装交易环境</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border border-text-tertiary" />
                <span className="text-text-secondary">等待首次心跳</span>
              </div>
            </div>

            <p className="text-xs text-text-tertiary mt-4">
              预计需要 2-5 分钟，请耐心等待。如超过 10 分钟仍未完成，系统将自动标记为失败。
            </p>
          </CardContent>
        </Card>
      )}

      {/* 创建失败警告 */}
      {instance.status === 'error' && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg">
          <div className="flex items-start gap-3">
            <XCircle className="w-6 h-6 text-danger flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-danger font-medium mb-1">VPS 创建失败</h4>
              <p className="text-danger/80 text-sm mb-3">
                {instance.destroy_reason || '创建过程中发生错误，请联系客服处理。'}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => router.push('/wallet/billing')}>
                  查看账单
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open('mailto:support@quantfi.com')}>
                  联系客服
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 僵尸节点警告 */}
      {instance.status === 'zombie' && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-danger flex-shrink-0" />
          <div>
            <h4 className="text-danger font-medium mb-1">僵尸节点警告</h4>
            <p className="text-danger/80 text-sm">
              此实例已超过 15 分钟无心跳，将被自动销毁并退款
            </p>
          </div>
        </div>
      )}

      {/* 心跳超时预警（即将成为僵尸节点）*/}
      {instance.status === 'running' && getHeartbeatStatus().status === 'critical' && (
        <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
          <div>
            <h4 className="text-warning font-medium mb-1">心跳超时预警</h4>
            <p className="text-warning/80 text-sm">
              最后心跳时间：{getHeartbeatStatus().message}。如持续无响应，实例将被标记为僵尸节点。
            </p>
          </div>
        </div>
      )}

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-brand-primary" />
            基本信息
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-text-secondary text-sm mb-1">实例 ID</p>
              <p className="text-white font-mono">{instance.id}</p>
            </div>
            <div>
              <p className="text-text-secondary text-sm mb-1">IP 地址</p>
              <p className="text-white font-mono">{instance.ip_address || '分配中...'}</p>
            </div>
            <div>
              <p className="text-text-secondary text-sm mb-1">区域</p>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-text-tertiary" />
                <p className="text-white">{instance.region}</p>
              </div>
            </div>
            <div>
              <p className="text-text-secondary text-sm mb-1">创建时间</p>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-text-tertiary" />
                <p className="text-white">{formatDateTime(instance.created_at)}</p>
              </div>
            </div>
            <div>
              <p className="text-text-secondary text-sm mb-1">运行时长</p>
              <p className="text-white">{calculateUptime(instance.created_at)}</p>
            </div>
            <div>
              <p className="text-text-secondary text-sm mb-1">当前策略</p>
              <p className="text-white">{instance.current_strategy || '未运行'}</p>
            </div>
          </div>

          {/* 心跳状态 */}
          <div className="mt-6 pt-6 border-t border-border-primary">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-text-secondary text-sm mb-1">最后心跳</p>
                <div className="flex items-center gap-2">
                  {instance.last_heartbeat ? (
                    <>
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
                      <p className="text-white">{formatDateTime(instance.last_heartbeat)}</p>
                    </>
                  ) : (
                    <p className="text-text-tertiary">尚无心跳记录</p>
                  )}
                </div>
                {instance.last_heartbeat && getHeartbeatStatus().status !== 'healthy' && (
                  <p
                    className={`text-xs mt-1 ${
                      getHeartbeatStatus().status === 'critical' ? 'text-danger' : 'text-warning'
                    }`}
                  >
                    {getHeartbeatStatus().message}
                  </p>
                )}
              </div>
              <div>
                <p className="text-text-secondary text-sm mb-1">Droplet ID</p>
                <p className="text-white font-mono text-sm">
                  {instance.droplet_id || '尚未分配'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 资源监控 */}
      {instance.status === 'running' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand-primary" />
              资源监控
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* CPU 使用率 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-text-tertiary" />
                  <span className="text-text-secondary text-sm">CPU 使用率</span>
                </div>
                <span className="text-white font-medium">
                  {instance.cpu_usage ? `${instance.cpu_usage}%` : '-'}
                </span>
              </div>
              <div className="w-full bg-bg-tertiary rounded-full h-2">
                <div
                  className="bg-brand-primary h-2 rounded-full transition-all"
                  style={{ width: `${instance.cpu_usage || 0}%` }}
                />
              </div>
            </div>

            {/* 内存使用率 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-text-tertiary" />
                  <span className="text-text-secondary text-sm">内存使用率</span>
                </div>
                <span className="text-white font-medium">
                  {instance.memory_usage ? `${instance.memory_usage}%` : '-'}
                </span>
              </div>
              <div className="w-full bg-bg-tertiary rounded-full h-2">
                <div
                  className="bg-success h-2 rounded-full transition-all"
                  style={{ width: `${instance.memory_usage || 0}%` }}
                />
              </div>
            </div>

            {/* 磁盘使用率 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-text-tertiary" />
                  <span className="text-text-secondary text-sm">磁盘使用率</span>
                </div>
                <span className="text-white font-medium">
                  {instance.disk_usage ? `${instance.disk_usage}%` : '-'}
                </span>
              </div>
              <div className="w-full bg-bg-tertiary rounded-full h-2">
                <div
                  className="bg-warning h-2 rounded-full transition-all"
                  style={{ width: `${instance.disk_usage || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 操作按钮 */}
      <Card>
        <CardHeader>
          <CardTitle>实例操作</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {instance.status === 'running' && (
              <>
                <Button
                  onClick={handleStart}
                  disabled={actionLoading !== null}
                  isLoading={actionLoading === 'start'}
                >
                  <Power className="w-4 h-4 mr-2" />
                  启动策略
                </Button>
                <Button
                  variant="outline"
                  onClick={handleStop}
                  disabled={actionLoading !== null}
                  isLoading={actionLoading === 'stop'}
                >
                  <Power className="w-4 h-4 mr-2" />
                  停止策略
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRestart}
                  disabled={actionLoading !== null}
                  isLoading={actionLoading === 'restart'}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重启实例
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBackup}
                  disabled={actionLoading !== null}
                  isLoading={actionLoading === 'backup'}
                >
                  <HardDrive className="w-4 h-4 mr-2" />
                  创建备份
                </Button>
              </>
            )}
            <Button
              variant="danger"
              onClick={handleDestroy}
              disabled={actionLoading !== null}
              isLoading={actionLoading === 'destroy'}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              销毁实例
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 实时日志流 */}
      {instance.status === 'running' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-brand-primary" />
              实时日志（最近 20 条）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-bg-primary rounded-lg p-4 font-mono text-sm space-y-2 max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-text-tertiary">暂无日志</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="flex gap-3">
                    <span className="text-text-disabled">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={getLogLevelColor(log.level)}>
                      [{log.level.toUpperCase()}]
                    </span>
                    <span className="text-text-primary">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 备份列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-brand-primary" />
            备份列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无备份记录</p>
              <Button variant="outline" className="mt-4" onClick={handleBackup}>
                创建第一个备份
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-lg hover:bg-bg-tertiary transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <HardDrive className="w-5 h-5 text-text-tertiary mt-0.5" />
                    <div>
                      <p className="text-white font-medium">
                        {formatDateTime(backup.createdAt)}
                      </p>
                      <p className="text-text-tertiary text-sm">
                        大小: {(backup.sizeBytes / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        backup.status === 'completed'
                          ? 'bg-success/20 text-success'
                          : 'bg-warning/20 text-warning'
                      }`}
                    >
                      {backup.status === 'completed' ? '已完成' : backup.status}
                    </span>
                    {backup.status === 'completed' && (
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-1" />
                        恢复
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
