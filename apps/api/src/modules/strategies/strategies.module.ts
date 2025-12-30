import { Module } from '@nestjs/common';
import { StrategiesController } from './strategies.controller';
import { StrategiesService } from './strategies.service';
import { BacktestService } from './backtest.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * 策略模块
 * 负责交易策略管理、回测、实盘运行等
 */
@Module({
  imports: [PrismaModule],
  controllers: [StrategiesController],
  providers: [StrategiesService, BacktestService],
  exports: [StrategiesService, BacktestService],
})
export class StrategiesModule {}
