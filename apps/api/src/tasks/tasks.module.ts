import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingModule } from '../modules/billing/billing.module';
import { TradesModule } from '../modules/trades/trades.module';
import { StakingModule } from '../modules/staking/staking.module';
import { StrategiesModule } from '../modules/strategies/strategies.module'; // Phase 16
import { DigitalOceanModule } from '../modules/digitalocean/digitalocean.module';
import { FreqtradeModule } from '../modules/freqtrade/freqtrade.module';
import { EventsModule } from '../events/events.module';
import { TradeSyncTask } from './trade-sync.task';
import { SubscriptionTask } from './subscription.task';
import { GasFeeArrearsTask } from './gas-fee-arrears.task';
import { StakingRewardsTask } from './staking-rewards.task';
import { StrategyPerformanceTask } from './strategy-performance.task'; // Phase 16
import { LogStreamingTask } from './log-streaming.task';
import { CrashProtectionTask } from './crash-protection.task'; // 黑天鹅防护
import { DividendTask } from './dividend.task'; // 周分红任务

/**
 * 定时任务模块
 * 注册所有定时任务
 *
 * Phase 16 新增：
 * - StrategyPerformanceTask: 每日凌晨 2:00 更新策略性能并调整分成等级
 *
 * 黑天鹅防护：
 * - CrashProtectionTask: 每分钟监控价格，触发保护时自动暂停策略
 *
 * 重要规则：
 * - SubscriptionTask: 订阅到期 + 宽限期结束 = VPS 自动销毁（调用 DO API）
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    BillingModule,
    TradesModule,
    StakingModule,
    StrategiesModule, // Phase 16: 需要 RevenuePricingService
    DigitalOceanModule, // 用于订阅到期时销毁 VPS
    FreqtradeModule, // 用于获取 VPS 日志和黑天鹅防护
    EventsModule, // 用于 WebSocket 推送
  ],
  providers: [
    TradeSyncTask,
    SubscriptionTask,
    GasFeeArrearsTask,
    StakingRewardsTask,
    StrategyPerformanceTask, // Phase 16
    LogStreamingTask, // 日志流推送
    CrashProtectionTask, // 黑天鹅防护
    DividendTask, // 周分红任务
  ],
  exports: [
    TradeSyncTask,
    SubscriptionTask,
    GasFeeArrearsTask,
    StakingRewardsTask,
    StrategyPerformanceTask, // Phase 16
    LogStreamingTask,
    CrashProtectionTask, // 黑天鹅防护
    DividendTask, // 周分红任务
  ],
})
export class TasksModule {}
