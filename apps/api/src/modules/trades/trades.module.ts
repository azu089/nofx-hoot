import { Module } from '@nestjs/common';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { FreqtradeModule } from '../freqtrade/freqtrade.module';
import { PointsModule } from '../points/points.module';

/**
 * 交易历史模块
 * 负责交易数据同步、查询和统计
 *
 * 积分联动：
 * - 交易同步后自动调用 PointsService.earnFromTrade()
 * - 每 100 USDT 交易量 = 1 积分
 */
@Module({
  imports: [PrismaModule, FreqtradeModule, PointsModule],
  controllers: [TradesController],
  providers: [TradesService],
  exports: [TradesService],
})
export class TradesModule {}
