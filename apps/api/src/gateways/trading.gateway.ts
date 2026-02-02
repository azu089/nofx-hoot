import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// WebSocket 事件类型
export interface SignalEvent {
  strategyId: string;
  strategyName: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: string;
  timestamp: Date;
}

export interface PositionEvent {
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
  executedAt: Date;
}

@WebSocketGateway({
  namespace: '/trading',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class TradingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TradingGateway.name);
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> socketIds

  constructor(private jwtService: JwtService) {}

  // 客户端连接
  async handleConnection(client: Socket) {
    try {
      // 从 handshake 获取 token
      const token =
        client.handshake.auth?.token || client.handshake.query?.token;

      if (!token) {
        this.logger.warn(`客户端 ${client.id} 未提供 token`);
        client.disconnect();
        return;
      }

      // 验证 JWT
      const payload = this.jwtService.verify(token as string);
      const userId = payload.sub;

      // 存储 socket 关联
      client.data.userId = userId;

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // 加入用户专属房间
      client.join(`user:${userId}`);

      this.logger.log(`用户 ${userId} 已连接 (socket: ${client.id})`);

      // 发送连接成功消息
      client.emit('connected', { userId, message: '连接成功' });
    } catch (error) {
      this.logger.error(`连接验证失败: ${error.message}`);
      client.disconnect();
    }
  }

  // 客户端断开
  handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id);

      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.logger.log(`客户端断开: ${client.id}`);
  }

  // 订阅策略信号
  @SubscribeMessage('subscribe:strategy')
  handleSubscribeStrategy(
    @ConnectedSocket() client: Socket,
    @MessageBody() strategyId: string,
  ) {
    client.join(`strategy:${strategyId}`);
    this.logger.log(`用户 ${client.data.userId} 订阅策略 ${strategyId}`);
    return { subscribed: strategyId };
  }

  // 取消订阅策略信号
  @SubscribeMessage('unsubscribe:strategy')
  handleUnsubscribeStrategy(
    @ConnectedSocket() client: Socket,
    @MessageBody() strategyId: string,
  ) {
    client.leave(`strategy:${strategyId}`);
    this.logger.log(`用户 ${client.data.userId} 取消订阅策略 ${strategyId}`);
    return { unsubscribed: strategyId };
  }

  // ==================== 服务端推送方法 ====================

  // 广播信号给订阅者
  broadcastSignal(strategyId: string, signal: SignalEvent) {
    this.server.to(`strategy:${strategyId}`).emit('signal', signal);
    this.logger.log(
      `广播信号: 策略 ${strategyId}, ${signal.side} ${signal.symbol}`,
    );
  }

  // 推送持仓更新给指定用户
  sendPositionUpdate(userId: string, position: PositionEvent) {
    this.server.to(`user:${userId}`).emit('position', position);
    this.logger.log(
      `推送持仓更新给用户 ${userId}: ${position.action} ${position.symbol}`,
    );
  }

  // 推送交易执行结果给指定用户
  sendTradeExecution(userId: string, execution: TradeExecutionEvent) {
    this.server.to(`user:${userId}`).emit('trade:execution', execution);
    this.logger.log(`推送交易执行结果给用户 ${userId}: ${execution.status}`);
  }

  // 推送通知给指定用户
  sendNotification(
    userId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      data?: any;
    },
  ) {
    this.server.to(`user:${userId}`).emit('notification', notification);
  }

  // 广播系统公告
  broadcastAnnouncement(announcement: {
    title: string;
    message: string;
    level: 'info' | 'warning' | 'error';
  }) {
    this.server.emit('announcement', announcement);
    this.logger.log(`广播系统公告: ${announcement.title}`);
  }

  // 检查用户是否在线
  isUserOnline(userId: string): boolean {
    return (
      this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0
    );
  }

  // 获取在线用户数
  getOnlineUserCount(): number {
    return this.userSockets.size;
  }
}
