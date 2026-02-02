import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SignalsService } from './signals.service';
import { SignalsController } from './signals.controller';
import { SignalProcessor } from './processors/signal.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'signal' }, { name: 'trade' })],
  controllers: [SignalsController],
  providers: [SignalsService, SignalProcessor],
  exports: [SignalsService],
})
export class SignalsModule {}
