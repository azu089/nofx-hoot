'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { instancesApi, backupsApi } from '@/lib/api';
import {
  ArrowLeft,
  Server,
  RefreshCw,
  Power,
  Trash2,
  Activity,
  Cpu,
  HardDrive,
  MapPin,
  Clock,
  Terminal,
  Download,
  AlertCircle,
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

export default function TgInstanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const instanceId = params.id as string;

  const [instance, setInstance] = useState<Instance | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const fetchData = async () => {
    try {
      const [instanceRes, backupsRes] = await Promise.all([
        instancesApi.detail(instanceId),
        backupsApi.list(instanceId),
      ]);

      setInstance(instanceRes.data);
      setBackups(backupsRes.data || []);

      // Mock 日志
      setLogs([
        { timestamp: new Date().toISOString(), level: 'info', message: '策略已启动' },
        { timestamp: new Date(Date.now() - 60000).toISOString(), level: 'info', message: '连接到交易所' },
        { timestamp: new Date(Date.now() - 120000).toISOString(), level: 'warn', message: 'API 速率限制警告' },
        { timestamp: new Date(Date.now() - 180000).toISOString(), level: 'info', message: '开仓 BTC/USDT' },
      ]);
    } catch (error) {
      console.error('Failed to fetch instance:', error);
      haptic('notification_error');
      alert('加载失败');
      router.push('/tg/instances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [instanceId]);

  const handleAction = async (action: 'start' | 'stop' | 'restart' | 'destroy') => {
    const confirmMessages: Record<string, string> = {
      stop: '确定要停止策略吗？',
      restart: '确定要重启实例吗？',
      destroy: '确定要销毁此实例吗？销毁前会自动备份。',
    };

    if (confirmMessages[action] && !confirm(confirmMessages[action])) return;

    setActionLoading(action);
    haptic('impact_medium');

    try {
      switch (action) {
        case 'start':
          await instancesApi.start(instanceId);
          break;
        case 'stop':
          await instancesApi.stop(instanceId);
          break;
        case 'restart':
          await instancesApi.restart(instanceId);
          break;
        case 'destroy':
          await instancesApi.destroy(instanceId);
          haptic('notification_success');
          router.push('/tg/instances');
          return;
      }
      await fetchData();
      haptic('notification_success');
    } catch (error) {
      haptic('notification_error');
      alert(error instanceof Error ? error.message : '操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; bg: string; label: string; icon: typeof CheckCircle }> = {
      running: { color: 'text-success', bg: 'bg-success/20', label: '运行中', icon: CheckCircle },
      provisioning: { color: 'text-warning', bg: 'bg-warning/20', label: '创建中', icon: Loader2 },
      stopped: { color: 'text-text-secondary', bg: 'bg-bg-tertiary', label: '已停止', icon: XCircle },
      destroyed: { color: 'text-danger', bg: 'bg-danger/20', label: '已销毁', icon: XCircle },
      zombie: { color: 'text-warning', bg: 'bg-warning/20', label: '僵尸节点', icon: AlertCircle },
      error: { color: 'text-danger', bg: 'bg-danger/20', label: '错误', icon: XCircle },
    };
    return configs[status] || configs.error;
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-danger';
      case 'warn': return 'text-warning';
      default: return 'text-text-secondary';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-bg-tertiary/50 rounded-lg w-32" />
        <div className="h-32 bg-bg-tertiary/50 rounded-xl" />
        <div className="h-24 bg-bg-tertiary/50 rounded-xl" />
        <div className="h-40 bg-bg-tertiary/50 rounded-xl" />
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="py-16 text-center">
        <AlertCircle className="w-12 h-12 text-danger mx-auto mb-3" />
        <p className="text-text-secondary">实例不存在</p>
      </div>
    );
  }

  const statusConfig = getStatusConfig(instance.status);
  const StatusIcon = statusConfig.icon;
  const cpuUsage = parseFloat(instance.cpu_usage || '0');
  const memUsage = parseFloat(instance.memory_usage || '0');
  const diskUsage = parseFloat(instance.disk_usage || '0');

  return (
    <div className="space-y-4 pb-24">
      {/* 顶部 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { haptic('selection'); router.back(); }}
          className="flex items-center gap-2 text-text-secondary"
        >
          <ArrowLeft size={20} />
          <span className="text-lg font-medium text-white">实例详情</span>
        </button>
        <button onClick={fetchData} className="p-2 text-text-secondary">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 状态卡片 */}
      <div className={`rounded-xl p-4 border ${statusConfig.bg} border-${statusConfig.color.replace('text-', '')}/30`}>
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full ${statusConfig.bg} flex items-center justify-center`}>
            <StatusIcon className={`w-6 h-6 ${statusConfig.color} ${instance.status === 'provisioning' ? 'animate-spin' : ''}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-white font-bold">
                {instance.ip_address || '分配中...'}
              </h2>
              <span className={`px-2 py-0.5 rounded text-xs ${statusConfig.bg} ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-text-tertiary text-xs mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {instance.region}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(instance.created_at).toLocaleDateString('zh-CN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 资源监控 */}
      {instance.status === 'running' && (
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
          <h3 className="text-white font-medium text-sm mb-3">资源使用</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Cpu className="w-4 h-4 text-brand-primary" />
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-text-secondary">CPU</span>
                  <span className="text-white">{cpuUsage.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-bg-tertiary rounded-full">
                  <div
                    className="h-full bg-brand-primary rounded-full transition-all"
                    style={{ width: `${Math.min(cpuUsage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <HardDrive className="w-4 h-4 text-success" />
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-text-secondary">内存</span>
                  <span className="text-white">{memUsage.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-bg-tertiary rounded-full">
                  <div
                    className="h-full bg-success rounded-full transition-all"
                    style={{ width: `${Math.min(memUsage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4 text-warning" />
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-text-secondary">磁盘</span>
                  <span className="text-white">{diskUsage.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-bg-tertiary rounded-full">
                  <div
                    className="h-full bg-warning rounded-full transition-all"
                    style={{ width: `${Math.min(diskUsage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {instance.last_heartbeat && (
            <div className="mt-3 pt-3 border-t border-border-primary flex items-center gap-2 text-xs text-text-tertiary">
              <Activity className="w-3 h-3" />
              <span>最后心跳: {new Date(instance.last_heartbeat).toLocaleTimeString('zh-CN')}</span>
            </div>
          )}
        </div>
      )}

      {/* 控制按钮 */}
      <div className="grid grid-cols-2 gap-3">
        {instance.status === 'running' ? (
          <button
            onClick={() => handleAction('stop')}
            disabled={actionLoading !== null}
            className="py-3 bg-warning/20 text-warning rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {actionLoading === 'stop' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Power className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">停止</span>
          </button>
        ) : (
          <button
            onClick={() => handleAction('start')}
            disabled={actionLoading !== null || instance.status === 'destroyed'}
            className="py-3 bg-success/20 text-success rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {actionLoading === 'start' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Power className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">启动</span>
          </button>
        )}
        <button
          onClick={() => handleAction('restart')}
          disabled={actionLoading !== null || instance.status === 'destroyed'}
          className="py-3 bg-brand-primary/20 text-brand-primary rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {actionLoading === 'restart' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">重启</span>
        </button>
      </div>

      {/* 运行日志 */}
      <div className="bg-bg-secondary border border-border-primary rounded-xl overflow-hidden">
        <button
          onClick={() => { setShowLogs(!showLogs); haptic('selection'); }}
          className="w-full p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-brand-primary" />
            <span className="text-white font-medium text-sm">运行日志</span>
          </div>
          <span className="text-text-tertiary text-xs">{showLogs ? '收起' : '展开'}</span>
        </button>
        {showLogs && (
          <div className="border-t border-border-primary p-3 max-h-48 overflow-y-auto bg-bg-tertiary/50">
            {logs.map((log, idx) => (
              <div key={idx} className="flex gap-2 text-xs font-mono py-1">
                <span className="text-text-tertiary whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString('zh-CN')}
                </span>
                <span className={getLogColor(log.level)}>{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 备份列表 */}
      {backups.length > 0 && (
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4">
          <h3 className="text-white font-medium text-sm mb-3">备份记录</h3>
          <div className="space-y-2">
            {backups.slice(0, 3).map((backup) => (
              <div
                key={backup.id}
                className="flex items-center justify-between p-2 bg-bg-tertiary/50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-success" />
                  <div>
                    <p className="text-white text-xs">
                      {new Date(backup.createdAt).toLocaleString('zh-CN')}
                    </p>
                    <p className="text-text-tertiary text-[10px]">
                      {(backup.sizeBytes / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] ${
                  backup.status === 'completed' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'
                }`}>
                  {backup.status === 'completed' ? '已完成' : '进行中'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 销毁按钮 */}
      {instance.status !== 'destroyed' && (
        <button
          onClick={() => handleAction('destroy')}
          disabled={actionLoading !== null}
          className="w-full py-3 bg-danger/20 text-danger rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {actionLoading === 'destroy' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">销毁实例</span>
        </button>
      )}
    </div>
  );
}
