import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { TradingService } from './trading.service';
import { PositionsService } from './positions.service';
import { FeeService } from './fee.service';
import { RiskControlService } from './risk-control.service';
import { PositionsController } from './positions.controller';
import { TradeProcessor } from './processors/trade.processor';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SignalsModule } from '../signals/signals.module';
import { ReferralModule } from '../referral/referral.module';
import { AirdropModule } from '../airdrop/airdrop.module';
import { ExchangeAdaptersModule } from '../exchange-adapters/exchange-adapters.module';

// 配置管理服务
import { TradingConfigService } from './config/config.service';
import { MarketStatusService } from './config/market-status.service';
import { CircuitBreakerService } from './config/circuit-breaker.service';

// 风控执行服务
import { PositionMonitorService } from './position-monitor.service';
import { DcaService } from './dca.service';
import { MarketMonitorService } from './market-monitor.service';
import { DailyPnlService } from './daily-pnl.service';

// 持仓同步服务
import { PositionSyncService } from './position-sync.service';

// 交易所历史持仓同步 + 统一扣费
import { ClosedPnlSyncService } from './closed-pnl-sync.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'trade' }),
    ScheduleModule.forRoot(),
    ApiKeysModule,
    ExchangeAdaptersModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => SignalsModule),
    ReferralModule,
    AirdropModule,
  ],
  controllers: [PositionsController],
  providers: [
    // 核心服务
    TradingService,
    PositionsService,
    FeeService,
    RiskControlService,
    TradeProcessor,
    // 配置管理服务
    TradingConfigService,
    MarketStatusService,
    CircuitBreakerService,
    // 风控执行服务
    PositionMonitorService,
    DcaService,
    MarketMonitorService,
    DailyPnlService,
    // 持仓同步服务
    PositionSyncService,
    // 交易所历史持仓同步 + 统一扣费
    ClosedPnlSyncService,
  ],
  exports: [
    TradingService,
    PositionsService,
    FeeService,
    RiskControlService,
    TradingConfigService,
    MarketStatusService,
    CircuitBreakerService,
    // 风控执行服务
    PositionMonitorService,
    DcaService,
    MarketMonitorService,
    DailyPnlService,
    // 持仓同步服务
    PositionSyncService,
    // 交易所历史持仓同步 + 统一扣费
    ClosedPnlSyncService,
  ],
})
export class TradingModule {}
