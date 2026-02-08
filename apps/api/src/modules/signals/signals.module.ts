import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SignalsService } from './signals.service';
import { SignalsController } from './signals.controller';
import { SignalProcessor } from './processors/signal.processor';
import { FreqtradeHealthService } from './freqtrade-health.service';
import { GatewaysModule } from '../../gateways/gateways.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'signal' }, { name: 'trade' }),
    forwardRef(() => GatewaysModule),
  ],
  controllers: [SignalsController],
  providers: [SignalsService, SignalProcessor, FreqtradeHealthService],
  exports: [SignalsService, FreqtradeHealthService],
})
export class SignalsModule {}
