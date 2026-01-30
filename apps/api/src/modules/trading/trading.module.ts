import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TradingService } from './trading.service';
import { PositionsService } from './positions.service';
import { FeeService } from './fee.service';
import { PositionsController } from './positions.controller';
import { TradeProcessor } from './processors/trade.processor';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'trade' }),
    ApiKeysModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [PositionsController],
  providers: [TradingService, PositionsService, FeeService, TradeProcessor],
  exports: [TradingService, PositionsService, FeeService],
})
export class TradingModule {}
