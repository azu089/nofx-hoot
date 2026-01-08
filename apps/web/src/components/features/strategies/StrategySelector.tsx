'use client';

import { useState, useEffect, useRef } from 'react';
import { strategiesApi, Strategy } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Search,
  Zap,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  Check,
  Loader2,
  X,
} from 'lucide-react';

interface StrategySelectorProps {
  value: string; // 选中的策略 ID
  onChange: (strategyId: string, strategy: Strategy | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  // 如果从外部传入策略（如从策略详情页跳转），直接使用
  preselectedStrategy?: Strategy | null;
}

// 风险等级样式
const getRiskStyle = (riskLevel?: string) => {
  switch (riskLevel) {
    case 'low':
      return { text: '低风险', color: 'text-success', bg: 'bg-success/20' };
    case 'medium':
      return { text: '中风险', color: 'text-warning', bg: 'bg-warning/20' };
    case 'high':
      return { text: '高风险', color: 'text-danger', bg: 'bg-danger/20' };
    default:
      return { text: '未知', color: 'text-text-secondary', bg: 'bg-bg-tertiary' };
  }
};

export function StrategySelector({
  value,
  onChange,
  label = '选择策略',
  placeholder = '搜索或选择策略...',
  disabled = false,
  preselectedStrategy = null,
}: StrategySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(preselectedStrategy);

  const containerRef = useRef<HTMLDivElement>(null);

  // 加载策略列表
  useEffect(() => {
    const loadStrategies = async () => {
      setLoading(true);
      try {
        const response = await strategiesApi.list();
        setStrategies(response.data || []);

        // 如果有预选策略且与 value 匹配，设置选中
        if (preselectedStrategy && preselectedStrategy.id === value) {
          setSelectedStrategy(preselectedStrategy);
        } else if (value && response.data) {
          // 从列表中找到选中的策略
          const found = response.data.find((s) => s.id === value);
          if (found) {
            setSelectedStrategy(found);
          }
        }
      } catch (err) {
        console.error('加载策略列表失败:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStrategies();
  }, [value, preselectedStrategy]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 过滤策略
  const filteredStrategies = strategies.filter((s) => {
    const searchLower = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(searchLower) ||
      (s.description?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  // 选择策略
  const handleSelect = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    onChange(strategy.id, strategy);
    setIsOpen(false);
    setSearch('');
  };

  // 清除选择
  const handleClear = () => {
    setSelectedStrategy(null);
    onChange('', null);
  };

  const risk = selectedStrategy ? getRiskStyle(selectedStrategy.config?.riskLevel) : null;

  return (
    <div ref={containerRef} className="relative">
      {/* 标签 */}
      {label && (
        <label className="block text-sm text-text-secondary mb-2">{label}</label>
      )}

      {/* 选择器触发器 */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`
          relative w-full bg-bg-tertiary border rounded-lg transition-colors cursor-pointer
          ${isOpen ? 'border-brand-primary' : 'border-border-secondary hover:border-border-primary'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {selectedStrategy ? (
          // 已选择状态 - 显示策略卡片
          <div className="p-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-brand-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-brand-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium truncate">
                    {selectedStrategy.name}
                  </span>
                  {risk && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${risk.bg} ${risk.color}`}>
                      {risk.text}
                    </span>
                  )}
                </div>
                <p className="text-text-tertiary text-xs mt-1 truncate">
                  {selectedStrategy.description || '暂无描述'}
                </p>
                {selectedStrategy.performance_stats && (
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="text-success">
                      胜率 {selectedStrategy.performance_stats?.backtest?.win_rate?.toFixed(0) || 0}%
                    </span>
                    <span className="text-text-tertiary">
                      夏普 {selectedStrategy.performance_stats?.backtest?.sharpe_ratio?.toFixed(1) || '-'}
                    </span>
                  </div>
                )}
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="p-1 hover:bg-bg-secondary rounded text-text-tertiary hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          // 未选择状态
          <div className="p-3 flex items-center justify-between">
            <span className="text-text-tertiary">{placeholder}</span>
            <ChevronDown
              className={`w-5 h-5 text-text-tertiary transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        )}
      </div>

      {/* 下拉面板 */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-2 bg-bg-secondary border border-border-primary rounded-lg shadow-lg overflow-hidden">
          {/* 搜索框 */}
          <div className="p-3 border-b border-border-primary">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索策略名称或描述..."
                className="w-full bg-bg-tertiary border border-border-secondary rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder:text-text-tertiary focus:border-brand-primary outline-none"
                autoFocus
              />
            </div>
          </div>

          {/* 策略列表 */}
          <div className="max-h-[300px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
              </div>
            ) : filteredStrategies.length === 0 ? (
              <div className="text-center py-8 text-text-tertiary text-sm">
                {search ? '没有找到匹配的策略' : '暂无可用策略'}
              </div>
            ) : (
              filteredStrategies.map((strategy) => {
                const strategyRisk = getRiskStyle(strategy.config?.riskLevel);
                const isSelected = value === strategy.id;

                return (
                  <div
                    key={strategy.id}
                    onClick={() => handleSelect(strategy)}
                    className={`
                      p-3 cursor-pointer transition-colors border-b border-border-primary last:border-b-0
                      ${isSelected ? 'bg-brand-primary/10' : 'hover:bg-bg-tertiary/50'}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-brand-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Zap className="w-4 h-4 text-brand-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium text-sm truncate">
                            {strategy.name}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${strategyRisk.bg} ${strategyRisk.color}`}>
                            {strategyRisk.text}
                          </span>
                          {isSelected && (
                            <Check className="w-4 h-4 text-brand-primary ml-auto flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-text-tertiary text-xs mt-1 line-clamp-2">
                          {strategy.description || '暂无描述'}
                        </p>
                        {strategy.performance_stats && (
                          <div className="flex items-center gap-3 mt-1.5 text-xs">
                            <span className="text-success flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              胜率 {strategy.performance_stats?.backtest?.win_rate?.toFixed(0) || 0}%
                            </span>
                            <span className="text-text-tertiary">
                              夏普 {strategy.performance_stats?.backtest?.sharpe_ratio?.toFixed(1) || '-'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 底部提示 */}
          <div className="p-3 border-t border-border-primary bg-bg-tertiary/30">
            <p className="text-xs text-text-tertiary text-center">
              共 {filteredStrategies.length} 个策略
              {search && ` (搜索: "${search}")`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
