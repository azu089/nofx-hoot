'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, Button } from '@/components/ui';
import { instancesApi, tradingApi } from '@/lib/api';
import {
  Bot,
  Play,
  Square,
  ChevronRight,
  Loader2,
  AlertCircle,
  Clock,
  Briefcase,
  Zap,
} from 'lucide-react';

interface Instance {
  id: string;
  status: string;
  ip_address: string;
  region: string;
  cpu_usage: string | null;
  memory_usage: string | null;
  last_heartbeat: string | null;
}

interface BotStatus {
  running: boolean;
  strategy_id?: string;
  uptime?: number;
  trades_today?: number;
}

interface Position {
  id: string;
  symbol: string;
  side: string;
  unrealized_pnl: string;
}

interface BotStatusCardProps {
  /** 自定义类名 */
  className?: string;
  /** 点击详情回调 */
  onViewDetail?: (instanceId: string) => void;
}

/**
 * 机器人状态卡片
 * 显示当前运行的策略机器人状态
 * - 运行状态指示器
 * - 策略名称
 * - 运行时长 + 持仓数
 * - 停止/查看详情按钮
 */
export function BotStatusCard({ className = '', onViewDetail }: BotStatusCardProps) {
  const router = useRouter();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // 获取实例列表
      const instancesRes = await instancesApi.list();
      const instances = instancesRes.data || [];

      // 找到运行中的实例
      const runningInstance = instances.find(
        (inst) => inst.status === 'running' || inst.status === 'active'
      );

      if (runningInstance) {
        setInstance(runningInstance);

        // 并行获取机器人状态和持仓
        const [botRes, positionsRes] = await Promise.all([
          tradingApi.getBotStatus().catch(() => ({ data: null })),
          tradingApi.getPositions().catch(() => ({ data: [] })),
        ]);

        if (botRes.data) {
          setBotStatus(botRes.data);
        }
        setPositions(positionsRes.data || []);
      } else {
        setInstance(null);
        setBotStatus(null);
        setPositions([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取状态失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // 每 30 秒刷新一次
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleStop = async () => {
    if (!instance) return;

    setStopping(true);
    try {
      await instancesApi.stop(instance.id);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '停止失败');
    } finally {
      setStopping(false);
    }
  };

  const handleViewDetail = () => {
    if (instance) {
      if (onViewDetail) {
        onViewDetail(instance.id);
      } else {
        router.push(`/instances/${instance.id}`);
      }
    }
  };

  const handleStartStrategy = () => {
    router.push('/strategies');
  };

  // 格式化运行时长
  const formatUptime = (seconds?: number) => {
    if (!seconds) return '0h';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}天${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h${minutes}m`;
    }
    return `${minutes}m`;
  };

  // 加载状态
  if (loading) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-center gap-2 py-6 text-text-secondary">
            <AlertCircle className="w-5 h-5 text-danger" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 空态 - 无运行中的策略
  if (!instance) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-4">
          {/* 标题 */}
          <div className="flex items-center gap-2 text-text-secondary mb-4">
            <Bot className="w-5 h-5" />
            <span className="font-medium">机器人状态</span>
          </div>

          {/* 空态内容 */}
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-bg-tertiary flex items-center justify-center">
              <Zap className="w-6 h-6 text-text-tertiary" />
            </div>
            <p className="text-text-secondary mb-4">暂无运行中的策略</p>
            <Button onClick={handleStartStrategy} className="w-full">
              <Play className="w-4 h-4 mr-2" />
              选择策略开始交易
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 正常状态 - 有运行中的机器人
  const isRunning = instance.status === 'running' || instance.status === 'active';

  return (
    <Card className={`${className}`}>
      <CardContent className="p-4">
        {/* 标题行 */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-text-secondary">
            <Bot className="w-5 h-5" />
            <span className="font-medium">机器人状态</span>
          </div>
          <button
            onClick={handleViewDetail}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 状态内容 */}
        <div className="space-y-3">
          {/* 状态指示 + 策略名称 */}
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isRunning ? 'bg-success animate-pulse' : 'bg-text-tertiary'
              }`}
            />
            <span className="text-text-primary font-medium">
              {isRunning ? '运行中' : '已停止'}
            </span>
            {botStatus?.strategy_id && (
              <>
                <span className="text-text-tertiary">·</span>
                <span className="text-text-secondary text-sm truncate">
                  {botStatus.strategy_id}
                </span>
              </>
            )}
          </div>

          {/* 运行信息 */}
          <div className="flex items-center gap-4 text-sm text-text-tertiary">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>运行 {formatUptime(botStatus?.uptime)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Briefcase className="w-4 h-4" />
              <span>{positions.length} 个持仓</span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-2">
            {isRunning && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStop}
                disabled={stopping}
                className="flex-1 border-danger/50 text-danger hover:bg-danger/10"
              >
                {stopping ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Square className="w-4 h-4 mr-1" />
                    停止
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewDetail}
              className="flex-1"
            >
              查看详情
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
