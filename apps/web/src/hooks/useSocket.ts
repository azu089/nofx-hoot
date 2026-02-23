'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';

/**
 * WebSocket 连接 Hook — 连接后端 /trading namespace
 *
 * 按需在页面级使用，避免全局 Provider 导致不必要连接。
 * 认证方式: JWT token 通过 handshake.auth.token 传递。
 *
 * @param enabled 是否启用连接（默认 true）
 */
export function useSocket(enabled: boolean = true) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    // 从 cookie 或 localStorage 获取 token
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('token') || getCookieToken()
        : null;

    if (!token) return;

    const socket = io(`${API_BASE}/trading`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connected', () => {
      // 后端确认认证成功
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled]);

  /**
   * 监听指定事件
   */
  const on = useCallback(
    (event: string, handler: (...args: unknown[]) => void) => {
      socketRef.current?.on(event, handler);
      return () => {
        socketRef.current?.off(event, handler);
      };
    },
    [],
  );

  /**
   * 发送事件
   */
  const emit = useCallback(
    (event: string, data?: unknown) => {
      socketRef.current?.emit(event, data);
    },
    [],
  );

  return { connected, on, emit, socket: socketRef };
}

/**
 * 研究进度 WebSocket Hook
 * 监听 ai:research:progress 事件，增强研究详情页的实时反馈
 */
export function useResearchProgress(
  sessionId: string | undefined,
  onProgress?: (event: ResearchProgressEvent) => void,
) {
  const { connected, on } = useSocket(!!sessionId);

  useEffect(() => {
    if (!connected || !sessionId || !onProgress) return;

    const cleanup = on('ai:research:progress', ((...args: unknown[]) => {
      const event = args[0] as ResearchProgressEvent;
      if (event.sessionId === sessionId) {
        onProgress(event);
      }
    }));

    return cleanup;
  }, [connected, sessionId, onProgress, on]);

  return { connected };
}

/**
 * 策略状态 WebSocket Hook
 * 监听 ai:strategy:status + ai:decision 事件
 */
