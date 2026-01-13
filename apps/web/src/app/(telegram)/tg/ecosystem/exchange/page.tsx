'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { gamefiApi } from '@/lib/api';
import {
  ArrowLeft,
  ArrowRightLeft,
  Coins,
  Zap,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/pull-to-refresh';

interface PointsHistory {
  id: string;
  billingType: string;
  amount: string;
  description: string | null;
  createdAt: string;
}

export default function TgExchangePage() {
  const router = useRouter();
  const { haptic } = useTelegramContext();
  const [pointsBalance, setPointsBalance] = useState('0');
  const [history, setHistory] = useState<PointsHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // 兑换表单
  const [exchangeMode, setExchangeMode] = useState<'standard' | 'instant'>('standard');
  const [exchangePoints, setExchangePoints] = useState('');
  const [exchanging, setExchanging] = useState(false);

  const fetchData = async () => {
    try {
      const [pointsRes, historyRes] = await Promise.all([
        gamefiApi.getPointsBalance(),
        gamefiApi.getPointsHistory(20),
      ]);
      setPointsBalance(pointsRes.data?.available || '0');
      setHistory(historyRes.data?.history || []);
    } catch (error) {
      console.error('Failed to fetch exchange data:', error);
    } finally {
      setLoading(false);
    }
  };

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      haptic('impact_light');
      await fetchData();
      haptic('notification_success');
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const handleExchange = async () => {
    const points = parseInt(exchangePoints);
    if (!points || points <= 0) {
      haptic('notification_error');
      alert('请输入有效积分数量');
      return;
    }

    if (points > parseFloat(pointsBalance)) {
      haptic('notification_error');
      alert('积分不足');
      return;
    }

    if (points < 100) {
      haptic('notification_error');
      alert('最低兑换 100 积分');
      return;
    }

    setExchanging(true);
    haptic('impact_medium');
    try {
      const result = await gamefiApi.exchangeTokens({
        points: points.toString(),
        mode: exchangeMode === 'instant' ? 'fast' : 'standard',
      });
      setExchangePoints('');
      fetchData();
      haptic('notification_success');
      const tokensReceived = result.data?.tokensReceived || '0';
      alert(`兑换成功！获得 ${tokensReceived} $QFI 代币`);
    } catch (error) {
      haptic('notification_error');
      alert(error instanceof Error ? error.message : '兑换失败');
    } finally {
      setExchanging(false);
    }
  };

  const calculateUsdt = (points: number, mode: 'standard' | 'instant') => {
    const rate = mode === 'instant' ? 0.8 : 1.0;
    return (points / 100) * rate;
  };

  const getHistoryIcon = (type: string) => {
    switch (type) {
      case 'points_earn':
      case 'stake_reward':
        return <Coins className="w-4 h-4 text-warning" />;
      case 'points_deduct':
      case 'exchange':
        return <ArrowRightLeft className="w-4 h-4 text-brand-primary" />;
      case 'bonus':
        return <Zap className="w-4 h-4 text-success" />;
      default:
        return <Clock className="w-4 h-4 text-text-secondary" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-bg-tertiary/50 rounded-lg w-32" />
        <div className="h-24 bg-bg-tertiary/50 rounded-xl" />
        <div className="h-48 bg-bg-tertiary/50 rounded-xl" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-bg-tertiary/50 rounded-xl" />
        ))}
      </div>
    );
  }

  const pointsNum = parseInt(exchangePoints) || 0;

  return (
    <>
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      <div className="space-y-4 pb-24">
        {/* 顶部 */}
        <button
          onClick={() => { haptic('selection'); router.back(); }}
          className="flex items-center gap-2 text-text-secondary"
        >
          <ArrowLeft size={20} />
          <span className="text-lg font-medium text-white">积分兑换</span>
        </button>

        {/* 积分余额 */}
        <div className="bg-gradient-to-r from-warning/20 to-warning/10 border border-warning/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">积分余额</p>
              <p className="text-3xl font-bold text-warning mt-1">
                {parseFloat(pointsBalance).toLocaleString()}
              </p>
              <p className="text-text-tertiary text-xs mt-1">
                ≈ ${(parseFloat(pointsBalance) / 100).toFixed(2)} USDT
              </p>
            </div>
            <div className="w-14 h-14 bg-warning/20 rounded-xl flex items-center justify-center">
              <Coins className="w-8 h-8 text-warning" />
            </div>
          </div>
        </div>

        {/* 兑换模式选择 */}
        <div className="space-y-2">
          <p className="text-sm text-text-secondary">选择兑换模式</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setExchangeMode('standard'); haptic('selection'); }}
              className={`p-3 rounded-xl border transition ${
                exchangeMode === 'standard'
                  ? 'border-brand-primary bg-brand-primary/10'
                  : 'border-border-primary bg-bg-secondary'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-brand-primary" />
                <p className="text-white font-medium text-sm">标准兑换</p>
              </div>
              <p className="text-text-tertiary text-xs">100 积分 = 1 USDT</p>
              <p className="text-text-disabled text-[10px] mt-1">T+1 到账</p>
            </button>
            <button
              onClick={() => { setExchangeMode('instant'); haptic('selection'); }}
              className={`p-3 rounded-xl border transition ${
                exchangeMode === 'instant'
                  ? 'border-warning bg-warning/10'
                  : 'border-border-primary bg-bg-secondary'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-warning" />
                <p className="text-white font-medium text-sm">急速兑换</p>
              </div>
              <p className="text-text-tertiary text-xs">100 积分 = 0.8 USDT</p>
              <p className="text-text-disabled text-[10px] mt-1">即时到账</p>
            </button>
          </div>
        </div>

        {/* 兑换数量 */}
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-text-secondary">兑换积分</label>
            <button
              onClick={() => { setExchangePoints(pointsBalance); haptic('selection'); }}
              className="text-xs text-brand-primary"
            >
              全部兑换
            </button>
          </div>
          <input
            type="number"
            placeholder="最低 100 积分"
            value={exchangePoints}
            onChange={(e) => setExchangePoints(e.target.value)}
            className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-4 py-3 text-white text-lg font-medium placeholder:text-text-tertiary focus:outline-none focus:border-brand-primary"
          />
          <p className="text-xs text-text-tertiary">
            可用: {parseFloat(pointsBalance).toLocaleString()} 积分
          </p>

          {/* 预估到账 */}
          {pointsNum >= 100 && (
            <div className="p-3 bg-bg-tertiary/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary text-sm">预估到账</span>
                <span className="text-success text-lg font-bold">
                  {calculateUsdt(pointsNum, exchangeMode).toFixed(2)} USDT
                </span>
              </div>
              {exchangeMode === 'instant' && (
                <p className="text-warning text-[10px] mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  急速兑换扣除 20% 手续费
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleExchange}
            disabled={pointsNum < 100 || exchanging}
            className="w-full py-3 bg-brand-primary text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exchanging ? '兑换中...' : '确认兑换'}
          </button>
        </div>

        {/* 积分历史 */}
        <div className="space-y-2">
          <h3 className="text-white font-medium">积分记录</h3>
          {history.length === 0 ? (
            <div className="py-8 text-center bg-bg-secondary border border-border-primary rounded-xl">
              <Coins className="w-10 h-10 text-text-tertiary mx-auto mb-2" />
              <p className="text-text-secondary text-sm">暂无积分记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 10).map((item) => {
                const isPositive = parseFloat(item.amount) > 0;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-bg-secondary border border-border-primary rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-bg-tertiary rounded-full flex items-center justify-center">
                        {getHistoryIcon(item.billingType)}
                      </div>
                      <div>
                        <p className="text-white text-sm">{item.description || item.billingType}</p>
                        <p className="text-text-tertiary text-xs">
                          {new Date(item.createdAt).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <p className={`font-medium ${isPositive ? 'text-success' : 'text-danger'}`}>
                      {isPositive ? '+' : ''}{parseFloat(item.amount).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
