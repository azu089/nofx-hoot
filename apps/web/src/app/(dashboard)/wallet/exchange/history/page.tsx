'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button, Card, Empty } from '@/components/ui';
import { exchangeApi } from '@/lib/api';

// 资产配置
const ASSET_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  usdt: { label: 'USDT', icon: '💵', color: 'text-green-400' },
  card: { label: '点卡', icon: '🎫', color: 'text-blue-400' },
  points: { label: '积分', icon: '⭐', color: 'text-yellow-400' },
  token: { label: 'QFI', icon: '🪙', color: 'text-purple-400' },
};

// 状态配置
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  completed: { label: '已完成', icon: CheckCircle, color: 'text-success' },
  pending: { label: '处理中', icon: Clock, color: 'text-warning' },
  failed: { label: '失败', icon: XCircle, color: 'text-danger' },
};

interface ExchangeRecord {
  id: string;
  from_asset: string;
  from_amount: string;
  to_asset: string;
  to_amount: string;
  exchange_rate: string;
  fee_amount: string;
  mode?: string;
  status: string;
  created_at: string;
}

export default function ExchangeHistoryPage() {
  const router = useRouter();

  const [records, setRecords] = useState<ExchangeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  // 获取历史记录
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await exchangeApi.getHistory({ page, limit });
      setRecords(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      console.error('获取历史记录失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* 页面标题 - 移动端由 MobileLayout 提供，这里只在桌面端显示返回按钮 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="p-2 hidden lg:flex"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-bold text-text-primary hidden lg:block">兑换记录</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchHistory}
          className="ml-auto p-2"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* 记录列表 */}
      {loading && records.length === 0 ? (
        <Card className="p-8">
          <div className="flex justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-text-tertiary" />
          </div>
        </Card>
      ) : records.length === 0 ? (
        <Card className="p-8">
          <Empty description="暂无兑换记录" />
        </Card>
      ) : (
        <div className="space-y-3">
          {records.map((record) => {
            const fromConfig = ASSET_CONFIG[record.from_asset] || { label: record.from_asset, icon: '💰', color: 'text-text-primary' };
            const toConfig = ASSET_CONFIG[record.to_asset] || { label: record.to_asset, icon: '💰', color: 'text-text-primary' };
            const statusConfig = STATUS_CONFIG[record.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;

            return (
              <Card key={record.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  {/* 兑换方向 */}
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{fromConfig.icon}</span>
                    <span className={`font-medium ${fromConfig.color}`}>
                      {fromConfig.label}
                    </span>
                    <ArrowRight className="w-4 h-4 text-text-tertiary" />
                    <span className="text-lg">{toConfig.icon}</span>
                    <span className={`font-medium ${toConfig.color}`}>
                      {toConfig.label}
                    </span>
                  </div>

                  {/* 状态 */}
                  <div className={`flex items-center gap-1 text-sm ${statusConfig.color}`}>
                    <StatusIcon className="w-4 h-4" />
                    <span>{statusConfig.label}</span>
                  </div>
                </div>

                {/* 金额详情 */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-text-tertiary">支付: </span>
                    <span className="text-danger">
                      -{parseFloat(record.from_amount).toFixed(4)} {fromConfig.label}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">获得: </span>
                    <span className="text-success">
                      +{parseFloat(record.to_amount).toFixed(4)} {toConfig.label}
                    </span>
                  </div>
                </div>

                {/* 底部信息 */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-primary text-xs text-text-tertiary">
                  <span>
                    比例: 1:{parseFloat(record.exchange_rate).toFixed(4)}
                    {record.mode && ` (${record.mode === 'standard' ? '标准' : '急速'})`}
                  </span>
                  <span>{formatTime(record.created_at)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-text-secondary">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
