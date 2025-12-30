'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Server,
  Plus,
  Trash2,
  RefreshCw,
  HardDrive,
  Cpu,
  Activity,
  AlertCircle,
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

function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      // TODO: Replace with actual API calls
      setInstances([
        {
          id: '1',
          status: 'running',
          ip_address: '192.168.1.100',
          region: 'sgp1',
          cpu_usage: '25',
          memory_usage: '60',
          last_heartbeat: new Date().toISOString(),
        },
        {
          id: '2',
          status: 'provisioning',
          ip_address: '',
          region: 'sgp1',
          cpu_usage: null,
          memory_usage: null,
          last_heartbeat: null,
        },
      ]);
      setBackups([
        {
          id: 'b1',
          instanceId: '1',
          s3Key: 'backups/1/2024-01-01.tar.gz',
          sizeBytes: 102400,
          status: 'completed',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      // TODO: Implement create instance API
      alert('实例创建中...');
      fetchData();
    } catch (error) {
      alert('创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDestroy = async (id: string) => {
    if (!confirm('确定要销毁此实例吗？销毁前会自动备份数据。')) return;
    setActionLoading(id);
    try {
      // TODO: Implement destroy instance API
      fetchData();
    } catch (error) {
      alert('销毁失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBackup = async (id: string) => {
    setActionLoading(id);
    try {
      // TODO: Implement backup API
      fetchData();
      alert('备份成功');
    } catch (error) {
      alert('备份失败');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      running: 'bg-green-500/20 text-green-500',
      provisioning: 'bg-yellow-500/20 text-yellow-500',
      stopped: 'bg-muted text-muted-foreground',
      destroyed: 'bg-red-500/20 text-red-500',
      zombie: 'bg-orange-500/20 text-orange-500',
      error: 'bg-red-500/20 text-red-500',
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
        <h1 className="text-2xl font-bold">VPS 实例</h1>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const activeInstances = instances.filter((i) => i.status !== 'destroyed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">VPS 实例</h1>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            刷新
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            <Plus className="w-4 h-4 mr-2" />
            {creating ? '创建中...' : '创建实例'}
          </Button>
        </div>
      </div>

      {/* Instance List */}
      {activeInstances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Server className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">暂无 VPS 实例</h3>
            <p className="text-muted-foreground mb-6">
              创建一个 VPS 实例来运行您的量化策略
            </p>
            <Button onClick={handleCreate} disabled={creating}>
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
                          ? 'bg-green-500/20'
                          : 'bg-muted'
                      }`}
                    >
                      <Server
                        className={`w-6 h-6 ${
                          instance.status === 'running'
                            ? 'text-green-500'
                            : 'text-muted-foreground'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium">
                          {instance.ip_address || '分配中...'}
                        </h3>
                        {getStatusBadge(instance.status)}
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {instance.region} • ID: {instance.id.slice(0, 8)}...
                      </p>
                      {instance.last_heartbeat && (
                        <p className="text-muted-foreground text-xs mt-1">
                          最后心跳: {formatDateTime(instance.last_heartbeat)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {instance.status === 'running' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleBackup(instance.id)}
                        disabled={actionLoading === instance.id}
                      >
                        <HardDrive className="w-4 h-4 mr-1" />
                        备份
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDestroy(instance.id)}
                      disabled={actionLoading === instance.id}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      销毁
                    </Button>
                  </div>
                </div>

                {/* Resource Usage */}
                {instance.status === 'running' && (
                  <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground text-sm">CPU:</span>
                      <span className="text-sm">
                        {instance.cpu_usage ? `${instance.cpu_usage}%` : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground text-sm">内存:</span>
                      <span className="text-sm">
                        {instance.memory_usage ? `${instance.memory_usage}%` : '-'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Warning */}
                {instance.status === 'zombie' && (
                  <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <span className="text-orange-500 text-sm">
                      此实例已超过 15 分钟无心跳，将被自动销毁
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Backup List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-primary" />
            备份记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无备份记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.slice(0, 10).map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="text-sm font-medium">
                      实例: {backup.instanceId.slice(0, 8)}...
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(backup.createdAt)} •{' '}
                      {(backup.sizeBytes / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      backup.status === 'completed'
                        ? 'bg-green-500/20 text-green-500'
                        : 'bg-yellow-500/20 text-yellow-500'
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
