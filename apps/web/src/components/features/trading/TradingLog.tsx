'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { Terminal, Pause, Play, Trash2, Download, Wifi, WifiOff } from 'lucide-react';
import { wsClient, LogEvent } from '@/lib/websocket';
import { getToken } from '@/lib/api';

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
}

export function TradingLog({ instanceId, isConnected = false }: TradingLogProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [wsConnected, setWsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const logsBufferRef = useRef<LogEntry[]>([]);

  // 添加日志到缓冲区
  const addLog = useCallback((log: LogEntry) => {
    if (isPaused) {
      // 暂停时存入缓冲区
      logsBufferRef.current = [...logsBufferRef.current.slice(-99), log];
    } else {
      setLogs((prev) => [...prev.slice(-99), log]);
    }
  }, [isPaused]);

  // 连接 WebSocket
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const connect = async () => {
      try {
        setConnectionError(null);
        await wsClient.connect(token);
        setWsConnected(true);

        // 添加连接成功日志
        addLog({
          id: `sys-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'WebSocket 连接成功',
        });
      } catch (error) {
        console.error('WebSocket 连接失败:', error);
        setWsConnected(false);
        setConnectionError(error instanceof Error ? error.message : '连接失败');

        addLog({
          id: `sys-${Date.now()}`,
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `WebSocket 连接失败: ${error instanceof Error ? error.message : '未知错误'}`,
        });
      }
    };

    connect();

    // 监听连接断开
    wsClient.on('disconnect', () => {
      setWsConnected(false);
      addLog({
        id: `sys-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: 'WebSocket 连接断开',
      });
    });

    // 监听重连
    wsClient.on('connect', () => {
      setWsConnected(true);
      setConnectionError(null);
      addLog({
        id: `sys-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'WebSocket 已重新连接',
      });
    });

    return () => {
      wsClient.disconnect();
    };
  }, [addLog]);

  // 订阅实例日志
  useEffect(() => {
    if (!instanceId || !wsConnected) return;

    // 订阅日志
    wsClient.subscribeToLogs(instanceId);

    addLog({
      id: `sys-${Date.now()}`,
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `已订阅实例 ${instanceId.slice(0, 8)}... 的日志`,
    });

    // 监听日志事件
    const handleLog = (data: unknown) => {
      const event = data as LogEvent;
      if (event.instanceId === instanceId) {
        addLog({
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
  }, [instanceId, wsConnected, addLog]);

  // 恢复暂停时刷新缓冲区中的日志
  useEffect(() => {
    if (!isPaused && logsBufferRef.current.length > 0) {
      setLogs((prev) => [...prev, ...logsBufferRef.current].slice(-100));
      logsBufferRef.current = [];
    }
  }, [isPaused]);

  // 自动滚动到底部
  useEffect(() => {
    if (!isPaused && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

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

  const filteredLogs = filter === 'all' ? logs : logs.filter((log) => log.level === filter);

  const handleClear = () => {
    setLogs([]);
  };

  const handleDownload = () => {
    const content = logs
      .map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-log-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary-400" />
            实时日志
            {/* WebSocket 连接状态指示器 */}
            <div className="flex items-center gap-1.5" title={wsConnected ? 'WebSocket 已连接' : connectionError || 'WebSocket 未连接'}>
              {wsConnected ? (
                <Wifi className="w-4 h-4 text-success-400" />
              ) : (
                <WifiOff className="w-4 h-4 text-text-tertiary" />
              )}
              <span
                className={`w-2 h-2 rounded-full ${
                  wsConnected ? 'bg-success-400 animate-pulse' : 'bg-text-tertiary'
                }`}
              />
            </div>
          </CardTitle>
          <div className="flex items-center gap-2">
            <select
              className="bg-bg-tertiary border border-border-secondary rounded px-2 py-1 text-sm text-text-primary"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">全部</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="debug">Debug</option>
            </select>
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
            <Button variant="ghost" size="sm" onClick={handleClear} title="清空">
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDownload} title="下载">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={logContainerRef}
          className="h-64 overflow-y-auto bg-bg-secondary rounded-lg p-4 font-mono text-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-text-tertiary text-center py-8">
              {!instanceId ? (
                '请选择一个运行中的实例'
              ) : !wsConnected ? (
                <span className="flex flex-col items-center gap-2">
                  <WifiOff className="w-8 h-8 text-text-disabled" />
                  {connectionError || '正在连接 WebSocket...'}
                </span>
              ) : (
                '等待日志...'
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
                    className={`px-1.5 py-0.5 rounded text-xs ${getLevelBadge(log.level)}`}
                  >
                    {log.level.toUpperCase()}
                  </span>
                  <span className={getLevelStyle(log.level)}>{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {isPaused && (
          <div className="mt-2 text-center text-warning text-sm">
            日志已暂停，点击播放按钮继续
          </div>
        )}
      </CardContent>
    </Card>
  );
}
