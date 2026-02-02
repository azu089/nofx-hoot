import { Module } from '@nestjs/common';
import { StrategiesService } from './strategies.service';
import { StrategiesController } from './strategies.controller';
import { TradingModule } from '../trading/trading.module';
import { MembershipModule } from '../membership/membership.module';

@Module({
  imports: [TradingModule, MembershipModule],
  controllers: [StrategiesController],
  providers: [StrategiesService],
  exports: [StrategiesService],
})
export class StrategiesModule {}
