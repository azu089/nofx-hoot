'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { gamefiApi } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  ArrowRightLeft,
  Coins,
  Zap,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { MobileHeader } from '@/components/ui';

interface PointsHistory {
  id: string;
  billingType: string;
  amount: string;
  description: string | null;
  createdAt: string;
}

export default function ExchangePage() {
  const router = useRouter();
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
      // 积分历史在 data.history 中
      setHistory(historyRes.data?.history || []);
    } catch (error) {
      console.error('Failed to fetch exchange data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExchange = async () => {
    const points = parseInt(exchangePoints);
    if (!points || points <= 0) {
      alert('请输入有效积分数量');
      return;
    }

    if (points > parseFloat(pointsBalance)) {
      alert('积分不足');
      return;
    }

    if (points < 100) {
      alert('最低兑换 100 积分');
      return;
    }

    setExchanging(true);
    try {
      const result = await gamefiApi.exchangeTokens({
        points: points.toString(),
        mode: exchangeMode === 'instant' ? 'fast' : 'standard',
      });
      setExchangePoints('');
      fetchData();
      const tokensReceived = result.data?.tokensReceived || '0';
      alert(`兑换成功！获得 ${tokensReceived} $QFI 代币`);
    } catch (error) {
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
      <div className="space-y-6">
        <MobileHeader title="积分兑换" />
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-bg-tertiary rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const pointsNum = parseInt(exchangePoints) || 0;

  return (
    <div className="space-y-6">
      <MobileHeader title="积分兑换" subtitle="将积分兑换为 USDT" />

      {/* 积分余额 */}
      <Card className="bg-gradient-to-br from-warning/10 to-warning/20 border-warning/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm">积分余额</p>
              <p className="text-4xl font-bold text-warning mt-1">
                {parseFloat(pointsBalance).toLocaleString()}
              </p>
              <p className="text-text-tertiary text-sm mt-1">
                ≈ {formatCurrency((parseFloat(pointsBalance) / 100).toString())}
              </p>
            </div>
            <div className="w-16 h-16 bg-warning/20 rounded-xl flex items-center justify-center">
              <Coins className="w-10 h-10 text-warning" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 兑换表单 */}
      <Card>
        <CardHeader>
          <CardTitle>兑换 USDT</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 兑换模式 */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">兑换模式</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setExchangeMode('standard')}
                className={`p-4 rounded-lg border transition ${
                  exchangeMode === 'standard'
                    ? 'border-brand-primary bg-brand-primary/10'
                    : 'border-border-secondary hover:border-border-primary'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-brand-primary" />
                  <p className="text-white font-medium">标准兑换</p>
                </div>
                <p className="text-text-tertiary text-sm">100 积分 = 1 USDT</p>
                <p className="text-text-disabled text-xs mt-1">T+1 到账</p>
              </button>
              <button
                onClick={() => setExchangeMode('instant')}
                className={`p-4 rounded-lg border transition ${
                  exchangeMode === 'instant'
                    ? 'border-warning bg-warning/10'
                    : 'border-border-secondary hover:border-border-primary'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-warning" />
                  <p className="text-white font-medium">急速兑换</p>
                </div>
                <p className="text-text-tertiary text-sm">100 积分 = 0.8 USDT</p>
                <p className="text-text-disabled text-xs mt-1">即时到账</p>
              </button>
            </div>
          </div>

          {/* 兑换数量 */}
          <Input
            label="兑换积分数量"
            type="number"
            placeholder="最低 100 积分"
            value={exchangePoints}
            onChange={(e) => setExchangePoints(e.target.value)}
          />
          <div className="flex justify-between text-sm">
            <span className="text-text-tertiary">
              可用: {parseFloat(pointsBalance).toLocaleString()} 积分
            </span>
            <button
              className="text-brand-primary hover:text-brand-primary/80"
              onClick={() => setExchangePoints(pointsBalance)}
            >
              全部兑换
            </button>
          </div>

          {/* 预估到账 */}
          {pointsNum >= 100 && (
            <div className="p-4 bg-bg-tertiary/50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-text-secondary">预估到账</span>
                <span className="text-success text-xl font-bold">
                  {calculateUsdt(pointsNum, exchangeMode).toFixed(2)} USDT
                </span>
              </div>
              {exchangeMode === 'instant' && (
                <p className="text-warning text-xs mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  急速兑换扣除 20% 手续费
                </p>
              )}
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleExchange}
            isLoading={exchanging}
            disabled={pointsNum < 100}
          >
            确认兑换
          </Button>
        </CardContent>
      </Card>

      {/* 积分历史 */}
      <Card>
        <CardHeader>
          <CardTitle>积分记录</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-text-secondary">
              <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无积分记录</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {history.map((item) => {
                const isPositive = parseFloat(item.amount) > 0;

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-bg-tertiary/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-bg-tertiary rounded-full flex items-center justify-center">
                        {getHistoryIcon(item.billingType)}
                      </div>
                      <div>
                        <p className="text-white text-sm">{item.description || item.billingType}</p>
                        <p className="text-text-tertiary text-xs">
                          {formatDateTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`font-medium ${
                        isPositive ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {parseFloat(item.amount).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
