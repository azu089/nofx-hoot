'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';
import { getToken } from '@/lib/api';

/**
 * 日志条目类型
 */
export interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  pair?: string;
  action?: string;
  data?: Record<string, unknown>;
}

/**
 * WebSocket 连接状态
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * WebSocket 事件类型
 */
interface WebSocketEvents {
  logs: { instanceId: string; log: LogEntry; timestamp: string };
  status: { status: unknown; timestamp: string };
  trades: { trade: unknown; timestamp: string };
  heartbeat: { instanceId: string; heartbeat: unknown; timestamp: string };
  connected: { message: string; userId: string; timestamp: string };
}

interface UseTradingWebSocketOptions {
  /** 是否自动连接 */
  autoConnect?: boolean;
  /** 最大保留日志数量 */
  maxLogs?: number;
  /** 是否自动重连 */
  autoReconnect?: boolean;
  /** 重连间隔（毫秒） */
  reconnectInterval?: number;
}

/**
 * 交易 WebSocket Hook
 * 用于实时接收交易日志、状态变更、新交易等事件
 */
export function useTradingWebSocket(
  instanceId: string | null,
  options: UseTradingWebSocketOptions = {}
) {
  const {
    autoConnect = true,
    maxLogs = 100,
    autoReconnect = true,
    reconnectInterval = 5000,
  } = options;

  const { isAuthenticated } = useAuthStore();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const isSubscribedRef = useRef(false);

  /**
   * 添加日志条目
   */
  const addLog = useCallback((log: LogEntry) => {
    setLogs(prev => {
      const newLogs = [log, ...prev];
      // 限制日志数量
      if (newLogs.length > maxLogs) {
        return newLogs.slice(0, maxLogs);
      }
      return newLogs;
    });
  }, [maxLogs]);

  /**
   * 清空日志
   */
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  /**
   * 连接 WebSocket
   */
  const connect = useCallback(() => {
    // 在回调内部获取 token，避免 hydration 错误
    const currentToken = getToken();

    if (!isAuthenticated || !currentToken) {
      setError('未登录，无法连接 WebSocket');
      setStatus('error');
      return;
    }

    // 清除之前的重连定时器
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setStatus('connecting');
    setError(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
    const socketUrl = `${apiUrl}/events`;

    const newSocket = io(socketUrl, {
      auth: { token: currentToken },
      transports: ['websocket', 'polling'],
      reconnection: autoReconnect,
      reconnectionAttempts: 5,
      reconnectionDelay: reconnectInterval,
    });

    // 连接成功
    newSocket.on('connect', () => {
      console.log('[WebSocket] 连接成功');
      setStatus('connected');
      setError(null);

      // 如果有实例 ID，自动订阅日志
      if (instanceId && !isSubscribedRef.current) {
        newSocket.emit('subscribe:logs', { instanceId }, (response: { success: boolean; message: string }) => {
          if (response.success) {
            console.log(`[WebSocket] 已订阅实例 ${instanceId} 的日志`);
            isSubscribedRef.current = true;

            // 添加连接成功日志
            addLog({
              id: `connect-${Date.now()}`,
              level: 'info',
              message: `已连接到实时日志流 (实例: ${instanceId})`,
              timestamp: new Date().toISOString(),
            });
          }
        });
      }
    });

    // 连接断开
    newSocket.on('disconnect', (reason) => {
      console.log(`[WebSocket] 连接断开: ${reason}`);
      setStatus('disconnected');
      isSubscribedRef.current = false;

      // 如果不是主动断开且需要重连
      if (autoReconnect && reason !== 'io client disconnect') {
        addLog({
          id: `disconnect-${Date.now()}`,
          level: 'warn',
          message: `连接断开，正在尝试重连...`,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // 连接错误
    newSocket.on('connect_error', (err) => {
      console.error('[WebSocket] 连接错误:', err.message);
      setStatus('error');
      setError(err.message);

      addLog({
        id: `error-${Date.now()}`,
        level: 'error',
        message: `WebSocket 连接失败: ${err.message}`,
        timestamp: new Date().toISOString(),
      });
    });

    // 接收日志
    newSocket.on('logs', (data: WebSocketEvents['logs']) => {
      const { log, timestamp } = data;
      addLog({
        ...log,
        id: log.id || `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: log.timestamp || timestamp,
      });
    });

    // 接收状态变更
    newSocket.on('status', (data: WebSocketEvents['status']) => {
      console.log('[WebSocket] 状态变更:', data.status);
      addLog({
        id: `status-${Date.now()}`,
        level: 'info',
        message: `状态变更: ${JSON.stringify(data.status)}`,
        timestamp: data.timestamp,
      });
    });

    // 接收新交易
    newSocket.on('trades', (data: WebSocketEvents['trades']) => {
      console.log('[WebSocket] 新交易:', data.trade);
      const trade = data.trade as { pair?: string; side?: string; amount?: number };
      addLog({
        id: `trade-${Date.now()}`,
        level: 'info',
        message: `新交易: ${trade.pair || '未知'} ${trade.side || ''}`,
        timestamp: data.timestamp,
        pair: trade.pair,
        action: trade.side,
        data: trade as Record<string, unknown>,
      });
    });

    // 接收心跳
    newSocket.on('heartbeat', (data: WebSocketEvents['heartbeat']) => {
      console.log('[WebSocket] 心跳:', data);
    });

    // 服务端欢迎消息
    newSocket.on('connected', (data: WebSocketEvents['connected']) => {
      console.log('[WebSocket] 服务端欢迎:', data);
    });

    setSocket(newSocket);
  }, [isAuthenticated, instanceId, autoReconnect, reconnectInterval, addLog]);

  /**
   * 断开 WebSocket
   */
  const disconnect = useCallback(() => {
    if (socket) {
      // 取消订阅
      if (instanceId && isSubscribedRef.current) {
        socket.emit('unsubscribe:logs', { instanceId });
        isSubscribedRef.current = false;
      }

      socket.disconnect();
      setSocket(null);
      setStatus('disconnected');
    }

    // 清除重连定时器
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  }, [socket, instanceId]);

  /**
   * 重新连接
   */
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(connect, 100);
  }, [disconnect, connect]);

  /**
   * 发送 ping
   */
  const ping = useCallback(() => {
    if (socket && status === 'connected') {
      socket.emit('ping', {}, (response: { success: boolean; timestamp: string }) => {
        console.log('[WebSocket] Ping response:', response);
      });
    }
  }, [socket, status]);

  // 自动连接
  useEffect(() => {
    if (autoConnect && isAuthenticated && instanceId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, isAuthenticated, instanceId]);

  // 当 instanceId 变化时重新订阅
  useEffect(() => {
    if (socket && status === 'connected' && instanceId) {
      // 如果之前已订阅其他实例，先取消
      if (isSubscribedRef.current) {
        socket.emit('unsubscribe:logs', { instanceId: 'previous' });
        isSubscribedRef.current = false;
      }

      // 订阅新实例
      socket.emit('subscribe:logs', { instanceId }, (response: { success: boolean; message: string }) => {
        if (response.success) {
          console.log(`[WebSocket] 已切换订阅到实例 ${instanceId}`);
          isSubscribedRef.current = true;
        }
      });
    }
  }, [socket, status, instanceId]);

  return {
    /** 连接状态 */
    status,
    /** 是否已连接 */
    connected: status === 'connected',
    /** 日志列表（最新的在前面） */
    logs,
    /** 错误信息 */
    error,
    /** 连接 WebSocket */
    connect,
    /** 断开连接 */
    disconnect,
    /** 重新连接 */
    reconnect,
    /** 清空日志 */
    clearLogs,
    /** 发送心跳 */
    ping,
  };
}

export default useTradingWebSocket;
