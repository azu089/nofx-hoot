import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * WebSocket 网关
 *
 * 功能：
 * - JWT 认证（连接时验证 token）
 * - 4 个事件通道：
 *   - logs: 推送交易日志
 *   - status: 推送状态变更
 *   - trades: 推送新交易
 *   - heartbeat: 心跳检测
 *
 * 连接方式：
 * - 客户端需要在连接时传递 token
 * - 例如: io('http://localhost:4001', { auth: { token: 'jwt_token' } })
 *
 * 安全性：
 * - 验证 JWT token
 * - 绑定 userId 到 socket
 * - 只推送用户自己的数据
 */
@WebSocketGateway({
  cors: {
    origin: '*', // 开发环境允许所有来源，生产环境需要配置具体域名
    credentials: true,
  },
  // 使用默认 namespace (/)，简化客户端连接
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  // 用户 ID -> Socket ID 映射表
  private userSockets = new Map<string, Set<string>>();

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Gateway 初始化
   */
  afterInit(server: Server) {
    this.logger.log('✅ WebSocket Gateway 已初始化');
  }

  /**
   * 客户端连接
   */
  async handleConnection(client: Socket) {
    try {
      // 1. 获取 token（从 auth.token 或 query.token）
      const token =
        client.handshake.auth?.token || client.handshake.query?.token;

      if (!token) {
        this.logger.warn(`客户端 ${client.id} 连接失败: 缺少 token`);
        client.disconnect();
        return;
      }

      // 2. 验证 JWT
      const payload = await this.jwtService.verifyAsync(token as string);
      const userId = payload.sub;

      if (!userId) {
        this.logger.warn(
          `客户端 ${client.id} 连接失败: token 缺少 userId`,
        );
        client.disconnect();
        return;
      }

      // 3. 绑定 userId 到 socket
      (client as any).userId = userId;

      // 4. 记录用户 socket 映射
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)?.add(client.id);

      this.logger.log(
        `用户 ${userId} 连接成功 (Socket: ${client.id}), 当前连接数: ${this.userSockets.get(userId)?.size}`,
      );

      // 5. 发送欢迎消息
      client.emit('connected', {
        message: '连接成功',
        userId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `客户端 ${client.id} 认证失败: ${error.message}`,
        error.stack,
      );
      client.disconnect();
    }
  }

  /**
   * 客户端断开连接
   */
  handleDisconnect(client: Socket) {
    const userId = (client as any).userId;

    if (userId) {
      // 从映射表中移除
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }

      this.logger.log(
        `用户 ${userId} 断开连接 (Socket: ${client.id}), 剩余连接数: ${sockets?.size || 0}`,
      );
    } else {
      this.logger.log(`未认证客户端 ${client.id} 断开连接`);
    }
  }

  /**
   * 订阅日志流
   */
  @SubscribeMessage('subscribe:logs')
  handleSubscribeLogs(
    @MessageBody() data: { instanceId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = (client as any).userId;
    this.logger.log(
      `用户 ${userId} 订阅日志流: 实例 ${data.instanceId}`,
    );

    // 加入房间（按实例 ID 分组）
    client.join(`instance:${data.instanceId}`);

    return {
      success: true,
      message: `已订阅实例 ${data.instanceId} 的日志流`,
    };
  }

  /**
   * 取消订阅日志流
   */
  @SubscribeMessage('unsubscribe:logs')
  handleUnsubscribeLogs(
    @MessageBody() data: { instanceId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = (client as any).userId;
    this.logger.log(
      `用户 ${userId} 取消订阅日志流: 实例 ${data.instanceId}`,
    );

    client.leave(`instance:${data.instanceId}`);

    return {
      success: true,
      message: `已取消订阅实例 ${data.instanceId} 的日志流`,
    };
  }

  /**
   * 心跳检测（客户端主动 ping）
   */
  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    const userId = (client as any).userId;
    this.logger.debug(`用户 ${userId} 心跳检测`);

    return {
      success: true,
      message: 'pong',
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== 服务端推送方法（供其他模块调用） ====================

  /**
   * 推送日志到指定实例的订阅者
   * @param instanceId 实例 ID
   * @param log 日志内容
   */
  pushLog(instanceId: string, log: any) {
    this.server.to(`instance:${instanceId}`).emit('logs', {
      instanceId,
      log,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`推送日志到实例 ${instanceId}: ${log.message || log}`);
  }

  /**
   * 推送状态变更到指定用户
   * @param userId 用户 ID
   * @param status 状态数据
   */
  pushStatus(userId: string, status: any) {
    const sockets = this.userSockets.get(userId);

    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('status', {
          status,
          timestamp: new Date().toISOString(),
        });
      });

      this.logger.debug(`推送状态变更到用户 ${userId}: ${status.type || JSON.stringify(status)}`);
    }
  }

  /**
   * 推送新交易到指定用户
   * @param userId 用户 ID
   * @param trade 交易数据
   */
  pushTrade(userId: string, trade: any) {
    const sockets = this.userSockets.get(userId);

    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('trades', {
          trade,
          timestamp: new Date().toISOString(),
        });
      });

      this.logger.debug(`推送新交易到用户 ${userId}: ${trade.tradeId || trade.id || JSON.stringify(trade)}`);
    }
  }

  /**
   * 推送心跳到指定实例
   * @param instanceId 实例 ID
   * @param heartbeat 心跳数据
   */
  pushHeartbeat(instanceId: string, heartbeat: any) {
    this.server.to(`instance:${instanceId}`).emit('heartbeat', {
      instanceId,
      heartbeat,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`推送心跳到实例 ${instanceId}`);
  }

  /**
   * 广播消息到所有连接的客户端
   * @param event 事件名称
   * @param data 数据
   */
  broadcast(event: string, data: any) {
    this.server.emit(event, {
      data,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`广播消息: ${event}`);
  }
}
