import { Module } from '@nestjs/common';
import { TradingController } from './trading.controller';

/**
 * 交易机器人模块
 * 提供机器人控制和实时交易功能
 */
@Module({
  controllers: [TradingController],
  providers: [],
  exports: [],
})
export class TradingModule {}
