import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingModule } from '../modules/billing/billing.module';
import { TradesModule } from '../modules/trades/trades.module';
import { StakingModule } from '../modules/staking/staking.module';
import { TradeSyncTask } from './trade-sync.task';
import { SubscriptionTask } from './subscription.task';
import { GasFeeArrearsTask } from './gas-fee-arrears.task';
import { StakingRewardsTask } from './staking-rewards.task';

/**
 * 定时任务模块
 * 注册所有定时任务
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    BillingModule,
    TradesModule,
    StakingModule,
  ],
  providers: [TradeSyncTask, SubscriptionTask, GasFeeArrearsTask, StakingRewardsTask],
  exports: [TradeSyncTask, SubscriptionTask, GasFeeArrearsTask, StakingRewardsTask],
})
export class TasksModule {}
