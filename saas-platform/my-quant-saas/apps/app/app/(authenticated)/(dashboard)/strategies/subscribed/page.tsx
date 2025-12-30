'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/design-system/components/ui/card';
import { Button } from '@repo/design-system/components/ui/button';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  Play,
  Pause,
  Settings,
  Trash2,
  BarChart3,
  DollarSign,
  Activity,
  AlertTriangle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { strategiesApi } from '../../../../lib/api';
import type { MyStrategy } from '../../../../lib/api/types';

// 模拟扩展数据（后端 API 待补全）
const mockExtendedStrategies = [
  {
    id: '1',
    name: '趋势追踪 Pro',
    author: 'QuantFi 官方',
    status: 'running',
    subscribedAt: '2024-01-01',
    expiresAt: '2024-04-01',
    totalProfit: 1234.56,
    todayProfit: 45.67,
    totalTrades: 156,
    winRate: 68.5,
    maxDrawdown: 8.2,
    investment: 5000,
  },
  {
    id: '2',
    name: 'AI 量化狙击',
    author: '量化大师',
    status: 'paused',
    subscribedAt: '2024-01-10',
    expiresAt: '2024-04-10',
    totalProfit: 567.89,
    todayProfit: -12.34,
    totalTrades: 89,
    winRate: 62.3,
    maxDrawdown: 12.5,
    investment: 3000,
  },
  {
    id: '3',
    name: '网格套利者',
    author: '套利专家',
    status: 'running',
    subscribedAt: '2024-01-15',
    expiresAt: '2024-02-15',
    totalProfit: 234.56,
    todayProfit: 23.45,
    totalTrades: 234,
    winRate: 75.2,
    maxDrawdown: 5.1,
    investment: 2000,
  },
];

export default function SubscribedStrategiesPage() {
  const router = useRouter();
  const [strategies, setStrategies] = useState<MyStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载我的订阅
  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await strategiesApi.getMyStrategies();
      setStrategies(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'running' ? 'paused' : 'running';
    try {
      await strategiesApi.toggleStatus(id, newStatus);
      // 更新本地状态
      setStrategies((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status: newStatus } : s
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleUnsubscribe = async (id: string) => {
    if (!confirm('确定要取消订阅该策略吗？')) return;

    try {
      await strategiesApi.unsubscribe(id);
      setStrategies((prev) => prev.filter((s) => s.id !== id));
      alert('取消订阅成功');
    } catch (err) {
      alert(err instanceof Error ? err.message : '取消失败');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-500 flex items-center gap-1">
            <Activity className="w-3 h-3" />
            运行中
          </span>
        );
      case 'paused':
        return (
          <span className="px-2 py-1 text-xs rounded bg-yellow-500/20 text-yellow-500 flex items-center gap-1">
            <Pause className="w-3 h-3" />
            已暂停
          </span>
        );
      default:
        return null;
    }
  };

  // 计算统计数据
  const stats = {
    totalInvestment: strategies.reduce((sum, s) => sum + parseFloat(s.allocated_capital || '0'), 0),
    totalProfit: strategies.reduce((sum, s) => sum + parseFloat(s.total_pnl || '0'), 0),
    activeStrategies: strategies.filter(s => s.status === 'running').length,
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-7 h-7 text-primary" />
            我的订阅
          </h1>
          <p className="text-muted-foreground">管理已订阅的交易策略</p>
        </div>
        <Link href="/strategies">
          <Button>
            浏览策略市场
          </Button>
        </Link>
      </div>

      {/* 加载态 */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">加载中...</span>
        </div>
      )}

      {/* 错误态 */}
      {error && (
        <Card className="border-red-500/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-red-500">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
            <Button className="mt-4" onClick={loadStrategies}>
              重试
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 数据展示 */}
      {!loading && !error && (
        <>
          {/* 统计概览 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">总投入</p>
                    <p className="text-xl font-bold">${stats.totalInvestment.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    stats.totalProfit >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    {stats.totalProfit >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">总盈亏</p>
                    <p className={`text-xl font-bold ${
                      stats.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Activity className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">运行中</p>
                    <p className="text-xl font-bold">{stats.activeStrategies} 个策略</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* 策略列表 */}
      {!loading && !error && (
        <div className="space-y-4">
          {strategies.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">暂无订阅策略</p>
                <Link href="/strategies">
                  <Button>浏览策略市场</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            strategies.map((strategy) => (
              <Card key={strategy.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* 策略信息 */}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                        <Zap className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold">{strategy.strategy_name}</h3>
                          {getStatusBadge(strategy.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          订阅时间：{new Date(strategy.subscribed_at).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          投入金额：${parseFloat(strategy.allocated_capital).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* 收益数据 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">总盈亏</p>
                        <p className={`text-lg font-medium ${
                          parseFloat(strategy.total_pnl) >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {parseFloat(strategy.total_pnl) >= 0 ? '+' : ''}${parseFloat(strategy.total_pnl).toFixed(2)}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">收益率</p>
                        <p className={`text-lg font-medium ${
                          parseFloat(strategy.total_pnl) >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {((parseFloat(strategy.total_pnl) / parseFloat(strategy.allocated_capital)) * 100).toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(strategy.id, strategy.status)}
                      >
                        {strategy.status === 'running' ? (
                          <>
                            <Pause className="w-4 h-4 mr-1" />
                            暂停
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-1" />
                            启动
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/strategies/${strategy.strategy_id}`)}
                      >
                        <BarChart3 className="w-4 h-4 mr-1" />
                        详情
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleUnsubscribe(strategy.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* 使用提示 */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <h4 className="font-medium mb-2">使用说明</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• 策略订阅期间可随时暂停和启动</li>
            <li>• 暂停策略不会退还订阅费用</li>
            <li>• 策略到期前会通过邮件和站内信提醒</li>
            <li>• 续费享受老用户优惠价格</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
