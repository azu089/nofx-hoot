'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui';
import { Pause, Play, Trash2, Download, WifiOff, ChevronDown, ChevronUp, RefreshCw, Server, TrendingUp } from 'lucide-react';
import { wsClient, LogEvent } from '@/lib/websocket';
import { getToken, strategiesApi } from '@/lib/api';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  meta?: Record<string, unknown>;
}

interface TradingLogProps {
  instanceId: string | null;
  isConnected?: boolean;
  /** 自定义最大高度（px） */
  maxHeight?: number;
}

type LogTab = 'trading' | 'vps';

export function TradingLog({ instanceId, isConnected = false, maxHeight = 256 }: TradingLogProps) {
  // Tab 状态
  const [activeTab, setActiveTab] = useState<LogTab>('trading');

  // 交易日志状态（WebSocket 实时）
  const [tradingLogs, setTradingLogs] = useState<LogEntry[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // VPS 日志状态（HTTP 轮询）
  const [vpsLogs, setVpsLogs] = useState<LogEntry[]>([]);
  const [vpsLoading, setVpsLoading] = useState(false);

  // 公共状态
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logsBufferRef = useRef<LogEntry[]>([]);

  // 添加日志到缓冲区
  const addTradingLog = useCallback((log: LogEntry) => {
    if (isPaused) {
      logsBufferRef.current = [...logsBufferRef.current.slice(-99), log];
    } else {
      setTradingLogs((prev) => [...prev.slice(-99), log]);
    }
  }, [isPaused]);

  // 连接 WebSocket（交易日志）
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const connect = async () => {
      try {
        setConnectionError(null);
        await wsClient.connect(token);
        setWsConnected(true);

        addTradingLog({
          id: `sys-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'info',
          message: '实时连接成功',
        });
      } catch (error) {
        console.error('WebSocket 连接失败:', error);
        setWsConnected(false);
        setConnectionError(error instanceof Error ? error.message : '连接失败');

        addTradingLog({
          id: `sys-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `实时连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
        });
      }
    };

    connect();

    wsClient.on('disconnect', () => {
      setWsConnected(false);
      addTradingLog({
        id: `sys-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: '实时连接断开',
      });
    });

    wsClient.on('connect', () => {
      setWsConnected(true);
      setConnectionError(null);
      addTradingLog({
        id: `sys-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: '实时连接已恢复',
      });
    });

    return () => {
      wsClient.disconnect();
    };
  }, [addTradingLog]);

  // 订阅实例日志
  useEffect(() => {
    if (!instanceId || !wsConnected) return;

    wsClient.subscribeToLogs(instanceId);

    addTradingLog({
      id: `sys-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `已订阅实例 ${instanceId.slice(0, 8)}... 的日志`,
    });

    const handleLog = (data: unknown) => {
      const event = data as LogEvent;
      if (event.instanceId === instanceId) {
        addTradingLog({
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          timestamp: event.log.timestamp || event.timestamp,
          level: event.log.level || 'info',
          message: event.log.message,
          meta: event.log.meta,
        });
      }
    };

    wsClient.on('instance:log', handleLog);

    return () => {
      wsClient.unsubscribeFromLogs(instanceId);
    };
  }, [instanceId, wsConnected, addTradingLog]);

  // 获取 VPS 日志（HTTP 拉取）
  const fetchVpsLogs = useCallback(async () => {
    if (!instanceId) return;

    setVpsLoading(true);
    try {
      const res = await strategiesApi.getVpsLogs(100);
      if (res.code === 0 && res.data.logs) {
        const logs = res.data.logs.map((log: { timestamp: string; level: string; message: string }, index: number) => ({
          id: `vps-${Date.now()}-${index}`,
          timestamp: log.timestamp,
          level: (log.level as LogEntry['level']) || 'info',
          message: log.message,
        }));
        setVpsLogs(logs);
      }
    } catch (error) {
      console.error('获取 VPS 日志失败:', error);
    } finally {
      setVpsLoading(false);
    }
  }, [instanceId]);

  // 获取交易日志（HTTP 拉取，作为 WebSocket 的补充）
  const fetchTradingLogs = useCallback(async () => {
    if (!instanceId) return;

    try {
      const res = await strategiesApi.getTradingLogs(100);
      if (res.code === 0 && res.data.logs) {
        // 后端返回的是对象数组 { id, timestamp, level, message, source }
        const logs = res.data.logs.map((log: { id?: string; timestamp?: string; level?: string; message?: string } | string, index: number) => {
          // 兼容两种格式：对象格式和字符串格式
          if (typeof log === 'object' && log !== null) {
            // 对象格式（新版 API）
            return {
              id: log.id || `api-${Date.now()}-${index}`,
              timestamp: log.timestamp || new Date().toISOString(),
              level: ((log.level || 'info').toLowerCase() as LogEntry['level']),
              message: log.message || '',
            };
          } else {
            // 字符串格式（兼容旧版）
            const logStr = String(log);
            const match = logStr.match(/\[(.*?)\]\s*(\w+)\s*-?\s*(.*)/);
            return {
              id: `api-${Date.now()}-${index}`,
              timestamp: match?.[1] || new Date().toISOString(),
              level: (match?.[2]?.toLowerCase() as LogEntry['level']) || 'info',
              message: match?.[3] || logStr,
            };
          }
        });
        // 合并到现有日志
        setTradingLogs((prev) => {
          const existingIds = new Set(prev.map((l: LogEntry) => l.id));
          const newLogs = logs.filter((l: LogEntry) => !existingIds.has(l.id));
          return [...prev, ...newLogs].slice(-100);
        });
      }
    } catch (error) {
      console.error('获取交易日志失败:', error);
    }
  }, [instanceId]);

  // 切换到 VPS Tab 时加载日志
  useEffect(() => {
    if (activeTab === 'vps' && instanceId) {
      fetchVpsLogs();
    }
  }, [activeTab, instanceId, fetchVpsLogs]);

  // 定时刷新交易日志（补充 WebSocket）
  useEffect(() => {
    if (!instanceId || isPaused) return;

    // 初始加载
    fetchTradingLogs();

    // 每 30 秒刷新一次
    const interval = setInterval(fetchTradingLogs, 30000);
    return () => clearInterval(interval);
  }, [instanceId, isPaused, fetchTradingLogs]);

  // 恢复暂停时刷新缓冲区中的日志
  useEffect(() => {
    if (!isPaused && logsBufferRef.current.length > 0) {
      setTradingLogs((prev) => [...prev, ...logsBufferRef.current].slice(-100));
      logsBufferRef.current = [];
    }
  }, [isPaused]);

  // 自动滚动到底部
  useEffect(() => {
    if (!isPaused && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [tradingLogs, vpsLogs, isPaused, activeTab]);

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-danger-400';
      case 'warn':
        return 'text-warning';
      case 'debug':
        return 'text-text-tertiary';
      default:
        return 'text-text-primary';
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-danger-500/20 text-danger-400';
      case 'warn':
        return 'bg-warning/20 text-warning';
      case 'debug':
        return 'bg-bg-tertiary text-text-tertiary';
      default:
        return 'bg-primary-500/20 text-primary-400';
    }
  };

  // 当前显示的日志
  const currentLogs = activeTab === 'trading' ? tradingLogs : vpsLogs;
  const filteredLogs = filter === 'all' ? currentLogs : currentLogs.filter((log) => log.level === filter);

  const handleClear = () => {
    if (activeTab === 'trading') {
      setTradingLogs([]);
    } else {
      setVpsLogs([]);
    }
  };

  const handleRefresh = () => {
    if (activeTab === 'trading') {
      fetchTradingLogs();
    } else {
      fetchVpsLogs();
    }
  };

  const handleDownload = () => {
    const logs = activeTab === 'trading' ? tradingLogs : vpsLogs;
    const content = logs
      .map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTab}-log-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN');
  };

  return (
    <div className="space-y-2">
      {/* Tab 切换 + 工具栏 */}
      <div className="flex items-center justify-between px-2 gap-2">
        {/* Tab 切换 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('trading')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === 'trading'
                ? 'bg-primary-500/20 text-primary-400'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            交易日志
          </button>
          <button
            onClick={() => setActiveTab('vps')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === 'vps'
                ? 'bg-primary-500/20 text-primary-400'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            系统日志
          </button>
        </div>

        {/* 操作按钮组 */}
        <div className="flex items-center gap-1">
          {!isCollapsed && (
            <>
              <select
                className="bg-bg-tertiary rounded px-2 py-1 text-sm text-text-primary border-0"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">全部</option>
                <option value="info">信息</option>
                <option value="warn">警告</option>
                <option value="error">错误</option>
                <option value="debug">调试</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                title="刷新"
                disabled={vpsLoading}
              >
                <RefreshCw className={`w-4 h-4 ${vpsLoading ? 'animate-spin' : ''}`} />
              </Button>
              {activeTab === 'trading' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPaused(!isPaused)}
                  title={isPaused ? '继续' : '暂停'}
                >
                  {isPaused ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleClear} title="清空">
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDownload} title="下载">
                <Download className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* WebSocket 连接状态指示器（仅交易日志 Tab） */}
          {activeTab === 'trading' && (
            <div className="flex items-center gap-1.5 ml-2" title={wsConnected ? '实时连接正常' : connectionError || '实时连接断开'}>
              {wsConnected ? (
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              ) : (
                <WifiOff className="w-4 h-4 text-text-tertiary" />
              )}
            </div>
          )}

          {/* 折叠/展开按钮 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? '展开日志' : '折叠日志'}
          >
            {isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* 日志内容区 */}
      {!isCollapsed && (
        <div
          ref={logContainerRef}
          className="overflow-y-auto px-2 font-mono text-sm animate-in fade-in slide-in-from-top-2 duration-200"
          style={{ height: maxHeight }}
        >
          {filteredLogs.length === 0 ? (
            <div className="text-text-tertiary text-center py-8">
              {!instanceId ? (
                '请选择一个运行中的实例'
              ) : activeTab === 'trading' && !wsConnected ? (
                <span className="flex flex-col items-center gap-2">
                  <WifiOff className="w-8 h-8 text-text-disabled" />
                  {connectionError || '正在连接...'}
                </span>
              ) : vpsLoading ? (
                <span className="flex flex-col items-center gap-2">
                  <RefreshCw className="w-8 h-8 text-text-disabled animate-spin" />
                  加载中...
                </span>
              ) : (
                '暂无日志'
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2">
                  <span className="text-text-disabled flex-shrink-0">
                    [{formatTime(log.timestamp)}]
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-semibold ${getLevelBadge(log.level)}`}
                  >
                    {log.level.toUpperCase()}
                  </span>
                  <span className={getLevelStyle(log.level)}>{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 暂停提示 */}
      {!isCollapsed && isPaused && activeTab === 'trading' && (
        <div className="px-2 text-center text-warning text-sm">
          日志已暂停，点击播放按钮继续
        </div>
      )}
    </div>
  );
}
