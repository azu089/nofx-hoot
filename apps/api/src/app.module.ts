import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
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
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    // 定时任务
    ScheduleModule.forRoot(),
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 全局启用 JWT 认证
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
