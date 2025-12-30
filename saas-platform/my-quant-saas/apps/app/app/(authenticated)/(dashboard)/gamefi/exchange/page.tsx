'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import { Input } from '@repo/design-system/components/ui/input';
import {
  Coins,
  ArrowRight,
  Zap,
  Clock,
  Info,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';

// 兑换配置
const exchangeConfig = {
  standard: {
    name: '标准模式',
    rate: 100, // 100积分 = 1 USDT
    minPoints: 1000,
    fee: 0,
    processingTime: '1-3 个工作日',
    description: '无手续费，正常到账',
  },
  express: {
    name: '急速模式',
    rate: 110, // 110积分 = 1 USDT
    minPoints: 500,
    fee: 10,
    processingTime: '即时到账',
    description: '10%手续费，即时到账',
  },
};

// 模拟用户数据
const mockUserData = {
  availablePoints: 125000,
  pendingPoints: 15000,
  totalExchanged: 850,
  exchangeHistory: [
    { id: '1', points: 10000, usdt: 100, mode: 'standard', status: 'completed', time: '2024-01-15 10:23' },
    { id: '2', points: 5500, usdt: 50, mode: 'express', status: 'completed', time: '2024-01-14 18:45' },
    { id: '3', points: 20000, usdt: 200, mode: 'standard', status: 'processing', time: '2024-01-14 09:12' },
  ],
};

export default function ExchangePage() {
  const [mode, setMode] = useState<'standard' | 'express'>('standard');
  const [pointsInput, setPointsInput] = useState('');
  const [exchanging, setExchanging] = useState(false);

  const config = exchangeConfig[mode];
  const points = parseInt(pointsInput) || 0;
  const usdtAmount = points / config.rate;
  const fee = mode === 'express' ? usdtAmount * 0.1 : 0;
  const netAmount = usdtAmount - fee;

  const handleExchange = async () => {
    if (points < config.minPoints) {
      alert(`最低兑换 ${config.minPoints.toLocaleString()} 积分`);
      return;
    }

    if (points > mockUserData.availablePoints) {
      alert('可用积分不足');
      return;
    }

    setExchanging(true);
    // TODO: Implement API call
    setTimeout(() => {
      setExchanging(false);
      setPointsInput('');
      alert(mode === 'express' ? '兑换成功！USDT 已到账' : '兑换申请已提交，请等待处理');
    }, 1000);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">积分兑换</h1>
        <p className="text-muted-foreground">使用积分兑换 USDT</p>
      </div>

      {/* 积分余额 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-r from-yellow-500/20 to-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Coins className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">可用积分</p>
                <p className="text-2xl font-bold">{mockUserData.availablePoints.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">待释放积分</p>
                <p className="text-2xl font-bold">{mockUserData.pendingPoints.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">累计兑换</p>
                <p className="text-2xl font-bold">${mockUserData.totalExchanged}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 兑换表单 */}
        <Card>
          <CardHeader>
            <CardTitle>积分兑换 USDT</CardTitle>
            <CardDescription>选择兑换模式并输入积分数量</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 模式选择 */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('standard')}
                className={`p-4 rounded-lg border text-left transition ${
                  mode === 'standard'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">标准模式</span>
                </div>
                <p className="text-sm text-muted-foreground">100:1 汇率</p>
                <p className="text-sm text-green-500">0% 手续费</p>
              </button>

              <button
                onClick={() => setMode('express')}
                className={`p-4 rounded-lg border text-left transition ${
                  mode === 'express'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <span className="font-medium">急速模式</span>
                </div>
                <p className="text-sm text-muted-foreground">110:1 汇率</p>
                <p className="text-sm text-yellow-500">即时到账</p>
              </button>
            </div>

            {/* 积分输入 */}
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                兑换积分
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                  placeholder={`最低 ${config.minPoints.toLocaleString()} 积分`}
                  className="pr-16"
                />
                <button
                  onClick={() => setPointsInput(mockUserData.availablePoints.toString())}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-primary"
                >
                  全部
                </button>
              </div>
            </div>

            {/* 兑换预览 */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">支付积分</p>
                  <p className="text-xl font-bold">{points.toLocaleString()}</p>
                </div>
                <ArrowRight className="w-6 h-6 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">获得 USDT</p>
                  <p className="text-xl font-bold text-green-500">${netAmount.toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">兑换汇率</span>
                  <span>{config.rate}:1</span>
                </div>
                {mode === 'express' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">手续费 (10%)</span>
                    <span className="text-red-500">-${fee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">到账时间</span>
                  <span>{config.processingTime}</span>
                </div>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleExchange}
              disabled={exchanging || points < config.minPoints}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${exchanging ? 'animate-spin' : ''}`} />
              {exchanging ? '兑换中...' : '确认兑换'}
            </Button>
          </CardContent>
        </Card>

        {/* 兑换记录 */}
        <Card>
          <CardHeader>
            <CardTitle>兑换记录</CardTitle>
          </CardHeader>
          <CardContent>
            {mockUserData.exchangeHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Coins className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无兑换记录</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mockUserData.exchangeHistory.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {record.points.toLocaleString()} 积分
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        <span className="text-green-500">${record.usdt}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {record.mode === 'express' ? '急速模式' : '标准模式'} • {record.time}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        record.status === 'completed'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-yellow-500/20 text-yellow-500'
                      }`}
                    >
                      {record.status === 'completed' ? '已完成' : '处理中'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            兑换说明
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-medium mb-2">标准模式</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• 兑换汇率：100 积分 = 1 USDT</li>
                <li>• 最低兑换：1,000 积分</li>
                <li>• 手续费：0%</li>
                <li>• 到账时间：1-3 个工作日</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">急速模式</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• 兑换汇率：110 积分 = 1 USDT</li>
                <li>• 最低兑换：500 积分</li>
                <li>• 手续费：10%</li>
                <li>• 到账时间：即时到账</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
