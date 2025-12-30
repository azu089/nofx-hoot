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
import { Input } from '@repo/design-system/components/ui/input';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Star,
  Users,
  BarChart3,
  Clock,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { strategiesApi } from '../../../../lib/api';
import type { Strategy } from '../../../../lib/api/types';

const strategyTypes = [
  { value: 'all', label: '全部' },
  { value: 'trend', label: '趋势跟踪' },
  { value: 'grid', label: '网格交易' },
  { value: 'ai', label: 'AI 量化' },
  { value: 'arbitrage', label: '套利' },
  { value: 'breakout', label: '突破' },
];

const riskLevels = [
  { value: 'all', label: '全部风险等级' },
  { value: 'low', label: '低风险' },
  { value: 'medium', label: '中风险' },
  { value: 'high', label: '高风险' },
];

export default function StrategiesPage() {
  const router = useRouter();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedRisk, setSelectedRisk] = useState('all');

  // 加载策略列表
  useEffect(() => {
    loadStrategies();
  }, [selectedType, selectedRisk]);

  const loadStrategies = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: { type?: string; risk_level?: string } = {};
      if (selectedType !== 'all') params.type = selectedType;
      if (selectedRisk !== 'all') params.risk_level = selectedRisk;

      const response = await strategiesApi.list(params);
      setStrategies(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 本地搜索过滤
  const filteredStrategies = strategies.filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch;
  });

  const getTypeLabel = (type: string) => {
    const found = strategyTypes.find((t) => t.value === type);
    return found?.label || type;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">策略市场</h1>
          <p className="text-muted-foreground">发现并订阅优质量化交易策略</p>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索策略名称或描述..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 bg-muted border border-border rounded-lg"
          >
            {strategyTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="px-4 py-2 bg-muted border border-border rounded-lg"
          >
            {riskLevels.map((risk) => (
              <option key={risk.value} value={risk.value}>
                {risk.label}
              </option>
            ))}
          </select>
        </div>
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

      {/* 策略列表 */}
      {!loading && !error && (
        <>
          {filteredStrategies.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">没有找到匹配的策略</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredStrategies.map((strategy) => (
                <Card
                  key={strategy.id}
                  className="hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/strategies/${strategy.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                          <Zap className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{strategy.name}</CardTitle>
                          <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                            {getTypeLabel(strategy.type)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {strategy.description}
                    </p>

                    {/* 策略数据 */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingUp className="w-3 h-3" />
                          预期收益
                        </div>
                        <p className="text-lg font-semibold text-green-500">
                          {strategy.expected_return}%
                        </p>
                      </div>
                      <div className="p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TrendingDown className="w-3 h-3" />
                          最大回撤
                        </div>
                        <p className="text-lg font-semibold text-red-500">
                          {strategy.max_drawdown}%
                        </p>
                      </div>
                      <div className="p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <BarChart3 className="w-3 h-3" />
                          胜率
                        </div>
                        <p className="text-lg font-semibold">{strategy.win_rate}%</p>
                      </div>
                      <div className="p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="w-3 h-3" />
                          风险等级
                        </div>
                        <p className="text-sm font-medium capitalize">{strategy.risk_level}</p>
                      </div>
                    </div>

                    {/* 底部信息 */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                      <span>最低: ${parseFloat(strategy.min_capital).toLocaleString()}</span>
                      <span className={`px-2 py-0.5 rounded ${
                        strategy.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20'
                      }`}>
                        {strategy.status === 'active' ? '可用' : '维护中'}
                      </span>
                    </div>

                    <Button className="w-full" onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/strategies/${strategy.id}`);
                    }}>
                      查看详情
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
