'use client';

import { useEffect, useState } from 'react';
// 直接从源文件导入，避免 barrel export 导致的客户端模块解析问题
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MobileHeader } from '@/components/ui/MobileBackButton';
import { instancesApi, backupsApi, gamefiApi } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import {
  Server,
  RefreshCw,
  Activity,
  HardDrive,
  Cpu,
  AlertCircle,
  X,
  Coins,
  HelpCircle,
  ChevronRight,
  Zap,
  Shield,
  Clock,
  CreditCard,
  Eye,
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
  const [showHelp, setShowHelp] = useState(true);

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
      <span className={`px-2 py-1 rounded text-xs ${styles[status] || styles.error}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-bg-tertiary/50 rounded animate-pulse w-28"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="p-6 bg-bg-secondary border border-border-primary rounded-xl space-y-4">
              <div className="h-5 bg-bg-tertiary/50 rounded animate-pulse w-32"></div>
              <div className="h-4 bg-bg-tertiary/50 rounded animate-pulse w-24"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activeInstances = instances.filter((i) => i.status !== 'destroyed');
  const hasActiveInstance = activeInstances.length > 0;

  return (
    <div className="space-y-6">
      {/* 移动端头部 - 带返回按钮 */}
      <MobileHeader
        title="VPS 实例"
        rightAction={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            {!hasActiveInstance && (
              <Button size="sm" onClick={openSubscribeModal} isLoading={subscribing}>
                购买
              </Button>
            )}
          </div>
        }
      />
      {/* 桌面端头部 */}
      <div className="hidden lg:flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">VPS 实例</h1>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />刷新
          </Button>
          {!hasActiveInstance && (
            <Button onClick={openSubscribeModal} isLoading={subscribing}>
              <CreditCard className="w-4 h-4 mr-2" />购买订阅
            </Button>
          )}
        </div>
      </div>

      {showHelp && (
        <Card className="border-brand-primary/30 bg-brand-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-primary/20 flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="w-5 h-5 text-brand-primary" />
                </div>
                <div>
                  <h3 className="text-text-primary font-medium mb-2">VPS 实例说明</h3>
                  <p className="text-text-secondary text-sm mb-3">
                    VPS 实例是运行量化策略的独立服务器。购买订阅后，系统会自动创建专属 VPS，订阅到期后 VPS 会自动销毁。
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Zap className="w-4 h-4 text-warning" /><span>策略 24/7 自动运行</span>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Shield className="w-4 h-4 text-success" /><span>独立隔离，数据安全</span>
                    </div>
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Clock className="w-4 h-4 text-brand-primary" /><span>订阅到期自动备份销毁</span>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowHelp(false)} className="text-text-tertiary hover:text-text-secondary p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-brand-primary/20 flex items-center justify-between">
              <p className="text-text-tertiary text-xs">
                订阅费 {SUBSCRIPTION_FEE} USDT/月，可用积分抵扣。订阅期间 VPS 由系统自动管理。
              </p>
              <a href="/help" className="flex items-center gap-1 text-brand-primary text-sm hover:underline">
                查看详细教程<ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {showSubscribeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-secondary rounded-xl p-6 w-full max-w-md mx-4 border border-border-secondary">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">购买 VPS 订阅</h2>
              <button onClick={() => setShowSubscribeModal(false)} className="text-text-secondary hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-lg p-4 mb-4">
              <p className="text-brand-primary text-sm">
                购买订阅后，系统将自动为您创建专属 VPS 实例。订阅到期后 VPS 会自动销毁并备份数据。
              </p>
            </div>
            <div className="space-y-4">
              <div className="bg-bg-tertiary rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-text-secondary">订阅费用</span>
                  <span className="text-white font-medium">{SUBSCRIPTION_FEE} USDT/月</span>
                </div>
                <p className="text-text-tertiary text-sm">首月订阅费将从您的账户扣除</p>
              </div>
              <div className="bg-bg-tertiary rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-4 h-4 text-warning" />
                  <span className="text-text-secondary">积分余额</span>
                  <span className="text-warning font-medium ml-auto">{parseFloat(pointsBalance).toFixed(2)} 积分</span>
                </div>
                <p className="text-text-tertiary text-sm">1 积分 = 1 USDT，可用于抵扣订阅费</p>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)}
                  className="w-5 h-5 rounded border-border-secondary bg-bg-tertiary text-brand-primary focus:ring-brand-primary" />
                <span className="text-white">使用积分抵扣</span>
              </label>
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
                      <span className="text-warning">-{Math.min(parseFloat(pointsBalance), SUBSCRIPTION_FEE).toFixed(2)} USDT</span>
                    </div>
                    <div className="border-t border-border-secondary my-2"></div>
                    <div className="flex justify-between font-medium">
                      <span className="text-text-secondary">实际支付</span>
                      <span className="text-success">{Math.max(SUBSCRIPTION_FEE - parseFloat(pointsBalance), 0).toFixed(2)} USDT</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="ghost" className="flex-1" onClick={() => setShowSubscribeModal(false)}>取消</Button>
              <Button className="flex-1" onClick={handleSubscribe} isLoading={subscribing}>确认订阅</Button>
            </div>
          </div>
        </div>
      )}

      {activeInstances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Server className="w-16 h-16 mx-auto mb-4 text-text-disabled" />
            <h3 className="text-lg font-medium text-white mb-2">暂无 VPS 实例</h3>
            <p className="text-text-secondary mb-6">购买订阅后，系统将自动为您创建专属 VPS 实例</p>
            <Button onClick={openSubscribeModal} isLoading={subscribing}>
              <CreditCard className="w-4 h-4 mr-2" />购买订阅
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
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${instance.status === 'running' ? 'bg-success/20' : 'bg-bg-tertiary'}`}>
                      <Server className={`w-6 h-6 ${instance.status === 'running' ? 'text-success' : 'text-text-secondary'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-white font-medium">{instance.ip_address || '分配中...'}</h3>
                        {getStatusBadge(instance.status)}
                      </div>
                      <p className="text-text-tertiary text-sm">{instance.region} • ID: {instance.id.slice(0, 8)}...</p>
                      {instance.last_heartbeat && (
                        <p className="text-text-tertiary text-xs mt-1">最后心跳: {formatDateTime(instance.last_heartbeat)}</p>
                      )}
                    </div>
                  </div>
                  <a href={`/instances/${instance.id}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-tertiary text-text-secondary hover:text-white hover:bg-bg-tertiary/80 transition-colors">
                    <Eye className="w-4 h-4" /><span className="hidden sm:inline">查看详情</span>
                  </a>
                </div>
                {instance.status === 'running' && (
                  <div className="mt-4 pt-4 border-t border-border-primary grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-text-tertiary" />
                      <span className="text-text-secondary text-sm">CPU:</span>
                      <span className="text-white text-sm">{instance.cpu_usage ? `${instance.cpu_usage}%` : '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-text-tertiary" />
                      <span className="text-text-secondary text-sm">内存:</span>
                      <span className="text-white text-sm">{instance.memory_usage ? `${instance.memory_usage}%` : '-'}</span>
                    </div>
                  </div>
                )}
                {instance.status === 'zombie' && (
                  <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-warning" />
                    <span className="text-warning text-sm">此实例已超过 15 分钟无心跳，将被自动销毁</span>
                  </div>
                )}
                {instance.status === 'provisioning' && (
                  <div className="mt-4 p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-lg flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-brand-primary animate-spin" />
                    <span className="text-brand-primary text-sm">VPS 正在创建中，请稍候...</span>
                  </div>
                )}
                {instance.status === 'error' && (
                  <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="text-danger text-sm font-medium">VPS 创建失败</span>
                      <p className="text-danger/80 text-xs mt-1">系统遇到问题，请联系客服处理。您的订阅费用不会被扣除。</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-brand-primary" />备份记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无备份记录</p>
              <p className="text-text-tertiary text-sm mt-2">VPS 销毁时系统会自动备份数据</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.slice(0, 10).map((backup) => (
                <div key={backup.id} className="flex items-center justify-between p-3 bg-bg-tertiary/50 rounded-lg">
                  <div>
                    <p className="text-white text-sm font-medium">实例: {backup.instanceId.slice(0, 8)}...</p>
                    <p className="text-text-tertiary text-xs">{formatDateTime(backup.createdAt)} • {(backup.sizeBytes / 1024).toFixed(2)} KB</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${backup.status === 'completed' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
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
