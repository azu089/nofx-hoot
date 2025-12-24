import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { InstancesModule } from './modules/instances/instances.module';
import { StrategiesModule } from './modules/strategies/strategies.module';
import { BillingModule } from './modules/billing/billing.module';
import { DigitalOceanModule } from './modules/digitalocean/digitalocean.module';

@Module({
  imports: [
    ScheduleModule.forRoot(), // 定时任务模块（全局）
    ConfigModule, // 配置模块（全局）
    PrismaModule, // Prisma 数据库模块
    RedisModule, // Redis 模块（全局）
    AuthModule, // 认证模块
    UsersModule, // 用户模块
    WalletsModule, // 钱包模块
    InstancesModule, // VPS 实例模块
    StrategiesModule, // 策略模块
    BillingModule, // 计费模块
    DigitalOceanModule, // DigitalOcean VPS 编排模块
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
