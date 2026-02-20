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
    (event: string, handler: (...args: any[]) => void) => {
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
    (event: string, data?: any) => {
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

    const cleanup = on('ai:research:progress', (event: ResearchProgressEvent) => {
      if (event.sessionId === sessionId) {
        onProgress(event);
      }
    });

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
        on('ai:strategy:status', (event: StrategyStatusEvent) => {
          if (event.strategyId === strategyId) {
            callbacks.onStatusChange!(event);
          }
        }),
      );
    }

    if (callbacks?.onDecision) {
      cleanups.push(
        on('ai:decision', (event: StrategyDecisionEvent) => {
          if (event.strategyId === strategyId) {
            callbacks.onDecision!(event);
          }
        }),
      );
    }

    return () => {
      cleanups.forEach((fn) => fn());
    };
  }, [connected, strategyId, callbacks, on]);

  return { connected };
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
  strategyId: string;
  symbol: string;
  action: string;
  confidence: number;
  executed: boolean;
  reasoning?: string;
}
