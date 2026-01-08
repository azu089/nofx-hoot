'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { MobileHeader } from '@/components/ui';
import {
  AlertTriangle,
  Power,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { instancesApi } from '@/lib/api';
import { toast } from 'sonner';

interface Instance {
  id: string;
  status: string;
  ip_address: string;
  region: string;
  cpu_usage: string | null;
  memory_usage: string | null;
  last_heartbeat: string | null;
}

interface PanicLog {
  id: number;
  action: string;
  status: 'success' | 'failed';
  time: string;
  details: string;
}

export default function PanicPage() {
  // 加载状态
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 确认弹窗状态
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [password, setPassword] = useState('');

  // 操作日志（本地存储）
  const [panicLogs, setPanicLogs] = useState<PanicLog[]>([]);

  // 运行中的实例
  const [runningInstances, setRunningInstances] = useState<Instance[]>([]);

  // 加载数据
  useEffect(() => {
    fetchData();
    // 从 localStorage 恢复操作日志
    const savedLogs = localStorage.getItem('panicLogs');
    if (savedLogs) {
      try {
        setPanicLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error('Failed to parse panic logs:', e);
      }
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await instancesApi.list();
      if (res.code === 0) {
        // 只显示运行中的实例
        const running = res.data.filter((i: Instance) => i.status === 'running');
        setRunningInstances(running);
      }
    } catch (error) {
      console.error('Failed to fetch instances:', error);
      toast.error('获取实例列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 添加操作日志
  const addLog = (action: string, status: 'success' | 'failed', details: string) => {
    const newLog: PanicLog = {
      id: Date.now(),
      action,
      status,
      time: new Date().toLocaleString('zh-CN'),
      details,
    };
    const updatedLogs = [newLog, ...panicLogs].slice(0, 20); // 只保留最近 20 条
    setPanicLogs(updatedLogs);
    localStorage.setItem('panicLogs', JSON.stringify(updatedLogs));
  };

  // 一键清仓
  const handlePanicSell = async () => {
    if (!password) {
      toast.error('请输入密码确认');
      return;
    }

    try {
      setSubmitting(true);
      const res = await instancesApi.panicSell();

      if (res.code === 0) {
        const { instancesProcessed, successCount, failedCount } = res.data;

        if (successCount > 0) {
          toast.success(`一键清仓成功！处理了 ${instancesProcessed} 个实例`);
          addLog(
            '一键清仓',
            'success',
            `成功清仓 ${successCount} 个实例${failedCount > 0 ? `，${failedCount} 个失败` : ''}`
          );
        } else if (instancesProcessed === 0) {
          toast.info('没有运行中的实例需要清仓');
          addLog('一键清仓', 'success', '没有运行中的实例');
        } else {
          toast.error(`清仓失败：${failedCount} 个实例处理失败`);
          addLog('一键清仓', 'failed', `${failedCount} 个实例处理失败`);
        }

        // 刷新实例列表
        await fetchData();
      } else {
        toast.error(res.message || '操作失败');
        addLog('一键清仓', 'failed', res.message || '未知错误');
      }

      setShowPanicModal(false);
      setPassword('');
    } catch (error: any) {
      console.error('一键清仓失败:', error);
      toast.error('操作失败，请稍后重试');
      addLog('一键清仓', 'failed', error.message || '网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  // 停止所有机器人
  const handleStopAll = async () => {
    if (!password) {
      toast.error('请输入密码确认');
      return;
    }

    try {
      setSubmitting(true);
      const res = await instancesApi.stopAll();

      if (res.code === 0) {
        const { stoppedCount, failedCount } = res.data;

        if (stoppedCount > 0) {
          toast.success(`已停止 ${stoppedCount} 个实例`);
          addLog(
            '停止所有机器人',
            'success',
            `成功停止 ${stoppedCount} 个实例${failedCount > 0 ? `，${failedCount} 个失败` : ''}`
          );
        } else if (stoppedCount === 0 && failedCount === 0) {
          toast.info('没有运行中的实例');
          addLog('停止所有机器人', 'success', '没有运行中的实例');
        } else {
          toast.error(`停止失败：${failedCount} 个实例处理失败`);
          addLog('停止所有机器人', 'failed', `${failedCount} 个实例处理失败`);
        }

        // 刷新实例列表
        await fetchData();
      } else {
        toast.error(res.message || '操作失败');
        addLog('停止所有机器人', 'failed', res.message || '未知错误');
      }

      setShowStopModal(false);
      setPassword('');
    } catch (error: any) {
      console.error('停止失败:', error);
      toast.error('操作失败，请稍后重试');
      addLog('停止所有机器人', 'failed', error.message || '网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 pb-20 lg:pb-6">
      <MobileHeader title="紧急按钮" subtitle="在紧急情况下快速止损或停止交易" />

      {/* 警告提示 */}
      <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
        <div className="text-sm text-danger">
          <p className="font-semibold mb-1">⚠️ 危险操作区域</p>
          <p>
            这些操作将立即执行且不可撤销，请谨慎使用。建议只在市场剧烈波动或系统异常时使用。
          </p>
        </div>
      </div>

      {/* 当前状态 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Power className="w-5 h-5" />
            运行中的交易实例
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runningInstances.length === 0 ? (
            <div className="text-center py-8">
              <Power className="w-12 h-12 mx-auto text-text-tertiary opacity-50 mb-3" />
              <p className="text-text-secondary">当前没有运行中的交易实例</p>
              <p className="text-xs text-text-tertiary mt-1">所有实例已停止或未创建</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">运行实例数</span>
                <span className="text-2xl font-bold text-white">
                  {runningInstances.length}
                </span>
              </div>
              <div className="space-y-2">
                {runningInstances.map((instance) => (
                  <div key={instance.id} className="flex items-center gap-2 p-2 bg-bg-tertiary/30 rounded-lg">
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                    <span className="text-sm text-text-secondary font-mono">
                      {instance.id.substring(0, 8)}...
                    </span>
                    <span className="text-xs text-text-tertiary">
                      {instance.region || '未知区域'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 紧急操作按钮 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 一键清仓 */}
        <Card className="border-danger/20">
          <CardHeader className="border-b border-danger/20">
            <CardTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="w-5 h-5" />
              一键清仓 (Panic Sell)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="text-sm text-text-secondary space-y-2">
              <p>
                <strong className="text-white">功能说明：</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-text-tertiary">
                <li>立即卖出所有持仓币种</li>
                <li>全部换成 USDT 稳定币</li>
                <li>按市价单执行，可能有滑点</li>
                <li>操作不可撤销</li>
              </ul>
            </div>

            <div className="p-3 bg-danger/10 rounded-lg text-xs text-danger">
              💡 建议在市场暴跌、风险突增时使用，以快速止损。
            </div>

            <Button
              variant="danger"
              className="w-full"
              size="lg"
              onClick={() => setShowPanicModal(true)}
              disabled={runningInstances.length === 0}
            >
              <AlertTriangle className="w-5 h-5 mr-2" />
              一键清仓
            </Button>
          </CardContent>
        </Card>

        {/* 停止所有机器人 */}
        <Card className="border-warning/20">
          <CardHeader className="border-b border-warning/20">
            <CardTitle className="flex items-center gap-2 text-warning">
              <Power className="w-5 h-5" />
              停止所有机器人
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="text-sm text-text-secondary space-y-2">
              <p>
                <strong className="text-white">功能说明：</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-text-tertiary">
                <li>停止所有自动交易实例</li>
                <li>保持当前持仓不变</li>
                <li>可随时手动重启</li>
                <li>不会清空持仓</li>
              </ul>
            </div>

            <div className="p-3 bg-warning/10 rounded-lg text-xs text-warning">
              💡 建议在需要暂停交易、观望市场时使用。
            </div>

            <Button
              variant="danger"
              className="w-full bg-warning hover:bg-warning/90"
              size="lg"
              onClick={() => setShowStopModal(true)}
              disabled={runningInstances.length === 0}
            >
              <Power className="w-5 h-5 mr-2" />
              停止所有机器人
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 操作日志 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            操作日志
          </CardTitle>
        </CardHeader>
        <CardContent>
          {panicLogs.length === 0 ? (
            <div className="text-center py-8 text-text-tertiary">
              <Clock className="w-12 h-12 mx-auto opacity-50 mb-3" />
              <p>暂无操作记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {panicLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-4 bg-bg-tertiary/50 rounded-lg"
                >
                  {log.status === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white">{log.action}</span>
                      <span className="text-sm text-text-secondary">{log.time}</span>
                    </div>
                    <p className="text-sm text-text-secondary">{log.details}</p>
                    <span
                      className={`text-xs font-medium ${
                        log.status === 'success' ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {log.status === 'success' ? '执行成功' : '执行失败'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 一键清仓确认弹窗 */}
      <Modal
        open={showPanicModal}
        onClose={() => {
          setShowPanicModal(false);
          setPassword('');
        }}
        title="⚠️ 确认一键清仓"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg">
            <p className="text-danger text-sm">
              <strong>警告：</strong>
              此操作将立即卖出所有 {runningInstances.length} 个运行中实例的全部持仓，换成 USDT。操作不可撤销！
            </p>
          </div>

          <div className="space-y-2 text-sm text-text-secondary">
            <p>将执行以下操作：</p>
            <ul className="list-disc list-inside space-y-1 text-text-tertiary">
              {runningInstances.map((instance) => (
                <li key={instance.id}>
                  清仓实例 {instance.id.substring(0, 8)}...
                </li>
              ))}
            </ul>
          </div>

          <Input
            label="输入密码确认"
            type="password"
            placeholder="请输入账户密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowPanicModal(false);
                setPassword('');
              }}
            >
              取消
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handlePanicSell}
              disabled={!password || submitting}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                '确认清仓'
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 停止所有机器人确认弹窗 */}
      <Modal
        open={showStopModal}
        onClose={() => {
          setShowStopModal(false);
          setPassword('');
        }}
        title="⚠️ 确认停止所有机器人"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <p className="text-warning text-sm">
              <strong>提示：</strong>
              此操作将停止所有运行中的交易实例（共 {runningInstances.length}{' '}
              个），但不会清空持仓。
            </p>
          </div>

          <div className="space-y-2 text-sm text-text-secondary">
            <p>将停止以下实例：</p>
            <ul className="list-disc list-inside space-y-1 text-text-tertiary">
              {runningInstances.map((instance) => (
                <li key={instance.id}>
                  {instance.id.substring(0, 8)}... ({instance.region || '未知区域'})
                </li>
              ))}
            </ul>
          </div>

          <Input
            label="输入密码确认"
            type="password"
            placeholder="请输入账户密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowStopModal(false);
                setPassword('');
              }}
            >
              取消
            </Button>
            <Button
              variant="danger"
              className="flex-1 bg-warning hover:bg-warning/90"
              onClick={handleStopAll}
              disabled={!password || submitting}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                '确认停止'
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
