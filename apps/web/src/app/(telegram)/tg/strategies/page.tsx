'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  TrendingUp,
  Users,
  Star,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useTelegramContext } from '@/components/providers/TelegramProvider';
import { api } from '@/lib/api';

interface Strategy {
  id: string;
  name: string;
  description?: string;
  winRate: string;
  sharpeRatio: string;
  maxDrawdown: string;
  tier: number;
  isSubscribed: boolean;
  totalUsers: number;
}

interface StrategiesResponse {
  strategies: Strategy[];
  total: number;
  page: number;
  limit: number;
}

export default function TelegramStrategies() {
  const { haptic } = useTelegramContext();
  const [data, setData] = useState<StrategiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState<number | null>(null);

  useEffect(() => {
    async function fetchStrategies() {
      try {
        const response = await api.get('/telegram/strategies');
        setData(response.data);
      } catch (error) {
        console.error('获取策略列表失败:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStrategies();
  }, []);

  const filteredStrategies = data?.strategies.filter((s) => {
    const matchesSearch =
      !searchQuery ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = filterTier === null || s.tier === filterTier;
    return matchesSearch && matchesTier;
  });

  const getTierLabel = (tier: number) => {
    switch (tier) {
      case 1:
        return { label: '基础', color: 'text-text-secondary' };
      case 2:
        return { label: '进阶', color: 'text-brand-primary' };
      case 3:
        return { label: '专业', color: 'text-warning' };
      default:
        return { label: '未知', color: 'text-text-tertiary' };
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-32 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-32 bg-bg-secondary rounded-xl animate-pulse" />
        <div className="h-32 bg-bg-secondary rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 搜索栏 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="text"
            placeholder="搜索策略..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-bg-secondary border border-border-primary rounded-xl text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-brand-primary"
          />
        </div>
        <button
          className="p-2.5 bg-bg-secondary border border-border-primary rounded-xl"
          onClick={() => {
            haptic('selection');
            setFilterTier(filterTier === null ? 3 : filterTier === 3 ? 2 : filterTier === 2 ? 1 : null);
          }}
        >
          <Filter size={18} className={filterTier !== null ? 'text-brand-primary' : 'text-text-tertiary'} />
        </button>
      </div>

      {/* 筛选标签 */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {[
          { value: null, label: '全部' },
          { value: 3, label: '专业版' },
          { value: 2, label: '进阶版' },
          { value: 1, label: '基础版' },
        ].map((tier) => (
          <button
            key={tier.value ?? 'all'}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              filterTier === tier.value
                ? 'bg-brand-primary text-white'
                : 'bg-bg-secondary text-text-secondary'
            }`}
            onClick={() => {
              haptic('selection');
              setFilterTier(tier.value);
            }}
          >
            {tier.label}
          </button>
        ))}
      </div>

      {/* 策略列表 */}
      <div className="space-y-3">
        {filteredStrategies?.length === 0 ? (
          <div className="text-center py-12">
            <Zap size={48} className="mx-auto text-text-tertiary mb-3" />
            <p className="text-text-secondary">暂无策略</p>
          </div>
        ) : (
          filteredStrategies?.map((strategy) => {
            const tierInfo = getTierLabel(strategy.tier);
            return (
              <Link
                key={strategy.id}
                href={`/tg/strategies/${strategy.id}`}
                className="block bg-bg-secondary border border-border-primary rounded-xl p-4"
                onClick={() => haptic('selection')}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-text-primary">
                        {strategy.name}
                      </h3>
                      <span className={`text-xs ${tierInfo.color}`}>
                        {tierInfo.label}
                      </span>
                    </div>
                    <p className="text-xs text-text-tertiary line-clamp-2">
                      {strategy.description || '暂无描述'}
                    </p>
                  </div>
                  {strategy.isSubscribed && (
                    <div className="p-1.5 bg-success/10 rounded-lg">
                      <Star size={16} className="text-success" fill="currentColor" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-text-tertiary mb-0.5">胜率</p>
                    <p className="text-sm font-medium text-success">
                      {parseFloat(strategy.winRate).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary mb-0.5">夏普比</p>
                    <p className="text-sm font-medium text-text-primary">
                      {parseFloat(strategy.sharpeRatio).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary mb-0.5">最大回撤</p>
                    <p className="text-sm font-medium text-danger">
                      {parseFloat(strategy.maxDrawdown).toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border-primary">
                  <div className="flex items-center gap-1.5 text-text-tertiary">
                    <Users size={14} />
                    <span className="text-xs">{strategy.totalUsers} 人使用</span>
                  </div>
                  <div className="flex items-center gap-1 text-brand-primary">
                    <span className="text-xs">查看详情</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
