'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  AlertTriangle,
  Power,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export default function PanicPage() {
  // 确认弹窗状态
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  // 操作日志
  const [panicLogs, setPanicLogs] = useState([
    {
      id: 1,
      action: '一键清仓',
      status: 'success',
      time: '2025-12-20 15:30:25',
      details: '已将 BTC/ETH/SOL 全部卖出，收益 +$1,234.56',
    },
    {
      id: 2,
      action: '停止所有机器人',
      status: 'success',
      time: '2025-12-15 10:15:00',
      details: '已停止 3 个交易实例',
    },
    {
      id: 3,
      action: '一键清仓',
      status: 'failed',
      time: '2025-12-10 08:45:30',
      details: '交易所 API 超时，部分订单未成交',
    },
  ]);

  // 当前持仓统计（示例数据）
  const [positions, setPositions] = useState({
    totalValue: 12345.67,
    btc: { amount: 0.5, value: 5000 },
    eth: { amount: 2.3, value: 4500 },
    sol: { amount: 100, value: 2845.67 },
  });

  // 运行中的机器人统计
  const [runningBots, setRunningBots] = useState({
    total: 3,
    instances: ['VPS-001', 'VPS-002', 'VPS-003'],
  });

  // 一键清仓
  const handlePanicSell = async () => {
    if (!password) {
      alert('请输入密码确认');
      return;
    }

    try {
      // TODO: 调用 API - POST /api/instances/panic-sell
      console.log('一键清仓:', { password });

      // 添加日志
      setPanicLogs([
        {
          id: Date.now(),
          action: '一键清仓',
          status: 'success',
          time: new Date().toLocaleString('zh-CN'),
          details: `已将所有持仓卖出，总价值 $${positions.totalValue.toFixed(2)}`,
        },
        ...panicLogs,
      ]);

      // 清空持仓
      setPositions({
        totalValue: 0,
        btc: { amount: 0, value: 0 },
        eth: { amount: 0, value: 0 },
        sol: { amount: 0, value: 0 },
      });

      setShowPanicModal(false);
      setPassword('');
      alert('一键清仓成功！所有持仓已卖出');
    } catch (error) {
      console.error('一键清仓失败:', error);
      alert('操作失败，请稍后重试');
    }
  };

  // 停止所有机器人
  const handleStopAll = async () => {
    if (!password) {
      alert('请输入密码确认');
      return;
    }

    try {
      // TODO: 调用 API - POST /api/instances/stop-all
      console.log('停止所有机器人:', { password });

      // 添加日志
      setPanicLogs([
        {
          id: Date.now(),
          action: '停止所有机器人',
          status: 'success',
          time: new Date().toLocaleString('zh-CN'),
          details: `已停止 ${runningBots.total} 个交易实例`,
        },
        ...panicLogs,
      ]);

      // 清空运行中的机器人
      setRunningBots({
        total: 0,
        instances: [],
      });

      setShowStopModal(false);
      setPassword('');
      alert('已停止所有机器人');
    } catch (error) {
      console.error('停止失败:', error);
      alert('操作失败，请稍后重试');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-8 h-8 text-danger" />
        <div>
          <h1 className="text-2xl font-bold text-white">紧急按钮</h1>
          <p className="text-sm text-text-secondary">在紧急情况下快速止损或停止交易</p>
        </div>
      </div>

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 持仓统计 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="w-5 h-5" />
              当前持仓
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">总价值</span>
                <span className="text-2xl font-bold text-white">
                  ${positions.totalValue.toFixed(2)}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">BTC</span>
                  <span className="text-white">
                    {positions.btc.amount} (${positions.btc.value.toFixed(2)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">ETH</span>
                  <span className="text-white">
                    {positions.eth.amount} (${positions.eth.value.toFixed(2)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">SOL</span>
                  <span className="text-white">
                    {positions.sol.amount} (${positions.sol.value.toFixed(2)})
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 运行中的机器人 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Power className="w-5 h-5" />
              运行中的机器人
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">运行实例</span>
                <span className="text-2xl font-bold text-white">
                  {runningBots.total}
                </span>
              </div>
              {runningBots.instances.length > 0 && (
                <div className="space-y-1 text-sm">
                  {runningBots.instances.map((instance, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-success rounded-full animate-pulse" />
                      <span className="text-text-secondary">{instance}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
          <CardContent className="space-y-4">
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
              disabled={positions.totalValue === 0}
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
          <CardContent className="space-y-4">
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
              disabled={runningBots.total === 0}
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
          <div className="space-y-2">
            {panicLogs.length === 0 ? (
              <div className="text-center py-8 text-text-tertiary">
                <p>暂无操作记录</p>
              </div>
            ) : (
              panicLogs.map((log) => (
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
              ))
            )}
          </div>
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
              此操作将立即卖出所有持仓（总价值 $
              {positions.totalValue.toFixed(2)}），换成 USDT。操作不可撤销！
            </p>
          </div>

          <div className="space-y-2 text-sm text-text-secondary">
            <p>将执行以下操作：</p>
            <ul className="list-disc list-inside space-y-1 text-text-tertiary">
              <li>卖出 {positions.btc.amount} BTC</li>
              <li>卖出 {positions.eth.amount} ETH</li>
              <li>卖出 {positions.sol.amount} SOL</li>
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
              disabled={!password}
            >
              确认清仓
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
              此操作将停止所有运行中的交易实例（共 {runningBots.total}{' '}
              个），但不会清空持仓。
            </p>
          </div>

          <div className="space-y-2 text-sm text-text-secondary">
            <p>将停止以下实例：</p>
            <ul className="list-disc list-inside space-y-1 text-text-tertiary">
              {runningBots.instances.map((instance, index) => (
                <li key={index}>{instance}</li>
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
              disabled={!password}
            >
              确认停止
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
