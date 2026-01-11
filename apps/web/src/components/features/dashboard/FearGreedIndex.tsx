'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui';
import { TrendingUp, TrendingDown, Minus, AlertCircle, RefreshCw } from 'lucide-react';

interface FearGreedData {
  value: string;
  value_classification: string;
  timestamp: string;
}

// 情绪分类与样式映射
const classificationConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  'Extreme Fear': { label: '极度恐惧', color: 'text-danger', bgColor: 'bg-danger/20' },
  'Fear': { label: '恐惧', color: 'text-orange-400', bgColor: 'bg-orange-400/20' },
  'Neutral': { label: '中性', color: 'text-text-secondary', bgColor: 'bg-text-secondary/20' },
  'Greed': { label: '贪婪', color: 'text-success', bgColor: 'bg-success/20' },
  'Extreme Greed': { label: '极度贪婪', color: 'text-emerald-400', bgColor: 'bg-emerald-400/20' },
};

export function FearGreedIndex() {
  const [data, setData] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 调用 Alternative.me 恐惧贪婪指数 API
      const response = await fetch('https://api.alternative.me/fng/?limit=1');
      if (!response.ok) throw new Error('API 请求失败');
      const result = await response.json();
      if (result.data && result.data.length > 0) {
        setData(result.data[0]);
      }
    } catch (err) {
      console.error('获取恐惧贪婪指数失败:', err);
      setError('数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // 每 30 分钟刷新一次
    const interval = setInterval(fetchData, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const value = data ? parseInt(data.value) : 50;
  const classification = data?.value_classification || 'Neutral';
  const config = classificationConfig[classification] || classificationConfig['Neutral'];

  // 计算指针角度 (0-100 映射到 -90 到 90 度)
  const rotation = ((value / 100) * 180) - 90;

  // 获取情绪图标
  const getIcon = () => {
    if (value < 25) return <TrendingDown className="w-4 h-4" />;
    if (value > 75) return <TrendingUp className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <Card variant="glass">
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-bg-tertiary rounded w-24 mb-3" />
            <div className="h-20 bg-bg-tertiary rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="glass">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-text-primary">市场情绪</span>
            <button onClick={fetchData} className="p-1 hover:bg-bg-tertiary rounded">
              <RefreshCw className="w-4 h-4 text-text-tertiary" />
            </button>
          </div>
          <div className="flex items-center justify-center gap-2 py-6 text-text-tertiary">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="glass">
      <CardContent className="p-4">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-text-primary">市场情绪指数</span>
          <span className="text-xs text-text-tertiary">Fear & Greed</span>
        </div>

        {/* 仪表盘 */}
        <div className="relative flex flex-col items-center">
          {/* 半圆仪表 */}
          <div className="relative w-32 h-16 overflow-hidden">
            {/* 背景弧 */}
            <div className="absolute inset-0 rounded-t-full bg-gradient-to-r from-danger via-warning to-success opacity-30" />

            {/* 刻度标记 */}
            <div className="absolute inset-0 flex justify-between px-1 pt-1">
              <span className="text-[10px] text-danger">0</span>
              <span className="text-[10px] text-text-tertiary">50</span>
              <span className="text-[10px] text-success">100</span>
            </div>

            {/* 指针 */}
            <div
              className="absolute bottom-0 left-1/2 w-0.5 h-12 bg-white origin-bottom transition-transform duration-500"
              style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
            />

            {/* 中心圆点 */}
            <div className="absolute bottom-0 left-1/2 w-3 h-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-white shadow-lg" />
          </div>

          {/* 数值与标签 */}
          <div className="flex items-center gap-2 mt-3">
            <span className={`text-3xl font-bold font-mono ${config.color}`}>
              {value}
            </span>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
              {getIcon()}
              <span className="text-xs font-medium">{config.label}</span>
            </div>
          </div>

          {/* 更新时间 */}
          {data?.timestamp && (
            <p className="text-[10px] text-text-tertiary mt-2">
              更新于 {new Date(parseInt(data.timestamp) * 1000).toLocaleDateString('zh-CN')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