export function useStrategySocket(
  strategyId: string | undefined,
  callbacks?: {
    onStatusChange?: (event: StrategyStatusEvent) => void;
    onDecision?: (event: StrategyDecisionEvent) => void;
  },
) {
  const { connected, on } = useSocket(!!strategyId);

  useEffect(() => {
    if (!connected || !strategyId) return;

    const cleanups: (() => void)[] = [];

    if (callbacks?.onStatusChange) {
      cleanups.push(
        on('ai:strategy:status', ((...args: unknown[]) => {
          const event = args[0] as StrategyStatusEvent;
          if (event.strategyId === strategyId) {
            callbacks.onStatusChange!(event);
          }
        })),
      );
    }

    if (callbacks?.onDecision) {
      cleanups.push(
        on('ai:decision', ((...args: unknown[]) => {
          const event = args[0] as StrategyDecisionEvent;
          if (event.strategyId === strategyId) {
            callbacks.onDecision!(event);
          }
        })),
      );
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [connected, strategyId, callbacks, on]);

  return { connected };
}

/**
 * 持仓实时更新 Hook
 * 监听 position + trade:execution 事件，自动 invalidate 相关 query
 *
 * @param enabled 是否启用（页面可见时启用）
 * @param callbacks 可选回调
 */
export function usePositionSocket(
  enabled: boolean = true,
  callbacks?: {
    onPositionUpdate?: (event: PositionUpdateEvent) => void;
    onTradeExecution?: (event: TradeExecutionEvent) => void;
  },
) {
  const { connected, on } = useSocket(enabled);

  useEffect(() => {
    if (!connected) return;

    const cleanups: (() => void)[] = [];

    cleanups.push(
      on('position', ((...args: unknown[]) => {
        callbacks?.onPositionUpdate?.(args[0] as PositionUpdateEvent);
      })),
    );

    cleanups.push(
      on('trade:execution', ((...args: unknown[]) => {
        callbacks?.onTradeExecution?.(args[0] as TradeExecutionEvent);
      })),
    );

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [connected, callbacks, on]);

  return { connected };
}

/**
 * 全局通知 Hook
 * 监听 notification 事件，用于 layout 级全局 toast
 */
export function useNotificationSocket(
  enabled: boolean = true,
  onNotification?: (event: NotificationEvent) => void,
) {
  const { connected, on } = useSocket(enabled);

  useEffect(() => {
    if (!connected || !onNotification) return;

    const cleanup = on('notification', ((...args: unknown[]) => {
      onNotification(args[0] as NotificationEvent);
    }));

    return cleanup;
  }, [connected, onNotification, on]);

  return { connected };
}

/**
 * AI 预算告警 Hook
 * 监听 ai:budget:alert 事件，触发全局警告 toast
 */
export function useBudgetAlertSocket(
  enabled: boolean = true,
  onAlert?: (event: BudgetAlertEvent) => void,
) {
  const { connected, on } = useSocket(enabled);

  useEffect(() => {
    if (!connected || !onAlert) return;

    const cleanup = on('ai:budget:alert', ((...args: unknown[]) => {
      onAlert(args[0] as BudgetAlertEvent);
    }));

    return cleanup;
  }, [connected, onAlert, on]);

  return { connected };
}

/**
 * 辩论事件 Hook
 * 监听 ai:debate:event 事件，用于策略详情页实时辩论进度
 */
export function useDebateSocket(
  strategyId: string | undefined,
  onDebateEvent?: (event: DebateEvent) => void,
) {
  const { connected, on } = useSocket(!!strategyId);

  useEffect(() => {
    if (!connected || !strategyId || !onDebateEvent) return;

    const cleanup = on('ai:debate:event', ((...args: unknown[]) => {
      const event = args[0] as DebateEvent;
      if (event.strategyId === strategyId) {
        onDebateEvent(event);
      }
    }));

    return cleanup;
  }, [connected, strategyId, onDebateEvent, on]);

  return { connected };
}

/**
 * 实时决策流 Hook
 * 监听 ai:decision 事件，累积到本地 state，供策略详情页实时展示
 */
export function useDecisionStream(
  strategyId: string | undefined,
  maxItems = 20,
) {
  const [decisions, setDecisions] = useState<StrategyDecisionEvent[]>([]);
  const { connected, on } = useSocket(!!strategyId);

  useEffect(() => {
    if (!connected || !strategyId) return;

    const cleanup = on('ai:decision', ((...args: unknown[]) => {
      const event = args[0] as StrategyDecisionEvent;
      if (event.strategyId === strategyId) {
        setDecisions(prev => [event, ...prev].slice(0, maxItems));
      }
    }));

    return cleanup;
  }, [connected, strategyId, maxItems, on]);

  const clear = useCallback(() => setDecisions([]), []);

  return { decisions, clear, connected };
}

// ========================= 工具函数 =========================

function getCookieToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ========================= 类型定义 =========================

export interface ResearchProgressEvent {
  sessionId: string;
  stage: string;
  progress: number;
  message?: string;
  analysts?: { id: string; status: string }[];
}

export interface StrategyStatusEvent {
  strategyId: string;
  status: 'running' | 'paused' | 'stopped' | 'error';
  message?: string;
}

export interface StrategyDecisionEvent {
  strategyId?: string;
  sessionId?: string;
  symbol: string;
  action: string;
  confidence: number;
  reasoning?: string;
  source?: 'ai_research' | 'ai_strategy';
  // 决策状态 + 执行结果
  status?: 'blocked' | 'skipped' | 'executed' | 'failed';
  blockedBy?: string;
  leverage?: number;
  orderId?: string;
  positionId?: string;
  price?: number;
  amount?: number;
  error?: string;
  stopLoss?: number | null;
  takeProfit?: number | null;
  positionSizePercent?: number;
  timestamp?: string;
}

export interface PositionUpdateEvent {
  id: string;
  symbol: string;
  side: string;
  entryPrice: string;
  amount: string;
  pnl?: string;
  status: string;
  action: 'opened' | 'closed' | 'updated';
}

export interface TradeExecutionEvent {
  signalId: string;
  userId: string;
  status: 'pending' | 'success' | 'failed';
  message?: string;
  orderId?: string;
  executedAt: string;
}

export interface NotificationEvent {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
}

export interface BudgetAlertEvent {
  userId: string;
  currentSpend: number;
  budgetLimit: number;
  percentUsed: number;
  message: string;
}

export interface DebateEvent {
  strategyId: string;
  stage: string;
  speaker?: string;
  message?: string;
  progress: number;
  totalStages: number;
}
