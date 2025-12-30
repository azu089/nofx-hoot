import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * WebSocket Events 模块
 *
 * 负责实时数据推送：
 * - 交易日志流
 * - 状态变更通知
 * - 新交易通知
 * - 心跳检测
 */
@Module({
  imports: [
    // 导入 JWT 模块（用于 WebSocket 认证）
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'dev-secret-key',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '7d') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway], // 导出 Gateway，供其他模块使用
})
export class EventsModule {}
