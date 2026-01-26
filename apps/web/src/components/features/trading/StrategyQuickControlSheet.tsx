'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { strategiesApi } from '@/lib/api';
import { Loader2, Play, Pause, Settings, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StrategyConfig {
  id: string;
  strategy: {
    id: string;
    name: string;
  };
  is_active: boolean;
  stake_amount: number;
  leverage: number;
  max_open_trades: number;
  stoploss: number;
}

/**
 * 策略快速控制抽屉组件
 * 用于在交易页面快速启动/停止已配置的策略
 */
export function StrategyQuickControlSheet() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // 获取用户策略配置列表
  const { data, isLoading } = useQuery({
    queryKey: ['user-strategy-configs'],
    queryFn: () => strategiesApi.getMyConfigs(),
    enabled: open, // 只在打开时加载
  });

  // 启动策略
  const startMutation = useMutation({
    mutationFn: (configId: string) => strategiesApi.startStrategy(configId),
    onSuccess: () => {
      toast.success('策略启动成功');
      queryClient.invalidateQueries({ queryKey: ['user-strategy-configs'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || '启动失败');
    },
  });

  // 停止策略
  const stopMutation = useMutation({
    mutationFn: (configId: string) => strategiesApi.stopStrategy(configId),
    onSuccess: () => {
      toast.success('策略已停止');
      queryClient.invalidateQueries({ queryKey: ['user-strategy-configs'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || '停止失败');
    },
  });

  // 禁止背景滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const configs = data?.data as StrategyConfig[] | undefined;

  return (
    <>
      {/* 触发按钮 */}
      <Button variant="primary" size="sm" className="flex-1" onClick={() => setOpen(true)}>
        <Play className="w-4 h-4 mr-2" />
        启动策略
      </Button>

      {/* 抽屉遮罩 + 内容 */}
      {open && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setOpen(false)}
          />

          {/* 抽屉内容 - 从右侧滑入 */}
          <div
            className={cn(
              'fixed right-0 top-0 bottom-0 w-full sm:w-[400px] bg-bg-secondary z-50',
              'transform transition-transform duration-300 ease-in-out',
              'border-l border-border-primary',
              open ? 'translate-x-0' : 'translate-x-full'
            )}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
              <h2 className="text-lg font-semibold text-text-primary">我的策略</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-text-tertiary hover:text-text-primary transition-colors p-1.5 rounded-md hover:bg-bg-tertiary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 内容区 */}
            <div className="px-6 py-4 overflow-y-auto h-[calc(100vh-73px)]">
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                  </div>
                ) : !configs?.length ? (
                  <div className="text-center py-12">
                    <p className="text-text-secondary mb-4">还没有配置策略</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setOpen(false);
                        window.location.href = '/strategies';
                      }}
                    >
                      去配置策略
                    </Button>
                  </div>
                ) : (
                  <>
                    {configs.map((config) => (
                      <div
                        key={config.id}
                        className="bg-bg-tertiary rounded-lg p-4 border border-border-primary"
                      >
                        {/* 头部：策略名称 + 状态 */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {config.is_active ? (
                              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-text-tertiary" />
                            )}
                            <span className="text-text-primary font-medium">
                              {config.strategy.name}
                            </span>
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              config.is_active
                                ? 'bg-success/20 text-success'
                                : 'bg-bg-tertiary text-text-tertiary'
                            }`}
                          >
                            {config.is_active ? '运行中' : '已停止'}
                          </span>
                        </div>

                        {/* 配置信息 */}
                        <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                          <div>
                            <span className="text-text-tertiary">投入: </span>
                            <span className="text-text-primary">${config.stake_amount}</span>
                          </div>
                          <div>
                            <span className="text-text-tertiary">杠杆: </span>
                            <span className="text-text-primary">{config.leverage}x</span>
                          </div>
                          <div>
                            <span className="text-text-tertiary">止损: </span>
                            <span className="text-danger">{(parseFloat(config.stoploss) * 100).toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-text-tertiary">最大持仓: </span>
                            <span className="text-text-primary">{config.max_open_trades}</span>
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex gap-2">
                          {config.is_active ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => stopMutation.mutate(config.id)}
                              disabled={stopMutation.isPending}
                            >
                              {stopMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Pause className="w-4 h-4 mr-1" />
                              )}
                              停止策略
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="flex-1 bg-brand-primary hover:bg-brand-secondary"
                              onClick={() => startMutation.mutate(config.id)}
                              disabled={startMutation.isPending}
                            >
                              {startMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4 mr-1" />
                              )}
                              启动策略
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setOpen(false);
                              window.location.href = `/strategies/my?configId=${config.id}`;
                            }}
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {/* 底部操作 */}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setOpen(false);
                        window.location.href = '/strategies';
                      }}
                    >
                      + 配置新策略
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
