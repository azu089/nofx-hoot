import { Module } from '@nestjs/common';
import { TradingController } from './trading.controller';
import { InstancesModule } from '../instances/instances.module';
import { FreqtradeModule } from '../freqtrade/freqtrade.module';
import { DigitalOceanModule } from '../digitalocean/digitalocean.module';

/**
 * 交易机器人模块
 * 提供机器人控制和实时交易功能
 * 代理到用户的 VPS Freqtrade 实例
 */
@Module({
  imports: [InstancesModule, FreqtradeModule, DigitalOceanModule],
  controllers: [TradingController],
  providers: [],
  exports: [],
})
export class TradingModule {}
