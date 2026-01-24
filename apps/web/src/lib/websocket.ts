import { io, Socket } from 'socket.io-client';

// WebSocket 事件类型
export interface LogEvent {
  instanceId: string;
  log: {
    message: string;
    level: 'info' | 'warn' | 'error';
    meta?: Record<string, unknown>;
    timestamp: string;
  };
  timestamp: string;
}

export interface StatusEvent {
  status: {
    type: string;
    instanceId?: string;
    status?: string;
    reason?: string;
    timestamp: string;
  };
  timestamp: string;
}

export interface TradeEvent {
  trade: {
    id: string;
    pair: string;
    side: 'buy' | 'sell';
    amount: string;
    price: string;
    pnl: string;
    timestamp: string;
  };
  timestamp: string;
}

// WebSocket 客户端类
class WebSocketClient {
  private socket: Socket | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  // 连接状态
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // 初始化连接
  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.token = token;
      // 从 API URL 中提取 WebSocket URL（移除 /api 后缀）
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api';
      const wsUrl = apiUrl.replace(/\/api$/, '');
      console.log('[WebSocket] 连接到:', wsUrl);

      // 连接到默认 namespace (/)
      this.socket = io(wsUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      // 连接成功
      this.socket.on('connect', () => {
        console.log('[WebSocket] 连接成功:', this.socket?.id);
        this.reconnectAttempts = 0;
        resolve();
      });

      // 欢迎消息
      this.socket.on('connected', (data: unknown) => {
        console.log('[WebSocket] 收到欢迎消息:', data);
      });

      // 连接错误
      this.socket.on('connect_error', (error: Error) => {
        console.error('[WebSocket] 连接错误:', error.message);
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('WebSocket 连接失败'));
        }
      });

      // 日志事件 - 同时触发 logs 和 instance:log 以兼容不同用法
      this.socket.on('logs', (data: LogEvent) => {
        this.emit('logs', data);
        this.emit('instance:log', data);
      });

      // 状态变更事件
      this.socket.on('status', (data: StatusEvent) => {
        this.emit('status', data);
        this.emit('instance:status', data);
      });

      // 交易事件
      this.socket.on('trades', (data: TradeEvent) => {
        this.emit('trades', data);
        this.emit('instance:trade', data);
      });

      // 心跳事件
      this.socket.on('heartbeat', (data: unknown) => {
        this.emit('heartbeat', data);
      });

      // 内部转发 socket 事件
      this.socket.on('disconnect', (reason: string) => {
        console.log('[WebSocket] 断开连接:', reason);
        this.emit('disconnect', reason);
      });

      this.socket.on('reconnect', (attemptNumber: number) => {
        console.log('[WebSocket] 重连成功，尝试次数:', attemptNumber);
        this.emit('connect', { attemptNumber });
      });
    });
  }

  // 断开连接
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.token = null;
      this.listeners.clear();
      console.log('[WebSocket] 已断开连接');
    }
  }

  // 订阅实例日志
  subscribeToLogs(instanceId: string): void {
    if (!this.socket?.connected) {
      console.warn('[WebSocket] 未连接，无法订阅日志');
      return;
    }
    this.socket.emit('subscribe:logs', { instanceId });
    console.log('[WebSocket] 订阅实例日志:', instanceId);
  }

  // 取消订阅实例日志
  unsubscribeFromLogs(instanceId: string): void {
    if (!this.socket?.connected) {
      return;
    }
    this.socket.emit('unsubscribe:logs', { instanceId });
    console.log('[WebSocket] 取消订阅实例日志:', instanceId);
  }

  // 发送心跳
  ping(): void {
    if (this.socket?.connected) {
      this.socket.emit('ping');
    }
  }

  // 添加事件监听器
  on(event: string, callback: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  // 移除事件监听器
  off(event: string, callback: (data: unknown) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  // 触发事件
  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[WebSocket] 事件处理错误 (${event}):`, error);
      }
    });
  }
}

// 单例导出
export const wsClient = new WebSocketClient();

// React Hook
export function useWebSocket() {
  return {
    connect: wsClient.connect.bind(wsClient),
    disconnect: wsClient.disconnect.bind(wsClient),
    subscribeToLogs: wsClient.subscribeToLogs.bind(wsClient),
    unsubscribeFromLogs: wsClient.unsubscribeFromLogs.bind(wsClient),
    on: wsClient.on.bind(wsClient),
    off: wsClient.off.bind(wsClient),
    isConnected: wsClient.isConnected,
  };
}
