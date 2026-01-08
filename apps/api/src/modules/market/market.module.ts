import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { StrategiesModule } from '../strategies/strategies.module';

/**
 * 市场数据模块
 * 提供交易对搜索、市场数据等功能
 */
@Module({
  imports: [StrategiesModule], // 复用 KlineService
  controllers: [MarketController],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
