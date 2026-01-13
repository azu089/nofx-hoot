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
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { FreqtradeModule } from './modules/freqtrade/freqtrade.module';
import { TradesModule } from './modules/trades/trades.module';
import { DepositsModule } from './modules/deposits/deposits.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';
import { BackupsModule } from './modules/backups/backups.module';
import { PointsModule } from './modules/points/points.module';
import { RevenueModule } from './modules/revenue/revenue.module';
import { TokensModule } from './modules/tokens/tokens.module';
import { StakingModule } from './modules/staking/staking.module';
import { EventsModule } from './events/events.module';
import { TradeSyncTask } from './tasks/trade-sync.task';
import { SubscriptionTask } from './tasks/subscription.task';
import { SubscriptionRenewalTask } from './tasks/subscription-renewal.task';
import { BalanceCheckTask } from './tasks/balance-check.task';
import { StakingRewardsTask } from './tasks/staking-rewards.task';
import { AgentsModule } from './modules/agents/agents.module';
import { GamefiModule } from './modules/gamefi/gamefi.module';
import { AdminModule } from './modules/admin/admin.module';
import { AiModule } from './modules/ai/ai.module';
import { ConfigsModule } from './modules/configs/configs.module';
import { CmsModule } from './modules/cms/cms.module';
import { TradingModule } from './modules/trading/trading.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { MarketModule } from './modules/market/market.module';
import { ExchangeModule } from './modules/exchange/exchange.module';
import { ExchangeLinksModule } from './modules/exchange-links/exchange-links.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    ScheduleModule.forRoot(), // 定时任务模块（全局）
    ConfigModule, // 配置模块（全局）
    PrismaModule, // Prisma 数据库模块
    RedisModule, // Redis 模块（全局）
    EmailModule, // 邮件模块（全局）
    EventsModule, // WebSocket 事件模块（实时推送）
    AuthModule, // 认证模块
    UsersModule, // 用户模块
    WalletsModule, // 钱包模块
    InstancesModule, // VPS 实例模块
    StrategiesModule, // 策略模块
    BillingModule, // 计费模块
    DigitalOceanModule, // DigitalOcean VPS 编排模块
    ApiKeysModule, // API Keys 模块（交易所 API Key 管理）
    FreqtradeModule, // Freqtrade API 模块
    TradesModule, // 交易历史模块
    DepositsModule, // 充值模块
    WithdrawalsModule, // 提现模块
    BackupsModule, // 备份模块
    PointsModule, // 积分模块
    RevenueModule, // 收入分配模块
    TokensModule, // 代币模块（积分兑换、线性释放）
    StakingModule, // 质押模块
    AgentsModule, // 代理商模块
    GamefiModule, // 生态中心统一模块（积分/质押/代币/排行榜）
    AdminModule, // 管理后台模块
    AiModule, // AI 模块（策略生成/交易解读）
    ConfigsModule, // 配置中心模块（系统配置）
    CmsModule, // CMS 模块（内容/Banner/帮助文档）
    TradingModule, // 交易机器人模块（机器人控制/持仓/订单）
    TelegramModule, // Telegram Mini App 模块
    MarketModule, // 市场数据模块（交易对搜索）
    ExchangeModule, // 资产兑换模块（闪兑功能）
    ExchangeLinksModule, // 交易所推广链接模块
  ],
  controllers: [AppController],
  providers: [
    TradeSyncTask, // 交易同步任务（每分钟）
    SubscriptionTask, // VIP 订阅任务（每天）
    SubscriptionRenewalTask, // VPS 订阅续费任务（每天）
    BalanceCheckTask, // 余额检测任务（每小时）
    StakingRewardsTask, // 质押收益分配任务（每周）
  ],
})
export class AppModule {}
