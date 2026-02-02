import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { StrategiesModule } from './modules/strategies/strategies.module';
import { SignalsModule } from './modules/signals/signals.module';
import { TradingModule } from './modules/trading/trading.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { ReferralModule } from './modules/referral/referral.module';
import { AdminModule } from './modules/admin/admin.module';
import { StakingModule } from './modules/staking/staking.module';
import { GatewaysModule } from './gateways/gateways.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HealthModule } from './modules/health/health.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { EmailModule } from './modules/email/email.module';
import { MarketModule } from './modules/market/market.module';
import { AirdropModule } from './modules/airdrop/airdrop.module';
import { AgentModule } from './modules/agent/agent.module';
import { MembershipModule } from './modules/membership/membership.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    // 定时任务
    ScheduleModule.forRoot(),
    // 全局请求频率限制（防止暴力破解和 DDoS）
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 秒
        limit: 10, // 每秒最多 10 次请求
      },
      {
        name: 'medium',
        ttl: 10000, // 10 秒
        limit: 50, // 每 10 秒最多 50 次请求
      },
      {
        name: 'long',
        ttl: 60000, // 1 分钟
        limit: 200, // 每分钟最多 200 次请求
      },
    ]),
    // BullMQ 全局配置
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    PrismaModule,
    AuthModule,
    ApiKeysModule,
    StrategiesModule,
    SignalsModule,
    TradingModule,
    WalletModule,
    ReferralModule,
    AdminModule,
    StakingModule,
    GatewaysModule,
    NotificationsModule,
    HealthModule,
    BlockchainModule,
    EmailModule,
    MarketModule,
    AirdropModule,
    AgentModule,
    MembershipModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 全局启用请求频率限制
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // 全局启用 JWT 认证
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
